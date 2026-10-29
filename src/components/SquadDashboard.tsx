'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  TooltipContentProps,
  AreaChart,
  Area,
  LabelList,
} from 'recharts';
import { LabelsBtn } from './LabelsBtn';
import { ShareBtn } from './ShareBtn';
import { useI18n } from '@/i18n/I18nContext';
import type { SquadData, SquadSeason, SquadPlayer, PlayersData, PlayerSeasonStats, CompGroup } from '@/lib/types';
import { mergedPlayersForGroup, seasonShort } from '@/lib/stats';
import { fmt, gbp, dash } from '@/lib/format';
import { useClub } from './ClubProvider';
import { loadSquadSeason, LoadFail, LOAD_FAILED } from './matchlog-shared';
import { CompetitionTabs } from './CompetitionTabs';

type SortKey = 'name' | 'pos' | 'age' | 'weeklyGross' | 'yearlyGross' | 'expires' | 'status';
type SortDir = 'asc' | 'desc';

type PerfSortKey =
  | 'player'
  | 'pos'
  | 'age'
  | 'mp'
  | 'starts'
  | 'min'
  | 'gls'
  | 'ast'
  | 'gPlusA'
  | 'crdY'
  | 'crdR'
  | 'sh'
  | 'sot'
  | 'sotPct'
  | 'gPerSh';
type PerfSortDir = 'asc' | 'desc';

function sum(values: (number | null | undefined)[]): number {
  return values.reduce((acc: number, v) => acc + (v ?? 0), 0);
}

function posColor(pos: string) {
  switch (pos) {
    case 'G':
      return 'bg-info-soft text-info';
    case 'D':
      return 'bg-success-soft text-success';
    case 'M':
      return 'bg-warning-soft text-warning';
    case 'F':
      return 'bg-danger-soft text-danger';
    default:
      return 'bg-bg-secondary text-muted';
  }
}

function posKey(rawPos: string): string {
  const first = rawPos.split(/[,/]/)[0]?.trim() ?? rawPos;
  const map: Record<string, string> = { GK: 'G', DF: 'D', MF: 'M', FW: 'F', G: 'G', D: 'D', M: 'M', F: 'F' };
  return map[first] ?? first;
}

function compareValues(a: unknown, b: unknown, dir: SortDir | PerfSortDir): number {
  let cmp = 0;
  if (a == null && b == null) {
    cmp = 0;
  } else if (a == null) {
    cmp = -1;
  } else if (b == null) {
    cmp = 1;
  } else if (typeof a === 'number' && typeof b === 'number') {
    cmp = a - b;
  } else {
    cmp = String(a).localeCompare(String(b));
  }
  return dir === 'asc' ? cmp : -cmp;
}

