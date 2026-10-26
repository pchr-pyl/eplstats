"""Scrape understat match data into data/raw/understat-matches/{season}/{id}.json.

Match pages embed only match_info; shotsData/rostersData come from the
getMatchData/{id} XHR, which needs the PHPSESSID cookie + X-Requested-With
header (plain urllib + cookie jar + gzip works — no Cloudflare here).

Jobs come from data/raw/league/{season}/understat.json dates[] (isResult only).
Resumable: skips files that already exist and validate. Failures append to
scripts/scrape/failures.jsonl (kind "understat-match").

Usage: python -X utf8 scripts/scrape/understat_matches.py [--limit N] [--season YYYY-YYYY]
"""

import argparse
import codecs
import gzip
import http.cookiejar
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "raw" / "understat-matches"
FAIL_LOG = Path(__file__).resolve().parent / "failures.jsonl"

VAR = re.compile(r"var (\w+)\s*=\s*JSON\.parse\('((?:[^'\\]|\\.)*)'\)")
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
      "X-Requested-With": "XMLHttpRequest", "Accept": "application/json"}


def log_failure(kind, target, err):
    rec = {"ts": time.strftime("%Y-%m-%dT%H:%M:%S"), "kind": kind,
           "target": target, "error": str(err)[:500]}
    with FAIL_LOG.open("a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def collect_jobs():
    jobs = {}
    for f in sorted((ROOT / "data" / "raw" / "league").glob("*/understat.json")):
        season = f.parent.name
        for d in json.loads(f.read_text(encoding="utf-8")).get("dates", []):
            mid = str(d.get("id") or "")
            if mid and d.get("isResult"):
                jobs[mid] = season
    return jobs


def _read(resp):
    body = resp.read()
    if body[:2] == b"\x1f\x8b":
        body = gzip.decompress(body)
    return body


class Client:
    def __init__(self):
        self.op = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def fetch(self, mid):
        base = f"https://understat.com/match/{mid}"
        page = _read(self.op.open(
            urllib.request.Request(base, headers=UA), timeout=30))
        data = {"metadata": {"sourceURL": base}}
        for name, raw in VAR.findall(page.decode("utf-8")):
            if name == "match_info":
                data[name] = json.loads(
                    codecs.decode(raw.encode(), "unicode_escape"))
        extra = json.loads(_read(self.op.open(urllib.request.Request(
            f"https://understat.com/getMatchData/{mid}", headers=UA),
            timeout=30)).decode("utf-8"))
        if isinstance(extra, dict):
            if "shots" in extra:
                data["shotsData"] = extra["shots"]
            if "rosters" in extra:
                data["rostersData"] = extra["rosters"]
        if "shotsData" not in data or "rostersData" not in data:
            raise ValueError("missing shotsData/rostersData")
        return data


def valid(path):
    try:
        d = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return False
    return bool(d.get("shotsData") and d.get("rostersData")
                and d.get("match_info"))


def save_atomic(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--season")
    ap.add_argument("--delay", type=float, default=0.4)
    args = ap.parse_args()

    jobs = collect_jobs()
    todo = {mid: s for mid, s in jobs.items()
            if not valid(OUT / s / f"{mid}.json")}
    if args.season:
        todo = {k: v for k, v in todo.items() if v == args.season}
    items = sorted(todo.items())
    if args.limit:
        items = items[: args.limit]
    print(f"{len(jobs)} total, {len(items)} to fetch", flush=True)

    cli = Client()
    done = failed = 0
    for mid, season in items:
        for attempt in range(4):
            try:
                save_atomic(OUT / season / f"{mid}.json", cli.fetch(mid))
                done += 1
                break
            except Exception as e:
                err = e
                time.sleep(3 * (attempt + 1))
        else:
            failed += 1
            log_failure("understat-match", f"{season}/{mid}", err)
        if (done + failed) % 100 == 0:
            print(f"{done} saved, {failed} failed, "
                  f"{len(items) - done - failed} left", flush=True)
        time.sleep(args.delay)
    print(f"DONE {done} saved, {failed} failed", flush=True)


if __name__ == "__main__":
    main()
