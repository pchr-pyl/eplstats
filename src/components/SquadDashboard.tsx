'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  Info,
  Search,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from 'recharts';
import { LabelsBtn } from './LabelsBtn';
import { ShareBtn } from './ShareBtn';
import { ClubCrest } from './LeagueHome';
import { useI18n } from '@/i18n/I18nContext';
import type {
  CompGroup,
  PlayersData,
  PlayerSeasonStats,
  PlayersSeason,
  SquadData,
  SquadPlayer,
  SquadSeason,
} from '@/lib/types';
import { mergedPlayersForGroup, seasonShort } from '@/lib/stats';
import { dash, fmt, gbp } from '@/lib/format';
import { useClub } from './ClubProvider';
import {
  LOAD_FAILED,
  LoadFail,
  loadPlayersSeason,
  loadSquadSeason,
} from './matchlog-shared';
import { CompetitionTabs } from './CompetitionTabs';

type PosFilter = 'ALL' | 'G' | 'D' | 'M' | 'F';
type PerfViewMode = 'totals' | 'per90';

type SortKey =
  | 'name'
  | 'pos'
  | 'age'
  | 'weeklyGross'
  | 'yearlyGross'
  | 'wageShare'
  | 'expires'
  | 'status';
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

const POS_FILTERS: { id: PosFilter; code: string }[] = [
  { id: 'ALL', code: 'ALL' },
  { id: 'G', code: 'GK' },
  { id: 'D', code: 'DF' },
  { id: 'M', code: 'MF' },
  { id: 'F', code: 'FW' },
];

const POS_BAR_COLOR: Record<'G' | 'D' | 'M' | 'F', string> = {
  G: 'var(--info)',
  D: 'var(--success)',
  M: 'var(--warning)',
  F: 'var(--brand)',
};

const AGE_TIER_COLOR = {
  youth: 'var(--info)',
  prime: 'var(--brand)',
  veteran: 'var(--warning)',
};

function sum(values: (number | null | undefined)[]): number {
  return values.reduce((acc: number, v) => acc + (v ?? 0), 0);
}

function posColor(pos: string): string {
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
  const map: Record<string, string> = {
    GK: 'G',
    DF: 'D',
    MF: 'M',
    FW: 'F',
    G: 'G',
    D: 'D',
    M: 'M',
    F: 'F',
  };
  return map[first] ?? first;
}

function matchesPosFilter(rawPos: string, filter: PosFilter): boolean {
  if (filter === 'ALL') return true;
  return rawPos
    .split(/[,/]/)
    .some((part) => posKey(part.trim()) === filter);
}

function parseYear(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = /(\d{4})/.exec(raw);
  return m ? Number(m[1]) : null;
}

function seasonEndYear(season: string | null): number {
  if (!season) return 2027;
  const parts = season.split('-');
  const end = Number(parts[1] ?? parts[0]);
  return Number.isFinite(end) && end > 1990 ? end : 2027;
}

function playerNineties(p: PlayerSeasonStats): number | null {
  if (p.nineties != null && p.nineties > 0) return p.nineties;
  if (p.min != null && p.min > 0) return p.min / 90;
  return null;
}

function perfMetricValue(
  p: PlayerSeasonStats,
  key: PerfSortKey,
  mode: PerfViewMode,
): number | string | null {
  if (key === 'player') return p.player;
  if (key === 'pos') return p.pos;
  const raw = p[key];
  if (raw == null) return null;
  if (mode === 'per90') {
    if (
      key === 'gls' ||
      key === 'ast' ||
      key === 'gPlusA' ||
      key === 'crdY' ||
      key === 'crdR' ||
      key === 'sh' ||
      key === 'sot'
    ) {
      const n90 = playerNineties(p);
      return n90 != null && n90 > 0 ? raw / n90 : null;
    }
  }
  return raw;
}

function compareNullable(
  a: number | string | null | undefined,
  b: number | string | null | undefined,
  dir: SortDir | PerfSortDir,
): number {
  const aNull = a == null || (typeof a === 'number' && Number.isNaN(a));
  const bNull = b == null || (typeof b === 'number' && Number.isNaN(b));
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;
  let cmp = 0;
  if (typeof a === 'number' && typeof b === 'number') {
    cmp = a - b;
  } else {
    cmp = String(a).localeCompare(String(b));
  }
  return dir === 'asc' ? cmp : -cmp;
}

function nationCode(nation: string | null): string | null {
  if (!nation) return null;
  const parts = nation.trim().split(/\s+/);
  return parts[parts.length - 1] ?? null;
}

function CountChartTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-surface-elevated px-3 py-2.5 shadow-md">
      <p className="mb-1 text-xs font-bold text-primary">{label}</p>
      <div className="flex flex-col gap-1">
        {payload.map((entry, idx) => {
          const value = entry.value;
          const text =
            typeof value === 'number' && !Number.isNaN(value)
              ? fmt(value, 0)
              : '—';
          const color = entry.color ?? 'var(--brand)';
          return (
            <div
              key={idx}
              className="flex items-center gap-2 text-xs text-secondary"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="font-semibold tabular-nums text-primary">
                {text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SortIcon({
  active,
  dir,
}: {
  active: boolean;
  dir: 'asc' | 'desc';
}) {
  if (!active) return <ArrowUpDown size={12} className="shrink-0 opacity-30" />;
  return dir === 'asc' ? (
    <ArrowUp size={12} className="shrink-0 text-brand" />
  ) : (
    <ArrowDown size={12} className="shrink-0 text-brand" />
  );
}

function ChartCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-base font-bold text-primary sm:text-lg">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {action}
          <ShareBtn />
        </div>
      </div>
      {children}
    </div>
  );
}

export function SquadDashboard({
  data,
  playersData,
}: {
  data: SquadData;
  playersData: PlayersData;
}) {
  const { t, lang } = useI18n();
  const th = lang === 'th';
  const tx = (en: string, thText: string) => (th ? thText : en);
  const { updated, source } = data;
  const { club } = useClub();

  const clubDisplayName = th && club.nameTh ? club.nameTh : club.name;

  // Lazy-loaded historical seasons for both Squad Wages & Player Stats
  const [extraSeasons, setExtraSeasons] = useState<Record<string, SquadSeason>>(
    {},
  );
  const [extraPlayers, setExtraPlayers] = useState<
    Record<string, PlayersSeason>
  >({});
  const [loadingSquad, setLoadingSquad] = useState<string | null>(null);
  const [loadingPlayers, setLoadingPlayers] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const seasonMap = useMemo<Record<string, SquadSeason>>(
    () => ({ ...(data.seasons ?? {}), ...extraSeasons }),
    [data.seasons, extraSeasons],
  );
  const playersSeasonMap = useMemo<Record<string, PlayersSeason>>(
    () => ({ ...(playersData.seasons ?? {}), ...extraPlayers }),
    [playersData.seasons, extraPlayers],
  );

  const squadAvailableSet = useMemo(
    () => new Set(data.availableSeasons ?? Object.keys(data.seasons ?? {})),
    [data.availableSeasons, data.seasons],
  );
  const playersAvailableSet = useMemo(
    () =>
      new Set([
        ...club.seasons,
        ...Object.keys(playersData.seasons ?? {}),
        ...(playersData.latest ? [playersData.latest] : []),
      ]),
    [club.seasons, playersData.seasons, playersData.latest],
  );

  const seasonKeys = useMemo(() => {
    const merged = new Set<string>([
      ...(data.availableSeasons ?? Object.keys(data.seasons ?? {})),
      ...club.seasons,
      ...(playersData.latest ? [playersData.latest] : []),
    ]);
    return [...merged].sort();
  }, [data.availableSeasons, data.seasons, club.seasons, playersData.latest]);

  const seasonKeysDesc = useMemo(
    () => [...seasonKeys].reverse(),
    [seasonKeys],
  );
  const latestSeason = seasonKeys[seasonKeys.length - 1] ?? null;

  const [season, setSeason] = useState<string | null>(null);
  const activeSeason = season ?? latestSeason;
  const isLatest = activeSeason === latestSeason;

  const seasonData = activeSeason ? seasonMap[activeSeason] : undefined;
  const hasSquadForSeason =
    activeSeason != null &&
    (squadAvailableSet.has(activeSeason) ||
      (isLatest && data.players.length > 0));
  const players = useMemo<SquadPlayer[]>(() => {
    if (seasonData?.players) return seasonData.players;
    if (isLatest) return data.players;
    return [];
  }, [seasonData, isLatest, data.players]);
  const summary = seasonData?.summary;

  const activePlayersSeason = activeSeason ?? playersData.latest;
  const seasonEntry = activePlayersSeason
    ? playersSeasonMap[activePlayersSeason]
    : undefined;
  const hasPlayersForSeason =
    activePlayersSeason != null && playersAvailableSet.has(activePlayersSeason);

  // Filters, view toggles & sorting state
  const [perfGroup, setPerfGroup] = useState<CompGroup>('all');
  const [perfMode, setPerfMode] = useState<PerfViewMode>('totals');
  const [perfPosFilter, setPerfPosFilter] = useState<PosFilter>('ALL');
  const [perfQuery, setPerfQuery] = useState('');
  const [perfSort, setPerfSort] = useState<{
    key: PerfSortKey;
    dir: PerfSortDir;
  }>({ key: 'gls', dir: 'desc' });

  const [wagePosFilter, setWagePosFilter] = useState<PosFilter>('ALL');
  const [wageQuery, setWageQuery] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: 'weeklyGross',
    dir: 'desc',
  });

  const [lbl, setLbl] = useState<Record<string, boolean>>({});
  const lblOn = (k: string) => !!lbl[k];
  const toggleLbl = (k: string) => setLbl((p) => ({ ...p, [k]: !p[k] }));

  const fetchSeasonData = (s: string) => {
    if (squadAvailableSet.has(s) && !(s in seasonMap) && loadingSquad !== s) {
      setLoadingSquad(s);
      loadSquadSeason(club.slug, s).then((d) => {
        if (d && d !== LOAD_FAILED) {
          setExtraSeasons((p) => ({ ...p, [s]: d }));
        } else if (d === LOAD_FAILED) {
          setLoadError(s);
        }
        setLoadingSquad((cur) => (cur === s ? null : cur));
      });
    }
    if (
      playersAvailableSet.has(s) &&
      !(s in playersSeasonMap) &&
      loadingPlayers !== s
    ) {
      setLoadingPlayers(s);
      loadPlayersSeason(club.slug, s).then((d) => {
        if (d && d !== LOAD_FAILED && Array.isArray(d.players)) {
          setExtraPlayers((p) => ({ ...p, [s]: d as PlayersSeason }));
        }
        setLoadingPlayers((cur) => (cur === s ? null : cur));
      });
    }
  };

  const handleSeasonChange = (next: string) => {
    setSeason(next);
    setLoadError(null);
    if (next) fetchSeasonData(next);
  };

  // Player performance rows for selected season + competition
  const perfRows = useMemo(
    () =>
      perfGroup === 'all'
        ? (seasonEntry?.players ?? [])
        : mergedPlayersForGroup(seasonEntry?.byComp, perfGroup),
    [perfGroup, seasonEntry],
  );

  // Wage bill & squad aggregates
  const sumPlayerWeekly = useMemo(
    () => sum(players.map((p) => p.weeklyGross)),
    [players],
  );
  const sumPlayerYearly = useMemo(
    () => sum(players.map((p) => p.yearlyGross)),
    [players],
  );
  const weeklyBill = summary?.grossWeekly ?? sumPlayerWeekly;
  const yearlyBill = summary?.grossYearly ?? sumPlayerYearly;
  const totalBill = summary?.grossTotalYearly ?? null;
  const wageShareDenom = Math.max(weeklyBill, sumPlayerWeekly);

  const avgAge = useMemo(() => {
    const withAge = players.filter((p) => p.age != null);
    if (withAge.length === 0) return null;
    return withAge.reduce((acc, p) => acc + (p.age ?? 0), 0) / withAge.length;
  }, [players]);

  const ageMinMax = useMemo(() => {
    const ages = players
      .map((p) => p.age)
      .filter((a): a is number => a != null);
    if (ages.length === 0) return null;
    return { min: Math.min(...ages), max: Math.max(...ages) };
  }, [players]);

  const topEarner = useMemo(() => {
    let best: SquadPlayer | null = null;
    for (const p of players) {
      if (p.weeklyGross == null) continue;
      if (!best || p.weeklyGross > (best.weeklyGross ?? -1)) best = p;
    }
    return best;
  }, [players]);

  const topScorer = useMemo(() => {
    let best: PlayerSeasonStats | null = null;
    for (const p of perfRows) {
      if (p.gls == null || p.gls <= 0) continue;
      if (
        !best ||
        p.gls > (best.gls ?? -1) ||
        (p.gls === best.gls && (p.ast ?? 0) > (best.ast ?? 0))
      ) {
        best = p;
      }
    }
    return best;
  }, [perfRows]);

  const topAssister = useMemo(() => {
    let best: PlayerSeasonStats | null = null;
    for (const p of perfRows) {
      if (p.ast == null || p.ast <= 0) continue;
      if (
        !best ||
        p.ast > (best.ast ?? -1) ||
        (p.ast === best.ast && (p.gls ?? 0) > (best.gls ?? 0))
      ) {
        best = p;
      }
    }
    return best;
  }, [perfRows]);

  // Position breakdown (count + wage share)
  const posBreakdown = useMemo(() => {
    const order: ('G' | 'D' | 'M' | 'F')[] = ['G', 'D', 'M', 'F'];
    const map: Record<
      'G' | 'D' | 'M' | 'F',
      { count: number; weekly: number; withSalary: number }
    > = {
      G: { count: 0, weekly: 0, withSalary: 0 },
      D: { count: 0, weekly: 0, withSalary: 0 },
      M: { count: 0, weekly: 0, withSalary: 0 },
      F: { count: 0, weekly: 0, withSalary: 0 },
    };
    for (const p of players) {
      const k = posKey(p.pos);
      if (k === 'G' || k === 'D' || k === 'M' || k === 'F') {
        map[k].count += 1;
        if (p.weeklyGross != null) {
          map[k].weekly += p.weeklyGross;
          map[k].withSalary += 1;
        }
      }
    }
    const totalW = order.reduce((acc, k) => acc + map[k].weekly, 0);
    const totalN = order.reduce((acc, k) => acc + map[k].count, 0);
    return order.map((k) => ({
      pos: k,
      code: k === 'G' ? 'GK' : k === 'D' ? 'DF' : k === 'M' ? 'MF' : 'FW',
      count: map[k].count,
      weekly: map[k].weekly,
      withSalary: map[k].withSalary,
      wagePct: totalW > 0 ? (map[k].weekly / totalW) * 100 : 0,
      countPct: totalN > 0 ? (map[k].count / totalN) * 100 : 0,
      color: POS_BAR_COLOR[k],
    }));
  }, [players]);

  // Squad age profile (Youth <=23, Prime 24-29, Veteran 30+)
  const ageProfile = useMemo(() => {
    const buckets = [
      {
        id: 'youth' as const,
        labelEn: 'Youth (≤23)',
        labelTh: 'ดาวรุ่ง (≤23 ปี)',
        color: AGE_TIER_COLOR.youth,
        count: 0,
        weekly: 0,
      },
      {
        id: 'prime' as const,
        labelEn: 'Prime (24–29)',
        labelTh: 'ช่วงพีค (24–29 ปี)',
        color: AGE_TIER_COLOR.prime,
        count: 0,
        weekly: 0,
      },
      {
        id: 'veteran' as const,
        labelEn: 'Veteran (30+)',
        labelTh: 'เก๋าเกม (30+ ปี)',
        color: AGE_TIER_COLOR.veteran,
        count: 0,
        weekly: 0,
      },
    ];
    for (const p of players) {
      if (p.age == null) continue;
      const b =
        p.age <= 23 ? buckets[0] : p.age <= 29 ? buckets[1] : buckets[2];
      b.count += 1;
      if (p.weeklyGross != null) b.weekly += p.weeklyGross;
    }
    const totalN = buckets.reduce((a, b) => a + b.count, 0);
    const totalW = buckets.reduce((a, b) => a + b.weekly, 0);
    return buckets.map((b) => ({
      ...b,
      pct: totalN > 0 ? (b.count / totalN) * 100 : 0,
      wagePct: totalW > 0 ? (b.weekly / totalW) * 100 : 0,
    }));
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
      const band =
        bands.find((b) => p.age! <= b.max) ?? bands[bands.length - 1];
      const item = out.find((o) => o.band === band.key)!;
      item.count += 1;
    }
    return out;
  }, [players]);

  const endYear = seasonEndYear(activeSeason);

  const expiry = useMemo(() => {
    const groups = new Map<string, number>();
    for (const p of players) {
      const y = parseYear(p.expires);
      if (y == null) continue;
      const k = String(y);
      groups.set(k, (groups.get(k) ?? 0) + 1);
    }
    return Array.from(groups.entries())
      .map(([year, count]) => ({ year, yearNum: Number(year), count }))
      .sort((a, b) => a.yearNum - b.yearNum);
  }, [players]);

  const expiringSoonCount = useMemo(
    () =>
      players.filter((p) => {
        const y = parseYear(p.expires);
        return y != null && y <= endYear;
      }).length,
    [players, endYear],
  );

  const wageTrend = useMemo(
    () =>
      seasonKeys
        .filter((s) => seasonMap[s]?.summary?.grossWeekly != null)
        .map((s) => ({
          season: seasonShort(s),
          weekly: (seasonMap[s].summary.grossWeekly ?? 0) / 1e6,
        })),
    [seasonKeys, seasonMap],
  );

  // Filtered & sorted Wages table
  const filteredWageRows = useMemo(() => {
    const q = wageQuery.trim().toLowerCase();
    return players.filter((p) => {
      if (!matchesPosFilter(p.pos, wagePosFilter)) return false;
      if (q) {
        const hay = `${p.name} ${p.subPos ?? ''} ${p.country ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [players, wagePosFilter, wageQuery]);

  const sortedWageRows = useMemo(() => {
    const copy = [...filteredWageRows];
    const getVal = (p: SquadPlayer, key: SortKey): number | string | null => {
      switch (key) {
        case 'name':
          return p.name;
        case 'pos':
          return `${p.pos}-${p.subPos ?? ''}`;
        case 'age':
          return p.age;
        case 'weeklyGross':
          return p.weeklyGross;
        case 'yearlyGross':
          return p.yearlyGross;
        case 'wageShare':
          return p.weeklyGross != null && wageShareDenom > 0
            ? (p.weeklyGross / wageShareDenom) * 100
            : null;
        case 'expires':
          return parseYear(p.expires);
        case 'status':
          return p.onLoan ? 'Loan' : (p.status ?? null);
      }
    };
    copy.sort((a, b) => {
      const cmp = compareNullable(getVal(a, sort.key), getVal(b, sort.key), sort.dir);
      if (cmp !== 0) return cmp;
      return a.name.localeCompare(b.name);
    });
    return copy;
  }, [filteredWageRows, sort, wageShareDenom]);

  const toggleSort = (key: SortKey) => {
    setSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc',
    }));
  };

  // Filtered & sorted Player Performance table
  const maxPerfMin = useMemo(
    () =>
      perfRows.reduce((m, p) => Math.max(m, p.min ?? 0), 0),
    [perfRows],
  );
  const maxPerfGA = useMemo(
    () =>
      perfRows.reduce((m, p) => {
        const v = perfMetricValue(p, 'gPlusA', perfMode);
        return typeof v === 'number' ? Math.max(m, v) : m;
      }, 0),
    [perfRows, perfMode],
  );

  const filteredPerfRows = useMemo(() => {
    const q = perfQuery.trim().toLowerCase();
    return perfRows.filter((p) => {
      if (!matchesPosFilter(p.pos, perfPosFilter)) return false;
      if (q && !p.player.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [perfRows, perfPosFilter, perfQuery]);

  const sortedPerfRows = useMemo(() => {
    const copy = [...filteredPerfRows];
    copy.sort((a, b) => {
      const aVal = perfMetricValue(a, perfSort.key, perfMode);
      const bVal = perfMetricValue(b, perfSort.key, perfMode);
      let cmp = compareNullable(aVal, bVal, perfSort.dir);
      if (cmp === 0 && perfSort.key !== 'gls') {
        cmp = compareNullable(
          perfMetricValue(a, 'gls', perfMode),
          perfMetricValue(b, 'gls', perfMode),
          'desc',
        );
      }
      if (cmp === 0) {
        cmp = compareNullable(
          perfMetricValue(a, 'ast', perfMode),
          perfMetricValue(b, 'ast', perfMode),
          'desc',
        );
      }
      if (cmp === 0) {
        cmp = compareNullable(a.min, b.min, 'desc');
      }
      return cmp;
    });
    return copy;
  }, [filteredPerfRows, perfSort, perfMode]);

  const togglePerfSort = (key: PerfSortKey) => {
    setPerfSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc',
    }));
  };

  const axisTick = { fill: 'var(--text-muted)', fontSize: 11 };
  const gridStroke = 'var(--border)';

  const SQ_TIP: Partial<Record<SortKey, string>> = {
    pos: t('colTip.pos'),
    age: t('colTip.age'),
    weeklyGross: t('colTip.weeklyGross'),
    yearlyGross: t('colTip.yearlyGross'),
    wageShare: tx(
      'Share of total club weekly wage bill (%)',
      'สัดส่วนต่อยอดค่าเหนื่อยรายสัปดาห์รวมของสโมสร (%)',
    ),
    expires: t('colTip.expires'),
    status: t('colTip.status'),
  };

  const wageColumns: {
    key: SortKey;
    label: string;
    align: 'left' | 'right';
  }[] = [
    { key: 'name', label: t('squad.table.name'), align: 'left' },
    { key: 'pos', label: t('squad.table.pos'), align: 'left' },
    { key: 'age', label: t('squad.table.age'), align: 'right' },
    { key: 'weeklyGross', label: t('squad.table.weeklyGross'), align: 'right' },
    { key: 'yearlyGross', label: t('squad.table.yearlyGross'), align: 'right' },
    {
      key: 'wageShare',
      label: tx('Wage %', 'สัดส่วน %'),
      align: 'right',
    },
    { key: 'expires', label: t('squad.table.expires'), align: 'right' },
    { key: 'status', label: t('squad.table.status'), align: 'left' },
  ];

  const per90Suffix = perfMode === 'per90' ? '/90' : '';
  const perfColumns: {
    key: PerfSortKey;
    label: string;
    align: 'left' | 'right';
    dec?: number;
    per90?: boolean;
  }[] = [
    { key: 'player', label: t('squad.col.player'), align: 'left' },
    { key: 'pos', label: t('squad.col.pos'), align: 'left' },
    { key: 'age', label: t('squad.col.age'), align: 'right', dec: 0 },
    { key: 'mp', label: t('squad.col.mp'), align: 'right', dec: 0 },
    { key: 'starts', label: t('squad.col.starts'), align: 'right', dec: 0 },
    { key: 'min', label: t('squad.col.min'), align: 'right', dec: 0 },
    {
      key: 'gls',
      label: `${t('squad.col.gls')}${per90Suffix}`,
      align: 'right',
      dec: perfMode === 'per90' ? 2 : 0,
      per90: true,
    },
    {
      key: 'ast',
      label: `${t('squad.col.ast')}${per90Suffix}`,
      align: 'right',
      dec: perfMode === 'per90' ? 2 : 0,
      per90: true,
    },
    {
      key: 'gPlusA',
      label: `${t('squad.col.gPlusA')}${per90Suffix}`,
      align: 'right',
      dec: perfMode === 'per90' ? 2 : 0,
      per90: true,
    },
    {
      key: 'sh',
      label: `${t('squad.col.sh')}${per90Suffix}`,
      align: 'right',
      dec: perfMode === 'per90' ? 2 : 0,
      per90: true,
    },
    {
      key: 'sot',
      label: `${t('squad.col.sot')}${per90Suffix}`,
      align: 'right',
      dec: perfMode === 'per90' ? 2 : 0,
      per90: true,
    },
    { key: 'sotPct', label: t('squad.col.sotPct'), align: 'right', dec: 2 },
    { key: 'gPerSh', label: t('squad.col.gPerSh'), align: 'right', dec: 2 },
    {
      key: 'crdY',
      label: `${t('squad.col.crdY')}${per90Suffix}`,
      align: 'right',
      dec: perfMode === 'per90' ? 2 : 0,
      per90: true,
    },
    {
      key: 'crdR',
      label: `${t('squad.col.crdR')}${per90Suffix}`,
      align: 'right',
      dec: perfMode === 'per90' ? 2 : 0,
      per90: true,
    },
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

  const isLoadingAny =
    loadingSquad === activeSeason || loadingPlayers === activeSeason;

  const topEarnerShare =
    topEarner?.weeklyGross != null && wageShareDenom > 0
      ? (topEarner.weeklyGross / wageShareDenom) * 100
      : null;

  const squadPosCompact = posBreakdown
    .map((b) => `${b.count} ${b.code}`)
    .join(' · ');

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 pb-16 pt-6 sm:px-6 lg:px-10">
      {/* ------------------------------------------------ Editorial Masthead */}
      <header className="flex flex-col gap-4 border-b border-border pb-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface p-2 shadow-sm dark:shadow-none sm:h-14 sm:w-14">
              <ClubCrest slug={club.slug} size={40} alt={clubDisplayName} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                <span>
                  {tx(
                    'SQUAD ARCHITECTURE & PLAYER STATS',
                    'โครงสร้างขุมกำลังและสถิตินักเตะ',
                  )}
                </span>
                {activeSeason && (
                  <>
                    <span className="text-border">•</span>
                    <span className="rounded-md bg-brand-soft px-2 py-0.5 text-[10px] font-bold text-brand">
                      {seasonShort(activeSeason)}
                    </span>
                  </>
                )}
              </div>
              <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-primary sm:text-4xl">
                {clubDisplayName}{' '}
                <span className="font-normal text-muted">/</span>{' '}
                {t('squad.title')}
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-secondary">
                {tx(
                  'Per-competition player production, per-90 efficiency, wage structure by position, squad age profile and contract timelines.',
                  'สถิตินักเตะแยกรายการ ประสิทธิภาพต่อ 90 นาที โครงสร้างค่าเหนื่อยตามตำแหน่ง ช่วงอายุขุมกำลัง และกำหนดหมดสัญญา',
                )}
              </p>
            </div>
          </div>

          {/* Season selector (latest first) */}
          {seasonKeysDesc.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-1.5 shadow-sm dark:shadow-none">
                <label
                  htmlFor="squad-season"
                  className="text-[11px] font-bold uppercase tracking-wider text-muted"
                >
                  {t('squad.season')}
                </label>
                <select
                  id="squad-season"
                  value={activeSeason ?? ''}
                  onChange={(e) => handleSeasonChange(e.target.value)}
                  className="cursor-pointer bg-transparent text-sm font-bold tabular-nums text-primary outline-none focus-visible:outline-none"
                >
                  {seasonKeysDesc.map((s) => (
                    <option
                      key={s}
                      value={s}
                      className="bg-surface text-primary"
                    >
                      {s}
                    </option>
                  ))}
                </select>
                {isLoadingAny && (
                  <span
                    className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border border-t-brand"
                    aria-label="loading"
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Competition Tabs + Quick Section Jump Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <CompetitionTabs group={perfGroup} onChange={setPerfGroup} />

          <nav
            aria-label={tx('Squad sections', 'ส่วนเนื้อหาหน้าขุมกำลัง')}
            className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-semibold"
          >
            {[
              [
                '#player-performance',
                tx('Player Performance', 'สถิตินักเตะ'),
              ],
              [
                '#age-position-breakdown',
                tx('Age & Position Breakdown', 'อายุและโครงสร้างตำแหน่ง'),
              ],
              [
                '#wage-bill-contracts',
                tx('Wage Bill & Contracts', 'ค่าเหนื่อยและสัญญา'),
              ],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="shrink-0 rounded-full border border-border bg-surface px-3 py-1.5 text-secondary transition-colors hover:border-brand/40 hover:bg-brand-soft hover:text-brand"
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      {loadError === activeSeason && (
        <LoadFail
          onRetry={() => {
            if (!activeSeason) return;
            setLoadError(null);
            fetchSeasonData(activeSeason);
          }}
        />
      )}

      {/* ----------------------------------------- Squad Snapshot KPI Strip */}
      <section
        aria-label={tx('Squad snapshot', 'สรุปขุมกำลัง')}
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
      >
        {/* 1. Total Yearly / Weekly Wage Bill */}
        <article className="relative flex min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface p-3.5 shadow-sm dark:shadow-none">
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-[2.5px] opacity-85"
            style={{ background: 'var(--brand)' }}
          />
          <span className="truncate text-[11px] font-bold uppercase tracking-wider text-muted">
            {t('squad.kpi.yearlyBill')}
          </span>
          <div className="mt-2 font-display text-xl font-extrabold tabular-nums text-primary sm:text-2xl">
            {yearlyBill > 0 ? gbp(yearlyBill, 0) : '—'}
          </div>
          <p className="mt-1 truncate text-xs tabular-nums text-muted">
            {weeklyBill > 0
              ? `${gbp(weeklyBill, 0)} ${tx('/ wk', '/ สัปดาห์')}`
              : tx('No wage data', 'ไม่มีข้อมูลค่าเหนื่อย')}
            {totalBill != null && totalBill > yearlyBill
              ? ` · ${tx('incl. bonus', 'รวมโบนัส')} ${gbp(totalBill, 0)}`
              : ''}
          </p>
        </article>

        {/* 2. Average Squad Age */}
        <article className="relative flex min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface p-3.5 shadow-sm dark:shadow-none">
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-[2.5px] opacity-85"
            style={{ background: 'var(--brand)' }}
          />
          <span className="truncate text-[11px] font-bold uppercase tracking-wider text-muted">
            {t('squad.kpi.avgAge')}
          </span>
          <div className="mt-2 font-display text-xl font-extrabold tabular-nums text-primary sm:text-2xl">
            {fmt(avgAge, 2)}
            {avgAge != null && (
              <span className="ml-1 text-xs font-semibold text-muted">
                {tx('yrs', 'ปี')}
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-xs tabular-nums text-muted">
            {ageMinMax
              ? `${tx('Range', 'ช่วงอายุ')} ${fmt(ageMinMax.min, 0)}–${fmt(ageMinMax.max, 0)}`
              : '—'}
          </p>
        </article>

        {/* 3. Squad Size */}
        <article className="relative flex min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface p-3.5 shadow-sm dark:shadow-none">
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-[2.5px] opacity-85"
            style={{ background: 'var(--brand)' }}
          />
          <span className="truncate text-[11px] font-bold uppercase tracking-wider text-muted">
            {t('squad.kpi.playerCount')}
          </span>
          <div className="mt-2 font-display text-xl font-extrabold tabular-nums text-primary sm:text-2xl">
            {players.length > 0 ? fmt(players.length, 0) : '—'}
          </div>
          <p className="mt-1 truncate text-[11px] tabular-nums text-muted">
            {players.length > 0 ? squadPosCompact : '—'}
          </p>
        </article>

        {/* 4. Top Earner */}
        <article className="relative flex min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface p-3.5 shadow-sm dark:shadow-none">
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-[2.5px] opacity-85"
            style={{ background: 'var(--brand)' }}
          />
          <span className="truncate text-[11px] font-bold uppercase tracking-wider text-muted">
            {tx('Top Earner', 'ค่าเหนื่อยสูงสุด')}
          </span>
          <div className="mt-2 flex items-baseline justify-between gap-1.5">
            <span className="truncate font-display text-base font-extrabold text-primary sm:text-lg">
              {topEarner ? topEarner.name : '—'}
            </span>
          </div>
          <p className="mt-1 truncate text-xs font-semibold tabular-nums text-brand">
            {topEarner?.weeklyGross != null
              ? `${gbp(topEarner.weeklyGross, 0)}${tx('/wk', '/สัปดาห์')}${
                  topEarnerShare != null ? ` (${fmt(topEarnerShare, 2)}%)` : ''
                }`
              : '—'}
          </p>
        </article>

        {/* 5. Top Scorer */}
        <article className="relative flex min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface p-3.5 shadow-sm dark:shadow-none">
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-[2.5px] opacity-85"
            style={{ background: 'var(--brand)' }}
          />
          <div className="flex items-center justify-between gap-1">
            <span className="truncate text-[11px] font-bold uppercase tracking-wider text-muted">
              {tx('Top Scorer', 'ดาวซัลโว')}
            </span>
            <span className="shrink-0 rounded bg-bg-secondary px-1.5 py-0.5 text-[9px] font-bold uppercase text-muted">
              {t(`competitions.${perfGroup}`)}
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-bold text-primary">
              {topScorer ? topScorer.player : '—'}
            </span>
            <span className="shrink-0 font-display text-xl font-extrabold tabular-nums text-brand">
              {topScorer ? `${fmt(topScorer.gls, 0)}` : '—'}
            </span>
          </div>
          <p className="mt-1 truncate text-xs tabular-nums text-muted">
            {topScorer
              ? `${fmt(topScorer.ast, 0)} ${tx('ast', 'แอสซิสต์')} · ${fmt(topScorer.min, 0)} ${tx('min', 'นาที')}`
              : '—'}
          </p>
        </article>

        {/* 6. Top Assister */}
        <article className="relative flex min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface p-3.5 shadow-sm dark:shadow-none">
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-[2.5px] opacity-85"
            style={{ background: 'var(--brand)' }}
          />
          <div className="flex items-center justify-between gap-1">
            <span className="truncate text-[11px] font-bold uppercase tracking-wider text-muted">
              {tx('Top Assister', 'จอมแอสซิสต์')}
            </span>
            <span className="shrink-0 rounded bg-bg-secondary px-1.5 py-0.5 text-[9px] font-bold uppercase text-muted">
              {t(`competitions.${perfGroup}`)}
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-bold text-primary">
              {topAssister ? topAssister.player : '—'}
            </span>
            <span className="shrink-0 font-display text-xl font-extrabold tabular-nums text-info">
              {topAssister ? `${fmt(topAssister.ast, 0)}` : '—'}
            </span>
          </div>
          <p className="mt-1 truncate text-xs tabular-nums text-muted">
            {topAssister
              ? `${fmt(topAssister.gls, 0)} ${tx('gls', 'ประตู')} · ${fmt(topAssister.gPlusA, 0)} G+A`
              : '—'}
          </p>
        </article>
      </section>

      {/* ----------------------------------------- Player Performance Table */}
      <section
        id="player-performance"
        className="scroll-mt-20 min-w-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm dark:shadow-none"
      >
        <div className="flex flex-col gap-3 border-b border-border bg-surface-elevated px-4 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-lg font-bold text-primary sm:text-xl">
                  {t('squad.performance.title').replace(
                    '{season}',
                    activePlayersSeason ?? '',
                  )}
                </h2>
                <span className="rounded-md bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand">
                  {t(`competitions.${perfGroup}`)}
                </span>
                {perfRows.length > 0 && (
                  <span className="text-xs tabular-nums text-muted">
                    {filteredPerfRows.length}/{perfRows.length}{' '}
                    {tx('players', 'คน')}
                  </span>
                )}
              </div>
            </div>

            {/* Per 90 / Totals Toggle */}
            <div className="inline-flex rounded-xl border border-border bg-surface p-0.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setPerfMode('totals')}
                aria-pressed={perfMode === 'totals'}
                className={`rounded-lg px-3 py-1 transition-colors ${
                  perfMode === 'totals'
                    ? 'bg-primary text-surface'
                    : 'text-muted hover:text-primary'
                }`}
              >
                {tx('Totals', 'สถิติรวม')}
              </button>
              <button
                type="button"
                onClick={() => setPerfMode('per90')}
                aria-pressed={perfMode === 'per90'}
                className={`rounded-lg px-3 py-1 transition-colors ${
                  perfMode === 'per90'
                    ? 'bg-primary text-surface'
                    : 'text-muted hover:text-primary'
                }`}
              >
                {tx('Per 90', 'ต่อ 90 นาที')}
              </button>
            </div>
          </div>

          {/* Filter bar: Position pills + Player search */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-1">
              {POS_FILTERS.map((pf) => {
                const active = perfPosFilter === pf.id;
                return (
                  <button
                    key={pf.id}
                    type="button"
                    onClick={() => setPerfPosFilter(pf.id)}
                    aria-pressed={active}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                      active
                        ? 'bg-brand text-white'
                        : 'border border-border bg-surface text-secondary hover:bg-bg-secondary hover:text-primary'
                    }`}
                  >
                    {pf.id === 'ALL' ? tx('ALL', 'ทั้งหมด') : pf.code}
                  </button>
                );
              })}
            </div>

            <div className="flex w-full items-center gap-2 rounded-xl border border-border bg-surface px-2.5 py-1.5 sm:w-64">
              <Search size={13} className="shrink-0 text-muted" />
              <input
                type="text"
                value={perfQuery}
                onChange={(e) => setPerfQuery(e.target.value)}
                placeholder={tx('Search player...', 'ค้นหานักเตะ...')}
                aria-label={tx('Search player stats', 'ค้นหาสถิตินักเตะ')}
                className="w-full bg-transparent text-xs text-primary placeholder:text-muted focus:outline-none"
              />
              {perfQuery && (
                <button
                  type="button"
                  onClick={() => setPerfQuery('')}
                  aria-label={tx('Clear search', 'ล้างการค้นหา')}
                  className="text-muted hover:text-primary"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>

        {loadingPlayers === activePlayersSeason ? (
          <div className="flex items-center gap-2.5 px-4 py-10 text-sm text-muted">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-brand" />
            <span>{tx('Loading player stats...', 'กำลังโหลดสถิตินักเตะ...')}</span>
          </div>
        ) : !hasPlayersForSeason || !seasonEntry ? (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-8 text-sm text-muted">
            <span>
              {tx(
                'No player performance dataset is available for this season.',
                'ไม่มีข้อมูลสถิตินักเตะสำหรับฤดูกาลนี้',
              )}
            </span>
            {playersData.latest && activeSeason !== playersData.latest && (
              <button
                type="button"
                onClick={() => handleSeasonChange(playersData.latest)}
                className="rounded-lg border border-border bg-bg-secondary px-3 py-1.5 text-xs font-bold text-primary hover:border-brand hover:text-brand"
              >
                {tx(
                  `Jump to ${playersData.latest}`,
                  `ไปที่ฤดูกาล ${playersData.latest}`,
                )}
              </button>
            )}
          </div>
        ) : perfGroup !== 'all' && perfRows.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted">
            {t('squad.noCompData')}
          </p>
        ) : sortedPerfRows.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted">
            {tx(
              'No players match the current position or search filter.',
              'ไม่พบนักเตะตามเงื่อนไขตำแหน่งหรือคำค้นหา',
            )}
          </p>
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[1160px] border-collapse">
              <thead className="sticky top-0 z-10 bg-surface-elevated">
                <tr>
                  {perfColumns.map((col) => (
                    <th
                      key={col.key}
                      title={PERF_TIP[col.key]}
                      onClick={() => togglePerfSort(col.key)}
                      className={`cursor-pointer whitespace-nowrap border-b border-border px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-muted transition-colors hover:bg-bg-secondary ${
                        col.align === 'left' ? 'text-left' : 'text-right'
                      }`}
                    >
                      <div
                        className={`flex items-center gap-1 ${
                          col.align === 'right'
                            ? 'justify-end'
                            : 'justify-start'
                        }`}
                      >
                        <span>{col.label}</span>
                        <SortIcon
                          active={perfSort.key === col.key}
                          dir={perfSort.dir}
                        />
                      </div>
                    </th>
                  ))}
                  <th className="whitespace-nowrap border-b border-border px-3 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-muted">
                    {tx('Compare', 'เปรียบเทียบ')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedPerfRows.map((p, idx) => {
                  const pk = posKey(p.pos);
                  const isOutfield = pk !== 'G';
                  const minShare =
                    p.min != null && maxPerfMin > 0
                      ? Math.min(100, (p.min / maxPerfMin) * 100)
                      : 0;
                  const gaVal = perfMetricValue(p, 'gPlusA', perfMode);
                  const gaShare =
                    typeof gaVal === 'number' && maxPerfGA > 0
                      ? Math.min(100, (gaVal / maxPerfGA) * 100)
                      : 0;
                  const nat = nationCode(p.nation);
                  const compareHref = `/players-compare/?sa=${encodeURIComponent(
                    activePlayersSeason,
                  )}&a=${encodeURIComponent(`${club.slug}|${p.player}`)}`;

                  return (
                    <tr
                      key={`${p.player}-${idx}`}
                      className="group border-b border-border/80 transition-colors hover:bg-bg-secondary/70"
                    >
                      {perfColumns.map((col) => {
                        if (col.key === 'player') {
                          return (
                            <td
                              key={col.key}
                              className="whitespace-nowrap px-3 py-2.5 text-left text-sm font-semibold text-primary"
                            >
                              <div className="flex items-center gap-2">
                                <span>{p.player}</span>
                                {nat && (
                                  <span className="rounded bg-bg-secondary px-1 py-0.5 text-[10px] font-semibold uppercase text-muted">
                                    {nat}
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        }
                        if (col.key === 'pos') {
                          return (
                            <td key={col.key} className="whitespace-nowrap px-3 py-2.5 text-left">
                              <span
                                className={`inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${posColor(pk)}`}
                              >
                                {t(`squad.pos.${pk}`)}
                              </span>
                            </td>
                          );
                        }
                        if (col.key === 'min') {
                          return (
                            <td
                              key={col.key}
                              className="whitespace-nowrap px-3 py-2.5 text-right text-sm tabular-nums text-secondary"
                            >
                              <div className="flex flex-col items-end gap-1">
                                <span className="font-medium text-primary">
                                  {fmt(p.min, 0)}
                                </span>
                                <div className="h-1 w-14 overflow-hidden rounded-full bg-bg-secondary">
                                  <div
                                    className="h-full rounded-full bg-brand/75"
                                    style={{ width: `${minShare}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                          );
                        }
                        if (col.key === 'gPlusA') {
                          const numVal =
                            typeof gaVal === 'number' ? gaVal : null;
                          return (
                            <td
                              key={col.key}
                              className="whitespace-nowrap px-3 py-2.5 text-right text-sm tabular-nums"
                            >
                              <div className="flex flex-col items-end gap-1">
                                <span
                                  className={`font-bold ${
                                    numVal != null && numVal > 0
                                      ? 'text-primary'
                                      : 'text-muted'
                                  }`}
                                >
                                  {fmt(numVal, col.dec ?? 2)}
                                </span>
                                <div className="h-1 w-12 overflow-hidden rounded-full bg-bg-secondary">
                                  <div
                                    className="h-full rounded-full bg-brand"
                                    style={{ width: `${gaShare}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                          );
                        }
                        const val = perfMetricValue(p, col.key, perfMode);
                        const num = typeof val === 'number' ? val : null;
                        const highlight =
                          (col.key === 'gls' || col.key === 'ast') &&
                          num != null &&
                          num > 0;
                        return (
                          <td
                            key={col.key}
                            className={`whitespace-nowrap px-3 py-2.5 text-right text-sm tabular-nums ${
                              highlight
                                ? 'font-semibold text-primary'
                                : 'text-secondary'
                            }`}
                          >
                            {fmt(num, col.dec ?? 2)}
                          </td>
                        );
                      })}

                      <td className="whitespace-nowrap px-3 py-2.5 text-right">
                        {isOutfield ? (
                          <Link
                            href={compareHref}
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-[11px] font-bold text-secondary transition-colors hover:border-brand/40 hover:bg-brand-soft hover:text-brand"
                          >
                            <span>{tx('Compare', 'เทียบ')}</span>
                            <ArrowUpRight size={12} />
                          </Link>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* -------------------------------------- Age & Position Breakdown */}
      <section
        id="age-position-breakdown"
        className="scroll-mt-20 flex flex-col gap-5"
      >
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
              {tx('SQUAD STRUCTURE', 'โครงสร้างขุมกำลัง')}
            </p>
            <h2 className="mt-0.5 font-display text-xl font-bold text-primary sm:text-2xl">
              {tx(
                'Wage Allocation & Age Architecture',
                'สัดส่วนค่าเหนื่อยตามตำแหน่งและโครงสร้างอายุทีม',
              )}
            </h2>
          </div>
          {expiringSoonCount > 0 && (
            <span className="rounded-full bg-warning-soft px-3 py-1 text-xs font-bold tabular-nums text-warning">
              {tx(
                `${expiringSoonCount} contracts expiring ≤ ${endYear}`,
                `${expiringSoonCount} สัญญาหมดภายในปี ${endYear}`,
              )}
            </span>
          )}
        </div>

        {/* Proportional visual bars: Wage Share by Position & Age Profile */}
        {players.length > 0 && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Wage Share by Position */}
            <div className="flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none sm:p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-base font-bold text-primary sm:text-lg">
                    {tx(
                      'Wage Bill Share by Position',
                      'สัดส่วนค่าเหนื่อยตามตำแหน่ง',
                    )}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted">
                    {tx(
                      'Weekly gross wage allocation across GK, DF, MF & FW groups.',
                      'การกระจายงบค่าเหนื่อยรายสัปดาห์แบ่งตามผู้รักษาประตู กองหลัง กองกลาง และกองหน้า',
                    )}
                  </p>
                </div>
                <span className="shrink-0 font-display text-sm font-bold tabular-nums text-primary">
                  {sumPlayerWeekly > 0 ? `${gbp(sumPlayerWeekly, 0)}/wk` : '—'}
                </span>
              </div>

              {/* Stacked proportional bar */}
              <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-bg-secondary">
                {posBreakdown.map((b) =>
                  b.wagePct > 0 ? (
                    <div
                      key={b.pos}
                      title={`${b.code}: ${fmt(b.wagePct, 2)}%`}
                      className="h-full transition-all first:rounded-l-full last:rounded-r-full"
                      style={{
                        width: `${b.wagePct}%`,
                        backgroundColor: b.color,
                      }}
                    />
                  ) : null,
                )}
              </div>

              {/* Breakdown rows */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {posBreakdown.map((b) => (
                  <div
                    key={b.pos}
                    className="flex flex-col justify-between rounded-xl border border-border bg-bg-secondary/50 p-3"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-primary">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: b.color }}
                        />
                        {b.code}
                      </span>
                      <span className="text-[11px] font-semibold tabular-nums text-muted">
                        {b.count} {tx('pl', 'คน')}
                      </span>
                    </div>
                    <div className="mt-2 font-display text-lg font-extrabold tabular-nums text-primary">
                      {sumPlayerWeekly > 0 ? `${fmt(b.wagePct, 2)}%` : '—'}
                    </div>
                    <span className="mt-0.5 truncate text-[11px] tabular-nums text-muted">
                      {b.weekly > 0 ? `${gbp(b.weekly, 0)}/wk` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Squad Age Distribution (Youth / Prime / Veteran) */}
            <div className="flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none sm:p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-base font-bold text-primary sm:text-lg">
                    {tx(
                      'Squad Age Profile',
                      'โครงสร้างช่วงอายุขุมกำลัง',
                    )}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted">
                    {tx(
                      'Balance of Youth (≤23), Prime (24–29) and Veteran (30+) players.',
                      'สมดุลระหว่างนักเตะดาวรุ่ง (≤23) ช่วงพีค (24–29) และรุ่นเก๋า (30+)',
                    )}
                  </p>
                </div>
                <span className="shrink-0 font-display text-sm font-bold tabular-nums text-primary">
                  {avgAge != null
                    ? `${tx('Avg', 'เฉลี่ย')} ${fmt(avgAge, 2)}`
                    : '—'}
                </span>
              </div>

              {/* Stacked proportional bar */}
              <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-bg-secondary">
                {ageProfile.map((b) =>
                  b.pct > 0 ? (
                    <div
                      key={b.id}
                      title={`${th ? b.labelTh : b.labelEn}: ${fmt(b.pct, 2)}%`}
                      className="h-full transition-all first:rounded-l-full last:rounded-r-full"
                      style={{
                        width: `${b.pct}%`,
                        backgroundColor: b.color,
                      }}
                    />
                  ) : null,
                )}
              </div>

              {/* Breakdown cards */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {ageProfile.map((b) => (
                  <div
                    key={b.id}
                    className="flex flex-col justify-between rounded-xl border border-border bg-bg-secondary/50 p-3"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-primary">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: b.color }}
                        />
                        <span className="truncate">
                          {th ? b.labelTh : b.labelEn}
                        </span>
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between gap-1">
                      <span className="font-display text-lg font-extrabold tabular-nums text-primary">
                        {fmt(b.pct, 2)}%
                      </span>
                      <span className="text-xs font-semibold tabular-nums text-secondary">
                        {b.count} {tx('players', 'คน')}
                      </span>
                    </div>
                    <span className="mt-0.5 truncate text-[11px] tabular-nums text-muted">
                      {tx('Wage share', 'สัดส่วนค่าเหนื่อย')}:{' '}
                      {sumPlayerWeekly > 0 ? `${fmt(b.wagePct, 2)}%` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Charts Row: Age Bands & Contract Expiry */}
        {players.length > 0 && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <ChartCard
              title={t('squad.chart.ageTitle')}
              subtitle={tx(
                'Player headcount across detailed age brackets',
                'จำนวนนักเตะแยกตามช่วงอายุแบบละเอียด',
              )}
              action={
                <LabelsBtn
                  on={lblOn('age')}
                  onClick={() => toggleLbl('age')}
                />
              }
            >
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={ageBands}
                  margin={{ top: 10, right: 8, bottom: 4, left: 0 }}
                >
                  <CartesianGrid
                    stroke={gridStroke}
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="band"
                    tick={axisTick}
                    axisLine={{ stroke: gridStroke }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={axisTick}
                    axisLine={false}
                    tickLine={false}
                    width={30}
                    allowDecimals={false}
                  />
                  <Tooltip content={CountChartTooltip} />
                  <Bar
                    dataKey="count"
                    fill="var(--brand)"
                    radius={[6, 6, 0, 0]}
                    isAnimationActive={false}
                  >
                    {lblOn('age') && (
                      <LabelList
                        dataKey="count"
                        position="top"
                        fontSize={10}
                        fill="var(--text-muted)"
                      />
                    )}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title={t('squad.chart.expiryTitle')}
              subtitle={tx(
                'Red = expiring this season, amber = next year',
                'สีแดง = หมดสัญญาฤดูกาลนี้, สีเหลือง = ปีถัดไป',
              )}
              action={
                <LabelsBtn
                  on={lblOn('expiry')}
                  onClick={() => toggleLbl('expiry')}
                />
              }
            >
              {expiry.length === 0 ? (
                <div className="flex h-[260px] items-center justify-center text-sm text-muted">
                  {tx(
                    'No contract expiry dates recorded for this season.',
                    'ไม่มีข้อมูลปีหมดสัญญาสำหรับฤดูกาลนี้',
                  )}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={expiry}
                    margin={{ top: 10, right: 8, bottom: 4, left: 0 }}
                  >
                    <CartesianGrid
                      stroke={gridStroke}
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="year"
                      tick={axisTick}
                      axisLine={{ stroke: gridStroke }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={axisTick}
                      axisLine={false}
                      tickLine={false}
                      width={30}
                      allowDecimals={false}
                    />
                    <Tooltip content={CountChartTooltip} />
                    <Bar
                      dataKey="count"
                      radius={[6, 6, 0, 0]}
                      isAnimationActive={false}
                    >
                      {expiry.map((e) => (
                        <Cell
                          key={e.year}
                          fill={
                            e.yearNum <= endYear
                              ? 'var(--danger)'
                              : e.yearNum === endYear + 1
                                ? 'var(--warning)'
                                : 'var(--info)'
                          }
                        />
                      ))}
                      {lblOn('expiry') && (
                        <LabelList
                          dataKey="count"
                          position="top"
                          fontSize={10}
                          fill="var(--text-muted)"
                        />
                      )}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
        )}

        {/* Weekly Wage Bill Trend (shown when 2+ seasons are loaded) */}
        {wageTrend.length > 1 && (
          <ChartCard
            title={t('squad.chart.weeklyTrend')}
            action={
              <LabelsBtn
                on={lblOn('wage')}
                onClick={() => toggleLbl('wage')}
              />
            }
          >
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart
                data={wageTrend}
                margin={{ top: 10, right: 8, bottom: 4, left: 0 }}
              >
                <defs>
                  <linearGradient id="wageGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="var(--brand)"
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--brand)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke={gridStroke}
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="season"
                  tick={axisTick}
                  axisLine={{ stroke: gridStroke }}
                  tickLine={false}
                />
                <YAxis
                  tick={axisTick}
                  axisLine={false}
                  tickLine={false}
                  width={54}
                  tickFormatter={(v: number) => `£${fmt(v, 2)}M`}
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
                  formatter={(value) => [
                    `£${fmt(Number(value), 2)}M`,
                    t('squad.kpi.weeklyBill'),
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="weekly"
                  stroke="var(--brand)"
                  strokeWidth={2.5}
                  fill="url(#wageGrad)"
                  isAnimationActive={false}
                >
                  {lblOn('wage') && (
                    <LabelList
                      dataKey="weekly"
                      position="top"
                      fontSize={10}
                      fill="var(--text-muted)"
                      formatter={(v: unknown) => `£${fmt(Number(v), 2)}M`}
                    />
                  )}
                </Area>
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </section>

      {/* ----------------------------------------- Wages & Contracts Table */}
      <section
        id="wage-bill-contracts"
        className="scroll-mt-20 min-w-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm dark:shadow-none"
      >
        <div className="flex flex-col gap-3 border-b border-border bg-surface-elevated px-4 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-bold text-primary sm:text-xl">
                {t('squad.table.title')}
              </h2>
              {activeSeason && (
                <span className="rounded-md bg-bg-secondary px-2 py-0.5 text-[11px] font-bold tabular-nums text-secondary">
                  {activeSeason}
                </span>
              )}
              {players.length > 0 && (
                <span className="text-xs tabular-nums text-muted">
                  {filteredWageRows.length}/{players.length}{' '}
                  {tx('players', 'คน')}
                </span>
              )}
            </div>

            {/* Capology estimate callout pill */}
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-warning/30 bg-warning-soft/70 px-2.5 py-1 text-[11px] font-semibold text-warning">
              <Info size={13} className="shrink-0" />
              <span>{t('squad.disclaimer')}</span>
            </div>
          </div>

          {/* Filter bar: Position pills + Player search */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-1">
              {POS_FILTERS.map((pf) => {
                const active = wagePosFilter === pf.id;
                return (
                  <button
                    key={pf.id}
                    type="button"
                    onClick={() => setWagePosFilter(pf.id)}
                    aria-pressed={active}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                      active
                        ? 'bg-brand text-white'
                        : 'border border-border bg-surface text-secondary hover:bg-bg-secondary hover:text-primary'
                    }`}
                  >
                    {pf.id === 'ALL' ? tx('ALL', 'ทั้งหมด') : pf.code}
                  </button>
                );
              })}
            </div>

            <div className="flex w-full items-center gap-2 rounded-xl border border-border bg-surface px-2.5 py-1.5 sm:w-64">
              <Search size={13} className="shrink-0 text-muted" />
              <input
                type="text"
                value={wageQuery}
                onChange={(e) => setWageQuery(e.target.value)}
                placeholder={tx(
                  'Search name, role, country...',
                  'ค้นหาชื่อ ตำแหน่ง หรือสัญชาติ...',
                )}
                aria-label={tx('Search squad wages', 'ค้นหาค่าเหนื่อยนักเตะ')}
                className="w-full bg-transparent text-xs text-primary placeholder:text-muted focus:outline-none"
              />
              {wageQuery && (
                <button
                  type="button"
                  onClick={() => setWageQuery('')}
                  aria-label={tx('Clear search', 'ล้างการค้นหา')}
                  className="text-muted hover:text-primary"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>

        {loadingSquad === activeSeason ? (
          <div className="flex items-center gap-2.5 px-4 py-10 text-sm text-muted">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-brand" />
            <span>
              {tx(
                'Loading squad wages & contracts...',
                'กำลังโหลดข้อมูลค่าเหนื่อยและสัญญา...',
              )}
            </span>
          </div>
        ) : !hasSquadForSeason || players.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted">
            {tx(
              'No salary & contract records available for this season.',
              'ไม่มีข้อมูลค่าเหนื่อยและสัญญาสำหรับฤดูกาลนี้',
            )}
          </p>
        ) : sortedWageRows.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted">
            {tx(
              'No players match the current position or search filter.',
              'ไม่พบนักเตะตามเงื่อนไขตำแหน่งหรือคำค้นหา',
            )}
          </p>
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[960px] border-collapse">
              <thead className="sticky top-0 z-10 bg-surface-elevated">
                <tr>
                  {wageColumns.map((col) => (
                    <th
                      key={col.key}
                      title={SQ_TIP[col.key]}
                      onClick={() => toggleSort(col.key)}
                      className={`cursor-pointer whitespace-nowrap border-b border-border px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-muted transition-colors hover:bg-bg-secondary ${
                        col.align === 'left' ? 'text-left' : 'text-right'
                      }`}
                    >
                      <div
                        className={`flex items-center gap-1 ${
                          col.align === 'right'
                            ? 'justify-end'
                            : 'justify-start'
                        }`}
                      >
                        <span>{col.label}</span>
                        <SortIcon
                          active={sort.key === col.key}
                          dir={sort.dir}
                        />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedWageRows.map((p, idx) => {
                  const pk = posKey(p.pos);
                  const isLoan = p.onLoan || p.status === 'Loan';
                  const sharePct =
                    p.weeklyGross != null && wageShareDenom > 0
                      ? (p.weeklyGross / wageShareDenom) * 100
                      : null;
                  const expYear = parseYear(p.expires);
                  const expUrgency =
                    expYear == null
                      ? 'none'
                      : expYear <= endYear
                        ? 'critical'
                        : expYear === endYear + 1
                          ? 'soon'
                          : 'safe';

                  return (
                    <tr
                      key={`${p.name}-${idx}`}
                      className="border-b border-border/80 transition-colors hover:bg-bg-secondary/70"
                    >
                      <td className="whitespace-nowrap px-3 py-2.5 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-primary">
                            {p.name}
                          </span>
                          {isLoan && (
                            <span className="rounded-full bg-info-soft px-2 py-0.5 text-[10px] font-bold uppercase text-info">
                              {tx('On Loan', 'ยืมตัว')}
                            </span>
                          )}
                        </div>
                        {p.country && (
                          <div className="text-[11px] text-muted">
                            {p.country}
                          </div>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5 text-sm text-secondary">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${posColor(pk)}`}
                          >
                            {t(`squad.pos.${pk}`)}
                          </span>
                          {p.subPos && (
                            <span className="text-xs font-medium text-muted">
                              {p.subPos}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm tabular-nums text-secondary">
                        {fmt(p.age, 0)}
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm font-semibold tabular-nums text-primary">
                        {gbp(p.weeklyGross, 0)}
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm tabular-nums text-secondary">
                        {gbp(p.yearlyGross, 0)}
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm tabular-nums">
                        {sharePct != null ? (
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-xs font-semibold text-primary">
                              {fmt(sharePct, 2)}%
                            </span>
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-bg-secondary">
                              <div
                                className="h-full rounded-full bg-brand"
                                style={{
                                  width: `${Math.min(100, sharePct * 4)}%`,
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm tabular-nums">
                        {expUrgency === 'critical' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-bold text-danger">
                            {p.expires}
                            <span className="text-[10px] font-semibold">
                              · {tx('Expiring', 'ใกล้หมด')}
                            </span>
                          </span>
                        ) : expUrgency === 'soon' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-bold text-warning">
                            {p.expires}
                            <span className="text-[10px] font-semibold">
                              · {tx('1 yr', '1 ปี')}
                            </span>
                          </span>
                        ) : (
                          <span className="text-secondary">
                            {dash(p.expires)}
                          </span>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5 text-left text-xs">
                        {isLoan ? (
                          <span className="inline-flex items-center rounded-full bg-info-soft px-2 py-0.5 font-semibold text-info">
                            {t('squad.status.Loan')}
                          </span>
                        ) : p.status === 'Active' ? (
                          <span className="inline-flex items-center rounded-full bg-success-soft px-2 py-0.5 font-semibold text-success">
                            {t('squad.status.Active')}
                          </span>
                        ) : p.status ? (
                          <span className="inline-flex items-center rounded-full bg-bg-secondary px-2 py-0.5 font-semibold text-muted">
                            {t(`squad.status.${p.status}`)}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ------------------------------------------------ Source & Disclaimer */}
      <footer className="flex flex-col gap-1.5 rounded-2xl border border-border bg-surface p-4 text-xs text-muted">
        <p className="font-medium text-secondary">{t('squad.disclaimer')}</p>
        <p>
          {t('squad.dataNote')}{' '}
          {source ? (
            <a
              href={source}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-brand hover:underline"
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
