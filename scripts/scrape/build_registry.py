"""Build data/clubs.json from scraped league table.json + understat.json files.

fbrefId -> slug/capologySlug mappings were verified against real pages:
- fbref squads:   data/raw/league/{season}/table.json (squads list w/ ids+urls)
- understat names: data/raw/league/{season}/understat.json (dates[].h/a.title)
- capology slugs: /club/{slug}/ links on capology league salary index pages
  (scraped 2014-15, 2016-17, 2018-19, 2021-22, 2023-24, 2026-27 indexes)

Run: python -X utf8 scripts/scrape/build_registry.py
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"

# fbrefId -> (slug, capologySlug, understatName, color)
# understatName left as title string; asserted present in scraped understat data.
CLUB_MAP = {
    "18bb7c10": ("arsenal", "arsenal", "Arsenal", "#EF0107"),
    "8602292d": ("aston-villa", "aston-villa", "Aston Villa", "#95BFE5"),
    "4ba7cbea": ("bournemouth", "bournemouth", "Bournemouth", "#DA291C"),
    "cd051869": ("brentford", "brentford", "Brentford", "#E30613"),
    "d07537b9": ("brighton", "brighton", "Brighton", "#0057B8"),
    "943e8050": ("burnley", "burnley", "Burnley", "#6C1D45"),
    "75fae011": ("cardiff-city", "cardiff", "Cardiff", "#0070B5"),
    "cff3d9bb": ("chelsea", "chelsea", "Chelsea", "#034694"),
    "f7e3dfe9": ("coventry-city", "coventry", "Coventry", "#059DD9"),
    "47c64c55": ("crystal-palace", "crystal-palace", "Crystal Palace", "#1B458F"),
    "d3fd31cc": ("everton", "everton", "Everton", "#003399"),
    "fd962109": ("fulham", "fulham", "Fulham", "#000000"),
    "f5922ca5": ("huddersfield-town", "huddersfield", "Huddersfield", "#0E63AD"),
    "bd8769d1": ("hull-city", "hull-city", "Hull", "#F18A01"),
    "b74092de": ("ipswich-town", "ipswich-town", "Ipswich", "#3A64A3"),
    "5bfb9659": ("leeds-united", "leeds", "Leeds", "#FFCD00"),
    "a2d435b3": ("leicester-city", "leicester", "Leicester", "#003090"),
    "822bd0ba": ("liverpool", "liverpool", "Liverpool", "#C8102E"),
    "e297cd13": ("luton-town", "luton-town", "Luton", "#F78F1E"),
    "b8fd03ef": ("man-city", "manchester-city", "Manchester City", "#6CABDD"),
    "19538871": ("man-utd", "manchester-united", "Manchester United", "#DA291C"),
    "7f59c601": ("middlesbrough", "middlesbrough", "Middlesbrough", "#E31937"),
    "b2b47a98": ("newcastle-united", "newcastle", "Newcastle United", "#241F20"),
    "1c781004": ("norwich-city", "norwich", "Norwich", "#FFF200"),
    "e4a775cb": ("nottingham-forest", "nottingham-forest", "Nottingham Forest", "#DD0000"),
    "a757999c": ("qpr", "qpr", "Queens Park Rangers", "#1D5BA4"),
    "1df6b87e": ("sheffield-united", "sheffield-united", "Sheffield United", "#EE2737"),
    "33c895d4": ("southampton", "southampton", "Southampton", "#D71920"),
    "17892952": ("stoke-city", "stoke-city", "Stoke", "#E03A3E"),
    "8ef52968": ("sunderland", "sunderland", "Sunderland", "#EB172B"),
    "fb10988f": ("swansea-city", "swansea", "Swansea", "#121212"),
    "361ca564": ("tottenham", "tottenham", "Tottenham", "#132257"),
    "2abfe087": ("watford", "watford", "Watford", "#FBEE23"),
    "60c6b05f": ("west-brom", "west-bromwich", "West Bromwich Albion", "#122F67"),
    "7c21e445": ("west-ham", "west-ham", "West Ham", "#7A263A"),
    "8cec06e1": ("wolves", "wolverhampton", "Wolverhampton Wanderers", "#FDB913"),
}


def display_name(fbref_slug):
    return fbref_slug.replace("-", " ").title()


def main():
    clubs = {}
    for p in sorted(RAW.glob("league/*/table.json")):
        season = p.parent.name
        d = json.loads(p.read_text(encoding="utf-8"))
        for s in d["squads"]:
            c = clubs.setdefault(s["id"], {"seasons": [], "fbrefSlug": None})
            if season not in c["seasons"]:
                c["seasons"].append(season)
            slug = s["url"].rstrip("/").split("/")[-1]
            slug = slug[:-6] if slug.endswith("-Stats") else slug
            c["fbrefSlug"] = slug

    # verify understat names exist in the scraped data
    us_titles = set()
    for p in RAW.glob("league/*/understat.json"):
        d = json.loads(p.read_text(encoding="utf-8"))
        for m in d.get("dates", []):
            us_titles.add(m["h"]["title"])
            us_titles.add(m["a"]["title"])

    missing_map, missing_us = [], []
    out = []
    for fid, info in clubs.items():
        if fid not in CLUB_MAP:
            missing_map.append((fid, info["fbrefSlug"]))
            continue
        slug, capo, us, color = CLUB_MAP[fid]
        if us not in us_titles:
            missing_us.append(us)
            us_val = None
        else:
            us_val = us
        out.append({
            "slug": slug,
            "name": display_name(info["fbrefSlug"]),
            "fbrefId": fid,
            "fbrefSlug": info["fbrefSlug"],
            "seasons": sorted(info["seasons"]),
            "understatName": us_val,
            "capologySlug": capo,
            "color": color,
        })

    out.sort(key=lambda c: c["name"])
    dest = ROOT / "data" / "clubs.json"
    dest.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {len(out)} clubs -> {dest}")
    for m in missing_map:
        print("  NO MAP:", m)
    for m in missing_us:
        print("  understat name not found in data:", m)


if __name__ == "__main__":
    main()
