'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, Search } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import type { ClubIndexEntry } from '@/lib/types';
import { fmt } from '@/lib/format';
import { seasonShort } from '@/lib/stats';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export interface PcSeason { season: string; cols: string[]; rows: (string | number | null)[][] }

interface P {
  key: string; club: string; name: string; pos: string; age: number | null;
  mp: number; starts: number; min: number; gls: number; ast: number; pk: number;
  sh: number; sot: number; y: number; r: number;
  v: Record<string, number | null>;
  eligible: boolean;
}

type Cat = 'scoring' | 'creation' | 'shooting' | 'avail';
interface Metric {
  id: string; cat: Cat; en: string; th: string; shortEn?: string; shortTh?: string;
  lowerBetter?: boolean; unit?: '%'; int?: boolean; pizza?: boolean;
}

const METRICS: Metric[] = [
  { id: 'gls90', cat: 'scoring', en: 'Goals / 90', th: 'ประตู / 90', pizza: true, shortEn: 'Goals', shortTh: 'ประตู' },
  { id: 'npg90', cat: 'scoring', en: 'Non-penalty goals / 90', th: 'ประตูไม่รวมจุดโทษ / 90', pizza: true, shortEn: 'NP Goals', shortTh: 'ไม่รวมจุดโทษ' },
  { id: 'ga90', cat: 'scoring', en: 'Goals + assists / 90', th: 'ประตู + แอสซิสต์ / 90', pizza: true, shortEn: 'G+A', shortTh: 'G+A' },
  { id: 'ast90', cat: 'creation', en: 'Assists / 90', th: 'แอสซิสต์ / 90', pizza: true, shortEn: 'Assists', shortTh: 'แอสซิสต์' },
  { id: 'sh90', cat: 'shooting', en: 'Shots / 90', th: 'ยิง / 90', pizza: true, shortEn: 'Shots', shortTh: 'ยิง' },
  { id: 'sot90', cat: 'shooting', en: 'Shots on target / 90', th: 'ยิงตรงกรอบ / 90', pizza: true, shortEn: 'On target', shortTh: 'ตรงกรอบ' },
  { id: 'sotPct', cat: 'shooting', en: 'Shot accuracy %', th: 'ยิงตรงกรอบ %', unit: '%', pizza: true, shortEn: 'Accuracy', shortTh: 'แม่นยำ' },
  { id: 'gSh', cat: 'shooting', en: 'Goals / shot', th: 'ประตู / การยิง', pizza: true, shortEn: 'Goals/Shot', shortTh: 'ประตู/ยิง' },
  { id: 'share', cat: 'avail', en: 'Minutes share of team', th: 'สัดส่วนนาทีเล่นของทีม', unit: '%', pizza: true, shortEn: 'Minutes', shortTh: 'นาทีเล่น' },
  { id: 'card90', cat: 'avail', en: 'Cards / 90', th: 'ใบเตือน / 90', lowerBetter: true, pizza: true, shortEn: 'Discipline', shortTh: 'วินัย' },
  { id: 'min', cat: 'avail', en: 'Minutes', th: 'นาทีที่เล่น', int: true },
  { id: 'mp', cat: 'avail', en: 'Matches played', th: 'จำนวนนัด', int: true },
  { id: 'starts', cat: 'avail', en: 'Starts', th: 'ตัวจริง', int: true },
];
const PIZZA = METRICS.filter((m) => m.pizza);
const CATS: { id: Cat; en: string; th: string }[] = [
  { id: 'scoring', en: 'Scoring', th: 'การทำประตู' },
  { id: 'creation', en: 'Creation', th: 'การสร้างสรรค์' },
  { id: 'shooting', en: 'Shooting', th: 'การยิง' },
  { id: 'avail', en: 'Availability & discipline', th: 'การลงเล่นและวินัย' },
];
const KEY_IDS = ['ga90', 'gls90', 'ast90', 'sotPct'];
const COL_A = 'var(--brand)';
const COL_B = '#3b82f6';
const POS_TH: Record<string, string> = { DF: 'กองหลัง', MF: 'กองกลาง', FW: 'กองหน้า' };

