"""Build data/managers.json: first-team manager stints for every club.

Source: English Wikipedia "List of {Club} managers" pages (fallback: the
club article's managers table), via the MediaWiki API over plain HTTP.

Output shape:
  {"<slug>": {"sourceURL": "...", "stints": [
      {"name": "...", "from": "YYYY-MM-DD", "to": "YYYY-MM-DD"|null,
       "interim": bool}, ...sorted by from...]}}

man-utd is copied verbatim from src/lib/managers.ts (dates kept), filtered
to stints overlapping 2014-07-01.

Ambiguities (missing day, overlapping caretaker, non-standard tables) are
kept best-effort and logged to tmp/managers-notes.txt.

Usage: python -X utf8 scripts/scrape/managers.py
"""

import io
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
NOTES = ROOT / "tmp" / "managers-notes.txt"
OUT = DATA / "managers.json"
MANAGERS_TS = ROOT / "src" / "lib" / "managers.ts"

WINDOW_START = "2014-07-01"
TODAY = time.strftime("%Y-%m-%d")

API = "https://en.wikipedia.org/w/api.php"
UA = {"User-Agent": "EPL-analytics-managers/1.0 (research; contact: local)"}

MONTHS = {m.lower(): i for i, m in enumerate(
    ["January", "February", "March", "April", "May", "June", "July",
     "August", "September", "October", "November", "December"], 1)}

# Wikipedia article/list-page naming differs from the short club name.
TITLE_HINTS = {
    "bournemouth": ["List of AFC Bournemouth managers"],
    "brighton": ["List of Brighton & Hove Albion F.C. managers",
                 "List of Brighton and Hove Albion F.C. managers"],
    "cardiff-city": ["List of Cardiff City F.C. managers"],
    "coventry-city": ["List of Coventry City F.C. managers"],
    "huddersfield-town": ["List of Huddersfield Town A.F.C. managers",
                          "List of Huddersfield Town F.C. managers"],
    "hull-city": ["List of Hull City A.F.C. managers"],
    "man-city": ["List of Manchester City F.C. managers"],
    "man-utd": ["List of Manchester United F.C. managers"],
    "middlesbrough": ["List of Middlesbrough F.C. managers"],
    "newcastle-united": ["List of Newcastle United F.C. managers"],
    "nottingham-forest": ["List of Nottingham Forest F.C. managers",
                          "List of Nottingham Forest managers"],
    "qpr": ["List of Queens Park Rangers F.C. managers"],
    "sheffield-united": ["List of Sheffield United F.C. managers"],
    "stoke-city": ["List of Stoke City F.C. managers"],
    "swansea-city": ["List of Swansea City A.F.C. managers"],
    "tottenham": ["List of Tottenham Hotspur F.C. managers"],
    "west-brom": ["List of West Bromwich Albion F.C. managers"],
    "west-ham": ["List of West Ham United F.C. managers"],
    "wolves": ["List of Wolverhampton Wanderers F.C. managers"],
}


def api_get(params):
    url = API + "?" + urllib.parse.urlencode(params)
    for i in range(5):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(10 * (i + 1))
                continue
            raise
        except Exception:
            if i == 4:
                raise
            time.sleep(3)
    raise RuntimeError("api_get retries exhausted")


CACHE = ROOT / "tmp" / "wiki_cache"


def fetch_page(title):
    """parse API with disk cache; returns (title, html) or (None, None)."""
    CACHE.mkdir(exist_ok=True)
    cache = CACHE / (re.sub(r"[^\w.-]", "_", title) + ".json")
    if cache.exists():
        d = json.loads(cache.read_text(encoding="utf-8"))
        return d["title"], d["html"]
    try:
        d = api_get({"action": "parse", "page": title, "prop": "text",
                     "format": "json", "redirects": 1})
    except Exception:
        return None, None
    if "parse" not in d:
        return None, None
    out = {"title": d["parse"]["title"], "html": d["parse"]["text"]["*"]}
    cache.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    return out["title"], out["html"]


def search_manager_page(name, hints):
    """Find the 'List of X managers' page title via opensearch + hints."""
    for title in hints:
        t, html = fetch_page(title)
        if html:
            return t, html
        time.sleep(0.5)
    for q in (f"List of {name} managers", f"{name} managers",
              f"List of {name} F.C. managers"):
        try:
            d = api_get({"action": "opensearch", "search": q, "limit": 6,
                         "namespace": 0, "format": "json"})
            for title in d[1]:
                if "manager" in title.lower():
                    t, html = fetch_page(title)
                    if html:
                        return t, html
        except Exception:
            pass
        time.sleep(0.5)
    return None, None


