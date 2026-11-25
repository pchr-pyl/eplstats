import { getClubIndex, getMatches } from './data';
import type { MatchRow } from './types';

export type EuroComp =
  | 'Champions League'
  | 'Europa League'
  | 'Conference League'
  | 'UEFA Super Cup';

export type EuroStageCode =
  | 'winner'
  | 'final'
  | 'sf'
  | 'qf'
  | 'r16'
  | 'r32'
  | 'kpo'
  | 'group'
  | 'qual'
  | 'ongoing';

export interface EuroMatchItem {
  date: string;
  time: string | null;
  round: string | null;
  venue: string | null;
  opponent: string | null;
  result: string | null;
  gf: number | null;
  ga: number | null;
  gfPens: number | null;
  gaPens: number | null;
  notes: string | null;
  matchId: string | null;
}

export interface EuroCampaign {
  season: string;
  slug: string;
  competition: EuroComp;
  stageCode: EuroStageCode;
  stageEn: string;
  stageTh: string;
  mp: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  winPct: number;
  ppg: number;
  droppedFromUcl?: boolean;
  finalOpponent?: string | null;
  finalScore?: string | null;
  matches: EuroMatchItem[];
}

export interface EuroFinalRow {
  season: string;
  competition: EuroComp;
  slug: string;
  opponent: string | null;
  opponentSlug: string | null;
  won: boolean;
  score: string;
  pens: string | null;
  date: string;
  allEnglish: boolean;
}

export interface EuroUpcomingFixture {
  season: string;
  competition: EuroComp;
  slug: string;
  date: string;
  time: string | null;
  round: string | null;
  venue: string | null;
  opponent: string | null;
}

export interface EuroClubSummary {
  slug: string;
  appearances: number;
  uclApps: number;
  uelApps: number;
  ueclApps: number;
  superCupApps: number;
  trophies: number;
  uclTitles: number;
  uelTitles: number;
  ueclTitles: number;
  superCupTitles: number;
  finals: number;
  mp: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  winPct: number;
  ppg: number;
  bestComp: EuroComp | null;
  bestStageEn: string;
  bestStageTh: string;
}

export interface EuroSeasonSummary {
  season: string;
  campaigns: EuroCampaign[];
  uclCount: number;
  uelCount: number;
  ueclCount: number;
  superCupCount: number;
  uniqueClubs: number;
  trophiesWon: number;
}

export interface EuropeData {
  seasons: string[];
  latestSeason: string;
  bySeason: EuroSeasonSummary[];
  finals: EuroFinalRow[];
  upcoming: EuroUpcomingFixture[];
  leaderboard: EuroClubSummary[];
  totals: {
    trophies: number;
    uclTitles: number;
    uelTitles: number;
    ueclTitles: number;
    superCupTitles: number;
    uniqueClubs: number;
    totalCampaigns: number;
    totalMatches: number;
    totalWins: number;
    overallWinPct: number;
  };
}

const EURO_COMPS: EuroComp[] = [
  'Champions League',
  'Europa League',
  'Conference League',
  'UEFA Super Cup',
];
const EURO_SET = new Set<string>(EURO_COMPS);

const COMP_RANK: Record<EuroComp, number> = {
  'Champions League': 4,
  'Europa League': 3,
  'Conference League': 2,
  'UEFA Super Cup': 1,
};

const STAGE_META: Record<
  EuroStageCode,
  { order: number; en: string; th: string }
> = {
  winner: { order: 10, en: 'Winners', th: 'แชมป์' },
  final: { order: 9, en: 'Runners-up', th: 'รองแชมป์' },
  sf: { order: 8, en: 'Semi-finals', th: 'รอบรองชนะเลิศ' },
  qf: { order: 7, en: 'Quarter-finals', th: 'รอบ 8 ทีม' },
  r16: { order: 6, en: 'Round of 16', th: 'รอบ 16 ทีม' },
  r32: { order: 5, en: 'Round of 32', th: 'รอบ 32 ทีม' },
  kpo: { order: 4, en: 'Knockout Play-offs', th: 'เพลย์ออฟน็อกเอาต์' },
  group: { order: 3, en: 'Group / League Phase', th: 'รอบแบ่งกลุ่ม / ลีกเฟส' },
  qual: { order: 2, en: 'Qualifying', th: 'รอบคัดเลือก' },
  ongoing: { order: 1, en: 'In Progress', th: 'กำลังแข่งขัน' },
};

