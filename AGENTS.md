<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# EPL multi-club analytics dashboard

Forked from the Man Utd-only dashboard. Covers every club that played in the
Premier League in seasons 2014-2015 .. 2026-2027 (13 seasons; 2026-27 in
progress). Only a club's PL seasons are in scope — Championship seasons skipped.

## Layout
- `data/clubs.json` — club registry: `{slug, name, fbrefId, fbrefSlug, seasons[], understatName, capologySlug, color}`.
- `data/raw/league/{season}/` — league-level scrapes: `table.json` (PL stats/standings page, includes squad IDs), `fixtures.json` (league Scores & Fixtures), `keeperadv.json`, `understat.json` (all teams' match xG).
- `data/raw/clubs/{slug}/{season}/` — per-club scrapes: `schedule.json`, `shooting.json`, `keeper.json`, `misc.json`, `players.json`, `keeper-squad.json`, `capology.json`. Every file carries `metadata.sourceURL`.
- `data/raw/clubs/man-utd/` — migrated from the old project; has extra types not
  in the standard layout: `understat.json` (CLUB team-page data, not league),
  `shooting-against.json`, `keeper-matchlog.json` (markdown dup of keeper.json),
  `history.json`. See `scripts/scrape/migration-log.txt`.
- `scripts/scrape/` — Playwright scraper (`run.py`), resumable, driven by `data/clubs.json`.
- `scripts/` — legacy Man Utd build scripts (point at old paths; being refactored in a later phase).

## Scraping fbref (Cloudflare 403 on bots)
- Raw HTTP/XHR fetch fails. Use Playwright: `page.goto()` one fbref page, wait
  ~8s if a "Just a moment..." challenge appears, then same-origin
  `fetch(url, {credentials:'include'})` inside `page.evaluate` works for all
  fbref URLs (Cloudflare cookie already set). Parse with DOMParser in-page or in Python.
- URL patterns:
  - Schedule: `https://fbref.com/en/squads/{id}/{season}/matchlogs/all_comps/schedule/{Club}-Scores-and-Fixtures-All-Competitions` → `{markdown, metadata:{sourceURL}}`
  - Stat matchlogs: same but `/all_comps/{shooting|keeper|misc}/` and slug `{Club}-Match-Logs-All-Competitions` → `{tables:[{label,columns,rows}], metadata}` with labels "For {Club}" / "Against {Club}".
  - Squad stats (players / keeper-squad): `https://fbref.com/en/squads/{id}/{season}/all_comps/{Club}-Stats-All-Competitions` (current season can use `/en/squads/{id}/{Club}-Stats`).
  - History: `https://fbref.com/en/squads/{id}/history/{Club}-Stats-and-History`
  - League table: `https://fbref.com/en/comps/9/{season}/{season}-Premier-League-Stats`
  - League fixtures: `https://fbref.com/en/comps/9/{season}/schedule/{season}-Premier-League-Scores-and-Fixtures`
  - League keeperadv: `https://fbref.com/en/comps/9/{season}/keepersadv/Premier-League-Stats` → `{markdown_squads, markdown_players, metadata}`
- Capology: `https://www.capology.com/club/{capologySlug}/salaries/{season}/` → `{markdown, metadata}`. Capology wages are ESTIMATES, not official.
- Understat: `https://understat.com/league/EPL/{startYear}` — data lives in
  inline `<script>` vars (`datesData`, `playersData`, `statisticsData` /
  `teamsData`), JSON-encoded with hex escapes; fetch page HTML and extract.

## Gotchas
- Console is cp1252 — use `python -X utf8` when printing scraped text.
- History markdown bolds title-winning ranks (`**1st**`) — strip `*` when parsing.
- UEFA Cup is canonicalized to "Europa League" (same competition, renamed).
- Old seasons have empty cells for many stat columns (fbref coverage) — rows are
  kept verbatim; UI renders blanks as "—".
- fbref history table vs matchlog occasionally disagree (e.g. shootout legs
  counted as W vs D).
- fbref squad display names: "Manchester Utd" (fbref) vs "Manchester United"
  (understat/capology) — `data/clubs.json` holds the per-source names.

## fbref removed PSxG site-wide
keeper_adv tables exist but PSxG/PSxG+/- sweeper/passing cells are blank in DOM —
Opta feed pulled ~2025. `data/man-utd-psxg-legacy.json` is a MAN UTD ONLY seed
from an old Google Sheet (2017-18+, PL only); other clubs have no PSxG source.
Per-match PSxG is not available anywhere post-removal — don't promise it.

## Coverage limits (fbref's, not bugs)
- Domestic cups (FA Cup, League/EFL Cup) + Charity/Community Shield only exist on
  fbref from ~2014-15 (partially) / 2016-17 (full). Older seasons = league + Europe only.
- xG only from Understat, 2014-15 onward, Premier League only. Null elsewhere.

## Hand-maintained files
- `data/man-utd-squad.json` — wages/contracts for Man Utd ONLY, hand-maintained
  from user's sheet. Edit JSON, don't regenerate. No equivalent exists for
  other clubs (capology.json scrapes are the fallback).

## Display rules
- **ทศนิยม 2 ตำแหน่งเท่านั้น** — all displayed decimals (per-match stats, xG, %, deltas) use exactly 2 decimal places; rounding is fine. Default `dec = 2` in `src/lib/format.ts`. Integers stay integers.
