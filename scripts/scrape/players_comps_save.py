"""Save firecrawl players-comps pages ({url, rawHtml}) into players-comps.json.

Reads overflow content.txt files ({data:{pages:[{url,rawHtml}]}},
{pages:[...]}, or a single-page scrape {rawHtml, metadata:{sourceURL}}),
looks each URL up in tmp/pc_jobs.json's url->[slug,season,compId,compName]
map, extracts per-comp squad tables as markdown via fbref_convert, and
upserts by compId into data/raw/clubs/{slug}/{season}/players-comps.json.

Usage: python -X utf8 scripts/scrape/players_comps_save.py <content.txt> [...]
"""
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import fbref_convert as F

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
PC = ROOT / "tmp" / "pc_jobs.json"
FAIL = ROOT / "scripts" / "scrape" / "failures.jsonl"

SELS = {
    "markdown_standard": 'table[id^="stats_standard"]',
    "markdown_shooting": 'table[id^="stats_shooting"]',
    "markdown_keeper": 'table[id^="stats_keeper"]',
    "markdown_playingTime": 'table[id^="stats_playing_time"]',
}


def find_pages(obj):
    if isinstance(obj, dict):
        if "rawHtml" in obj:
            return [obj]
        for k in ("pages", "results"):
            if k in obj and isinstance(obj[k], list):
                return obj[k]
        for v in obj.values():
            if isinstance(v, (dict, list)):
                r = find_pages(v)
                if r is not None:
                    return r
    if isinstance(obj, list):
        for v in obj:
            r = find_pages(v)
            if r is not None:
                return r
    return None


def save_atomic(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


def page_url(p):
    return p.get("url") or (p.get("metadata") or {}).get("sourceURL") or ""


def log_fail(target, err):
    with FAIL.open("a", encoding="utf-8") as f:
        f.write(json.dumps({
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "kind": "club-players-comps",
            "target": target,
            "error": str(err)[:500]}, ensure_ascii=False) + "\n")


def main():
    jobs = json.loads(PC.read_text(encoding="utf-8"))
    urlmap = jobs["map"]
    clubs = {c["slug"]: c for c in
             json.loads((DATA / "clubs.json").read_text(encoding="utf-8"))}
    saved = failed = skipped = 0
    for arg in sys.argv[1:]:
        pages = find_pages(json.loads(Path(arg).read_text(encoding="utf-8")))
        if not pages:
            print(f"no pages in {arg}")
            continue
        print(f"{Path(arg).parent.name}: {len(pages)} pages")
        for p in pages:
            url = page_url(p)
            html = p.get("rawHtml", "")
            targets = urlmap.get(url)
            if not targets:
                print(f"  ?? {url[-60:]} (not in job map)")
                continue
            for slug, season, comp_id, comp_name in targets:
                target = f"club:{slug}:{season}:players-comps:{comp_id}"
                try:
                    doc = F.parse_doc(html)
                    res = {}
                    for key, sel in SELS.items():
                        t = doc.select_one(sel)
                        res[key] = F.table_md(t, F.FBREF + "/") + "\n" \
                            if t else None
                    if not res["markdown_standard"]:
                        raise ValueError(f"no standard table on {url}")
                    out = (DATA / "raw" / "clubs" / slug / season /
                           "players-comps.json")
                    club = clubs[slug]
                    all_comps_url = (
                        f"{F.FBREF}/en/squads/{club['fbrefId']}/{season}/"
                        f"all_comps/{club['fbrefSlug']}-Stats-All-Competitions")
                    if out.exists():
                        payload = json.loads(out.read_text(encoding="utf-8"))
                    else:
                        payload = {"comps": [], "metadata": {
                            "sourceURL": all_comps_url}}
                    entry = {"compId": comp_id, "name": comp_name,
                             "sourceURL": url, **res}
                    comps = {c["compId"]: c for c in payload["comps"]}
                    if comp_id in comps and comps[comp_id].get(
                            "markdown_standard"):
                        skipped += 1
                        continue
                    comps[comp_id] = entry
                    payload["comps"] = [comps[k] for k in
                                        sorted(comps, key=int)]
                    save_atomic(out, payload)
                    saved += 1
                    print(f"  saved {slug} {season} c{comp_id}")
                except Exception as e:
                    failed += 1
                    log_fail(target, e)
                    print(f"  FAIL {target}: {e}")
    print(f"saved={saved} skipped={skipped} failed={failed}")


if __name__ == "__main__":
    main()
