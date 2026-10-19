import type { MatchRow, ManagerStint } from './types';

export type { ManagerStint };

export function stintId(stint: ManagerStint): string {
  const slug = stint.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug}-${stint.from}`;
}

export function managerForDate(
  stints: ManagerStint[],
  date: string,
): ManagerStint | null {
  let best: ManagerStint | null = null;
  for (const m of stints) {
    if (date < m.from || (m.to != null && date > m.to)) continue;
    if (
      !best ||
      m.from > best.from ||
      (m.from === best.from && (m.to ?? '9999') < (best.to ?? '9999'))
    )
      best = m;
  }
  return best;
}

export interface ManagerStats {
  id: string;
  season: string | null; // null = whole-stint aggregate
  mp: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  cs: number;
  xg: number | null;
  xga: number | null;
  first: string; // first match date
  last: string; // last match date
}

function blank(id: string, season: string | null): ManagerStats {
  return { id, season, mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, cs: 0, xg: null, xga: null, first: '', last: '' };
}

function addMatch(s: ManagerStats, m: MatchRow) {
  if (m.result !== 'W' && m.result !== 'D' && m.result !== 'L') return;
  if (m.gf == null || m.ga == null) return;
  s.mp += 1;
  s[m.result.toLowerCase() as 'w' | 'd' | 'l'] += 1;
  s.gf += m.gf;
  s.ga += m.ga;
  if (m.ga === 0) s.cs += 1;
  if (m.xg != null) s.xg = (s.xg ?? 0) + m.xg;
  if (m.xga != null) s.xga = (s.xga ?? 0) + m.xga;
  if (!s.first || m.date < s.first) s.first = m.date;
  if (m.date > s.last) s.last = m.date;
}

/** Aggregate matches into per-stint stats plus per-season breakdowns. */
export function aggregateManagers(
  stints: ManagerStint[],
  matches: MatchRow[],
): Map<string, { total: ManagerStats; seasons: ManagerStats[] }> {
  const out = new Map<string, { total: ManagerStats; seasons: ManagerStats[] }>();
  for (const stint of stints) {
    out.set(stintId(stint), { total: blank(stintId(stint), null), seasons: [] });
  }
  const seasonMap = new Map<string, ManagerStats>();
  for (const m of matches) {
    const stint = managerForDate(stints, m.date);
    if (!stint) continue;
    const id = stintId(stint);
    addMatch(out.get(id)!.total, m);
    const key = `${id}|${m.season}`;
    let s = seasonMap.get(key);
    if (!s) {
      s = blank(id, m.season);
      seasonMap.set(key, s);
      out.get(id)!.seasons.push(s);
    }
    addMatch(s, m);
  }
  for (const v of out.values()) {
    v.seasons.sort((a, b) => (a.season ?? '').localeCompare(b.season ?? ''));
  }
  return out;
}

export const ptsOf = (s: ManagerStats) => 3 * s.w + s.d;
export const perMp = (n: number, mp: number) => (mp > 0 ? n / mp : null);
export const winPct = (s: ManagerStats) => (s.mp > 0 ? s.w / s.mp : null);
export const csPct = (s: ManagerStats) => (s.mp > 0 ? s.cs / s.mp : null);
