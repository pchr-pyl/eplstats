"""Parse fbref matchlog markdown dumps into data/man-utd-matches.json.

Match-level rows: date, comp, round, venue, result, gf/ga, opponent,
possession, attendance, captain, formations, referee, notes. xG/xGA are
merged from understat-YYYY.json for Premier League matches only (fbref
matchlogs have no xG columns).
"""

import json
import re
import unicodedata
from pathlib import Path

RAW = Path(__file__).resolve().parent.parent / "data" / "raw"
OUT = Path(__file__).resolve().parent.parent / "data" / "man-utd-matches.json"

SEASONS = sorted(
    p.stem.replace("matchlog-", "")
    for p in RAW.glob("matchlog-????-????.json")
    if re.fullmatch(r"matchlog-\d{4}-\d{4}", p.stem)
)

COMP_MAP = {
    "Premier League": "Premier League",
    "FA Cup": "FA Cup",
    "League Cup": "EFL Cup",
    "EFL Cup": "EFL Cup",
    "Champions Lg": "Champions League",
    "Champions League": "Champions League",
    "Europa Lg": "Europa League",
    "Europa League": "Europa League",
    "UEFA Cup": "Europa League",
    "Conference Lg": "Conference League",
    "Conference League": "Conference League",
    "FA Community Shield": "Community Shield",
    "Community Shield": "Community Shield",
    "Super Cup": "UEFA Super Cup",
    "UEFA Super Cup": "UEFA Super Cup",
    "Club World Cup": "Club World Cup",
    "FIFA Club World Cup": "Club World Cup",
    "Int Champions Cup": "International Champions Cup",
    "International Champions Cup": "International Champions Cup",
    "Friendly": "Friendly",
}

ROW_RE = re.compile(
    r"^\|\s*\[?(\d{4}-\d{2}-\d{2})\]?(?:\([^)]*\))?\s*\|"  # date cell
    r"\s*([^|]*)\|"      # time
    r"\s*([^|]*)\|"      # comp
    r"\s*([^|]*)\|"      # round
    r"\s*([^|]*)\|"      # day
    r"\s*([^|]*)\|"      # venue
    r"\s*([^|]*)\|"      # result
    r"\s*([^|]*)\|"      # gf
    r"\s*([^|]*)\|"      # ga
    r"\s*([^|]*)\|"      # opponent
    r"\s*([^|]*)\|"      # poss
    r"\s*([^|]*)\|"      # attendance
    r"\s*([^|]*)\|"      # captain
    r"\s*([^|]*)\|"      # formation
    r"\s*([^|]*)\|"      # opp formation
    r"\s*([^|]*)\|"      # referee
    r"\s*([^|]*)\|"      # match report
    r"\s*([^|]*)\|",     # notes
    re.M,
)


def strip_md(text: str) -> str:
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)
    return text.replace("\\-", "-").replace("\\", "").strip()


def num(text: str):
    text = strip_md(text).replace(",", "")
    m = re.match(r"-?\d+(?:\.\d+)?", text)
    return float(m.group(0)) if m else None


def score(text: str):
    """'1 (6)' -> (1, 6); '3' -> (3, None)."""
    text = strip_md(text)
    m = re.match(r"(\d+)(?:\s*\((\d+)\))?", text)
    if not m:
        return None, None
    return int(m.group(1)), int(m.group(2)) if m.group(2) else None


def load_understat():
    """date -> {xg, xga} from Man Utd's perspective."""
    out = {}
    for f in RAW.glob("understat-*.json"):
        d = json.load(open(f, encoding="utf-8"))
        for m in d.get("dates", []):
            if not m.get("isResult"):
                continue
            date = m["datetime"][:10]
            home = m["side"] == "h"
            out[date] = {
                "xg": round(float(m["xG"]["h" if home else "a"]), 2),
                "xga": round(float(m["xG"]["a" if home else "h"]), 2),
            }
    return out


def main():
    xg_by_date = load_understat()
    matches = []
    for season in SEASONS:
        f = RAW / f"matchlog-{season}.json"
        if not f.exists():
            print(f"skip {season} (no file)")
            continue
        md = json.load(open(f, encoding="utf-8"))["markdown"]
        n = 0
        for m in ROW_RE.finditer(md):
            (date, time, comp, rnd, day, venue, result, gf, ga, opp,
             poss, att, captain, form, oppform, ref, _report, notes) = m.groups()
            comp = COMP_MAP.get(strip_md(comp), strip_md(comp))
            gfv, gfp = score(gf)
            gav, gap = score(ga)
            row = {
                "season": season,
                "date": date,
                "time": strip_md(time) or None,
                "competition": comp,
                "round": strip_md(rnd) or None,
                "venue": strip_md(venue) or None,
                "result": strip_md(result) or None,
                "gf": gfv,
                "ga": gav,
                "gfPens": gfp,
                "gaPens": gap,
                "opponent": strip_md(opp) or None,
                "possession": num(poss),
                "attendance": num(att),
                "captain": strip_md(captain) or None,
                "formation": strip_md(form) or None,
                "oppFormation": strip_md(oppform) or None,
                "referee": strip_md(ref) or None,
                "notes": strip_md(notes) or None,
                "xg": None,
                "xga": None,
            }
            if comp == "Premier League" and date in xg_by_date:
                row["xg"] = xg_by_date[date]["xg"]
                row["xga"] = xg_by_date[date]["xga"]
            matches.append(row)
            n += 1
        print(f"{season}: {n} matches")

    OUT.write_text(json.dumps(matches, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {len(matches)} matches -> {OUT}")


if __name__ == "__main__":
    main()
