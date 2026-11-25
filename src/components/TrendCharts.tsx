'use client';

import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  type TooltipContentProps,
  LineChart,
  ReferenceLine,
  LabelList,
} from 'recharts';
import { LabelsBtn } from './LabelsBtn';
import { ShareBtn } from './ShareBtn';
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

interface TrendTooltipProps extends TooltipContentProps {
  labelOf: (key: string) => string;
}

function TrendTooltip({ active, payload, labelOf }: TrendTooltipProps) {
  if (!active || !payload?.length) return null;
  const pt = payload[0]?.payload as ChartPoint | undefined;
  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-3 shadow-lg">
      <p className="mb-1.5 border-b border-border-light pb-1 font-display text-xs font-bold tabular-nums text-primary">
        {pt?.season ?? ''}
      </p>
      <div className="flex flex-col gap-1">
        {payload.map((entry, idx) => {
          const value = entry.value;
          const dataKey = entry.dataKey as string | undefined;
          let text = '—';
          if (typeof value === 'number' && !Number.isNaN(value)) {
            text = ['winRate', 'csRate'].includes(dataKey ?? '')
              ? pct(value, 2)
              : fmt(value, 2);
          }
          const color = entry.color ?? 'var(--text-muted)';
          return (
            <div
              key={idx}
              className="flex items-center justify-between gap-4 text-xs text-secondary"
            >
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="font-medium">{labelOf(dataKey ?? '')}</span>
              </span>
              <span className="font-bold tabular-nums text-primary">{text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface StatPill {
  label: string;
  value: string;
  sub?: string;
}

function summarize(
  data: ChartPoint[],
  getVal: (d: ChartPoint) => number | null,
  mode: 'max' | 'min' = 'max',
): { avg: number | null; best: { val: number; short: string } | null } {
  const valid = data
    .map((d) => ({ v: getVal(d), short: d.short }))
    .filter((x): x is { v: number; short: string } => x.v != null && !Number.isNaN(x.v));
  if (!valid.length) return { avg: null, best: null };
  const avgVal = valid.reduce((s, x) => s + x.v, 0) / valid.length;
  const best = valid.reduce((acc, x) =>
    mode === 'max' ? (x.v > acc.v ? x : acc) : x.v < acc.v ? x : acc,
  );
  return { avg: avgVal, best: { val: best.v, short: best.short } };
}

export function TrendCharts({ rows }: { rows: SeasonRow[] }) {
  const { t, lang } = useI18n();
  const th = lang === 'th';
  const tx = (en: string, thText: string) => (th ? thText : en);

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

  const summaries = useMemo(() => {
    return {
      attack: summarize(data, (d) => d.gfPerMp, 'max'),
      defense: summarize(data, (d) => d.gaPerMp, 'min'),
      pts: summarize(data, (d) => d.ptsPerMp, 'max'),
      win: summarize(data, (d) => d.winRate, 'max'),
      cs: summarize(data, (d) => d.csRate, 'max'),
    };
  }, [data]);

  const chartLabel = (name: string) => {
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
  };

  const renderTooltip = (props: TooltipContentProps) => (
    <TrendTooltip {...props} labelOf={chartLabel} />
  );

  const axisTick = { fill: 'var(--text-muted)', fontSize: 11 };
  const gridStroke = 'var(--border-light)';

  const [lbl, setLbl] = useState<Record<string, boolean>>({});
  const lblOn = (k: string) => !!lbl[k];
  const toggleLbl = (k: string) => setLbl((p) => ({ ...p, [k]: !p[k] }));
  const numFmt = (v: unknown) => fmt(Number(v), 2);
  const pctFmt = (v: unknown) => pct(Number(v), 2);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* 1. Attack */}
      <ChartCard
        eyebrow={tx('Offensive Output', 'ประสิทธิภาพเกมรุก')}
        title={t('charts.attack')}
        pills={[
          {
            label: tx('Era Avg', 'เฉลี่ย'),
            value: fmt(summaries.attack.avg, 2),
          },
          ...(summaries.attack.best
            ? [
                {
                  label: tx('Era High', 'สูงสุด'),
                  value: fmt(summaries.attack.best.val, 2),
                  sub: summaries.attack.best.short,
                },
              ]
            : []),
        ]}
        legend={[
          { label: t('charts.gfPerMp'), color: 'var(--brand)', kind: 'bar' },
          { label: t('charts.xg'), color: 'var(--chart-neutral)', kind: 'line' },
        ]}
        action={
          <LabelsBtn on={lblOn('attack')} onClick={() => toggleLbl('attack')} />
        }
      >
        <ResponsiveContainer width="100%" height={270}>
          <ComposedChart data={data} margin={{ top: 12, right: 10, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="short"
              tick={axisTick}
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={false}
            />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} width={34} />
            <Tooltip content={renderTooltip} />
            <Bar
              dataKey="gfPerMp"
              fill="var(--brand)"
              radius={[5, 5, 0, 0]}
              maxBarSize={36}
              name="gfPerMp"
              isAnimationActive={false}
            >
              {lblOn('attack') && (
                <LabelList
                  dataKey="gfPerMp"
                  position="top"
                  fontSize={10}
                  fill="var(--text-muted)"
                  formatter={numFmt}
                />
              )}
            </Bar>
            <Line
              type="monotone"
              dataKey="xgPerMp"
              stroke="var(--chart-neutral)"
              strokeWidth={2.5}
              dot={{ r: 3, fill: 'var(--chart-neutral)' }}
              activeDot={{ r: 5 }}
              connectNulls={false}
              isAnimationActive={false}
              name="xgPerMp"
            >
              {lblOn('attack') && (
                <LabelList
                  dataKey="xgPerMp"
                  position="top"
                  fontSize={10}
                  fill="var(--text-muted)"
                  formatter={numFmt}
                />
              )}
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 2. Defense */}
      <ChartCard
        eyebrow={tx('Defensive Record', 'ความเหนียวแน่นเกมรับ')}
        title={t('charts.defense')}
        pills={[
          {
            label: tx('Era Avg', 'เฉลี่ย'),
            value: fmt(summaries.defense.avg, 2),
          },
          ...(summaries.defense.best
            ? [
                {
                  label: tx('Best Def', 'เหนียวสุด'),
                  value: fmt(summaries.defense.best.val, 2),
                  sub: summaries.defense.best.short,
                },
              ]
            : []),
        ]}
        legend={[
          { label: t('charts.gaPerMp'), color: 'var(--danger)', kind: 'bar' },
          { label: t('charts.xga'), color: 'var(--chart-neutral)', kind: 'line' },
        ]}
        action={
          <LabelsBtn on={lblOn('defense')} onClick={() => toggleLbl('defense')} />
        }
      >
        <ResponsiveContainer width="100%" height={270}>
          <ComposedChart data={data} margin={{ top: 12, right: 10, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="short"
              tick={axisTick}
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={false}
            />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} width={34} />
            <Tooltip content={renderTooltip} />
            <Bar
              dataKey="gaPerMp"
              fill="var(--danger)"
              radius={[5, 5, 0, 0]}
              maxBarSize={36}
              name="gaPerMp"
              isAnimationActive={false}
            >
              {lblOn('defense') && (
                <LabelList
                  dataKey="gaPerMp"
                  position="top"
                  fontSize={10}
                  fill="var(--text-muted)"
                  formatter={numFmt}
                />
              )}
            </Bar>
            <Line
              type="monotone"
              dataKey="xgaPerMp"
              stroke="var(--chart-neutral)"
              strokeWidth={2.5}
              dot={{ r: 3, fill: 'var(--chart-neutral)' }}
              activeDot={{ r: 5 }}
              connectNulls={false}
              isAnimationActive={false}
              name="xgaPerMp"
            >
              {lblOn('defense') && (
                <LabelList
                  dataKey="xgaPerMp"
                  position="top"
                  fontSize={10}
                  fill="var(--text-muted)"
                  formatter={numFmt}
                />
              )}
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 3. Points Trend */}
      <ChartCard
        eyebrow={tx('Points Pace', 'อัตราการเก็บคะแนน')}
        title={t('charts.pointsTrend')}
        pills={[
          {
            label: tx('Era Avg', 'เฉลี่ย'),
            value: fmt(summaries.pts.avg, 2),
          },
          ...(summaries.pts.best
            ? [
                {
                  label: tx('Era High', 'สูงสุด'),
                  value: fmt(summaries.pts.best.val, 2),
                  sub: summaries.pts.best.short,
                },
              ]
            : []),
        ]}
        legend={[
          { label: t('charts.ptsPerMp'), color: 'var(--brand)', kind: 'line' },
          { label: t('charts.refLine'), color: 'var(--text-muted)', kind: 'dashed' },
        ]}
        action={<LabelsBtn on={lblOn('pts')} onClick={() => toggleLbl('pts')} />}
      >
        <ResponsiveContainer width="100%" height={270}>
          <LineChart data={data} margin={{ top: 12, right: 10, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="short"
              tick={axisTick}
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={false}
            />
            <YAxis
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              width={34}
              domain={[0, 'auto']}
            />
            <Tooltip content={renderTooltip} />
            <ReferenceLine
              y={2.0}
              stroke="var(--text-muted)"
              strokeDasharray="4 4"
              label={{
                value: t('charts.refLine'),
                position: 'insideTopRight',
                fill: 'var(--text-muted)',
                fontSize: 10,
              }}
            />
            <Line
              type="monotone"
              dataKey="ptsPerMp"
              stroke="var(--brand)"
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: 'var(--brand)' }}
              activeDot={{ r: 5.5 }}
              connectNulls={false}
              isAnimationActive={false}
              name="ptsPerMp"
            >
              {lblOn('pts') && (
                <LabelList
                  dataKey="ptsPerMp"
                  position="top"
                  fontSize={10}
                  fill="var(--text-muted)"
                  formatter={numFmt}
                />
              )}
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 4. Win & CS Rates */}
      <ChartCard
        eyebrow={tx('Efficiency & Shutouts', 'อัตราชนะและคลีนชีต')}
        title={t('charts.rates')}
        pills={[
          {
            label: tx('Avg Win', 'ชนะเฉลี่ย'),
            value: pct(summaries.win.avg, 2),
          },
          ...(summaries.win.best
            ? [
                {
                  label: tx('Peak Win', 'ชนะสูงสุด'),
                  value: pct(summaries.win.best.val, 2),
                  sub: summaries.win.best.short,
                },
              ]
            : []),
        ]}
        legend={[
          { label: t('charts.winRate'), color: 'var(--brand)', kind: 'line' },
          { label: t('charts.csRate'), color: 'var(--success)', kind: 'line' },
        ]}
        action={
          <LabelsBtn on={lblOn('rates')} onClick={() => toggleLbl('rates')} />
        }
      >
        <ResponsiveContainer width="100%" height={270}>
          <LineChart data={data} margin={{ top: 12, right: 10, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="short"
              tick={axisTick}
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={false}
            />
            <YAxis
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              width={44}
              domain={[0, 1]}
              tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
            />
            <Tooltip content={renderTooltip} />
            <Line
              type="monotone"
              dataKey="winRate"
              stroke="var(--brand)"
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: 'var(--brand)' }}
              activeDot={{ r: 5.5 }}
              connectNulls={false}
              isAnimationActive={false}
              name="winRate"
            >
              {lblOn('rates') && (
                <LabelList
                  dataKey="winRate"
                  position="top"
                  fontSize={10}
                  fill="var(--text-muted)"
                  formatter={pctFmt}
                />
              )}
            </Line>
            <Line
              type="monotone"
              dataKey="csRate"
              stroke="var(--success)"
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: 'var(--success)' }}
              activeDot={{ r: 5.5 }}
              connectNulls={false}
              isAnimationActive={false}
              name="csRate"
            >
              {lblOn('rates') && (
                <LabelList
                  dataKey="csRate"
                  position="bottom"
                  fontSize={10}
                  fill="var(--text-muted)"
                  formatter={pctFmt}
                />
              )}
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({
  eyebrow,
  title,
  pills,
  legend,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  pills?: StatPill[];
  legend?: { label: string; color: string; kind: 'bar' | 'line' | 'dashed' }[];
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5 dark:shadow-none">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
            {eyebrow}
          </p>
          <h3 className="mt-0.5 font-display text-base font-bold text-primary sm:text-lg">
            {title}
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          {action}
          <ShareBtn />
        </div>
      </div>

      {/* Callout pills + legend strip */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border-light pb-2.5">
        {legend && legend.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-secondary">
            {legend.map((item) => (
              <span key={item.label} className="inline-flex items-center gap-1.5">
                {item.kind === 'bar' ? (
                  <span
                    className="h-2.5 w-2.5 rounded-xs"
                    style={{ backgroundColor: item.color }}
                  />
                ) : item.kind === 'dashed' ? (
                  <span
                    className="w-3.5 border-t-2 border-dashed"
                    style={{ borderColor: item.color }}
                  />
                ) : (
                  <span
                    className="h-0.5 w-3.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                )}
                <span>{item.label}</span>
              </span>
            ))}
          </div>
        )}

        {pills && pills.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {pills.map((p) => (
              <span
                key={p.label}
                className="inline-flex items-baseline gap-1.5 rounded-lg border border-border-light bg-bg-secondary/70 px-2 py-0.5 text-[11px] tabular-nums"
              >
                <span className="font-semibold text-muted">{p.label}</span>
                <span className="font-bold text-primary">{p.value}</span>
                {p.sub && <span className="text-[10px] text-muted">({p.sub})</span>}
              </span>
            ))}
          </div>
        )}
      </div>

      {children}
    </div>
  );
}
