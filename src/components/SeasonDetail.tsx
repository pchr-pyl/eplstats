'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  Home,
  Plane,
  Search,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  type TooltipContentProps,
  ReferenceLine,
  LabelList,
  Legend,
} from 'recharts';
import { useI18n } from '@/i18n/I18nContext';
import type { CompGroup, MatchRow, SeasonMatchlogs } from '@/lib/types';
import { compInGroup, canonicalComp, seasonShort } from '@/lib/stats';
import { fmt, signed, pct, dash } from '@/lib/format';
import { useClub, useClubData } from '@/components/ClubProvider';
import {
  loadMatchlogs,
  LoadFail,
  LOAD_FAILED,
  COMP_SHORT,
  formatDate,
} from '@/components/matchlog-shared';
import { CompetitionTabs } from '@/components/CompetitionTabs';
import { LabelsBtn } from '@/components/LabelsBtn';
import { ShareBtn } from '@/components/ShareBtn';
import { ClubCrest } from '@/components/LeagueHome';
import { MatchCard } from '@/components/MatchCard';
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
  matchIdx: number;
  matchId: string | null;
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

interface VenueSplit {
  mp: number;
  w: number;
  d: number;
  l: number;
  pts: number;
  ppg: number | null;
  winRate: number | null;
  gf: number;
  ga: number;
  gd: number;
  cs: number;
  xg: number | null;
  xga: number | null;
  xgd: number | null;
  possAvg: number | null;
}

const resultChipClass: Record<string, string> = {
  W: 'bg-success-soft text-success',
  D: 'bg-bg-secondary text-muted',
  L: 'bg-danger-soft text-danger',
};

