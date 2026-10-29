import { getClubIndex, getLeague, getMatches } from './data';
import type { MatchRow } from './types';

export interface FormClub {
  slug: string;
  pts: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  record: string; // latest first, e.g. "WWDLW"
}

export interface MwGame {
  home: string;
  away: string;
  hg: number;
  ag: number;
  homeXg: number | null;
  awayXg: number | null;
  date: string;
}

export interface DeltaClub {
  slug: string;
  diff: number;
}

export interface StatClub {
  slug: string;
  n: number;
}

export interface InsightsData {
  season: string;
  round: string | null;
  games: MwGame[];
  topScoring: MwGame | null;
  biggestWin: MwGame | null;
  xgFest: MwGame | null;
  form: FormClub[];
  over: DeltaClub[];
  under: DeltaClub[];
  gfTop: StatClub[];
  csTop: StatClub[];
  defOut: DeltaClub[];
  unbeaten: StatClub[];
  winless: StatClub[];
  winRun: StatClub[];
  nextBig: { home: string; away: string; date: string; rankSum: number } | null;
}

const PL = 'Premier League';
const roundNum = (r: string | null) =>
  r ? parseInt(r.replace(/\D+/g, ''), 10) || 0 : 0;

function plMatches(slug: string, season: string): MatchRow[] {
  return getMatches(slug).filter(
    (m) => m.season === season && m.competition === PL,
  );
}

