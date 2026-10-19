"""Multi-club build pipeline: data/raw -> data/built + public/data.

Usage:
  python -X utf8 scripts/build/build_all.py [--club SLUG]

Per club (seasons from data/clubs.json):
  data/built/{slug}/matches.json   MatchRow[]
  data/built/{slug}/seasons.json   SeasonRow[] + squad + All-Competitions row
  data/built/{slug}/keepers.json   KeepersData
  data/built/{slug}/players.json   PlayersData
  data/built/{slug}/attack.json    AttackBySeason
  data/built/{slug}/squad.json     SquadData
  public/data/{slug}/matchlogs-{season}.json
League-wide:
  data/built/league.json           per-PL-season table rows
  data/built/index.json            club index
  data/built/managers.json         copy of data/managers.json if present
"""

import json
import re
import sys
import unicodedata
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from common import (  # noqa: E402
    BUILT, COMP_ORDER, DATA, PUBLIC, RAW, canon_comp, colmap, first_table,
    load_clubs, load_json, num, ordinal, parse_tables, score, strip_md,
    write_json,
)
from parse_capology import parse_season  # noqa: E402

HEADER = ["Date", "Time", "Comp", "Round", "Day", "Venue", "Result", "GF",
          "GA", "Opponent", "Poss", "Attendance", "Captain", "Formation",
          "Opp Formation", "Referee", "Match Report", "Notes"]


def warn(msg):
    print(f"  WARN {msg}", file=sys.stderr)


# ---------------------------------------------------------------- matches
def schedule_rows(md):
    """Parse the Scores & Fixtures markdown table by header name."""
    for _h, header, rows in parse_tables(md):
        if not header or header[0] != "Date":
            continue
        idx = {name: k for k, name in enumerate(header)}
        for r in rows:
            if len(r) < len(header):
                continue
            yield idx, r


def build_matches(club, league_xg):
    """MatchRow[] + per-season xg match stats."""
    matches = []
    xg_stats = {}  # season -> (pl_matches, matched, xgf, xga)
    uname = club.get("understatName")
    for season in club["seasons"]:
        p = RAW / "clubs" / club["slug"] / season / "schedule.json"
        if not p.exists():
            warn(f"{club['slug']} {season}: no schedule.json")
            continue
        md = load_json(p)["markdown"]
        udata = league_xg.get(season, [])
        n_xg = n_pl = 0
        for idx, r in schedule_rows(md):
            def g(name):
                i = idx.get(name)
                return r[i] if i is not None and i < len(r) else ""
            date_ = strip_md(g("Date"))[:10]
            if not re.match(r"\d{4}-\d{2}-\d{2}", date_):
                continue
            comp = canon_comp(g("Comp"))
            gfv, gfp = score(g("GF"))
            gav, gap = score(g("GA"))
            row = {
                "season": season, "date": date_,
                "time": strip_md(g("Time")) or None,
                "competition": comp,
                "round": strip_md(g("Round")) or None,
                "venue": strip_md(g("Venue")) or None,
                "result": strip_md(g("Result")) or None,
                "gf": gfv, "ga": gav, "gfPens": gfp, "gaPens": gap,
                "opponent": strip_cc(strip_md(g("Opponent"))) or None,
                "reportUrl": (lambda m: m.group(1) if m else None)(
                    re.search(r"\((https?://[^)]+)\)", g("Match Report"))),
                "possession": num(g("Poss")),
                "attendance": num(g("Attendance")),
                "captain": strip_md(g("Captain")) or None,
                "formation": strip_md(g("Formation")) or None,
                "oppFormation": strip_md(g("Opp Formation")) or None,
                "referee": strip_md(g("Referee")) or None,
                "notes": strip_md(g("Notes")) or None,
                "xg": None, "xga": None,
            }
            if comp == "Premier League":
                n_pl += 1
                hit = xg_for_date(udata, uname, date_, None)
                if hit is None:
                    for dd in (-1, 1):
                        d2 = str(date(*map(int, date_.split("-"))) +
                                 timedelta(days=dd))
                        hit = xg_for_date(udata, uname, date_, d2)
                        if hit:
                            break
                if hit:
                    row["xg"], row["xga"] = hit
                    n_xg += 1
            matches.append(row)
        xg_stats[season] = (n_pl, n_xg)
        print(f"  {club['slug']} {season}: PL matches {n_pl}, "
              f"xg-matched {n_xg}")
    return matches, xg_stats


def xg_for_date(udata, uname, want_date, match_date):
    """Find understat row for this club on match_date (or want_date if
    match_date None) — actually tries any date when match_date None."""
    for m in udata:
        if not m.get("isResult"):
            continue
        dt = m["datetime"][:10]
        if match_date and dt != match_date:
            continue
        if not match_date and dt != want_date:
            continue
        if m["h"]["title"] == uname:
            return round(float(m["xG"]["h"]), 2), round(float(m["xG"]["a"]), 2)
        if m["a"]["title"] == uname:
            return round(float(m["xG"]["a"]), 2), round(float(m["xG"]["h"]), 2)
    return None


def load_league_xg(seasons_needed):
    out = {}
    for season in seasons_needed:
        p = RAW / "league" / season / "understat.json"
        if p.exists():
            out[season] = load_json(p).get("dates", [])
    return out


# ---------------------------------------------------------------- seasons
def league_table_row(club, season):
    """PL table row for this club from league table.json (match by squad id)."""
    p = RAW / "league" / season / "table.json"
    if not p.exists():
        return None, None
    d = load_json(p)
    fid = club["fbrefId"]
    squads = {s["id"]: s["name"] for s in d.get("squads", [])}
    disp = squads.get(fid)
    for _h, header, rows in parse_tables(d["markdown"]):
        if not header or header[0] != "Rk":
            continue
        idx = colmap(header)
        for r in rows:
            if len(r) < len(header) or f"/squads/{fid}/" not in r[idx["Squad"]]:
                continue
            return {"idx": idx, "row": r, "squad": disp}, disp
    return None, disp