const venueChipClass: Record<string, string> = {
  H: 'bg-brand-soft text-brand',
  A: 'bg-bg-secondary text-secondary',
  N: 'bg-warning-soft text-warning',
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
  if (dataKey === 'xg' || dataKey === 'xga' || dataKey === 'cumXgd')
    return fmt(v, 2);
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

function computeVenueSplit(rows: Row[]): VenueSplit {
  const mp = rows.length;
  let w = 0;
  let d = 0;
  let l = 0;
  let gf = 0;
  let ga = 0;
  let cs = 0;
  let xgSum = 0;
  let xgaSum = 0;
  let xgN = 0;
  let possSum = 0;
  let possN = 0;
  for (const r of rows) {
    if (r.result === 'W') w++;
    else if (r.result === 'D') d++;
    else if (r.result === 'L') l++;
    gf += r.gf;
    ga += r.ga;
    if (r.ga === 0) cs++;
    if (r.xg != null && r.xga != null) {
      xgSum += r.xg;
      xgaSum += r.xga;
      xgN++;
    }
    if (r.poss != null) {
      possSum += r.poss;
      possN++;
    }
  }
  const pts = w * 3 + d;
  return {
    mp,
    w,
    d,
    l,
    pts,
    ppg: mp > 0 ? pts / mp : null,
    winRate: mp > 0 ? w / mp : null,
    gf,
    ga,
    gd: gf - ga,
    cs,
    xg: xgN > 0 ? xgSum : null,
    xga: xgN > 0 ? xgaSum : null,
    xgd: xgN > 0 ? xgSum - xgaSum : null,
    possAvg: possN > 0 ? possSum / possN : null,
  };
}

interface DetailTooltipProps extends TooltipContentProps {
  homeLabel: string;
  awayLabel: string;
}

function SeasonDetailTooltip({
  active,
  payload,
  homeLabel,
  awayLabel,
}: DetailTooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as Row;
  const venue =
    p.venue === 'Home' ? homeLabel : p.venue === 'Away' ? awayLabel : 'N';
  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-3 shadow-lg">
      <div className="mb-1.5 flex items-center justify-between gap-3 border-b border-border-light pb-1">
        <span className="font-display text-xs font-bold text-primary">
          #{p.k} · {venue} {dash(p.opponent)}
        </span>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums ${
            resultChipClass[p.result] ?? 'bg-bg-secondary text-muted'
          }`}
        >
          {p.score} {p.result}
        </span>
      </div>
      <p className="mb-1.5 text-[10px] font-medium text-muted">
        {p.date} · {p.comp}
      </p>
      <div className="flex flex-col gap-1">
        {payload.map((entry, idx) => {
          const v = entry.value as number | null;
          const text = valueFmt(String(entry.dataKey ?? ''), v);
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
                <span className="font-medium">{entry.name}</span>
              </span>
              <span className="font-bold tabular-nums text-primary">{text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SeasonDetail() {
  const { t, lang } = useI18n();
  const { club } = useClub();
  const { matches } = useClubData();
  const th = lang === 'th';
  const tx = (en: string, thText: string) => (th ? thText : en);
  const clubName = th && club.nameTh ? club.nameTh : club.name;

  const seasons = useMemo(
    () => [...new Set(matches.map((m) => m.season))].sort().reverse(),
    [matches],
  );

  const [selectedSeason, setSelectedSeason] = useState<string>(
    () => seasons[0] ?? '',
  );
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
    setOpenMatchIdx(null);
  };

  const [group, setGroup] = useState<CompGroup>('all');
  const [logs, setLogs] = useState<
    SeasonMatchlogs | typeof LOAD_FAILED | undefined
  >(undefined);
  const [retryTick, setRetryTick] = useState(0);

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
  }, [club.slug, season, retryTick]);

  const extras = useMemo(
    () => (logs && logs !== LOAD_FAILED ? extrasFrom(logs, group) : null),
    [logs, group],
  );

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
            a.date.localeCompare(b.date) ||
            (a.time ?? '').localeCompare(b.time ?? ''),
        ),
    [matches, season, group],
  );

  const rows = useMemo<Row[]>(() => {
    return played.reduce<Row[]>((acc, m, idx) => {
      const prev = acc[acc.length - 1];
      const gd = (prev?.cumGd ?? 0) + (m.gf ?? 0) - (m.ga ?? 0);
      const lastXgd = acc.findLast((r) => r.cumXgd != null)?.cumXgd ?? 0;
      const cumXgd =
        m.xg != null && m.xga != null ? lastXgd + m.xg - m.xga : null;
      const e = extras?.get(m.date);
      acc.push({
        k: acc.length + 1,
        matchIdx: idx,
        matchId: m.matchId ?? null,
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

  const totals = useMemo(() => {
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
        if (r.sotA != null) {
          acc.sotASum += r.sotA;
          acc.sotAN += 1;
        }
        if (r.saves != null) {
          acc.savesSum += r.saves;
          acc.savesN += 1;
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
        sotASum: 0,
        sotAN: 0,
        savesSum: 0,
        savesN: 0,
        possSum: 0,
        possN: 0,
      },
    );

    const pts = stats.w * 3 + stats.d;
    const gd = stats.gf - stats.ga;
    const xgd =
      stats.xgN > 0 && stats.xgaN > 0 ? stats.xgSum - stats.xgaSum : null;
    const shPerMp = stats.shN > 0 ? stats.shSum / stats.shN : null;
    const shAPerMp = stats.shAN > 0 ? stats.shASum / stats.shAN : null;
    const possAvg = stats.possN > 0 ? stats.possSum / stats.possN : null;
    const savePct =
      stats.sotASum > 0 && stats.savesN > 0
        ? stats.savesSum / stats.sotASum
        : null;

    return {
      mp,
      ...stats,
      pts,
      ppg: mp > 0 ? pts / mp : null,
      winRate: mp > 0 ? stats.w / mp : null,
      csRate: mp > 0 ? stats.cs / mp : null,
      gd,
      xgd,
      shPerMp,
      shAPerMp,
      possAvg,
      savePct,
      wPct: mp > 0 ? (stats.w / mp) * 100 : 0,
      dPct: mp > 0 ? (stats.d / mp) * 100 : 0,
      lPct: mp > 0 ? (stats.l / mp) * 100 : 0,
    };
  }, [rows]);

  const venueSplits = useMemo(() => {
    const home = computeVenueSplit(rows.filter((r) => r.venue === 'Home'));
    const away = computeVenueSplit(rows.filter((r) => r.venue === 'Away'));
    const neutral = computeVenueSplit(rows.filter((r) => r.venue === 'Neutral'));
    return { home, away, neutral };
  }, [rows]);

  const kpiCards = useMemo(() => {
    const pick = (en: string, thText: string) => (th ? thText : en);
    const mp = totals.mp;
    return [
      {
        label: t('seasonDetail.kpi.mp'),
        value: mp > 0 ? fmt(mp, 0) : '—',
        sub: mp > 0 ? `${fmt(totals.pts, 0)} ${t('table.pts')}` : undefined,
      },
      {
        label: t('seasonDetail.kpi.record'),
        value: mp > 0 ? `${totals.w}-${totals.d}-${totals.l}` : '—',
        sub: mp > 0 ? `${pct(totals.winRate, 2)} ${pick('Win', 'ชนะ')}` : undefined,
      },
      {
        label: t('seasonDetail.kpi.gf'),
        value: mp > 0 ? fmt(totals.gf, 0) : '—',
        sub: mp > 0 ? `${fmt(totals.gf / mp, 2)} ${pick('/ match', '/ นัด')}` : undefined,
      },
      {
        label: t('seasonDetail.kpi.ga'),
        value: mp > 0 ? fmt(totals.ga, 0) : '—',
        sub: mp > 0 ? `${fmt(totals.ga / mp, 2)} ${pick('/ match', '/ นัด')}` : undefined,
      },
      {
        label: t('seasonDetail.kpi.xg'),
        value:
          totals.xgN > 0 ? (
            <>
              <span>{fmt(totals.xgSum, 2)}</span>
              {totals.xgN < mp && (
                <span className="ml-1 text-xs font-normal text-muted">
                  ({totals.xgN}/{mp})
                </span>
              )}
            </>
          ) : (
            '—'
          ),
        sub:
          totals.xgN > 0
            ? `${fmt(totals.xgSum / totals.xgN, 2)} ${pick('/ match', '/ นัด')}`
            : undefined,
      },
      {
        label: t('seasonDetail.kpi.xga'),
        value:
          totals.xgaN > 0 ? (
            <>
              <span>{fmt(totals.xgaSum, 2)}</span>
              {totals.xgaN < mp && (
                <span className="ml-1 text-xs font-normal text-muted">
                  ({totals.xgaN}/{mp})
                </span>
              )}
            </>
          ) : (
            '—'
          ),
        sub:
          totals.xgaN > 0
            ? `${fmt(totals.xgaSum / totals.xgaN, 2)} ${pick('/ match', '/ นัด')}`
            : undefined,
      },
      {
        label: t('seasonDetail.kpi.shPerMp'),
        value: totals.shN > 0 ? fmt(totals.shPerMp, 2) : '—',
        sub: totals.shN > 0 ? `${fmt(totals.shSum, 0)} ${pick('total', 'รวม')}` : undefined,
      },
      {
        label: t('seasonDetail.kpi.shAPerMp'),
        value: totals.shAN > 0 ? fmt(totals.shAPerMp, 2) : '—',
        sub: totals.shAN > 0 ? `${fmt(totals.shASum, 0)} ${pick('total', 'รวม')}` : undefined,
      },
      {
        label: t('seasonDetail.kpi.cs'),
        value: mp > 0 ? fmt(totals.cs, 0) : '—',
        sub: mp > 0 ? `${pct(totals.csRate, 2)}` : undefined,
      },
      {
        label: t('seasonDetail.kpi.poss'),
        value: totals.possN > 0 ? `${fmt(totals.possAvg, 2)}%` : '—',
        sub: totals.possN > 0 ? `${totals.possN} ${pick('tracked', 'นัดที่มีข้อมูล')}` : undefined,
      },
    ];
  }, [totals, t, th]);

  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: 'k',
    dir: 'asc',
  });
  const [goalsCum, setGoalsCum] = useState(false);
  const [lbl, setLbl] = useState<Record<string, boolean>>({});
  const [venueFilter, setVenueFilter] = useState<'all' | 'H' | 'A'>('all');
  const [resultFilter, setResultFilter] = useState<'all' | 'W' | 'D' | 'L'>('all');
  const [tableQuery, setTableQuery] = useState('');
  const [openMatchIdx, setOpenMatchIdx] = useState<number | null>(null);

  const lblOn = (k: string) => !!lbl[k];
  const toggleLbl = (k: string) => setLbl((p) => ({ ...p, [k]: !p[k] }));

  const axisTick = { fill: 'var(--text-muted)', fontSize: 11 };
  const gridStroke = 'var(--border-light)';

  const renderTooltip = (props: TooltipContentProps) => (
    <SeasonDetailTooltip
      {...props}
      homeLabel={t('pace.home')}
      awayLabel={t('pace.away')}
    />
  );

  const sortedRows = useMemo(() => {
    const q = tableQuery.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      if (venueFilter !== 'all' && r.venueShort !== venueFilter) return false;
      if (resultFilter !== 'all' && r.result !== resultFilter) return false;
      if (q) {
        const hay = `${r.opponent ?? ''} ${r.comp} ${r.date} ${r.score}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const copy = [...filtered];
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
  }, [rows, sort, venueFilter, resultFilter, tableQuery]);

  const toggleSort = (key: SortKey) =>
    setSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc',
    }));

  const columns: { key: SortKey; label: string; align: 'left' | 'right' }[] = [
    { key: 'k', label: '#', align: 'right' },
    { key: 'date', label: tx('Date', 'วันที่'), align: 'left' },
    { key: 'comp', label: tx('Comp', 'รายการ'), align: 'left' },
    { key: 'ha', label: tx('H/A', 'เหย้า/เยือน'), align: 'left' },
    { key: 'opponent', label: tx('Opponent', 'คู่แข่ง'), align: 'left' },
    { key: 'result', label: tx('Result', 'ผลแข่ง'), align: 'left' },
    { key: 'xg', label: 'xG', align: 'right' },
    { key: 'xga', label: 'xGA', align: 'right' },
    { key: 'sh', label: 'Sh', align: 'right' },
    { key: 'shA', label: 'ShA', align: 'right' },
    { key: 'sot', label: 'SoT', align: 'right' },
    { key: 'sotA', label: 'SoTA', align: 'right' },
    { key: 'poss', label: tx('Poss', 'ครองบอล'), align: 'right' },
  ];

  const activeMatch =
    openMatchIdx != null ? played[openMatchIdx] ?? null : null;

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-7 px-4 pb-16 pt-6 sm:px-6 lg:px-10">
      {/* --------------------------------------------------- Editorial Masthead */}
      <header className="flex flex-col gap-5 border-b border-border pb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface p-2 shadow-sm sm:h-16 sm:w-16 dark:shadow-none">
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-[3px] bg-brand"
              />
              <ClubCrest slug={club.slug} size={44} alt={clubName} />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                <span>
                  {tx('Season Match-by-Match Dossier', 'เจาะลึกสถิติรายนัดประจำฤดูกาล')}
                </span>
                <span className="text-border">•</span>
                <span className="rounded-md bg-brand-soft px-2 py-0.5 text-[10px] font-bold text-brand">
                  {t(`competitions.${group}`)}
                </span>
                {logs === undefined && season !== '' && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted">
                    <span
                      className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-border border-t-brand"
                      aria-label="loading"
                    />
                    {tx('Loading logs', 'กำลังโหลดข้อมูล')}
                  </span>
                )}
              </div>

              <h1 className="mt-1.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 font-display text-3xl font-bold tracking-tight text-primary sm:text-4xl">
                <span>{clubName}</span>
                <span className="tabular-nums text-brand">
                  {season ? seasonShort(season) : ''}
                </span>
              </h1>

              <p className="mt-1 text-sm text-secondary">
                {tx(
                  'Per-match shots, expected goals, cumulative goal difference, goalkeeper workload, venue splits, and full match ledger.',
                  'ติดตามสถิติยิงประตู xG ผลต่างประตูสะสม งานผู้รักษาประตู ผลงานเหย้า-เยือน และบันทึกการแข่งขันครบทุกนัด',
                )}
              </p>
            </div>
          </div>

          {/* Season selector + Back to Overview */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-1.5">
              <label
                htmlFor="season-detail-select"
                className="text-[11px] font-bold uppercase tracking-wider text-muted"
              >
                {t('seasonDetail.season')}
              </label>
              <select
                id="season-detail-select"
                value={season}
                onChange={(e) => handleSeasonChange(e.target.value)}
                className="cursor-pointer bg-transparent text-sm font-bold tabular-nums text-primary outline-none focus-visible:text-brand"
              >
                {seasons.map((s) => (
                  <option key={s} value={s} className="bg-surface text-primary">
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <Link
              href={`/${club.slug}/`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-bold text-primary transition-colors hover:border-brand/40 hover:bg-brand-soft hover:text-brand"
            >
              <ArrowLeft size={13} className="text-brand" />
              <span>{t('nav.overview')}</span>
            </Link>
          </div>
        </div>

        {/* Competition filter bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface/70 px-3.5 py-2.5">
          <div className="-mb-2 min-w-0 flex-1">
            <CompetitionTabs group={group} onChange={setGroup} />
          </div>
          <span className="text-xs font-medium tabular-nums text-muted">
            {rows.length} {t('matchLog.matches')}
          </span>
        </div>
      </header>

      {logs === LOAD_FAILED && (
        <LoadFail
          onRetry={() => {
            setLogs(undefined);
            setRetryTick((n) => n + 1);
          }}
        />
      )}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface px-6 py-10 text-center text-sm text-muted">
          {t('seasonDetail.empty')}
        </div>
      ) : (
        <>
          {/* ------------------------------------- Season Headline KPI Strip */}
          <section className="flex min-w-0 flex-col gap-4">
            {/* Headline Summary Banner */}
            <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5 dark:shadow-none">
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-[3px] bg-brand"
              />

              <div className="grid grid-cols-1 items-center gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)]">
                {/* W-D-L visual proportion */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand">
                    {tx('Season Headline', 'ภาพรวมฤดูกาล')} · {season}
                  </p>
                  <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-display text-2xl font-extrabold tabular-nums tracking-tight text-primary sm:text-3xl">
                      {totals.w}W – {totals.d}D – {totals.l}L
                    </span>
                    <span className="text-xs font-semibold tabular-nums text-muted">
                      {pct(totals.winRate, 2)} {tx('Win Rate', 'อัตราชนะ')}
                    </span>
                  </div>
                  <div
                    className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-bg-secondary"
                    aria-label={`${totals.w}W ${totals.d}D ${totals.l}L`}
                  >
                    {totals.wPct > 0 && (
                      <span
                        className="bg-success"
                        style={{ width: `${totals.wPct}%` }}
                      />
                    )}
                    {totals.dPct > 0 && (
                      <span
                        className="bg-muted/45"
                        style={{ width: `${totals.dPct}%` }}
                      />
                    )}
                    {totals.lPct > 0 && (
                      <span
                        className="bg-danger"
                        style={{ width: `${totals.lPct}%` }}
                      />
                    )}
                  </div>
                </div>

                {/* Key Headline Metrics */}
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:border-l lg:border-border lg:pl-5">
                  <div className="rounded-xl border border-border-light bg-bg-secondary/60 px-3 py-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                      {tx('Points / PPG', 'คะแนน / เฉลี่ย')}
                    </div>
                    <div className="mt-1 font-display text-xl font-extrabold tabular-nums text-primary">
                      {fmt(totals.pts, 0)}
                    </div>
                    <div className="text-[11px] font-medium tabular-nums text-muted">
                      {fmt(totals.ppg, 2)} {tx('PPG', 'คะแนน/นัด')}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border-light bg-bg-secondary/60 px-3 py-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                      {tx('Goals (GD)', 'ประตู (ผลต่าง)')}
                    </div>
                    <div className="mt-1 font-display text-xl font-extrabold tabular-nums text-primary">
                      {totals.gf}–{totals.ga}
                    </div>
                    <div
                      className={`text-[11px] font-bold tabular-nums ${
                        totals.gd > 0
                          ? 'text-success'
                          : totals.gd < 0
                            ? 'text-danger'
                            : 'text-muted'
                      }`}
                    >
                      GD {signed(totals.gd, 0)}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border-light bg-bg-secondary/60 px-3 py-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                      {tx('xG / xGA (xGD)', 'xG / xGA')}
                    </div>
                    <div className="mt-1 font-display text-xl font-extrabold tabular-nums text-primary">
                      {totals.xgN > 0
                        ? `${fmt(totals.xgSum, 2)}–${fmt(totals.xgaSum, 2)}`
                        : '—'}
                    </div>
                    <div
                      className={`text-[11px] font-bold tabular-nums ${
                        totals.xgd != null && totals.xgd > 0
                          ? 'text-success'
                          : totals.xgd != null && totals.xgd < 0
                            ? 'text-danger'
                            : 'text-muted'
                      }`}
                    >
                      {totals.xgd != null ? `xGD ${signed(totals.xgd, 2)}` : '—'}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border-light bg-bg-secondary/60 px-3 py-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                      {tx('Shots & Poss', 'ยิง & ครองบอล')}
                    </div>
                    <div className="mt-1 font-display text-xl font-extrabold tabular-nums text-primary">
                      {totals.shPerMp != null ? fmt(totals.shPerMp, 2) : '—'}
                    </div>
                    <div className="text-[11px] font-medium tabular-nums text-muted">
                      {totals.possAvg != null
                        ? `${fmt(totals.possAvg, 2)}% ${tx('poss', 'ครองบอล')}`
                        : '—'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed 10-tile KPI grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {kpiCards.map((k) => (
                <div
                  key={k.label}
                  className="group relative flex min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface p-3.5 shadow-sm transition-colors hover:border-brand/35 dark:shadow-none"
                >
                  <span
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-[2px] bg-brand/50 transition-colors group-hover:bg-brand"
                  />
                  <span className="truncate text-[11px] font-bold uppercase tracking-wider text-muted">
                    {k.label}
                  </span>
                  <div className="mt-1.5 font-display text-2xl font-extrabold tabular-nums tracking-tight text-primary">
                    {k.value}
                  </div>
                  {k.sub && (
                    <span className="mt-1 truncate text-[11px] font-medium tabular-nums text-muted">
                      {k.sub}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* --------------------------------------- Venue Splits (Home vs Away) */}
          {(venueSplits.home.mp > 0 || venueSplits.away.mp > 0) && (
            <section className="flex min-w-0 flex-col gap-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                    {tx('Venue Comparison', 'เปรียบเทียบสนามเหย้าและเยือน')}
                  </p>
                  <h2 className="mt-0.5 font-display text-xl font-bold tracking-tight text-primary">
                    {tx('Home vs Away Splits', 'ผลงานเหย้า vs เยือน')}
                  </h2>
                </div>
                {venueSplits.neutral.mp > 0 && (
                  <span className="rounded-lg border border-border bg-bg-secondary px-2.5 py-1 text-xs font-medium tabular-nums text-secondary">
                    {tx('Neutral venue', 'สนามกลาง')}: {venueSplits.neutral.w}-
                    {venueSplits.neutral.d}-{venueSplits.neutral.l} (
                    {venueSplits.neutral.gf}–{venueSplits.neutral.ga})
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <VenueCard
                  title={tx('Home', 'เกมเหย้า')}
                  icon={<Home size={15} className="text-brand" />}
                  accent="bg-brand"
                  split={venueSplits.home}
                  tx={tx}
                />
                <VenueCard
                  title={tx('Away', 'เกมเยือน')}
                  icon={<Plane size={15} className="text-info" />}
                  accent="bg-info"
                  split={venueSplits.away}
                  tx={tx}
                />
              </div>
            </section>
          )}

          {/* ---------------------------------------- Match-by-Match Charts */}
          <section className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                  {tx('Match-by-Match Trajectories', 'กราฟพัฒนาการรายแมตช์')}
                </p>
                <h2 className="mt-0.5 font-display text-xl font-bold tracking-tight text-primary sm:text-2xl">
                  {tx('Performance Breakdown', 'เจาะลึกกราฟรายนัด')}
                </h2>
              </div>
              <span className="text-xs font-medium tabular-nums text-muted">
                {season} · {t(`competitions.${group}`)}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <ChartCard
                className="lg:col-span-2"
                eyebrow={tx('Shot Volume & Accuracy', 'ปริมาณและความแม่นยำในการยิง')}
                title={t('seasonDetail.chart.shots')}
                pills={
                  totals.shPerMp != null || totals.shAPerMp != null
                    ? [
                        { label: 'Avg Sh', value: fmt(totals.shPerMp, 2) },
                        { label: 'Avg ShA', value: fmt(totals.shAPerMp, 2) },
                      ]
                    : undefined
                }
                action={
                  <LabelsBtn on={lblOn('shots')} onClick={() => toggleLbl('shots')} />
                }
              >
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart
                    data={rows}
                    margin={{ top: 10, right: 16, bottom: 8, left: 0 }}
                  >
                    <CartesianGrid
                      stroke={gridStroke}
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="k"
                      tick={axisTick}
                      axisLine={{ stroke: 'var(--border)' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={axisTick}
                      axisLine={false}
                      tickLine={false}
                      width={32}
                    />
                    <Tooltip content={renderTooltip} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="sh"
                      name="Sh"
                      stroke="var(--brand)"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: 'var(--brand)' }}
                      activeDot={{ r: 5 }}
                      isAnimationActive={false}
                      connectNulls={false}
                    >
                      {lblOn('shots') && (
                        <LabelList
                          dataKey="sh"
                          position="top"
                          fontSize={10}
                          fill="var(--text-muted)"
                          formatter={(v) => labelFmt('sh', v)}
                        />
                      )}
                    </Line>
                    <Line
                      type="monotone"
                      dataKey="shA"
                      name="ShA"
                      stroke="var(--chart-neutral)"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: 'var(--chart-neutral)' }}
                      activeDot={{ r: 5 }}
                      isAnimationActive={false}
                      connectNulls={false}
                    >
                      {lblOn('shots') && (
                        <LabelList
                          dataKey="shA"
                          position="top"
                          fontSize={10}
                          fill="var(--text-muted)"
                          formatter={(v) => labelFmt('shA', v)}
                        />
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
                        <LabelList
                          dataKey="sot"
                          position="bottom"
                          fontSize={10}
                          fill="var(--text-muted)"
                          formatter={(v) => labelFmt('sot', v)}
                        />
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
                        <LabelList
                          dataKey="sotA"
                          position="bottom"
                          fontSize={10}
                          fill="var(--text-muted)"
                          formatter={(v) => labelFmt('sotA', v)}
                        />
                      )}
                    </Line>
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                className="lg:col-span-2"
                eyebrow={tx('Scoring Balance', 'สมดุลการทำและเสียประตู')}
                title={t('seasonDetail.chart.gfGa')}
                pills={[
                  { label: 'GF', value: fmt(totals.gf, 0) },
                  { label: 'GA', value: fmt(totals.ga, 0) },
                  { label: 'GD', value: signed(totals.gd, 0) },
                ]}
                action={
                  <div className="flex items-center gap-1.5">
                    <LabelsBtn
                      on={lblOn('gfga')}
                      onClick={() => toggleLbl('gfga')}
                    />
                    <div className="flex rounded-lg border border-border bg-bg-secondary p-0.5 text-xs font-semibold">
                      {([false, true] as const).map((cum) => (
                        <button
                          key={String(cum)}
                          type="button"
                          aria-pressed={goalsCum === cum}
                          onClick={() => setGoalsCum(cum)}
                          className={`rounded-md px-2.5 py-1 transition ${
                            goalsCum === cum
                              ? 'bg-brand text-white shadow-xs'
                              : 'text-muted hover:text-primary'
                          }`}
                        >
                          {t(
                            cum
                              ? 'seasonDetail.cumulative'
                              : 'seasonDetail.perMatch',
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                }
              >
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart
                    data={rows}
                    margin={{ top: 10, right: 16, bottom: 8, left: 0 }}
                  >
                    <CartesianGrid
                      stroke={gridStroke}
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="k"
                      tick={axisTick}
                      axisLine={{ stroke: 'var(--border)' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={axisTick}
                      axisLine={false}
                      tickLine={false}
                      width={32}
                      allowDecimals={false}
                    />
                    <Tooltip content={renderTooltip} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey={goalsCum ? 'cumGf' : 'gf'}
                      name="GF"
                      stroke="var(--brand)"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: 'var(--brand)' }}
                      activeDot={{ r: 5 }}
                      isAnimationActive={false}
                    >
                      {lblOn('gfga') && (
                        <LabelList
                          dataKey={goalsCum ? 'cumGf' : 'gf'}
                          position="top"
                          fontSize={10}
                          fill="var(--text-muted)"
                          formatter={(v) => labelFmt('gf', v)}
                        />
                      )}
                    </Line>
                    <Line
                      type="monotone"
                      dataKey={goalsCum ? 'cumGa' : 'ga'}
                      name="GA"
                      stroke="var(--chart-neutral)"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: 'var(--chart-neutral)' }}
                      activeDot={{ r: 5 }}
                      isAnimationActive={false}
                    >
                      {lblOn('gfga') && (
                        <LabelList
                          dataKey={goalsCum ? 'cumGa' : 'ga'}
                          position="bottom"
                          fontSize={10}
                          fill="var(--text-muted)"
                          formatter={(v) => labelFmt('ga', v)}
                        />
                      )}
                    </Line>
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                eyebrow={tx('Expected vs Actual', 'ประตูจริงเทียบค่าคาดหวัง')}
                title={t('seasonDetail.chart.goals')}
                pills={
                  totals.xgN > 0
                    ? [
                        { label: 'xG', value: fmt(totals.xgSum, 2) },
                        { label: 'xGA', value: fmt(totals.xgaSum, 2) },
                      ]
                    : undefined
                }
                action={
                  <LabelsBtn
                    on={lblOn('goals')}
                    onClick={() => toggleLbl('goals')}
                  />
                }
              >
                <ResponsiveContainer width="100%" height={270}>
                  <ComposedChart
                    data={rows}
                    margin={{ top: 10, right: 16, bottom: 8, left: 0 }}
                  >
                    <CartesianGrid
                      stroke={gridStroke}
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="k"
                      tick={axisTick}
                      axisLine={{ stroke: 'var(--border)' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={axisTick}
                      axisLine={false}
                      tickLine={false}
                      width={32}
                    />
                    <Tooltip content={renderTooltip} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="gf"
                      name="GF"
                      stroke="var(--brand)"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: 'var(--brand)' }}
                      activeDot={{ r: 5 }}
                      isAnimationActive={false}
                      connectNulls={false}
                    >
                      {lblOn('goals') && (
                        <LabelList
                          dataKey="gf"
                          position="top"
                          fontSize={10}
                          fill="var(--text-muted)"
                          formatter={(v) => labelFmt('gf', v)}
                        />
                      )}
                    </Line>
                    <Line
                      type="monotone"
                      dataKey="ga"
                      name="GA"
                      stroke="var(--chart-neutral)"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: 'var(--chart-neutral)' }}
                      activeDot={{ r: 5 }}
                      isAnimationActive={false}
                      connectNulls={false}
                    >
                      {lblOn('goals') && (
                        <LabelList
                          dataKey="ga"
                          position="top"
                          fontSize={10}
                          fill="var(--text-muted)"
                          formatter={(v) => labelFmt('ga', v)}
                        />
                      )}
                    </Line>
                    <Line
                      type="monotone"
                      dataKey="xg"
                      name="xG"
                      stroke="var(--info)"
                      strokeWidth={1.75}
                      strokeDasharray="4 4"
                      dot={false}
                      isAnimationActive={false}
                      connectNulls={false}
                    >
                      {lblOn('goals') && (
                        <LabelList
                          dataKey="xg"
                          position="bottom"
                          fontSize={10}
                          fill="var(--text-muted)"
                          formatter={(v) => labelFmt('xg', v)}
                        />
                      )}
                    </Line>
                    <Line
                      type="monotone"
                      dataKey="xga"
                      name="xGA"
                      stroke="var(--warning)"
                      strokeWidth={1.75}
                      strokeDasharray="4 4"
                      dot={false}
                      isAnimationActive={false}
                      connectNulls={false}
                    >
                      {lblOn('goals') && (
                        <LabelList
                          dataKey="xga"
                          position="bottom"
                          fontSize={10}
                          fill="var(--text-muted)"
                          formatter={(v) => labelFmt('xga', v)}
                        />
                      )}
                    </Line>
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                eyebrow={tx('Net Margin Trajectory', 'เส้นผลต่างประตูสะสม')}
                title={t('seasonDetail.chart.cumGd')}
                pills={[
                  { label: 'GD', value: signed(totals.gd, 0) },
                  ...(totals.xgd != null
                    ? [{ label: 'xGD', value: signed(totals.xgd, 2) }]
                    : []),
                ]}
                action={
                  <LabelsBtn
                    on={lblOn('cumgd')}
                    onClick={() => toggleLbl('cumgd')}
                  />
                }
              >
                <ResponsiveContainer width="100%" height={270}>
                  <ComposedChart
                    data={rows}
                    margin={{ top: 10, right: 16, bottom: 8, left: 0 }}
                  >
                    <CartesianGrid
                      stroke={gridStroke}
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="k"
                      tick={axisTick}
                      axisLine={{ stroke: 'var(--border)' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={axisTick}
                      axisLine={false}
                      tickLine={false}
                      width={36}
                    />
                    <Tooltip content={renderTooltip} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <ReferenceLine
                      y={0}
                      stroke="var(--text-muted)"
                      strokeDasharray="3 3"
                    />
                    <Line
                      type="monotone"
                      dataKey="cumGd"
                      name="GD"
                      stroke="var(--brand)"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: 'var(--brand)' }}
                      activeDot={{ r: 5 }}
                      isAnimationActive={false}
                      connectNulls={false}
                    >
                      {lblOn('cumgd') && (
                        <LabelList
                          dataKey="cumGd"
                          position="top"
                          fontSize={10}
                          fill="var(--text-muted)"
                          formatter={(v) => labelFmt('cumGd', v)}
                        />
                      )}
                    </Line>
                    <Line
                      type="monotone"
                      dataKey="cumXgd"
                      name="xGD"
                      stroke="var(--info)"
                      strokeWidth={1.75}
                      strokeDasharray="4 4"
                      dot={false}
                      isAnimationActive={false}
                      connectNulls
                    >
                      {lblOn('cumgd') && (
                        <LabelList
                          dataKey="cumXgd"
                          position="bottom"
                          fontSize={10}
                          fill="var(--text-muted)"
                          formatter={(v) => labelFmt('cumXgd', v)}
                        />
                      )}
                    </Line>
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                eyebrow={tx('Goalkeeper Workload', 'ภาระงานผู้รักษาประตู')}
                title={t('seasonDetail.chart.keeper')}
                pills={
                  totals.savePct != null
                    ? [
                        { label: 'Saves', value: fmt(totals.savesSum, 0) },
                        { label: 'Save %', value: pct(totals.savePct, 2) },
                      ]
                    : undefined
                }
                action={
                  <LabelsBtn
                    on={lblOn('keeper')}
                    onClick={() => toggleLbl('keeper')}
                  />
                }
              >
                <ResponsiveContainer width="100%" height={270}>
                  <ComposedChart
                    data={rows}
                    margin={{ top: 10, right: 16, bottom: 8, left: 0 }}
                  >
                    <CartesianGrid
                      stroke={gridStroke}
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="k"
                      tick={axisTick}
                      axisLine={{ stroke: 'var(--border)' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={axisTick}
                      axisLine={false}
                      tickLine={false}
                      width={32}
                    />
                    <Tooltip content={renderTooltip} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="sotA"
                      name="SoTA"
                      stroke="var(--danger)"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: 'var(--danger)' }}
                      activeDot={{ r: 5 }}
                      isAnimationActive={false}
                      connectNulls={false}
                    >
                      {lblOn('keeper') && (
                        <LabelList
                          dataKey="sotA"
                          position="top"
                          fontSize={10}
                          fill="var(--text-muted)"
                          formatter={(v) => labelFmt('sotA', v)}
                        />
                      )}
                    </Line>
                    <Line
                      type="monotone"
                      dataKey="saves"
                      name="Saves"
                      stroke="#8b5cf6"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#8b5cf6' }}
                      activeDot={{ r: 5 }}
                      isAnimationActive={false}
                      connectNulls={false}
                    >
                      {lblOn('keeper') && (
                        <LabelList
                          dataKey="saves"
                          position="bottom"
                          fontSize={10}
                          fill="var(--text-muted)"
                          formatter={(v) => labelFmt('saves', v)}
                        />
                      )}
                    </Line>
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                eyebrow={tx('Territorial Control', 'การควบคุมเกมและครองบอล')}
                title={t('seasonDetail.chart.possession')}
                pills={
                  totals.possAvg != null
                    ? [{ label: tx('Avg', 'เฉลี่ย'), value: `${fmt(totals.possAvg, 2)}%` }]
                    : undefined
                }
                action={
                  <LabelsBtn
                    on={lblOn('possession')}
                    onClick={() => toggleLbl('possession')}
                  />
                }
              >
                <ResponsiveContainer width="100%" height={270}>
                  <ComposedChart
                    data={rows}
                    margin={{ top: 10, right: 16, bottom: 8, left: 0 }}
                  >
                    <CartesianGrid
                      stroke={gridStroke}
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="k"
                      tick={axisTick}
                      axisLine={{ stroke: 'var(--border)' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={axisTick}
                      axisLine={false}
                      tickLine={false}
                      width={36}
                      domain={[0, 100]}
                    />
                    <Tooltip content={renderTooltip} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <ReferenceLine
                      y={50}
                      stroke="var(--text-muted)"
                      strokeDasharray="3 3"
                    />
                    <Line
                      type="monotone"
                      dataKey="poss"
                      name="Poss%"
                      stroke="var(--brand)"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: 'var(--brand)' }}
                      activeDot={{ r: 5 }}
                      isAnimationActive={false}
                      connectNulls={false}
                    >
                      {lblOn('possession') && (
                        <LabelList
                          dataKey="poss"
                          position="top"
                          fontSize={10}
                          fill="var(--text-muted)"
                          formatter={(v) => labelFmt('poss', v)}
                        />
                      )}
                    </Line>
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </section>

          <p className="text-xs text-muted">{t('seasonDetail.note')}</p>

          {/* ---------------------------------------------- Match Log Table */}
          <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm dark:shadow-none">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                    {tx('Match Ledger', 'บันทึกการแข่งขันรายนัด')}
                  </p>
                  <span className="rounded-md bg-bg-secondary px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-secondary">
                    {sortedRows.length}/{rows.length}
                  </span>
                </div>
                <h3 className="mt-0.5 font-display text-lg font-bold text-primary">
                  {t('seasonDetail.title')} · {season}
                </h3>
              </div>

              {/* Interactive filters: Venue + Result + Search */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-xl border border-border bg-bg-secondary p-0.5 text-[11px] font-bold">
                  {(
                    [
                      ['all', tx('All', 'ทั้งหมด')],
                      ['H', tx('Home', 'เหย้า')],
                      ['A', tx('Away', 'เยือน')],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      aria-pressed={venueFilter === val}
                      onClick={() => setVenueFilter(val)}
                      className={`rounded-lg px-2.5 py-1 transition ${
                        venueFilter === val
                          ? 'bg-surface text-brand shadow-xs'
                          : 'text-muted hover:text-primary'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="flex rounded-xl border border-border bg-bg-secondary p-0.5 text-[11px] font-bold">
                  {(['all', 'W', 'D', 'L'] as const).map((res) => (
                    <button
                      key={res}
                      type="button"
                      aria-pressed={resultFilter === res}
                      onClick={() => setResultFilter(res)}
                      className={`rounded-lg px-2 py-1 transition ${
                        resultFilter === res
                          ? res === 'W'
                            ? 'bg-success-soft text-success'
                            : res === 'L'
                              ? 'bg-danger-soft text-danger'
                              : 'bg-surface text-primary shadow-xs'
                          : 'text-muted hover:text-primary'
                      }`}
                    >
                      {res === 'all' ? tx('All', 'ทุกผล') : res}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Search
                    size={13}
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
                  />
                  <input
                    type="text"
                    value={tableQuery}
                    onChange={(e) => setTableQuery(e.target.value)}
                    placeholder={tx('Opponent or comp…', 'ค้นหาคู่แข่ง…')}
                    aria-label={tx('Filter matches', 'ค้นหาแมตช์')}
                    className="w-40 rounded-xl border border-border bg-bg-secondary/60 py-1.5 pl-7 pr-6 text-xs text-primary placeholder:text-muted focus:border-brand focus:bg-surface focus:outline-none sm:w-48"
                  />
                  {tableQuery && (
                    <button
                      type="button"
                      onClick={() => setTableQuery('')}
                      aria-label={tx('Clear filter', 'ล้างการค้นหา')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-primary"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full min-w-[1100px] border-collapse">
                <thead className="sticky top-0 z-10 bg-surface-elevated">
                  <tr>
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        onClick={() => toggleSort(col.key)}
                        className={`cursor-pointer border-b border-border px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-muted transition-colors hover:bg-bg-secondary hover:text-primary ${
                          col.align === 'left' ? 'text-left' : 'text-right'
                        } ${sort.key === col.key ? 'text-brand' : ''}`}
                      >
                        <div
                          className={`flex items-center gap-1 ${
                            col.align === 'right'
                              ? 'justify-end'
                              : 'justify-start'
                          }`}
                        >
                          <span>{col.label}</span>
                          {sort.key === col.key ? (
                            sort.dir === 'asc' ? (
                              <ArrowUp size={13} />
                            ) : (
                              <ArrowDown size={13} />
                            )
                          ) : (
                            <ArrowUpDown size={13} className="opacity-30" />
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={columns.length}
                        className="px-4 py-8 text-center text-sm text-muted"
                      >
                        {tx('No matches match your filters.', 'ไม่พบแมตช์ที่ตรงกับตัวกรอง')}
                      </td>
                    </tr>
                  ) : (
                    sortedRows.map((r) => {
                      const clickable = !!r.matchId;
                      return (
                        <tr
                          key={r.k}
                          onClick={() => {
                            if (clickable) setOpenMatchIdx(r.matchIdx);
                          }}
                          className={`border-b border-border-light transition-colors hover:bg-bg-secondary/80 ${
                            clickable ? 'cursor-pointer' : ''
                          }`}
                        >
                          <td className="px-3 py-3 text-right text-sm tabular-nums text-muted">
                            {fmt(r.k, 0)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-sm tabular-nums text-primary">
                            {r.date}
                          </td>
                          <td className="px-3 py-3 text-sm text-secondary">
                            <span className="rounded-md bg-bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-secondary">
                              {r.comp}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-sm">
                            <span
                              className={`inline-flex h-5 w-6 items-center justify-center rounded-md text-[10px] font-bold ${
                                venueChipClass[r.venueShort] ??
                                'bg-bg-secondary text-muted'
                              }`}
                            >
                              {r.venueShort}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-sm font-semibold text-primary">
                            {dash(r.opponent)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-sm">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="font-display text-sm font-bold tabular-nums text-primary">
                                {r.score}
                              </span>
                              <span
                                className={`inline-flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-extrabold ${
                                  resultChipClass[r.result] ??
                                  'bg-bg-secondary text-muted'
                                }`}
                              >
                                {r.result}
                              </span>
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right text-sm tabular-nums text-secondary">
                            {fmt(r.xg, 2)}
                          </td>
                          <td className="px-3 py-3 text-right text-sm tabular-nums text-secondary">
                            {fmt(r.xga, 2)}
                          </td>
                          <td className="px-3 py-3 text-right text-sm tabular-nums text-secondary">
                            {fmt(r.sh, 0)}
                          </td>
                          <td className="px-3 py-3 text-right text-sm tabular-nums text-secondary">
                            {fmt(r.shA, 0)}
                          </td>
                          <td className="px-3 py-3 text-right text-sm tabular-nums text-secondary">
                            {fmt(r.sot, 0)}
                          </td>
                          <td className="px-3 py-3 text-right text-sm tabular-nums text-secondary">
                            {fmt(r.sotA, 0)}
                          </td>
                          <td className="px-3 py-3 text-right text-sm tabular-nums text-secondary">
                            {r.poss != null ? `${fmt(r.poss, 2)}%` : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {activeMatch?.matchId && openMatchIdx != null && (
        <MatchCard
          mid={activeMatch.matchId}
          rows={played}
          index={openMatchIdx}
          onNavigate={(nextIdx) => {
            if (played[nextIdx]?.matchId) setOpenMatchIdx(nextIdx);
          }}
          onClose={() => setOpenMatchIdx(null)}
        />
      )}
    </main>
  );
}

function VenueCard({
  title,
  icon,
  accent,
  split,
  tx,
}: {
  title: string;
  icon: ReactNode;
  accent: string;
  split: VenueSplit;
  tx: (en: string, thText: string) => string;
}) {
  const wPct = split.mp > 0 ? (split.w / split.mp) * 100 : 0;
  const dPct = split.mp > 0 ? (split.d / split.mp) * 100 : 0;
  const lPct = split.mp > 0 ? (split.l / split.mp) * 100 : 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5 dark:shadow-none">
      <span aria-hidden className={`absolute inset-x-0 top-0 h-[2.5px] ${accent}`} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-bg-secondary">
            {icon}
          </span>
          <div>
            <h3 className="font-display text-base font-bold text-primary">{title}</h3>
            <p className="text-[11px] font-medium tabular-nums text-muted">
              {split.mp} {tx('matches', 'นัด')} · {pct(split.winRate, 2)} {tx('Win', 'ชนะ')}
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="font-display text-xl font-extrabold tabular-nums text-primary">
            {split.w}W – {split.d}D – {split.l}L
          </div>
          <div className="text-[11px] font-semibold tabular-nums text-muted">
            {fmt(split.pts, 0)} {tx('pts', 'แต้ม')} · {fmt(split.ppg, 2)} PPG
          </div>
        </div>
      </div>

      {/* W-D-L bar */}
      <div className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-bg-secondary">
        {wPct > 0 && <span className="bg-success" style={{ width: `${wPct}%` }} />}
        {dPct > 0 && <span className="bg-muted/45" style={{ width: `${dPct}%` }} />}
        {lPct > 0 && <span className="bg-danger" style={{ width: `${lPct}%` }} />}
      </div>

      {/* Split metrics */}
      <div className="mt-3.5 grid grid-cols-4 gap-2 border-t border-border-light pt-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
            GF–GA
          </div>
          <div className="mt-0.5 text-sm font-bold tabular-nums text-primary">
            {split.gf}–{split.ga}
          </div>
          <div
            className={`text-[10px] font-bold tabular-nums ${
              split.gd > 0
                ? 'text-success'
                : split.gd < 0
                  ? 'text-danger'
                  : 'text-muted'
            }`}
          >
            GD {signed(split.gd, 0)}
          </div>
        </div>

        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
            xG–xGA
          </div>
          <div className="mt-0.5 text-sm font-bold tabular-nums text-primary">
            {split.xg != null ? `${fmt(split.xg, 2)}` : '—'}
          </div>
          <div
            className={`text-[10px] font-bold tabular-nums ${
              split.xgd != null && split.xgd > 0
                ? 'text-success'
                : split.xgd != null && split.xgd < 0
                  ? 'text-danger'
                  : 'text-muted'
            }`}
          >
            {split.xgd != null ? `xGD ${signed(split.xgd, 2)}` : '—'}
          </div>
        </div>

        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
            {tx('CS', 'คลีนชีต')}
          </div>
          <div className="mt-0.5 text-sm font-bold tabular-nums text-primary">
            {fmt(split.cs, 0)}
          </div>
          <div className="text-[10px] tabular-nums text-muted">
            {split.mp > 0 ? pct(split.cs / split.mp, 2) : '—'}
          </div>
        </div>

        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
            {tx('Poss', 'ครองบอล')}
          </div>
          <div className="mt-0.5 text-sm font-bold tabular-nums text-primary">
            {split.possAvg != null ? `${fmt(split.possAvg, 2)}%` : '—'}
          </div>
          <div className="text-[10px] text-muted">{tx('avg', 'เฉลี่ย')}</div>
        </div>
      </div>
    </div>
  );
}

function ChartCard({
  eyebrow,
  title,
  pills,
  className,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  pills?: { label: string; value: string }[];
  className?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className={`min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5 dark:shadow-none ${
        className ?? ''
      }`}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-border-light pb-2.5">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
            {eyebrow}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-bold text-primary sm:text-lg">
              {title}
            </h3>
            {pills && pills.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {pills.map((p) => (
                  <span
                    key={p.label}
                    className="inline-flex items-baseline gap-1 rounded-md border border-border-light bg-bg-secondary/70 px-2 py-0.5 text-[11px] tabular-nums"
                  >
                    <span className="font-semibold text-muted">{p.label}</span>
                    <span className="font-bold text-primary">{p.value}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
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
