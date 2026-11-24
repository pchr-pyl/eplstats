import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cache } from 'react';
import { getClubIndex } from '@/lib/data';
import type {
  MatchDetailData,
  PlayersSeason,
  SquadSeason,
} from '@/lib/types';
import type {
  PlayerRoleGroup,
  RosterPlayer,
  TacticalBootstrapData,
  TacticalClub,
} from './types';

const PUBLIC_DATA = join(process.cwd(), 'public', 'data');

function readJsonSafe<T>(filePath: string): T | null {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function normalizeNameKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function makeShortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return fullName.trim();
  const last = parts[parts.length - 1];
  const prev = parts[parts.length - 2];
  // Preserve particles like "van Dijk", "de Ligt", "Mac Allister"
  if (
    /^(van|de|del|da|dos|di|le|la|mac|mc|o'|st\.?|al|el)$/i.test(prev) &&
    parts.length >= 2
  ) {
    return `${prev} ${last}`;
  }
  return last;
}

function mapRoleGroup(
  rawPos: string | null | undefined,
  subPos?: string | null,
): PlayerRoleGroup {
  const sp = (subPos ?? '').toUpperCase();
  if (sp === 'GK') return 'GK';
  if (['CB', 'LB', 'RB', 'LWB', 'RWB', 'DF', 'D'].includes(sp)) return 'DF';
  if (['DM', 'CM', 'AM', 'LM', 'RM', 'MF', 'M'].includes(sp)) return 'MF';
  if (['CF', 'ST', 'LW', 'RW', 'FW', 'F'].includes(sp)) return 'FW';

  const p = (rawPos ?? '').toUpperCase();
  if (p.includes('GK') || p === 'G') return 'GK';
  if (p.startsWith('DF') || p === 'D') return 'DF';
  if (p.startsWith('MF') || p === 'M') return 'MF';
  if (p.startsWith('FW') || p === 'F') return 'FW';
  if (p.includes('DF')) return 'DF';
  if (p.includes('MF')) return 'MF';
  return 'FW';
}

function secondaryColorForClub(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return '#ffffff';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.65 ? '#111827' : '#ffffff';
}

/**
 * Extracts official real shirt numbers & latest sub-positions from match detail files
 * for the given season so we never fabricate shirt numbers.
 */
function collectRealMatchNumbers(targetSeason: string): Map<string, Map<string, { number: string; pos?: string }>> {
  const byClub = new Map<string, Map<string, { number: string; pos?: string }>>();
  const matchDir = join(PUBLIC_DATA, 'match');
  if (!existsSync(matchDir)) return byClub;

  const files = readdirSync(matchDir).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const m = readJsonSafe<MatchDetailData>(join(matchDir, file));
    if (!m || m.season !== targetSeason || !m.lineups) continue;

    const processSide = (
      slug: string | null | undefined,
      side: { xi: { name: string; number: string; pos?: string | null }[]; bench: { name: string; number: string; pos?: string | null }[] },
    ) => {
      if (!slug) return;
      let clubMap = byClub.get(slug);
      if (!clubMap) {
        clubMap = new Map();
        byClub.set(slug, clubMap);
      }
      for (const p of [...(side.xi ?? []), ...(side.bench ?? [])]) {
        const num = (p.number ?? '').trim();
        if (!p.name || !num) continue;
        const key = normalizeNameKey(p.name);
        if (!clubMap.has(key)) {
          clubMap.set(key, { number: num, pos: p.pos ?? undefined });
        }
      }
    };

    processSide(m.home?.slug, m.lineups.home);
    processSide(m.away?.slug, m.lineups.away);
  }

  return byClub;
}

// Module-level memo: bootstrap scans ~6.7k match files once per process
// (SSG build prerenders many pages; react cache() alone is per-request).
const g = globalThis as { __tacticalBootstrap?: TacticalBootstrapData };

/**
 * Server-side aggregator building real EPL clubs & rosters for the Tactical Board.
 * All players come from actual repo datasets (squad + players + match shirt numbers).
 */
export function getTacticalBootstrapData(): TacticalBootstrapData {
  if (g.__tacticalBootstrap) return g.__tacticalBootstrap;
  const result = buildTacticalBootstrapData();
  g.__tacticalBootstrap = result;
  return result;
}

