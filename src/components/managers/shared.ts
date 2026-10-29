import type { CompGroup, MatchRow, ManagerStint } from '@/lib/types';
import { managerForDate, stintId } from '@/lib/managers';

export type Lang = 'th' | 'en';

export interface StatBase {
  mp: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  cs: number;
  xg: number;
  xga: number;
  xgN: number;
  first: string;
  last: string;
}

export interface SeasonStat extends StatBase {
  season: string;
}

export interface StintStat extends StatBase {
  stint: ManagerStint;
  id: string;
  games: MatchRow[];
  seasons: SeasonStat[];
}

const blank = (): StatBase => ({
  mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, cs: 0,
  xg: 0, xga: 0, xgN: 0, first: '', last: '',
});

/** Matches with a real result (W/D/L + goals), chronological. */
export function played(matches: MatchRow[]): MatchRow[] {
  return matches
    .filter(
      (m) =>
        (m.result === 'W' || m.result === 'D' || m.result === 'L') &&
        m.gf != null &&
        m.ga != null,
    )
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''));
}

function addMatch(s: StatBase, m: MatchRow) {
  s.mp += 1;
  if (m.result === 'W') s.w += 1;
  else if (m.result === 'D') s.d += 1;
  else s.l += 1;
  s.gf += m.gf ?? 0;
  s.ga += m.ga ?? 0;
  if (m.ga === 0) s.cs += 1;
  if (m.xg != null) s.xg += m.xg;
  if (m.xga != null) s.xga += m.xga;
  if (m.xg != null || m.xga != null) s.xgN += 1;
  if (!s.first || m.date < s.first) s.first = m.date;
  if (m.date > s.last) s.last = m.date;
}

/** Per-stint aggregates + per-season breakdowns for already-filtered matches. */
export function buildStints(stints: ManagerStint[], matches: MatchRow[]): StintStat[] {
  const map = new Map<string, StintStat>();
  for (const stint of stints) {
    const id = stintId(stint);
    map.set(id, { ...blank(), stint, id, games: [], seasons: [] });
  }
  const seasonMap = new Map<string, SeasonStat>();
  for (const m of played(matches)) {
    const stint = managerForDate(stints, m.date);
    if (!stint) continue;
    const id = stintId(stint);
    const s = map.get(id);
    if (!s) continue;
    addMatch(s, m);
    s.games.push(m);
    const key = `${id}|${m.season}`;
    let ss = seasonMap.get(key);
    if (!ss) {
      ss = { ...blank(), season: m.season };
      seasonMap.set(key, ss);
      s.seasons.push(ss);
    }
    addMatch(ss, m);
  }
  const out = [...map.values()];
  for (const s of out) s.seasons.sort((a, b) => a.season.localeCompare(b.season));
  return out;
}

/* derived rates --------------------------------------------------------- */

export const pts = (s: StatBase) => 3 * s.w + s.d;
export const ppg = (s: StatBase) => (s.mp > 0 ? pts(s) / s.mp : null);
export const winRate = (s: StatBase) => (s.mp > 0 ? s.w / s.mp : null);
export const gfPer = (s: StatBase) => (s.mp > 0 ? s.gf / s.mp : null);
export const gaPer = (s: StatBase) => (s.mp > 0 ? s.ga / s.mp : null);
export const csRate = (s: StatBase) => (s.mp > 0 ? s.cs / s.mp : null);
/** xG per match over the matches that actually have xG — NOT per mp. */
export const xgPer = (s: StatBase) => (s.xgN > 0 ? s.xg / s.xgN : null);
export const xgaPer = (s: StatBase) => (s.xgN > 0 ? s.xga / s.xgN : null);
export const xgdPer = (s: StatBase) => {
  const f = xgPer(s);
  const a = xgaPer(s);
  return f == null || a == null ? null : f - a;
};

/* names / dates ---------------------------------------------------------- */

export function displayName(stint: ManagerStint, lang: Lang): string {
  const base = lang === 'th' && stint.nameTh ? stint.nameTh : stint.name;
  return stint.coName ? `${base} & ${stint.coName}` : base;
}

