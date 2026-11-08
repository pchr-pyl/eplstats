"""League-wide Premier League player rows per season for /players-compare.

Reads public/data/{slug}/players-{season}.json (byComp['Premier League'])
and writes public/data/players-compare/{season}.json + index.json.
Run standalone or via build_all.py.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PUB = ROOT / "public" / "data"
OUT = PUB / "players-compare"
COLS = ["club", "player", "pos", "age", "mp", "starts", "min", "gls", "ast",
        "pk", "pkatt", "sh", "sot", "crdY", "crdR"]


def main():
    index = json.loads((ROOT / "data/built/index.json").read_text(encoding="utf8"))
    seasons = {}
    for c in index:
        for f in sorted((PUB / c["slug"]).glob("players-*.json")):
            season = f.stem.replace("players-", "")
            d = json.loads(f.read_text(encoding="utf8"))
            rows = (d.get("byComp") or {}).get("Premier League")
            if rows is None:
                continue
            for p in rows:
                if not p.get("min"):
                    continue
                seasons.setdefault(season, []).append(
                    [c["slug"], p["player"], p.get("pos") or "", p.get("age"),
                     p.get("mp"), p.get("starts"), p.get("min"), p.get("gls"),
                     p.get("ast"), p.get("pk"), p.get("pkatt"), p.get("sh"),
                     p.get("sot"), p.get("crdY"), p.get("crdR")])
    OUT.mkdir(parents=True, exist_ok=True)
    for season, rows in seasons.items():
        (OUT / f"{season}.json").write_text(
            json.dumps({"season": season, "cols": COLS, "rows": rows},
                       ensure_ascii=False, separators=(",", ":")),
            encoding="utf8")
    (OUT / "index.json").write_text(
        json.dumps({"seasons": sorted(seasons), "latest": max(seasons)}),
        encoding="utf8")
    print("players-compare:", {s: len(r) for s, r in sorted(seasons.items())})


if __name__ == "__main__":
    main()
