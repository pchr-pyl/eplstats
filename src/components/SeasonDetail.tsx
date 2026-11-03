'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  TooltipContentProps,
  ReferenceLine,
  LabelList,
  Legend,
} from 'recharts';
import { useI18n } from '@/i18n/I18nContext';
import type { CompGroup, MatchRow, SeasonMatchlogs } from '@/lib/types';
import { compInGroup, canonicalComp } from '@/lib/stats';
import { fmt, dash } from '@/lib/format';
import { useClub, useClubData } from '@/components/ClubProvider';
import { loadMatchlogs, LOAD_FAILED, COMP_SHORT, formatDate } from '@/components/matchlog-shared';
import { CompetitionTabs } from '@/components/CompetitionTabs';
import { LabelsBtn } from '@/components/LabelsBtn';
import { ShareBtn } from '@/components/ShareBtn';
import { extrasFrom } from '@/lib/pace';

type SortKey =
  | 'k'
  | 'date'
  | 'comp'
  | 'ha'
  | 'opponent'
  | 'result'
  | 'xg'
  | 'xga'
  | 'sh'
  | 'shA'
  | 'sot'
  | 'sotA'
  | 'poss';

type SortDir = 'asc' | 'desc';

interface Row {
  k: number;
  date: string;
  dateIso: string;
  comp: string;
  venue: string;
  venueShort: string;
  opponent: string | null;
  score: string;
  result: string;
  gf: number;
  ga: number;
  xg: number | null;
  xga: number | null;
  sh: number | null;
  sot: number | null;
  shA: number | null;
  sotA: number | null;
  saves: number | null;
  poss: number | null;
  cumGd: number;
  cumXgd: number | null;
  cumGf: number;
  cumGa: number;
}

const resultClass: Record<string, string> = {
  W: 'text-success',
  D: 'text-muted',
  L: 'text-danger',
};

function compShort(comp: string): string {
  return COMP_SHORT[canonicalComp(comp)] ?? canonicalComp(comp);
}

function venueShort(m: MatchRow): string {
  if (m.venue === 'Home') return 'H';
  if (m.venue === 'Away') return 'A';
  if (m.venue === 'Neutral') return 'N';
  return '—';
}

function valueFmt(dataKey: string, v: number | null): string {
  if (v == null || Number.isNaN(v)) return '—';
  if (dataKey === 'poss') return `${fmt(v, 2)}%`;
  if (dataKey === 'xg' || dataKey === 'xga' || dataKey === 'cumXgd') return fmt(v, 2);
  return fmt(v, 0);
}

function labelFmt(dataKey: string, v: unknown): string {
  return valueFmt(dataKey, v == null ? null : Number(v));
}

function sortValue(r: Row, key: SortKey): number | string | null {
  switch (key) {
    case 'k':
      return r.k;
    case 'date':
      return r.dateIso;
    case 'comp':
      return r.comp;
    case 'ha':
      return r.venueShort;
    case 'opponent':
      return r.opponent ?? '';
    case 'result':
      return r.result === 'W' ? 3 : r.result === 'D' ? 1 : 0;
    case 'xg':
      return r.xg;
    case 'xga':
      return r.xga;
    case 'sh':
      return r.sh;
    case 'shA':
      return r.shA;
    case 'sot':
      return r.sot;
    case 'sotA':
      return r.sotA;
    case 'poss':
      return r.poss;
    default:
      return null;
  }
}

function isNumSort(key: SortKey): boolean {
  return (
    key === 'k' ||
    key === 'result' ||
    key === 'xg' ||
    key === 'xga' ||
    key === 'sh' ||
    key === 'shA' ||
    key === 'sot' ||
    key === 'sotA' ||
    key === 'poss'
  );
}

