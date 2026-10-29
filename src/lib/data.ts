import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { cache } from 'react';
import type {
  SeasonRow,
  MatchRow,
  KeepersData,
  SquadData,
  PlayersData,
  TeamStatsBySeason,
  ManagerStint,
  ClubIndexEntry,
  LeagueData,
} from './types';

const BUILT = join(process.cwd(), 'data', 'built');

function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

const clubDir = (slug: string) => join(BUILT, slug);

export const getClubIndex = cache((): ClubIndexEntry[] => {
  return readJson<ClubIndexEntry[]>(join(BUILT, 'index.json'), []);
});

export const getClub = cache((slug: string): ClubIndexEntry => {
  const entry = getClubIndex().find((c) => c.slug === slug);
  if (!entry) throw new Error(`Unknown club: ${slug}`);
  return entry;
});

export const getSeasonRows = cache((slug: string): SeasonRow[] => {
  return readJson<SeasonRow[]>(join(clubDir(slug), 'seasons.json'), []);
});

export const getMatches = cache((slug: string): MatchRow[] => {
  return readJson<MatchRow[]>(join(clubDir(slug), 'matches.json'), []);
});

export const getKeepers = cache((slug: string): KeepersData => {
  return readJson<KeepersData>(join(clubDir(slug), 'keepers.json'), {
    matchLog: [],
    perGkSeason: [],
    psxg: [],
    psxgPerGk: [],
  });
});

export const getSquad = cache((slug: string): SquadData => {
  return readJson<SquadData>(join(clubDir(slug), 'squad.json'), {
    updated: null,
    players: [],
    seasons: {},
  });
});

export const getPlayers = cache((slug: string): PlayersData => {
  return readJson<PlayersData>(join(clubDir(slug), 'players.json'), {
    seasons: {},
    latest: '',
  });
});

export const getTeamStats = cache((slug: string): TeamStatsBySeason => {
  return readJson<TeamStatsBySeason>(join(clubDir(slug), 'teamstats.json'), {});
});

interface ManagersFile {
  [slug: string]: { sourceURL?: string; stints?: ManagerStint[] };
}

export const getManagers = cache((slug: string): ManagerStint[] => {
  const all = readJson<ManagersFile>(join(BUILT, 'managers.json'), {});
  return all[slug]?.stints ?? [];
});

export const getLeague = cache((): LeagueData => {
  return readJson<{ seasons?: LeagueData }>(join(BUILT, 'league.json'), {})
    .seasons ?? {};
});

export const getSquadCompare = cache(
  (): import('./types').SquadCompareData => {
    const out: import('./types').SquadCompareData = {};
    for (const c of getClubIndex()) {
      const seasons = getSquad(c.slug).seasons ?? {};
      for (const [season, s] of Object.entries(seasons)) {
        const withAge = s.players.filter((p) => p.age != null);
        const top = s.players.reduce<(typeof s.players)[number] | null>(
          (best, p) =>
            (p.yearlyGross ?? 0) > (best?.yearlyGross ?? 0) ? p : best,
          null,
        );
        (out[season] ??= {})[c.slug] = {
          players: s.players.length,
          avgAge: withAge.length
            ? withAge.reduce((a, p) => a + (p.age ?? 0), 0) / withAge.length
            : null,
          weeklyBill:
            s.summary?.grossWeekly ??
            (s.players.reduce((a, p) => a + (p.weeklyGross ?? 0), 0) ||
              null),
          yearlyBill:
            s.summary?.grossYearly ??
            (s.players.reduce((a, p) => a + (p.yearlyGross ?? 0), 0) ||
              null),
          topEarner: top?.yearlyGross ? top.name : null,
        };
      }
    }
    return out;
  },
);

export const getLeagueSeason = cache((season: string) => {
  return readJson<import('./types').LeagueSeasonData | null>(
    join(process.cwd(), 'public', 'data', 'league', `${season}.json`),
    null
  );
});
