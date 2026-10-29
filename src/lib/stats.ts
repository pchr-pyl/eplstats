import type {
  SeasonRow,
  MatchRow,
  CompGroup,
  TeamStatsBySeason,
  TeamCompRow,
  TeamGroupRow,
  PlayerSeasonStats,
  GkSeasonRow,
} from './types';

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
  'Conf Lg': 'Conference League',
  'Conference Lg': 'Conference League',
  'FA Community Shield': 'Community Shield',
  'Community Shield': 'Community Shield',
  'Super Cup': 'UEFA Super Cup',
  'Club World Cup': 'Club World Cup',
  'Int Champions Cup': 'International Champions Cup',
  'FIFA Club World Cup': 'Club World Cup',
  'UEFA Champions League': 'Champions League',
  'UEFA Europa League': 'Europa League',
  'UEFA Conference League': 'Conference League',
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

export function teamStatsForGroup(
  stats: TeamStatsBySeason,
  group: CompGroup,
): TeamGroupRow[] {
  const sumNullable = (
    comps: TeamCompRow[],
    key: keyof TeamCompRow,
  ): number | null => {
    let total = 0;
    let any = false;
    for (const r of comps) {
      const v = r[key];
      if (typeof v === 'number') {
        total += v;
        any = true;
      }
    }
    return any ? Math.round(total * 100) / 100 : null;
  };

  const out: TeamGroupRow[] = [];
  for (const season of Object.keys(stats).sort()) {
    const comps = Object.entries(stats[season] ?? {})
      .filter(([comp]) => compInGroup(comp, group))
      .map(([, r]) => r);
    if (!comps.length) continue;
    const row: TeamGroupRow = {
      season,
      mp: comps.reduce((a, r) => a + r.mp, 0),
      gls: sumNullable(comps, 'gls'),
      ga: sumNullable(comps, 'ga'),
      sh: sumNullable(comps, 'sh'),
      sot: sumNullable(comps, 'sot'),
      pk: sumNullable(comps, 'pk'),
      pkatt: sumNullable(comps, 'pkatt'),
      shN: comps.reduce((a, r) => a + r.shN, 0),
      shA: sumNullable(comps, 'shA'),
      shAN: comps.reduce((a, r) => a + r.shAN, 0),
      sota: sumNullable(comps, 'sota'),
      saves: sumNullable(comps, 'saves'),
      cs: sumNullable(comps, 'cs'),
      kN: comps.reduce((a, r) => a + r.kN, 0),
    };
    if (row.mp === 0) continue;
    out.push(row);
  }
  return out;
}

const PLAYER_SUM_KEYS = [
  'mp', 'starts', 'min', 'nineties', 'gls', 'ast', 'gPlusA', 'gMinusPk',
  'pk', 'pkatt', 'crdY', 'crdR', 'sh', 'sot',
] as const;

const GK_SUM_KEYS = [
  'mp', 'starts', 'min', 'nineties', 'ga', 'sota', 'saves',
  'w', 'd', 'l', 'cs', 'pkatt', 'pka', 'pksv', 'pkm',
] as const;

function addNum(a: number | null, b: number | null): number | null {
  if (a == null && b == null) return null;
  return (a ?? 0) + (b ?? 0);
}

export function mergedPlayersForGroup(
  byComp: Record<string, PlayerSeasonStats[]> | undefined,
  group: CompGroup,
): PlayerSeasonStats[] {
  const merged = new Map<string, PlayerSeasonStats>();
  const ppmAcc = new Map<string, { num: number; den: number }>();
  for (const [comp, rows] of Object.entries(byComp ?? {})) {
    if (!compInGroup(comp, group)) continue;
    for (const r of rows) {
      const m = merged.get(r.player);
      if (!m) {
        merged.set(r.player, { ...r });
        if (r.ppm != null && r.mp != null)
          ppmAcc.set(r.player, { num: r.ppm * r.mp, den: r.mp });
        continue;
      }
      for (const k of PLAYER_SUM_KEYS) m[k] = addNum(m[k], r[k]);
      m.sotPct = m.sh ? ((m.sot ?? 0) / m.sh) * 100 : null;
      m.gPerSh = m.sh ? (m.gMinusPk ?? 0) / m.sh : null;
      m.gPerSot = m.sot ? (m.gMinusPk ?? 0) / m.sot : null;
      if (r.ppm != null && r.mp != null) {
        const a = ppmAcc.get(r.player) ?? { num: 0, den: 0 };
        a.num += r.ppm * r.mp;
        a.den += r.mp;
        ppmAcc.set(r.player, a);
      }
      m.minsPerStart = null;
    }
  }
  for (const [player, m] of merged) {
    const a = ppmAcc.get(player);
    if (a && a.den > 0 && Object.keys(byComp ?? {}).filter((c) => compInGroup(c, group)).length > 1)
      m.ppm = a.num / a.den;
  }
  return Array.from(merged.values());
}

export function mergedGkRows(
  rows: (GkSeasonRow & { comp?: string })[],
  group: CompGroup,
): GkSeasonRow[] {
  const merged = new Map<string, GkSeasonRow & { comp?: string }>();
  for (const r of rows) {
    if (r.comp != null && !compInGroup(r.comp, group)) continue;
    const key = `${r.season}|${r.player}`;
    const m = merged.get(key);
    if (!m) {
      merged.set(key, { ...r });
      continue;
    }
    for (const k of GK_SUM_KEYS) m[k] = addNum(m[k], r[k]);
    m.savePct = m.sota ? ((m.saves ?? 0) / m.sota) * 100 : null;
    m.ga90 = m.nineties ? (m.ga ?? 0) / m.nineties : null;
    m.csPct = m.mp ? ((m.cs ?? 0) / m.mp) * 100 : null;
    m.pkSavePct = m.pkatt ? ((m.pksv ?? 0) / m.pkatt) * 100 : null;
  }
  return Array.from(merged.values());
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
