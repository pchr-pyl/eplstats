"""Validate data/managers.json: scope, overlaps, names, and match-date coverage.

Exit code 1 if any problem is found.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
START = "2014-07-01"
TODAY = "2026-10-18"


def main():
    mgr = json.loads((ROOT / "data" / "managers.json").read_text(encoding="utf-8"))
    clubs = json.loads((ROOT / "data" / "clubs.json").read_text(encoding="utf-8"))
    problems = []
    for c in clubs:
        slug = c["slug"]
        entry = mgr.get(slug)
        if not entry or not entry.get("stints"):
            problems.append(f"{slug}: no stints")
            continue
        stints = entry["stints"]
        for s in stints:
            end = s["to"] or TODAY
            if end < START:
                problems.append(f"{slug}: out of scope stint {s['name']} {s['from']}..{s['to']}")
            if not s["from"] or s["from"] > end:
                problems.append(f"{slug}: bad dates {s['name']} {s['from']}..{s['to']}")
            if "," in s["name"] or " and " in s["name"]:
                problems.append(f"{slug}: joint/garbled name '{s['name']}'")
        ordered = sorted(stints, key=lambda s: s["from"] or "")
        for a, b in zip(ordered, ordered[1:]):
            nested_interim = b["interim"] and not a["interim"] and (b["to"] or TODAY) <= (a["to"] or TODAY)
            if (a["to"] or TODAY) > b["from"] and not nested_interim:
                problems.append(f"{slug}: overlap {a['name']} ..{a['to']} / {b['name']} {b['from']}..")
        if sum(1 for s in stints if s["to"] is None) != 1:
            problems.append(f"{slug}: {sum(1 for s in stints if s['to'] is None)} open-ended stints")

        mp = ROOT / "data" / "built" / slug / "matches.json"
        if mp.exists():
            uncovered = [m["date"] for m in json.loads(mp.read_text(encoding="utf-8"))
                         if m.get("result") in ("W", "D", "L")
                         and not any(s["from"] <= m["date"] <= (s["to"] or TODAY) for s in stints if s["from"])]
            if uncovered:
                problems.append(f"{slug}: {len(uncovered)} matches without manager, e.g. {uncovered[:5]}")
    for p in problems:
        print(p)
    print(f"{len(problems)} problems")
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