/** Last-name part for compact labels: keeps lowercase particles (van, ten, de…). */
export function surname(stint: ManagerStint, lang: Lang = 'en'): string {
  if (lang === 'th' && stint.nameTh) {
    const w = stint.nameTh.trim().split(/\s+/);
    return w.length > 1 ? w.slice(1).join(' ') : stint.nameTh;
  }
  const words = stint.name.trim().split(/\s+/);
  let i = words.length - 1;
  while (i > 0 && /^[a-zà-ÿ]/.test(words[i - 1])) i--;
  return words.slice(i).join(' ') || stint.name;
}

export const isCurrent = (stint: ManagerStint) => stint.to == null;

/** Small-sample threshold: tighter for comp groups with few matches per manager. */
export function minSample(group: CompGroup): number {
  return group === 'all' || group === 'premier-league' ? 10 : 5;
}

/** Rolling-PPG window: 10 normally, shrunk for small filtered sets. */
export function rollingWindow(n: number): number {
  return n < 10 ? Math.max(3, n) : 10;
}

export function daysInCharge(stint: ManagerStint): number {
  const from = new Date(`${stint.from}T00:00:00Z`).getTime();
  const to = stint.to ? new Date(`${stint.to}T00:00:00Z`).getTime() : Date.now();
  return Math.max(0, Math.round((to - from) / 86400000));
}

/** Compact period: "2022–2024", "2026–…", or a short date range inside one year. */
export function periodShort(stint: ManagerStint, lang: Lang): string {
  const y1 = stint.from.slice(0, 4);
  const y2 = stint.to ? stint.to.slice(0, 4) : null;
  if (!y2) return `${y1}–${lang === 'th' ? 'ปัจจุบัน' : 'now'}`;
  if (y1 !== y2) return `${y1}–${y2}`;
  return `${stint.from} → ${y2 === y1 ? stint.to!.slice(5) : y2}`;
}

export const periodLong = (stint: ManagerStint, lang: Lang) =>
  `${stint.from} → ${stint.to ?? (lang === 'th' ? 'ปัจจุบัน' : 'present')}`;

/* rolling series + baseline ---------------------------------------------- */

export interface RollPoint {
  i: number;
  date: string;
  season: string;
  opp: string | null;
  result: 'W' | 'D' | 'L';
  ppg: number | null;
  sid: string | null;
}

/** Rolling N-match PPG across ALL played matches; each point tagged with stint id. */
export function rollingPpg(games: MatchRow[], stints: ManagerStint[]): RollPoint[] {
  const w = rollingWindow(games.length);
  return games.map((m, i) => {
    let p: number | null = null;
    if (i >= w - 1) {
      let sum = 0;
      for (let k = i - w + 1; k <= i; k++)
        sum += games[k].result === 'W' ? 3 : games[k].result === 'D' ? 1 : 0;
      p = sum / w;
    }
    const stint = managerForDate(stints, m.date);
    return {
      i,
      date: m.date,
      season: m.season,
      opp: m.opponent,
      result: m.result as 'W' | 'D' | 'L',
      ppg: p,
      sid: stint ? stintId(stint) : null,
    };
  });
}

/** Consecutive runs of the same stint in the rolling series (for chart bands). */
export function stintRuns(roll: RollPoint[]): { sid: string | null; x1: number; x2: number }[] {
  const runs: { sid: string | null; x1: number; x2: number }[] = [];
  for (const p of roll) {
    const last = runs[runs.length - 1];
    if (last && last.sid === p.sid) last.x2 = p.i;
    else runs.push({ sid: p.sid, x1: p.i, x2: p.i });
  }
  return runs;
}

/** Overall club PPG across the played set. */
export function clubPpg(games: MatchRow[]): number | null {
  if (games.length === 0) return null;
  let sum = 0;
  for (const m of games) sum += m.result === 'W' ? 3 : m.result === 'D' ? 1 : 0;
  return sum / games.length;
}

export interface VariantProps {
  data: StintStat[];
  roll: RollPoint[];
  baseline: number | null;
  lang: Lang;
  hasXg: boolean;
  minN: number;
}
