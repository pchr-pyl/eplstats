"""Save firecrawl_agent match-report results as parsed raw match payloads.

Reads agent overflow content.txt files ({data:{results:[{url,rawHtml}]}} or any
nesting), maps each URL to its fbref match id + season via the jobs in
matches.collect_jobs(), parses with matches.parse_report, and writes atomically
to data/raw/matches/{season}/{matchId}.json. Skips already-valid files.

Usage: python -X utf8 scripts/scrape/matches_save.py <content.txt> [more.txt...]
"""

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import matches as M

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "raw" / "matches"
FAIL_LOG = Path(__file__).resolve().parent / "failures.jsonl"


def log_failure(kind, target, err):
    rec = {"ts": time.strftime("%Y-%m-%dT%H:%M:%S"), "kind": kind,
           "target": target, "error": str(err)[:500]}
    with FAIL_LOG.open("a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def find_results(obj):
    if isinstance(obj, dict):
        for k in ("results", "pages"):
            if k in obj and isinstance(obj[k], list):
                return obj[k]
        for v in obj.values():
            r = find_results(v)
            if r is not None:
                return r
    if isinstance(obj, list):
        return obj
    return None


def main():
    jobs = M.collect_jobs()
    saved = skipped = failed = unmatched = 0
    for arg in sys.argv[1:]:
        results = find_results(json.loads(Path(arg).read_text(encoding="utf-8")))
        if not results:
            print(f"no results in {arg}")
            continue
        print(f"{Path(arg).parent.name}: {len(results)} pages")
        for p in results:
            url, html = p.get("url", ""), p.get("rawHtml", "")
            mm = M.MATCH_ID.search(url)
            mid = mm.group(1) if mm else None
            if not mid or mid not in jobs or not html:
                unmatched += 1
                print(f"  ?? {url[-70:]}")
                continue
            season, _ = jobs[mid]
            out = OUT / season / f"{mid}.json"
            if M.valid(out):
                skipped += 1
                continue
            try:
                payload = M.parse_report(html, url)
                hb = payload["scorebox"]
                gh = sum(1 for e in payload["events"]
                         if e["side"] == "home"
                         and e["type"] in ("goal", "pen_goal", "own_goal"))
                ga = sum(1 for e in payload["events"]
                         if e["side"] == "away"
                         and e["type"] in ("goal", "pen_goal", "own_goal"))
                try:
                    sh, sa = int(hb["home"]["score"]), int(hb["away"]["score"])
                    if (gh, ga) != (sh, sa):
                        log_failure("match-validate", f"{season}/{mid}",
                                    f"events {gh}-{ga} != score {sh}-{sa}")
                except (TypeError, ValueError):
                    pass
                M.save_atomic(out, payload)
                saved += 1
            except Exception as e:
                failed += 1
                log_failure("match", f"{season}/{mid}", e)
                print(f"  FAIL {mid}: {e}")
    print(f"saved={saved} skipped={skipped} failed={failed} "
          f"unmatched={unmatched}")


if __name__ == "__main__":
    main()
