"""Per-type scrape tasks: URL builders + extractors producing raw-file payloads.

Every payload carries metadata.sourceURL. Shapes mirror the migrated man-utd
files so existing parsers keep working:
  schedule/capology/history : {markdown, metadata}
  shooting/keeper/misc      : {tables:[{label,columns,rows}], metadata}
  players                   : {markdown_standard, markdown_shooting,
                               markdown_keeper, markdown_playingTime,
                               markdown_misc, metadata}
  players-comps             : {comps:[{compId, name, sourceURL,
                               markdown_standard, markdown_shooting,
                               markdown_keeper, markdown_playingTime}],
                               metadata}
  keeper-squad              : {markdown, metadata}
  league table              : {markdown, squads, metadata}
  league fixtures           : {markdown, metadata}
  league keeperadv          : {markdown_squads, markdown_players, metadata}
  league understat          : {dates, players, teams, metadata}
"""

import json
import re

from md import (
    EXTRACT_MD_JS,
    EXTRACT_MATCHLOG_JS,
    EXTRACT_SQUADS_JS,
    EXTRACT_TABLES_MD_JS,
    KEEPERADV_JS,
)

FBREF = "https://fbref.com"
UNDERSTAT = "https://understat.com"
CAPOLOGY = "https://www.capology.com"


# ---------------------------------------------------------------- helpers
def _md(session, url, selector=None):
    """Fetch url and serialize `selector` (or body) to markdown."""
    _status, html = session.fetch_retries(url)
    md = session._page.evaluate(EXTRACT_MD_JS, [html, FBREF + "/", selector])
    if not md or not md.strip():
        raise ValueError(f"empty markdown from {url}")
    return {"markdown": md, "metadata": {"sourceURL": url}}


def _club_url(club, season, kind):
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


# ---------------------------------------------------------------- club types
def club_schedule(session, club, season):
    return _md(session, _club_url(club, season, "schedule"))


def club_matchlog(session, club, season, kind):
    url = _club_url(club, season, kind)
    _status, html = session.fetch_retries(url)
    tables = session._page.evaluate(EXTRACT_MATCHLOG_JS, [html, FBREF + "/"])
    if not tables or not any(t["rows"] for t in tables):
        raise ValueError(f"no matchlog tables from {url}")
    return {"tables": tables, "metadata": {"sourceURL": url}}


def club_keeper_squad(session, club, season):
    url = _club_url(club, season, "keeper-squad")
    _status, html = session.fetch_retries(url)
    res = session._page.evaluate(
        EXTRACT_TABLES_MD_JS, [html, FBREF + "/", {"markdown": "table#stats_keeper_combined"}])
    if not res.get("markdown"):
        raise ValueError(f"no keeper table from {url}")
    return {"markdown": res["markdown"], "metadata": {"sourceURL": url}}


def club_players(session, club, season):
    url = _club_url(club, season, "players")
    _status, html = session.fetch_retries(url)
    res = session._page.evaluate(
        EXTRACT_TABLES_MD_JS,
        [html, FBREF + "/", {
            "markdown_standard": "table#stats_standard_combined",
            "markdown_shooting": "table#stats_shooting_combined",
            "markdown_keeper": "table#stats_keeper_combined",
            "markdown_playingTime": "table#stats_playing_time_combined",
            "markdown_misc": "table#stats_misc_combined",
        }],
    )
    if not any(res.values()):
        raise ValueError(f"no player tables from {url}")
    res["metadata"] = {"sourceURL": url}
    return res


def club_players_comps(session, club, season):
    """Per-competition squad pages linked from the all-comps page."""
    url = _club_url(club, season, "players")
    _status, html = session.fetch_retries(url)
    fid, slug = club["fbrefId"], club["fbrefSlug"]
    pat = re.compile(
        rf"/en/squads/{re.escape(fid)}/{re.escape(season)}/c(\d+)/"
        rf"{re.escape(slug)}-Stats-([^\"'#?]+)")
    comps = {}
    for m in re.finditer(pat, html):
        comps[m.group(1)] = m.group(2)
    if not comps:
        raise ValueError(f"no comp links on {url}")
    out = {"comps": [], "metadata": {"sourceURL": url}}
    for comp_id, name in sorted(comps.items(), key=lambda kv: int(kv[0])):
        comp_url = (f"{FBREF}/en/squads/{fid}/{season}/c{comp_id}/"
                    f"{slug}-Stats-{name}")
        _st, chtml = session.fetch_retries(comp_url)
        res = session._page.evaluate(
            EXTRACT_TABLES_MD_JS,
            [chtml, FBREF + "/", {
                "markdown_standard": 'table[id^="stats_standard"]',
                "markdown_shooting": 'table[id^="stats_shooting"]',
                "markdown_keeper": 'table[id^="stats_keeper"]',
                "markdown_playingTime": 'table[id^="stats_playing_time"]',
            }],
        )
        if not res.get("markdown_standard"):
            raise ValueError(f"no standard table on {comp_url}")
        out["comps"].append({
            "compId": comp_id,
            "name": name.replace("-", " "),
            "sourceURL": comp_url,
            **res,
        })
    return out


