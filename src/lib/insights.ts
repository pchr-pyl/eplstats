import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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

export interface VaRec {
  mp: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
}

export interface VaSplit {
  slug: string;
  home: VaRec;
  away: VaRec;
}

export interface Projection {
  slug: string;
  cur: number;
  projRank: number;
  projPts: number;
}

export interface XgRacePoint {
  mp: number;
  gf: number;
  xg: number | null;
}

export interface XgRaceClub {
  slug: string;
  points: XgRacePoint[];
}

export interface PreviewGame {
  home: string;
  away: string;
  date: string;
  time: string;
  homeForm: string;
  awayForm: string;
}

export interface Preview {
  wk: number;
  games: PreviewGame[];
}

export interface Drama {
  comebackWins: StatClub[];
  fightbacks: StatClub[];
  blownLeads: StatClub[];
  lateWinners: StatClub[];
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
  xgRace: XgRaceClub[];
  vaSplit: VaSplit[];
  projections: Projection[];
  preview: Preview | null;
  drama: Drama;
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

  // ---- xG race: cumulative goals vs xG per played PL match ----
  const xgRace: XgRaceClub[] = table.map((r) => {
    let gf = 0;
    let xg: number | null = null;
    const points = (playedBy.get(r.slug) ?? []).map((m, i) => {
      gf += m.gf ?? 0;
      if (m.xg != null) xg = (xg ?? 0) + m.xg;
      return { mp: i + 1, gf, xg };
    });
    return { slug: r.slug, points };
  });

  // ---- home/away splits ----
  const vaSplit: VaSplit[] = table.map((r) => {
    const rec = (): VaRec => ({ mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 });
    const home = rec();
    const away = rec();
    for (const m of playedBy.get(r.slug) ?? []) {
      const v = m.venue === 'Home' ? home : m.venue === 'Away' ? away : null;
      if (!v || m.gf == null || m.ga == null) continue;
      v.mp++;
      v.gf += m.gf;
      v.ga += m.ga;
      if (m.result === 'W') { v.w++; v.pts += 3; }
      else if (m.result === 'D') { v.d++; v.pts++; }
      else if (m.result === 'L') v.l++;
    }
    return { slug: r.slug, home, away };
  });

  // ---- projected final table (PPG extrapolation, 38-game season) ----
  const projections: Projection[] = table
    .map((r) => {
      const mp = r.mp ?? 0;
      const pts = r.pts ?? 0;
      const projPts = mp > 0 ? pts + (pts / mp) * (38 - mp) : 0;
      return { slug: r.slug, cur: r.rank ?? 99, projPts };
    })
    .sort((a, b) => b.projPts - a.projPts)
    .map((p, i) => ({
      slug: p.slug,
      cur: p.cur,
      projRank: i + 1,
      projPts: Math.round(p.projPts * 10) / 10,
    }));

  // ---- next matchweek preview (from league-mw snapshot) ----
  let preview: Preview | null = null;
  const mwPath = join(process.cwd(), 'public', 'data', 'league-mw', `${season}.json`);
  if (existsSync(mwPath)) {
    try {
      const mw = JSON.parse(readFileSync(mwPath, 'utf-8')) as {
        weeks?: { wk: number; matches?: { date: string; time: string; home: string; away: string; score: string | null }[] }[];
      };
      const lastWk = mw.weeks?.at(-1);
      const upcoming = (lastWk?.matches ?? []).filter((m) => !m.score);
      if (lastWk && upcoming.length) {
        const formOf = new Map(form.map((f) => [f.slug, f.record]));
        preview = {
          wk: lastWk.wk,
          games: upcoming
            .slice()
            .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
            .map((m) => ({
              home: m.home,
              away: m.away,
              date: m.date,
              time: m.time,
              homeForm: formOf.get(m.home) ?? '',
              awayForm: formOf.get(m.away) ?? '',
            })),
        };
      }
    } catch {
      preview = null;
    }
  }

