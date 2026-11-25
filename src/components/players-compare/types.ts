import type { ClubIndexEntry } from '@/lib/types';
import { fmt } from '@/lib/format';

export interface PcSeason {
  season: string;
  cols: string[];
  rows: (string | number | null)[][];
}

export type PosCode = 'FW' | 'MF' | 'DF';
export type PeerScope = 'pos' | 'all';
export type ViewMode = 'per90' | 'totals';
export type CatId = 'scoring' | 'creation' | 'shooting' | 'avail';

export interface DemoPlayer {
  key: string;
  club: string;
  name: string;
  posRaw: string;
  pos: PosCode;
  age: number | null;
  mp: number;
  starts: number;
  min: number;
  gls: number;
  ast: number;
  pk: number;
  pkatt: number;
  sh: number;
  sot: number;
  y: number;
  r: number;
  eligible: boolean;
  /** Per-90 and rate metrics */
  v: Record<string, number | null>;
  /** Raw season totals / counts */
  tot: Record<string, number | null>;
}

export interface DemoMetric {
  id: string;
  cat: CatId;
  en: string;
  th: string;
  shortEn: string;
  shortTh: string;
  lowerBetter?: boolean;
  unit?: '%';
  int?: boolean;
  pizza?: boolean;
  /** Optional raw total key shown in Totals mode (falls back to id) */
  totalId?: string;
  totalInt?: boolean;
  totalEn?: string;
  totalTh?: string;
}

export const DEMO_METRICS: DemoMetric[] = [
  {
    id: 'gls90', cat: 'scoring', en: 'Goals / 90', th: 'ประตู / 90',
    shortEn: 'Goals', shortTh: 'ประตู', pizza: true,
    totalId: 'gls', totalInt: true, totalEn: 'Goals', totalTh: 'ประตูรวม',
  },
  {
    id: 'npg90', cat: 'scoring', en: 'Non-penalty goals / 90', th: 'ประตูไม่รวมจุดโทษ / 90',
    shortEn: 'NP Goals', shortTh: 'ไม่รวมจุดโทษ', pizza: true,
    totalId: 'npg', totalInt: true, totalEn: 'Non-penalty goals', totalTh: 'ประตูไม่รวมจุดโทษ',
  },
  {
    id: 'ga90', cat: 'scoring', en: 'Goals + assists / 90', th: 'ประตู + แอสซิสต์ / 90',
    shortEn: 'G+A', shortTh: 'G+A', pizza: true,
    totalId: 'ga', totalInt: true, totalEn: 'Goals + assists', totalTh: 'ประตู + แอสซิสต์',
  },
  {
    id: 'ast90', cat: 'creation', en: 'Assists / 90', th: 'แอสซิสต์ / 90',
    shortEn: 'Assists', shortTh: 'แอสซิสต์', pizza: true,
    totalId: 'ast', totalInt: true, totalEn: 'Assists', totalTh: 'แอสซิสต์รวม',
  },
  {
    id: 'sh90', cat: 'shooting', en: 'Shots / 90', th: 'ยิง / 90',
    shortEn: 'Shots', shortTh: 'ยิง', pizza: true,
    totalId: 'sh', totalInt: true, totalEn: 'Total shots', totalTh: 'จำนวนการยิง',
  },
  {
    id: 'sot90', cat: 'shooting', en: 'Shots on target / 90', th: 'ยิงตรงกรอบ / 90',
    shortEn: 'On target', shortTh: 'ตรงกรอบ', pizza: true,
    totalId: 'sot', totalInt: true, totalEn: 'Shots on target', totalTh: 'ยิงตรงกรอบรวม',
  },
  {
    id: 'sotPct', cat: 'shooting', en: 'Shot accuracy %', th: 'ความแม่นยำการยิง %',
    shortEn: 'Accuracy', shortTh: 'แม่นยำ', unit: '%', pizza: true,
  },
  {
    id: 'gSh', cat: 'shooting', en: 'Goals / shot', th: 'ประตู / การยิง',
    shortEn: 'Goals/Shot', shortTh: 'ประตู/ยิง', pizza: true,
  },
  {
    id: 'gSot', cat: 'shooting', en: 'Goals / shot on target', th: 'ประตู / ยิงตรงกรอบ',
    shortEn: 'G/SoT', shortTh: 'ประตู/ตรงกรอบ',
  },
  {
    id: 'share', cat: 'avail', en: 'Minutes share of team', th: 'สัดส่วนนาทีของทีม',
    shortEn: 'Minutes', shortTh: 'นาทีเล่น', unit: '%', pizza: true,
  },
  {
    id: 'card90', cat: 'avail', en: 'Cards / 90', th: 'ใบเตือน / 90',
    shortEn: 'Discipline', shortTh: 'วินัย', lowerBetter: true, pizza: true,
    totalId: 'cards', totalInt: true, totalEn: 'Cards (Y + 2×R)', totalTh: 'ใบเตือน (เหลือง+2แดง)',
  },
  {
    id: 'minPerMp', cat: 'avail', en: 'Minutes / match', th: 'นาที / นัด',
    shortEn: 'Min/MP', shortTh: 'นาที/นัด',
  },
  {
    id: 'min', cat: 'avail', en: 'Minutes played', th: 'นาทีที่ลงเล่น',
    shortEn: 'Min', shortTh: 'นาที', int: true,
  },
  {
    id: 'starts', cat: 'avail', en: 'Starts', th: 'ลงตัวจริง',
    shortEn: 'Starts', shortTh: 'ตัวจริง', int: true,
  },
  {
    id: 'mp', cat: 'avail', en: 'Matches played', th: 'จำนวนนัด',
    shortEn: 'MP', shortTh: 'นัด', int: true,
  },
];