def clean_cell(s):
    s = str(s)
    s = re.sub(r"\[[^\]]*\]", "", s)             # [12] / [nb 2] / [a] refs
    s = s.replace("\xa0", " ").replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", s).strip()


def parse_date(s, notes, ctx):
    """Return (iso|None, ambiguous:bool). None for present/blank."""
    s = clean_cell(s)
    if not s or s.lower() in ("present", "current", "-", "nan", "incumbent"):
        return None, False
    s = re.sub(r"\(.*?\)", "", s).strip()
    # "6 November 1986" / "6 Nov 1986"
    m = re.match(r"(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})", s)
    if m:
        mon = MONTHS.get(m.group(2)[:9].lower()) or \
            next((v for k, v in MONTHS.items() if k.startswith(m.group(2).lower()[:3])), None)
        if mon:
            return f"{m.group(3)}-{mon:02d}-{int(m.group(1)):02d}", False
    # "November 1986" / "Nov 1986"
    m = re.match(r"([A-Za-z]+)\s+(\d{4})", s)
    if m:
        mon = next((v for k, v in MONTHS.items() if k.startswith(m.group(1).lower()[:3])), None)
        if mon:
            notes.append(f"{ctx}: month-only date '{s}' -> {m.group(2)}-{mon:02d}-01")
            return f"{m.group(2)}-{mon:02d}-01", True
    # "1986"
    m = re.match(r"(\d{4})$", s)
    if m:
        notes.append(f"{ctx}: year-only date '{s}' -> {m.group(1)}-01-01")
        return f"{m.group(1)}-01-01", True
    # ISO-ish "1986-11-06"
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        return s[:10], False
    notes.append(f"{ctx}: unparseable date '{s}' -> kept raw/blank")
    return None, True


def norm_name(s):
    s = clean_cell(s)
    s = re.sub(r"\(.*?\)", "", s)
    s = re.sub(r"[†‡§*±]", "", s)
    return re.sub(r"\s+", " ", s).strip()


def fetch_wikitext(title):
    CACHE.mkdir(exist_ok=True)
    cache = CACHE / (re.sub(r"[^\w.-]", "_", title) + ".wt.json")
    if cache.exists():
        d = json.loads(cache.read_text(encoding="utf-8"))
        return d["title"], d["wt"]
    try:
        d = api_get({"action": "parse", "page": title, "prop": "wikitext",
                     "format": "json", "redirects": 1})
    except Exception:
        return None, None
    if "parse" not in d:
        return None, None
    out = {"title": d["parse"]["title"], "wt": d["parse"]["wikitext"]["*"]}
    cache.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    return out["title"], out["wt"]


def year_stints(t, cols, club, notes):
    """'Year | Nat. | Manager' repeated-triples table -> year-granularity stints."""
    out = []
    year_cols = [i for i, c in enumerate(cols) if c.startswith("year")]
    for yi in year_cols:
        ni = next((ci for ci in range(yi + 1, min(yi + 3, len(cols)))
                   if "manager" in cols[ci] or "name" in cols[ci]), None)
        if ni is None:
            continue
        for _, row in t.iterrows():
            try:
                yr = int(float(str(row.iloc[yi])))
            except (ValueError, TypeError):
                continue
            raw_name = str(row.iloc[ni])
            name = norm_name(raw_name)
            if not name or name.lower() in ("nan", "manager", "name"):
                continue
            interim = bool(re.search(r"\((?:C|I|A|FTC)\)|caretaker|interim",
                                     raw_name, re.I))
            notes.append(f"{club['slug']}:{name}: year-only appointment "
                         f"{yr} -> {yr}-07-01")
            out.append({"name": name, "from": f"{yr}-07-01", "to": None,
                        "interim": interim, "_approx": True})
    return out