export function SeasonDetail() {
  const { t } = useI18n();
  const { club } = useClub();
  const { matches } = useClubData();

  const seasons = useMemo(
    () => [...new Set(matches.map((m) => m.season))].sort().reverse(),
    [matches],
  );

  const [selectedSeason, setSelectedSeason] = useState<string>(() => seasons[0] ?? '');
  const season = useMemo(
    () =>
      selectedSeason && seasons.includes(selectedSeason)
        ? selectedSeason
        : seasons[0] ?? '',
    [selectedSeason, seasons],
  );
  const handleSeasonChange = (s: string) => {
    setSelectedSeason(s);
    setLogs(undefined);
  };

  const [group, setGroup] = useState<CompGroup>('all');
  const [logs, setLogs] = useState<SeasonMatchlogs | typeof LOAD_FAILED | undefined>(undefined);

  useEffect(() => {
    if (!season) return;
    let live = true;
    loadMatchlogs(club.slug, season).then((r) => {
      if (!live) return;
      setLogs(r === LOAD_FAILED ? LOAD_FAILED : r);
    });
    return () => {
      live = false;
    };
  }, [club.slug, season]);

  const extras = useMemo(() => (logs && logs !== LOAD_FAILED ? extrasFrom(logs, group) : null), [logs, group]);

  const played = useMemo(
    () =>
      matches
        .filter(
          (m) =>
            m.season === season &&
            compInGroup(m.competition, group) &&
            (m.result === 'W' || m.result === 'D' || m.result === 'L') &&
            m.gf != null &&
            m.ga != null,
        )
        .sort(
          (a, b) =>
            a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''),
        ),
    [matches, season, group],
  );

  const rows = useMemo<Row[]>(() => {
    return played.reduce<Row[]>((acc, m) => {
      const prev = acc[acc.length - 1];
      const gd = (prev?.cumGd ?? 0) + (m.gf ?? 0) - (m.ga ?? 0);
      const lastXgd = acc.findLast((r) => r.cumXgd != null)?.cumXgd ?? 0;
      const cumXgd = m.xg != null && m.xga != null ? lastXgd + m.xg - m.xga : null;
      const e = extras?.get(m.date);
      acc.push({
        k: acc.length + 1,
        date: formatDate(m.date),
        dateIso: m.date,
        comp: compShort(m.competition),
        venue: m.venue ?? '',
        venueShort: venueShort(m),
        opponent: m.opponent,
        score: `${m.gf ?? 0}–${m.ga ?? 0}`,
        result: m.result ?? '',
        gf: m.gf ?? 0,
        ga: m.ga ?? 0,
        xg: m.xg,
        xga: m.xga,
        sh: e?.sh ?? null,
        sot: e?.sot ?? null,
        shA: e?.shA ?? null,
        sotA: e?.sotA ?? null,
        saves: e?.saves ?? null,
        poss: m.possession,
        cumGd: gd,
        cumXgd,
        cumGf: (prev?.cumGf ?? 0) + (m.gf ?? 0),
        cumGa: (prev?.cumGa ?? 0) + (m.ga ?? 0),
      });
      return acc;
    }, []);
  }, [played, extras]);

  const kpi = useMemo(() => {
    const mp = rows.length;
    const stats = rows.reduce(
      (acc, r) => {
        if (r.result === 'W') acc.w += 1;
        else if (r.result === 'D') acc.d += 1;
        else if (r.result === 'L') acc.l += 1;
        acc.gf += r.gf;
        acc.ga += r.ga;
        if (r.ga === 0) acc.cs += 1;
        if (r.xg != null) {
          acc.xgSum += r.xg;
          acc.xgN += 1;
        }
        if (r.xga != null) {
          acc.xgaSum += r.xga;
          acc.xgaN += 1;
        }
        if (r.sh != null) {
          acc.shSum += r.sh;
          acc.shN += 1;
        }
        if (r.shA != null) {
          acc.shASum += r.shA;
          acc.shAN += 1;
        }
        if (r.poss != null) {
          acc.possSum += r.poss;
          acc.possN += 1;
        }
        return acc;
      },
      {
        w: 0,
        d: 0,
        l: 0,
        gf: 0,
        ga: 0,
        cs: 0,
        xgSum: 0,
        xgN: 0,
        xgaSum: 0,
        xgaN: 0,
        shSum: 0,
        shN: 0,
        shASum: 0,
        shAN: 0,
        possSum: 0,
        possN: 0,
      },
    );

    const shPerMp = stats.shN > 0 ? stats.shSum / stats.shN : null;
    const shAPerMp = stats.shAN > 0 ? stats.shASum / stats.shAN : null;
    const possAvg = stats.possN > 0 ? stats.possSum / stats.possN : null;

    return [
      { label: t('seasonDetail.kpi.mp'), value: mp > 0 ? fmt(mp, 0) : '—' },
      { label: t('seasonDetail.kpi.record'), value: mp > 0 ? `${stats.w}-${stats.d}-${stats.l}` : '—' },
      { label: t('seasonDetail.kpi.gf'), value: mp > 0 ? fmt(stats.gf, 0) : '—' },
      { label: t('seasonDetail.kpi.ga'), value: mp > 0 ? fmt(stats.ga, 0) : '—' },
      {
        label: t('seasonDetail.kpi.xg'),
        value:
          stats.xgN > 0 ? (
            <>
              <span>{fmt(stats.xgSum, 2)}</span>
              {stats.xgN < mp && (
                <span className="ml-1 text-xs font-normal text-muted">
                  ({stats.xgN}/{mp})
                </span>
              )}
            </>
          ) : (
            '—'
          ),
      },
      {
        label: t('seasonDetail.kpi.xga'),
        value:
          stats.xgaN > 0 ? (
            <>
              <span>{fmt(stats.xgaSum, 2)}</span>
              {stats.xgaN < mp && (
                <span className="ml-1 text-xs font-normal text-muted">
                  ({stats.xgaN}/{mp})
                </span>
              )}
            </>
          ) : (
            '—'
          ),
      },
      { label: t('seasonDetail.kpi.shPerMp'), value: stats.shN > 0 ? fmt(shPerMp, 2) : '—' },
      { label: t('seasonDetail.kpi.shAPerMp'), value: stats.shAN > 0 ? fmt(shAPerMp, 2) : '—' },
      { label: t('seasonDetail.kpi.cs'), value: mp > 0 ? fmt(stats.cs, 0) : '—' },
      {
        label: t('seasonDetail.kpi.poss'),
        value: stats.possN > 0 ? `${fmt(possAvg, 2)}%` : '—',
      },
    ];
  }, [rows, t]);

  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'k', dir: 'asc' });
  const [goalsCum, setGoalsCum] = useState(false);
  const [lbl, setLbl] = useState<Record<string, boolean>>({});
  const lblOn = (k: string) => !!lbl[k];
  const toggleLbl = (k: string) => setLbl((p) => ({ ...p, [k]: !p[k] }));

  const axisTick = { fill: 'var(--text-muted)', fontSize: 11 };
  const gridStroke = 'var(--border)';

  function ChartTooltip({ active, payload }: TooltipContentProps) {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload as Row;
    const venue =
      p.venue === 'Home'
        ? t('pace.home')
        : p.venue === 'Away'
          ? t('pace.away')
          : '—';
    const header = `#${p.k} · ${p.date} · ${venue} ${dash(p.opponent)} · ${p.comp} · ${p.score} (${p.result})`;
    return (
      <div className="rounded-lg border border-border bg-surface-elevated p-3 shadow-sm">
        <p className="mb-1 text-xs font-semibold text-primary">{header}</p>
        <div className="flex flex-col gap-1">
          {payload.map((entry, idx) => {
            const v = entry.value as number | null;
            const text = valueFmt(String(entry.dataKey ?? ''), v);
            const color = entry.color ?? 'var(--text-muted)';
            return (
              <div key={idx} className="flex items-center gap-2 text-xs text-secondary">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="font-medium" style={{ color }}>
                  {entry.name}:
                </span>
                <span className="font-semibold text-primary">{text}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);
      const an = av == null ? (isNumSort(sort.key) ? -Infinity : '') : av;
      const bn = bv == null ? (isNumSort(sort.key) ? -Infinity : '') : bv;
      const cmp =
        typeof an === 'number' && typeof bn === 'number'
          ? an - bn
          : String(an).localeCompare(String(bn));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [rows, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((prev) => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));

  const columns: { key: SortKey; label: string; align: 'left' | 'right' }[] = [
    { key: 'k', label: '#', align: 'right' },
    { key: 'date', label: 'Date', align: 'left' },
    { key: 'comp', label: 'Comp', align: 'left' },
    { key: 'ha', label: 'H/A', align: 'left' },
    { key: 'opponent', label: 'Opponent', align: 'left' },
    { key: 'result', label: 'Result', align: 'left' },
    { key: 'xg', label: 'xG', align: 'right' },
    { key: 'xga', label: 'xGA', align: 'right' },
    { key: 'sh', label: 'Sh', align: 'right' },
    { key: 'shA', label: 'ShA', align: 'right' },
    { key: 'sot', label: 'SoT', align: 'right' },
    { key: 'sotA', label: 'SoTA', align: 'right' },
    { key: 'poss', label: 'Poss', align: 'right' },
  ];

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-6 py-8 lg:px-10">
      <section className="flex min-w-0 flex-col gap-4">
        <h2 className="flex items-center gap-3 font-display text-xl font-semibold text-primary">
          {t('seasonDetail.title')}
          {logs === undefined && season !== '' && (
            <span
              className="h-3 w-3 animate-spin rounded-full border-2 border-border border-t-brand"
              aria-label="loading"
            />
          )}
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted">
            {t('seasonDetail.season')}
            <select
              value={season}
              onChange={(e) => handleSeasonChange(e.target.value)}
              className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-primary focus-visible:outline-2 focus-visible:outline-brand"
            >
              {seasons.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <CompetitionTabs group={group} onChange={setGroup} />
        </div>
      </section>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">{t('seasonDetail.empty')}</p>
      ) : (
        <>
          <section className="flex min-w-0 flex-col gap-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-8">
              {kpi.map((k) => (
                <div
                  key={k.label}
                  className="flex flex-col rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none"
                >
                  <span className="text-xs font-medium text-muted">{k.label}</span>
                  <span className="mt-2 font-body text-2xl font-bold text-primary">
                    {k.value}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartCard
              className="lg:col-span-2"
              title={t('seasonDetail.chart.shots')}
              action={<LabelsBtn on={lblOn('shots')} onClick={() => toggleLbl('shots')} />}
            >
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="k" tick={axisTick} axisLine={{ stroke: gridStroke }} tickLine={false} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} width={32} />
                  <Tooltip content={ChartTooltip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="sh"
                    name="Sh"
                    stroke="var(--brand)"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: 'var(--brand)' }}
                    isAnimationActive={false}
                    connectNulls={false}
                  >
                    {lblOn('shots') && (
                      <LabelList dataKey="sh" position="top" fontSize={10} fill="var(--text-muted)" formatter={(v) => labelFmt('sh', v)} />
                    )}
                  </Line>
                  <Line
                    type="monotone"
                    dataKey="shA"
                    name="ShA"
                    stroke="var(--chart-neutral)"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: 'var(--chart-neutral)' }}
                    isAnimationActive={false}
                    connectNulls={false}
                  >
                    {lblOn('shots') && (
                      <LabelList dataKey="shA" position="top" fontSize={10} fill="var(--text-muted)" formatter={(v) => labelFmt('shA', v)} />
                    )}
                  </Line>
                  <Line
                    type="monotone"
                    dataKey="sot"
                    name="SoT"
                    stroke="var(--brand)"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                    isAnimationActive={false}
                    connectNulls={false}
                  >
                    {lblOn('shots') && (
                      <LabelList dataKey="sot" position="bottom" fontSize={10} fill="var(--text-muted)" formatter={(v) => labelFmt('sot', v)} />
                    )}
                  </Line>
                  <Line
                    type="monotone"
                    dataKey="sotA"
                    name="SoTA"
                    stroke="var(--chart-neutral)"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                    isAnimationActive={false}
                    connectNulls={false}
                  >
                    {lblOn('shots') && (
                      <LabelList dataKey="sotA" position="bottom" fontSize={10} fill="var(--text-muted)" formatter={(v) => labelFmt('sotA', v)} />
                    )}
                  </Line>
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              className="lg:col-span-2"
              title={t('seasonDetail.chart.gfGa')}
              action={
                <div className="flex items-center gap-1.5">
                  <LabelsBtn on={lblOn('gfga')} onClick={() => toggleLbl('gfga')} />
                  <div className="flex rounded-lg border border-border bg-surface-elevated p-0.5 text-xs font-medium">
                    {([false, true] as const).map((cum) => (
                      <button
                        key={String(cum)}
                        type="button"
                        aria-pressed={goalsCum === cum}
                        onClick={() => setGoalsCum(cum)}
                        className={`rounded-md px-3 py-1 transition ${
                          goalsCum === cum ? 'bg-brand text-surface' : 'text-muted hover:text-primary'
                        }`}
                      >
                        {t(cum ? 'seasonDetail.cumulative' : 'seasonDetail.perMatch')}
                      </button>
                    ))}
                  </div>
                </div>
              }
            >
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="k" tick={axisTick} axisLine={{ stroke: gridStroke }} tickLine={false} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
                  <Tooltip content={ChartTooltip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type={goalsCum ? 'monotone' : 'linear'}
                    dataKey={goalsCum ? 'cumGf' : 'gf'}
                    name="GF"
                    stroke="var(--brand)"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: 'var(--brand)' }}
                    isAnimationActive={false}
                  >
                    {lblOn('gfga') && (
                      <LabelList dataKey={goalsCum ? 'cumGf' : 'gf'} position="top" fontSize={10} fill="var(--text-muted)" formatter={(v) => labelFmt('gf', v)} />
                    )}
                  </Line>
                  <Line
                    type={goalsCum ? 'monotone' : 'linear'}
                    dataKey={goalsCum ? 'cumGa' : 'ga'}
                    name="GA"
                    stroke="var(--chart-neutral)"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: 'var(--chart-neutral)' }}
                    isAnimationActive={false}
                  >
                    {lblOn('gfga') && (
                      <LabelList dataKey={goalsCum ? 'cumGa' : 'ga'} position="bottom" fontSize={10} fill="var(--text-muted)" formatter={(v) => labelFmt('ga', v)} />
                    )}
                  </Line>
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title={t('seasonDetail.chart.goals')}
              action={<LabelsBtn on={lblOn('goals')} onClick={() => toggleLbl('goals')} />}
            >
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="k" tick={axisTick} axisLine={{ stroke: gridStroke }} tickLine={false} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} width={32} />
                  <Tooltip content={ChartTooltip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="gf"
                    name="GF"
                    stroke="var(--brand)"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: 'var(--brand)' }}
                    isAnimationActive={false}
                    connectNulls={false}
                  >
                    {lblOn('goals') && (
                      <LabelList dataKey="gf" position="top" fontSize={10} fill="var(--text-muted)" formatter={(v) => labelFmt('gf', v)} />
                    )}
                  </Line>
                  <Line
                    type="monotone"
                    dataKey="ga"
                    name="GA"
                    stroke="var(--chart-neutral)"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: 'var(--chart-neutral)' }}
                    isAnimationActive={false}
                    connectNulls={false}
                  >
                    {lblOn('goals') && (
                      <LabelList dataKey="ga" position="top" fontSize={10} fill="var(--text-muted)" formatter={(v) => labelFmt('ga', v)} />
                    )}
                  </Line>
                  <Line
                    type="monotone"
                    dataKey="xg"
                    name="xG"
                    stroke="var(--info)"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                    isAnimationActive={false}
                    connectNulls={false}
                  >
                    {lblOn('goals') && (
                      <LabelList dataKey="xg" position="bottom" fontSize={10} fill="var(--text-muted)" formatter={(v) => labelFmt('xg', v)} />
                    )}
                  </Line>
                  <Line
                    type="monotone"
                    dataKey="xga"
                    name="xGA"
                    stroke="var(--warning)"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                    isAnimationActive={false}
                    connectNulls={false}
                  >
                    {lblOn('goals') && (
                      <LabelList dataKey="xga" position="bottom" fontSize={10} fill="var(--text-muted)" formatter={(v) => labelFmt('xga', v)} />
                    )}
                  </Line>
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title={t('seasonDetail.chart.cumGd')}
              action={<LabelsBtn on={lblOn('cumgd')} onClick={() => toggleLbl('cumgd')} />}
            >
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="k" tick={axisTick} axisLine={{ stroke: gridStroke }} tickLine={false} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} width={36} />
                  <Tooltip content={ChartTooltip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine y={0} stroke="var(--text-muted)" strokeDasharray="3 3" />
                  <Line
                    type="monotone"
                    dataKey="cumGd"
                    name="GD"
                    stroke="var(--brand)"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: 'var(--brand)' }}
                    isAnimationActive={false}
                    connectNulls={false}
                  >
                    {lblOn('cumgd') && (
                      <LabelList dataKey="cumGd" position="top" fontSize={10} fill="var(--text-muted)" formatter={(v) => labelFmt('cumGd', v)} />
                    )}
                  </Line>
                  <Line
                    type="monotone"
                    dataKey="cumXgd"
                    name="xGD"
                    stroke="var(--info)"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                    isAnimationActive={false}
                    connectNulls
                  >
                    {lblOn('cumgd') && (
                      <LabelList dataKey="cumXgd" position="bottom" fontSize={10} fill="var(--text-muted)" formatter={(v) => labelFmt('cumXgd', v)} />
                    )}
                  </Line>
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title={t('seasonDetail.chart.keeper')}
              action={<LabelsBtn on={lblOn('keeper')} onClick={() => toggleLbl('keeper')} />}
            >
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="k" tick={axisTick} axisLine={{ stroke: gridStroke }} tickLine={false} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} width={32} />
                  <Tooltip content={ChartTooltip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="sotA"
                    name="SoTA"
                    stroke="var(--danger)"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: 'var(--danger)' }}
                    isAnimationActive={false}
                    connectNulls={false}
                  >
                    {lblOn('keeper') && (
                      <LabelList dataKey="sotA" position="top" fontSize={10} fill="var(--text-muted)" formatter={(v) => labelFmt('sotA', v)} />
                    )}
                  </Line>
                  <Line
                    type="monotone"
                    dataKey="saves"
                    name="Saves"
                    stroke="#8b5cf6"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#8b5cf6' }}
                    isAnimationActive={false}
                    connectNulls={false}
                  >
                    {lblOn('keeper') && (
                      <LabelList dataKey="saves" position="bottom" fontSize={10} fill="var(--text-muted)" formatter={(v) => labelFmt('saves', v)} />
                    )}
                  </Line>
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title={t('seasonDetail.chart.possession')}
              action={<LabelsBtn on={lblOn('possession')} onClick={() => toggleLbl('possession')} />}
            >
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="k" tick={axisTick} axisLine={{ stroke: gridStroke }} tickLine={false} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} width={36} domain={[0, 100]} />
                  <Tooltip content={ChartTooltip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine y={50} stroke="var(--text-muted)" strokeDasharray="3 3" />
                  <Line
                    type="monotone"
                    dataKey="poss"
                    name="Poss%"
                    stroke="var(--brand)"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: 'var(--brand)' }}
                    isAnimationActive={false}
                    connectNulls={false}
                  >
                    {lblOn('possession') && (
                      <LabelList dataKey="poss" position="top" fontSize={10} fill="var(--text-muted)" formatter={(v) => labelFmt('poss', v)} />
                    )}
                  </Line>
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>
          </section>

          <p className="text-xs text-muted">{t('seasonDetail.note')}</p>

          <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm dark:shadow-none">
            <div className="border-b border-border px-4 py-3">
              <h3 className="font-display text-lg font-semibold text-primary">
                {t('seasonDetail.title')}
              </h3>
            </div>
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full min-w-[1100px] border-collapse">
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
                  {sortedRows.map((r) => (
                    <tr
                      key={r.k}
                      className="border-b border-border transition-colors hover:bg-bg-secondary"
                    >
                      <td className="px-3 py-3 text-right text-sm text-secondary">{fmt(r.k, 0)}</td>
                      <td className="px-3 py-3 text-sm text-primary">{r.date}</td>
                      <td className="px-3 py-3 text-sm text-secondary">
                        <span className="rounded bg-bg-secondary px-1 py-0.5 text-[10px] font-semibold text-muted">
                          {r.comp}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm text-secondary">{r.venueShort}</td>
                      <td className="px-3 py-3 text-sm font-medium text-primary">
                        {dash(r.opponent)}
                      </td>
                      <td className="px-3 py-3 text-sm">
                        <span className="font-display text-sm font-semibold tabular-nums text-primary">
                          {r.score}
                        </span>{' '}
                        <span className={`text-xs font-bold ${resultClass[r.result] ?? 'text-muted'}`}>
                          {r.result}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right text-sm text-secondary">{fmt(r.xg, 2)}</td>
                      <td className="px-3 py-3 text-right text-sm text-secondary">{fmt(r.xga, 2)}</td>
                      <td className="px-3 py-3 text-right text-sm text-secondary">{fmt(r.sh, 0)}</td>
                      <td className="px-3 py-3 text-right text-sm text-secondary">{fmt(r.shA, 0)}</td>
                      <td className="px-3 py-3 text-right text-sm text-secondary">{fmt(r.sot, 0)}</td>
                      <td className="px-3 py-3 text-right text-sm text-secondary">{fmt(r.sotA, 0)}</td>
                      <td className="px-3 py-3 text-right text-sm text-secondary">
                        {r.poss != null ? `${fmt(r.poss, 2)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function ChartCard({
  title,
  className,
  action,
  children,
}: {
  title: string;
  className?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className={`min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none ${
        className ?? ''
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-display text-lg font-semibold text-primary">{title}</h3>
        <div className="flex items-center gap-1.5">
          {action}
          <ShareBtn />
        </div>
      </div>
      {children}
    </div>
  );
}
