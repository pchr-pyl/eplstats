"""Build data/man-utd-seasons.csv + .json from raw scrapes in data/raw/.

Sources:
  - data/raw/history.json          fbref Stats & History page (firecrawl markdown)
  - data/raw/matchlog-*.json       fbref season match logs (schedule view)
  - data/raw/understat-*.json      understat EPL xG per match (2014-15+)

Outputs rows: Season, Competition, LgRank, MP, W, D, L, GF, GA, GD, Pts,
Pts/MP, xG, xGA, xGD, CS, Top Team Scorer, Goalkeeper, Notes
Plus an "All Competitions" aggregate row per season.
"""
import csv
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
SEASONS = []

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
    "international champions cup": "International Champions Cup",
}
COMP_ORDER = [
    "First Division", "Second Division", "Premier League", "FA Cup", "EFL Cup",
    "Champions League", "Europa League", "Conference League", "Club World Cup",
    "UEFA Super Cup", "Community Shield", "International Champions Cup",
]


def strip_md(cell: str) -> str:
    cell = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", cell).strip()
    cell = cell.replace("\\-", "-").replace("\\", "").replace("*", "")
    return re.sub(r"\s+", " ", cell)


def canon_comp(raw: str) -> str:
    raw = re.sub(r"^\d+\.\s*", "", strip_md(raw)).strip()
    return COMP_MAP.get(raw.lower(), raw)


def num(cell: str):
    cell = strip_md(cell).replace(",", "").replace("+", "").replace("%", "")
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


def load_md(path: Path) -> str:
    return json.loads(path.read_text(encoding="utf-8"))["markdown"]


def load_seasons():
    md = load_md(RAW / "history.json")
    hist = set()
    sections = {
        "Domestic Leagues Results",
        "International Cup Results",
        "Domestic Cup Results",
        "International Super Cup Results",
        "Domestic Super Cup Results",
    }
    for heading, header, rows in parse_tables(md):
        if heading not in sections or not header or header[0] != "Season":
            continue
        for r in rows:
            if len(r) < 1:
                continue
            s = strip_md(r[0])
            if re.match(r"^\d{4}-\d{4}$", s):
                hist.add(s)
    match = set(
        p.stem.replace("matchlog-", "")
        for p in RAW.glob("matchlog-*.json")
        if re.match(r"^matchlog-\d{4}-\d{4}$", p.stem)
    )
    return sorted(hist | match)


SEASONS = load_seasons()


# ---------- 1. matchlog aggregation: season x comp -> stats ----------
def matchlog_stats():
    agg = {}  # (season, comp) -> dict
    for season in SEASONS:
        p = RAW / f"matchlog-{season}.json"
        if not p.exists():
            continue
        md = load_md(p)
        found = False
        for heading, header, rows in parse_tables(md):
            if "Scores & Fixtures" not in heading or not header or header[0] != "Date":
                continue
            found = True
            idx = {name: k for k, name in enumerate(header)}
            for r in rows:
                if len(r) < len(header):
                    continue
                comp = canon_comp(r[idx["Comp"]])
                res = strip_md(r[idx["Result"]])
                gf = num(re.sub(r"\(.*\)", "", r[idx["GF"]]))
                ga = num(re.sub(r"\(.*\)", "", r[idx["GA"]]))
                if res not in ("W", "D", "L") or gf is None or ga is None:
                    continue
                a = agg.setdefault((season, comp), dict(mp=0, w=0, d=0, l=0, gf=0, ga=0, cs=0))
                a["mp"] += 1
                a[res.lower()] += 1
                a["gf"] += int(gf)
                a["ga"] += int(ga)
                a["cs"] += 1 if ga == 0 else 0
        if not found:
            print(f"WARN: no matchlog table for {season}", file=sys.stderr)
    return agg


