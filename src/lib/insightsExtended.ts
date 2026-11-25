import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getLeague, getMatches } from './data';
import { getInsights, type InsightsData, type StatClub } from './insights';

export interface TableInsightRow {
  slug: string;
  rank: number;
  mp: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  cs: number;
  xg: number | null;
  xga: number | null;
  xgd: number | null;
  ppg: number;
  gfPerMp: number;
  gaPerMp: number;
  xgPerMp: number | null;
  xgaPerMp: number | null;
  /** GF - xG (positive = clinical / hot finishing) */
  attLuck: number | null;
  /** xGA - GA (positive = GK/defensive overperformance) */
  defLuck: number | null;
  /** GD - xGD */
  netLuck: number | null;
}

export interface PointsRaceClub {
  slug: string;
  rank: number;
  pts: number;
  series: { mp: number; pts: number; gf: number; ga: number; xg: number | null }[];
}

export interface GoalTimingBucket {
  id: string;
  label: string;
  count: number;
  pct: number;
}

export interface GoalTimingSummary {
  totalGoals: number;
  firstHalf: number;
  secondHalf: number;
  matchesParsed: number;
  buckets: GoalTimingBucket[];
  fastStarters: StatClub[];
  lateSurgeons: StatClub[];
}

export interface PlayerLeaderRow {
  key: string;
  name: string;
  club: string;
  pos: string;
  gls: number;
  ast: number;
  min: number;
  ga90: number | null;
}

export interface MarqueeFixture {
  home: string;
  away: string;
  date: string;
  time: string | null;
  homeRank: number;
  awayRank: number;
  homePts: number;
  awayPts: number;
  homeForm: string;
  awayForm: string;
  homePpgAtHome: number;
  awayPpgAway: number;
  homeGf: number;
  awayGf: number;
  homeGa: number;
  awayGa: number;
}

export interface InsightsExtendedData {
  base: InsightsData;
  table: TableInsightRow[];
  pointsRace: PointsRaceClub[];
  goalTiming: GoalTimingSummary;
  leaders: {
    scorers: PlayerLeaderRow[];
    assisters: PlayerLeaderRow[];
    ga90: PlayerLeaderRow[];
  };
  marquee: MarqueeFixture | null;
  roundSummary: {
    totalGoals: number;
    avgGoals: number;
    homeWins: number;
    draws: number;
    awayWins: number;
  };
}

const PL = 'Premier League';