export const PIZZA_METRICS = DEMO_METRICS.filter((m) => m.pizza);

export const CAT_META: { id: CatId; en: string; th: string; accent: string }[] = [
  { id: 'scoring', en: 'Scoring', th: 'การทำประตู', accent: '#ef4444' },
  { id: 'creation', en: 'Creation', th: 'การสร้างสรรค์', accent: '#3b82f6' },
  { id: 'shooting', en: 'Shooting & Efficiency', th: 'การยิงและความคม', accent: '#f59e0b' },
  { id: 'avail', en: 'Availability & Discipline', th: 'ความสม่ำเสมอและวินัย', accent: '#10b981' },
];

export const POS_LABELS: Record<PosCode, { en: string; th: string }> = {
  FW: { en: 'Forward', th: 'กองหน้า' },
  MF: { en: 'Midfielder', th: 'กองกลาง' },
  DF: { en: 'Defender', th: 'กองหลัง' },
};

export interface FeaturedMatchup {
  id: string;
  en: string;
  th: string;
  tagEn: string;
  tagTh: string;
  seasonA: string;
  keyA: string;
  seasonB: string;
  keyB: string;
}

export const FEATURED_MATCHUPS: FeaturedMatchup[] = [
  {
    id: 'haaland-bruno-2526',
    en: 'Haaland vs Bruno (25/26)',
    th: 'ฮาแลนด์ vs บรูโน่ (25/26)',
    tagEn: 'Finisher vs Creator',
    tagTh: 'ดาวยิง vs เพลย์เมกเกอร์',
    seasonA: '2025-2026',
    keyA: 'man-city|Erling Haaland',
    seasonB: '2025-2026',
    keyB: 'man-utd|Bruno Fernandes',
  },
  {
    id: 'salah-2425-haaland-2223',
    en: 'Salah 24/25 vs Haaland 22/23',
    th: 'ซาลาห์ 24/25 vs ฮาแลนด์ 22/23',
    tagEn: 'Cross-Era Peak',
    tagTh: 'เทียบยุคพีค',
    seasonA: '2024-2025',
    keyA: 'liverpool|Mohamed Salah',
    seasonB: '2022-2023',
    keyB: 'man-city|Erling Haaland',
  },
  {
    id: 'salah-evolution',
    en: 'Salah 17/18 vs Salah 24/25',
    th: 'ซาลาห์ 17/18 vs 24/25',
    tagEn: 'Career Evolution',
    tagTh: 'วิวัฒนาการ',
    seasonA: '2017-2018',
    keyA: 'liverpool|Mohamed Salah',
    seasonB: '2024-2025',
    keyB: 'liverpool|Mohamed Salah',
  },
  {
    id: 'haaland-isak-2627',
    en: 'Haaland vs Isak (26/27)',
    th: 'ฮาแลนด์ vs อิซัค (26/27)',
    tagEn: 'Live Season',
    tagTh: 'ฤดูกาลล่าสุด',
    seasonA: '2026-2027',
    keyA: 'man-city|Erling Haaland',
    seasonB: '2026-2027',
    keyB: 'liverpool|Alexander Isak',
  },
  {
    id: 'haaland-kane-2223',
    en: 'Haaland vs Kane (22/23)',
    th: 'ฮาแลนด์ vs เคน (22/23)',
    tagEn: '36G vs 30G Classic',
    tagTh: 'ศึก 36 ประตู vs 30 ประตู',
    seasonA: '2022-2023',
    keyA: 'man-city|Erling Haaland',
    seasonB: '2022-2023',
    keyB: 'tottenham|Harry Kane',
  },
];

