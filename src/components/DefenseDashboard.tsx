'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  TooltipContentProps,
} from 'recharts';
import { useI18n } from '@/i18n/I18nContext';
import type { CompGroup, KeepersData, GkSeasonRow, TeamStatsBySeason } from '@/lib/types';
import { mergedGkRows, rowsForGroup, seasonShort, teamStatsForGroup } from '@/lib/stats';
import { fmt, pct, signed, dash } from '@/lib/format';
import { useClub, useClubData } from './ClubProvider';
import { loadKeepersSeason, LOAD_FAILED } from './matchlog-shared';
import { CompetitionTabs } from './CompetitionTabs';
import { MatchlogPanel } from './MatchlogBrowser';
import { SeasonPace } from './SeasonPace';

type SortKey = 'season' | 'player' | 'mp' | 'ga' | 'sota' | 'saves' | 'savePct' | 'cs';
type DefSortKey =
  | 'season' | 'mp' | 'ga' | 'gaPerMp' | 'xga' | 'shA' | 'sota'
  | 'saves' | 'savePct' | 'cs' | 'csPct';
type SortDir = 'asc' | 'desc';

function sum(values: (number | null | undefined)[]): number {
  return values.reduce((acc: number, v) => acc + (v ?? 0), 0);
}

interface DefRow {
  season: string;
  short: string;
  mp: number;
  ga: number | null;
  gaPerMp: number | null;
  xga: number | null;
  xgaPerMp: number | null;
  shA: number | null;
  shAPerMp: number | null;
  sota: number | null;
  sotaPerMp: number | null;
  saves: number | null;
  savePct: number | null;
  cs: number | null;
  csPct: number | null;
}

