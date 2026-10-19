"""Save capology pages from a firecrawl_agent_status overflow JSON file.

Usage: python -X utf8 scripts/scrape/capology_save.py <overflow_content.txt> [more.txt...]

Each file is the JSON result of firecrawl_agent_status containing
data.pages[] = {url, markdown}. Pages whose URL matches
/club/{capologySlug}/salaries/{season}/ and whose markdown contains the
salary table are written to data/raw/clubs/{clubSlug}/{season}/capology.json
as {"markdown": ..., "metadata": {"sourceURL": url}}. Others are appended to
tmp/capology-missing.txt.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MISSING = ROOT / "tmp" / "capology-missing.txt"
CLUBS = json.loads((ROOT / "data" / "clubs.json").read_text(encoding="utf-8"))
BY_CAP = {c["capologySlug"]: c["slug"] for c in CLUBS}

sys.path.insert(0, str(ROOT / "scripts"))
from parse_capology import parse_season  # noqa: E402

URL_RE = re.compile(r"/club/([^/]+)/salaries/(\d{4}-\d{4})/?$")


def process(path):
    d = json.loads(Path(path).read_text(encoding="utf-8"))
    pages = (d.get("data") or {}).get("pages") or []
    for p in pages:
        url, md = p.get("url", ""), p.get("markdown", "")
        m = URL_RE.search(url)
        if not m:
            print("  SKIP bad url", url)
            continue
        cap_slug, season = m.group(1), m.group(2)
        slug = BY_CAP.get(cap_slug)
        if not slug:
            print("  SKIP unknown capology slug", cap_slug, url)
            continue
        out_path = ROOT / "data" / "raw" / "clubs" / slug / season / "capology.json"
        if out_path.exists() and out_path.stat().st_size > 100:
            print(f"  exists {slug} {season}")
            continue
        parsed = parse_season(md)
        n = len(parsed["players"])
        if n == 0 or "flags/" not in md or "£" not in md:
            with MISSING.open("a", encoding="utf-8") as f:
                f.write(f"{slug}\t{season}\tno salary table in agent markdown\t{url}\n")
            print(f"  MISSING {slug} {season} (players={n})")
            continue
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(
            {"markdown": md, "metadata": {"sourceURL": url}},
            ensure_ascii=False), encoding="utf-8")
        print(f"  saved {slug} {season} ({n} players)")


if __name__ == "__main__":
    for arg in sys.argv[1:]:
        print("file:", arg)
        process(arg)