function toPosCode(raw: string): PosCode {
  const first = raw.split(',')[0]?.trim().toUpperCase();
  if (first === 'FW' || first === 'MF' || first === 'DF') return first;
  return 'MF';
}

export function buildDemoPool(data: PcSeason): DemoPlayer[] {
  const ix = Object.fromEntries(data.cols.map((c, i) => [c, i]));
  const n = (r: (string | number | null)[], c: string) => Number(r[ix[c]] ?? 0) || 0;
  const clubMax = new Map<string, number>();
  for (const r of data.rows) {
    const c = String(r[ix.club]);
    clubMax.set(c, Math.max(clubMax.get(c) ?? 0, n(r, 'min')));
  }
  const out: DemoPlayer[] = [];
  for (const r of data.rows) {
    const posRaw = String(r[ix.pos] ?? '');
    if (posRaw.split(',')[0] === 'GK') continue;
    const club = String(r[ix.club]);
    const name = String(r[ix.player]);
    const mp = n(r, 'mp');
    const starts = n(r, 'starts');
    const min = n(r, 'min');
    const gls = n(r, 'gls');
    const ast = n(r, 'ast');
    const pk = n(r, 'pk');
    const pkatt = n(r, 'pkatt');
    const sh = n(r, 'sh');
    const sot = n(r, 'sot');
    const y = n(r, 'crdY');
    const rd = n(r, 'crdR');
    const per = (x: number) => (min > 0 ? (x / min) * 90 : null);
    const teamMax = clubMax.get(club) || 1;
    const npg = Math.max(0, gls - pk);
    const ga = gls + ast;
    const cards = y + rd * 2;
    out.push({
      key: `${club}|${name}`,
      club,
      name,
      posRaw: posRaw || 'MF',
      pos: toPosCode(posRaw),
      age: r[ix.age] == null ? null : Number(r[ix.age]),
      mp,
      starts,
      min,
      gls,
      ast,
      pk,
      pkatt,
      sh,
      sot,
      y,
      r: rd,
      eligible: min >= 0.3 * teamMax,
      v: {
        gls90: per(gls),
        npg90: per(npg),
        ga90: per(ga),
        ast90: per(ast),
        sh90: per(sh),
        sot90: per(sot),
        sotPct: sh > 0 ? (sot / sh) * 100 : null,
        gSh: sh > 0 ? gls / sh : null,
        gSot: sot > 0 ? gls / sot : null,
        share: (min / teamMax) * 100,
        card90: per(cards),
        minPerMp: mp > 0 ? min / mp : null,
        min,
        starts,
        mp,
      },
      tot: {
        gls,
        npg,
        ga,
        ast,
        sh,
        sot,
        sotPct: sh > 0 ? (sot / sh) * 100 : null,
        gSh: sh > 0 ? gls / sh : null,
        gSot: sot > 0 ? gls / sot : null,
        share: (min / teamMax) * 100,
        cards,
        minPerMp: mp > 0 ? min / mp : null,
        min,
        starts,
        mp,
      },
    });
  }
  return out;
}

export interface RankResult {
  pct: number | null;
  rank: number | null;
  total: number;
}