# ---------- 2. history tables -> canonical rows ----------
def history_rows():
    md = load_md(RAW / "history.json")
    out = {}
    sections = {
        "Domestic Leagues Results",
        "International Cup Results",
        "Domestic Cup Results",
        "International Super Cup Results",
        "Domestic Super Cup Results",
    }
    for heading, header, rows in parse_tables(md):
        if heading not in sections or not header or header[0] != "Season":
            continue
        idx = {name: k for k, name in enumerate(header)}
        for r in rows:
            if len(r) < 5:
                continue
            season = strip_md(r[idx["Season"]])
            if season not in SEASONS:
                continue
            comp = canon_comp(r[idx["Comp"]])
            g = lambda name: num(r[idx[name]]) if idx.get(name) is not None and idx[name] < len(r) else None
            s = lambda name: strip_md(r[idx[name]]) if idx.get(name) is not None and idx[name] < len(r) else ""
            out[(season, comp)] = {
                "season": season,
                "competition": comp,
                "squad": s("Squad") or None,
                "rank": s("LgRank") or None,
                "mp": int(g("MP") or 0),
                "w": int(g("W") or 0),
                "d": int(g("D") or 0),
                "l": int(g("L") or 0),
                "gf": int(g("GF") or 0),
                "ga": int(g("GA") or 0),
                "gd": int(g("GD") or 0) if g("GD") is not None else int(g("GF") or 0) - int(g("GA") or 0),
                "pts": int(g("Pts") or 0),
                "attendance": g("Attendance"),
                "topScorer": s("Top Team Scorer") or None,
                "goalkeeper": s("Goalkeeper") or None,
                "notes": s("Notes") or None,
            }
    return out


# ---------- 3. understat xG (Premier League only) ----------
def understat_xg():
    xg = {}  # season -> (xg_for, xg_against, matches)
    for yr in range(2014, 2027):
        p = RAW / f"understat-{yr}.json"
        if not p.exists():
            continue
        season = f"{yr}-{yr+1}"
        d = json.loads(p.read_text(encoding="utf-8"))
        xf = xa = 0.0
        n = 0
        for m in d.get("dates", []):
            if not m.get("isResult"):
                continue
            side = m["side"]  # 'h' if MU home
            xf += float(m["xG"][side])
            xa += float(m["xG"]["a" if side == "h" else "h"])
            n += 1
        xg[season] = (round(xf, 1), round(xa, 1), n)
    return xg


# ---------- 4. fbref opponent shooting (SoTA, Premier League only) ----------
def shooting_against():
    out = {}  # season -> shots on target against
    for yr in range(2014, 2027):
        season = f"{yr}-{yr+1}"
        p = RAW / f"shooting-against-{season}.json"
        if not p.exists():
            continue
        for heading, header, rows in parse_tables(load_md(p)):
            if "Shooting Against" not in heading or "SoT" not in header:
                continue
            idx = {name: k for k, name in enumerate(header)}
            for r in rows:
                if "Manchester Utd" not in strip_md(r[0]):
                    continue
                out[season] = num(r[idx["SoT"]])
    return out


