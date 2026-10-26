"""Validate public/data/match/{id}.json consistency.

Checks per file:
  - events' goal count == scorebox score (excluding shootout)
  - sum of player Gls + opponent own-goals == score
  - understat goals == score (when understat joined)
  - possession == matches.json possession for both clubs

Usage: python -X utf8 scripts/build/check_matches.py
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PUB = ROOT / "public" / "data" / "match"


def num(v):
    m = re.search(r"-?\d+(?:\.\d+)?", str(v or ""))
    return float(m.group(0)) if m else None


def main():
    files = sorted(PUB.glob("*.json"))
    if not files:
        print("no match files")
        return
    bad = []
    stats = {"files": 0, "goal_mismatch": 0, "gls_mismatch": 0,
             "xg_mismatch": 0, "poss_mismatch": 0}
    built = {}
    for f in (ROOT / "data" / "built").glob("*/matches.json"):
        slug = f.parent.name
        for m in json.loads(f.read_text(encoding="utf-8")):
            if m.get("matchId"):
                built[m["matchId"]] = (slug, m)

    for fp in files:
        d = json.loads(fp.read_text(encoding="utf-8"))
        stats["files"] += 1
        mid = d["id"]
        gh = ga = None
        try:
            gh = int(d["home"]["score"] or 0)
            ga = int(d["away"]["score"] or 0)
        except (TypeError, ValueError):
            pass

        # events goals == score
        if gh is not None:
            eg = {"home": 0, "away": 0}
            for e in d.get("events", []):
                if e["type"] in ("goal", "pen_goal", "own_goal"):
                    eg[e["side"]] += 1
            if (eg["home"], eg["away"]) != (gh, ga):
                stats["goal_mismatch"] += 1
                bad.append(f"{mid} events {eg['home']}-{eg['away']} "
                           f"!= score {gh}-{ga}")

        # player goals + opponent OGs == score
        if gh is not None and d.get("playerStats"):
            for side, want, opp in (("home", gh, "away"), ("away", ga, "home")):
                ps = d["playerStats"].get(side)
                ps_o = d["playerStats"].get(opp)
                if not ps:
                    continue
                g = sum(int(num(p.get("goals")) or 0) for p in ps["rows"])
                og = sum(int(num(p.get("own_goals")) or 0)
                         for p in (ps_o or {}).get("rows", []))
                if g + og != want:
                    stats["gls_mismatch"] += 1
                    bad.append(f"{mid} {side} playerGls {g}+OG{og} != {want}")

        # understat goals == score minus own goals (shots exclude OGs)
        if d.get("shots") is not None and d.get("xgFlow") is not None:
            ush = sum(1 for s in d["shots"]
                      if s["side"] == "home" and s["result"] == "Goal")
            usa = sum(1 for s in d["shots"]
                      if s["side"] == "away" and s["result"] == "Goal")
            ev = d.get("events") or []
            ogh = sum(1 for e in ev
                      if e["type"] == "own_goal" and e["side"] == "home")
            oga = sum(1 for e in ev
                      if e["type"] == "own_goal" and e["side"] == "away")
            if gh is not None and (ush, usa) != (gh - ogh, ga - oga):
                stats["xg_mismatch"] += 1
                bad.append(f"{mid} understat goals {ush}-{usa} != {gh}-{ga} "
                           f"(score-OG {gh - ogh}-{ga - oga})")

        # possession == matches.json
        hit = built.get(mid)
        if hit and d["teamStats"].get("possession"):
            slug, m = hit
            mine = m["venue"] == "Home" and "home" or "away"
            mp = num(d["teamStats"]["possession"][mine])
            if m.get("possession") is not None and mp is not None \
                    and abs(mp - float(m["possession"])) > 0.51:
                stats["poss_mismatch"] += 1
                bad.append(f"{mid} poss {mp} != matches.json "
                           f"{m['possession']} ({slug})")

    print(json.dumps(stats, indent=1))
    for b in bad[:20]:
        print(" ", b)
    sys.exit(0 if all(v == 0 for k, v in stats.items() if k != "files") else 1)


if __name__ == "__main__":
    main()