export function rankInPool(
  pool: DemoPlayer[],
  p: DemoPlayer,
  m: DemoMetric,
  scope: PeerScope = 'pos',
): RankResult {
  const v = p.v[m.id];
  const peers = pool.filter(
    (q) => (scope === 'all' || q.pos === p.pos) && q.eligible && q.v[m.id] != null,
  );
  if (v == null || !peers.length) return { pct: null, rank: null, total: peers.length };
  const worse = peers.filter((q) => (m.lowerBetter ? q.v[m.id]! > v : q.v[m.id]! < v)).length;
  const better = peers.filter((q) => (m.lowerBetter ? q.v[m.id]! < v : q.v[m.id]! > v)).length;
  const same = peers.length - worse - better;
  const pc = ((worse + same / 2) / peers.length) * 99;
  return {
    pct: Math.max(1, Math.min(99, Math.round(pc))),
    rank: better + 1,
    total: peers.length,
  };
}

export function formatMetricVal(m: DemoMetric, p: DemoPlayer, mode: ViewMode): string {
  const useTot = mode === 'totals' && m.totalId != null;
  const val = useTot ? p.tot[m.totalId!] : p.v[m.id];
  if (val == null || Number.isNaN(val)) return '—';
  if ((useTot && m.totalInt) || (!useTot && m.int)) return String(Math.round(val));
  return m.unit === '%' ? `${fmt(val, 2)}%` : fmt(val, 2);
}

export function rawMetricVal(m: DemoMetric, p: DemoPlayer, mode: ViewMode): number | null {
  const useTot = mode === 'totals' && m.totalId != null;
  return useTot ? (p.tot[m.totalId!] ?? null) : (p.v[m.id] ?? null);
}

export function formatDelta(m: DemoMetric, diff: number | null, mode: ViewMode): string {
  if (diff == null || Number.isNaN(diff) || Math.abs(diff) < 0.005) return '0';
  const useTot = mode === 'totals' && m.totalId != null;
  const isInt = (useTot && m.totalInt) || (!useTot && m.int);
  const sign = diff > 0 ? '+' : '';
  if (isInt) return `${sign}${Math.round(diff)}`;
  return m.unit === '%' ? `${sign}${fmt(diff, 2)}%` : `${sign}${fmt(diff, 2)}`;
}

/* ----------------------------------------------------- style archetypes */
export interface ArchetypeBadge {
  id: string;
  en: string;
  th: string;
  tone: 'scoring' | 'creation' | 'shooting' | 'avail';
}

export function detectArchetypes(p: DemoPlayer, pool: DemoPlayer[]): ArchetypeBadge[] {
  const pct = (id: string) => {
    const m = DEMO_METRICS.find((x) => x.id === id);
    return m ? (rankInPool(pool, p, m, 'pos').pct ?? 0) : 0;
  };
  const out: ArchetypeBadge[] = [];
  const pGls = pct('gls90');
  const pNpg = pct('npg90');
  const pAst = pct('ast90');
  const pSh = pct('sh90');
  const pGsh = pct('gSh');
  const pSot = pct('sotPct');
  const pShare = pct('share');
  const pCard = pct('card90');

  if (pGls >= 82 && pAst >= 78) {
    out.push({ id: 'dual', en: 'Dual Threat', th: 'ครบเครื่องยิง-จ่าย', tone: 'scoring' });
  } else if (pGls >= 85 && pGsh >= 75) {
    out.push({ id: 'clinical', en: 'Clinical Finisher', th: 'เพชฌฆาตคมกริบ', tone: 'scoring' });
  } else if (pNpg >= 82) {
    out.push({ id: 'openplay', en: 'Open-Play Scorer', th: 'จอมจบสกอร์โอเพนเพลย์', tone: 'scoring' });
  }

  if (pAst >= 85) {
    out.push({ id: 'creator', en: 'Creative Engine', th: 'จอมแอสซิสต์', tone: 'creation' });
  }
  if (pSh >= 84 && out.length < 3) {
    out.push({ id: 'volume', en: 'Volume Shooter', th: 'จอมส่องไกล/หาจังหวะยิง', tone: 'shooting' });
  } else if (pSot >= 82 && p.sh >= 15 && out.length < 3) {
    out.push({ id: 'sniper', en: 'High Accuracy', th: 'ยิงตรงกรอบสูง', tone: 'shooting' });
  }
  if (pShare >= 88 && out.length < 3) {
    out.push({ id: 'ironman', en: 'Ironman', th: 'แกนหลักลงแทบครบ', tone: 'avail' });
  }
  if (p.pk >= 3 && out.length < 3) {
    out.push({ id: 'pk', en: 'Spot-Kick Specialist', th: 'มือสังหารจุดโทษ', tone: 'scoring' });
  }
  if (pCard >= 85 && p.min >= 900 && out.length < 3) {
    out.push({ id: 'clean', en: 'Clean Discipline', th: 'วินัยดีเยี่ยม', tone: 'avail' });
  }
  if (p.mp >= 10 && p.starts / Math.max(1, p.mp) < 0.45 && p.v.ga90 != null && p.v.ga90 >= 0.45 && out.length < 3) {
    out.push({ id: 'supersub', en: 'Impact Sub', th: 'ซูเปอร์ซับ', tone: 'creation' });
  }
  if (!out.length) {
    out.push({ id: 'balanced', en: 'Balanced Contributor', th: 'สมดุลรอบด้าน', tone: 'avail' });
  }
  return out.slice(0, 3);
}