def history_overlay(season):
    """man-utd only: history.json rows for non-PL comps."""
    p = RAW / "clubs" / "man-utd" / "history.json"
    if not p.exists():
        return {}
    sections = {
        "Domestic Leagues Results", "International Cup Results",
        "Domestic Cup Results", "International Super Cup Results",
        "Domestic Super Cup Results",
    }
    out = {}
    for heading, header, rows in parse_tables(load_json(p)["markdown"]):
        if heading not in sections or not header or header[0] != "Season":
            continue
        idx = colmap(header)
        for r in rows:
            if len(r) < 5 or strip_md(r[idx["Season"]]) != season:
                continue
            comp = canon_comp(r[idx["Comp"]])
            g = lambda n: strip_md(r[idx[n]]) if idx.get(n) is not None and idx[n] < len(r) else ""
            out[comp] = {"rank": g("LgRank") or None,
                         "attendance": num(r[idx["Attendance"]]) if idx.get("Attendance") is not None else None,
                         "topScorer": g("Top Team Scorer") or None,
                         "goalkeeper": g("Goalkeeper") or None,
                         "notes": g("Notes") or None}
    return out


def build_seasons(club, matches, xg_stats, mismatches):
    rows = []
    agg = {}
    for m in matches:
        if m["result"] not in ("W", "D", "L") or m["gf"] is None or m["ga"] is None:
            continue
        a = agg.setdefault((m["season"], m["competition"]),
                           dict(mp=0, w=0, d=0, l=0, gf=0, ga=0, cs=0))
        a["mp"] += 1
        a[m["result"].lower()] += 1
        a["gf"] += int(m["gf"])
        a["ga"] += int(m["ga"])
        a["cs"] += 1 if m["ga"] == 0 else 0
    hist = {s: history_overlay(s) for s in club["seasons"]} \
        if club["slug"] == "man-utd" else {}

    for season in club["seasons"]:
        comps = {c for (s, c) in agg if s == season}
        for comp in sorted(comps, key=lambda c: COMP_ORDER.index(c) if c in COMP_ORDER else 99):
            a = agg[(season, comp)]
            row = {"season": season, "competition": comp, "squad": None,
                   "rank": None, "mp": a["mp"], "w": a["w"], "d": a["d"],
                   "l": a["l"], "gf": a["gf"], "ga": a["ga"],
                   "gd": a["gf"] - a["ga"], "pts": 3 * a["w"] + a["d"],
                   "attendance": None, "topScorer": None, "goalkeeper": None,
                   "notes": None, "cs": a["cs"],
                   "ptsPerMp": round((3 * a["w"] + a["d"]) / a["mp"], 2) if a["mp"] else None,
                   "xg": None, "xga": None, "xgd": None, "sota": None}
            if comp == "Premier League":
                tr, disp = league_table_row(club, season)
                if tr:
                    idx, r = tr["idx"], tr["row"]
                    g = lambda n: strip_md(r[idx[n]]) if idx.get(n) is not None and idx[n] < len(r) else ""
                    row["squad"] = tr["squad"]
                    rk = g("Rk")
                    row["rank"] = ordinal(int(float(rk))) if rk else None
                    row["attendance"] = num(r[idx["Attendance"]]) if idx.get("Attendance") is not None else None
                    row["topScorer"] = g("Top Team Scorer") or None
                    row["goalkeeper"] = g("Goalkeeper") or None
                    row["notes"] = g("Notes") or None
                    tpts = num(r[idx["Pts"]]) if idx.get("Pts") is not None else None
                    if tpts is not None and int(tpts) != row["pts"]:
                        mismatches.append((season, comp, "pts", int(tpts), row["pts"]))
                    tmp = num(r[idx["MP"]]) if idx.get("MP") is not None else None
                    if tmp is not None and int(tmp) != row["mp"]:
                        mismatches.append((season, comp, "mp", int(tmp), row["mp"]))
                n_pl, n_xg = xg_stats.get(season, (0, 0))
                plm = [m for m in matches if m["season"] == season
                       and m["competition"] == "Premier League" and m["xg"] is not None]
                if plm:
                    xf = round(sum(m["xg"] for m in plm), 2)
                    xa = round(sum(m["xga"] for m in plm), 2)
                    row["xg"], row["xga"], row["xgd"] = xf, xa, round(xf - xa, 2)
            else:
                h = hist.get(season, {}).get(comp)
                if h:
                    row.update({k: v for k, v in h.items() if v is not None})
            rows.append(row)
        # All Competitions
        comp_rows = [r for r in rows if r["season"] == season]
        if comp_rows:
            mp = sum(r["mp"] for r in comp_rows)
            w = sum(r["w"] for r in comp_rows)
            d = sum(r["d"] for r in comp_rows)
            l = sum(r["l"] for r in comp_rows)
            gf = sum(r["gf"] for r in comp_rows)
            ga = sum(r["ga"] for r in comp_rows)
            pts = 3 * w + d
            csvv = [r["cs"] for r in comp_rows if r["cs"] is not None]
            rows.append({"season": season, "competition": "All Competitions",
                         "squad": None, "rank": None, "mp": mp, "w": w, "d": d,
                         "l": l, "gf": gf, "ga": ga, "gd": gf - ga, "pts": pts,
                         "attendance": None, "topScorer": None,
                         "goalkeeper": None, "notes": None,
                         "cs": sum(csvv) if csvv else None,
                         "ptsPerMp": round(pts / mp, 2) if mp else None,
                         "xg": None, "xga": None, "xgd": None, "sota": None})
    rows.sort(key=lambda r: (r["season"], COMP_ORDER.index(r["competition"])
                             if r["competition"] in COMP_ORDER else 99))
    return rows