function build(data: PcSeason): P[] {
  const ix = Object.fromEntries(data.cols.map((c, i) => [c, i]));
  const n = (r: (string | number | null)[], c: string) => Number(r[ix[c]] ?? 0) || 0;
  const clubMax = new Map<string, number>();
  data.rows.forEach((r) => {
    const c = String(r[ix.club]);
    clubMax.set(c, Math.max(clubMax.get(c) ?? 0, n(r, 'min')));
  });
  return data.rows
    .filter((r) => String(r[ix.pos]).split(',')[0] !== 'GK')
    .map((r) => {
      const club = String(r[ix.club]);
      const min = n(r, 'min'), gls = n(r, 'gls'), ast = n(r, 'ast'), pk = n(r, 'pk');
      const sh = n(r, 'sh'), sot = n(r, 'sot'), y = n(r, 'crdY'), rd = n(r, 'crdR');
      const per = (x: number) => (min > 0 ? (x / min) * 90 : null);
      const teamMax = clubMax.get(club) || 1;
      return {
        key: `${club}|${r[ix.player]}`, club, name: String(r[ix.player]),
        pos: String(r[ix.pos]).split(',')[0] || 'MF',
        age: r[ix.age] == null ? null : Number(r[ix.age]),
        mp: n(r, 'mp'), starts: n(r, 'starts'), min, gls, ast, pk, sh, sot, y, r: rd,
        eligible: min >= 0.3 * teamMax,
        v: {
          gls90: per(gls), npg90: per(gls - pk), ga90: per(gls + ast), ast90: per(ast),
          sh90: per(sh), sot90: per(sot),
          sotPct: sh > 0 ? (sot / sh) * 100 : null, gSh: sh > 0 ? gls / sh : null,
          share: (min / teamMax) * 100, card90: per(y + rd * 2),
          min, mp: n(r, 'mp'), starts: n(r, 'starts'),
        },
      };
    });
}

function pctile(pool: P[], p: P, m: Metric): number | null {
  const v = p.v[m.id];
  if (v == null) return null;
  const peers = pool.filter((q) => q.pos === p.pos && q.eligible && q.v[m.id] != null);
  if (!peers.length) return null;
  const worse = peers.filter((q) => (m.lowerBetter ? q.v[m.id]! > v : q.v[m.id]! < v)).length;
  const same = peers.filter((q) => q.v[m.id] === v).length;
  const pc = ((worse + same / 2) / peers.length) * 99;
  return Math.max(1, Math.min(99, Math.round(pc)));
}

function show(m: Metric, v: number | null) {
  if (v == null) return '—';
  if (m.int) return String(Math.round(v));
  return m.unit === '%' ? `${fmt(v)}%` : fmt(v);
}

function Crest({ slug, size = 18 }: { slug: string; size?: number }) {
  return <img src={`${BASE_PATH}/logos/${slug}.png`} width={size} height={size} alt="" aria-hidden className="shrink-0 object-contain" />;
}