/* ------------------------------------------------------ similar players */
export interface SimilarMatch {
  player: DemoPlayer;
  similarity: number; // 0..100
}

export function findSimilarPlayers(
  target: DemoPlayer,
  pool: DemoPlayer[],
  excludeKeys: string[],
  limit = 5,
): SimilarMatch[] {
  const vec = (p: DemoPlayer) =>
    PIZZA_METRICS.map((m) => rankInPool(pool, p, m, 'pos').pct ?? 50);
  const tv = vec(target);
  const candidates = pool.filter(
    (q) => q.pos === target.pos && q.eligible && !excludeKeys.includes(q.key),
  );
  const maxDist = Math.sqrt(PIZZA_METRICS.length * 98 * 98);
  return candidates
    .map((q) => {
      const qv = vec(q);
      let sumSq = 0;
      for (let i = 0; i < tv.length; i++) {
        const d = tv[i] - qv[i];
        sumSq += d * d;
      }
      const dist = Math.sqrt(sumSq);
      const similarity = Math.max(0, Math.min(99.9, (1 - dist / maxDist) * 100));
      return { player: q, similarity };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

export function profileOverlapScore(
  a: DemoPlayer,
  poolA: DemoPlayer[],
  b: DemoPlayer,
  poolB: DemoPlayer[],
  scope: PeerScope,
): number {
  let sumSq = 0;
  let count = 0;
  for (const m of PIZZA_METRICS) {
    const pa = rankInPool(poolA, a, m, scope).pct;
    const pb = rankInPool(poolB, b, m, scope).pct;
    if (pa != null && pb != null) {
      sumSq += (pa - pb) ** 2;
      count++;
    }
  }
  if (!count) return 50;
  const maxDist = Math.sqrt(count * 98 * 98);
  return Math.max(1, Math.min(99, Math.round((1 - Math.sqrt(sumSq) / maxDist) * 100)));
}

/* ------------------------------------------- smart contrasting colors */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return [218, 41, 28];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbDist(a: string, b: string): number {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  // Weighted perceptual Euclidean distance
  return Math.sqrt(2 * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + 3 * (b1 - b2) ** 2);
}

export function resolvePairColors(
  clubA: ClubIndexEntry | undefined,
  clubB: ClubIndexEntry | undefined,
  dark: boolean,
): { colorA: string; colorB: string } {
  const fallbackA = dark ? '#ef3b2d' : '#da291c';
  const fallbackB = dark ? '#38bdf8' : '#2563eb';
  const altTeal = dark ? '#2dd4bf' : '#0d9488';
  const altAmber = dark ? '#fbbf24' : '#d97706';

  const rawA = (dark ? clubA?.brandDark : clubA?.brandLight) || clubA?.color || fallbackA;
  const rawB = (dark ? clubB?.brandDark : clubB?.brandLight) || clubB?.color || fallbackB;

  if (clubA?.slug !== clubB?.slug && rgbDist(rawA, rawB) >= 165) {
    return { colorA: rawA, colorB: rawB };
  }

  // Pick the fallback accent farthest from rawA
  const candidates = [fallbackB, altTeal, altAmber, fallbackA];
  let best = fallbackB;
  let bestDist = -1;
  for (const c of candidates) {
    const d = rgbDist(rawA, c);
    if (d > bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return { colorA: rawA, colorB: best };
}