def club_capology(session, club, season):
    if not club.get("capologySlug"):
        raise ValueError("no capologySlug")
    url = f"{CAPOLOGY}/club/{club['capologySlug']}/salaries/{season}/"
    _status, html = session.fetch_retries(url)
    md = session._page.evaluate(EXTRACT_MD_JS, [html, CAPOLOGY + "/", None])
    if not md or not md.strip():
        raise ValueError(f"empty capology page {url}")
    return {"markdown": md, "metadata": {"sourceURL": url}}


CLUB_TYPES = {
    "schedule": club_schedule,
    "shooting": lambda s, c, y: club_matchlog(s, c, y, "shooting"),
    "keeper": lambda s, c, y: club_matchlog(s, c, y, "keeper"),
    "misc": lambda s, c, y: club_matchlog(s, c, y, "misc"),
    "keeper-squad": club_keeper_squad,
    "players": club_players,
    "players-comps": club_players_comps,
    "capology": club_capology,
}


# ---------------------------------------------------------------- league types
def league_table(session, _club, season):
    url = f"{FBREF}/en/comps/9/{season}/{season}-Premier-League-Stats"
    _status, html = session.fetch_retries(url)
    md = session._page.evaluate(EXTRACT_MD_JS, [html, FBREF + "/", "#content"])
    squads = session._page.evaluate(EXTRACT_SQUADS_JS, html)
    if not squads:
        raise ValueError(f"no squads found on {url}")
    return {"markdown": md, "squads": squads, "metadata": {"sourceURL": url}}


def league_fixtures(session, _club, season):
    url = f"{FBREF}/en/comps/9/{season}/schedule/{season}-Premier-League-Scores-and-Fixtures"
    return _md(session, url)


def league_keeperadv(session, _club, season):
    url = f"{FBREF}/en/comps/9/{season}/keepersadv/Premier-League-Stats"
    _status, html = session.fetch_retries(url)
    res = session._page.evaluate(KEEPERADV_JS, [html, FBREF + "/"])
    if not res.get("markdown_squads") and not res.get("markdown_players"):
        raise ValueError(f"no keeperadv tables from {url}")
    res["metadata"] = {"sourceURL": url}
    return res


def league_understat(session, _club, season):
    year = season.split("-")[0]
    url = f"{UNDERSTAT}/league/EPL/{year}"
    # data is populated by league.min.js XHRs, not present in raw HTML
    session.navigate(url, wait_expr="window.datesData && window.datesData.length")
    data = session._page.evaluate(
        "() => JSON.parse(JSON.stringify({dates: window.datesData,"
        " players: window.playersData, teams: window.teamsData}))")
    if not data.get("dates"):
        raise ValueError(f"no understat dates from {url}")
    data["metadata"] = {"sourceURL": url}
    return data


LEAGUE_TYPES = {
    "table": league_table,
    "fixtures": league_fixtures,
    "keeperadv": league_keeperadv,
    "understat": league_understat,
}


# ---------------------------------------------------------------- understat
def extract_understat_vars(html):
    """Pull JSON.parse('...') blobs out of understat inline scripts."""
    out = {}
    for var, key in [("datesData", "dates"), ("playersData", "players"),
                     ("teamsData", "teams"), ("statisticsData", "statistics")]:
        m = re.search(var + r"\s*=\s*JSON\.parse\('(.*?)'\)", html, re.S)
        if not m:
            continue
        raw = m.group(1)
        try:
            # decode js string escapes (\xNN, \\', \n)
            decoded = bytes(raw, "utf-8").decode("unicode_escape")
            out[key] = json.loads(decoded)
        except Exception:
            try:
                out[key] = json.loads(raw.replace("\\'", "'"))
            except Exception:
                pass
    return out
