"""Scrape fbref match reports into data/raw/matches/{season}/{matchId}.json.

Jobs come from every data/built/*/matches.json reportUrl, deduped by the fbref
match id in /en/matches/{id}/. Uses the same BrowserSession same-origin fetch
as run.py. Parses (never stores) the HTML: scorebox, timeline events, pitch
positions, lineups, team stats, player/keeper tables.

Resumable: skips files that already exist and look valid. Failures append to
scripts/scrape/failures.jsonl (kind "match"); score/event-count mismatches are
kept but logged as kind "match-validate".

Usage: python -X utf8 scripts/scrape/matches.py [--limit N] [--season YYYY-YYYY]
"""

import argparse
import json
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from bs4 import BeautifulSoup

from browser import BrowserSession

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "raw" / "matches"
FAIL_LOG = Path(__file__).resolve().parent / "failures.jsonl"

MATCH_ID = re.compile(r"/en/matches/([0-9a-f]{8})/")

ICON_TYPES = {
    "goal": "goal",
    "penalty_goal": "pen_goal",
    "own_goal": "own_goal",
    "penalty_missed": "pen_miss",
    "yellow_card": "yellow",
    "yellow_red_card": "second_yellow",
    "red_card": "red",
    "substitute_in": "sub",
    "substitute_out": "sub",
}