def build_keepers():
    match_log = []
    per_gk_season = []
    psxg = []
    psxg_per_gk = []

    for p in sorted(RAW.glob("keeper-*.json")):
        if not re.match(r"^keeper-\d{4}-\d{4}$", p.stem):
            continue
        season = p.stem.replace("keeper-", "")
        md = json.loads(p.read_text(encoding="utf-8"))["markdown"]
        for heading, header, rows in parse_tables(md):
            if not header or header[0] != "Date":
                continue
            for r in rows:
                if len(r) < len(header):
                    continue
                gfv, gfp = score(r[7])
                gav, gap = score(r[8])
                match_log.append({
                    "season": season,
                    "date": strip_md(r[0]) or None,
                    "time": strip_md(r[1]) or None,
                    "comp": canon_comp(r[2]),
                    "round": strip_md(r[3]) or None,
                    "venue": strip_md(r[5]) or None,
                    "result": strip_md(r[6]) or None,
                    "gf": gfv,
                    "ga": gav,
                    "gfPens": gfp,
                    "gaPens": gap,
                    "opponent": strip_md(r[9]) or None,
                    "sota": num(r[10]),
                    "saves": num(r[12]),
                    "savePct": num(r[13]),
                    "cs": num(r[14]),
                    "pkatt": num(r[15]),
                    "pka": num(r[16]),
                    "pksv": num(r[17]),
                    "pkm": num(r[18]),
                })

    for p in sorted(RAW.glob("keeper-squad-*.json")):
        season = p.stem.replace("keeper-squad-", "")
        md = json.loads(p.read_text(encoding="utf-8"))["markdown"]
        for heading, header, rows in parse_tables(md):
            if not header or header[0] != "Player":
                continue
            for r in rows:
                if len(r) < 23:
                    continue
                per_gk_season.append({
                    "season": season,
                    "player": strip_md(r[0]) or None,
                    "nation": strip_md(r[1]) or None,
                    "age": num(r[3]),
                    "mp": num(r[4]),
                    "starts": num(r[5]),
                    "min": num(r[6]),
                    "nineties": num(r[7]),
                    "ga": num(r[8]),
                    "ga90": num(r[9]),
                    "sota": num(r[10]),
                    "saves": num(r[11]),
                    "savePct": num(r[12]),
                    "w": num(r[13]),
                    "d": num(r[14]),
                    "l": num(r[15]),
                    "cs": num(r[16]),
                    "csPct": num(r[17]),
                    "pkatt": num(r[18]),
                    "pka": num(r[19]),
                    "pksv": num(r[20]),
                    "pkm": num(r[21]),
                    "pkSavePct": num(r[22]),
                })

    for p in sorted(RAW.glob("keeperadv-*.json")):
        season = p.stem.replace("keeperadv-", "")
        d = json.loads(p.read_text(encoding="utf-8"))
        for heading, header, rows in parse_tables(d["markdown_squads"]):
            if not header or header[0] != "Squad":
                continue
            for r in rows:
                if len(r) < len(header):
                    continue
                if strip_md(r[0]) != "Manchester Utd":
                    continue
                psxg.append({
                    "season": season,
                    "nineties": num(r[2]),
                    "ga": num(r[3]),
                    "pka": num(r[4]),
                    "psxg": num(r[8]),
                    "psxgPerSot": num(r[9]),
                    "psxgPlusMinus": num(r[10]),
                    "psxgPer90": num(r[11]),
                    "opa": num(r[25]),
                    "opaPer90": num(r[26]),
                    "avgDistance": num(r[27]),
                })
        for heading, header, rows in parse_tables(d["markdown_players"]):
            if not header or header[0] != "Rk":
                continue
            for r in rows:
                if len(r) < len(header):
                    continue
                if strip_md(r[4]) != "Manchester Utd":
                    continue
                psxg_per_gk.append({
                    "season": season,
                    "player": strip_md(r[1]) or None,
                    "nation": strip_md(r[2]) or None,
                    "age": num(r[5]),
                    "nineties": num(r[7]),
                    "ga": num(r[8]),
                    "psxg": num(r[13]),
                    "psxgPerSot": num(r[14]),
                    "psxgPlusMinus": num(r[15]),
                })

    legacy_path = ROOT / "data" / "man-utd-psxg-legacy.json"
    if legacy_path.exists():
        legacy = json.loads(legacy_path.read_text(encoding="utf-8"))
        legacy_seasons = {s["season"]: s for s in legacy.get("seasons", [])}
        for row in psxg:
            seed = legacy_seasons.get(row["season"])
            if not seed:
                continue
            row["psxg"] = seed["psxg"]
            row["ga"] = seed["ga"]
            row["pka"] = seed["pka"]
            row["psxgPlusMinus"] = round(
                seed["psxg"] - (row["ga"] - (row["pka"] or 0)), 1)
            row["psxgSource"] = "legacy"

        for entry in legacy.get("perGk", []):
            psxg_per_gk.append(dict(entry))

    return {
        "matchLog": match_log,
        "perGkSeason": per_gk_season,
        "psxg": psxg,
        "psxgPerGk": psxg_per_gk,
    }


def first_table(md: str):
    """Return (header, rows) for the first markdown table in md."""
    for heading, header, rows in parse_tables(md):
        return header, rows
    return [], []


def _norm_name(name: str) -> str:
    return (
        unicodedata.normalize("NFKD", name)
        .encode("ascii", "ignore")
        .decode()
        .lower()
        .strip()
    )


def _is_player_name(name: str) -> bool:
    if not name:
        return False
    if re.search(r"\b(squad|total|opponent)\b", name, re.I):
        return False
    return True


