import type { SeasonRow, MatchRow, CompGroup } from './types';

export const EUROPE_COMPS = [
  'Champions League',
  'Europa League',
  'Conference League',
  'UEFA Super Cup',
  'Club World Cup',
];

const COMP_MAP: Record<Exclude<CompGroup, 'all' | 'europe'>, string> = {
  'premier-league': 'Premier League',
  'fa-cup': 'FA Cup',
  'efl-cup': 'EFL Cup',
};

export function seasonShort(season: string): string {
  const [a, b] = season.split('-');
  if (!a || !b) return season;
  return `${a.slice(-2)}/${b.slice(-2)}`;
}

export function winRate(row: SeasonRow): number | null {
  if (!row.mp || row.mp === 0 || row.w == null) return null;
  return row.w / row.mp;
}

export function csRate(row: SeasonRow): number | null {
  if (!row.mp || row.mp === 0 || row.cs == null) return null;
  return row.cs / row.mp;
}

export function avg(rows: SeasonRow[], fn: (r: SeasonRow) => number | null): number | null {
  const values = rows.map(fn).filter((v): v is number => v != null && !Number.isNaN(v));
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function emptySeasonRow(season: string): SeasonRow {
  return {
    season,
    competition: 'Europe',
    rank: null,
    mp: null,
    w: null,
    d: null,
    l: null,
    gf: null,
    ga: null,
    gd: null,
    pts: null,
    ptsPerMp: null,
    xg: null,
    xga: null,
    xgd: null,
    sota: null,
    cs: null,
    attendance: null,
    topScorer: null,
    goalkeeper: null,
    notes: null,
  };
}

function aggregateSeasons(
  source: SeasonRow[],
  predicate: (r: SeasonRow) => boolean,
  label: string,
): SeasonRow[] {
  const bySeason = new Map<string, SeasonRow[]>();
  for (const row of source) {
    if (!predicate(row)) continue;
    const list = bySeason.get(row.season) ?? [];
    list.push(row);
    bySeason.set(row.season, list);
  }

  const seasons = Array.from(bySeason.keys()).sort();
  return seasons.map((season) => {
    const rows = bySeason.get(season) ?? [];
    const base = emptySeasonRow(season);
    base.competition = label;

    let mp = 0;
    let w = 0;
    let d = 0;
    let l = 0;
    let gf = 0;
    let ga = 0;
    let gd = 0;
    let cs = 0;
    let csAllPresent = true;
    let xgSum = 0;
    let xgaSum = 0;
    let xgAllPresent = true;

    for (const r of rows) {
      mp += r.mp ?? 0;
      w += r.w ?? 0;
      d += r.d ?? 0;
      l += r.l ?? 0;
      gf += r.gf ?? 0;
      ga += r.ga ?? 0;
      gd += r.gd ?? 0;
      if (r.cs == null) csAllPresent = false;
      else cs += r.cs;
      if (r.xg == null || r.xga == null) xgAllPresent = false;
      else {
        xgSum += r.xg;
        xgaSum += r.xga;
      }
    }

    base.mp = mp > 0 ? mp : null;
    base.w = mp > 0 ? w : null;
    base.d = mp > 0 ? d : null;
    base.l = mp > 0 ? l : null;
    base.gf = mp > 0 ? gf : null;
    base.ga = mp > 0 ? ga : null;
    base.gd = mp > 0 ? gd : null;
    base.pts = mp > 0 ? w * 3 + d : null;
    base.ptsPerMp = mp > 0 && base.pts != null ? base.pts / mp : null;
    base.cs = csAllPresent && mp > 0 ? cs : null;
    base.xg = xgAllPresent && mp > 0 ? xgSum : null;
    base.xga = xgAllPresent && mp > 0 ? xgaSum : null;
    base.xgd = xgAllPresent && mp > 0 && base.xg != null && base.xga != null ? base.xg - base.xga : null;

    return base;
  });
}

export function rowsForGroup(
  rows: SeasonRow[],
  group: CompGroup,
): SeasonRow[] {
  if (group === 'all') {
    return rows
      .filter((r) => r.competition === 'All Competitions')
      .sort((a, b) => a.season.localeCompare(b.season));
  }

  if (group === 'europe') {
    return aggregateSeasons(
      rows,
      (r) => EUROPE_COMPS.includes(r.competition),
      'Europe',
    );
  }

  const target = COMP_MAP[group];
  return rows
    .filter((r) => r.competition === target)
    .sort((a, b) => a.season.localeCompare(b.season));
}

const FBREF_COMP_CANON: Record<string, string> = {
  'Premier League': 'Premier League',
  'FA Cup': 'FA Cup',
  'League Cup': 'EFL Cup',
  'EFL Cup': 'EFL Cup',
  'Champions Lg': 'Champions League',
  'Europa Lg': 'Europa League',
  'UEFA Cup': 'Europa League',
  'Conference Lg': 'Conference League',
  'FA Community Shield': 'Community Shield',
  'Community Shield': 'Community Shield',
  'Super Cup': 'UEFA Super Cup',
  'Club World Cup': 'Club World Cup',
  'Int Champions Cup': 'International Champions Cup',
  'Friendly': 'Friendly',
};

export function canonicalComp(comp: string): string {
  return FBREF_COMP_CANON[comp] ?? comp;
}

export function compInGroup(comp: string, group: CompGroup): boolean {
  const c = canonicalComp(comp);
  if (group === 'all') return c !== 'Friendly';
  if (group === 'europe') return EUROPE_COMPS.includes(c);
  return c === COMP_MAP[group];
}

export function matchesForSeason(
  matches: MatchRow[],
  season: string,
  group: CompGroup,
): MatchRow[] {
  return matches
    .filter((m) => m.season === season && compInGroup(m.competition, group))
    .sort((a, b) => a.date.localeCompare(b.date));
}