/* ------------------------------------------------------------- picker */
function Picker({ label, color, value, list, clubs, onPick }: {
  label: string; color: string; value: P | null; list: P[];
  clubs: Map<string, ClubIndexEntry>; onPick: (p: P) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const res = useMemo(() => {
    const nq = norm(q.trim());
    const l = nq ? list.filter((p) => norm(p.name).includes(nq) || norm(clubs.get(p.club)?.name ?? '').includes(nq)) : list;
    return l.slice(0, 60);
  }, [q, list, clubs]);
  return (
    <div ref={box} className="relative min-w-0 flex-1">
      <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />{label}
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 focus-within:border-brand">
        <Search size={16} className="shrink-0 text-muted" />
        <input
          value={open ? q : value?.name ?? ''}
          placeholder={value?.name ?? '—'}
          onFocus={() => { setOpen(true); setQ(''); }}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-primary outline-none placeholder:text-primary"
          aria-label={label}
        />
      </div>
      {open && (
        <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-border bg-surface-elevated py-1 shadow-lg">
          {res.map((p) => (
            <li key={p.key}>
              <button
                type="button"
                onClick={() => { onPick(p); setOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-brand-soft"
              >
                <Crest slug={p.club} size={16} />
                <span className="min-w-0 flex-1 truncate text-primary">{p.name}</span>
                <span className="text-xs text-muted">{p.pos}</span>
              </button>
            </li>
          ))}
          {!res.length && <li className="px-3 py-3 text-sm text-muted">—</li>}
        </ul>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- pizza */
function Pizza({ p, pool, color, th }: { p: P; pool: P[]; color: string; th: boolean }) {
  const n = PIZZA.length, C = 190, R0 = 22, R1 = 118, gap = 1.6;
  const pt = (a: number, r: number) => [C + r * Math.cos((a * Math.PI) / 180), C + r * Math.sin((a * Math.PI) / 180)];
  const wedge = (i: number, r: number) => {
    const step = 360 / n, a0 = -90 + i * step + gap, a1 = -90 + (i + 1) * step - gap;
    const [x0, y0] = pt(a0, R0), [x1, y1] = pt(a0, r), [x2, y2] = pt(a1, r), [x3, y3] = pt(a1, R0);
    return `M${x0} ${y0} L${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2} L${x3} ${y3} A${R0} ${R0} 0 0 0 ${x0} ${y0}Z`;
  };
  return (
    <svg viewBox={`-50 0 ${C * 2 + 100} ${C * 2}`} className="mx-auto w-full max-w-[460px]" role="img" aria-label={p.name}>
      {PIZZA.map((m, i) => {
        const pc = pctile(pool, p, m);
        const mid = -90 + (i + 0.5) * (360 / n);
        const [lx, ly] = pt(mid, R1 + 14);
        const [vx, vy] = pt(mid, pc == null ? R0 + 14 : Math.max(R0 + 14, R0 + ((R1 - R0) * pc) / 100 - 11));
        const anchor = Math.abs(lx - C) < 12 ? 'middle' : lx > C ? 'start' : 'end';
        return (
          <g key={m.id}>
            <path d={wedge(i, R1)} className="fill-bg-secondary" />
            {pc != null && <path d={wedge(i, R0 + ((R1 - R0) * pc) / 100)} fill={color} opacity={0.88} />}
            {pc != null && (
              <text x={vx} y={vy} textAnchor="middle" dominantBaseline="central" className="fill-white text-[11px] font-bold" style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,.25)', strokeWidth: 2 }}>
                {pc}
              </text>
            )}
            <text x={lx} y={ly} textAnchor={anchor} dominantBaseline="central" className="fill-muted text-[10px] font-semibold uppercase" letterSpacing=".04em">
              {th ? m.shortTh : m.shortEn}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* --------------------------------------------------------------- page */
export function PlayersCompare({ clubs, seasons, initial }: { clubs: ClubIndexEntry[]; seasons: string[]; initial: PcSeason }) {
  const { lang } = useI18n();
  const th = lang === 'th';
  const tx = (en: string, t: string) => (th ? t : en);
  const clubMap = useMemo(() => new Map(clubs.map((c) => [c.slug, c])), [clubs]);
  const cache = useRef<Record<string, PcSeason>>({ [initial.season]: initial });
  const [season, setSeason] = useState(initial.season);
  const [data, setData] = useState<PcSeason>(initial);
  const [loading, setLoading] = useState(false);
  const [ka, setKa] = useState<string | null>(null);
  const [kb, setKb] = useState<string | null>(null);

  useEffect(() => {
    if (cache.current[season]) { setData(cache.current[season]); return; }
    let live = true;
    setLoading(true);
    fetch(`${BASE_PATH}/data/players-compare/${season}.json`)
      .then((r) => r.json())
      .then((d: PcSeason) => { cache.current[season] = d; if (live) setData(d); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [season]);

  const pool = useMemo(() => build(data), [data]);
  const list = useMemo(
    () => [...pool].sort((a, b) => b.min - a.min).sort((a, b) => Number(b.eligible) - Number(a.eligible)),
    [pool],
  );
  const defaults = useMemo(() => {
    const top = pool.filter((p) => p.eligible && p.v.ga90 != null).sort((a, b) => b.v.ga90! - a.v.ga90!);
    const a = top[0];
    return [a, top.find((p) => p.club !== a?.club && p.pos === a?.pos) ?? top[1]];
  }, [pool]);
  const A = pool.find((p) => p.key === ka) ?? defaults[0] ?? null;
  const B = pool.find((p) => p.key === kb) ?? defaults[1] ?? null;
  const total = pool.length;

  if (!A || !B) {
    return <main className="mx-auto w-full max-w-6xl px-4 py-10 text-sm text-muted">{loading ? '…' : '—'}</main>;
  }

  const card = (p: P, color: string, tag: string) => {
    const c = clubMap.get(p.club);
    return (
      <article className="rounded-2xl border border-border bg-surface p-5" style={{ borderLeft: `4px solid ${color}` }}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{tag}</p>
        <h2 className="mt-1 text-xl font-bold text-primary">{p.name}</h2>
        <div className="mt-2 flex items-center gap-2 text-sm text-muted"><Crest slug={p.club} size={20} />{th ? c?.nameTh ?? c?.name : c?.name}</div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="rounded-full bg-bg-secondary px-2 py-0.5 font-semibold text-primary">{th ? POS_TH[p.pos] ?? p.pos : p.pos}</span>
          {p.age != null && <span>{tx('Age', 'อายุ')} {p.age}</span>}
          <span>PL {seasonShort(season)}</span>
          <strong className="tabular-nums text-primary">{p.min} {tx('mins', 'นาที')}</strong>
        </div>
        {!p.eligible && <p className="mt-2 text-xs text-brand">{tx('Under 30% of team minutes — small sample.', 'ลงเล่นไม่ถึง 30% ของนาทีทีม — ตัวอย่างน้อย')}</p>}
      </article>
    );
  };

  const barRow = (m: Metric) => {
    const a = A.v[m.id], b = B.v[m.id];
    const mx = Math.max(a ?? 0, b ?? 0) || 1;
    const better = a == null || b == null || a === b ? 0 : (m.lowerBetter ? a < b : a > b) ? 1 : 2;
    return (
      <div key={m.id} className="grid grid-cols-[3.5rem_1fr_3.5rem] items-center gap-2 py-2 text-xs sm:grid-cols-[4.5rem_1fr_11rem_1fr_4.5rem]">
        <span className={`text-right tabular-nums sm:order-1 ${better === 1 ? 'font-bold text-primary' : 'text-muted'}`}>{show(m, a)}</span>
        <div className="hidden h-2 overflow-hidden rounded-full bg-bg-secondary sm:order-2 sm:block" aria-hidden>
          <div className="ml-auto h-full rounded-full" style={{ width: `${((a ?? 0) / mx) * 100}%`, background: COL_A, opacity: better === 2 ? 0.45 : 1 }} />
        </div>
        <span className="text-center font-medium text-primary sm:order-3">
          {th ? m.th : m.en}
          {m.lowerBetter && <span className="block text-[10px] font-normal text-muted">{tx('Lower is better', 'ยิ่งน้อยยิ่งดี')}</span>}
        </span>
        <div className="hidden h-2 overflow-hidden rounded-full bg-bg-secondary sm:order-4 sm:block" aria-hidden>
          <div className="h-full rounded-full" style={{ width: `${((b ?? 0) / mx) * 100}%`, background: COL_B, opacity: better === 1 ? 0.45 : 1 }} />
        </div>
        <span className={`tabular-nums sm:order-5 ${better === 2 ? 'font-bold text-primary' : 'text-muted'}`}>{show(m, b)}</span>
      </div>
    );
  };

  const swap = () => { setKa(B.key); setKb(A.key); };

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Premier League · {seasonShort(season)}</p>
          <h1 className="mt-1 text-3xl font-extrabold text-primary sm:text-4xl">{tx('Player Comparison', 'เปรียบเทียบนักเตะ')}</h1>
          <p className="mt-1 text-sm text-muted">{tx('Compare any two outfield players across clubs and seasons.', 'เทียบนักเตะสองคนข้ามสโมสรและฤดูกาล (ไม่รวมผู้รักษาประตู)')}</p>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
          {tx('Season', 'ฤดูกาล')}
          <select
            value={season}
            onChange={(e) => { setSeason(e.target.value); setKa(null); setKb(null); }}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold normal-case text-primary"
          >
            {[...seasons].reverse().map((s) => <option key={s} value={s}>{seasonShort(s)}</option>)}
          </select>
        </label>
      </header>

      <section className="flex items-end gap-3 rounded-2xl border border-border bg-surface p-4">
        <Picker label={tx('Player A', 'นักเตะ A')} color={COL_A} value={A} list={list} clubs={clubMap} onPick={(p) => setKa(p.key)} />
        <button type="button" onClick={swap} aria-label={tx('Swap players', 'สลับนักเตะ')} className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-bg-secondary text-primary hover:bg-brand-soft hover:text-brand">
          <ArrowLeftRight size={16} />
        </button>
        <Picker label={tx('Player B', 'นักเตะ B')} color={COL_B} value={B} list={list} clubs={clubMap} onPick={(p) => setKb(p.key)} />
      </section>

      <div className={`mt-4 grid gap-4 sm:grid-cols-2 ${loading ? 'opacity-60' : ''}`}>
        {card(A, COL_A, tx('Player A', 'นักเตะ A'))}
        {card(B, COL_B, tx('Player B', 'นักเตะ B'))}
      </div>

      <h3 className="mb-3 mt-8 text-xs font-semibold uppercase tracking-wide text-muted">{tx('Key metrics', 'ตัวชี้วัดหลัก')}</h3>
      <section className="grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface lg:grid-cols-4 lg:divide-y-0">
        {KEY_IDS.map((id) => {
          const m = METRICS.find((x) => x.id === id)!;
          return (
            <div key={id} className="p-4 text-center">
              <h4 className="text-xs font-medium text-muted">{th ? m.th : m.en}</h4>
              <div className="mt-3 flex items-center justify-around text-xl font-extrabold tabular-nums">
                <strong style={{ color: COL_A }}>{show(m, A.v[id])}</strong>
                <strong style={{ color: COL_B }}>{show(m, B.v[id])}</strong>
              </div>
            </div>
          );
        })}
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{tx('Profile matchup', 'โปรไฟล์เทียบกัน')}</h3>
        <div className="mt-4 grid gap-6 md:grid-cols-2 md:divide-x md:divide-border">
          {[{ p: A, c: COL_A }, { p: B, c: COL_B }].map(({ p, c }) => (
            <div key={p.key} className="min-w-0 md:px-4">
              <div className="text-center">
                <h4 className="font-bold text-primary">{p.name}</h4>
                <p className="mt-0.5 text-xs text-muted">{th ? clubMap.get(p.club)?.nameTh : clubMap.get(p.club)?.name}</p>
                <span className="mt-2 inline-block rounded-full bg-bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-muted">
                  {tx(`vs ${p.pos} peers`, `เทียบ${POS_TH[p.pos] ?? p.pos}ในลีก`)}
                </span>
              </div>
              <Pizza p={p} pool={pool} color={c} th={th} />
            </div>
          ))}
        </div>
        <p className="mt-4 border-t border-border pt-3 text-[11px] leading-relaxed text-muted">
          {tx(
            `Percentiles (1–99) rank each player against same-position outfield peers in the ${seasonShort(season)} Premier League with at least 30% of their team's top minutes (${total} outfield players this season). Based on goals, assists, shooting and appearances only — defensive and passing data aren't available. A profile of style, not an overall rating.`,
            `เปอร์เซ็นไทล์ (1–99) เทียบกับผู้เล่นตำแหน่งเดียวกันใน PL ฤดูกาล ${seasonShort(season)} ที่ลงเล่นอย่างน้อย 30% ของนาทีสูงสุดในทีม (${total} คนในฤดูกาลนี้) ใช้เฉพาะประตู แอสซิสต์ การยิง และการลงเล่น — ไม่มีข้อมูลเกมรับ/การจ่ายบอล จึงเป็นโปรไฟล์สไตล์ ไม่ใช่คะแนนรวม`,
          )}
        </p>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{tx('Metric comparison', 'เปรียบเทียบรายตัวชี้วัด')}</h3>
        <div className="mt-3 hidden grid-cols-[4.5rem_1fr_11rem_1fr_4.5rem] gap-2 text-xs font-bold sm:grid">
          <span className="col-span-2 truncate text-right" style={{ color: COL_A }}>{A.name}</span>
          <span />
          <span className="col-span-2 truncate" style={{ color: COL_B }}>{B.name}</span>
        </div>
        {CATS.map((c) => (
          <div key={c.id} className="mt-4 border-t border-border pt-3 first:mt-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted">{th ? c.th : c.en}</h4>
            <div className="divide-y divide-border">{METRICS.filter((m) => m.cat === c.id).map(barRow)}</div>
          </div>
        ))}
        <p className="mt-4 text-[11px] text-muted">
          {tx('Source: fbref, Premier League only. Per-90 values use minutes played; bars share one scale per row.', 'ที่มา: fbref เฉพาะ Premier League ค่าต่อ 90 คำนวณจากนาทีที่เล่น แถบแต่ละแถวใช้สเกลเดียวกัน')}
        </p>
      </section>
    </main>
  );
}