# ---------------------------------------------------------------- keepers
def keeper_matchlog(club):
    out = []
    for season in club["seasons"]:
        p = RAW / "clubs" / club["slug"] / season / "keeper.json"
        if not p.exists():
            warn(f"{club['slug']} {season}: no keeper.json")
            continue
        for t in load_json(p).get("tables", []):
            if not t.get("label", "").startswith("For"):
                continue
            cols = t["columns"]
            idx = colmap(cols)
            ga_i = [i for i, c in enumerate(cols) if c == "GA"]
            for r in t["rows"]:
                if len(r) < len(cols):
                    continue
                gfv, gfp = score(r[idx["GF"]])
                gav, gap = score(r[ga_i[0]]) if ga_i else (None, None)
                out.append({
                    "season": season,
                    "date": strip_md(r[idx["Date"]]) or None,
                    "time": strip_md(r[idx.get("Time", 1)]) or None,
                    "comp": canon_comp(r[idx["Comp"]]),
                    "round": strip_md(r[idx.get("Round", 3)]) or None,
                    "venue": strip_md(r[idx.get("Venue", 5)]) or None,
                    "result": strip_md(r[idx["Result"]]) or None,
                    "gf": gfv, "ga": gav, "gfPens": gfp, "gaPens": gap,
                    "opponent": strip_cc(strip_md(r[idx["Opponent"]])) or None,
                    "sota": num(r[idx["SoTA"]]),
                    "saves": num(r[idx["Saves"]]),
                    "savePct": num(r[idx["Save%"]]),
                    "cs": num(r[idx["CS"]]),
                    "pkatt": num(r[idx["PKatt"]]),
                    "pka": num(r[idx["PKA"]]),
                    "pksv": num(r[idx["PKsv"]]),
                    "pkm": num(r[idx["PKm"]]),
                })
    return out


def keeper_squad(club):
    out = []
    for season in club["seasons"]:
        p = RAW / "clubs" / club["slug"] / season / "keeper-squad.json"
        if not p.exists():
            warn(f"{club['slug']} {season}: no keeper-squad.json")
            continue
        for _h, header, rows in parse_tables(load_json(p)["markdown"]):
            if not header or header[0] != "Player":
                continue
            idx = colmap(header)
            sav = [i for i, c in enumerate(header) if c == "Save%"]
            for r in rows:
                if len(r) < 23:
                    continue
                g = lambda n: r[idx[n]] if idx.get(n) is not None and idx[n] < len(r) else ""
                out.append({
                    "season": season,
                    "player": strip_md(g("Player")) or None,
                    "nation": strip_md(g("Nation")) or None,
                    "age": num(g("Age")), "mp": num(g("MP")),
                    "starts": num(g("Starts")), "min": num(g("Min")),
                    "nineties": num(g("90s")), "ga": num(g("GA")),
                    "ga90": num(g("GA90")), "sota": num(g("SoTA")),
                    "saves": num(g("Saves")), "savePct": num(g("Save%")),
                    "w": num(g("W")), "d": num(g("D")), "l": num(g("L")),
                    "cs": num(g("CS")), "csPct": num(g("CS%")),
                    "pkatt": num(g("PKatt")), "pka": num(g("PKA")),
                    "pksv": num(g("PKsv")), "pkm": num(g("PKm")),
                    "pkSavePct": num(r[sav[-1]]) if sav else None,
                })
    return out


def psxg_rows(club):
    """League keeperadv filtered by this club's fbref display name."""
    psxg, per_gk = [], []
    for season in club["seasons"]:
        tp = RAW / "league" / season / "table.json"
        kp = RAW / "league" / season / "keeperadv.json"
        if not kp.exists():
            warn(f"league {season}: no keeperadv.json")
            continue
        disp = None
        if tp.exists():
            for s in load_json(tp).get("squads", []):
                if s["id"] == club["fbrefId"]:
                    disp = s["name"]
        if not disp:
            warn(f"{club['slug']} {season}: no fbref display name")
            continue
        d = load_json(kp)
        for _h, header, rows in parse_tables(d["markdown_squads"]):
            if not header or header[0] != "Squad":
                continue
            for r in rows:
                if len(r) < len(header) or strip_md(r[0]) != disp:
                    continue
                psxg.append({"season": season, "nineties": num(r[2]),
                             "ga": num(r[3]), "pka": num(r[4]),
                             "psxg": num(r[8]), "psxgPerSot": num(r[9]),
                             "psxgPlusMinus": num(r[10]), "psxgPer90": num(r[11]),
                             "opa": num(r[25]), "opaPer90": num(r[26]),
                             "avgDistance": num(r[27])})
        for _h, header, rows in parse_tables(d["markdown_players"]):
            if not header or header[0] != "Rk":
                continue
            for r in rows:
                if len(r) < len(header) or strip_md(r[4]) != disp:
                    continue
                per_gk.append({"season": season,
                               "player": strip_md(r[1]) or None,
                               "nation": strip_md(r[2]) or None,
                               "age": num(r[5]), "nineties": num(r[7]),
                               "ga": num(r[8]), "psxg": num(r[13]),
                               "psxgPerSot": num(r[14]),
                               "psxgPlusMinus": num(r[15])})
    return psxg, per_gk


def build_keepers(club):
    data = {"matchLog": keeper_matchlog(club),
            "perGkSeason": keeper_squad(club)}
    psxg, per_gk = psxg_rows(club)
    if club["slug"] == "man-utd":
        legacy_path = DATA / "man-utd-psxg-legacy.json"
        if legacy_path.exists():
            legacy = load_json(legacy_path)
            legacy_seasons = {s["season"]: s for s in legacy.get("seasons", [])}
            for row in psxg:
                seed = legacy_seasons.get(row["season"])
                if not seed:
                    continue
                row["psxg"] = seed["psxg"]
                row["ga"] = seed["ga"]
                row["pka"] = seed["pka"]
                row["psxgPlusMinus"] = round(
                    seed["psxg"] - (row["ga"] - (row["pka"] or 0)), 1)
                row["psxgSource"] = "legacy"
            for entry in legacy.get("perGk", []):
                per_gk.append(dict(entry))
    data["psxg"], data["psxgPerGk"] = psxg, per_gk
    return data


