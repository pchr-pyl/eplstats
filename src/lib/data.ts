import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { cache } from 'react';
import type { SeasonRow, MatchRow, KeepersData, SquadData, PlayersData, AttackBySeason } from './types';

const DATA_DIR = join(process.cwd(), 'data');
const JSON_PATH = join(DATA_DIR, 'man-utd-seasons.json');
const CSV_PATH = join(DATA_DIR, 'man-utd-seasons.csv');
const MATCHES_PATH = join(DATA_DIR, 'man-utd-matches.json');
const ATTACK_PATH = join(DATA_DIR, 'man-utd-attack.json');
const KEEPERS_PATH = join(DATA_DIR, 'man-utd-keepers.json');
const SQUAD_PATH = join(DATA_DIR, 'man-utd-squad.json');
const PLAYERS_PATH = join(DATA_DIR, 'man-utd-players.json');

const NUMERIC_FIELDS: ReadonlyArray<keyof SeasonRow> = [
  'mp',
  'w',
  'd',
  'l',
  'gf',
  'ga',
  'gd',
  'pts',
  'ptsPerMp',
  'xg',
  'xga',
  'xgd',
  'sota',
  'cs',
  'attendance',
];

function normalizeHeader(raw: string): keyof SeasonRow | 'ignore' {
  const h = raw.trim();
  const map: Record<string, keyof SeasonRow> = {
    season: 'season',
    seasonstart: 'season',
    competition: 'competition',
    comp: 'competition',
    rank: 'rank',
    lgrank: 'rank',
    mp: 'mp',
    w: 'w',
    d: 'd',
    l: 'l',
    gf: 'gf',
    ga: 'ga',
    gd: 'gd',
    pts: 'pts',
    ptsmp: 'ptsPerMp',
    ptsg: 'ptsPerMp',
    ptspermp: 'ptsPerMp',
    ptspergame: 'ptsPerMp',
    xg: 'xg',
    xga: 'xga',
    xgd: 'xgd',
    sota: 'sota',
    cs: 'cs',
    attendance: 'attendance',
    topteamscorer: 'topScorer',
    topgoals: 'topScorer',
    topscorer: 'topScorer',
    goalkeeper: 'goalkeeper',
    gk: 'goalkeeper',
    notes: 'notes',
  };
  const key = h.toLowerCase().replace(/[^a-z]/g, '');
  return map[key] ?? 'ignore';
}

function parseNumberCell(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '' || trimmed.toLowerCase() === 'nan') return null;
  const n = Number(trimmed);
  return Number.isNaN(n) ? null : n;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;
  while (i < line.length) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 2;
      } else {
        inQuotes = !inQuotes;
        i += 1;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
      i += 1;
    } else {
      current += char;
      i += 1;
    }
  }
  fields.push(current);
  return fields;
}

function parseSeasonsFromCsv(text: string): SeasonRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const rows: SeasonRow[] = [];

  for (let idx = 1; idx < lines.length; idx += 1) {
    const cells = parseCsvLine(lines[idx]);
    const parsed: Record<keyof SeasonRow, unknown> = {
      season: '',
      competition: '',
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

    for (let c = 0; c < headers.length; c += 1) {
      const key = headers[c];
      if (key === 'ignore') continue;
      const value = cells[c] ?? '';
      if (NUMERIC_FIELDS.includes(key)) {
        parsed[key] = parseNumberCell(value);
      } else {
        const trimmed = value.trim();
        parsed[key] = trimmed === '' ? null : trimmed;
      }
    }

    if (!parsed.competition) parsed.competition = '';

    rows.push(parsed as SeasonRow);
  }

  return rows;
}

export const getSeasonRows = cache((): SeasonRow[] => {
  if (existsSync(JSON_PATH)) {
    const text = readFileSync(JSON_PATH, 'utf-8');
    return JSON.parse(text) as SeasonRow[];
  }

  if (existsSync(CSV_PATH)) {
    const text = readFileSync(CSV_PATH, 'utf-8');
    return parseSeasonsFromCsv(text);
  }

  throw new Error('Data file not found: expected data/man-utd-seasons.json or .csv');
});

export const getMatches = cache((): MatchRow[] => {
  if (!existsSync(MATCHES_PATH)) return [];
  const text = readFileSync(MATCHES_PATH, 'utf-8');
  return JSON.parse(text) as MatchRow[];
});

export const getKeepers = cache((): KeepersData => {
  if (!existsSync(KEEPERS_PATH)) {
    return { matchLog: [], perGkSeason: [], psxg: [], psxgPerGk: [] };
  }
  const text = readFileSync(KEEPERS_PATH, 'utf-8');
  return JSON.parse(text) as KeepersData;
});

export const getSquad = cache((): SquadData => {
  if (!existsSync(SQUAD_PATH)) {
    return { updated: null, players: [] };
  }
  const text = readFileSync(SQUAD_PATH, 'utf-8');
  return JSON.parse(text) as SquadData;
});

export const getPlayers = cache((): PlayersData => {
  if (!existsSync(PLAYERS_PATH)) {
    return { seasons: {}, latest: '' };
  }
  const text = readFileSync(PLAYERS_PATH, 'utf-8');
  return JSON.parse(text) as PlayersData;
});

export const getAttack = cache((): AttackBySeason => {
  if (!existsSync(ATTACK_PATH)) return {};
  const text = readFileSync(ATTACK_PATH, 'utf-8');
  return JSON.parse(text) as AttackBySeason;
});
