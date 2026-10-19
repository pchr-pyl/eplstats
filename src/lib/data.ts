import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { cache } from 'react';
import type {
  SeasonRow,
  MatchRow,
  KeepersData,
  SquadData,
  PlayersData,
  AttackBySeason,
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

export const getAttack = cache((slug: string): AttackBySeason => {
  return readJson<AttackBySeason>(join(clubDir(slug), 'attack.json'), {});
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

export const getLeagueSeason = cache((season: string) => {
  return readJson<import('./types').LeagueSeasonData | null>(
    join(process.cwd(), 'public', 'data', 'league', `${season}.json`),
    null
  );
});