export function DefenseDashboard({
  data,
  lazySeasons,
  teamStats,
}: {
  data: KeepersData;
  lazySeasons?: string[];
  teamStats: TeamStatsBySeason;
}) {
  const { t } = useI18n();
  const { club } = useClub();
  const { rows } = useClubData();
  const [group, setGroup] = useState<CompGroup>('all');
  const [extra, setExtra] = useState<KeepersData[]>([]);
  const [lazyLoading, setLazyLoading] = useState(
    () => (lazySeasons?.length ?? 0) > 0
  );

  useEffect(() => {
    if (!lazySeasons?.length) return;
    let live = true;
    Promise.all(
      lazySeasons.map((s) => loadKeepersSeason(club.slug, s))
    ).then((results) => {
      if (!live) return;
      setExtra(
        results.filter((r): r is KeepersData => r != null && r !== LOAD_FAILED),
      );
      setLazyLoading(false);
    });
    return () => {
      live = false;
    };
  }, [club.slug, lazySeasons]);

  const merged = useMemo<KeepersData>(() => {
    if (!extra.length) return data;
    return {
      matchLog: [...extra.map((d) => d.matchLog ?? []), data.matchLog].flat(),
      perGkSeason: [
        ...extra.map((d) => d.perGkSeason ?? []),
        data.perGkSeason,
      ].flat(),
      psxg: [...extra.map((d) => d.psxg ?? []), data.psxg].flat(),
      psxgPerGk: [
        ...extra.map((d) => d.psxgPerGk ?? []),
        data.psxgPerGk,
      ].flat(),
      perGkComp: [
        ...extra.map((d) => d.perGkComp ?? []),
        data.perGkComp ?? [],
      ].flat(),
    };
  }, [data, extra]);

  const { perGkSeason, psxg, perGkComp } = merged;

  const gkRows = useMemo(() => {
    if (group === 'all') return { rows: perGkSeason, fallback: false };
    const merged = mergedGkRows(perGkComp ?? [], group);
    return merged.length
      ? { rows: merged, fallback: false }
      : { rows: perGkSeason, fallback: true };
  }, [group, perGkSeason, perGkComp]);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'season', dir: 'desc' });
  const [defSort, setDefSort] = useState<{ key: DefSortKey; dir: SortDir }>({ key: 'season', dir: 'desc' });

  const defRows = useMemo<DefRow[]>(() => {
    const groupMap = new Map(
      rowsForGroup(rows, group).map((r) => [r.season, r])
    );
    const plMap = new Map(
      rows
        .filter((r) => r.competition === 'Premier League')
        .map((r) => [r.season, r])
    );
    return teamStatsForGroup(teamStats, group).map((r) => {
      const xgaRow =
        group === 'all' ? plMap.get(r.season) : groupMap.get(r.season);
      const shCovered = r.mp > 0 && r.shAN / r.mp >= 0.5;
      const kCovered = r.mp > 0 && r.kN / r.mp >= 0.5;
      return {
        season: r.season,
        short: seasonShort(r.season),
        mp: r.mp,
        ga: r.ga,
        gaPerMp: r.ga != null && r.mp ? r.ga / r.mp : null,
        xga: xgaRow?.xga ?? null,
        xgaPerMp:
          xgaRow?.xga != null && xgaRow.mp ? xgaRow.xga / xgaRow.mp : null,
        shA: shCovered ? r.shA : null,
        shAPerMp:
          shCovered && r.shA != null && r.shAN ? r.shA / r.shAN : null,
        sota: kCovered ? r.sota : null,
        sotaPerMp:
          kCovered && r.sota != null && r.kN ? r.sota / r.kN : null,
        saves: kCovered ? r.saves : null,
        savePct:
          kCovered && r.saves != null && r.sota ? r.saves / r.sota : null,
        cs: r.cs,
        csPct: r.cs != null && r.kN ? r.cs / r.kN : null,
      };
    });
  }, [teamStats, rows, group]);

  const latestSeason = defRows[defRows.length - 1] ?? null;

  const latestPsxg = useMemo(() => {
    const rows = psxg
      .filter((r) => r.psxg != null && r.psxgPlusMinus != null)
      .sort((a, b) => a.season.localeCompare(b.season));
    return rows[rows.length - 1] ?? null;
  }, [psxg]);

  const perGk = useMemo(() => {
    const groups = new Map<string, GkSeasonRow[]>();
    for (const r of gkRows.rows) {
      const arr = groups.get(r.player) ?? [];
      arr.push(r);
      groups.set(r.player, arr);
    }
    const out = Array.from(groups.entries()).map(([player, rows]) => {
      const sota = sum(rows.map((r) => r.sota));
      const saves = sum(rows.map((r) => r.saves));
      const ga = sum(rows.map((r) => r.ga));
      const cs = sum(rows.map((r) => r.cs));
      const mp = sum(rows.map((r) => r.mp));
      const savePct = sota > 0 ? saves / sota : null;
      return { player, mp, sota, saves, ga, cs, savePct };
    });
    out.sort((a, b) => b.sota - a.sota);
    return out;
  }, [gkRows]);

  const goalsPrevented = useMemo(() => {
    return [...psxg]
      .filter((r) => r.psxg != null)
      .sort((a, b) => a.season.localeCompare(b.season))
      .map((r) => ({
        season: r.season,
        short: seasonShort(r.season),
        ga: r.ga,
        psxg: r.psxg,
        psxgPlusMinus: r.psxgPlusMinus,
      }));
  }, [psxg]);

  const getSortValue = (row: GkSeasonRow, key: SortKey) => {
    switch (key) {
      case 'season':
        return row.season;
      case 'player':
        return row.player;
      case 'mp':
        return row.mp ?? -Infinity;
      case 'ga':
        return row.ga ?? -Infinity;
      case 'sota':
        return row.sota ?? -Infinity;
      case 'saves':
        return row.saves ?? -Infinity;
      case 'savePct':
        return row.savePct ?? -Infinity;
      case 'cs':
        return row.cs ?? -Infinity;
      default:
        return '';
    }
  };

  const sortedRows = useMemo(() => {
    const copy = [...gkRows.rows];
    copy.sort((a, b) => {
      const aVal = getSortValue(a, sort.key);
      const bVal = getSortValue(b, sort.key);
      let cmp = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal));
      }
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [gkRows, sort]);

  const sortedDefRows = useMemo(() => {
    const val = (r: DefRow): number | string | null => {
      if (defSort.key === 'season') return r.season;
      return r[defSort.key];
    };
    const copy = [...defRows];
    copy.sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      const an = av == null ? (defSort.key === 'season' ? '' : -Infinity) : av;
      const bn = bv == null ? (defSort.key === 'season' ? '' : -Infinity) : bv;
      const cmp =
        typeof an === 'number' && typeof bn === 'number'
          ? an - bn
          : String(an).localeCompare(String(bn));
      return defSort.dir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [defRows, defSort]);

  const toggleSort = (key: SortKey) => {
    setSort((prev) => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));
  };

  const toggleDefSort = (key: DefSortKey) => {
    setDefSort((prev) => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));
  };

  const axisTick = { fill: 'var(--text-muted)', fontSize: 11 };
  const gridStroke = 'var(--border)';

  function ChartTooltip({ active, payload, label }: TooltipContentProps) {
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
              if (dataKey === 'savePct' || dataKey === 'csPct') {
                text = pct(value, 2);
              } else if (dataKey === 'psxgPlusMinus') {
                text = signed(value, 2);
              } else if (dataKey?.endsWith('PerMp')) {
                text = fmt(value, 2);
              } else {
                text = fmt(value, 0);
              }
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
      case 'sota':
        return t('keepers.sota');
      case 'saves':
        return t('keepers.saves');
      case 'ga':
        return t('keepers.ga');
      case 'savePct':
        return t('keepers.savePct');
      case 'psxg':
        return t('keepers.psxg');
      case 'psxgPlusMinus':
        return t('keepers.goalsPrevented');
      default:
        return name;
    }
  }

  const kpi = [
    { label: t('defense.kpi.gaPerMp'), value: fmt(latestSeason?.gaPerMp ?? null, 2) },
    { label: t('defense.kpi.shAPerMp'), value: fmt(latestSeason?.shAPerMp ?? null, 2) },
    { label: t('defense.kpi.sotaPerMp'), value: fmt(latestSeason?.sotaPerMp ?? null, 2) },
    {
      label: t('defense.kpi.savePct'),
      value: latestSeason?.savePct != null ? pct(latestSeason.savePct, 2) : '—',
    },
    {
      label: t('defense.kpi.csPct'),
      value: latestSeason?.csPct != null ? pct(latestSeason.csPct, 2) : '—',
    },
    {
      label: t('defense.kpi.goalsPrevented'),
      value: latestPsxg ? signed(latestPsxg.psxgPlusMinus, 2) : '—',
    },
  ];

  const defColumns: { key: DefSortKey; label: string; align: 'left' | 'right' }[] = [
    { key: 'season', label: t('defense.table.season'), align: 'left' },
    { key: 'mp', label: 'MP', align: 'right' },
    { key: 'ga', label: 'GA', align: 'right' },
    { key: 'gaPerMp', label: 'GA/MP', align: 'right' },
    { key: 'xga', label: 'xGA', align: 'right' },
    { key: 'shA', label: 'ShA', align: 'right' },
    { key: 'sota', label: 'SoTA', align: 'right' },
    { key: 'saves', label: 'Saves', align: 'right' },
    { key: 'savePct', label: 'Save%', align: 'right' },
    { key: 'cs', label: 'CS', align: 'right' },
    { key: 'csPct', label: 'CS%', align: 'right' },
  ];

  const columns: { key: SortKey; label: string; align: 'left' | 'right' }[] = [
    { key: 'season', label: t('keepers.table.season'), align: 'left' },
    { key: 'player', label: t('keepers.table.player'), align: 'left' },
    { key: 'mp', label: t('keepers.table.mp'), align: 'right' },
    { key: 'ga', label: t('keepers.table.ga'), align: 'right' },
    { key: 'sota', label: t('keepers.table.sota'), align: 'right' },
    { key: 'saves', label: t('keepers.table.saves'), align: 'right' },
    { key: 'savePct', label: t('keepers.table.savePct'), align: 'right' },
    { key: 'cs', label: t('keepers.table.cs'), align: 'right' },
  ];

  const allCompsNote = gkRows.fallback && (
    <p className="mb-3 text-xs text-muted">{t('defense.allCompsNote')}</p>
  );

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-6 py-8 lg:px-10">
      <section className="flex min-w-0 flex-col gap-4">
        <h2 className="flex items-center gap-3 font-display text-xl font-semibold text-primary">
          {t('defense.title')}
          {lazyLoading && (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-border border-t-brand" aria-label="loading" />
          )}
        </h2>
        <CompetitionTabs group={group} onChange={setGroup} />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
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
        <p className="text-xs text-muted">{t('defense.note')}</p>
      </section>

      <SeasonPace side="defense" />

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title={t('defense.chart.gaXga')}>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={defRows} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="short"
                tick={axisTick}
                axisLine={{ stroke: gridStroke }}
                tickLine={false}
              />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={32} />
              <Tooltip content={ChartTooltip} />
              <Area
                type="monotone"
                dataKey="gaPerMp"
                name="GA/MP"
                stroke="var(--brand)"
                fill="var(--brand)"
                fillOpacity={0.15}
                isAnimationActive={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="xgaPerMp"
                name="xGA/MP"
                stroke="var(--info)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: 'var(--info)' }}
                isAnimationActive={false}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t('keepers.chart.bySeason')}>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={defRows} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="short"
                tick={axisTick}
                axisLine={{ stroke: gridStroke }}
                tickLine={false}
              />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={32} />
              <Tooltip content={ChartTooltip} />
              <Area
                type="monotone"
                dataKey="sota"
                name="sota"
                stroke="#0d9488"
                fill="#0d9488"
                fillOpacity={0.15}
                isAnimationActive={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="saves"
                name="saves"
                stroke="#8b5cf6"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#8b5cf6' }}
                isAnimationActive={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="ga"
                name="ga"
                stroke="var(--danger)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: 'var(--danger)' }}
                isAnimationActive={false}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t('keepers.chart.perGk')} note={allCompsNote}>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={perGk} margin={{ top: 8, right: 16, bottom: 24, left: 0 }}>
              <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="player"
                tick={{ ...axisTick, fontSize: 10 }}
                axisLine={{ stroke: gridStroke }}
                tickLine={false}
                interval={0}
                angle={-30}
                textAnchor="end"
                height={60}
              />
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
              <Bar
                dataKey="sota"
                name="sota"
                fill="#0d9488"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
              <Bar
                dataKey="ga"
                name="ga"
                fill="var(--danger)"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="savePct"
                name="savePct"
                stroke="#8b5cf6"
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t('keepers.chart.goalsPrevented')}>
          <p className="mb-3 text-xs text-muted">{t('keepers.goalsPreventedNote')}</p>
          <p className="mb-3 text-xs text-muted">{t('defense.psxgNote')}</p>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={goalsPrevented} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="short"
                tick={axisTick}
                axisLine={{ stroke: gridStroke }}
                tickLine={false}
              />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={32} />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={axisTick}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <Tooltip content={ChartTooltip} />
              <Bar
                dataKey="ga"
                name="ga"
                fill="var(--danger)"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
              <Bar
                dataKey="psxg"
                name="psxg"
                fill="var(--info)"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="psxgPlusMinus"
                name="psxgPlusMinus"
                stroke="var(--chart-neutral)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: 'var(--chart-neutral)' }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm dark:shadow-none">
        <div className="border-b border-border px-4 py-3">
          <h3 className="font-display text-lg font-semibold text-primary">{t('defense.table.title')}</h3>
        </div>
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead className="sticky top-0 z-10 bg-surface-elevated">
              <tr>
                {defColumns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => toggleDefSort(col.key)}
                    className={`cursor-pointer border-b border-border px-3 py-3 text-xs font-semibold uppercase tracking-wider text-muted transition-colors hover:bg-bg-secondary ${
                      col.align === 'left' ? 'text-left' : 'text-right'
                    }`}
                  >
                    <div
                      className={`flex items-center gap-1 ${
                        col.align === 'right' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <span>{col.label}</span>
                      {defSort.key === col.key ? (
                        defSort.dir === 'asc' ? (
                          <ArrowUp size={14} />
                        ) : (
                          <ArrowDown size={14} />
                        )
                      ) : (
                        <ArrowUpDown size={14} className="opacity-30" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedDefRows.map((r) => (
                <tr
                  key={r.season}
                  className="border-b border-border transition-colors hover:bg-bg-secondary"
                >
                  <td className="px-3 py-3 text-sm font-medium text-primary">{r.season}</td>
                  <td className="px-3 py-3 text-right text-sm text-secondary">{fmt(r.mp, 0)}</td>
                  <td className="px-3 py-3 text-right text-sm text-secondary">{fmt(r.ga, 0)}</td>
                  <td className="px-3 py-3 text-right text-sm text-secondary">{fmt(r.gaPerMp, 2)}</td>
                  <td className="px-3 py-3 text-right text-sm text-secondary">{fmt(r.xga, 2)}</td>
                  <td className="px-3 py-3 text-right text-sm text-secondary">{fmt(r.shA, 0)}</td>
                  <td className="px-3 py-3 text-right text-sm text-secondary">{fmt(r.sota, 0)}</td>
                  <td className="px-3 py-3 text-right text-sm text-secondary">{fmt(r.saves, 0)}</td>
                  <td className="px-3 py-3 text-right text-sm text-secondary">
                    {r.savePct != null ? pct(r.savePct, 2) : '—'}
                  </td>
                  <td className="px-3 py-3 text-right text-sm text-secondary">{fmt(r.cs, 0)}</td>
                  <td className="px-3 py-3 text-right text-sm text-secondary">
                    {r.csPct != null ? pct(r.csPct, 2) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm dark:shadow-none">
        <div className="border-b border-border px-4 py-3">
          <h3 className="font-display text-lg font-semibold text-primary">{t('keepers.table.title')}</h3>
          {allCompsNote}
        </div>
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead className="sticky top-0 z-10 bg-surface-elevated">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className={`cursor-pointer border-b border-border px-3 py-3 text-xs font-semibold uppercase tracking-wider text-muted transition-colors hover:bg-bg-secondary ${
                      col.align === 'left' ? 'text-left' : 'text-right'
                    }`}
                  >
                    <div
                      className={`flex items-center gap-1 ${
                        col.align === 'right' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <span>{col.label}</span>
                      {sort.key === col.key ? (
                        sort.dir === 'asc' ? (
                          <ArrowUp size={14} />
                        ) : (
                          <ArrowDown size={14} />
                        )
                      ) : (
                        <ArrowUpDown size={14} className="opacity-30" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, idx) => (
                <tr
                  key={`${row.season}-${row.player}-${idx}`}
                  className="border-b border-border transition-colors hover:bg-bg-secondary"
                >
                  <td className="px-3 py-3 text-sm text-primary">{row.season}</td>
                  <td className="px-3 py-3 text-sm text-primary">{dash(row.player)}</td>
                  <td className="px-3 py-3 text-right text-sm text-secondary">{fmt(row.mp, 0)}</td>
                  <td className="px-3 py-3 text-right text-sm text-secondary">{fmt(row.ga, 0)}</td>
                  <td className="px-3 py-3 text-right text-sm text-secondary">{fmt(row.sota, 0)}</td>
                  <td className="px-3 py-3 text-right text-sm text-secondary">{fmt(row.saves, 0)}</td>
                  <td className="px-3 py-3 text-right text-sm text-secondary">
                    {row.savePct != null ? pct(row.savePct / 100, 2) : '—'}
                  </td>
                  <td className="px-3 py-3 text-right text-sm text-secondary">{fmt(row.cs, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <MatchlogPanel
        type="keeper"
        titleKey="matchLog.tabs.keeper"
        group={group}
      />
    </main>
  );
}

function ChartCard({
  title,
  note,
  children,
}: {
  title: string;
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none">
      <h3 className="mb-3 font-display text-lg font-semibold text-primary">{title}</h3>
      {note}
      {children}
    </div>
  );
}