def log_failure(kind, target, err):
    rec = {"ts": time.strftime("%Y-%m-%dT%H:%M:%S"), "kind": kind,
           "target": target, "error": str(err)[:500]}
    with FAIL_LOG.open("a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def collect_jobs():
    jobs = {}
    for f in sorted((ROOT / "data" / "built").glob("*/matches.json")):
        for m in json.loads(f.read_text(encoding="utf-8")):
            u = m.get("reportUrl")
            if not u:
                continue
            mid = MATCH_ID.search(u)
            if not mid:
                continue
            jobs.setdefault(mid.group(1), (m["season"], u))
    return jobs


def cell_text(el):
    return " ".join(el.get_text(" ", strip=True).split()) if el else ""


def parse_stat_table(tbl):
    """Generic fbref stats table -> {columns, rows} via data-stat names."""
    head = tbl.select("thead th")
    cols = []
    for th in head:
        stat = th.get("data-stat")
        if not stat or stat.startswith("header"):
            continue
        cols.append({"stat": stat, "label": cell_text(th)})
    rows = []
    for tr in tbl.select("tbody tr"):
        if tr.select("th[colspan]") or "spacer" in (tr.get("class") or []):
            continue
        cells = tr.find_all(["th", "td"], recursive=False)
        vals = [cell_text(c) for c in cells]
        if not any(vals):
            continue
        row = {}
        for i, c in enumerate(cols):
            row[c["stat"]] = vals[i] if i < len(vals) else ""
        rows.append(row)
    return {"columns": cols, "rows": rows}


def parse_report(html, url):
    src = re.sub(r"<!--|-->", "", html)
    s = BeautifulSoup(src, "html.parser")

    # --- scorebox ---
    teams = s.select(".scorebox .scorebox_team")
    if len(teams) != 2:
        raise ValueError("scorebox_team count != 2")

    def team_side(t):
        a = t.select_one("strong a")
        score_el = t.select_one(".scores .score")
        dps = {}
        for dp in t.select(".datapoint"):
            txt = cell_text(dp)
            if ":" in txt:
                k, v = txt.split(":", 1)
                dps[k.strip()] = v.strip().replace("\xa0", " ")
        return {
            "name": cell_text(a),
            "fbrefId": (a["href"].split("/squads/")[1].split("/")[0]
                        if a and "/squads/" in a.get("href", "") else None),
            "score": cell_text(score_el),
            "manager": dps.get("Manager"),
            "captain": dps.get("Captain"),
        }

    sb = s.select_one(".scorebox")
    pens = None
    m = re.search(r"(\d+)\s*[\u2013-]\s*(\d+)\s*(?:on\s*)?[Pp]enalt", cell_text(sb))
    if m:
        pens = f"{m.group(1)}-{m.group(2)}"

    meta = {"attendance": None, "venue": None, "officials": [],
            "kickoff": None, "date": None, "competition": None, "round": None}
    vt = sb.select_one(".venuetime") if sb else None
    if vt:
        meta["kickoff"] = vt.get("data-venue-time")
        meta["date"] = vt.get("data-venue-date")
    for div in sb.select(".scorebox_meta div") if sb else []:
        txt = cell_text(div)
        if txt.startswith("Attendance"):
            meta["attendance"] = txt.split(":", 1)[1].strip() or None
        elif txt.startswith("Venue"):
            meta["venue"] = txt.split(":", 1)[1].strip() or None
        elif txt.startswith("Officials"):
            meta["officials"] = [cell_text(x).replace("\xa0", " ")
                                 for x in div.select("small span")]
        else:
            comp_a = div.find("a", href=re.compile(r"/en/comps/"))
            if comp_a and not meta["competition"]:
                rnd = re.search(r"\(([^)]+)\)", txt)
                meta["competition"] = cell_text(comp_a)
                meta["round"] = rnd.group(1) if rnd else None

    scorebox = {"home": team_side(teams[0]), "away": team_side(teams[1]),
                "pens": pens, **meta}

    # --- events timeline (div.event.a=home, div.event.b=away) ---
    events = []
    for e in s.select("div.event.a, div.event.b"):
        icon = e.select_one(".event_icon")
        itype = icon.get("class")[1] if icon and len(icon.get("class", [])) > 1 else None
        minute_el = e.find("div")
        mm = re.search(r"(\d+(?:\+\d+)?)[\u2019']", cell_text(minute_el))
        minute_txt = mm.group(1) if mm else None
        score_el = e.select_one("small span")
        player_a = e.select_one("div > div > div a")
        if not player_a:
            player_a = e.find("a")
        ev = {"minute": minute_txt,
              "sort": minute_key(minute_txt),
              "type": ICON_TYPES.get(itype, itype or "other"),
              "icon": itype,
              "side": "home" if "a" in e.get("class", []) else "away",
              "score": cell_text(score_el) or None,
              "player": cell_text(player_a) or None}
        for sm in e.find_all("small"):
            st = cell_text(sm)
            if st.startswith("Assist"):
                aa = sm.find("a")
                ev["assist"] = cell_text(aa) or st[7:].strip()
            elif st.startswith("for"):
                aa = sm.find("a")
                ev["playerOut"] = cell_text(aa) or st[3:].strip()
                ev["playerIn"] = ev.pop("player")
        events.append(ev)

    # --- pitch positions ---
    field = s.select_one("#field")
    pitch = {"home": [], "away": []}
    if field:
        for p in field.select("div.poptip"):
            side = "home" if "a" in p.get("class", []) else "away"
            st = p.get("style", "")
            top = re.search(r"top:\s*calc\(([\d.]+)%", st)
            right = re.search(r"right:\s*calc\(([\d.]+)%", st)
            left = re.search(r"left:\s*calc\(([\d.]+)%", st)
            pitch[side].append({
                "name": p.get("title"), "number": cell_text(p),
                "top": float(top.group(1)) if top else None,
                "right": float(right.group(1)) if right else None,
                "left": float(left.group(1)) if left else None})

    # --- lineups ---
    lineups = {"home": {"formation": None, "players": []},
               "away": {"formation": None, "players": []}}
    for lid, side in (("a", "home"), ("b", "away")):
        lu = s.select_one(f"div.lineup[id={lid}] table")
        if not lu:
            continue
        th = lu.find("th")
        m = re.search(r"\(([^)]+)\)", cell_text(th))
        lineups[side]["formation"] = m.group(1) if m else None
        for tr in lu.select("tr")[1:]:
            tds = tr.select("td")
            if len(tds) >= 2:
                lineups[side]["players"].append(
                    {"number": cell_text(tds[0]),
                     "name": cell_text(tds[1])})

    # --- team stats ---
    def stat_block(sel):
        blk = s.select_one(sel)
        out = {}
        if not blk:
            return out
        pending = None
        for tr in blk.select("tr"):
            cells = tr.find_all(["td", "th"], recursive=False)
            vals = [cell_text(c) for c in cells]
            if not any(vals):
                continue
            if len(cells) == 1 and cells[0].name == "th":
                pending = vals[0]
                continue
            if len(cells) == 3 and cells[1].name == "th":
                out[vals[1]] = {"home": vals[0], "away": vals[2]}
                continue
            if pending and len(cells) == 2:
                out[pending] = {"home": vals[0], "away": vals[1]}
                pending = None
        return out

    team_stats = stat_block("#team_stats")

    # team_stats_extra: flat divs, triples [home, label, away]
    team_stats_extra = {}
    blk = s.select_one("#team_stats_extra")
    if blk:
        vals = [cell_text(d) for d in blk.find_all("div", recursive=True)
                if not d.find("div")]
        vals = [v for v in vals if v]
        i = 0
        while i < len(vals):
            v = vals[i]
            if i + 2 < len(vals) and re.match(r"^\d", v) and vals[i + 1] \
                    and re.match(r"^\d", vals[i + 2]):
                team_stats_extra[vals[i + 1]] = {"home": v, "away": vals[i + 2]}
                i += 3
            else:
                i += 1

    # --- player + keeper tables ---
    players = {"home": None, "away": None}
    keepers = {"home": None, "away": None}
    for side, tid in (("home", scorebox["home"]["fbrefId"]),
                      ("away", scorebox["away"]["fbrefId"])):
        if not tid:
            continue
        t = s.select_one(f"table#stats_{tid}_summary")
        if t:
            players[side] = parse_stat_table(t)
        k = s.select_one(f"table#keeper_stats_{tid}")
        if k:
            keepers[side] = parse_stat_table(k)

    return {"scorebox": scorebox, "events": events, "pitch": pitch,
            "lineups": lineups, "teamStats": team_stats,
            "teamStatsExtra": team_stats_extra, "players": players,
            "keepers": keepers, "metadata": {"sourceURL": url}}


def minute_key(txt):
    if not txt:
        return None
    m = re.match(r"(\d+)(?:\+(\d+))?", txt)
    if not m:
        return None
    return int(m.group(1)) * 100 + int(m.group(2) or 0)


def valid(path):
    try:
        d = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return False
    return bool(d.get("scorebox", {}).get("home", {}).get("name")
                and "events" in d and d.get("metadata", {}).get("sourceURL"))


def save_atomic(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--season")
    ap.add_argument("--delay", type=float, default=3.0)
    args = ap.parse_args()

    jobs = collect_jobs()
    todo = {mid: v for mid, v in jobs.items()
            if not valid(OUT / v[0] / f"{mid}.json")}
    if args.season:
        todo = {k: v for k, v in todo.items() if v[0] == args.season}
    items = sorted(todo.items())
    if args.limit:
        items = items[: args.limit]
    print(f"{len(jobs)} total, {len(items)} to fetch", flush=True)
    if not items:
        return

    done = failed = skipped = 0
    with BrowserSession(headless=False, delay=args.delay, jitter=1.5) as sess:
        for mid, (season, url) in items:
            out = OUT / season / f"{mid}.json"
            for attempt in range(4):
                try:
                    status, body = sess.fetch_retries(url, tries=3)
                    if status != 200:
                        raise ValueError(f"HTTP {status}")
                    payload = parse_report(body, url)
                    hb = payload["scorebox"]
                    gh = sum(1 for e in payload["events"]
                             if e["side"] == "home" and e["type"] in ("goal", "pen_goal", "own_goal"))
                    ga = sum(1 for e in payload["events"]
                             if e["side"] == "away" and e["type"] in ("goal", "pen_goal", "own_goal"))
                    try:
                        sh, sa = int(hb["home"]["score"]), int(hb["away"]["score"])
                        if (gh, ga) != (sh, sa):
                            log_failure("match-validate", f"{season}/{mid}",
                                        f"events {gh}-{ga} != score {sh}-{sa}")
                    except (TypeError, ValueError):
                        pass
                    save_atomic(out, payload)
                    done += 1
                    break
                except Exception as e:
                    err = e
                    time.sleep(5 * (attempt + 1))
            else:
                failed += 1
                log_failure("match", f"{season}/{mid}", err)
            if (done + failed) % 25 == 0:
                print(f"{done} saved, {failed} failed, "
                      f"{len(items) - done - failed} left", flush=True)
    print(f"DONE {done} saved, {failed} failed", flush=True)


if __name__ == "__main__":
    main()
