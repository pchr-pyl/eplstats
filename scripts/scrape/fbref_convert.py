"""Convert fbref rawHtml (from firecrawl) into run.py task payloads.

Mirrors scripts/scrape/md.py JS helpers + tasks.py shapes exactly:
  schedule    -> {"markdown": <body md>, "metadata": {"sourceURL": url}}
  shooting/keeper/misc
              -> {"tables": [{"label","columns","rows"}], "metadata": {...}}
  keeper-squad-> {"markdown": <table#stats_keeper_combined md>, ...}
  players     -> {"markdown_standard", "markdown_shooting", "markdown_keeper",
                  "markdown_playingTime", "markdown_misc", "metadata": {...}}

fbref hides many tables inside HTML comments — uncomment first, same as the
JS parseDoc() (literal replace of <!-- and -->).
"""
import re
import urllib.parse

from bs4 import BeautifulSoup, Comment, NavigableString, Tag

FBREF = "https://fbref.com"

SKIP_INLINE = {"script", "style", "noscript", "template", "iframe", "svg",
               "form", "button", "select"}
BLOCK_TAGS = {"div", "p", "table", "ul", "ol", "section", "article",
              "h1", "h2", "h3", "h4", "h5", "h6", "header", "footer",
              "nav", "aside", "pre", "blockquote"}


def parse_doc(html):
    html = html.replace("<!--", "").replace("-->", "")
    doc = BeautifulSoup(html, "lxml")
    for s in doc.select(".localtime"):
        s.decompose()  # viewer-relative "(HH:MM)" spans; not in older raw files
    return doc


def collapse(s):
    return re.sub(r"\s+", " ", s or "").strip()


def esc_cell(s):
    return s.replace("|", "\\|").replace("\n", " ")


def abs_url(u, base):
    if not u:
        return ""
    try:
        return urllib.parse.urljoin(base, u)
    except Exception:
        return u


def inline_md(node, base):
    if isinstance(node, NavigableString):
        return str(node)
    if not isinstance(node, Tag):
        return ""
    tag = node.name
    if tag in SKIP_INLINE:
        return ""
    if "localtime" in (node.get("class") or []):
        return ""  # viewer-relative "(HH:MM)" span; not in older raw files
    if tag == "br":
        return "\n"
    kids = "".join(inline_md(k, base) for k in node.children)
    if tag == "a":
        href = node.get("href")
        text = kids.strip()
        if not href or href.startswith("javascript:") or href.startswith("#"):
            return text
        if not text:
            return ""
        return "[" + text + "](" + abs_url(href, base) + ")"
    if tag == "img":
        src = node.get("src")
        if not src:
            return ""
        return "![" + (node.get("alt") or "") + "](" + abs_url(src, base) + ")"
    if tag in ("b", "strong"):
        t = kids.strip()
        return "**" + t + "**" if t else ""
    if tag in ("i", "em"):
        t = kids.strip()
        return "_" + t + "_" if t else ""
    return kids


def table_md(table, base):
    lines = []
    head_rows = list(table.find("thead").find_all("tr")) if table.find("thead") else []
    body_rows = []
    for tb in table.find_all("tbody"):
        body_rows += tb.find_all("tr")
    header = head_rows[-1] if head_rows else None
    if not header and body_rows and body_rows[0].find("th"):
        header = body_rows.pop(0)

    def cells(tr):
        return [esc_cell(collapse(inline_md(td, base)))
                for td in tr.find_all(["td", "th"], recursive=False)]

    if header:
        cs = cells(header)
        lines.append("| " + " | ".join(cs) + " |")
        lines.append("|" + "|".join([" --- "] * len(cs)) + "|")
    for tr in body_rows:
        cs = cells(tr)
        if not cs:
            continue
        lines.append("| " + " | ".join(cs) + " |")
    return "\n".join(lines)


def block_md(node, base, out):
    if isinstance(node, NavigableString):
        if isinstance(node, Comment):
            return
        t = collapse(str(node))
        if t:
            out.append(t)
        return
    if not isinstance(node, Tag):
        return
    tag = node.name
    if tag in ("script", "style", "noscript", "template", "iframe", "svg"):
        return
    if re.fullmatch(r"h[1-6]", tag):
        t = collapse(inline_md(node, base))
        if t:
            out.append("#" * int(tag[1]) + " " + t)
        return
    if tag == "table":
        out.append(table_md(node, base))
        return
    if tag in ("ul", "ol"):
        for li in node.find_all("li", recursive=False):
            t = collapse(inline_md(li, base))
            if t:
                out.append("- " + t)
        return
    if tag in ("p", "section", "article", "header", "footer", "nav", "aside",
               "hr", "pre", "blockquote", "form"):
        t = "---" if tag == "hr" else collapse(inline_md(node, base))
        if t:
            out.append(t)
        return
    kids = node.find_all(recursive=False)
    if all(k.name not in BLOCK_TAGS for k in kids if isinstance(k, Tag)):
        t = collapse(inline_md(node, base))
        if t:
            out.append(t)
    else:
        for k in node.children:
            block_md(k, base, out)


def to_markdown(root, base):
    out = []
    for k in root.children:
        block_md(k, base, out)
    return "\n\n".join(out) + "\n"