export function SquadDashboard({ data, playersData }: { data: SquadData; playersData: PlayersData }) {
  const { t } = useI18n();
  const { updated, source } = data;
  const { club } = useClub();
  const [extraSeasons, setExtraSeasons] = useState<Record<string, SquadSeason>>({});
  const [loadingSeason, setLoadingSeason] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const seasonMap = useMemo<Record<string, SquadSeason>>(
    () => ({ ...(data.seasons ?? {}), ...extraSeasons }),
    [data.seasons, extraSeasons]
  );
  const seasonKeys = useMemo(
    () => data.availableSeasons ?? Object.keys(seasonMap).sort(),
    [data.availableSeasons, seasonMap]
  );
  const latestSeason = seasonKeys[seasonKeys.length - 1] ?? null;
  const [season, setSeason] = useState<string | null>(null);
  const activeSeason = season ?? latestSeason;
  const seasonData = activeSeason ? seasonMap[activeSeason] : undefined;
  const players = seasonData?.players ?? data.players;
  const summary = seasonData?.summary;
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'weeklyGross', dir: 'desc' });

  const playerSeason = playersData.latest;
  const seasonEntry = playersData.seasons[playerSeason];
  const [perfGroup, setPerfGroup] = useState<CompGroup>('all');
  const perfRows = useMemo(
    () =>
      perfGroup === 'all'
        ? (seasonEntry?.players ?? [])
        : mergedPlayersForGroup(seasonEntry?.byComp, perfGroup),
    [perfGroup, seasonEntry]
  );
  const [perfSort, setPerfSort] = useState<{ key: PerfSortKey; dir: PerfSortDir }>({ key: 'gls', dir: 'desc' });
  const [lbl, setLbl] = useState<Record<string, boolean>>({});
  const lblOn = (k: string) => !!lbl[k];
  const toggleLbl = (k: string) => setLbl((p) => ({ ...p, [k]: !p[k] }));

  const weeklyBill = summary?.grossWeekly ?? sum(players.map((p) => p.weeklyGross));
  const yearlyBill = summary?.grossYearly ?? sum(players.map((p) => p.yearlyGross));
  const totalBill = summary?.grossTotalYearly ?? null;
  const avgAge = useMemo(() => {
    const withAge = players.filter((p) => p.age != null);
    if (withAge.length === 0) return null;
    return withAge.reduce((acc, p) => acc + (p.age ?? 0), 0) / withAge.length;
  }, [players]);

  const ageBands = useMemo(() => {
    const bands = [
      { key: '≤19', max: 19 },
      { key: '20–23', max: 23 },
      { key: '24–27', max: 27 },
      { key: '28–31', max: 31 },
      { key: '32+', max: Infinity },
    ];
    const out = bands.map((b) => ({ band: b.key, count: 0 }));
    for (const p of players) {
      if (p.age == null) continue;
      const band = bands.find((b) => p.age! <= b.max) ?? bands[bands.length - 1];
      const item = out.find((o) => o.band === band.key)!;
      item.count += 1;
    }
    return out;
  }, [players]);

  const expiry = useMemo(() => {
    const groups = new Map<string, number>();
    for (const p of players) {
      if (!p.expires) continue;
      groups.set(p.expires, (groups.get(p.expires) ?? 0) + 1);
    }
    return Array.from(groups.entries())
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => a.year.localeCompare(b.year));
  }, [players]);

  const wageTrend = useMemo(
    () =>
      seasonKeys
        .filter((s) => data.seasons?.[s]?.summary?.grossWeekly != null)
        .map((s) => ({
          season: seasonShort(s),
          weekly: (data.seasons![s].summary.grossWeekly ?? 0) / 1e6,
        })),
    [seasonKeys, data.seasons]
  );

  const getSortValue = (p: SquadPlayer, key: SortKey) => {
    switch (key) {
      case 'name':
        return p.name;
      case 'pos':
        return `${p.pos}-${p.subPos ?? ''}`;
      case 'age':
        return p.age ?? -Infinity;
      case 'weeklyGross':
        return p.weeklyGross ?? -Infinity;
      case 'yearlyGross':
        return p.yearlyGross ?? -Infinity;
      case 'expires':
        return p.expires ? Number(p.expires) : -Infinity;
      case 'status':
        return p.status ?? '';
      default:
        return '';
    }
  };

  const sortedRows = useMemo(() => {
    const copy = [...players];
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
  }, [players, sort]);

  const toggleSort = (key: SortKey) => {
    setSort((prev) => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));
  };

  const getPerfSortValue = (p: PlayerSeasonStats, key: PerfSortKey) => {
    switch (key) {
      case 'player':
        return p.player;
      case 'pos':
        return p.pos;
      case 'age':
        return p.age ?? -Infinity;
      case 'mp':
        return p.mp ?? -Infinity;
      case 'starts':
        return p.starts ?? -Infinity;
      case 'min':
        return p.min ?? -Infinity;
      case 'gls':
        return p.gls ?? -Infinity;
      case 'ast':
        return p.ast ?? -Infinity;
      case 'gPlusA':
        return p.gPlusA ?? -Infinity;
      case 'crdY':
        return p.crdY ?? -Infinity;
      case 'crdR':
        return p.crdR ?? -Infinity;
      case 'sh':
        return p.sh ?? -Infinity;
      case 'sot':
        return p.sot ?? -Infinity;
      case 'sotPct':
        return p.sotPct ?? -Infinity;
      case 'gPerSh':
        return p.gPerSh ?? -Infinity;
      default:
        return '';
    }
  };

  const sortedPerfRows = useMemo(() => {
    const copy = [...perfRows];
    copy.sort((a, b) => {
      const aVal = getPerfSortValue(a, perfSort.key);
      const bVal = getPerfSortValue(b, perfSort.key);
      let cmp = compareValues(aVal, bVal, perfSort.dir);
      if (cmp === 0) {
        if (perfSort.key !== 'gls') {
          cmp = compareValues(a.gls, b.gls, 'desc');
        }
        if (cmp === 0) {
          cmp = compareValues(a.ast, b.ast, 'desc');
        }
      }
      return cmp;
    });
    return copy;
  }, [perfRows, perfSort]);

  const togglePerfSort = (key: PerfSortKey) => {
    setPerfSort((prev) => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));
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
            const text = typeof value === 'number' && !Number.isNaN(value) ? fmt(value, 0) : '—';
            const color = entry.color ?? 'var(--text-muted)';
            return (
              <div key={idx} className="flex items-center gap-2 text-xs text-secondary">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="font-semibold text-primary">{text}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const kpi = [
    { label: t('squad.kpi.weeklyBill'), value: gbp(weeklyBill, 0) },
    { label: t('squad.kpi.yearlyBill'), value: gbp(yearlyBill, 0) },
    { label: t('squad.kpi.totalBill'), value: gbp(totalBill, 0) },
    { label: t('squad.kpi.playerCount'), value: fmt(players.length, 0) },
    { label: t('squad.kpi.avgAge'), value: fmt(avgAge, 2) },
  ].filter((k) => k.value !== '—');

  const SQ_TIP: Partial<Record<SortKey, string>> = {
    pos: t('colTip.pos'),
    age: t('colTip.age'),
    weeklyGross: t('colTip.weeklyGross'),
    yearlyGross: t('colTip.yearlyGross'),
    expires: t('colTip.expires'),
    status: t('colTip.status'),
  };

  const columns: { key: SortKey; label: string; align: 'left' | 'right' }[] = [
    { key: 'name', label: t('squad.table.name'), align: 'left' },
    { key: 'pos', label: t('squad.table.pos'), align: 'left' },
    { key: 'age', label: t('squad.table.age'), align: 'right' },
    { key: 'weeklyGross', label: t('squad.table.weeklyGross'), align: 'right' },
    { key: 'yearlyGross', label: t('squad.table.yearlyGross'), align: 'right' },
    { key: 'expires', label: t('squad.table.expires'), align: 'right' },
    { key: 'status', label: t('squad.table.status'), align: 'left' },
  ];

  const perfColumns: { key: PerfSortKey; label: string; align: 'left' | 'right'; dec?: number }[] = [
    { key: 'player', label: t('squad.col.player'), align: 'left' },
    { key: 'pos', label: t('squad.col.pos'), align: 'left' },
    { key: 'age', label: t('squad.col.age'), align: 'right', dec: 0 },
    { key: 'mp', label: t('squad.col.mp'), align: 'right', dec: 0 },
    { key: 'starts', label: t('squad.col.starts'), align: 'right', dec: 0 },
    { key: 'min', label: t('squad.col.min'), align: 'right', dec: 0 },
    { key: 'gls', label: t('squad.col.gls'), align: 'right', dec: 0 },
    { key: 'ast', label: t('squad.col.ast'), align: 'right', dec: 0 },
    { key: 'gPlusA', label: t('squad.col.gPlusA'), align: 'right', dec: 0 },
    { key: 'crdY', label: t('squad.col.crdY'), align: 'right', dec: 0 },
    { key: 'crdR', label: t('squad.col.crdR'), align: 'right', dec: 0 },
    { key: 'sh', label: t('squad.col.sh'), align: 'right', dec: 0 },
    { key: 'sot', label: t('squad.col.sot'), align: 'right', dec: 0 },
    { key: 'sotPct', label: t('squad.col.sotPct'), align: 'right' },
    { key: 'gPerSh', label: t('squad.col.gPerSh'), align: 'right' },
  ];

  const PERF_TIP: Partial<Record<PerfSortKey, string>> = {
    pos: t('colTip.pos'),
    age: t('colTip.age'),
    mp: t('colTip.mp'),
    starts: t('colTip.starts'),
    min: t('colTip.min'),
    gls: t('colTip.gls'),
    ast: t('colTip.ast'),
    gPlusA: t('colTip.gPlusA'),
    crdY: t('colTip.crdY'),
    crdR: t('colTip.crdR'),
    sh: t('colTip.sh'),
    sot: t('colTip.sot'),
    sotPct: t('colTip.sotPct'),
    gPerSh: t('colTip.gPerSh'),
  };

  const renderPerfCell = (p: PlayerSeasonStats, key: PerfSortKey, dec?: number) => {
    if (key === 'player') return p.player;
    if (key === 'pos') {
      const pk = posKey(p.pos);
      return (
        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${posColor(pk)}`}>
          {t(`squad.pos.${pk}`)}
        </span>
      );
    }
    const value = p[key] as number | null;
    return fmt(value, dec ?? 2);
  };

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-6 py-8 lg:px-10">
      <section className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-primary">{t('squad.title')}</h2>
          {seasonKeys.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <label htmlFor="squad-season">{t('squad.season')}</label>
              <select
                id="squad-season"
                value={activeSeason ?? ''}
                onChange={(e) => {
                  const s = e.target.value;
                  setSeason(s);
                  setLoadError(null);
                  if (s && !(s in seasonMap) && loadingSeason !== s) {
                    setLoadingSeason(s);
                    loadSquadSeason(club.slug, s).then((d) => {
                      if (d && d !== LOAD_FAILED)
                        setExtraSeasons((p) => ({ ...p, [s]: d }));
                      else if (d === LOAD_FAILED) setLoadError(s);
                      setLoadingSeason((cur) => (cur === s ? null : cur));
                    });
                  }
                }}
                className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
              >
                {seasonKeys.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {loadingSeason === activeSeason && (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-border border-t-brand" aria-label="loading" />
              )}
            </div>
          )}
        </div>
        {loadError === activeSeason && (
          <LoadFail
            onRetry={() => {
              const s = activeSeason;
              if (!s) return;
              setLoadError(null);
              setLoadingSeason(s);
              loadSquadSeason(club.slug, s).then((d) => {
                if (d && d !== LOAD_FAILED)
                  setExtraSeasons((p) => ({ ...p, [s]: d }));
                else if (d === LOAD_FAILED) setLoadError(s);
                setLoadingSeason((cur) => (cur === s ? null : cur));
              });
            }}
          />
        )}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
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
      </section>

      {wageTrend.length > 1 && (
        <ChartCard title={t('squad.chart.weeklyTrend')} action={<LabelsBtn on={lblOn('wage')} onClick={() => toggleLbl('wage')} />}>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={wageTrend} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
              <defs>
                <linearGradient id="wageGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="season" tick={axisTick} axisLine={{ stroke: gridStroke }} tickLine={false} />
              <YAxis
                tick={axisTick}
                axisLine={false}
                tickLine={false}
                width={48}
                tickFormatter={(v: number) => `£${v.toFixed(2)}M`}
                domain={['dataMin - 0.5', 'dataMax + 0.5']}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  fontSize: 13,
                }}
                labelStyle={{ color: 'var(--text)' }}
                formatter={(value) => [`£${Number(value).toFixed(2)}M`, t('squad.kpi.weeklyBill')]}
              />
              <Area
                type="monotone"
                dataKey="weekly"
                stroke="var(--brand)"
                strokeWidth={2.5}
                fill="url(#wageGrad)"
                isAnimationActive={false}
              >
                {lblOn('wage') && <LabelList dataKey="weekly" position="top" fontSize={10} fill="var(--text-muted)" formatter={(v: unknown) => `£${Number(v).toFixed(2)}M`} />}
              </Area>
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title={t('squad.chart.ageTitle')} action={<LabelsBtn on={lblOn('age')} onClick={() => toggleLbl('age')} />}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={ageBands} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="band" tick={axisTick} axisLine={{ stroke: gridStroke }} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={32} />
              <Tooltip content={ChartTooltip} />
              <Bar dataKey="count" fill="var(--brand)" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {lblOn('age') && <LabelList dataKey="count" position="top" fontSize={10} fill="var(--text-muted)" />}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t('squad.chart.expiryTitle')} action={<LabelsBtn on={lblOn('expiry')} onClick={() => toggleLbl('expiry')} />}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={expiry} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="year" tick={axisTick} axisLine={{ stroke: gridStroke }} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={32} />
              <Tooltip content={ChartTooltip} />
              <Bar dataKey="count" fill="var(--info)" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {lblOn('expiry') && <LabelList dataKey="count" position="top" fontSize={10} fill="var(--text-muted)" />}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm dark:shadow-none">
        <div className="border-b border-border px-4 py-3">
          <h3 className="font-display text-lg font-semibold text-primary">{t('squad.table.title')}</h3>
        </div>
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead className="sticky top-0 z-10 bg-surface-elevated">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    title={SQ_TIP[col.key]}
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
              {sortedRows.map((p, idx) => (
                <tr
                  key={`${p.name}-${idx}`}
                  className="border-b border-border transition-colors hover:bg-bg-secondary"
                >
                  <td className="px-3 py-3 text-sm font-medium text-primary">{p.name}</td>
                  <td className="px-3 py-3 text-sm text-secondary">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${posColor(p.pos)}`}>
                        {t(`squad.pos.${p.pos}`)}
                      </span>
                      {p.subPos && <span className="text-xs text-muted">{p.subPos}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right text-sm text-secondary">{fmt(p.age, 0)}</td>
                  <td className="px-3 py-3 text-right text-sm text-secondary">{gbp(p.weeklyGross, 0)}</td>
                  <td className="px-3 py-3 text-right text-sm text-secondary">{gbp(p.yearlyGross, 0)}</td>
                  <td className="px-3 py-3 text-right text-sm text-secondary">{dash(p.expires)}</td>
                  <td className="px-3 py-3 text-left text-sm text-secondary">
                    {p.status ? t(`squad.status.${p.status}`) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {seasonEntry && (
        <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm dark:shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <h3 className="font-display text-lg font-semibold text-primary">
              {t('squad.performance.title').replace('{season}', playerSeason)}
            </h3>
            <CompetitionTabs group={perfGroup} onChange={setPerfGroup} />
          </div>
          {perfGroup !== 'all' && perfRows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">{t('squad.noCompData')}</p>
          ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[1100px] border-collapse">
              <thead className="sticky top-0 z-10 bg-surface-elevated">
                <tr>
                  {perfColumns.map((col) => (
                    <th
                      key={col.key}
                      title={PERF_TIP[col.key]}
                      onClick={() => togglePerfSort(col.key)}
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
                        {perfSort.key === col.key ? (
                          perfSort.dir === 'asc' ? (
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
                {sortedPerfRows.map((p, idx) => (
                  <tr
                    key={`${p.player}-${idx}`}
                    className="border-b border-border transition-colors hover:bg-bg-secondary"
                  >
                    {perfColumns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-3 py-3 text-sm ${
                          col.align === 'left'
                            ? 'text-left font-medium text-primary'
                            : 'text-right text-secondary'
                        }`}
                      >
                        {renderPerfCell(p, col.key, col.dec)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </section>
      )}

      <footer className="flex flex-col gap-1">
        <p className="text-xs text-muted">{t('squad.disclaimer')}</p>
        <p className="text-xs text-muted">
          {t('squad.dataNote')}{' '}
          {source ? (
            <a
              href={source}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:underline"
            >
              Capology
            </a>
          ) : (
            'Capology'
          )}{' '}
          · {activeSeason ?? updated ?? '—'}
        </p>
      </footer>
    </main>
  );
}

function ChartCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none">
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
