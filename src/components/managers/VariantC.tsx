'use client';

import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowLeftRight } from 'lucide-react';
import { fmt, pct, signed } from '@/lib/format';
import {
  csRate,
  daysInCharge,
  displayName,
  gaPer,
  gfPer,
  isCurrent,
  periodShort,
  ppg,
  StintStat,
  tenureDuration,
  VariantProps,
  winRate,
  xgaPer,
  xgdPer,
  xgPer,
} from './shared';

interface Metric {
  label: string;
  get: (s: StintStat) => number | null;
  fmt: (v: number | null) => string;
  lowerBetter?: boolean;
}

interface RaceRow {
  n: number;
  a: number | null;
  b: number | null;
  pace: number;
}

function RaceTooltip({
  active,
  payload,
  label,
  leftName,
  rightName,
  lang,
}: {
  active?: boolean;
  payload?: { dataKey?: string; value?: number | null }[];
  label?: number | string;
  leftName: string;
  rightName: string;
  lang: 'th' | 'en';
}) {
  if (!active || !payload?.length) return null;
  const aVal = payload.find((p) => p.dataKey === 'a')?.value ?? null;
  const bVal = payload.find((p) => p.dataKey === 'b')?.value ?? null;
  const paceVal = payload.find((p) => p.dataKey === 'pace')?.value ?? null;
  const diff = aVal != null && bVal != null ? aVal - bVal : null;
  return (
    <div className="rounded-xl border border-border bg-surface-elevated px-3.5 py-2.5 text-xs shadow-md">
      <div className="mb-1.5 font-bold text-primary tabular-nums">
        {lang === 'th' ? 'หลังผ่านนัดที่' : 'After Match'} {label}
      </div>
      <div className="flex flex-col gap-1 tabular-nums">
        {aVal != null && (
          <div className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-secondary">
              <span className="h-2 w-2 rounded-full bg-brand" />
              {leftName}
            </span>
            <span className="font-bold text-primary">{aVal}</span>
          </div>
        )}
        {bVal != null && (
          <div className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-secondary">
              <span className="h-2 w-2 rounded-full bg-info" />
              {rightName}
            </span>
            <span className="font-bold text-primary">{bVal}</span>
          </div>
        )}
        {diff != null && (
          <div className="mt-1 flex items-center justify-between gap-4 border-t border-border-light pt-1 text-[11px]">
            <span className="text-muted">{lang === 'th' ? 'ผลต่าง' : 'Gap'}</span>
            <span className={`font-bold ${diff > 0 ? 'text-brand' : diff < 0 ? 'text-info' : 'text-muted'}`}>
              {signed(diff, 0)} {lang === 'th' ? 'แต้ม' : 'pts'}
            </span>
          </div>
        )}
        {paceVal != null && (
          <div className="flex items-center justify-between gap-4 text-[11px] text-muted">
            <span>{lang === 'th' ? 'จังหวะ 2.00 แต้ม/นัด' : '2.00 PPG pace'}</span>
            <span>{paceVal}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SideWdlBar({ s }: { s: StintStat }) {
  if (s.mp === 0) return null;
  return (
    <div className="mt-2.5 flex flex-col gap-1">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-bg-secondary" aria-hidden>
        {s.w > 0 && <span style={{ width: `${(s.w / s.mp) * 100}%`, background: 'var(--success)' }} />}
        {s.d > 0 && <span style={{ width: `${(s.d / s.mp) * 100}%`, background: 'var(--chart-neutral)' }} />}
        {s.l > 0 && <span style={{ width: `${(s.l / s.mp) * 100}%`, background: 'var(--danger)' }} />}
      </div>
      <div className="flex items-center justify-between text-xs text-muted tabular-nums">
        <span>{s.w}W – {s.d}D – {s.l}L</span>
        <span>{pct(winRate(s), 2)}</span>
      </div>
    </div>
  );
}

export function VariantC({ data, lang, hasXg }: VariantProps) {
  const L = (th: string, en: string) => (lang === 'th' ? th : en);
  const options = data.filter((s) => s.mp > 0);

  const defaultLeft = options.find((s) => isCurrent(s.stint)) ?? options[options.length - 1];
  const defaultRight =
    [...options].reverse().find((s) => s.id !== defaultLeft?.id && !s.stint.interim) ??
    options.find((s) => s.id !== defaultLeft?.id);

  const [leftId, setLeftId] = useState<string | null>(null);
  const [rightId, setRightId] = useState<string | null>(null);
  // selections outside the mp>0 set (e.g. after comp-toggle) fall back to defaults
  const left = options.find((s) => s.id === leftId) ?? defaultLeft;
  const right = options.find((s) => s.id === rightId) ?? defaultRight;

  const metrics: Metric[] = useMemo(
    () => [
      { label: L('แต้ม/นัด', 'Pts / match'), get: ppg, fmt: (v) => fmt(v, 2) },
      { label: L('อัตราชนะ', 'Win rate'), get: winRate, fmt: (v) => pct(v, 2) },
      { label: L('ประตูได้/นัด', 'Goals for / match'), get: gfPer, fmt: (v) => fmt(v, 2) },
      { label: L('ประตูเสีย/นัด', 'Goals against / match'), get: gaPer, fmt: (v) => fmt(v, 2), lowerBetter: true },
      { label: L('คลีนชีต %', 'Clean sheets'), get: csRate, fmt: (v) => pct(v, 2) },
      ...(hasXg
        ? ([
            { label: 'xG/' + L('นัด', 'match'), get: xgPer, fmt: (v: number | null) => fmt(v, 2) },
            { label: 'xGA/' + L('นัด', 'match'), get: xgaPer, fmt: (v: number | null) => fmt(v, 2), lowerBetter: true },
            { label: 'xGD/' + L('นัด', 'match'), get: xgdPer, fmt: (v: number | null) => signed(v, 2) },
          ] satisfies Metric[])
        : []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang, hasXg],
  );

  const race: RaceRow[] = useMemo(() => {
    if (!left || !right) return [];
    const cum = (s: StintStat) => {
      let acc = 0;
      return s.games.map((g) => {
        acc += g.result === 'W' ? 3 : g.result === 'D' ? 1 : 0;
        return acc;
      });
    };
    const a = cum(left);
    const b = cum(right);
    const n = Math.max(a.length, b.length);
    return Array.from({ length: n }, (_, i) => ({
      n: i + 1,
      a: i < a.length ? a[i] : null,
      b: i < b.length ? b[i] : null,
      pace: (i + 1) * 2,
    }));
  }, [left, right]);

  if (options.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-8 text-center">
        <p className="text-secondary">{L('ไม่มีนัดในรายการนี้', 'No matches in this competition')}</p>
      </section>
    );
  }
  if (options.length < 2 || !left || !right) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-8 text-center">
        <p className="text-secondary">
          {L(
            'สโมสรนี้มีผู้จัดการเพียงคนเดียวในช่วงข้อมูลนี้ — ไม่มีใครให้เปรียบเทียบ',
            'This club has only one manager in this data range — nobody to compare with.',
          )}
        </p>
      </section>
    );
  }

  const swap = () => {
    setLeftId(right.id);
    setRightId(left.id);
  };

  const select = (v: string, set: (x: string) => void, side: string) => (
    <select
      aria-label={side}
      value={v}
      onChange={(e) => set(e.target.value)}
      className="w-full max-w-xs cursor-pointer rounded-xl border border-border bg-bg-secondary px-3 py-2 text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-brand"
    >
      {options.map((s) => (
        <option key={s.id} value={s.id} className="bg-surface text-primary">
          {displayName(s.stint, lang)} ({periodShort(s.stint, lang)})
          {s.stint.interim ? ` · ${L('รักษาการ', 'interim')}` : ''}
        </option>
      ))}
    </select>
  );

  let leftWins = 0;
  let rightWins = 0;
  let contested = 0;
  for (const m of metrics) {
    const a = m.get(left);
    const b = m.get(right);
    if (a == null || b == null || a === b) continue;
    contested++;
    const leftBetter = m.lowerBetter ? a < b : a > b;
    if (leftBetter) leftWins++;
    else rightWins++;
  }

  const nameOf = (s: StintStat) => displayName(s.stint, lang);

  return (
    <>
      {/* ----------------------------------------------- Tale of the Tape Cards */}
      <section className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr]">
        {/* Left Manager Card */}
        <article
          className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none sm:p-5"
          style={{ borderTopWidth: 3, borderTopColor: 'var(--brand)' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-brand">
              <span className="h-2 w-2 rounded-full bg-brand" />
              {L('ผู้จัดการ A', 'Manager A')}
            </span>
            {select(left.id, setLeftId, L('ผู้จัดการฝั่งซ้าย', 'Left manager'))}
          </div>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-2xl font-bold leading-tight text-primary sm:text-3xl">
                  {nameOf(left)}
                </h3>
                {left.stint.interim && (
                  <span className="rounded-full border border-warning/30 bg-warning-soft px-2 py-0.5 text-[10px] font-bold uppercase text-warning">
                    {L('รักษาการ', 'Interim')}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted tabular-nums">
                {periodShort(left.stint, lang)} · {left.mp} {L('นัด', 'MP')} ·{' '}
                {tenureDuration(daysInCharge(left.stint), lang)}
              </p>
            </div>
            <div className="text-right">
              <div className="font-display text-3xl font-bold tabular-nums text-primary">
                {fmt(ppg(left), 2)}
              </div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted">
                {L('แต้ม/นัด', 'PPG')}
              </div>
            </div>
          </div>
          <SideWdlBar s={left} />
        </article>

        {/* Center VS + Swap */}
        <div className="flex flex-row items-center justify-center gap-2 lg:flex-col">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface font-display text-sm font-bold text-muted shadow-sm dark:shadow-none">
            VS
          </div>
          <button
            type="button"
            onClick={swap}
            aria-label={L('สลับฝั่ง', 'Swap managers')}
            title={L('สลับฝั่ง', 'Swap managers')}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-secondary transition-colors hover:border-brand/40 hover:bg-brand-soft hover:text-brand"
          >
            <ArrowLeftRight size={13} />
            <span className="lg:hidden">{L('สลับฝั่ง', 'Swap')}</span>
          </button>
        </div>

        {/* Right Manager Card */}
        <article
          className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none sm:p-5"
          style={{ borderTopWidth: 3, borderTopColor: 'var(--info)' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-info">
              <span className="h-2 w-2 rounded-full bg-info" />
              {L('ผู้จัดการ B', 'Manager B')}
            </span>
            {select(right.id, setRightId, L('ผู้จัดการฝั่งขวา', 'Right manager'))}
          </div>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-2xl font-bold leading-tight text-primary sm:text-3xl">
                  {nameOf(right)}
                </h3>
                {right.stint.interim && (
                  <span className="rounded-full border border-warning/30 bg-warning-soft px-2 py-0.5 text-[10px] font-bold uppercase text-warning">
                    {L('รักษาการ', 'Interim')}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted tabular-nums">
                {periodShort(right.stint, lang)} · {right.mp} {L('นัด', 'MP')} ·{' '}
                {tenureDuration(daysInCharge(right.stint), lang)}
              </p>
            </div>
            <div className="text-right">
              <div className="font-display text-3xl font-bold tabular-nums text-primary">
                {fmt(ppg(right), 2)}
              </div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted">
                {L('แต้ม/นัด', 'PPG')}
              </div>
            </div>
          </div>
          <SideWdlBar s={right} />
        </article>
      </section>

      {/* -------------------------------------------------- Butterfly Bars */}
      <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none sm:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-border pb-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
              {L('เปรียบเทียบตัวชี้วัด', 'STATISTICAL BREAKDOWN')}
            </p>
            <h3 className="mt-0.5 font-display text-lg font-bold text-primary">
              {L('เปรียบเทียบสถิติรายหมวด', 'Category-by-category comparison')}
            </h3>
          </div>
          {contested > 0 && (
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-bg-secondary px-3 py-1 text-xs font-bold tabular-nums">
              <span className="text-brand">{leftWins}</span>
              <span className="text-muted">–</span>
              <span className="text-info">{rightWins}</span>
              <span className="font-normal text-muted">
                ({L(`จาก ${contested} หมวด`, `of ${contested}`)})
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3.5">
          {metrics.map((m) => {
            const a = m.get(left);
            const b = m.get(right);
            const both = a != null && b != null;
            const max = Math.max(Math.abs(a ?? 0), Math.abs(b ?? 0), 1e-9);
            const leftBetter = both && a !== b && (m.lowerBetter ? a < b : a > b);
            const rightBetter = both && a !== b && !leftBetter;
            return (
              <div key={m.label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
                <div className="flex items-center justify-end gap-2.5">
                  <span
                    className={`text-sm tabular-nums ${
                      leftBetter ? 'font-bold text-brand' : 'font-medium text-secondary'
                    }`}
                  >
                    {m.fmt(a)}
                  </span>
                  <span className="flex h-3.5 w-full max-w-44 justify-end overflow-hidden rounded-full bg-bg-secondary sm:max-w-60">
                    {a != null && (
                      <span
                        className="block h-full rounded-full transition-all"
                        style={{
                          width: `${(Math.abs(a) / max) * 100}%`,
                          background: leftBetter ? 'var(--brand)' : 'var(--chart-neutral)',
                          minWidth: 4,
                        }}
                      />
                    )}
                  </span>
                </div>
                <div className="w-28 text-center sm:w-40">
                  <div className="text-xs font-semibold text-primary">{m.label}</div>
                  {m.lowerBetter && (
                    <div className="text-[10px] text-muted">↓ {L('น้อยกว่าดีกว่า', 'lower is better')}</div>
                  )}
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="flex h-3.5 w-full max-w-44 overflow-hidden rounded-full bg-bg-secondary sm:max-w-60">
                    {b != null && (
                      <span
                        className="block h-full rounded-full transition-all"
                        style={{
                          width: `${(Math.abs(b) / max) * 100}%`,
                          background: rightBetter ? 'var(--info)' : 'var(--chart-neutral)',
                          minWidth: 4,
                        }}
                      />
                    )}
                  </span>
                  <span
                    className={`text-sm tabular-nums ${
                      rightBetter ? 'font-bold text-info' : 'font-medium text-secondary'
                    }`}
                  >
                    {m.fmt(b)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 border-t border-border pt-3.5 text-center text-sm text-secondary">
          {leftWins > 0 && (
            <span>
              <span className="font-bold text-brand">{nameOf(left)}</span>{' '}
              {L('เหนือกว่า', 'leads in')} <strong className="tabular-nums text-primary">{leftWins}</strong>{' '}
              {L('จาก', 'of')} <span className="tabular-nums">{contested}</span> {L('หมวด', 'categories')}
            </span>
          )}
          {leftWins > 0 && rightWins > 0 && <span className="mx-2 text-muted">·</span>}
          {rightWins > 0 && (
            <span>
              <span className="font-bold text-info">{nameOf(right)}</span>{' '}
              {L('เหนือกว่า', 'leads in')} <strong className="tabular-nums text-primary">{rightWins}</strong>{' '}
              {L('จาก', 'of')} <span className="tabular-nums">{contested}</span> {L('หมวด', 'categories')}
            </span>
          )}
          {contested === 0 && <span className="text-muted">—</span>}
        </div>
      </section>

      {/* --------------------------------------------- Cumulative Points Race */}
      <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none sm:p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
              {L('เส้นทางแต้มสะสม', 'CUMULATIVE POINTS PACE')}
            </p>
            <h3 className="mt-0.5 font-display text-lg font-bold text-primary">
              {L('แต้มสะสมนับจากนัดแรกของการคุมทีม', 'Cumulative points from match 1')}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5 text-primary">
              <span className="h-2.5 w-2.5 rounded-full bg-brand" />
              {nameOf(left)}
            </span>
            <span className="inline-flex items-center gap-1.5 text-primary">
              <span className="h-2.5 w-2.5 rounded-full bg-info" />
              {nameOf(right)}
            </span>
            <span className="inline-flex items-center gap-1.5 text-muted">
              <span className="h-0.5 w-3 border-t border-dashed border-muted" />
              {L('จังหวะ 2.00 แต้ม/นัด', '2.00 PPG pace')}
            </span>
          </div>
        </div>
        <div className="h-64 w-full sm:h-80">
          <ResponsiveContainer>
            <LineChart data={race} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border-light)" />
              <XAxis
                dataKey="n"
                type="number"
                domain={[1, 'dataMax']}
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                tickLine={false}
              />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
              <Tooltip
                content={
                  <RaceTooltip
                    leftName={nameOf(left)}
                    rightName={nameOf(right)}
                    lang={lang}
                  />
                }
              />
              <Line
                dataKey="pace"
                name={L('จังหวะ 2.00 แต้ม/นัด', '2.00 PPG pace')}
                stroke="var(--text-muted)"
                strokeOpacity={0.5}
                strokeDasharray="4 4"
                dot={false}
                isAnimationActive={false}
              />
              <Line
                dataKey="a"
                name={nameOf(left)}
                stroke="var(--brand)"
                strokeWidth={2.4}
                dot={false}
                activeDot={{ r: 4, fill: 'var(--brand)' }}
                isAnimationActive={false}
              />
              <Line
                dataKey="b"
                name={nameOf(right)}
                stroke="var(--info)"
                strokeWidth={2.4}
                dot={false}
                activeDot={{ r: 4, fill: 'var(--info)' }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </>
  );
}
