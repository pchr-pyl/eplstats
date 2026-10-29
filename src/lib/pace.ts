import type { MatchRow, SeasonMatchlogs } from '@/lib/types';
import { compInGroup, canonicalComp } from '@/lib/stats';

export type PaceSide = 'attack' | 'defense';

export type RaceMetric =
  | 'pts'
  | 'gf'
  | 'xg'
  | 'sh'
  | 'sot'
  | 'ga'
  | 'xga'
  | 'shA'
  | 'sotA'
  | 'cs';

export interface RaceDef {
  key: RaceMetric;
  label: string;
  lower: boolean;
  dec: number;
}

export const RACE_DEFS: Record<PaceSide, RaceDef[]> = {
  attack: [
    { key: 'pts', label: 'Pts', lower: false, dec: 0 },
    { key: 'gf', label: 'GF', lower: false, dec: 0 },
    { key: 'xg', label: 'xG', lower: false, dec: 2 },
    { key: 'sh', label: 'Sh', lower: false, dec: 0 },
    { key: 'sot', label: 'SoT', lower: false, dec: 0 },
  ],
  defense: [
    { key: 'pts', label: 'Pts', lower: false, dec: 0 },
    { key: 'ga', label: 'GA', lower: true, dec: 0 },
    { key: 'xga', label: 'xGA', lower: true, dec: 2 },
    { key: 'shA', label: 'ShA', lower: true, dec: 0 },
    { key: 'sotA', label: 'SoTA', lower: true, dec: 0 },
    { key: 'cs', label: 'CS', lower: false, dec: 0 },
  ],
};

export const RACE_BY_KEY: Record<PaceSide, Record<RaceMetric, RaceDef>> = {
  attack: Object.fromEntries(RACE_DEFS.attack.map((d) => [d.key, d])) as Record<
    RaceMetric,
    RaceDef
  >,
  defense: Object.fromEntries(RACE_DEFS.defense.map((d) => [d.key, d])) as Record<
    RaceMetric,
    RaceDef
  >,
};

/** Per-match statline joined by date (PL rows only). */
export interface MatchExtras {
  sh: number | null;
  sot: number | null;
  shA: number | null;
  sotA: number | null;
  saves: number | null;
}

/** date -> extras. */
export type ExtrasMap = Map<string, MatchExtras>;

export interface WinAgg {
  season: string;
  k: number;
  w: number;
  d: number;
  l: number;
  pts: number;
  gf: number;
  ga: number;
  cs: number;
  xg: number;
  xga: number;
  xgN: number;
  sh: number;
  sot: number;
  shN: number;
  /** GF over the shot-covered games only (for G/Sh). */
  shGf: number;
  shA: number;
  shAN: number;
  sotA: number;
  saves: number;
  kN: number;
}

/** Played PL matches (W/D/L + goals), chronological. */
export function playedPl(matches: MatchRow[]): MatchRow[] {
  return matches
    .filter(
      (m) =>
        compInGroup(m.competition, 'premier-league') &&
        (m.result === 'W' || m.result === 'D' || m.result === 'L') &&
        m.gf != null &&
        m.ga != null,
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''),
    );
}

export function bySeason(games: MatchRow[]): Map<string, MatchRow[]> {
  const map = new Map<string, MatchRow[]>();
  for (const m of games) {
    const list = map.get(m.season) ?? [];
    list.push(m);
    map.set(m.season, list);
  }
  return map;
}

const num = (v: string | undefined): number | null => {
  if (v == null || v === '') return null;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
};

function blankExtras(): MatchExtras {
  return { sh: null, sot: null, shA: null, sotA: null, saves: null };
}

function plCols(table: { columns: string[] } | undefined) {
  if (!table) return null;
  const cols = table.columns;
  return { cols, iDate: cols.indexOf('Date'), iComp: cols.indexOf('Comp') };
}

/**
 * Extract PL per-match stats from a season's matchlogs:
 * sh/sot <- shooting.for, shA <- shooting.against, sotA/saves <- keeper.for.
 */