def prose_stints(wt, club, notes):
    """===Manager Name=== prose sections; exact appointed/sacked dates."""
    heads = list(re.finditer(r"^={2,}\s*([^=\n]+?)\s*=+\s*$", wt, re.M))
    out = []
    for i, h in enumerate(heads):
        name = norm_name(h.group(1))
        if not name or len(name) > 60:
            continue
        seg = wt[h.end(): heads[i + 1].start() if i + 1 < len(heads) else len(wt)]
        ctx = f"{club['slug']}:{name}"
        m = (re.search(r"appointed[^.\n]{0,120}?\bon (\d{1,2} \w+ \d{4})", seg)
             or re.search(r"took (?:charge|over)[^.\n]{0,120}?\bon (\d{1,2} \w+ \d{4})", seg)
             or re.search(r"\bon (\d{1,2} \w+ \d{4})[^.\n]{0,60}?appointed", seg))
        if not m:
            continue
        frm, _ = parse_date(m.group(1), notes, ctx + " from")
        m2 = re.search(
            r"(?:sacked|dismissed|relieved|departed|left|mutual consent|resigned)"
            r"[^.\n]{0,140}?\bon (\d{1,2} \w+ \d{4})", seg)
        to = None
        if m2:
            to, _ = parse_date(m2.group(1), notes, ctx + " to")
        if frm:
            out.append({"name": name, "from": frm, "to": to,
                        "interim": bool(re.search(r"caretaker|interim",
                                                  h.group(1), re.I))})
    return out


def bullet_stints(wt, club, notes):
    """{{div col}} bullet lists inside a *Managers* section:
    'Name (YYYY–YYYY, YYYY–YYYY)' / 'Name YYYY–YYYY' / 'YYYY [[Name]]'."""
    heads = list(re.finditer(r"^={2,}\s*([^=\n]*?)\s*=+\s*$", wt, re.M))
    spans = [(h.end(), (heads[i + 1].start() if i + 1 < len(heads) else len(wt)))
             for i, h in enumerate(heads) if "manag" in h.group(1).lower()]
    out = []
    for a, b in spans:
        for line in wt[a:b].split("\n"):
            if not line.lstrip().startswith("*"):
                continue
            s = re.sub(r"\{\{flagicon[^}]*\}\}", "", line)
            s = re.sub(r"\{\{[^}]*\}\}", "", s)
            interim = bool(re.search(r"caretaker|interim|\((?:C|I|A)\)",
                                     line, re.I))
            nm = re.search(r"\[\[(?:[^\]|]*\|)?([^\]]+)\]\]", s)
            if nm:
                name = nm.group(1)
                rest = s[nm.end():] + " " + s[:nm.start()]
            else:
                continue
            name = norm_name(name)
            if not name or name.lower() == "nan":
                continue
            ranges = re.findall(r"(\d{4})\s*[-–]\s*(\d{4})?", rest)
            if not ranges:
                yr = re.search(r"\b(19|20)\d{2}\b", rest)
                if yr:
                    notes.append(f"{club['slug']}:{name}: year-only "
                                 f"appointment {yr.group(0)} -> {yr.group(0)}-07-01")
                    out.append({"name": name, "from": f"{yr.group(0)}-07-01",
                                "to": None, "interim": interim,
                                "_approx": True})
                continue
            for a_y, b_y in ranges:
                ctx = f"{club['slug']}:{name}"
                notes.append(f"{ctx}: year-only range {a_y}-{b_y or 'open'} "
                             f"-> {a_y}-07-01..{(b_y + '-06-30') if b_y else 'null'}")
                out.append({"name": name, "from": f"{a_y}-07-01",
                            "to": (b_y + "-06-30") if b_y else None,
                            "interim": interim, "_approx": True})
    return out


def normclub(s):
    return re.sub(r"[^a-z]", "", str(s).lower().replace("&", "and"))


def pl_stints(notes):
    """List of Premier League managers -> {normclub: [exact-date stints]}."""
    _t, html = fetch_page("List of Premier League managers")
    if not html:
        return {}
    tables = pd.read_html(io.StringIO(html))
    tb = next((t for t in tables
               if {"name", "club", "from", "until"} <=
               {str(c).lower() for c in t.columns}), None)
    if tb is None:
        notes.append("PL managers table not found")
        return {}
    out = {}
    for _, row in tb.iterrows():
        raw_name = str(row["Name"])
        name = norm_name(raw_name)
        if not name or name.lower() == "nan":
            continue
        club_n = normclub(row["Club"])
        frm, _ = parse_date(str(row["From"]), notes, f"pl:{name}")
        unt_raw = str(row["Until"])
        to = None if re.search(r"present|current", unt_raw, re.I) else \
            parse_date(unt_raw, notes, f"pl:{name} until")[0]
        if frm:
            out.setdefault(club_n, []).append(
                {"name": name, "from": frm, "to": to,
                 "interim": "‡" in raw_name})
    return out


