"""Parse Capology salary scrapes (markdown) into data/man-utd-salaries.json.

Input: firecrawl tool outputs saved under the temp overflow dir, one JSON file
per season containing {"markdown": ..., "metadata": {...}}.
Writes data/raw/capology-<season>.json and data/man-utd-salaries.json.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "man-utd-salaries.json"
OVERFLOW = Path(r"C:\Users\DELL\AppData\Local\Temp\devin.exe-overflows")

# season -> overflow file id holding the firecrawl markdown response
FILES = {
    "2016-2017": "a34a600c",
    "2017-2018": "ff159b1a",
    "2018-2019": "e98e0e3a",
    "2019-2020": "6ccdce7e",
    "2020-2021": "845812a7",
    "2021-2022": "086f3c14",
    "2022-2023": "e23e3d01",
    "2023-2024": "04465d27",
    "2024-2025": "3c3d4e20",
    "2025-2026": "21742c6c",
}
BASE = "https://www.capology.com/club/manchester-united/salaries"
NAME_RE = re.compile(r"flags/[^)]*\)([^\]]+)\]")
MONEY_RE = re.compile(r"^-?\d+(\.\d+)?$")


def money(cell: str):
    c = cell.replace("£", "").replace("€", "").replace("$", "").replace(",", "").strip()
    return float(c) if MONEY_RE.match(c) else None


def num_from(text: str, pattern: str):
    m = re.search(pattern, text)
    return int(m.group(1).replace(",", "")) if m else None


def parse_season(md: str) -> dict:
    summary = {
        "grossYearly": num_from(md, r"Salaries for the [\d-]+ Season was £([\d,]+)"),
        "grossWeekly": num_from(md, r"or £([\d,]+) per week"),
        "grossTotalYearly": None,
        "avgTotalYearly": None,
        "players": None,
        "withSalary": None,
    }
    # highlights: values appear as "# £ X" lines after headers
    hl = re.findall(r"# £ ([\d,]+)", md)
    if len(hl) >= 3:
        summary["grossWeekly"] = int(hl[0].replace(",", ""))
        summary["grossYearly"] = int(hl[1].replace(",", ""))
        summary["grossTotalYearly"] = int(hl[2].replace(",", ""))
    m = re.search(r"Avg\. Total Salary P/Y\s+(\d+)/(\d+) Available Players\s+# £ ([\d,]+)", md)
    if m:
        summary["withSalary"] = int(m.group(1))
        summary["players"] = int(m.group(2))
        summary["avgTotalYearly"] = int(m.group(3).replace(",", ""))

    rows = re.findall(r"(\| \[!\[\]\([^)]*\)[^\n]+)", md)
    cells = []
    for r in rows:
        cells.extend(c.strip() for c in r.strip().strip("|").split("|"))

    players = []
    i = 0
    while i < len(cells):
        c = cells[i]
        if "flags/" not in c or not NAME_RE.search(c):
            i += 1
            continue
        # collect this player's cells until next flag cell
        j = i + 1
        while j < len(cells) and "flags/" not in cells[j] and cells[j] != "Total":
            j += 1
        block = cells[i:j]
        i = j
        # block: [name, verified-icon, w, y, bonus, total, (adj), status, pos, age, country, ...]
        b = block[1:]
        verified = b and "verified-green" in b[0]
        nums = [k for k, x in enumerate(b) if money(x) is not None or x == "-"]
        status_i = next((k for k, x in enumerate(b) if x in ("Active", "Inactive", "Loan")), None)
        p = {
            "name": NAME_RE.search(block[0]).group(1).strip(),
            "verified": bool(verified),
            "weeklyGross": None, "yearlyGross": None, "bonusYearly": None,
            "totalYearly": None, "adjTotalYearly": None,
            "status": b[status_i] if status_i is not None else None,
            "pos": None, "posDetail": None, "age": None, "country": None,
        }
        if status_i is not None:
            mons = [money(x) for x in b[1:status_i]]
            if len(mons) >= 4:
                p["weeklyGross"], p["yearlyGross"], p["bonusYearly"], p["totalYearly"] = mons[:4]
            if len(mons) >= 5:
                p["adjTotalYearly"] = mons[4]
            tail = b[status_i + 1:]
            tail = [x for x in tail if x and x != "\\n"]
            if len(tail) >= 3:
                p["pos"], p["age"], p["country"] = tail[0], money(tail[1]), tail[2]
            elif len(tail) == 2:
                p["pos"], p["age"] = tail[0], money(tail[1])
            elif len(tail) == 1:
                p["pos"] = tail[0]
        players.append(p)
    return {"summary": summary, "players": players}


def main():
    seasons = {}
    # 2013-14 .. 2015-16 came back as firecrawl JSON extracts
    for sid, season in [("26a6f484", "2013-2014"), ("d8edd751", "2014-2015"), ("5f236ef5", "2015-2016")]:
        data = json.loads((OVERFLOW / sid / "content.txt").read_text(encoding="utf8"))
        j = data["json"] if "json" in data else data
        RAW.joinpath(f"capology-{season}.json").write_text(
            json.dumps({"json": j, "metadata": {"sourceURL": f"{BASE}/{season}/"}}, ensure_ascii=False), encoding="utf8")
        players = [{
            "name": p.get("name"), "verified": False,
            "weeklyGross": p.get("weeklyGross"), "yearlyGross": p.get("yearlyGross"),
            "bonusYearly": p.get("bonusYearly"), "totalYearly": p.get("totalYearly"),
            "adjTotalYearly": None, "status": p.get("status"),
            "pos": p.get("pos"), "posDetail": p.get("posDetail"),
            "age": p.get("age"), "country": p.get("country"),
        } for p in j.get("players", [])]
        seasons[season] = {
            "summary": {
                "grossWeekly": j.get("grossWeekly"), "grossYearly": j.get("grossYearly"),
                "grossTotalYearly": j.get("grossTotalYearly"), "avgTotalYearly": None,
                "players": len(players), "withSalary": len(players),
            },
            "players": players,
        }

    for season, sid in FILES.items():
        data = json.loads((OVERFLOW / sid / "content.txt").read_text(encoding="utf8"))
        md = data["markdown"]
        RAW.joinpath(f"capology-{season}.json").write_text(
            json.dumps({"markdown": md, "metadata": {"sourceURL": f"{BASE}/{season}/"}}, ensure_ascii=False), encoding="utf8")
        seasons[season] = parse_season(md)

    # 2026-27 already parsed into the existing file; keep its richer schema
    cur = json.loads(OUT.read_text(encoding="utf8"))
    if "seasons" in cur:
        seasons.update(cur["seasons"])
    else:
        seasons[cur["season"]] = {"summary": cur["summary"], "players": cur["players"]}

    out = {
        "club": "Manchester United",
        "source": BASE + "/",
        "currency": "GBP",
        "disclaimer": "All salaries are estimates and do not represent official figures.",
        "seasons": dict(sorted(seasons.items())),
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf8")
    for s, d in out["seasons"].items():
        print(s, len(d["players"]), "players", d["summary"]["grossYearly"])

    # SquadData-shaped output for the dashboard (latest season at top level)
    def to_squad_player(p: dict) -> dict:
        pos = {"K": "G"}.get(p.get("pos") or "", p.get("pos"))
        detail = p.get("posDetail")
        sub = detail if detail and len(detail) <= 3 else None
        exp = p.get("expires")
        m = re.search(r"((?:19|20)\d{2})", exp or "")
        year = m.group(1) if m else None
        status = p.get("status")
        return {
            "name": p.get("name"), "pos": pos, "subPos": sub,
            "age": p.get("age"), "status": status, "country": p.get("country"),
            "weeklyGross": p.get("weeklyGross"), "yearlyGross": p.get("yearlyGross"),
            "bonusYearly": p.get("bonusYearly"), "weeklyNet": None, "yearlyNet": None,
            "signed": p.get("signed"), "expires": year,
            "grossRemaining": p.get("grossRemaining"),
            "onLoan": status == "Loan",
        }

    squad_seasons = {
        s: {"summary": d["summary"], "players": [to_squad_player(p) for p in d["players"]]}
        for s, d in out["seasons"].items()
    }
    latest = sorted(squad_seasons)[-1]
    squad = {
        "updated": latest,
        "source": BASE + "/",
        "players": squad_seasons[latest]["players"],
        "seasons": squad_seasons,
    }
    (ROOT / "data" / "man-utd-squad.json").write_text(
        json.dumps(squad, ensure_ascii=False, indent=1), encoding="utf8")
    print("squad ->", latest, len(squad["players"]), "players")


if __name__ == "__main__":
    main()
