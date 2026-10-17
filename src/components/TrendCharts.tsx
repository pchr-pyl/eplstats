'use client';

import { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  TooltipContentProps,
  LineChart,
  ReferenceLine,
} from 'recharts';
import { useI18n } from '@/i18n/I18nContext';
import type { SeasonRow } from '@/lib/types';
import { seasonShort, winRate, csRate } from '@/lib/stats';
import { fmt, pct } from '@/lib/format';

interface ChartPoint {
  season: string;
  short: string;
  gfPerMp: number | null;
  xgPerMp: number | null;
  gaPerMp: number | null;
  xgaPerMp: number | null;
  ptsPerMp: number | null;
  winRate: number | null;
  csRate: number | null;
}

export function TrendCharts({ rows }: { rows: SeasonRow[] }) {
  const { t } = useI18n();

  const data = useMemo<ChartPoint[]>(() => {
    return [...rows]
      .sort((a, b) => a.season.localeCompare(b.season))
      .map((r) => {
        const per = (num: number | null, den: number | null) =>
          num != null && den != null && den > 0 ? num / den : null;
        return {
          season: r.season,
          short: seasonShort(r.season),
          gfPerMp: per(r.gf, r.mp),
          xgPerMp: per(r.xg, r.mp),
          gaPerMp: per(r.ga, r.mp),
          xgaPerMp: per(r.xga, r.mp),
          ptsPerMp: r.ptsPerMp,
          winRate: winRate(r),
          csRate: csRate(r),
        };
      });
  }, [rows]);

  function ChartTooltip({
    active,
    payload,
    label,
  }: TooltipContentProps) {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border border-border bg-surface-elevated p-3 shadow-sm">
        <p className="mb-1 text-xs font-semibold text-primary">{label}</p>
        <div className="flex flex-col gap-1">
          {payload.map((entry, idx) => {
            const value = entry.value;
            const dataKey = entry.dataKey as string | undefined;
            let text = '—';
            if (typeof value === 'number' && !Number.isNaN(value)) {
              text = ['winRate', 'csRate'].includes(dataKey ?? '') ? pct(value, 2) : fmt(value, 2);
            }
            const color = entry.color ?? 'var(--text-muted)';
            return (
              <div key={idx} className="flex items-center gap-2 text-xs text-secondary">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="font-medium" style={{ color }}>
                  {chartLabel(dataKey ?? '')}:
                </span>
                <span className="font-semibold text-primary">{text}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function chartLabel(name: string) {
    switch (name) {
      case 'gfPerMp':
        return t('charts.gfPerMp');
      case 'xgPerMp':
        return t('charts.xg');
      case 'gaPerMp':
        return t('charts.gaPerMp');
      case 'xgaPerMp':
        return t('charts.xga');
      case 'ptsPerMp':
        return t('charts.ptsPerMp');
      case 'winRate':
        return t('charts.winRate');
      case 'csRate':
        return t('charts.csRate');
      default:
        return name;
    }
  }

  const axisTick = { fill: 'var(--text-muted)', fontSize: 11 };
  const gridStroke = 'var(--border)';

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <ChartCard title={t('charts.attack')}>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="short" tick={axisTick} axisLine={{ stroke: gridStroke }} tickLine={false} />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} width={32} />
            <Tooltip content={ChartTooltip} />
            <Bar dataKey="gfPerMp" fill="var(--brand)" radius={[4, 4, 0, 0]} name="gfPerMp" isAnimationActive={false} />
            <Line
              type="monotone"
              dataKey="xgPerMp"
              stroke="var(--chart-neutral)"
              strokeWidth={2.5}
              dot={{ r: 3, fill: 'var(--chart-neutral)' }}
              connectNulls={false}
              isAnimationActive={false}
              name="xgPerMp"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={t('charts.defense')}>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="short" tick={axisTick} axisLine={{ stroke: gridStroke }} tickLine={false} />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} width={32} />
            <Tooltip content={ChartTooltip} />
            <Bar dataKey="gaPerMp" fill="var(--danger)" radius={[4, 4, 0, 0]} name="gaPerMp" isAnimationActive={false} />
            <Line
              type="monotone"
              dataKey="xgaPerMp"
              stroke="var(--chart-neutral)"
              strokeWidth={2.5}
              dot={{ r: 3, fill: 'var(--chart-neutral)' }}
              connectNulls={false}
              isAnimationActive={false}
              name="xgaPerMp"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={t('charts.pointsTrend')}>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="short" tick={axisTick} axisLine={{ stroke: gridStroke }} tickLine={false} />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} width={32} domain={[0, 'auto']} />
            <Tooltip content={ChartTooltip} />
            <ReferenceLine y={2.0} stroke="var(--text-muted)" strokeDasharray="4 4" label={t('charts.refLine')} />
            <Line
              type="monotone"
              dataKey="ptsPerMp"
              stroke="var(--brand)"
              strokeWidth={2.5}
              dot={{ r: 3, fill: 'var(--brand)' }}
              connectNulls={false}
              isAnimationActive={false}
              name="ptsPerMp"
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={t('charts.rates')}>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="short" tick={axisTick} axisLine={{ stroke: gridStroke }} tickLine={false} />
            <YAxis
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              width={44}
              domain={[0, 1]}
              tickFormatter={(v: number) => pct(v, 0)}
            />
            <Tooltip content={ChartTooltip} />
            <Line
              type="monotone"
              dataKey="winRate"
              stroke="var(--brand)"
              strokeWidth={2.5}
              dot={{ r: 3, fill: 'var(--brand)' }}
              connectNulls={false}
              isAnimationActive={false}
              name="winRate"
            />
            <Line
              type="monotone"
              dataKey="csRate"
              stroke="var(--success)"
              strokeWidth={2.5}
              dot={{ r: 3, fill: 'var(--success)' }}
              connectNulls={false}
              isAnimationActive={false}
              name="csRate"
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none">
      <h3 className="mb-3 font-display text-lg font-semibold text-primary">{title}</h3>
      {children}
    </div>
  );
}