def build_players():
    out = {"seasons": {}, "latest": ""}

    for p in sorted(RAW.glob("players-*.json")):
        m = re.match(r"^players-(\d{4}-\d{4})$", p.stem)
        if not m:
            continue
        season = m.group(1)
        raw = json.loads(p.read_text(encoding="utf-8"))
        if raw.get("metadata", {}).get("season"):
            season = raw["metadata"]["season"]
        source_url = raw.get("metadata", {}).get("sourceURL")

        std_header, std_rows = first_table(raw.get("markdown_standard", ""))
        shoot_header, shoot_rows = first_table(raw.get("markdown_shooting", ""))
        time_header, time_rows = first_table(raw.get("markdown_playingTime", ""))

        if not std_header or std_header[0] != "Player":
            print(f"WARN: no standard table for {season}", file=sys.stderr)
            continue

        std_idx = {}
        for k, name in enumerate(std_header):
            if name not in std_idx:
                std_idx[name] = k
        shoot_idx = {name: k for k, name in enumerate(shoot_header)} if shoot_header else {}
        time_idx = {name: k for k, name in enumerate(time_header)} if time_header else {}

        def cell(row, idx):
            if row is None or idx is None or idx >= len(row):
                return ""
            return row[idx]

        def num_int(row, idx):
            v = num(cell(row, idx))
            return None if v is None else int(v)

        shoot_by = {}
        for r in shoot_rows:
            if len(r) < len(shoot_header) or not r[0].strip():
                continue
            shoot_by[_norm_name(strip_md(r[0]))] = r

        time_by = {}
        for r in time_rows:
            if len(r) < len(time_header) or not r[0].strip():
                continue
            time_by[_norm_name(strip_md(r[0]))] = r

        players = []
        for r in std_rows:
            if len(r) < len(std_header):
                continue
            name = strip_md(r[0])
            if not _is_player_name(name):
                continue
            pos = strip_md(cell(r, std_idx.get("Pos")))
            if not pos:
                continue

            age = num(cell(r, std_idx.get("Age")))
            if age is not None:
                age = int(age)

            shoot = shoot_by.get(_norm_name(name))
            time = time_by.get(_norm_name(name))

            player = {
                "player": name,
                "nation": strip_md(cell(r, std_idx.get("Nation"))) or None,
                "pos": pos,
                "age": age,
                "mp": num_int(r, std_idx.get("MP")),
                "starts": num_int(r, std_idx.get("Starts")),
                "min": num_int(r, std_idx.get("Min")),
                "nineties": num(cell(r, std_idx.get("90s"))),
                "gls": num_int(r, std_idx.get("Gls")),
                "ast": num_int(r, std_idx.get("Ast")),
                "gPlusA": num_int(r, std_idx.get("G+A")),
                "gMinusPk": num_int(r, std_idx.get("G-PK")),
                "pk": num_int(r, std_idx.get("PK")),
                "pkatt": num_int(r, std_idx.get("PKatt")),
                "crdY": num_int(r, std_idx.get("CrdY")),
                "crdR": num_int(r, std_idx.get("CrdR")),
                "sh": num_int(shoot, shoot_idx.get("Sh")),
                "sot": num_int(shoot, shoot_idx.get("SoT")),
                "sotPct": num(cell(shoot, shoot_idx.get("SoT%"))),
                "gPerSh": num(cell(shoot, shoot_idx.get("G/Sh"))),
                "gPerSot": num(cell(shoot, shoot_idx.get("G/SoT"))),
                "minsPerStart": num(cell(time, time_idx.get("Mn/Start"))),
                "ppm": num(cell(time, time_idx.get("PPM"))),
            }
            players.append(player)

        out["seasons"][season] = {"players": players, "sourceURL": source_url}

    if out["seasons"]:
        out["latest"] = sorted(out["seasons"].keys())[-1]

    return out