def upgrade_with_pl(stints, pl_rows, club, notes):
    """Replace vague club-page dates with exact PL-list dates; add missing."""
    used = set()
    for s in stints:
        surname = s["name"].split()[-1].lower()
        cands = [(i, p) for i, p in enumerate(pl_rows)
                 if i not in used and p["name"].split()[-1].lower() == surname]
        if not cands:
            continue
        i, p = min(cands, key=lambda ip: abs(
            int(ip[1]["from"][:4]) - int(s["from"][:4])))
        used.add(i)
        if s["from"] != p["from"] or s["to"] != p["to"]:
            notes.append(f"{club['slug']}:{s['name']}: {s['from']}..{s['to']} "
                         f"-> PL exact {p['from']}..{p['to']}")
            s["from"], s["to"] = p["from"], p["to"]
        s["interim"] = s["interim"] or p["interim"]
        s.pop("_approx", None)
    for i, p in enumerate(pl_rows):
        if i in used or not overlaps(p):
            continue
        notes.append(f"{club['slug']}:{p['name']}: PL-list stint not on club "
                     f"page ({p['from']}..{p['to']}); appended")
        stints.append(dict(p))
    return stints


def table_stints(html, club, notes):
    try:
        tables = pd.read_html(io.StringIO(html))
    except Exception as e:
        notes.append(f"{club['slug']}: read_html failed: {e}")
        return []
    out = []
    for t in tables:
        cols = [clean_cell(c).lower() for c in t.columns]
        if t.columns.nlevels > 1:
            cols = [clean_cell(c[-1]).lower() for c in t.columns]
        # locate name/from/to (or combined tenure) columns
        name_i = next((i for i, c in enumerate(cols)
                       if c in ("name", "manager", "head coach", "coach")), None)
        from_i = next((i for i, c in enumerate(cols)
                       if c in ("from", "appointed", "start", "since")), None)
        to_i = next((i for i, c in enumerate(cols)
                     if c in ("to", "until", "left", "departed", "end")), None)
        tenure_i = next((i for i, c in enumerate(cols)
                         if "tenure" in c or c == "dates"), None)
        if name_i is None or (from_i is None and tenure_i is None):
            if any(c.startswith("year") for c in cols):
                out.extend(year_stints(t, cols, club, notes))
                if out:
                    break
            continue
        for _, row in t.iterrows():
            raw_name = str(row.iloc[name_i])
            name = norm_name(raw_name)
            if not name or name.lower() in ("name", "manager", "nan", "total"):
                continue
            interim = bool(re.search(r"caretaker|interim", raw_name, re.I)) \
                or "†" in raw_name
            if to_i is not None:
                f_s, t_s = str(row.iloc[from_i]), str(row.iloc[to_i])
            elif tenure_i is not None:
                parts = re.split(r"\s*[-–—]\s*", clean_cell(str(row.iloc[tenure_i])), 1)
                f_s = parts[0]
                t_s = parts[1] if len(parts) > 1 else "present"
            else:
                continue
            ctx = f"{club['slug']}:{name}"
            frm, _ = parse_date(f_s, notes, ctx + " from")
            to, _ = parse_date(t_s, notes, ctx + " to")
            if frm is None and re.search(r"caretaker|interim", str(row.iloc[from_i]), re.I):
                interim = True
            if not frm and not re.search(r"present|current", str(row.iloc[from_i]), re.I):
                continue
            if frm and frm > TODAY:
                continue
            out.append({"name": name, "from": frm, "to": to,
                        "interim": interim})
        if out:
            break  # first table that produced rows is the managers table
    return out


def overlaps(s):
    return s["from"] <= TODAY and (s["to"] is None or s["to"] >= WINDOW_START)


def man_utd_stints():
    src = MANAGERS_TS.read_text(encoding="utf-8")
    out = []
    for m in re.finditer(
            r"\{\s*id:\s*'[^']*',\s*name:\s*'([^']*)',\s*nameTh:\s*'([^']*)',"
            r"\s*from:\s*'([^']*)',\s*to:\s*('[^']*'|null),\s*interim:\s*(true|false)",
            src):
        name, name_th, frm, to_raw, interim = m.group(1), m.group(2), m.group(3), m.group(4), m.group(5)
        out.append({"name": name, "nameTh": name_th, "from": frm,
                    "to": None if to_raw == "null" else to_raw.strip("'"),
                    "interim": interim == "true"})
    return [s for s in out if overlaps(s)]


