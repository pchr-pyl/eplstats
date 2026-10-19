"""Save firecrawl_agent pages ({url, rawHtml}) as fbref raw payloads.

Reads a firecrawl agent overflow content.txt ({data:{pages:[{url,rawHtml}]}} or
{pages:[...]}), looks each URL up in tmp/fc_jobs.json's url->[(slug,season,type)]
map, converts via fbref_convert and writes atomically to
data/raw/clubs/{slug}/{season}/{type}.json. Skips already-valid files.

Usage: python -X utf8 scripts/scrape/fbref_save.py <content.txt> [more.txt...]
"""
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import fbref_convert as F

ROOT = Path(__file__).resolve().parents[2]
FC = ROOT / "tmp" / "fc_jobs.json"
FAIL = ROOT / "scripts" / "scrape" / "failures.jsonl"


def find_pages(obj):
    if isinstance(obj, dict):
        if "pages" in obj:
            return obj["pages"]
        for v in obj.values():
            r = find_pages(v)
            if r is not None:
                return r
    return None


def save_atomic(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


def main():
    fc = json.loads(FC.read_text(encoding="utf-8"))
    urlmap = fc["map"]
    saved = failed = skipped = 0
    for arg in sys.argv[1:]:
        pages = find_pages(json.loads(Path(arg).read_text(encoding="utf-8")))
        if not pages:
            print(f"no pages in {arg}")
            continue
        print(f"{Path(arg).parent.name}: {len(pages)} pages")
        for p in pages:
            url, html = p.get("url", ""), p.get("rawHtml", "")
            targets = urlmap.get(url)
            if not targets:
                print(f"  ?? {url[-60:]} (not in job map)")
                continue
            for slug, season, typ in targets:
                out = ROOT / "data" / "raw" / "clubs" / slug / season / f"{typ}.json"
                if out.exists() and out.stat().st_size > 100:
                    skipped += 1
                    continue
                try:
                    payload = F.convert(html, typ, url)
                    save_atomic(out, payload)
                    saved += 1
                    print(f"  saved {slug} {season} {typ}")
                except Exception as e:
                    failed += 1
                    with FAIL.open("a", encoding="utf-8") as f:
                        f.write(json.dumps({
                            "ts": time.strftime("%Y-%m-%dT%H:%M:%S"),
                            "kind": "club-firecrawl",
                            "target": f"club:{slug}:{season}:{typ}",
                            "error": str(e)[:500]}, ensure_ascii=False) + "\n")
                    print(f"  FAIL {slug} {season} {typ}: {e}")
    print(f"saved={saved} skipped={skipped} failed={failed}")


if __name__ == "__main__":
    main()