# ---------------------------------------------------------------- players
def _norm_name(name):
    return (unicodedata.normalize("NFKD", name)
            .encode("ascii", "ignore").decode().lower().strip())


def _is_player_name(name):
    return bool(name) and not re.search(r"\b(squad|total|opponent)\b", name, re.I)


def build_players(club):
    out = {"seasons": {}, "latest": ""}
    for season in club["seasons"]:
        p = RAW / "clubs" / club["slug"] / season / "players.json"
        if not p.exists():
            warn(f"{club['slug']} {season}: no players.json")
            continue
        raw = load_json(p)
        std_h, std_r = first_table(raw.get("markdown_standard", ""))
        shoot_h, shoot_r = first_table(raw.get("markdown_shooting", ""))
        time_h, time_r = first_table(raw.get("markdown_playingTime", ""))
        if not std_h or std_h[0] != "Player":
            warn(f"{club['slug']} {season}: no standard table")
            continue
        std_i, shoot_i, time_i = colmap(std_h), colmap(shoot_h), colmap(time_h)

        def cell(row, i):
            return row[i] if row is not None and i is not None and i < len(row) else ""

        def nint(row, i):
            v = num(cell(row, i))
            return None if v is None else int(v)

        shoot_by = {_norm_name(strip_md(r[0])): r for r in shoot_r
                    if len(r) >= len(shoot_h) and r[0].strip()}
        time_by = {_norm_name(strip_md(r[0])): r for r in time_r
                   if len(r) >= len(time_h) and r[0].strip()}
        players = []
        for r in std_r:
            if len(r) < len(std_h):
                continue
            name = strip_md(r[0])
            pos = strip_md(cell(r, std_i.get("Pos")))
            if not _is_player_name(name) or not pos:
                continue
            age = num(cell(r, std_i.get("Age")))
            shoot = shoot_by.get(_norm_name(name))
            tim = time_by.get(_norm_name(name))
            players.append({
                "player": name,
                "nation": strip_md(cell(r, std_i.get("Nation"))) or None,
                "pos": pos, "age": int(age) if age is not None else None,
                "mp": nint(r, std_i.get("MP")),
                "starts": nint(r, std_i.get("Starts")),
                "min": nint(r, std_i.get("Min")),
                "nineties": num(cell(r, std_i.get("90s"))),
                "gls": nint(r, std_i.get("Gls")),
                "ast": nint(r, std_i.get("Ast")),
                "gPlusA": nint(r, std_i.get("G+A")),
                "gMinusPk": nint(r, std_i.get("G-PK")),
                "pk": nint(r, std_i.get("PK")),
                "pkatt": nint(r, std_i.get("PKatt")),
                "crdY": nint(r, std_i.get("CrdY")),
                "crdR": nint(r, std_i.get("CrdR")),
                "sh": nint(shoot, shoot_i.get("Sh")),
                "sot": nint(shoot, shoot_i.get("SoT")),
                "sotPct": num(cell(shoot, shoot_i.get("SoT%"))),
                "gPerSh": num(cell(shoot, shoot_i.get("G/Sh"))),
                "gPerSot": num(cell(shoot, shoot_i.get("G/SoT"))),
                "minsPerStart": num(cell(tim, time_i.get("Mn/Start"))),
                "ppm": num(cell(tim, time_i.get("PPM"))),
            })
        out["seasons"][season] = {
            "players": players,
            "sourceURL": raw.get("metadata", {}).get("sourceURL")}
    if out["seasons"]:
        out["latest"] = sorted(out["seasons"])[-1]
    return out


# fbref prefixes European opponents with a flag alt-text like "es " / "az ".
# Strip a leading lowercase 2-3 letter code only when followed by an
# uppercase/non-ASCII letter ("es Atlético Madrid" -> "Atlético Madrid").
CC_PREFIX = re.compile(r"^([a-z]{2,3}) (?=[A-ZÀ-ɏ])")
STRIPPED_CC = set()


def strip_cc(name):
    if not name:
        return name
    m = CC_PREFIX.match(name)
    if m:
        STRIPPED_CC.add(m.group(1))
        return name[m.end():]
    return name


# ---------------------------------------------------------------- attack/matchlogs/squad
def build_matchlogs(club):
    seasons = {}
    for season in club["seasons"]:
        types = {}
        for typ in ("shooting", "keeper", "misc"):
            p = RAW / "clubs" / club["slug"] / season / f"{typ}.json"
            if not p.exists():
                warn(f"{club['slug']} {season}: no {typ}.json")
                continue
            sides = {}
            for t in load_json(p).get("tables", []):
                lab = t.get("label", "")
                side = "for" if lab.startswith("For") else \
                    "against" if lab.startswith("Against") else None
                if side:
                    cols, rows = t["columns"], t["rows"]
                    if "Opponent" in cols:
                        oi = cols.index("Opponent")
                        rows = [
                            [strip_cc(c) if i == oi else c
                             for i, c in enumerate(r)]
                            for r in rows
                        ]
                    sides[side] = {"columns": cols, "rows": rows}
            types[typ] = sides
        seasons[season] = types
        write_json(PUBLIC / club["slug"] / f"matchlogs-{season}.json", types)
    return seasons


