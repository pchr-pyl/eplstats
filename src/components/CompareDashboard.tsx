'use client';

import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  TooltipContentProps,
} from 'recharts';
import { useI18n } from '@/i18n/I18nContext';
import type { MatchRow } from '@/lib/types';
import { fmt, pct } from '@/lib/format';

function pts(result: string | null): number {
  if (result === 'W') return 3;
  if (result === 'D') return 1;
  return 0;
}

function cumPoints(rows: MatchRow[]): number[] {
  let total = 0;
  return rows.map((r) => {
    total += pts(r.result);
    return total;
  });
}

interface SeasonStats {
  w: number;
  d: number;
  l: number;
  winRate: number | null;
  drawRate: number | null;
  lossRate: number | null;
  points: number | null;
}

export function CompareDashboard({ matches }: { matches: MatchRow[] }) {
  const { t } = useI18n();
  const seasons = useMemo(() => {
    const set = new Set(
      matches
        .filter((m) => m.competition === 'Premier League' && m.result)
        .map((m) => m.season),
    );
    return Array.from(set).sort();
  }, [matches]);

  const [seasonA, setSeasonA] = useState('2023-2024');
  const [seasonB, setSeasonB] = useState('2025-2026');

  const plA = useMemo(
    () =>
      matches
        .filter(
          (m) =>
            m.season === seasonA &&
            m.competition === 'Premier League' &&
            (m.result === 'W' || m.result === 'D' || m.result === 'L'),
        )
        .sort((a, b) => a.date.localeCompare(b.date)),
    [matches, seasonA],
  );

  const plB = useMemo(
    () =>
      matches
        .filter(
          (m) =>
            m.season === seasonB &&
            m.competition === 'Premier League' &&
            (m.result === 'W' || m.result === 'D' || m.result === 'L'),
        )
        .sort((a, b) => a.date.localeCompare(b.date)),
    [matches, seasonB],
  );

  const cumA = useMemo(() => cumPoints(plA), [plA]);
  const cumB = useMemo(() => cumPoints(plB), [plB]);

  const chartData = useMemo(() => {
    const max = Math.max(cumA.length, cumB.length);
    return Array.from({ length: max }, (_, i) => ({
      match: i + 1,
      pointsA: cumA[i] ?? null,
      pointsB: cumB[i] ?? null,
    }));
  }, [cumA, cumB]);

  const matchweek = Math.min(plA.length, plB.length);

  const statsA = useMemo<SeasonStats>(() => {
    const slice = plA.slice(0, matchweek);
    const w = slice.filter((m) => m.result === 'W').length;
    const d = slice.filter((m) => m.result === 'D').length;
    const l = slice.filter((m) => m.result === 'L').length;
    const total = slice.length;
    return {
      w,
      d,
      l,
      winRate: total > 0 ? w / total : null,
      drawRate: total > 0 ? d / total : null,
      lossRate: total > 0 ? l / total : null,
      points: total > 0 ? cumA[matchweek - 1] ?? null : null,
    };
  }, [plA, matchweek, cumA]);

  const statsB = useMemo<SeasonStats>(() => {
    const slice = plB.slice(0, matchweek);
    const w = slice.filter((m) => m.result === 'W').length;
    const d = slice.filter((m) => m.result === 'D').length;
    const l = slice.filter((m) => m.result === 'L').length;
    const total = slice.length;
    return {
      w,
      d,
      l,
      winRate: total > 0 ? w / total : null,
      drawRate: total > 0 ? d / total : null,
      lossRate: total > 0 ? l / total : null,
      points: total > 0 ? cumB[matchweek - 1] ?? null : null,
    };
  }, [plB, matchweek, cumB]);

  const axisTick = { fill: 'var(--text-muted)', fontSize: 11 };
  const gridStroke = 'var(--border)';

  function ChartTooltip({ active, payload, label }: TooltipContentProps) {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border border-border bg-surface-elevated p-3 shadow-sm">
        <p className="mb-1 text-xs font-semibold text-primary">
          {t('compare.matchweek')} {label}
        </p>
        <div className="flex flex-col gap-1">
          {payload.map((entry, idx) => {
            const value = entry.value;
            const text = typeof value === 'number' && !Number.isNaN(value) ? fmt(value, 0) : '—';
            const color = entry.color ?? 'var(--text-muted)';
            return (
              <div key={idx} className="flex items-center gap-2 text-xs text-secondary">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="font-medium" style={{ color }}>
                  {String((typeof entry.name === 'string' ? entry.name : entry.dataKey) ?? '')}:
                </span>
                <span className="font-semibold text-primary">{text}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const statItems = [
    { key: 'w', value: (s: SeasonStats) => fmt(s.w, 0) },
    { key: 'd', value: (s: SeasonStats) => fmt(s.d, 0) },
    { key: 'l', value: (s: SeasonStats) => fmt(s.l, 0) },
    { key: 'winRate', value: (s: SeasonStats) => pct(s.winRate, 1) },
    { key: 'drawRate', value: (s: SeasonStats) => pct(s.drawRate, 1) },
    { key: 'lossRate', value: (s: SeasonStats) => pct(s.lossRate, 1) },
    { key: 'points', value: (s: SeasonStats) => fmt(s.points, 0) },
  ];

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-6 py-8 lg:px-10">
      <section className="flex min-w-0 flex-col gap-4">
        <h2 className="font-display text-xl font-semibold text-primary">{t('compare.title')}</h2>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="seasonA" className="text-sm text-secondary">
              {t('compare.seasonA')}
            </label>
            <select
              id="seasonA"
              value={seasonA}
              onChange={(e) => setSeasonA(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary"
            >
              {seasons.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="seasonB" className="text-sm text-secondary">
              {t('compare.seasonB')}
            </label>
            <select
              id="seasonB"
              value={seasonB}
              onChange={(e) => setSeasonB(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary"
            >
              {seasons.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none">
        <h3 className="mb-3 font-display text-lg font-semibold text-primary">{t('compare.chartTitle')}</h3>
        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="match" tick={axisTick} axisLine={{ stroke: gridStroke }} tickLine={false} />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} width={32} domain={[0, 'auto']} />
            <Tooltip content={ChartTooltip} />
            <Line
              type="monotone"
              dataKey="pointsA"
              name={seasonA}
              stroke="var(--brand)"
              strokeWidth={2.5}
              dot={{ r: 3, fill: 'var(--brand)' }}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="pointsB"
              name={seasonB}
              stroke="var(--info)"
              strokeWidth={2.5}
              dot={{ r: 3, fill: 'var(--info)' }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {[statsA, statsB].map((stats, idx) => {
          const season = idx === 0 ? seasonA : seasonB;
          return (
            <div
              key={season}
              className="min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none"
            >
              <h4 className="mb-3 font-display text-lg font-semibold text-primary">
                {t('compare.statTitle').replace('{matchweek}', String(matchweek))} · {season}
              </h4>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {statItems.map((item) => (
                  <div
                    key={item.key}
                    className="flex flex-col rounded-xl border border-border bg-bg-secondary p-3"
                  >
                    <span className="text-xs font-medium text-muted">{t(`compare.${item.key}`)}</span>
                    <span className="mt-1 font-body text-2xl font-bold text-primary">
                      {item.value(stats)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <footer>
        <p className="text-xs text-muted">{t('compare.note')}</p>
      </footer>
    </main>
  );
}
