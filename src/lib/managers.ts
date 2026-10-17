import type { MatchRow } from './types';

export interface ManagerStint {
  id: string;
  name: string;
  nameTh: string;
  from: string; // ISO date, inclusive
  to: string | null; // ISO date, inclusive; null = present
  interim: boolean;
}

export const MANAGERS: ManagerStint[] = [
  { id: 'ferguson', name: 'Alex Ferguson', nameTh: 'อเล็กซ์ เฟอร์กูสัน', from: '1986-11-06', to: '2013-05-19', interim: false },
  { id: 'moyes', name: 'David Moyes', nameTh: 'เดวิด มอยส์', from: '2013-07-01', to: '2014-04-22', interim: false },
  { id: 'giggs', name: 'Ryan Giggs', nameTh: 'ไรอัน กิ๊กส์', from: '2014-04-23', to: '2014-05-11', interim: true },
  { id: 'van-gaal', name: 'Louis van Gaal', nameTh: 'หลุยส์ ฟาน คาล', from: '2014-07-14', to: '2016-05-23', interim: false },
  { id: 'mourinho', name: 'José Mourinho', nameTh: 'โชเซ่ มูรินโญ่', from: '2016-05-27', to: '2018-12-18', interim: false },
  { id: 'solskjaer', name: 'Ole Gunnar Solskjær', nameTh: 'โอเล่ กุนนาร์ โซลชาร์', from: '2018-12-19', to: '2021-11-21', interim: false },
  { id: 'carrick', name: 'Michael Carrick', nameTh: 'ไมเคิล คาร์ริค', from: '2021-11-22', to: '2021-12-02', interim: true },
  { id: 'rangnick', name: 'Ralf Rangnick', nameTh: 'ราล์ฟ รังนิค', from: '2021-12-03', to: '2022-05-31', interim: true },
  { id: 'ten-hag', name: 'Erik ten Hag', nameTh: 'เอริค เทน ฮาก', from: '2022-06-01', to: '2024-10-28', interim: false },
  { id: 'van-nistelrooy', name: 'Ruud van Nistelrooy', nameTh: 'รุด ฟาน นิสเตลรอย', from: '2024-10-29', to: '2024-11-10', interim: true },
  { id: 'amorim', name: 'Ruben Amorim', nameTh: 'รูเบน อาโมริม', from: '2024-11-11', to: null, interim: false },
];

export function managerForDate(date: string): ManagerStint | null {
  for (const m of MANAGERS) {
    if (date >= m.from && (m.to === null || date <= m.to)) return m;
  }
  return null;
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
export function aggregateManagers(matches: MatchRow[]): Map<string, { total: ManagerStats; seasons: ManagerStats[] }> {
  const out = new Map<string, { total: ManagerStats; seasons: ManagerStats[] }>();
  for (const stint of MANAGERS) {
    out.set(stint.id, { total: blank(stint.id, null), seasons: [] });
  }
  const seasonMap = new Map<string, ManagerStats>();
  for (const m of matches) {
    const stint = managerForDate(m.date);
    if (!stint) continue;
    addMatch(out.get(stint.id)!.total, m);
    const key = `${stint.id}|${m.season}`;
    let s = seasonMap.get(key);
    if (!s) {
      s = blank(stint.id, m.season);
      seasonMap.set(key, s);
      out.get(stint.id)!.seasons.push(s);
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
