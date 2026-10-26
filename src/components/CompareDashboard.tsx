'use client';

import { useEffect, useMemo, useState } from 'react';
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
import type { MatchRow, MatchlogTable, SeasonMatchlogs } from '@/lib/types';
import { useClub, useClubData } from './ClubProvider';
import { fmt, pct, signed } from '@/lib/format';
import { loadMatchlogs, LOAD_FAILED } from './matchlog-shared';

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
  gf: number | null;
  ga: number | null;
  gd: number | null;
}

interface SeasonData {
  rows: MatchRow[];
  cum: number[];
}

interface LogStats {
  sh: number | null;
  sot: number | null;
  sota: number | null;
  saves: number | null;
  loading: boolean;
}

function sumMatchlogColumn(
  table: MatchlogTable | undefined,
  dates: Set<string>,
  colName: string,
): number | null {
  if (!table) return null;
  const compIdx = table.columns.indexOf('Comp');
  const dateIdx = table.columns.indexOf('Date');
  const colIdx = table.columns.indexOf(colName);
  if (compIdx < 0 || dateIdx < 0 || colIdx < 0) return null;
  let sum = 0;
  let count = 0;
  for (const r of table.rows) {
    if (r[compIdx] !== 'Premier League') continue;
    if (!dates.has(r[dateIdx])) continue;
    const v = r[colIdx] ?? '';
    if (v === '') continue;
    const n = parseFloat(v);
    if (Number.isNaN(n)) continue;
    sum += n;
    count += 1;
  }
  return count > 0 ? sum : null;
}

const LINE_COLORS = [
  'var(--brand)',
  'var(--info)',
  'var(--success)',
  'var(--warning)',
  'var(--danger)',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
  '#f97316',
  '#6366f1',
  '#14b8a6',
  '#eab308',
];

