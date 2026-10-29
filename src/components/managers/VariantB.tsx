'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { fmt, pct, signed } from '@/lib/format';
import { seasonShort } from '@/lib/stats';
import {
  csRate,
  displayName,
  gaPer,
  gfPer,
  isCurrent,
  periodShort,
  ppg,
  StatBase,
  StintStat,
  VariantProps,
  winRate,
  xgaPer,
  xgdPer,
  xgPer,
} from './shared';

type SortKey =
  | 'name' | 'from' | 'mp' | 'ppg' | 'win' | 'gf' | 'ga' | 'cs' | 'xg' | 'xga' | 'xgd';

const LOWER_BETTER = new Set<SortKey>(['ga', 'xga']);

function getVal(s: StintStat, k: SortKey): number | string | null {
  switch (k) {
    case 'name': return s.stint.name;
    case 'from': return s.stint.from;
    case 'mp': return s.mp;
    case 'ppg': return ppg(s);
    case 'win': return winRate(s);
    case 'gf': return gfPer(s);
    case 'ga': return gaPer(s);
    case 'cs': return csRate(s);
    case 'xg': return xgPer(s);
    case 'xga': return xgaPer(s);
    case 'xgd': return xgdPer(s);
  }
}

function WdlBar({ s }: { s: StatBase }) {
  if (s.mp === 0) return <span className="text-muted">—</span>;
  const seg = (n: number, color: string) =>
    n > 0 ? (
      <span style={{ width: `${(n / s.mp) * 100}%`, background: color }} className="h-full" />
    ) : null;
  return (
    <div className="flex items-center justify-end gap-2">
      <span className="text-sm text-secondary tabular-nums whitespace-nowrap">
        {s.w}–{s.d}–{s.l}
      </span>
      <span className="flex h-1.5 w-16 overflow-hidden rounded-full bg-bg-secondary">
        {seg(s.w, 'var(--success)')}
        {seg(s.d, 'var(--chart-neutral)')}
        {seg(s.l, 'var(--danger)')}
      </span>
    </div>
  );
}

function PpgBar({ s }: { s: StatBase }) {
  const p = ppg(s);
  if (p == null) return <span className="text-muted">—</span>;
  return (
    <div className="flex items-center justify-end gap-2">
      <span className="text-sm text-secondary tabular-nums">{fmt(p)}</span>
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-bg-secondary">
        <span
          className="block h-full rounded-full"
          style={{ width: `${(Math.min(p, 3) / 3) * 100}%`, background: 'var(--brand)' }}
        />
      </span>
    </div>
  );
}