function roundToStage(round: string | null): EuroStageCode {
  const r = (round ?? '').toLowerCase().trim();
  if (r === 'final' || r === 'uefa super cup') return 'final';
  if (r.includes('semi')) return 'sf';
  if (r.includes('quarter')) return 'qf';
  if (r.includes('round of 16')) return 'r16';
  if (r.includes('round of 32')) return 'r32';
  if (r.includes('knockout')) return 'kpo';
  if (r.includes('league phase') || r.includes('group')) return 'group';
  if (r.includes('qualifying') || r.includes('play-off')) return 'qual';
  return 'group';
}

function didWinFinal(m: MatchRow): boolean {
  if (m.result === 'W') return true;
  if (m.result === 'L') return false;
  if (m.gfPens != null && m.gaPens != null) return m.gfPens > m.gaPens;
  if (m.gf != null && m.ga != null && m.gf !== m.ga) return m.gf > m.ga;
  return false;
}

function formatFinalScore(m: MatchRow): { score: string; pens: string | null } {
  const score =
    m.gf != null && m.ga != null ? `${m.gf}–${m.ga}` : '—';
  const pens =
    m.gfPens != null && m.gaPens != null
      ? `${m.gfPens}–${m.gaPens}`
      : null;
  return { score, pens };
}

export function getEuropeData(): EuropeData {
  const clubs = getClubIndex();
  const slugByName = new Map<string, string>();
  for (const c of clubs) {
    slugByName.set(c.name.toLowerCase(), c.slug);
    if (c.shortName) slugByName.set(c.shortName.toLowerCase(), c.slug);
  }
  // fbref display aliases
  slugByName.set('manchester utd', 'man-utd');
  slugByName.set('manchester united', 'man-utd');
  slugByName.set('manchester city', 'man-city');
  slugByName.set('tottenham hotspur', 'tottenham');
  slugByName.set('newcastle utd', 'newcastle-united');
  slugByName.set('west ham united', 'west-ham');
  slugByName.set('wolverhampton wanderers', 'wolves');
  slugByName.set('nott\'ham forest', 'nottingham-forest');
  slugByName.set('brighton & hove albion', 'brighton');

  const allSeasonsSet = new Set<string>();
  for (const c of clubs) {
    for (const s of c.seasons) allSeasonsSet.add(s);
  }
  const seasons = [...allSeasonsSet].sort();
  const latestSeason = seasons[seasons.length - 1] ?? '';

  const allCampaigns: EuroCampaign[] = [];
  const rawFinals: EuroFinalRow[] = [];
  const upcoming: EuroUpcomingFixture[] = [];

  // Track club-season pairs that played in UCL to detect UCL -> UEL drop-downs
  const uclClubSeasons = new Set<string>();

  for (const c of clubs) {
    const matches = getMatches(c.slug).filter((m) =>
      EURO_SET.has(m.competition),
    );
    const grouped = new Map<string, MatchRow[]>();
    for (const m of matches) {
      const key = `${m.season}||${m.competition}`;
      const list = grouped.get(key);
      if (list) list.push(m);
      else grouped.set(key, [m]);
    }

    for (const [key, list] of grouped) {
      const [season, compStr] = key.split('||');
      const competition = compStr as EuroComp;
      list.sort((a, b) => a.date.localeCompare(b.date));

      if (competition === 'Champions League') {
        uclClubSeasons.add(`${season}||${c.slug}`);
      }

      const played = list.filter((m) => m.result != null);
      const future = list.filter((m) => m.result == null);

      for (const fm of future) {
        if (season === latestSeason) {
          upcoming.push({
            season,
            competition,
            slug: c.slug,
            date: fm.date,
            time: fm.time,
            round: fm.round,
            venue: fm.venue,
            opponent: fm.opponent,
          });
        }
      }

      if (played.length === 0 && future.length === 0) continue;

      let w = 0;
      let d = 0;
      let l = 0;
      let gf = 0;
      let ga = 0;
      for (const m of played) {
        if (m.result === 'W') w++;
        else if (m.result === 'D') d++;
        else if (m.result === 'L') l++;
        gf += m.gf ?? 0;
        ga += m.ga ?? 0;
      }

      // Infer furthest stage reached
      let bestCode: EuroStageCode = 'qual';
      let finalMatch: MatchRow | null = null;
      for (const m of played) {
        const sc = roundToStage(m.round);
        if (sc === 'final' || competition === 'UEFA Super Cup') {
          finalMatch = m;
          bestCode = didWinFinal(m) ? 'winner' : 'final';
        } else if (STAGE_META[sc].order > STAGE_META[bestCode].order) {
          bestCode = sc;
        }
      }

      // If current in-progress season has upcoming fixtures and hasn't reached a Final yet
      const isOngoing =
        season === latestSeason &&
        competition !== 'UEFA Super Cup' &&
        future.length > 0 &&
        bestCode !== 'winner' &&
        bestCode !== 'final';

      if (isOngoing) {
        bestCode = 'ongoing';
      }

      let finalOpponent: string | null = null;
      let finalScore: string | null = null;

      if (finalMatch) {
        const { score, pens } = formatFinalScore(finalMatch);
        finalOpponent = finalMatch.opponent;
        finalScore = pens ? `${score} (${pens}p)` : score;

        const oppClean = (finalMatch.opponent ?? '').trim().toLowerCase();
        const oppSlug = slugByName.get(oppClean) ?? null;
        rawFinals.push({
          season,
          competition,
          slug: c.slug,
          opponent: finalMatch.opponent,
          opponentSlug: oppSlug,
          won: didWinFinal(finalMatch),
          score,
          pens,
          date: finalMatch.date,
          allEnglish: oppSlug != null,
        });
      }

      const mp = played.length;
      const pts = w * 3 + d;
      const stageInfo = STAGE_META[bestCode];

      // Refine League Phase vs Group Stage wording for 2024-25+
      let stageEn = stageInfo.en;
      let stageTh = stageInfo.th;
      if (bestCode === 'group') {
        const hasLeaguePhase = played.some((m) =>
          (m.round ?? '').toLowerCase().includes('league phase'),
        );
        if (hasLeaguePhase) {
          stageEn = 'League Phase';
          stageTh = 'รอบลีกเฟส';
        } else {
          stageEn = 'Group Stage';
          stageTh = 'รอบแบ่งกลุ่ม';
        }
      } else if (bestCode === 'ongoing') {
        const lastRound = played.at(-1)?.round ?? future[0]?.round ?? '';
        if (lastRound.toLowerCase().includes('league phase')) {
          stageEn = 'League Phase (Live)';
          stageTh = 'รอบลีกเฟส (กำลังแข่ง)';
        }
      }

      allCampaigns.push({
        season,
        slug: c.slug,
        competition,
        stageCode: bestCode,
        stageEn,
        stageTh,
        mp,
        w,
        d,
        l,
        gf,
        ga,
        gd: gf - ga,
        pts,
        winPct: mp > 0 ? (w / mp) * 100 : 0,
        ppg: mp > 0 ? pts / mp : 0,
        finalOpponent,
        finalScore,
        matches: list.map((m) => ({
          date: m.date,
          time: m.time,
          round: m.round,
          venue: m.venue,
          opponent: m.opponent,
          result: m.result,
          gf: m.gf,
          ga: m.ga,
          gfPens: m.gfPens,
          gaPens: m.gaPens,
          notes: m.notes,
          matchId: m.matchId ?? null,
        })),
      });
    }
  }

  // Flag UEL campaigns where the club dropped down from UCL in the same season
  for (const camp of allCampaigns) {
    if (
      camp.competition === 'Europa League' &&
      uclClubSeasons.has(`${camp.season}||${camp.slug}`)
    ) {
      camp.droppedFromUcl = true;
    }
  }

  // Dedupe all-English finals so each final appears once (from the winner's perspective)
  const finalsMap = new Map<string, EuroFinalRow>();
  for (const f of rawFinals) {
    const key = `${f.season}||${f.competition}||${f.date}`;
    const existing = finalsMap.get(key);
    if (!existing || (f.won && !existing.won)) {
      finalsMap.set(key, f);
    }
  }
  const finals = [...finalsMap.values()].sort(
    (a, b) =>
      b.season.localeCompare(a.season) ||
      COMP_RANK[b.competition] - COMP_RANK[a.competition],
  );

  // Build per-season summaries (latest first)
  const bySeason: EuroSeasonSummary[] = [...seasons]
    .reverse()
    .map((s) => {
      const camps = allCampaigns
        .filter((c) => c.season === s)
        .sort(
          (a, b) =>
            COMP_RANK[b.competition] - COMP_RANK[a.competition] ||
            STAGE_META[b.stageCode].order - STAGE_META[a.stageCode].order ||
            b.pts - a.pts ||
            a.slug.localeCompare(b.slug),
        );
      return {
        season: s,
        campaigns: camps,
        uclCount: camps.filter((c) => c.competition === 'Champions League').length,
        uelCount: camps.filter((c) => c.competition === 'Europa League').length,
        ueclCount: camps.filter((c) => c.competition === 'Conference League').length,
        superCupCount: camps.filter((c) => c.competition === 'UEFA Super Cup').length,
        uniqueClubs: new Set(camps.map((c) => c.slug)).size,
        trophiesWon: camps.filter((c) => c.stageCode === 'winner').length,
      };
    });

  // Build all-time European leaderboard per club
  const clubAgg = new Map<string, EuroCampaign[]>();
  for (const camp of allCampaigns) {
    const list = clubAgg.get(camp.slug);
    if (list) list.push(camp);
    else clubAgg.set(camp.slug, [camp]);
  }

  const leaderboard: EuroClubSummary[] = [...clubAgg.entries()]
    .map(([slug, camps]) => {
      const majorSeasons = new Set(
        camps
          .filter((c) => c.competition !== 'UEFA Super Cup')
          .map((c) => c.season),
      );
      let uclApps = 0;
      let uelApps = 0;
      let ueclApps = 0;
      let superCupApps = 0;
      let uclTitles = 0;
      let uelTitles = 0;
      let ueclTitles = 0;
      let superCupTitles = 0;
      let finalsCount = 0;
      let mp = 0;
      let w = 0;
      let d = 0;
      let l = 0;
      let gf = 0;
      let ga = 0;

      let bestCamp: EuroCampaign | null = null;
      const campScore = (c: EuroCampaign) =>
        (c.stageCode === 'winner' ? 1000 : 0) +
        COMP_RANK[c.competition] * 50 +
        STAGE_META[c.stageCode].order;

      for (const c of camps) {
        if (c.competition === 'Champions League') {
          uclApps++;
          if (c.stageCode === 'winner') uclTitles++;
        } else if (c.competition === 'Europa League') {
          uelApps++;
          if (c.stageCode === 'winner') uelTitles++;
        } else if (c.competition === 'Conference League') {
          ueclApps++;
          if (c.stageCode === 'winner') ueclTitles++;
        } else {
          superCupApps++;
          if (c.stageCode === 'winner') superCupTitles++;
        }
        if (c.stageCode === 'winner' || c.stageCode === 'final') finalsCount++;
        mp += c.mp;
        w += c.w;
        d += c.d;
        l += c.l;
        gf += c.gf;
        ga += c.ga;
        if (!bestCamp || campScore(c) > campScore(bestCamp)) {
          bestCamp = c;
        }
      }

      const trophies = uclTitles + uelTitles + ueclTitles + superCupTitles;
      const pts = w * 3 + d;
      return {
        slug,
        appearances: majorSeasons.size || camps.length,
        uclApps,
        uelApps,
        ueclApps,
        superCupApps,
        trophies,
        uclTitles,
        uelTitles,
        ueclTitles,
        superCupTitles,
        finals: finalsCount,
        mp,
        w,
        d,
        l,
        gf,
        ga,
        gd: gf - ga,
        winPct: mp > 0 ? (w / mp) * 100 : 0,
        ppg: mp > 0 ? pts / mp : 0,
        bestComp: bestCamp?.competition ?? null,
        bestStageEn: bestCamp
          ? `${bestCamp.competition.replace('UEFA ', '').replace(' League', '')} ${bestCamp.stageEn}`
          : '—',
        bestStageTh: bestCamp
          ? `${bestCamp.competition === 'Champions League' ? 'UCL' : bestCamp.competition === 'Europa League' ? 'UEL' : bestCamp.competition === 'Conference League' ? 'UECL' : 'Super Cup'} · ${bestCamp.stageTh}`
          : '—',
      };
    })
    .sort(
      (a, b) =>
        b.appearances - a.appearances ||
        b.trophies - a.trophies ||
        b.mp - a.mp ||
        b.ppg - a.ppg,
    );

  // Totals
  let uclTitles = 0;
  let uelTitles = 0;
  let ueclTitles = 0;
  let superCupTitles = 0;
  let totalMatches = 0;
  let totalWins = 0;
  for (const c of allCampaigns) {
    totalMatches += c.mp;
    totalWins += c.w;
    if (c.stageCode === 'winner') {
      if (c.competition === 'Champions League') uclTitles++;
      else if (c.competition === 'Europa League') uelTitles++;
      else if (c.competition === 'Conference League') ueclTitles++;
      else superCupTitles++;
    }
  }

  upcoming.sort(
    (a, b) =>
      a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''),
  );

  return {
    seasons,
    latestSeason,
    bySeason,
    finals,
    upcoming,
    leaderboard,
    totals: {
      trophies: uclTitles + uelTitles + ueclTitles + superCupTitles,
      uclTitles,
      uelTitles,
      ueclTitles,
      superCupTitles,
      uniqueClubs: leaderboard.length,
      totalCampaigns: allCampaigns.filter((c) => c.competition !== 'UEFA Super Cup').length,
      totalMatches,
      totalWins,
      overallWinPct: totalMatches > 0 ? (totalWins / totalMatches) * 100 : 0,
    },
  };
}