export function CompareDashboard() {
  const { t } = useI18n();
  const { club } = useClub();
  const { matches } = useClubData();
  const seasons = useMemo(() => {
    const set = new Set(
      matches
        .filter((m) => m.competition === 'Premier League' && m.result)
        .map((m) => m.season),
    );
    return Array.from(set).sort();
  }, [matches]);

  const [selected, setSelected] = useState<string[]>(() => {
    const a = seasons[seasons.length - 2] ?? '';
    const b = seasons[seasons.length - 1] ?? '';
    return [...new Set([a, b].filter(Boolean))];
  });

  // missing key = still loading; loadMatchlogs caches per club|season
  const [matchlogs, setMatchlogs] = useState<
    Record<string, SeasonMatchlogs | 'loading' | 'failed'>
  >({});

  useEffect(() => {
    let live = true;
    for (const season of selected) {
      loadMatchlogs(club.slug, season).then((r) => {
        if (!live) return;
        const next = r === LOAD_FAILED ? 'failed' : r;
        setMatchlogs((prev) => (prev[season] === next ? prev : { ...prev, [season]: next }));
      });
    }
    return () => {
      live = false;
    };
  }, [selected, club.slug]);

  const getColor = (season: string) => {
    const idx = seasons.indexOf(season);
    return LINE_COLORS[idx >= 0 ? idx % LINE_COLORS.length : 0];
  };

  const seasonData = useMemo<Record<string, SeasonData>>(() => {
    const map: Record<string, SeasonData> = {};
    for (const season of selected) {
      const rows = matches
        .filter(
          (m) =>
            m.season === season &&
            m.competition === 'Premier League' &&
            (m.result === 'W' || m.result === 'D' || m.result === 'L'),
        )
        .sort((a, b) => a.date.localeCompare(b.date));
      map[season] = { rows, cum: cumPoints(rows) };
    }
    return map;
  }, [matches, selected]);

  const { maxCumLen, matchweek } = useMemo(() => {
    if (!selected.length) return { maxCumLen: 0, matchweek: 0 };
    const lens = selected.map((s) => seasonData[s]?.rows.length ?? 0);
    const cums = selected.map((s) => seasonData[s]?.cum.length ?? 0);
    return {
      maxCumLen: Math.max(...cums),
      matchweek: Math.min(...lens),
    };
  }, [selected, seasonData]);

  const chartData = useMemo(() => {
    return Array.from({ length: maxCumLen }, (_, i) => {
      const entry: Record<string, number | null> & { match: number } = {
        match: i + 1,
      };
      for (const season of selected) {
        entry[season] = seasonData[season]?.cum[i] ?? null;
      }
      return entry;
    });
  }, [maxCumLen, selected, seasonData]);

  const stats = useMemo<Record<string, SeasonStats>>(() => {
    const map: Record<string, SeasonStats> = {};
    for (const season of selected) {
      const rows = seasonData[season]?.rows ?? [];
      const cum = seasonData[season]?.cum ?? [];
      const slice = rows.slice(0, matchweek);
      const w = slice.filter((m) => m.result === 'W').length;
      const d = slice.filter((m) => m.result === 'D').length;
      const l = slice.filter((m) => m.result === 'L').length;
      const total = slice.length;
      let gf = 0;
      let ga = 0;
      let gfCount = 0;
      let gaCount = 0;
      for (const m of slice) {
        if (m.gf != null) {
          gf += m.gf;
          gfCount += 1;
        }
        if (m.ga != null) {
          ga += m.ga;
          gaCount += 1;
        }
      }
      map[season] = {
        w,
        d,
        l,
        winRate: total > 0 ? w / total : null,
        drawRate: total > 0 ? d / total : null,
        lossRate: total > 0 ? l / total : null,
        points: total > 0 ? (cum[matchweek - 1] ?? null) : null,
        gf: gfCount > 0 ? gf : null,
        ga: gaCount > 0 ? ga : null,
        gd: gfCount > 0 && gaCount > 0 ? gf - ga : null,
      };
    }
    return map;
  }, [selected, seasonData, matchweek]);

  const logStats = useMemo<Record<string, LogStats>>(() => {
    const map: Record<string, LogStats> = {};
    for (const season of selected) {
      const ml = matchlogs[season];
      const loading = ml == null || ml === 'loading';
      if (loading || ml === 'failed' || typeof ml !== 'object') {
        map[season] = {
          sh: null,
          sot: null,
          sota: null,
          saves: null,
          loading,
        };
        continue;
      }
      const dates = new Set(
        seasonData[season]?.rows.slice(0, matchweek).map((m) => m.date) ?? [],
      );
      map[season] = {
        sh: sumMatchlogColumn(ml.shooting?.for, dates, 'Sh'),
        sot: sumMatchlogColumn(ml.shooting?.for, dates, 'SoT'),
        sota: sumMatchlogColumn(ml.keeper?.for, dates, 'SoTA'),
        saves: sumMatchlogColumn(ml.keeper?.for, dates, 'Saves'),
        loading: false,
      };
    }
    return map;
  }, [selected, matchweek, matchlogs, seasonData]);

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

  function Tile({ label, value }: { label: string; value: string }) {
    return (
      <div className="flex flex-col rounded-xl border border-border bg-bg-secondary p-3">
        <span className="text-xs font-medium text-muted">{label}</span>
        <span className="mt-1 font-body text-2xl font-bold text-primary">{value}</span>
      </div>
    );
  }

  function toggleSeason(season: string) {
    setSelected((prev) => {
      const set = new Set(prev);
      if (set.has(season)) {
        if (set.size === 1) return prev;
        set.delete(season);
      } else {
        set.add(season);
      }
      return seasons.filter((s) => set.has(s));
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-6 py-8 lg:px-10">
      <section className="flex min-w-0 flex-col gap-4">
        <h2 className="font-display text-xl font-semibold text-primary">{t('compare.title')}</h2>
        <div className="flex flex-col gap-2">
          <span className="text-sm text-secondary">{t('compare.seasons')}</span>
          <div className="flex flex-wrap gap-2">
            {seasons.map((season) => {
              const isSelected = selected.includes(season);
              const color = getColor(season);
              return (
                <button
                  key={season}
                  type="button"
                  onClick={() => toggleSeason(season)}
                  aria-pressed={isSelected}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    isSelected ? 'text-primary' : 'text-muted'
                  }`}
                  style={{ borderColor: isSelected ? color : 'var(--border)' }}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isSelected ? '' : 'border-2 bg-transparent'
                    }`}
                    style={
                      isSelected
                        ? { backgroundColor: color }
                        : { borderColor: color, opacity: 0.4 }
                    }
                  />
                  {season}
                </button>
              );
            })}
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
            {selected.map((season) => {
              const color = getColor(season);
              return (
                <Line
                  key={season}
                  type="monotone"
                  dataKey={season}
                  name={season}
                  stroke={color}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: color }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {selected.map((season) => {
          const s = stats[season];
          const ls = logStats[season];
          const color = getColor(season);
          if (!s) return null;
          const logShow = (v: number | null): string =>
            ls.loading ? '…' : fmt(v, 0);
          return (
            <div
              key={season}
              className="min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none"
            >
              <h4 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-primary">
                {t('compare.statTitle').replace('{matchweek}', String(matchweek))} ·
                <span className="inline-flex items-center gap-1.5" style={{ color }}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                  {season}
                </span>
              </h4>
              <div className="flex flex-col gap-4">
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
                    {t('compare.groupResults')}
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Tile label={t('compare.w')} value={fmt(s.w, 0)} />
                    <Tile label={t('compare.d')} value={fmt(s.d, 0)} />
                    <Tile label={t('compare.l')} value={fmt(s.l, 0)} />
                    <Tile label={t('compare.winRate')} value={pct(s.winRate, 2)} />
                    <Tile label={t('compare.drawRate')} value={pct(s.drawRate, 2)} />
                    <Tile label={t('compare.lossRate')} value={pct(s.lossRate, 2)} />
                    <Tile label={t('compare.points')} value={fmt(s.points, 0)} />
                    <Tile label={t('compare.gd')} value={signed(s.gd, 0)} />
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
                    {t('compare.groupAttack')}
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <Tile label={t('compare.gf')} value={fmt(s.gf, 0)} />
                    <Tile label={t('compare.sh')} value={logShow(ls.sh)} />
                    <Tile label={t('compare.sot')} value={logShow(ls.sot)} />
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
                    {t('compare.groupDefence')}
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <Tile label={t('compare.ga')} value={fmt(s.ga, 0)} />
                    <Tile label={t('compare.sota')} value={logShow(ls.sota)} />
                    <Tile label={t('compare.saves')} value={logShow(ls.saves)} />
                  </div>
                </div>
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
