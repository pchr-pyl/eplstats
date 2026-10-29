"""EPL dashboard scraper driver.

Usage:
  python -X utf8 scripts/scrape/run.py --league --types table,fixtures,keeperadv,understat --seasons 2014-2015..2026-2027
  python -X utf8 scripts/scrape/run.py --club arsenal --types schedule,shooting,keeper,misc,players,players-comps,keeper-squad,capology
  python -X utf8 scripts/scrape/run.py --club all --types schedule
  python -X utf8 scripts/scrape/run.py --club man-utd --types shooting --seasons 2020-2021 --out-dir tmp/shapecheck

Resumable: skips outputs that exist and validate. Failures append to
scripts/scrape/failures.jsonl. Never writes partial/empty files.
"""

import argparse
import json
import os
import random
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from browser import BrowserSession
from tasks import CLUB_TYPES, LEAGUE_TYPES

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
FAIL_LOG = Path(__file__).resolve().parent / "failures.jsonl"
TIMING_LOG = Path(__file__).resolve().parent / "scrape-timing.log"

ALL_SEASONS = [f"{y}-{y+1}" for y in range(2014, 2027)]


def log_failure(kind, target, url_hint, err):
    rec = {"ts": time.strftime("%Y-%m-%dT%H:%M:%S"), "kind": kind,
           "target": target, "error": str(err)[:500]}
    with FAIL_LOG.open("a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    print(f"  FAILED {target}: {err}", flush=True)


def log_timing(target, secs):
    with TIMING_LOG.open("a", encoding="utf-8") as f:
        f.write(f"{time.strftime('%H:%M:%S')} {secs:6.1f}s {target}\n")


def valid_payload(path, required_keys):
    try:
        d = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return False
    for k in required_keys:
        v = d.get(k)
        if not v:
            return False
    return True


REQUIRED_KEYS = {
    "schedule": ["markdown"], "capology": ["markdown"], "history": ["markdown"],
    "keeper-squad": ["markdown"],
    "shooting": ["tables"], "keeper": ["tables"], "misc": ["tables"],
    "players": ["markdown_standard"],
    "players-comps": ["comps"],
    "table": ["squads"], "fixtures": ["markdown"],
    "keeperadv": ["markdown_squads"],
    "understat": ["dates"],
}


def save_atomic(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, path)


def parse_seasons(spec):
    if not spec:
        return ALL_SEASONS
    if ".." in spec:
        a, b = spec.split("..")
        ya, yb = int(a[:4]), int(b[:4])
        return [f"{y}-{y+1}" for y in range(ya, yb + 1)]
    return [s.strip() for s in spec.split(",") if s.strip()]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--club", help="club slug, or 'all'")
    ap.add_argument("--league", action="store_true")
    ap.add_argument("--types", help="comma list; default all for the mode")
    ap.add_argument("--seasons", help="YYYY-YYYY..YYYY-YYYY or comma list")
    ap.add_argument("--out-dir", default=str(DATA / "raw"))
    ap.add_argument("--headless", action="store_true",
                    help="try headless (fbref Cloudflare normally blocks it)")
    ap.add_argument("--delay", type=float, default=3.0)
    args = ap.parse_args()

    out_root = Path(args.out_dir)
    clubs = {c["slug"]: c for c in json.loads((DATA / "clubs.json").read_text(encoding="utf-8"))} \
        if (DATA / "clubs.json").exists() else {}

    jobs = []  # (kind 'league'|'club', type, club_or_none, season, out_path, url_hint)
    seasons = parse_seasons(args.seasons)

    if args.league:
        types = (args.types.split(",") if args.types else list(LEAGUE_TYPES))
        for s in seasons:
            for t in types:
                jobs.append(("league", t, None, s, out_root / "league" / s / f"{t}.json"))

    if args.club:
        types = (args.types.split(",") if args.types else list(CLUB_TYPES))
        slugs = list(clubs) if args.club == "all" else [args.club]
        for slug in slugs:
            club = clubs.get(slug)
            if not club:
                print(f"unknown club {slug}", flush=True)
                continue
            club_seasons = [s for s in seasons if s in club.get("seasons", seasons)]
            for s in club_seasons:
                for t in types:
                    jobs.append(("club", t, club, s, out_root / "clubs" / slug / s / f"{t}.json"))

    print(f"{len(jobs)} candidate jobs", flush=True)
    todo = [j for j in jobs if not valid_payload(j[4], REQUIRED_KEYS.get(j[1], ["markdown"]))]
    print(f"{len(todo)} to fetch ({len(jobs)-len(todo)} already done)", flush=True)
    if not todo:
        return

    with BrowserSession(headless=args.headless, delay=args.delay) as sess:
        for i, (kind, typ, club, season, out) in enumerate(todo):
            target = f"{kind}:{club['slug'] if club else 'league'}:{season}:{typ}"
            t0 = time.time()
            try:
                fn = LEAGUE_TYPES[typ] if kind == "league" else CLUB_TYPES[typ]
                payload = fn(sess, club, season)
                save_atomic(out, payload)
                secs = time.time() - t0
                log_timing(target, secs)
                print(f"[{i+1}/{len(todo)}] OK {target} ({secs:.1f}s) -> {out.relative_to(out_root)}", flush=True)
            except Exception as e:
                log_failure(kind, target, "", e)
            time.sleep(random.random() * 0.5)


if __name__ == "__main__":
    main()