export function getInsights(): InsightsData {
  const league = getLeague();
  const season = Object.keys(league).sort().at(-1) ?? '';
  const table = (league[season] ?? []).filter((r) => r.slug);
  const rankOf = new Map(table.map((r) => [r.slug, r.rank ?? 99]));

  const playedBy = new Map<string, MatchRow[]>();
  const futureBy = new Map<string, MatchRow[]>();
  for (const r of table) {
    const all = plMatches(r.slug, season);
    playedBy.set(
      r.slug,
      all.filter((m) => m.result != null).sort((a, b) => a.date.localeCompare(b.date)),
    );
    futureBy.set(
      r.slug,
      all.filter((m) => m.result == null).sort((a, b) => a.date.localeCompare(b.date)),
    );
  }

  // learn fbref opponent display name -> slug from played matchId pairs
  const oppNameToSlug = new Map<string, string>();
  const byId = new Map<string, { slug: string; m: MatchRow }[]>();
  for (const [slug, ms] of playedBy)
    for (const m of ms)
      if (m.matchId) (byId.get(m.matchId) ?? byId.set(m.matchId, []).get(m.matchId)!).push({ slug, m });
  for (const rows of byId.values()) {
    if (rows.length !== 2) continue;
    const [a, b] = rows;
    oppNameToSlug.set(a.m.opponent ?? '', b.slug);
    oppNameToSlug.set(b.m.opponent ?? '', a.slug);
  }

  // latest completed round + its games
  let round: string | null = null;
  for (const ms of playedBy.values()) {
    const r = ms.at(-1)?.round ?? null;
    if (r && roundNum(r) > roundNum(round)) round = r;
  }
  const games: MwGame[] = [];
  if (round) {
    const seen = new Set<string>();
    for (const [slug, ms] of playedBy) {
      for (const m of ms) {
        if (m.round !== round || !m.matchId) continue;
        if (m.venue !== 'Home') continue; // dedupe via home row only
        if (seen.has(m.matchId)) continue;
        seen.add(m.matchId);
        const pair = byId.get(m.matchId)?.find((p) => p.slug !== slug);
        games.push({
          home: slug,
          away: pair?.slug ?? (oppNameToSlug.get(m.opponent ?? '') || (m.opponent ?? '?')),
          hg: m.gf ?? 0,
          ag: m.ga ?? 0,
          homeXg: m.xg,
          awayXg: pair?.m.xg ?? null,
          date: m.date,
        });
      }
    }
    games.sort((a, b) => a.date.localeCompare(b.date));
  }

  const goalsOf = (g: MwGame) => g.hg + g.ag;
  const topScoring = games.length ? games.reduce((a, b) => (goalsOf(b) > goalsOf(a) ? b : a)) : null;
  const biggestWin = games.length
    ? games.reduce((a, b) => (Math.abs(b.hg - b.ag) > Math.abs(a.hg - a.ag) ? b : a))
    : null;
  const xgSum = (g: MwGame) => (g.homeXg ?? 0) + (g.awayXg ?? 0);
  const withXg = games.filter((g) => g.homeXg != null && g.awayXg != null);
  const xgFest = withXg.length ? withXg.reduce((a, b) => (xgSum(b) > xgSum(a) ? b : a)) : null;

  // last-5 form
  const form: FormClub[] = table.map((r) => {
    const last5 = (playedBy.get(r.slug) ?? []).slice(-5);
    const w = last5.filter((m) => m.result === 'W').length;
    const d = last5.filter((m) => m.result === 'D').length;
    const l = last5.filter((m) => m.result === 'L').length;
    return {
      slug: r.slug,
      pts: w * 3 + d,
      w, d, l,
      gf: last5.reduce((a, m) => a + (m.gf ?? 0), 0),
      ga: last5.reduce((a, m) => a + (m.ga ?? 0), 0),
      record: last5.map((m) => m.result).reverse().join(''),
    };
  });
  form.sort((a, b) => b.pts - a.pts || b.gf - a.gf || a.ga - b.ga);

  const delta = (fn: (r: (typeof table)[number]) => number | null) =>
    table
      .map((r) => ({ slug: r.slug, diff: fn(r) }))
      .filter((x): x is DeltaClub => x.diff != null)
      .sort((a, b) => b.diff - a.diff);

  const over = delta((r) => (r.xg != null ? r.gf - r.xg : null)).filter((x) => x.diff > 0).slice(0, 3);
  const under = delta((r) => (r.xg != null ? r.xg - r.gf : null)).filter((x) => x.diff > 0).slice(0, 3);
  const defOut = delta((r) => (r.xga != null ? r.xga - r.ga : null)).filter((x) => x.diff > 0).slice(0, 3);

  const gfTop: StatClub[] = [...table]
    .sort((a, b) => b.gf - a.gf)
    .slice(0, 3)
    .map((r) => ({ slug: r.slug, n: r.gf }));
  const csTop: StatClub[] = [...table]
    .sort((a, b) => b.cs - a.cs)
    .slice(0, 3)
    .map((r) => ({ slug: r.slug, n: r.cs }));

  // streaks (walk back from latest played)
  const streak = (slug: string, keep: (res: string) => boolean) => {
    let n = 0;
    const ms = playedBy.get(slug) ?? [];
    for (let i = ms.length - 1; i >= 0; i--) {
      if (!keep(ms[i].result ?? '')) break;
      n++;
    }
    return { slug, n };
  };
  const sortN = (a: StatClub, b: StatClub) => b.n - a.n;
  const unbeaten = table.map((r) => streak(r.slug, (x) => x !== 'L')).filter((x) => x.n >= 3).sort(sortN).slice(0, 3);
  const winless = table.map((r) => streak(r.slug, (x) => x !== 'W')).filter((x) => x.n >= 3).sort(sortN).slice(0, 3);
  const winRun = table.map((r) => streak(r.slug, (x) => x === 'W')).filter((x) => x.n >= 2).sort(sortN).slice(0, 3);

  // next big fixture: upcoming game with smallest combined league rank
  let nextBig: InsightsData['nextBig'] = null;
  for (const [slug, ms] of futureBy) {
    const m = ms[0]; // nearest upcoming
    if (!m || m.venue !== 'Home') continue;
    const away = oppNameToSlug.get(m.opponent ?? '');
    if (!away) continue;
    const rankSum = (rankOf.get(slug) ?? 99) + (rankOf.get(away) ?? 99);
    const cand = { home: slug, away, date: m.date, rankSum };
    if (
      !nextBig ||
      rankSum < nextBig.rankSum ||
      (rankSum === nextBig.rankSum && m.date < nextBig.date)
    )
      nextBig = cand;
  }

  return {
    season,
    round,
    games,
    topScoring,
    biggestWin,
    xgFest,
    form,
    over,
    under,
    gfTop,
    csTop,
    defOut,
    unbeaten,
    winless,
    winRun,
    nextBig,
  };
}
