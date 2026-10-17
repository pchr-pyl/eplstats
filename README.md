# Manchester United — Season-by-Season Analytics Dashboard

A data-first analytics UI for Manchester United season-by-season performance, built with Next.js 16 (App Router), React 19, TypeScript and Tailwind CSS v4.

## Run locally

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

## How to update data

Replace `data/man-utd-seasons.csv` (or `data/man-utd-seasons.json`) with a new export from fbref's [Manchester United Stats and History](https://fbref.com/en/squads/19538871/history/Manchester-United-Stats-and-History) season-by-competition table.

Expected CSV columns:

`Season`, `Competition`, `LgRank`, `MP`, `W`, `D`, `L`, `GF`, `GA`, `GD`, `Pts`, `Pts/MP`, `xG`, `xGA`, `xGD`, `CS`, `Top Team Scorer`, `Goalkeeper`, `Notes`

The parser accepts either these fbref-style headers or the JSON keys (e.g. `season`, `competition`, `rank`, `ptsPerMp`, `topScorer`). Empty strings become `null` and numeric columns are parsed as numbers.

xG/xGA in the shipped data comes from Understat (Premier League only, 2014-15 onwards). Clean sheets (`CS`) are derived from match logs where available.

## Match-level data

`data/man-utd-matches.json` powers the per-match detail shown when you click a season row in the table. Regenerate it from the raw fbref matchlog dumps under `data/raw/` with:

```bash
python scripts/build_matches.py
```

Columns follow fbref's "Scores & Fixtures" log: `date`, `competition`, `round`, `venue`, `result`, `gf`/`ga` (plus `gfPens`/`gaPens` for shoot-outs), `opponent`, `possession`, `attendance`, `captain`, `formation`, `oppFormation`, `referee`, `notes`, and `xg`/`xga` merged from Understat where available (Premier League, 2014-15+).

## Deploy

Deploy with Vercel or any Next.js-compatible host:

```bash
vercel
```