const buildTacticalBootstrapData = cache((): TacticalBootstrapData => {
  const index = getClubIndex();
  const latestLeagueSeason = index.reduce(
    (best, c) => (c.latest > best ? c.latest : best),
    '2026-2027',
  );

  const matchNumbers = collectRealMatchNumbers(latestLeagueSeason);
  const clubs: TacticalClub[] = [];
  const rosters: Record<string, RosterPlayer[]> = {};

  // Sort: current PL clubs first alphabetically, then historical PL clubs alphabetically
  const sortedIndex = [...index].sort((a, b) => {
    const aCurr = a.latest === latestLeagueSeason ? 0 : 1;
    const bCurr = b.latest === latestLeagueSeason ? 0 : 1;
    if (aCurr !== bCurr) return aCurr - bCurr;
    return a.name.localeCompare(b.name);
  });

  for (const c of sortedIndex) {
    const season = c.latest;
    const playersFile = readJsonSafe<PlayersSeason>(
      join(PUBLIC_DATA, c.slug, `players-${season}.json`),
    );
    const squadFile = readJsonSafe<SquadSeason>(
      join(PUBLIC_DATA, c.slug, `squad-${season}.json`),
    );

    const clubNumbers = matchNumbers.get(c.slug);
    const merged = new Map<string, RosterPlayer>();

    // 1. Seed from squad file (has granular subPos like LB/RB/CB/DM/CM/AM/LW/RW/CF)
    for (const sp of squadFile?.players ?? []) {
      if (!sp.name) continue;
      const key = normalizeNameKey(sp.name);
      const matchInfo = clubNumbers?.get(key);
      merged.set(key, {
        id: `${c.slug}:${key.replace(/\s+/g, '-')}`,
        name: sp.name,
        shortName: makeShortName(sp.name),
        number: matchInfo?.number ?? '',
        pos: mapRoleGroup(sp.pos, sp.subPos ?? matchInfo?.pos),
        subPos: sp.subPos ?? matchInfo?.pos ?? null,
        clubSlug: c.slug,
        nation: sp.country ?? null,
        age: sp.age != null ? Math.round(sp.age) : null,
        starts: null,
        min: null,
        gls: null,
        ast: null,
        source: 'epl-data',
      });
    }

    // 2. Enrich / add from players stats file (has real starts, minutes, goals, assists)
    for (const pl of playersFile?.players ?? []) {
      if (!pl.player) continue;
      const key = normalizeNameKey(pl.player);
      const matchInfo = clubNumbers?.get(key);
      const existing = merged.get(key);
      if (existing) {
        existing.starts = pl.starts;
        existing.min = pl.min;
        existing.gls = pl.gls;
        existing.ast = pl.ast;
        if (!existing.number && matchInfo?.number) {
          existing.number = matchInfo.number;
        }
        if (pl.age != null) existing.age = pl.age;
      } else {
        merged.set(key, {
          id: `${c.slug}:${key.replace(/\s+/g, '-')}`,
          name: pl.player,
          shortName: makeShortName(pl.player),
          number: matchInfo?.number ?? '',
          pos: mapRoleGroup(pl.pos, matchInfo?.pos),
          subPos: matchInfo?.pos ?? null,
          clubSlug: c.slug,
          nation: pl.nation ?? null,
          age: pl.age ?? null,
          starts: pl.starts,
          min: pl.min,
          gls: pl.gls,
          ast: pl.ast,
          source: 'epl-data',
        });
      }
    }

    const list = Array.from(merged.values()).sort((a, b) => {
      const aMin = a.min ?? -1;
      const bMin = b.min ?? -1;
      if (bMin !== aMin) return bMin - aMin;
      return a.name.localeCompare(b.name);
    });

    if (list.length === 0) continue;

    clubs.push({
      slug: c.slug,
      name: c.name,
      shortName: c.shortName ?? c.name,
      nameTh: c.nameTh ?? null,
      color: c.color || '#da291c',
      secondaryColor: secondaryColorForClub(c.color || '#da291c'),
      logo: c.logo ?? `/logos/${c.slug}.png`,
      latestSeason: season,
      isCurrentPl: season === latestLeagueSeason,
    });
    rosters[c.slug] = list;
  }

  return {
    season: latestLeagueSeason,
    clubs,
    rosters,
  };
});
