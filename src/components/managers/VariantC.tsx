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
import { fmt, pct, signed } from '@/lib/format';
import {
  csRate,
  displayName,
  gaPer,
  gfPer,
  isCurrent,
  periodShort,
  ppg,
  StintStat,
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
  abs?: boolean;
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
      { label: L('แต้ม/นัด', 'Pts / match'), get: ppg, fmt: (v) => fmt(v) },
      { label: L('อัตราชนะ', 'Win rate'), get: winRate, fmt: (v) => pct(v, 2) },
      { label: L('ประตูได้/นัด', 'Goals for / match'), get: gfPer, fmt: (v) => fmt(v) },
      { label: L('ประตูเสีย/นัด', 'Goals against / match'), get: gaPer, fmt: (v) => fmt(v), lowerBetter: true },
      { label: L('คลีนชีต', 'Clean sheets'), get: csRate, fmt: (v) => pct(v, 2) },
      ...(hasXg
        ? ([
            { label: 'xG/' + L('นัด', 'match'), get: xgPer, fmt: (v: number | null) => fmt(v) },
            { label: 'xGA/' + L('นัด', 'match'), get: xgaPer, fmt: (v: number | null) => fmt(v), lowerBetter: true },
            { label: 'xGD/' + L('นัด', 'match'), get: xgdPer, fmt: (v: number | null) => signed(v), abs: true },
          ] satisfies Metric[])
        : []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang, hasXg],
  );

  const race = useMemo(() => {
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

  const select = (v: string, set: (x: string) => void, side: string) => (
    <select
      aria-label={side}
      value={v}
      onChange={(e) => set(e.target.value)}
      className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary focus-visible:outline-2 focus-visible:outline-brand"
    >
      {options.map((s) => (
        <option key={s.id} value={s.id}>
          {displayName(s.stint, lang)}
          {s.stint.interim ? ` (${L('รักษาการ', 'interim')})` : ''}
        </option>
      ))}
    </select>
  );

  let leftWins = 0;
  let rightWins = 0;
  let contested = 0;
  for (const m of metrics) {
    const a = left ? m.get(left) : null;
    const b = right ? m.get(right) : null;
    if (a == null || b == null || a === b) continue;
    contested++;
    const leftBetter = m.lowerBetter ? a < b : a > b;
    if (leftBetter) leftWins++;
    else rightWins++;
  }

  const nameOf = (s: StintStat) => displayName(s.stint, lang);

  return (
    <>
      {/* pickers + names */}
      <section className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <div className="flex flex-col items-start gap-2 sm:items-end sm:text-right">
          {select(left.id, setLeftId, L('ผู้จัดการฝั่งซ้าย', 'Left manager'))}
          <h3 className="font-display font-semibold leading-tight text-primary" style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.5rem)' }}>
            {nameOf(left)}
          </h3>
          <p className="text-sm text-muted">
            {periodShort(left.stint, lang)} · {left.mp} MP
          </p>
        </div>
        <div className="self-center text-center font-display text-xl font-semibold text-muted">VS</div>
        <div className="flex flex-col items-start gap-2">
          {select(right.id, setRightId, L('ผู้จัดการฝั่งขวา', 'Right manager'))}
          <h3 className="font-display font-semibold leading-tight text-primary" style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.5rem)' }}>
            {nameOf(right)}
          </h3>
          <p className="text-sm text-muted">
            {periodShort(right.stint, lang)} · {right.mp} MP
          </p>
        </div>
      </section>

      {/* butterfly bars */}
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
        <div className="flex flex-col gap-3">
          {metrics.map((m) => {
            const a = left ? m.get(left) : null;
            const b = right ? m.get(right) : null;
            const both = a != null && b != null;
            const max = Math.max(Math.abs(a ?? 0), Math.abs(b ?? 0), 1e-9);
            const leftBetter = both && a !== b && (m.lowerBetter ? a! < b! : a! > b!);
            const rightBetter = both && a !== b && !leftBetter;
            const bar = (v: number, win: boolean) => (
              <span
                className="block h-4 rounded-sm"
                style={{
                  width: `${(Math.abs(v) / max) * 100}%`,
                  background: win ? 'var(--brand)' : 'var(--chart-neutral)',
                  minWidth: 2,
                }}
              />
            );
            return (
              <div key={m.label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
                <div className="flex items-center justify-end gap-2">
                  <span className="text-sm font-medium text-primary tabular-nums">{m.fmt(a)}</span>
                  <span className="flex w-full max-w-40 justify-end sm:max-w-56">
                    {a != null ? bar(a, leftBetter) : null}
                  </span>
                </div>
                <div className="w-28 text-center sm:w-40">
                  <div className="text-xs font-medium text-secondary">{m.label}</div>
                  {m.lowerBetter && (
                    <div className="text-[10px] text-muted">↓ {L('ดีกว่า', 'better')}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex w-full max-w-40 sm:max-w-56">
                    {b != null ? bar(b, rightBetter) : null}
                  </span>
                  <span className="text-sm font-medium text-primary tabular-nums">{m.fmt(b)}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 border-t border-border pt-3 text-center text-sm text-secondary">
          {leftWins > 0 && (
            <span>
              <span className="font-medium text-primary">{nameOf(left)}</span>{' '}
              {L('ดีกว่าใน', 'better in')} {leftWins} {L('จาก', 'of')} {contested}{' '}
              {L('หมวด', 'categories')}
            </span>
          )}
          {leftWins > 0 && rightWins > 0 && <span className="mx-2 text-muted">·</span>}
          {rightWins > 0 && (
            <span>
              <span className="font-medium text-primary">{nameOf(right)}</span>{' '}
              {L('ดีกว่าใน', 'better in')} {rightWins} {L('จาก', 'of')} {contested}{' '}
              {L('หมวด', 'categories')}
            </span>
          )}
          {contested === 0 && <span className="text-muted">—</span>}
        </div>
      </section>

      {/* points race */}
      <section className="rounded-2xl border border-border bg-surface p-4">
        <h3 className="mb-2 font-display text-lg font-semibold text-primary">
          {L('แต้มสะสมนับจากนัดแรก', 'Cumulative points from match 1')}
        </h3>
        <div className="h-64 w-full sm:h-80">
          <ResponsiveContainer>
            <LineChart data={race} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
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
                contentStyle={{
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  fontSize: 13,
                }}
                labelFormatter={(n) => `${L('นัดที่', 'Match')} ${n}`}
              />
              <Line
                dataKey="pace"
                name={L('จังหวะ 2 แต้ม/นัด', '2 pts/match pace')}
                stroke="var(--border)"
                strokeDasharray="4 4"
                dot={false}
                isAnimationActive={false}
              />
              <Line
                dataKey="a"
                name={nameOf(left)}
                stroke="var(--brand)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                dataKey="b"
                name={nameOf(right)}
                stroke="var(--text-secondary)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </>
  );
}