def main():
    ml = matchlog_stats()
    hist = history_rows()
    xg = understat_xg()
    sota = shooting_against()
    keepers = build_keepers()
    players = build_players()

    keys = set(hist) | set(ml)
    rows = []
    mismatches = []
    for (season, comp) in sorted(keys, key=lambda k: (k[0], COMP_ORDER.index(k[1]) if k[1] in COMP_ORDER else 99)):
        h = hist.get((season, comp))
        a = ml.get((season, comp))
        if h is None:
            h = dict(season=season, competition=comp, squad=None, rank=None, mp=a["mp"], w=a["w"],
                     d=a["d"], l=a["l"], gf=a["gf"], ga=a["ga"], gd=a["gf"] - a["ga"],
                     pts=3 * a["w"] + a["d"], attendance=None, topScorer=None, goalkeeper=None,
                     notes=None)
        elif a:
            # Match logs are match-level truth; fbref history occasionally
            # records shootout games differently. Prefer matchlog results.
            for k_h, k_a in (("mp", "mp"), ("w", "w"), ("d", "d"), ("l", "l"), ("gf", "gf"), ("ga", "ga")):
                if h[k_h] != a[k_a]:
                    mismatches.append((season, comp, k_h, h[k_h], a[k_a]))
                    h[k_h] = a[k_a]
            h["gd"] = h["gf"] - h["ga"]
            h["pts"] = 3 * h["w"] + h["d"]
        row = dict(h)
        row["cs"] = a["cs"] if a else None
        row["ptsPerMp"] = round(row["pts"] / row["mp"], 2) if row["mp"] else None
        if comp == "Premier League" and season in xg:
            xf, xa, n = xg[season]
            row["xg"], row["xga"], row["xgd"] = xf, xa, round(xf - xa, 1)
        else:
            row["xg"] = row["xga"] = row["xgd"] = None
        row["sota"] = sota.get(season) if comp == "Premier League" else None
        rows.append(row)

    # All Competitions aggregate per season
    all_rows = []
    for season in SEASONS:
        comp_rows = [r for r in rows if r["season"] == season]
        if not comp_rows:
            continue
        mp = sum(r["mp"] for r in comp_rows)
        w = sum(r["w"] for r in comp_rows)
        d = sum(r["d"] for r in comp_rows)
        l = sum(r["l"] for r in comp_rows)
        gf = sum(r["gf"] for r in comp_rows)
        ga = sum(r["ga"] for r in comp_rows)
        cs_vals = [r["cs"] for r in comp_rows if r["cs"] is not None]
        pts = 3 * w + d
        all_rows.append(dict(season=season, competition="All Competitions", squad=None,
                             rank=None, mp=mp, w=w, d=d, l=l, gf=gf, ga=ga, gd=gf - ga,
                             pts=pts, ptsPerMp=round(pts / mp, 2) if mp else None,
                             xg=None, xga=None, xgd=None, sota=None,
                             cs=sum(cs_vals) if len(cs_vals) == len(comp_rows) else (sum(cs_vals) if cs_vals else None),
                             attendance=None, topScorer=None, goalkeeper=None, notes=None))
    rows.extend(all_rows)

    rows.sort(key=lambda r: (r["season"], COMP_ORDER.index(r["competition"]) if r["competition"] in COMP_ORDER else 99))

    out_csv = ROOT / "data" / "man-utd-seasons.csv"
    cols = ["season", "competition", "squad", "rank", "mp", "w", "d", "l", "gf", "ga",
            "gd", "pts", "ptsPerMp", "xg", "xga", "xgd", "sota", "cs", "attendance",
            "topScorer", "goalkeeper", "notes"]
    with out_csv.open("w", newline="", encoding="utf-8") as f:
        wcsv = csv.DictWriter(f, fieldnames=cols)
        wcsv.writeheader()
        for r in rows:
            wcsv.writerow({k: ("" if r.get(k) is None else r.get(k)) for k in cols})

    (ROOT / "data" / "man-utd-seasons.json").write_text(
        json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")

    (ROOT / "data" / "man-utd-keepers.json").write_text(
        json.dumps(keepers, ensure_ascii=False, indent=1), encoding="utf-8")

    (ROOT / "data" / "man-utd-players.json").write_text(
        json.dumps(players, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"rows: {len(rows)}  seasons: {len(set(r['season'] for r in rows))}")
    print(f"keepers: matchLog={len(keepers['matchLog'])}, "
          f"perGkSeason={len(keepers['perGkSeason'])}, "
          f"psxg={len(keepers['psxg'])}, psxgPerGk={len(keepers['psxgPerGk'])}")
    if mismatches:
        print("history vs matchlog mismatches:")
        for m in mismatches:
            print("  ", m)
    for s in SEASONS:
        comps = [r["competition"] for r in rows if r["season"] == s and r["competition"] != "All Competitions"]
        print(s, comps)

    if players.get("latest") and players["seasons"].get(players["latest"]):
        sample = next(
            (p for p in players["seasons"][players["latest"]]["players"] if p["player"] == "Bruno Fernandes"),
            None,
        )
        if sample:
            print(f"sample player: {sample['player']}: MP {sample['mp']}, Gls {sample['gls']}, Ast {sample['ast']}")


if __name__ == "__main__":
    main()