# ---------------------------------------------------------------- matchlog
def _matchlog_label(table, doc, tid):
    label = ""
    box = table.find_parent(class_="table_container") or table.parent
    if box:
        e = box.find_previous_sibling()
        while e:
            h = e if e.name == "h2" else e.find("h2")
            if h:
                label = collapse(h.get_text())
                break
            e = e.find_previous_sibling()
        if not label:
            h = box.find("h2")
            if h:
                label = collapse(h.get_text())
    if not label or not re.match(r"^(For|Against)\b", label):
        club = ""
        h1 = doc.select_one("#meta h1") or doc.find("h1")
        if h1:
            m = re.match(r"^\d{4}-\d{4}\s+(.+?)\s+(Match Logs|Scores)",
                         collapse(h1.get_text()))
            club = m.group(1) if m else collapse(h1.get_text())
        label = ("For " if tid == "matchlogs_for" else "Against ") + club
    return label


def extract_matchlog(html, base):
    doc = parse_doc(html)
    out = []
    for tid in ("matchlogs_for", "matchlogs_against"):
        t = doc.find("table", id=tid)
        if not t:
            continue
        label = _matchlog_label(t, doc, tid)
        thead = t.find("thead")
        head_tr = thead.find_all("tr")[-1] if thead and thead.find_all("tr") else None
        columns = [collapse(c.get_text()) for c in head_tr.find_all(["td", "th"])] \
            if head_tr else []
        rows = []
        for tb in t.find_all("tbody"):
            for tr in tb.find_all("tr"):
                cells = [collapse(c.get_text())
                         for c in tr.find_all(["td", "th"], recursive=False)]
                if len(cells) == len(columns) and "".join(cells):
                    rows.append(cells)
        out.append({"label": label, "columns": columns, "rows": rows})
    return out


# ---------------------------------------------------------------- payloads
def convert(html, typ, url):
    """rawHtml + type -> payload dict (exactly the run.py task shapes)."""
    base = FBREF + "/"
    if typ == "schedule":
        doc = parse_doc(html)
        md = to_markdown(doc.body, base) if doc.body else ""
        if not md.strip():
            raise ValueError(f"empty markdown from {url}")
        return {"markdown": md, "metadata": {"sourceURL": url}}
    if typ in ("shooting", "keeper", "misc"):
        tables = extract_matchlog(html, base)
        if not tables or not any(t["rows"] for t in tables):
            raise ValueError(f"no matchlog tables from {url}")
        return {"tables": tables, "metadata": {"sourceURL": url}}
    if typ in ("keeper-squad", "players"):
        doc = parse_doc(html)
        sels = {"markdown_keeper" if typ == "players" else "markdown":
                "table#stats_keeper_combined"}
        if typ == "players":
            sels = {
                "markdown_standard": "table#stats_standard_combined",
                "markdown_shooting": "table#stats_shooting_combined",
                "markdown_keeper": "table#stats_keeper_combined",
                "markdown_playingTime": "table#stats_playing_time_combined",
                "markdown_misc": "table#stats_misc_combined",
            }
        out = {}
        for key, sel in sels.items():
            t = doc.select_one(sel)
            out[key] = (table_md(t, base) + "\n") if t else None
        if not any(out.values()):
            raise ValueError(f"no {typ} tables from {url}")
        out["metadata"] = {"sourceURL": url}
        return out
    raise ValueError(f"unknown type {typ}")


def club_url(club, season, kind):
    slug, fid = club["fbrefSlug"], club["fbrefId"]
    if kind == "schedule":
        return (f"{FBREF}/en/squads/{fid}/{season}/matchlogs/all_comps/schedule/"
                f"{slug}-Scores-and-Fixtures-All-Competitions")
    if kind in ("shooting", "keeper", "misc"):
        return (f"{FBREF}/en/squads/{fid}/{season}/matchlogs/all_comps/{kind}/"
                f"{slug}-Match-Logs-All-Competitions")
    if kind in ("players", "keeper-squad"):
        return f"{FBREF}/en/squads/{fid}/{season}/all_comps/{slug}-Stats-All-Competitions"
    raise ValueError(kind)


def pending_jobs(types=("schedule", "shooting", "keeper", "misc",
                      "players", "keeper-squad")):
    """Yield (slug, season, type, out_path) for missing/invalid files — same
    skip logic as run.py (valid_payload + REQUIRED_KEYS)."""
    import json
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from run import REQUIRED_KEYS, valid_payload

    root = Path(__file__).resolve().parents[2]
    clubs = json.loads((root / "data" / "clubs.json").read_text(encoding="utf-8"))
    for c in clubs:
        for s in c["seasons"]:
            for t in types:
                out = root / "data" / "raw" / "clubs" / c["slug"] / s / f"{t}.json"
                if not valid_payload(out, REQUIRED_KEYS.get(t, ["markdown"])):
                    yield c, s, t, out


def cli():
    """Convert a rawHtml file to a payload: fbref_convert.py <html> <type> <url>"""
    import json
    import sys
    html = Path(sys.argv[1]).read_text(encoding="utf-8")
    payload = convert(html, sys.argv[2], sys.argv[3])
    print(json.dumps(payload, ensure_ascii=False)[:2000])


if __name__ == "__main__":
    cli()
