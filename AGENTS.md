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
  Capology's Cloudflare NEVER clears in Playwright (challenge loops) — scrape it
  via the firecrawl MCP tool (`firecrawl_scrape`, formats:["markdown"],
  onlyMainContent:false), same as the old project did. `run.py`'s capology
  handler will fail through the browser.
- Understat: `https://understat.com/league/EPL/{startYear}` — data is populated
  by `league.min.js` XHRs, NOT in raw HTML. `session.navigate()` the page then
  read `window.datesData / playersData / teamsData` (league page has no
  `statisticsData`; team pages do).

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

## Multi-club build + UI (2026-10)
- Build: `python -X utf8 scripts/build/build_all.py [--club SLUG]` → writes
  `data/built/{slug}/{matches,seasons,keepers,players,teamstats,squad}.json`
  (`teamstats.json` = `{season: {rawFbrefComp: {mp,gls,ga,sh,sot,pk,pkatt,shN,shA,shAN,sota,saves,cs,kN}}}`
  from matchlogs; client sums comps per CompGroup via `teamStatsForGroup`),
  `public/data/{slug}/matchlogs-{season}.json` and per-season
  `{keepers,squad,players}-{season}.json` (lazy-fetched by keepers/squad tabs),
  `data/built/league.json`,
  `data/built/index.json` (slug,name,color,shortName,nameTh,brandLight,brandDark,
  seasons,latest), `data/built/managers.json`.
- Perf: judge tab-nav speed with `npm run build && npm run serve` (production
  static export on :3002 via `scripts/serve_out.py`, which maps Next's flat
  prefetch filenames like `__next.$d$club.X.__PAGE__.txt` to the on-disk
  directory layout — plain `http.server` 404s them). Dev mode compiles routes
  on first hit — not representative. Shared club data (seasons/matches/managers) ships
  once in the `[club]` layout segment via `useClubData()`; tab pages stay small.
- Verify: `python -X utf8 scripts/build/verify_man_utd.py`.
- Routes: `/` league home, `/{club}[/matches|/attack|/defense|/misc|
  /squad|/managers|/compare]`, `/clubs-compare`. Attack = attack summary +
  shooting matchlog; Defense = team defence + goalkeepers + keeper matchlog
  (old `/shooting`, `/keepers` routes removed). Every club tab has
  `CompetitionTabs` (default 'all'); xG/xGA are PL-only so 'all' shows PL xG. `src/app/[club]` with
  generateStaticParams + `dynamicParams = false`.
- `src/lib/data.ts` reads `data/built/` per club (react cache); club branding via
  ClubProvider + `--club-brand-light/dark` → `--brand` in `.club-theme` (globals.css).
- `data/managers.json` stints (Wikipedia; man-utd has nameTh).
- Legacy `scripts/*.py` + `data/man-utd-*.json` + old `public/data/matchlogs-*.json`
  remain but nothing in `src` imports them.
- Dev: `npm run dev` → http://localhost:3000

## Per-competition player stats (players-comps)
- Raw `data/raw/clubs/{slug}/{season}/players-comps.json` =
  `{comps:[{compId,name,sourceURL,markdown_standard|shooting|keeper|playingTime}]}`
  from `https://fbref.com/en/squads/{id}/{season}/c{compId}/{Club}-Stats-{Comp}`
  (c9 PL, c514 FA Cup, c690 EFL Cup, c8 CL, c19 EL, c882 Conference League).
- Scraped via firecrawl (Playwright CF-blocked): job list `tmp/pc_jobs.py`
  (comps from matches.json), saver `scripts/scrape/players_comps_save.py <overflow content.txt>`.
  `run.py --types players-comps` exists but needs the browser to clear CF.
- Build → `players.json` seasons[].byComp, `keepers.json` perGkComp; client merges
  per CompGroup (`mergedPlayersForGroup`, `mergedGkRows` in src/lib/stats.ts).
- fbref writes Conference League as "Conf Lg" — canonicalized in
  `scripts/build/common.py` COMP_MAP and TS `FBREF_COMP_CANON`.
- Qualifying-only Europa pages have no stats table (5 known gaps) — UI falls back.

## Refreshing the current season
Re-scrape ALL types for every club in the in-progress season (schedule,
shooting, keeper, misc, players, keeper-squad + league table/fixtures/
understat) with maxAge:0 on firecrawl calls, then run build_all.py. Schedules
alone leave stale stat rows.

## Deploy (Cloudflare Pages)
- Project `eplstats` → https://eplstats.pages.dev — git-connected to
  github.com/pchr-pyl/eplstats (public); every push to `main` triggers a
  Cloudflare build (`npm run build`, output `out/`, Node from `.nvmrc`).
- `npm run deploy` = local `next build` + postbuild + `wrangler pages deploy`
  — still works as an immediate manual deploy without pushing.
- postbuild `scripts/flatten_prefetch.mjs` copies the RSC prefetch payload
  dirs (`__next.<seg>/...`) to their flat dot-joined names — static hosts
  can't remap like serve_out.py.
- Free-plan limits: ≤20,000 files, ≤25 MiB per file.
- Cloudflare builds run npm@10 — if you touch package-lock.json, regenerate
  it with `npx npm@10 install --package-lock-only` or `npm ci` fails there.
- Refresh flow: scrape → `python -X utf8 scripts/build/build_all.py` → commit
  + push (auto-deploys) or `npm run deploy` to skip git.

## Feedback + admin (Pages Functions + D1)
- `functions/api/` — Pages Functions served alongside `out/`: `POST /api/feedback`,
  `POST /api/track` (sendBeacon pageviews), `POST /api/admin/login`,
  `GET /api/admin/feedback`, `GET /api/admin/stats`. Files starting `_` are not routed.
- `wrangler.toml` binds D1 `eplstats-feedback` as `DB` (tables: `feedback`,
  `pageviews`; schema in `scripts/schema-feedback.sql`). Applies to both
  git-connected builds and `wrangler pages deploy`.
- `/admin` = static client page (login → Bearer token in sessionStorage).
  Creds default `admin@gmail.com` / `admin123` — override via Pages env vars
  `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_SECRET` (token signing).
- Local test: `wrangler d1 execute eplstats-feedback --local --file=scripts/schema-feedback.sql`
  then `npx wrangler pages dev out`.