export function getInsightsExtended(): InsightsExtendedData {
  const base = getInsights();
  const league = getLeague();
  const season = base.season;
  const rawTable = (league[season] ?? []).filter((r) => r.slug);

  const table: TableInsightRow[] = rawTable
    .map((r, i) => {
      const mp = Math.max(0, r.mp ?? 0);
      const div = mp > 0 ? mp : 1;
      const xg = r.xg ?? null;
      const xga = r.xga ?? null;
      const xgd = r.xgd ?? (xg != null && xga != null ? xg - xga : null);
      return {
        slug: r.slug,
        rank: r.rank ?? i + 1,
        mp,
        w: r.w,
        d: r.d,
        l: r.l,
        gf: r.gf,
        ga: r.ga,
        gd: r.gd,
        pts: r.pts,
        cs: r.cs,
        xg,
        xga,
        xgd,
        ppg: mp > 0 ? r.pts / mp : 0,
        gfPerMp: mp > 0 ? r.gf / div : 0,
        gaPerMp: mp > 0 ? r.ga / div : 0,
        xgPerMp: xg != null && mp > 0 ? xg / div : null,
        xgaPerMp: xga != null && mp > 0 ? xga / div : null,
        attLuck: xg != null ? r.gf - xg : null,
        defLuck: xga != null ? xga - r.ga : null,
        netLuck: xgd != null ? r.gd - xgd : null,
      };
    })
    .sort((a, b) => a.rank - b.rank);

  const tableBySlug = new Map(table.map((r) => [r.slug, r]));
  const formBySlug = new Map(base.form.map((f) => [f.slug, f]));
  const vaBySlug = new Map(base.vaSplit.map((v) => [v.slug, v]));

  // ---- Cumulative points race for all 20 clubs ----
  const seenMatchIds = new Set<string>();
  const matchPairs = new Map<string, { homeSlug: string; awaySlug: string }>();

  const pointsRace: PointsRaceClub[] = table.map((row) => {
    const played = getMatches(row.slug)
      .filter((m) => m.season === season && m.competition === PL && m.result != null)
      .sort((a, b) => a.date.localeCompare(b.date));
    let pts = 0;
    let gf = 0;
    let ga = 0;
    let xg: number | null = null;
    const series = played.map((m, idx) => {
      if (m.matchId) {
        seenMatchIds.add(m.matchId);
        const cur = matchPairs.get(m.matchId) ?? { homeSlug: '', awaySlug: '' };
        if (m.venue === 'Home') cur.homeSlug = row.slug;
        else if (m.venue === 'Away') cur.awaySlug = row.slug;
        matchPairs.set(m.matchId, cur);
      }
      pts += m.result === 'W' ? 3 : m.result === 'D' ? 1 : 0;
      gf += m.gf ?? 0;
      ga += m.ga ?? 0;
      if (m.xg != null) xg = (xg ?? 0) + m.xg;
      return { mp: idx + 1, pts, gf, ga, xg };
    });
    return { slug: row.slug, rank: row.rank, pts: row.pts, series };
  });

  // ---- Goal timing distribution from match detail JSONs ----
  const bucketDefs = [
    { id: '0-15', label: "1–15'", max: 15 },
    { id: '16-30', label: "16–30'", max: 30 },
    { id: '31-45', label: "31–45+'", max: 45 },
    { id: '46-60', label: "46–60'", max: 60 },
    { id: '61-75', label: "61–75'", max: 75 },
    { id: '76-90', label: "76–90+'", max: 999 },
  ];
  const counts = [0, 0, 0, 0, 0, 0];
  let firstHalf = 0;
  let secondHalf = 0;
  let matchesParsed = 0;
  const fastMap = new Map<string, number>();
  const lateMap = new Map<string, number>();
  const GOAL_TYPES = new Set(['goal', 'pen_goal', 'own_goal']);
  const matchDir = join(process.cwd(), 'public', 'data', 'match');

  for (const mid of seenMatchIds) {
    const fp = join(matchDir, `${mid}.json`);
    if (!existsSync(fp)) continue;
    let detail: {
      events?: { minute?: string | null; type?: string; side?: 'home' | 'away' }[];
    };
    try {
      detail = JSON.parse(readFileSync(fp, 'utf-8'));
    } catch {
      continue;
    }
    matchesParsed++;
    const pair = matchPairs.get(mid);
    for (const e of detail.events ?? []) {
      if (!e.type || !GOAL_TYPES.has(e.type) || !e.minute) continue;
      const raw = e.minute.trim();
      const baseMin = parseInt(raw.split('+')[0] ?? '0', 10);
      if (!Number.isFinite(baseMin) || baseMin <= 0) continue;
      const isFirstHalf = baseMin <= 45;
      if (isFirstHalf) firstHalf++;
      else secondHalf++;

      let bIdx = 5;
      if (baseMin <= 15) bIdx = 0;
      else if (baseMin <= 30) bIdx = 1;
      else if (baseMin <= 45) bIdx = 2;
      else if (baseMin <= 60) bIdx = 3;
      else if (baseMin <= 75) bIdx = 4;
      else bIdx = 5;
      counts[bIdx]++;

      const scorerSlug =
        e.side === 'home' ? pair?.homeSlug : e.side === 'away' ? pair?.awaySlug : undefined;
      if (scorerSlug) {
        if (baseMin <= 30) fastMap.set(scorerSlug, (fastMap.get(scorerSlug) ?? 0) + 1);
        if (baseMin >= 76) lateMap.set(scorerSlug, (lateMap.get(scorerSlug) ?? 0) + 1);
      }
    }
  }

  const totalGoals = counts.reduce((a, b) => a + b, 0);
  const toTop = (m: Map<string, number>): StatClub[] =>
    [...m.entries()]
      .map(([slug, n]) => ({ slug, n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 5);

  const goalTiming: GoalTimingSummary = {
    totalGoals,
    firstHalf,
    secondHalf,
    matchesParsed,
    buckets: bucketDefs.map((b, i) => ({
      id: b.id,
      label: b.label,
      count: counts[i],
      pct: totalGoals > 0 ? (counts[i] / totalGoals) * 100 : 0,
    })),
    fastStarters: toTop(fastMap),
    lateSurgeons: toTop(lateMap),
  };

  // ---- Player Leaders from public/data/players-compare/{season}.json ----
  let scorers: PlayerLeaderRow[] = [];
  let assisters: PlayerLeaderRow[] = [];
  let ga90: PlayerLeaderRow[] = [];
  const pcPath = join(process.cwd(), 'public', 'data', 'players-compare', `${season}.json`);
  if (existsSync(pcPath)) {
    try {
      const pc = JSON.parse(readFileSync(pcPath, 'utf-8')) as {
        cols: string[];
        rows: (string | number | null)[][];
      };
      const ix = Object.fromEntries(pc.cols.map((c, i) => [c, i]));
      const num = (r: (string | number | null)[], c: string) => Number(r[ix[c]] ?? 0) || 0;
      const clubMax = new Map<string, number>();
      for (const r of pc.rows) {
        const c = String(r[ix.club]);
        clubMax.set(c, Math.max(clubMax.get(c) ?? 0, num(r, 'min')));
      }
      const players: (PlayerLeaderRow & { eligible: boolean })[] = pc.rows
        .filter((r) => String(r[ix.pos] ?? '').split(',')[0] !== 'GK')
        .map((r) => {
          const club = String(r[ix.club]);
          const name = String(r[ix.player]);
          const min = num(r, 'min');
          const gls = num(r, 'gls');
          const ast = num(r, 'ast');
          const tMax = clubMax.get(club) || 1;
          return {
            key: `${club}|${name}`,
            name,
            club,
            pos: String(r[ix.pos] ?? '').split(',')[0] || 'MF',
            gls,
            ast,
            min,
            ga90: min > 0 ? ((gls + ast) / min) * 90 : null,
            eligible: min >= 0.3 * tMax,
          };
        });

      scorers = [...players]
        .sort((a, b) => b.gls - a.gls || b.ast - a.ast || a.min - b.min)
        .slice(0, 5);
      assisters = [...players]
        .sort((a, b) => b.ast - a.ast || b.gls - a.gls || a.min - b.min)
        .slice(0, 5);
      ga90 = players
        .filter((p) => p.eligible && p.ga90 != null)
        .sort((a, b) => (b.ga90 ?? 0) - (a.ga90 ?? 0))
        .slice(0, 5);
    } catch {
      // ignore
    }
  }

  // ---- Enriched Marquee Next Fixture ----
  let marquee: MarqueeFixture | null = null;
  if (base.nextBig) {
    const { home, away, date } = base.nextBig;
    const hr = tableBySlug.get(home);
    const ar = tableBySlug.get(away);
    const hva = vaBySlug.get(home);
    const ava = vaBySlug.get(away);
    const previewMatch = base.preview?.games.find((g) => g.home === home && g.away === away);
    marquee = {
      home,
      away,
      date,
      time: previewMatch?.time ?? null,
      homeRank: hr?.rank ?? 99,
      awayRank: ar?.rank ?? 99,
      homePts: hr?.pts ?? 0,
      awayPts: ar?.pts ?? 0,
      homeForm: formBySlug.get(home)?.record ?? '',
      awayForm: formBySlug.get(away)?.record ?? '',
      homePpgAtHome: hva && hva.home.mp > 0 ? hva.home.pts / hva.home.mp : 0,
      awayPpgAway: ava && ava.away.mp > 0 ? ava.away.pts / ava.away.mp : 0,
      homeGf: hr?.gf ?? 0,
      awayGf: ar?.gf ?? 0,
      homeGa: hr?.ga ?? 0,
      awayGa: ar?.ga ?? 0,
    };
  }

  // ---- Latest round summary ----
  const rGoals = base.games.reduce((s, g) => s + g.hg + g.ag, 0);
  const roundSummary = {
    totalGoals: rGoals,
    avgGoals: base.games.length ? rGoals / base.games.length : 0,
    homeWins: base.games.filter((g) => g.hg > g.ag).length,
    draws: base.games.filter((g) => g.hg === g.ag).length,
    awayWins: base.games.filter((g) => g.ag > g.hg).length,
  };

  return {
    base,
    table,
    pointsRace,
    goalTiming,
    leaders: { scorers, assisters, ga90 },
    marquee,
    roundSummary,
  };
}