def build_attack(matchlog_seasons):
    out = {}
    for season, types in matchlog_seasons.items():
        t = types.get("shooting", {}).get("for")
        if not t:
            continue
        ix = {}
        for i, c in enumerate(t["columns"]):
            ix.setdefault(c, i)
        mp = len(t["rows"])

        def col(name):
            i = ix.get(name)
            return [num(r[i]) if i is not None and i < len(r) else None
                    for r in t["rows"]]

        def s(vals):
            vals = [v for v in vals if v is not None]
            return round(sum(vals), 2) if vals else None

        sh = col("Sh")
        cov = sum(1 for v in sh if v is not None) / mp if mp else 0
        out[season] = {"mp": mp, "gls": s(col("Gls")), "sh": s(sh),
                       "sot": s(col("SoT")), "pk": s(col("PK")),
                       "pkatt": s(col("PKatt")), "shCoverage": round(cov, 2)}
    return out


def _to_squad_player(p):
    pos = {"K": "G"}.get(p.get("pos") or "", p.get("pos"))
    detail = p.get("posDetail")
    sub = detail if detail and len(detail) <= 3 else None
    exp = p.get("expires")
    m = re.search(r"((?:19|20)\d{2})", exp or "")
    status = p.get("status")
    return {"name": p.get("name"), "pos": pos, "subPos": sub,
            "age": p.get("age"), "status": status,
            "country": p.get("country"), "weeklyGross": p.get("weeklyGross"),
            "yearlyGross": p.get("yearlyGross"), "bonusYearly": p.get("bonusYearly"),
            "weeklyNet": None, "yearlyNet": None, "signed": p.get("signed"),
            "expires": m.group(1) if m else None,
            "grossRemaining": p.get("grossRemaining"),
            "onLoan": status == "Loan"}


def build_squad(club):
    if club["slug"] == "man-utd":
        src = DATA / "man-utd-squad.json"
        return load_json(src) if src.exists() else \
            {"updated": None, "players": [], "seasons": {}}
    base = f"https://www.capology.com/club/{club.get('capologySlug')}/salaries"
    seasons = {}
    for season in club["seasons"]:
        p = RAW / "clubs" / club["slug"] / season / "capology.json"
        if not p.exists():
            continue
        raw = load_json(p)
        if "json" in raw and "markdown" not in raw:
            j = raw["json"]
            players = [_to_squad_player(x) for x in j.get("players", [])]
            seasons[season] = {"summary": {
                "grossWeekly": j.get("grossWeekly"),
                "grossYearly": j.get("grossYearly"),
                "grossTotalYearly": j.get("grossTotalYearly"),
                "avgTotalYearly": None, "players": len(players),
                "withSalary": len(players)}, "players": players}
            continue
        parsed = parse_season(raw.get("markdown", ""))
        seasons[season] = {"summary": parsed["summary"],
                           "players": [_to_squad_player(x)
                                       for x in parsed["players"]]}
    if not seasons:
        return {"updated": None, "players": [], "seasons": {}}
    latest = sorted(seasons)[-1]
    return {"updated": latest, "source": base + "/",
            "players": seasons[latest]["players"], "seasons": seasons}


# ---------------------------------------------------------------- sota for PL row
def pl_sota(club, season):
    p = RAW / "clubs" / club["slug"] / season / "keeper.json"
    if not p.exists():
        return None
    tot = 0.0
    n = 0
    for t in load_json(p).get("tables", []):
        if not t.get("label", "").startswith("For"):
            continue
        idx = colmap(t["columns"])
        for r in t["rows"]:
            if len(r) < len(t["columns"]):
                continue
            if canon_comp(r[idx["Comp"]]) != "Premier League":
                continue
            v = num(r[idx["SoTA"]])
            if v is not None:
                tot += v
                n += 1
    return tot if n else None


# ---------------------------------------------------------------- league.json
def league_rows(all_club_matches):
    """season -> sorted PL table per club."""
    out = {}
    for slug, (club, matches) in all_club_matches.items():
        for season in club["seasons"]:
            pl = [m for m in matches if m["season"] == season
                  and m["competition"] == "Premier League"
                  and m["result"] in ("W", "D", "L")]
            if not pl:
                continue
            w = sum(1 for m in pl if m["result"] == "W")
            d = sum(1 for m in pl if m["result"] == "D")
            l = sum(1 for m in pl if m["result"] == "L")
            gf = sum(m["gf"] for m in pl)
            ga = sum(m["ga"] for m in pl)
            xg = [m["xg"] for m in pl if m["xg"] is not None]
            xga = [m["xga"] for m in pl if m["xga"] is not None]
            cs = sum(1 for m in pl if m["ga"] == 0)
            out.setdefault(season, {})[slug] = {
                "slug": slug, "name": club["name"], "color": club["color"],
                "mp": len(pl), "w": w, "d": d, "l": l, "gf": gf, "ga": ga,
                "gd": gf - ga, "pts": 3 * w + d,
                "xg": round(sum(xg), 2) if xg else None,
                "xga": round(sum(xga), 2) if xga else None,
                "xgd": round(sum(xg) - sum(xga), 2) if xg and xga else None,
                "cs": cs, "rank": None}
    # rank from league table.json where available; in-progress season uses
    # matchlog aggregates (table.json may be stale relative to schedules)
    in_prog = max((s for s, cd in out.items()
                   if any(r["mp"] < 38 for r in cd.values())), default=None)
    for season, clubs_d in out.items():
        tp = RAW / "league" / season / "table.json"
        order = []
        if season == in_prog:
            order = sorted(clubs_d, key=lambda s: (
                -clubs_d[s]["pts"], -clubs_d[s]["gd"],
                -clubs_d[s]["gf"], clubs_d[s]["name"]))
        elif tp.exists():
            d = load_json(tp)
            fid2slug = {c["fbrefId"]: c["slug"] for c in CLUBS.values()}
            for _h, header, rows in parse_tables(d["markdown"]):
                if not header or header[0] != "Rk":
                    continue
                idx = colmap(header)
                if idx.get("Squad") is None:
                    continue
                for r in rows:
                    if len(r) <= idx["Squad"]:
                        continue
                    m = re.search(r"/squads/([0-9a-f]+)/", r[idx["Squad"]])
                    if (m and fid2slug.get(m.group(1)) in clubs_d
                            and fid2slug[m.group(1)] not in order):
                        order.append(fid2slug[m.group(1)])
        for rank, slug in enumerate(order, 1):
            clubs_d[slug]["rank"] = rank
        rest = sorted((s for s in clubs_d if clubs_d[s]["rank"] is None),
                      key=lambda s: (-clubs_d[s]["pts"], -clubs_d[s]["gd"]))
        for rank, slug in enumerate(rest, len(order) + 1):
            clubs_d[slug]["rank"] = rank
        out[season] = sorted(clubs_d.values(), key=lambda r: r["rank"])
    return out


