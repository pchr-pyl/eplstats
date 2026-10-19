"""Compare data/built/man-utd/* against legacy data/man-utd-*.json outputs.

Checks (lead spec):
  seasons.json vs man-utd-seasons.json (2014-2015..2025-2026):
    mp/w/d/l/gf/ga/gd/pts/cs/rank/topScorer/goalkeeper identical per
    (season, competition); xg/xga within 0.1.
  matches.json vs man-utd-matches.json: count per season, results, xg <=0.01.
  keepers.json counts vs man-utd-keepers.json for overlapping seasons.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
D = ROOT / "data"
NEW = D / "built" / "man-utd"
SEASONS = [f"{y}-{y+1}" for y in range(2014, 2026)]

FIELDS = ["mp", "w", "d", "l", "gf", "ga", "gd", "pts", "cs", "rank",
          "topScorer", "goalkeeper"]

old = { (r["season"], r["competition"]): r for r in
        json.loads((D / "man-utd-seasons.json").read_text(encoding="utf-8")) }
new = { (r["season"], r["competition"]): r for r in
        json.loads((NEW / "seasons.json").read_text(encoding="utf-8")) }

diffs = []
for (s, c), ro in sorted(old.items()):
    if s not in SEASONS:
        continue
    rn = new.get((s, c))
    if rn is None:
        diffs.append(f"missing row {s} {c}")
        continue
    for f in FIELDS:
        if ro.get(f) != rn.get(f):
            diffs.append(f"{s} {c} {f}: old={ro.get(f)} new={rn.get(f)}")
    for f in ("xg", "xga"):
        o, n = ro.get(f), rn.get(f)
        if (o is None) != (n is None):
            diffs.append(f"{s} {c} {f}: old={o} new={n}")
        elif o is not None and abs(o - n) > 0.1:
            diffs.append(f"{s} {c} {f}: old={o} new={n} (>0.1)")
for (s, c) in new:
    if s in SEASONS and (s, c) not in old:
        diffs.append(f"extra row {s} {c}")

print(f"seasons: {len(diffs)} diffs")
for x in diffs[:80]:
    print("  ", x)

om = json.loads((D / "man-utd-matches.json").read_text(encoding="utf-8"))
nm = json.loads((NEW / "matches.json").read_text(encoding="utf-8"))
om = [m for m in om if m["season"] in SEASONS]
print(f"matches: old={len(om)} new={len(nm)}")
from collections import Counter
co, cn = Counter(m["season"] for m in om), Counter(m["season"] for m in nm)
for s in SEASONS:
    if co.get(s) != cn.get(s):
        print(f"  season {s}: old={co.get(s)} new={cn.get(s)}")
ok = dict(((m["season"], m["date"], m["opponent"]), m) for m in om)
md = 0
for m in nm:
    o = ok.get((m["season"], m["date"], m["opponent"]))
    if o is None:
        print("  unmatched new match", m["season"], m["date"], m["opponent"])
        md += 1
        continue
    if o["result"] != m["result"] or o["gf"] != m["gf"] or o["ga"] != m["ga"]:
        print("  result diff", m["season"], m["date"], o["result"], m["result"])
        md += 1
    for f in ("xg", "xga"):
        o_v, n_v = o.get(f), m.get(f)
        if (o_v is None) != (n_v is None):
            print(f"  xg presence diff {m['season']} {m['date']} old={o_v} new={n_v}")
            md += 1
        elif o_v is not None and abs(o_v - n_v) > 0.01:
            print(f"  {f} diff {m['season']} {m['date']} old={o_v} new={n_v}")
            md += 1
print(f"matches diffs: {md}")

ko = json.loads((D / "man-utd-keepers.json").read_text(encoding="utf-8"))
kn = json.loads((NEW / "keepers.json").read_text(encoding="utf-8"))
for k in ("matchLog", "perGkSeason", "psxg", "psxgPerGk"):
    o = [r for r in ko[k] if r["season"] in SEASONS]
    n = [r for r in kn[k] if r["season"] in SEASONS]
    print(f"keepers.{k}: old={len(o)} new={len(n)}")
    from collections import Counter as C
    co, cn = C(r["season"] for r in o), C(r["season"] for r in n)
    for s in sorted(set(co) | set(cn)):
        if co.get(s) != cn.get(s):
            print(f"    {s}: old={co.get(s)} new={cn.get(s)}")
print("verify done")
sys.exit(0)