  // ---- drama stats from match report events ----
  const drama: Drama = { comebackWins: [], fightbacks: [], blownLeads: [], lateWinners: [] };
  {
    const GOAL = new Set(['goal', 'pen_goal', 'own_goal']);
    const SCORE_RE = /(\d+)\s*[-:]\s*(\d+)/;
    const MIN_RE = /^(\d+)/;
    const bump = (arr: Map<string, number>, slug: string) =>
      arr.set(slug, (arr.get(slug) ?? 0) + 1);
    const comeback = new Map<string, number>();
    const fightback = new Map<string, number>();
    const blown = new Map<string, number>();
    const lateWin = new Map<string, number>();
    const matchDir = join(process.cwd(), 'public', 'data', 'match');
    const seenMid = new Set<string>();
    for (const rows of byId.values()) {
      if (rows.length !== 2) continue;
      const homeRow = rows.find((p) => p.m.venue === 'Home') ?? rows[0];
      const awayRow = rows.find((p) => p.m.venue === 'Away') ?? rows[1];
      const mid = homeRow.m.matchId;
      if (!mid || seenMid.has(mid)) continue;
      if (homeRow.m.season !== season || homeRow.m.competition !== PL) continue;
      if (homeRow.m.result == null) continue;
      const fp = join(matchDir, `${mid}.json`);
      if (!existsSync(fp)) continue;
      seenMid.add(mid);
      let detail: {
        events?: { minute: string | null; sort: number | null; type: string; score?: string | null }[];
      };
      try {
        detail = JSON.parse(readFileSync(fp, 'utf-8'));
      } catch {
        continue;
      }
      // goal checkpoints: score after each goal event
      const cps: { min: number; h: number; a: number }[] = [];
      for (const e of detail.events ?? []) {
        if (!GOAL.has(e.type) || !e.score) continue;
        const sm = SCORE_RE.exec(e.score);
        if (!sm) continue;
        const mn = MIN_RE.exec(e.minute ?? '');
        cps.push({ min: mn ? parseInt(mn[1], 10) : 0, h: +sm[1], a: +sm[2] });
      }
      if (!cps.length) continue;
      const gf = homeRow.m.gf ?? cps.at(-1)!.h;
      const ga = homeRow.m.ga ?? cps.at(-1)!.a;
      const res = (gf > ga ? 'W' : gf < ga ? 'L' : 'D') as 'W' | 'D' | 'L';
      const flags = { homeTrailed: false, homeLed: false, awayTrailed: false, awayLed: false };
      for (const c of cps) {
        if (c.h > c.a) { flags.homeLed = true; flags.awayTrailed = true; }
        else if (c.a > c.h) { flags.awayLed = true; flags.homeTrailed = true; }
      }
      const sides: [string, 'W' | 'D' | 'L', boolean, boolean][] = [
        [homeRow.slug, res, flags.homeTrailed, flags.homeLed],
        [awayRow.slug, res === 'W' ? 'L' : res === 'L' ? 'W' : 'D', flags.awayTrailed, flags.awayLed],
      ];
      for (const [slug, r, trailed, led] of sides) {
        if (trailed && r === 'W') bump(comeback, slug);
        else if (trailed && r === 'D') bump(fightback, slug);
        if (led && r !== 'W') bump(blown, slug);
      }
      // late winner: last goal >=80' turned tie/trail into the final win
      const last = cps.at(-1)!;
      const prev = cps.length > 1 ? cps[cps.length - 2]! : { min: 0, h: 0, a: 0 };
      if (last.min >= 80) {
        const wHome = last.h > last.a;
        const wAway = last.a > last.h;
        const decided = (wHome && gf > ga) || (wAway && ga > gf);
        const wasLevel = prev.h === prev.a;
        const winnerWasBehind = wHome ? prev.h < prev.a : prev.a < prev.h;
        if (decided && (wasLevel || winnerWasBehind)) {
          bump(lateWin, wHome ? homeRow.slug : awayRow.slug);
        }
      }
    }
    const toStat = (m: Map<string, number>) =>
      [...m.entries()].map(([slug, n]) => ({ slug, n })).sort(sortN).slice(0, 5);
    drama.comebackWins = toStat(comeback);
    drama.fightbacks = toStat(fightback);
    drama.blownLeads = toStat(blown);
    drama.lateWinners = toStat(lateWin);
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
    xgRace,
    vaSplit,
    projections,
    preview,
    drama,
  };
}
