"""Shared helpers for the multi-club build pipeline."""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
RAW = DATA / "raw"
BUILT = DATA / "built"
PUBLIC = ROOT / "public" / "data"

COMP_MAP = {
    "premier league": "Premier League",
    "first division": "First Division",
    "second division": "Second Division",
    "test matches": "Test Matches",
    "champions lg": "Champions League",
    "champions league": "Champions League",
    "europa lg": "Europa League",
    "europa league": "Europa League",
    "uefa cup": "Europa League",
    "conference lg": "Conference League",
    "conference league": "Conference League",
    "fa cup": "FA Cup",
    "efl cup": "EFL Cup",
    "league cup": "EFL Cup",
    "fa community shield": "Community Shield",
    "community shield": "Community Shield",
    "uefa super cup": "UEFA Super Cup",
    "super cup": "UEFA Super Cup",
    "club world cup": "Club World Cup",
    "fifa club world cup": "Club World Cup",
    "int champions cup": "International Champions Cup",
    "international champions cup": "International Champions Cup",
    "friendly": "Friendly",
}
COMP_ORDER = [
    "First Division", "Second Division", "Premier League", "FA Cup", "EFL Cup",
    "Champions League", "Europa League", "Conference League", "Club World Cup",
    "UEFA Super Cup", "Community Shield", "International Champions Cup",
    "Friendly",
]


def strip_md(cell: str) -> str:
    cell = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", cell).strip()
    cell = cell.replace("\\-", "-").replace("\\", "").replace("*", "")
    cell = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", cell)  # images
    return re.sub(r"\s+", " ", cell).strip()


def canon_comp(raw: str) -> str:
    raw = re.sub(r"^\d+\.\s*", "", strip_md(raw)).strip()
    return COMP_MAP.get(raw.lower(), raw)


def num(cell):
    if cell is None:
        return None
    cell = strip_md(str(cell)).replace(",", "").replace("+", "").replace("%", "")
    if cell in ("", "-", "—"):
        return None
    m = re.match(r"^-?\d+(\.\d+)?", cell)
    return float(m.group(0)) if m else None


def score(cell: str):
    """'1 (6)' -> (1, 6); '3' -> (3, None)."""
    cell = strip_md(cell)
    m = re.match(r"(\d+)(?:\s*\((\d+)\))?", cell)
    if not m:
        return None, None
    return int(m.group(1)), int(m.group(2)) if m.group(2) else None


def parse_tables(md: str):
    """Yield (section_heading, [header], [rows]) for each markdown table."""
    lines = md.splitlines()
    heading = ""
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith("## "):
            heading = line.lstrip("# ").strip()
        if line.startswith("|") and i + 1 < len(lines) and re.match(r"^\|[\s\-|]+\|", lines[i + 1]):
            header = [strip_md(c) for c in line.strip().strip("|").split("|")]
            rows = []
            i += 2
            while i < len(lines) and lines[i].startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                rows.append(cells)
                i += 1
            yield heading, header, rows
            continue
        i += 1


def first_table(md: str):
    for _h, header, rows in parse_tables(md):
        return header, rows
    return [], []


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def load_clubs():
    return {c["slug"]: c for c in load_json(DATA / "clubs.json")}


def write_json(path: Path, obj, compact=True):
    path.parent.mkdir(parents=True, exist_ok=True)
    if compact:
        path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")),
                        encoding="utf-8")
    else:
        path.write_text(json.dumps(obj, ensure_ascii=False, indent=1),
                        encoding="utf-8")


def colmap(header):
    """name -> first index (duplicate fbref headers like GA collide)."""
    out = {}
    for i, c in enumerate(header):
        out.setdefault(c, i)
    return out


def ordinal(n):
    n = int(n)
    if 10 <= n % 100 <= 20:
        suf = "th"
    else:
        suf = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suf}"