export function extrasFrom(logs: SeasonMatchlogs | null): ExtrasMap {
  const map: ExtrasMap = new Map();
  const get = (date: string) => {
    let e = map.get(date);
    if (!e) {
      e = blankExtras();
      map.set(date, e);
    }
    return e;
  };
  const fill = (
    table: { columns: string[]; rows: string[][] } | undefined,
    assign: (e: MatchExtras, r: string[], cols: string[]) => void,
    needed: string[],
  ) => {
    const meta = plCols(table);
    if (!meta || meta.iDate < 0) return;
    const { cols, iDate, iComp } = meta;
    if (needed.some((c) => cols.indexOf(c) < 0)) return;
    for (const r of table!.rows) {
      if (iComp >= 0 && canonicalComp(r[iComp] ?? '') !== 'Premier League') continue;
      const date = r[iDate] ?? '';
      if (!date) continue;
      assign(get(date), r, cols);
    }
  };

  fill(
    logs?.shooting?.for,
    (e, r, cols) => {
      e.sh = num(r[cols.indexOf('Sh')]);
      e.sot = num(r[cols.indexOf('SoT')]);
    },
    ['Sh', 'SoT'],
  );
  fill(
    logs?.shooting?.against,
    (e, r, cols) => {
      e.shA = num(r[cols.indexOf('Sh')]);
    },
    ['Sh'],
  );
  // keeper columns contain 'GA' twice — indexOf on SoTA/Saves only.
  fill(
    logs?.keeper?.for,
    (e, r, cols) => {
      e.sotA = num(r[cols.indexOf('SoTA')]);
      e.saves = num(r[cols.indexOf('Saves')]);
    },
    ['SoTA', 'Saves'],
  );
  return map;
}

/** Aggregate over the first n games of a season (n > games -> all played). */
export function aggregate(
  season: string,
  games: MatchRow[],
  extras: ExtrasMap | null,
  n: number,
): WinAgg {
  const a: WinAgg = {
    season,
    k: 0,
    w: 0,
    d: 0,
    l: 0,
    pts: 0,
    gf: 0,
    ga: 0,
    cs: 0,
    xg: 0,
    xga: 0,
    xgN: 0,
    sh: 0,
    sot: 0,
    shN: 0,
    shGf: 0,
    shA: 0,
    shAN: 0,
    sotA: 0,
    saves: 0,
    kN: 0,
  };
  for (const m of games.slice(0, n)) {
    a.k += 1;
    if (m.result === 'W') {
      a.w += 1;
      a.pts += 3;
    } else if (m.result === 'D') {
      a.d += 1;
      a.pts += 1;
    } else {
      a.l += 1;
    }
    a.gf += m.gf ?? 0;
    a.ga += m.ga ?? 0;
    if (m.ga === 0) a.cs += 1;
    if (m.xg != null || m.xga != null) a.xgN += 1;
    if (m.xg != null) a.xg += m.xg;
    if (m.xga != null) a.xga += m.xga;
    const e = extras?.get(m.date);
    if (e?.sh != null) {
      a.sh += e.sh;
      a.shN += 1;
      a.shGf += m.gf ?? 0;
    }
    if (e?.sot != null) a.sot += e.sot;
    if (e?.shA != null) {
      a.shA += e.shA;
      a.shAN += 1;
    }
    if (e?.sotA != null) {
      a.sotA += e.sotA;
      a.kN += 1;
    }
    if (e?.saves != null) a.saves += e.saves;
  }
  return a;
}

function gameValue(m: MatchRow, extras: ExtrasMap | null, metric: RaceMetric): number {
  const e = extras?.get(m.date);
  switch (metric) {
    case 'pts':
      return m.result === 'W' ? 3 : m.result === 'D' ? 1 : 0;
    case 'gf':
      return m.gf ?? 0;
    case 'ga':
      return m.ga ?? 0;
    case 'cs':
      return m.ga === 0 ? 1 : 0;
    case 'xg':
      return m.xg ?? 0;
    case 'xga':
      return m.xga ?? 0;
    case 'sh':
      return e?.sh ?? 0;
    case 'sot':
      return e?.sot ?? 0;
    case 'shA':
      return e?.shA ?? 0;
    case 'sotA':
      return e?.sotA ?? 0;
  }
}

/** Cumulative series: index k-1 -> total after k games. */
export function cumSeries(
  games: MatchRow[],
  extras: ExtrasMap | null,
  metric: RaceMetric,
): number[] {
  const out: number[] = [];
  let sum = 0;
  for (const m of games) {
    sum += gameValue(m, extras, metric);
    out.push(Math.round(sum * 100) / 100);
  }
  return out;
}

export function metricOfAgg(a: WinAgg, metric: RaceMetric): number {
  switch (metric) {
    case 'pts':
      return a.pts;
    case 'gf':
      return a.gf;
    case 'ga':
      return a.ga;
    case 'cs':
      return a.cs;
    case 'xg':
      return a.xg;
    case 'xga':
      return a.xga;
    case 'sh':
      return a.sh;
    case 'sot':
      return a.sot;
    case 'shA':
      return a.shA;
    case 'sotA':
      return a.sotA;
  }
}
