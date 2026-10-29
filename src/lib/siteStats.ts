import { getClubIndex, getMatches, getManagers, getPlayers } from './data';
import type { MatchRow } from './types';

const DAY_MS = 86_400_000;

export interface SiteStats {
  builtAt: string;
  clubs: { slug: string; name: string }[];
  clubCount: number;
  seasonFirst: string;
  seasonLast: string;
  clubSeasons: number;
  matchRows: number;
  playedRows: number;
  upcomingRows: number;
  latestResult: { date: string; clubs: string[] } | null;
  nextFixture: { date: string; clubs: string[] } | null;
  pastUnplayed: {
    count: number;
    rows: { club: string; date: string; competition: string; opponent: string | null }[];
  };
  xgCoverage: { all: number | null; current: number | null };
  staleClubs: { slug: string; name: string; latest: string }[];
  playersCurrent: number;
  managers: { clubsWithStints: number; current: number };
}

const isPlayed = (m: MatchRow) =>
  (m.result === 'W' || m.result === 'D' || m.result === 'L') && m.gf != null && m.ga != null;

export function buildSiteStats(): SiteStats {
  const index = getClubIndex();
  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const latestSeason = index.reduce((a, c) => (c.latest > a ? c.latest : a), '');

  let matchRows = 0;
  let playedRows = 0;
  let upcomingRows = 0;
  const pastUnplayed: SiteStats['pastUnplayed']['rows'] = [];
  const latestByDate = new Map<string, string[]>();
  const nextByDate = new Map<string, string[]>();
  let plPlayed = 0;
  let plXg = 0;
  let plPlayedCur = 0;
  let plXgCur = 0;
  const clubLatest = new Map<string, string>();
  let playersCurrent = 0;
  let clubsWithStints = 0;
  let currentManagers = 0;

  for (const club of index) {
    const matches = getMatches(club.slug);
    for (const m of matches) {
      matchRows += 1;
      if (isPlayed(m)) {
        playedRows += 1;
        if (m.competition === 'Premier League') {
          plPlayed += 1;
          if (m.xg != null) plXg += 1;
          if (m.season === latestSeason) {
            plPlayedCur += 1;
            if (m.xg != null) plXgCur += 1;
          }
        }
        const arr = latestByDate.get(m.date);
        if (arr) arr.push(club.slug);
        else latestByDate.set(m.date, [club.slug]);
        if (m.season === latestSeason) {
          const cur = clubLatest.get(club.slug);
          if (!cur || m.date > cur) clubLatest.set(club.slug, m.date);
        }
      } else if (m.result == null) {
        if (m.date >= today) {
          upcomingRows += 1;
          const arr = nextByDate.get(m.date);
          if (arr) arr.push(club.slug);
          else nextByDate.set(m.date, [club.slug]);
        } else {
          pastUnplayed.push({
            club: club.slug,
            date: m.date,
            competition: m.competition,
            opponent: m.opponent,
          });
        }
      }
    }
    playersCurrent += getPlayers(club.slug).seasons[latestSeason]?.players.length ?? 0;
    const stints = getManagers(club.slug);
    if (stints.length > 0) clubsWithStints += 1;
    currentManagers += stints.filter((s) => s.to == null).length;
  }

  const latestDate = [...latestByDate.keys()].sort().pop() ?? null;
  const nextDate =
    [...nextByDate.keys()].filter((d) => d >= today).sort()[0] ?? null;
  const latestMs = latestDate ? new Date(`${latestDate}T00:00:00Z`).getTime() : 0;

  pastUnplayed.sort((a, b) => b.date.localeCompare(a.date));

  const staleClubs = index
    .filter((c) => c.seasons.includes(latestSeason))
    .map((c) => ({ slug: c.slug, name: c.name, latest: clubLatest.get(c.slug) ?? '' }))
    .filter((c) => c.latest && latestMs - new Date(`${c.latest}T00:00:00Z`).getTime() > 7 * DAY_MS)
    .sort((a, b) => a.latest.localeCompare(b.latest));

  const seasonsAll = index.flatMap((c) => c.seasons).sort();

  return {
    builtAt: new Date().toISOString(),
    clubs: index.map((c) => ({ slug: c.slug, name: c.name })),
    clubCount: index.length,
    seasonFirst: seasonsAll[0] ?? '',
    seasonLast: seasonsAll[seasonsAll.length - 1] ?? '',
    clubSeasons: index.reduce((a, c) => a + c.seasons.length, 0),
    matchRows,
    playedRows,
    upcomingRows,
    latestResult: latestDate ? { date: latestDate, clubs: latestByDate.get(latestDate)! } : null,
    nextFixture: nextDate ? { date: nextDate, clubs: nextByDate.get(nextDate)! } : null,
    pastUnplayed: { count: pastUnplayed.length, rows: pastUnplayed.slice(0, 30) },
    xgCoverage: {
      all: plPlayed > 0 ? plXg / plPlayed : null,
      current: plPlayedCur > 0 ? plXgCur / plPlayedCur : null,
    },
    staleClubs,
    playersCurrent,
    managers: { clubsWithStints, current: currentManagers },
  };
}