def main():
    clubs = json.loads((DATA / "clubs.json").read_text(encoding="utf-8"))
    notes = []
    global PL
    PL = pl_stints(notes)
    print(f"PL managers list: {sum(len(v) for v in PL.values())} stints, "
          f"{len(PL)} clubs", flush=True)
    result = {}
    for club in clubs:
        slug = club["slug"]
        if slug == "man-utd":
            result[slug] = {"sourceURL": "src/lib/managers.ts",
                            "stints": man_utd_stints()}
            continue
        title, html = search_manager_page(club["name"],
                                          TITLE_HINTS.get(slug, []))
        if not html:
            notes.append(f"{slug}: no managers page found")
            result[slug] = {"sourceURL": None, "stints": []}
            continue
        url = "https://en.wikipedia.org/wiki/" + urllib.parse.quote(
            title.replace(" ", "_"))
        stints = table_stints(html, club, notes)
        if not stints:
            _wt_title, wt = fetch_wikitext(title)
            if wt:
                stints = prose_stints(wt, club, notes) or \
                    bullet_stints(wt, club, notes)
        # dedupe identical name+from, sort full list chronologically
        import datetime as _dt
        seen = set()
        ded = []
        for s in sorted(stints, key=lambda s: s["from"] or "9999"):
            k = (s["name"], s["from"])
            if k in seen:
                continue
            seen.add(k)
            ded.append(s)
        # open-ended non-last stints (missed departure) and year-only
        # stints: close at the day before the next starts, BEFORE window
        # filtering (else open-ended rows all pass overlaps())
        for a, b in zip(ded, ded[1:]):
            if a["to"] is None and b["from"]:
                y, m_, d = (int(x) for x in b["from"].split("-"))
                cand = str(_dt.date(y, m_, d) - _dt.timedelta(days=1))
                if cand < a["from"]:
                    cand = a["from"]
                a["to"] = cand
                if not a.get("_approx"):
                    notes.append(f"{slug}:{a['name']}: no end date; "
                                 f"closed at next stint start - 1d "
                                 f"({cand})")
        ded = [s for s in ded if overlaps(s)]
        for s in ded:
            if s["to"] is not None and s["to"] < s["from"]:
                notes.append(f"{slug}:{s['name']}: to {s['to']} < from "
                             f"{s['from']}; clamped to from")
                s["to"] = s["from"]
        pl_rows = PL.get(normclub(club["name"]), [])
        if pl_rows:
            ded = upgrade_with_pl(ded, pl_rows, club, notes)
            ded.sort(key=lambda s: s["from"] or "9999")
        # drop year-only stints shadowed by an exact same-surname stint
        exact = [s for s in ded if not s.get("_approx")]
        kept = []
        for s in ded:
            if s.get("_approx") and any(
                    e["name"].split()[-1].lower() ==
                    s["name"].split()[-1].lower()
                    and abs(int(e["from"][:4]) - int(s["from"][:4])) <= 1
                    for e in exact):
                notes.append(f"{slug}:{s['name']}: year-only stint "
                             f"{s['from']}..{s['to']} shadowed by exact "
                             f"stint; dropped")
                continue
            kept.append(s)
        ded = kept
        for s in ded:
            s.pop("_approx", None)
        # overlap check (same-day handovers are fine)
        for a, b in zip(ded, ded[1:]):
            if a["to"] is None or (b["from"] and a["to"] and b["from"] < a["to"]):
                notes.append(f"{slug}: overlapping stints {a['name']} "
                             f"{a['from']}..{a['to']} vs {b['name']} {b['from']}")
        result[slug] = {"sourceURL": url, "stints": ded}
        print(f"{slug}: {len(ded)} stints <- {title}", flush=True)
        time.sleep(1.5)

    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=1),
                   encoding="utf-8")
    NOTES.parent.mkdir(exist_ok=True)
    NOTES.write_text("\n".join(notes) + "\n", encoding="utf-8")
    print(f"wrote {OUT} ({len(result)} clubs), {len(notes)} notes -> {NOTES}")


if __name__ == "__main__":
    main()