# ---------------------------------------------------------------- brand colors
LIGHT_SURFACE = "#ffffff"   # globals.css light --surface
DARK_SURFACE = "#181314"    # globals.css dark --surface


def _hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def _rgb2hex(rgb):
    return "#{:02x}{:02x}{:02x}".format(
        *[max(0, min(255, round(c * 255))) for c in rgb])


def _lum(rgb):
    def f(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = rgb
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def _contrast(a, b):
    la, lb = _lum(a), _lum(b)
    lo, hi = min(la, lb), max(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def _blend(c1, c2, t):
    return tuple(a + (b - a) * t for a, b in zip(c1, c2))


def brand_colors(color):
    """brandLight: darken until >=3:1 vs light surface.
    brandDark: lighten until >=3:1 vs dark surface."""
    base = _hex2rgb(color)
    light_s, dark_s = _hex2rgb(LIGHT_SURFACE), _hex2rgb(DARK_SURFACE)
    bl, bd = base, base
    if _contrast(bl, light_s) < 3.0:
        for i in range(1, 21):
            bl = _blend(base, (0, 0, 0), i / 20)
            if _contrast(bl, light_s) >= 3.0:
                break
    if _contrast(bd, dark_s) < 3.0:
        for i in range(1, 21):
            bd = _blend(base, (1, 1, 1), i / 20)
            if _contrast(bd, dark_s) >= 3.0:
                break
    return _rgb2hex(bl), _rgb2hex(bd)


def short_name(club):
    """fbref display name from the club's latest league table season."""
    for season in reversed(club["seasons"]):
        tp = RAW / "league" / season / "table.json"
        if not tp.exists():
            continue
        for s in load_json(tp).get("squads", []):
            if s["id"] == club["fbrefId"]:
                return s["name"]
    return club["name"]


# ---------------------------------------------------------------- main
CLUBS = {}


def _opponent_map(clubs):
    """display name -> slug: club names, understatNames, fbref squad names."""
    m = {}
    for c in clubs.values():
        m[c["name"]] = c["slug"]
        if c.get("understatName"):
            m[c["understatName"]] = c["slug"]
    for season_dir in (RAW / "league").iterdir():
        tp = season_dir / "table.json"
        if not tp.exists():
            continue
        fid2slug = {c["fbrefId"]: c["slug"] for c in clubs.values()}
        for s in load_json(tp).get("squads", []):
            if s["id"] in fid2slug:
                m[s["name"]] = fid2slug[s["id"]]
    return m


def _table_notes_zones(season, clubs):
    """zones from league table.json Notes column (completed seasons)."""
    tp = RAW / "league" / season / "table.json"
    zones = {}
    if not tp.exists():
        return zones
    fid2slug = {c["fbrefId"]: c["slug"] for c in clubs.values()}
    md = load_json(tp)["markdown"]
    for line in md.split("\n"):
        if "/squads/" not in line or "|" not in line:
            continue
        sm = re.search(r"/squads/([0-9a-f]+)/", line)
        slug = fid2slug.get(sm.group(1)) if sm else None
        if not slug or slug in zones:
            continue
        tail = line.rsplit("|", 2)[-2] if line.count("|") > 2 else line
        if "Relegat" in tail:
            zones[slug] = "rel"
        elif "Champions League" in tail:
            zones[slug] = "cl"
        elif "Europa League" in tail:
            zones[slug] = "el"
        elif "Conference League" in tail:
            zones[slug] = "ecl"
    return zones


def _understat_season(season, clubs):
    """per-club {mp,xg,xga,xpts,ptsSide} from league understat.json."""
    up = RAW / "league" / season / "understat.json"
    out = {}
    if not up.exists():
        return out
    name2slug = {}
    for c in clubs.values():
        if c.get("understatName"):
            name2slug[c["understatName"]] = c["slug"]
        name2slug[c["name"]] = c["slug"]
    # fbref-ish names understat uses ("Manchester United", "Tottenham")
    for m in load_json(up)["dates"]:
        if not m.get("isResult"):
            continue
        for side, mine, opp, fkey in (
                ("h", "h", "a", "w"), ("a", "a", "h", "l")):
            slug = name2slug.get(m[side]["title"])
            if not slug:
                continue
            e = out.setdefault(slug, {"mp": 0, "xg": 0.0, "xga": 0.0,
                                      "xpts": 0.0})
            e["mp"] += 1
            e["xg"] += float(m["xG"][mine])
            e["xga"] += float(m["xG"][opp])
            f = m.get("forecast") or {}
            e["xpts"] += 3 * float(f.get(fkey, 0)) + float(f.get("d", 0))
    return out


def _rounds(season, clubs, name2slug):
    """latest completed MW + next MW from league fixtures.json markdown."""
    fp = RAW / "league" / season / "fixtures.json"
    if not fp.exists():
        return {}
    weeks = {}
    fid2slug = {c["fbrefId"]: c["slug"] for c in clubs.values()}
    for _h, header, rows in parse_tables(load_json(fp)["markdown"]):
        if not header or header[0] != "Wk":
            continue
        idx = colmap(header)
        for r in rows:
            wk = r[idx.get("Wk", 0)] if len(r) > idx.get("Wk", 0) else ""
            if not wk or not wk.strip().isdigit():
                continue
            def squad_slug(cell):
                m = re.search(r"/squads/([0-9a-f]+)/", cell or "")
                if m:
                    return fid2slug.get(m.group(1))
                txt = re.sub(r"[\[\]\(\)\*]", "", cell or "")
                return name2slug.get(txt.strip())
            home = squad_slug(r[idx["Home"]]) if "Home" in idx else None
            away = squad_slug(r[idx["Away"]]) if "Away" in idx else None
            score = strip_md(r[idx["Score"]]) if "Score" in idx else ""
            date = strip_md(r[idx["Date"]]) if "Date" in idx else ""
            weeks.setdefault(wk.strip(), []).append({
                "date": date,
                "time": strip_md(r[idx["Time"]]) if "Time" in idx else "",
                "home": home, "away": away,
                "score": score if score and score != "—" else None})
    if not weeks:
        return {}
    played_wk = [int(w) for w, ms in weeks.items()
                 if all(m["score"] for m in ms)]
    last = max(played_wk) if played_wk else None
    nxt = min((int(w) for w in weeks if last is None or int(w) > last),
              default=None)
    return {
        "last": {"wk": last, "matches": weeks[str(last)]} if last else None,
        "next": {"wk": nxt, "matches": weeks[str(nxt)]} if nxt else None}


def league_season_files(all_club_matches, league, clubs):
    """public/data/league/{season}.json — home page summary payload."""
    name2slug = _opponent_map(clubs)
    for season, rows in league.items():
        clubs_s = {r["slug"] for r in rows}
        views = {"all": [dict(r) for r in rows], "home": [], "away": [],
                 "last5": [], "xg": []}
        form, nxt = {}, {}
        for slug in clubs_s:
            pl = [m for m in all_club_matches[slug][1]
                  if m["season"] == season
                  and m["competition"] == "Premier League"]
            played = [m for m in pl if m["result"] in ("W", "D", "L")]
            unplayed = sorted(
                (m for m in pl if m["result"] not in ("W", "D", "L")),
                key=lambda m: m["date"])

            def agg(ms):
                w = sum(1 for m in ms if m["result"] == "W")
                d = sum(1 for m in ms if m["result"] == "D")
                l = sum(1 for m in ms if m["result"] == "L")
                gf = sum(m["gf"] for m in ms)
                ga = sum(m["ga"] for m in ms)
                return {"slug": slug, "rank": None, "mp": len(ms),
                        "w": w, "d": d, "l": l, "gf": gf, "ga": ga,
                        "gd": gf - ga, "pts": 3 * w + d}
            views["home"].append(
                agg([m for m in played if m["venue"] == "Home"]))
            views["away"].append(
                agg([m for m in played if m["venue"] == "Away"]))
            last5 = sorted(played, key=lambda m: m["date"])[-5:]
            views["last5"].append(agg(last5))
            form[slug] = [{
                "result": m["result"], "gf": m["gf"], "ga": m["ga"],
                "opponent": name2slug.get(m["opponent"], m["opponent"]),
                "venue": "H" if m["venue"] == "Home" else "A",
                "date": m["date"]} for m in last5]
            if unplayed:
                m = unplayed[0]
                nxt[slug] = {
                    "opponent": name2slug.get(m["opponent"], m["opponent"]),
                    "venue": "H" if m["venue"] == "Home" else "A",
                    "date": m["date"]}
        key = lambda v: (-v["pts"], -v["gd"], -v["gf"], v["slug"])
        for view in ("home", "away", "last5"):
            views[view].sort(key=key)
            for i, v in enumerate(views[view], 1):
                v["rank"] = i
        # xg view
        xg_d = _understat_season(season, clubs)
        pts_of = {r["slug"]: r["pts"] for r in rows}
        for slug, e in xg_d.items():
            if slug not in clubs_s:
                continue
            xpts = round(e["xpts"], 2)
            views["xg"].append({
                "slug": slug, "rank": None, "mp": e["mp"],
                "xg": round(e["xg"], 2), "xga": round(e["xga"], 2),
                "xgd": round(e["xg"] - e["xga"], 2), "xpts": xpts,
                "pts": pts_of.get(slug),
                "ptsMinusXpts": (round(pts_of[slug] - xpts, 2)
                                 if slug in pts_of else None)})
        views["xg"].sort(key=lambda v: (-v["xpts"], v["slug"]))
        for i, v in enumerate(views["xg"], 1):
            v["rank"] = i
        # zones
        completed = all(r["mp"] >= 38 for r in rows)
        zones_projected = not completed
        if completed:
            zones = {s: _table_notes_zones(season, clubs).get(s)
                     for s in clubs_s}
        else:
            zones = {r["slug"]: ("cl" if r["rank"] <= 4 else
                                 "el" if r["rank"] == 5 else
                                 "rel" if r["rank"] >= 18 else None)
                     for r in rows}
        # summary
        def best(fn, vals=rows):
            r = max(vals, key=fn)
            return {"slug": r["slug"], "value": fn(r)}
        xg_of = {v["slug"]: v for v in views["xg"]}
        over = max(rows,
                   key=lambda r: r["gf"] - (xg_of.get(r["slug"], {})
                                            .get("xg") or r["gf"]))
        under = min(rows,
                    key=lambda r: r["gf"] - (xg_of.get(r["slug"], {})
                                             .get("xg") or r["gf"]))
        top_scorer = None
        for slug in clubs_s:
            pj = BUILT / slug / "players.json"
            if not pj.exists():
                continue
            ps = (load_json(pj).get("seasons", {})
                  .get(season, {}).get("players", []))
            for p in ps:
                g = p.get("gls")
                if (g is not None and (top_scorer is None
                                       or g > top_scorer["goals"])):
                    top_scorer = {"slug": slug, "player": p.get("player"),
                                  "goals": g}
        summary = {
            "leader": best(lambda r: r["pts"]),
            "bestAttack": best(lambda r: r["gf"]),
            "bestDefence": min(rows, key=lambda r: r["ga"]) and {
                "slug": min(rows, key=lambda r: r["ga"])["slug"],
                "value": min(rows, key=lambda r: r["ga"])["ga"]},
            "mostXg": ({"slug": views["xg"][0]["slug"],
                        "value": views["xg"][0]["xg"]}
                       if views["xg"] else None),
            "overPerformer": {"slug": over["slug"],
                              "value": round(
                                  over["gf"] - (xg_of.get(over["slug"], {})
                                                .get("xg") or over["gf"]), 2)},
            "underPerformer": {"slug": under["slug"],
                               "value": round(
                                   under["gf"] - (xg_of.get(under["slug"], {})
                                                  .get("xg") or under["gf"]),
                                   2)},
            "topScorer": top_scorer}
        write_json(PUBLIC / "league" / f"{season}.json", {
            "season": season, "views": views, "form": form, "next": nxt,
            "zones": zones, "zonesProjected": zones_projected,
            "summary": summary,
            "rounds": _rounds(season, clubs, name2slug)})


def keepers_by_season(keepers):
    """Split KeepersData into per-season payloads for lazy loading."""
    seasons = sorted({r["season"] for r in keepers.get("matchLog", [])})
    out = {}
    for s in seasons:
        out[s] = {
            "matchLog": [r for r in keepers["matchLog"] if r["season"] == s],
            "perGkSeason": [r for r in keepers.get("perGkSeason", [])
                            if r["season"] == s],
            "psxg": [r for r in keepers.get("psxg", []) if r["season"] == s],
            "psxgPerGk": [r for r in keepers.get("psxgPerGk", [])
                          if r["season"] == s],
        }
    return out


def build_club(club, league_xg):
    slug = club["slug"]
    print(f"== {slug} ({len(club['seasons'])} seasons)")
    matches, xg_stats = build_matches(club, league_xg)
    mismatches = []
    seasons = build_seasons(club, matches, xg_stats, mismatches)
    for r in seasons:
        if r["competition"] == "Premier League":
            r["sota"] = pl_sota(club, r["season"])
    keepers = build_keepers(club)
    players = build_players(club)
    ml_seasons = build_matchlogs(club)
    attack = build_attack(ml_seasons)
    squad = build_squad(club)
    out = BUILT / slug
    write_json(out / "matches.json", matches)
    write_json(out / "seasons.json", seasons)
    write_json(out / "keepers.json", keepers)
    write_json(out / "players.json", players)
    write_json(out / "attack.json", attack)
    write_json(out / "squad.json", squad)
    # per-season public files for lazy loading (squad/keepers/players)
    for s, rows in keepers_by_season(keepers).items():
        write_json(PUBLIC / slug / f"keepers-{s}.json", rows)
    for s, ss in (squad.get("seasons") or {}).items():
        write_json(PUBLIC / slug / f"squad-{s}.json", ss)
    for s, ps in (players.get("seasons") or {}).items():
        write_json(PUBLIC / slug / f"players-{s}.json", ps)
    if mismatches:
        print("  matchlog-vs-table mismatches:", *mismatches, sep="\n   ")
    return matches


def main():
    global CLUBS
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--club")
    args = ap.parse_args()
    CLUBS = load_clubs()
    targets = [CLUBS[args.club]] if args.club else list(CLUBS.values())
    needed = {s for c in targets for s in c["seasons"]}
    league_xg = load_league_xg(needed)
    all_matches = {}
    for club in targets:
        all_matches[club["slug"]] = (club, build_club(club, league_xg))
    # league.json across all clubs that have built matches
    lm = {}
    for slug, c in CLUBS.items():
        if slug in all_matches:
            lm[slug] = all_matches[slug]
        elif (BUILT / slug / "matches.json").exists():
            lm[slug] = (c, load_json(BUILT / slug / "matches.json"))
    league = league_rows(lm)
    write_json(BUILT / "league.json", {"seasons": league})
    league_season_files(lm, league, CLUBS)
    # in-progress season: sync each club's seasons.json PL rank with the
    # aggregate-derived league rank (table.json may be stale)
    in_prog = max((s for s, rows in league.items()
                   if any(r["mp"] < 38 for r in rows)), default=None)
    if in_prog:
        rank_of = {r["slug"]: r["rank"] for r in league[in_prog]}
        for slug, rk in rank_of.items():
            sp = BUILT / slug / "seasons.json"
            if not sp.exists():
                continue
            srows = load_json(sp)
            changed = False
            for r in srows:
                if (r["season"] == in_prog
                        and r["competition"] == "Premier League"):
                    r["rank"] = ordinal(rk)
                    changed = True
            if changed:
                write_json(sp, srows)
    index = []
    for slug, c in CLUBS.items():
        sp = BUILT / slug / "seasons.json"
        built = sorted({r["season"] for r in load_json(sp)}) if sp.exists() else []
        if built:
            bl, bd = brand_colors(c["color"])
            index.append({"slug": slug, "name": c["name"],
                          "color": c["color"], "seasons": built,
                          "latest": built[-1],
                          "shortName": short_name(c),
                          "nameTh": c.get("nameTh"),
                          "logo": f"/logos/{slug}.png",
                          "brandLight": bl, "brandDark": bd})
    write_json(BUILT / "index.json", index, compact=False)
    mgr = DATA / "managers.json"
    if mgr.exists():
        write_json(BUILT / "managers.json", load_json(mgr), compact=False)
    print(f"done: {len(index)} clubs in index")
    if STRIPPED_CC:
        print(f"opponent cc-prefixes stripped: {sorted(STRIPPED_CC)}")


if __name__ == "__main__":
    main()
