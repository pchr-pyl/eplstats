'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  TooltipContentProps,
} from 'recharts';
import { useI18n } from '@/i18n/I18nContext';
import type { SeasonRow, AttackBySeason } from '@/lib/types';
import { seasonShort } from '@/lib/stats';
import { fmt, pct, dash } from '@/lib/format';

type SortKey =
  | 'season' | 'mp' | 'gls' | 'gfPerMp' | 'xg' | 'sh' | 'sot'
  | 'sotPct' | 'gPerSh' | 'pk' | 'pkatt' | 'topScorer';
type SortDir = 'asc' | 'desc';

interface Row {
  season: string;
  short: string;
  mp: number | null;
  gls: number | null;
  gfPerMp: number | null;
  xg: number | null;
  xgPerMp: number | null;
  sh: number | null;
  shPerMp: number | null;
  sot: number | null;
  sotPct: number | null;
  gPerSh: number | null;
  pk: number | null;
  pkatt: number | null;
  topScorer: string | null;
}

export function AttackDashboard({
  rows,
  attack,
}: {
  rows: SeasonRow[];
  attack: AttackBySeason;
}) {
  const { t } = useI18n();
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'season', dir: 'desc' });

  const data = useMemo<Row[]>(() => {
    const allComp = new Map<string, SeasonRow>();
    const pl = new Map<string, SeasonRow>();
    for (const r of rows) {
      if (r.competition === 'All Competitions') allComp.set(r.season, r);
      if (r.competition === 'Premier League') pl.set(r.season, r);
    }
    return Object.keys(attack)
      .sort()
      .map((season) => {
        const a = attack[season];
        const all = allComp.get(season);
        const plRow = pl.get(season);
        const mp = a.mp || null;
        const covered = (a.shCoverage ?? 0) >= 0.5;
        return {
          season,
          short: seasonShort(season),
          mp,
          gls: a.gls,
          gfPerMp: a.gls != null && mp ? a.gls / mp : null,
          xg: plRow?.xg ?? null,
          xgPerMp: plRow?.xg != null && plRow.mp ? plRow.xg / plRow.mp : null,
          sh: covered ? a.sh : null,
          shPerMp: covered && a.sh != null && mp ? a.sh / mp : null,
          sot: covered ? a.sot : null,
          sotPct: covered && a.sot != null && a.sh ? a.sot / a.sh : null,
          gPerSh: covered && a.gls != null && a.sh ? a.gls / a.sh : null,
          pk: a.pk,
          pkatt: a.pkatt,
          topScorer: all?.topScorer ?? null,
        };
      });
  }, [attack, rows]);

  const sorted = useMemo(() => {
    const val = (r: Row): number | string | null => {
      if (sort.key === 'season') return r.season;
      if (sort.key === 'topScorer') return r.topScorer;
      return r[sort.key] as number | null;
    };
    const copy = [...data];
    copy.sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      const an = av == null ? (sort.key === 'season' || sort.key === 'topScorer' ? '' : -Infinity) : av;
      const bn = bv == null ? (sort.key === 'season' || sort.key === 'topScorer' ? '' : -Infinity) : bv;
      const cmp =
        typeof an === 'number' && typeof bn === 'number'
          ? an - bn
          : String(an).localeCompare(String(bn));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [data, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((prev) => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));

  const axisTick = { fill: 'var(--text-muted)', fontSize: 11 };
  const gridStroke = 'var(--border)';

  function ChartTooltip({ active, payload, label }: TooltipContentProps) {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border border-border bg-surface-elevated p-3 shadow-sm">
        <p className="mb-1 text-xs font-semibold text-primary">{label}</p>
        <div className="flex flex-col gap-1">
          {payload.map((entry, idx) => {
            const v = entry.value;
            const dk = String(entry.dataKey ?? '');
            const text =
              typeof v === 'number' && !Number.isNaN(v)
                ? dk === 'sotPct'
                  ? pct(v, 1)
                  : fmt(v, 2)
                : '—';
            return (
              <div key={idx} className="flex items-center gap-2 text-xs text-secondary">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="font-medium" style={{ color: entry.color }}>{entry.name}:</span>
                <span className="font-semibold text-primary">{text}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const latest = data[data.length - 1];

  const kpi = [
    { label: t('attack.kpi.gfPerMp'), value: fmt(latest?.gfPerMp ?? null, 2) },
    { label: t('attack.kpi.shPerMp'), value: fmt(latest?.shPerMp ?? null, 2) },
    { label: t('attack.kpi.sotPct'), value: latest?.sotPct != null ? pct(latest.sotPct, 1) : '—' },
    { label: t('attack.kpi.gPerSh'), value: fmt(latest?.gPerSh ?? null, 2) },
  ];

  const columns: { key: SortKey; label: string; align: 'left' | 'right' }[] = [
    { key: 'season', label: t('attack.table.season'), align: 'left' },
    { key: 'mp', label: 'MP', align: 'right' },
    { key: 'gls', label: 'Gls', align: 'right' },
    { key: 'gfPerMp', label: 'GF/MP', align: 'right' },
    { key: 'xg', label: 'xG', align: 'right' },
    { key: 'sh', label: 'Sh', align: 'right' },
    { key: 'sot', label: 'SoT', align: 'right' },
    { key: 'sotPct', label: 'SoT%', align: 'right' },
    { key: 'gPerSh', label: 'G/Sh', align: 'right' },
    { key: 'pk', label: 'PK', align: 'right' },
    { key: 'pkatt', label: 'PKatt', align: 'right' },
    { key: 'topScorer', label: t('attack.table.topScorer'), align: 'left' },
  ];

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-6 py-8 lg:px-10">
      <section className="flex min-w-0 flex-col gap-4">
        <h2 className="font-display text-xl font-semibold text-primary">{t('attack.title')}</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {kpi.map((k) => (
            <div
              key={k.label}
              className="flex flex-col rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none"
            >
              <span className="text-xs font-medium text-muted">{k.label}</span>
              <span className="mt-2 font-body text-3xl font-bold text-primary">{k.value}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted">{t('attack.note')}</p>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title={t('attack.chart.goals')}>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="short" tick={axisTick} axisLine={{ stroke: gridStroke }} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={36} />
              <Tooltip content={ChartTooltip} />
              <Area
                type="monotone"
                dataKey="gfPerMp"
                name="GF/MP"
                stroke="var(--brand)"
                fill="var(--brand)"
                fillOpacity={0.15}
                isAnimationActive={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="xgPerMp"
                name="xG/MP"
                stroke="var(--info)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: 'var(--info)' }}
                isAnimationActive={false}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t('attack.chart.shots')}>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="short" tick={axisTick} axisLine={{ stroke: gridStroke }} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={32} />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={axisTick}
                axisLine={false}
                tickLine={false}
                width={40}
                domain={[0, 1]}
                tickFormatter={(v: number) => pct(v, 0)}
              />
              <Tooltip content={ChartTooltip} />
              <Area
                type="monotone"
                dataKey="shPerMp"
                name="Sh/MP"
                stroke="var(--brand)"
                fill="var(--brand)"
                fillOpacity={0.15}
                isAnimationActive={false}
                connectNulls
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="sotPct"
                name="SoT%"
                stroke="#0d9488"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#0d9488' }}
                isAnimationActive={false}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm dark:shadow-none">
        <div className="border-b border-border px-4 py-3">
          <h3 className="font-display text-lg font-semibold text-primary">{t('attack.table.title')}</h3>
        </div>
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[1000px] border-collapse">
            <thead className="sticky top-0 z-10 bg-surface-elevated">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className={`cursor-pointer border-b border-border px-3 py-3 text-xs font-semibold uppercase tracking-wider text-muted transition-colors hover:bg-bg-secondary ${col.align === 'left' ? 'text-left' : 'text-right'}`}
                  >
                    <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : 'justify-start'}`}>
                      <span>{col.label}</span>
                      {sort.key === col.key ? (sort.dir === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} className="opacity-30" />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.season} className="border-b border-border transition-colors hover:bg-bg-secondary">
                  <td className="px-3 py-3 text-sm font-medium text-primary">{r.season}</td>
                  <td className="px-3 py-3 text-right text-sm text-secondary">{fmt(r.mp, 0)}</td>
                  <td className="px-3 py-3 text-right text-sm text-secondary">{fmt(r.gls, 0)}</td>
                  <td className="px-3 py-3 text-right text-sm text-secondary">{fmt(r.gfPerMp, 2)}</td>
                  <td className="px-3 py-3 text-right text-sm text-secondary">{fmt(r.xg, 1)}</td>
                  <td className="px-3 py-3 text-right text-sm text-secondary">{fmt(r.sh, 0)}</td>
                  <td className="px-3 py-3 text-right text-sm text-secondary">{fmt(r.sot, 0)}</td>
                  <td className="px-3 py-3 text-right text-sm text-secondary">{r.sotPct != null ? pct(r.sotPct, 1) : '—'}</td>
                  <td className="px-3 py-3 text-right text-sm text-secondary">{fmt(r.gPerSh, 2)}</td>
                  <td className="px-3 py-3 text-right text-sm text-secondary">{fmt(r.pk, 0)}</td>
                  <td className="px-3 py-3 text-right text-sm text-secondary">{fmt(r.pkatt, 0)}</td>
                  <td className="px-3 py-3 text-sm text-secondary"><span className="block max-w-[160px] truncate" title={r.topScorer ?? undefined}>{dash(r.topScorer)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none">
      <h3 className="mb-3 font-display text-lg font-semibold text-primary">{title}</h3>
      {children}
    </div>
  );
}