export function VariantB({ data, lang, hasXg, minN }: VariantProps) {
  const L = (th: string, en: string) => (lang === 'th' ? th : en);
  const [sortKey, setSortKey] = useState<SortKey>('ppg');
  const [dir, setDir] = useState<1 | -1>(-1);
  const [hideInterim, setHideInterim] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { ranked, small } = useMemo(() => {
    const vis = data.filter((s) => s.mp > 0 && !(hideInterim && s.stint.interim));
    const arr = [...vis];
    arr.sort((a, b) => {
      const va = getVal(a, sortKey);
      const vb = getVal(b, sortKey);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      const c = typeof va === 'string' ? va.localeCompare(vb as string) : va - (vb as number);
      return c * dir || b.mp - a.mp;
    });
    return {
      ranked: arr.filter((s) => s.mp >= minN),
      small: arr.filter((s) => s.mp < minN),
    };
  }, [data, sortKey, dir, hideInterim, minN]);

  // best per column among ranked stints (>= 10 matches)
  const best = useMemo(() => {
    const out = new Map<SortKey, number>();
    const keys = (hasXg
      ? ['ppg', 'win', 'gf', 'ga', 'cs', 'xg', 'xga', 'xgd']
      : ['ppg', 'win', 'gf', 'ga', 'cs']) as SortKey[];
    for (const k of keys) {
      let v: number | null = null;
      for (const s of ranked) {
        const x = getVal(s, k);
        if (typeof x !== 'number') continue;
        if (v == null || (LOWER_BETTER.has(k) ? x < v : x > v)) v = x;
      }
      if (v != null) out.set(k, v);
    }
    return out;
  }, [ranked, hasXg]);

  const sortBy = (k: SortKey) => {
    if (k === sortKey) setDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(k);
      setDir(k === 'name' || k === 'from' ? 1 : -1);
    }
  };

  const isBest = (s: StintStat, k: SortKey, v: number | null) =>
    s.mp >= minN && v != null && best.get(k) === v;
  const bestCls = (on: boolean) =>
    on ? 'font-semibold text-primary underline decoration-brand decoration-2 underline-offset-4' : '';

  const th = (k: SortKey | null, label: string, left = false) => (
    <th
      key={k ?? label}
      aria-sort={
        k === sortKey ? (dir === 1 ? 'ascending' : 'descending') : undefined
      }
      className={`px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted whitespace-nowrap ${left ? 'text-left' : 'text-right'}`}
    >
      {k ? (
        <button
          type="button"
          onClick={() => sortBy(k)}
          className={`uppercase tracking-wider hover:text-secondary focus-visible:outline-2 focus-visible:outline-brand ${
            sortKey === k ? 'text-primary' : ''
          }`}
        >
          {label}
          {sortKey === k && <span aria-hidden> {dir === 1 ? '↑' : '↓'}</span>}
        </button>
      ) : (
        label
      )}
    </th>
  );

  const metricCells = (s: StatBase & { id?: string }, st?: StintStat) => {
    const mark = (k: SortKey, v: number | null) => (st ? isBest(st, k, v) : false);
    const w = winRate(s), g = gfPer(s), a = gaPer(s), c = csRate(s), x = xgPer(s), xa = xgaPer(s), xd = xgdPer(s);
    return (
      <>
        <td className="px-3 py-2.5"><PpgBar s={s} /></td>
        <td className={`px-3 py-2.5 text-right text-sm text-secondary tabular-nums ${bestCls(mark('win', w))}`}>{pct(w, 2)}</td>
        <td className={`px-3 py-2.5 text-right text-sm text-secondary tabular-nums ${bestCls(mark('gf', g))}`}>{fmt(g)}</td>
        <td className={`px-3 py-2.5 text-right text-sm text-secondary tabular-nums ${bestCls(mark('ga', a))}`}>{fmt(a)}</td>
        <td className={`px-3 py-2.5 text-right text-sm text-secondary tabular-nums ${bestCls(mark('cs', c))}`}>{pct(c, 2)}</td>
        {hasXg && (
          <>
            <td className={`px-3 py-2.5 text-right text-sm text-secondary tabular-nums ${bestCls(mark('xg', x))}`}>{fmt(x)}</td>
            <td className={`px-3 py-2.5 text-right text-sm text-secondary tabular-nums ${bestCls(mark('xga', xa))}`}>{fmt(xa)}</td>
            <td className={`px-3 py-2.5 text-right text-sm tabular-nums ${bestCls(mark('xgd', xd))} ${xd == null ? 'text-muted' : xd >= 0 ? 'text-success' : 'text-danger'}`}>{signed(xd)}</td>
          </>
        )}
      </>
    );
  };

  const tableRow = (s: StintStat, rank: number | null) => {
    const open = expanded === s.id;
    const smallSample = s.mp < minN;
    return [
      <tr
        key={s.id}
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setExpanded(open ? null : s.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded(open ? null : s.id);
          }
        }}
        className={`cursor-pointer border-b border-border transition-colors hover:bg-bg-secondary focus-visible:outline-2 focus-visible:outline-brand ${
          smallSample ? 'opacity-55' : ''
        }`}
      >
        <td className="px-3 py-2.5 text-right text-sm text-muted tabular-nums">{rank ?? ''}</td>
        <td className="px-3 py-2.5 text-sm font-medium text-primary whitespace-nowrap">
          <span className="flex items-center gap-1.5">
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {displayName(s.stint, lang)}
            {s.stint.interim && (
              <span className="rounded border border-border px-1 py-0.5 text-[10px] uppercase text-muted">
                {L('รักษาการ', 'interim')}
              </span>
            )}
            {isCurrent(s.stint) && (
              <span className="rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase text-brand">
                {L('ปัจจุบัน', 'current')}
              </span>
            )}
            {smallSample && (
              <span className="text-[10px] text-muted">{L('ตัวอย่างน้อย', 'small sample')}</span>
            )}
          </span>
        </td>
        <td className="px-3 py-2.5 text-right text-sm text-muted tabular-nums whitespace-nowrap">{periodShort(s.stint, lang)}</td>
        <td className="px-3 py-2.5 text-right text-sm text-secondary tabular-nums">{s.mp}</td>
        <td className="px-3 py-2.5"><WdlBar s={s} /></td>
        {metricCells(s, s)}
      </tr>,
      ...(open
        ? s.seasons.map((ss) => (
            <tr key={`${s.id}-${ss.season}`} className="border-b border-border-light bg-bg-secondary/50">
              <td />
              <td className="px-3 py-2 pl-9 text-sm text-muted whitespace-nowrap">{seasonShort(ss.season)}</td>
              <td className="px-3 py-2 text-right text-xs text-muted tabular-nums whitespace-nowrap">
                {ss.first} → {ss.last}
              </td>
              <td className="px-3 py-2 text-right text-sm text-secondary tabular-nums">{ss.mp}</td>
              <td className="px-3 py-2"><WdlBar s={ss} /></td>
              {metricCells(ss)}
            </tr>
          ))
        : []),
    ];
  };

  const mobileCard = (s: StintStat, rank: number | null) => {
    const p = ppg(s);
    const open = expanded === s.id;
    return (
      <div key={s.id} className={`rounded-xl border border-border bg-surface p-3 ${s.mp < minN ? 'opacity-60' : ''}`}>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setExpanded(open ? null : s.id)}
          className="flex w-full items-center justify-between gap-2 text-left focus-visible:outline-2 focus-visible:outline-brand"
        >
          <span className="flex items-baseline gap-2">
            {rank != null && <span className="text-sm text-muted tabular-nums">{rank}</span>}
            <span className="font-medium text-primary">{displayName(s.stint, lang)}</span>
            {isCurrent(s.stint) && (
              <span className="rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase text-brand">
                {L('ปัจจุบัน', 'current')}
              </span>
            )}
          </span>
          <span className="text-xs text-muted whitespace-nowrap">{periodShort(s.stint, lang)}</span>
        </button>
        <div className="mt-2 flex items-center gap-2">
          <span className="w-10 text-sm font-semibold text-primary tabular-nums">{fmt(p)}</span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-secondary">
            <span
              className="block h-full rounded-full"
              style={{ width: `${((p ?? 0) / 3) * 100}%`, background: 'var(--brand)' }}
            />
          </span>
        </div>
        <div className="mt-2"><WdlBar s={s} /></div>
        <div className="mt-1.5 text-xs text-secondary">
          {s.mp} MP · {pct(winRate(s), 2)} {L('ชนะ', 'win')}
          {hasXg && <> · xGD {signed(xgdPer(s))}</>}
        </div>
        {open &&
          s.seasons.map((ss) => (
            <div key={ss.season} className="mt-1.5 border-t border-border-light pt-1.5 text-xs text-secondary">
              <span className="font-medium text-primary">{seasonShort(ss.season)}</span> · {ss.mp} MP ·{' '}
              {ss.w}–{ss.d}–{ss.l} · {fmt(ppg(ss))} {L('แต้ม/นัด', 'pts/match')}
            </div>
          ))}
      </div>
    );
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-lg font-semibold text-primary">
          {L('ตารางอันดับผู้จัดการ', 'Manager leaderboard')}
        </h3>
        <button
          type="button"
          aria-pressed={hideInterim}
          onClick={() => setHideInterim((v) => !v)}
          className={`rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-brand ${
            hideInterim
              ? 'border-brand bg-brand-soft text-brand'
              : 'border-border bg-surface text-secondary hover:bg-bg-secondary'
          }`}
        >
          {L('ซ่อนรักษาการ', 'Hide interim')}
        </button>
      </div>

      {/* desktop table */}
      <section className="hidden overflow-hidden rounded-2xl border border-border bg-surface md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse whitespace-nowrap">
            <thead className="bg-surface-elevated">
              <tr className="border-b border-border">
                <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted">#</th>
                {th('name', L('ผู้จัดการ', 'Manager'), true)}
                {th('from', L('ช่วงเวลา', 'Period'))}
                {th('mp', 'MP')}
                <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted">W–D–L</th>
                {th('ppg', L('แต้ม/นัด', 'Pts/match'))}
                {th('win', L('อัตราชนะ', 'Win rate'))}
                {th('gf', 'GF/' + L('นัด', 'match'))}
                {th('ga', 'GA/' + L('นัด', 'match'))}
                {th('cs', L('คลีนชีต', 'Clean sheets'))}
                {hasXg && th('xg', 'xG/' + L('นัด', 'match'))}
                {hasXg && th('xga', 'xGA/' + L('นัด', 'match'))}
                {hasXg && th('xgd', 'xGD/' + L('นัด', 'match'))}
              </tr>
            </thead>
            <tbody>
              {[
                ...ranked.map((s, i) => tableRow(s, i + 1)),
                ...(small.length > 0
                  ? [
                      <tr key="divider" aria-hidden>
                        <td colSpan={hasXg ? 13 : 10} className="border-t-2 border-border bg-bg-secondary/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                          {L(`ตัวอย่างน้อย (< ${minN} นัด)`, `Small sample (< ${minN} matches)`)}
                        </td>
                      </tr>,
                      ...small.map((s) => tableRow(s, null)),
                    ]
                  : []),
              ]}
              {ranked.length + small.length === 0 && (
                <tr>
                  <td colSpan={hasXg ? 13 : 10} className="px-4 py-8 text-center text-sm text-muted">
                    {L('ไม่มีนัดในรายการนี้', 'No matches in this competition')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* mobile stacked list */}
      <section className="flex flex-col gap-2 md:hidden">
        {ranked.map((s, i) => mobileCard(s, i + 1))}
        {small.length > 0 && ranked.length > 0 && (
          <div className="border-t-2 border-border bg-bg-secondary/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
            {L(`ตัวอย่างน้อย (< ${minN} นัด)`, `Small sample (< ${minN} matches)`)}
          </div>
        )}
        {small.map((s) => mobileCard(s, null))}
        {ranked.length + small.length === 0 && (
          <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
            {L('ไม่มีนัดในรายการนี้', 'No matches in this competition')}
          </div>
        )}
      </section>
    </>
  );
}
