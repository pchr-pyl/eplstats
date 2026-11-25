'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Crosshair,
  Flame,
  Target,
  Award,
} from 'lucide-react';
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
  LabelList,
} from 'recharts';
import { useI18n } from '@/i18n/I18nContext';
import type { CompGroup, TeamStatsBySeason } from '@/lib/types';
import { rowsForGroup, seasonShort, teamStatsForGroup } from '@/lib/stats';
import { fmt, pct, signed, dash } from '@/lib/format';
import { useClub, useClubData } from './ClubProvider';
import { ClubCrest } from './LeagueHome';
import { CompetitionTabs } from './CompetitionTabs';
import { MatchlogPanel } from './MatchlogBrowser';
import { SeasonPace } from './SeasonPace';
import { LabelsBtn } from './LabelsBtn';
import { ShareBtn } from './ShareBtn';

type SortKey =
  | 'season'
  | 'mp'
  | 'gls'
  | 'gfPerMp'
  | 'xg'
  | 'xgDiff'
  | 'sh'
  | 'sot'
  | 'sotPct'
  | 'gPerSh'
  | 'pk'
  | 'pkatt'
  | 'topScorer';
type SortDir = 'asc' | 'desc';

interface Row {
  season: string;
  short: string;
  mp: number | null;
  gls: number | null;
  gfPerMp: number | null;
  xg: number | null;
  xgPerMp: number | null;
  /** Apples-to-apples finishing delta (PL goals minus PL xG) */
  xgDiff: number | null;
  sh: number | null;
  shPerMp: number | null;
  sot: number | null;
  sotPerMp: number | null;
  sotPct: number | null;
  gPerSh: number | null;
  gPerSot: number | null;
  pk: number | null;
  pkatt: number | null;
  topScorer: string | null;
}

const intFmt = (v: unknown) => fmt(Number(v), 0);
const decFmt = (v: unknown) => fmt(Number(v), 2);
const pctFmt = (v: unknown) => pct(Number(v), 2);

function AttackChartTooltip({
  active,
  payload,
  label,
}: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-3 shadow-md">
      <p className="mb-1.5 border-b border-border pb-1 font-display text-xs font-bold text-primary">
        {label}
      </p>
      <div className="flex flex-col gap-1">
        {payload.map((entry, idx) => {
          const v = entry.value;
          const dk = String(entry.dataKey ?? '');
          let text = '—';
          if (typeof v === 'number' && !Number.isNaN(v)) {
            if (dk === 'sotPct') {
              text = pct(v, 2);
            } else if (dk === 'gls' || dk === 'sh' || dk === 'sot') {
              text = fmt(v, 0);
            } else {
              text = fmt(v, 2);
            }
          }
          return (
            <div
              key={idx}
              className="flex items-center justify-between gap-4 text-xs"
            >
              <span className="flex items-center gap-1.5 text-secondary">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: entry.color }}
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

function ChartCard({
  eyebrow,
  title,
  legend,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  legend?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
            {eyebrow}
          </p>
          <h3 className="mt-0.5 font-display text-base font-bold tracking-tight text-primary sm:text-lg">
            {title}
          </h3>
          {legend && <div className="mt-1.5 flex flex-wrap items-center gap-3">{legend}</div>}
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

export function AttackDashboard({
  teamStats,
}: {
  teamStats: TeamStatsBySeason;
}) {
  const { t, lang } = useI18n();
  const { club } = useClub();
  const { rows } = useClubData();
  const th = lang === 'th';
  const tx = (en: string, thText: string) => (th ? thText : en);
  const clubName = th && club.nameTh ? club.nameTh : club.name;

  const [group, setGroup] = useState<CompGroup>('all');
  const [perMatch, setPerMatch] = useState(true);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: 'season',
    dir: 'desc',
  });
  const [lbl, setLbl] = useState<Record<string, boolean>>({});
  const lblOn = (k: string) => !!lbl[k];
  const toggleLbl = (k: string) => setLbl((p) => ({ ...p, [k]: !p[k] }));

  const data = useMemo<Row[]>(() => {
    const groupMap = new Map(
      rowsForGroup(rows, group).map((r) => [r.season, r]),
    );
    const plMap = new Map(
      rows
        .filter((r) => r.competition === 'Premier League')
        .map((r) => [r.season, r]),
    );
    return teamStatsForGroup(teamStats, group).map((a) => {
      const xgRow =
        group === 'all' ? plMap.get(a.season) : groupMap.get(a.season);
      const mp = a.mp || null;
      const covered = a.mp > 0 && a.shN / a.mp >= 0.5;
      const xg = xgRow?.xg ?? null;
      const xgGf = xgRow?.gf ?? null;
      return {
        season: a.season,
        short: seasonShort(a.season),
        mp,
        gls: a.gls,
        gfPerMp: a.gls != null && mp ? a.gls / mp : null,
        xg,
        xgPerMp: xg != null && xgRow?.mp ? xg / xgRow.mp : null,
        xgDiff: xg != null && xgGf != null ? xgGf - xg : null,
        sh: covered ? a.sh : null,
        shPerMp: covered && a.sh != null && a.shN ? a.sh / a.shN : null,
        sot: covered ? a.sot : null,
        sotPerMp: covered && a.sot != null && a.shN ? a.sot / a.shN : null,
        sotPct: covered && a.sot != null && a.sh ? a.sot / a.sh : null,
        gPerSh: covered && a.gls != null && a.sh ? a.gls / a.sh : null,
        gPerSot: covered && a.gls != null && a.sot ? a.gls / a.sot : null,
        pk: a.pk,
        pkatt: a.pkatt,
        topScorer: groupMap.get(a.season)?.topScorer ?? null,
      };
    });
  }, [teamStats, rows, group]);

  const bestSeasonKey = useMemo(() => {
    const eligible = data.filter((r) => r.gfPerMp != null && (r.mp ?? 0) >= 5);
    const pool = eligible.length ? eligible : data.filter((r) => r.gfPerMp != null);
    if (!pool.length) return null;
    return pool.reduce((best, r) =>
      (r.gfPerMp ?? -Infinity) > (best.gfPerMp ?? -Infinity) ? r : best,
    ).season;
  }, [data]);

  const sorted = useMemo(() => {
    const val = (r: Row): number | string | null => {
      if (sort.key === 'season') return r.season;
      if (sort.key === 'topScorer') return r.topScorer;
      return r[sort.key];
    };
    const copy = [...data];
    copy.sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      const an =
        av == null
          ? sort.key === 'season' || sort.key === 'topScorer'
            ? ''
            : -Infinity
          : av;
      const bn =
        bv == null
          ? sort.key === 'season' || sort.key === 'topScorer'
            ? ''
            : -Infinity
          : bv;
      const cmp =
        typeof an === 'number' && typeof bn === 'number'
          ? an - bn
          : String(an).localeCompare(String(bn));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [data, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc',
    }));

  const axisTick = { fill: 'var(--text-muted)', fontSize: 11 };
  const gridStroke = 'var(--border-light)';

  const latest = data[data.length - 1] ?? null;
  const firstSeason = data[0]?.short;
  const lastSeason = latest?.short;

  const xgDiff = latest?.xgDiff ?? null;
  const xgDiffTone =
    xgDiff == null
      ? 'text-muted'
      : xgDiff > 0
        ? 'text-success'
        : xgDiff < 0
          ? 'text-danger'
          : 'text-primary';

  const pkConv =
    latest?.pk != null && latest?.pkatt && latest.pkatt > 0
      ? latest.pk / latest.pkatt
      : null;
  const nonPkGoals =
    latest?.gls != null && latest?.pk != null
      ? Math.max(0, latest.gls - latest.pk)
      : null;
  const nonPkShare =
    nonPkGoals != null && latest?.gls && latest.gls > 0
      ? nonPkGoals / latest.gls
      : null;

  const kpiCards = [
    {
      key: 'gf',
      label: perMatch ? t('attack.kpi.gfPerMp') : tx('Goals Scored', 'ประตูที่ทำได้'),
      value: perMatch
        ? fmt(latest?.gfPerMp ?? null, 2)
        : fmt(latest?.gls ?? null, 0),
      sub:
        latest?.mp != null
          ? perMatch
            ? `${fmt(latest.gls, 0)} ${tx('goals', 'ประตู')} · ${fmt(latest.mp, 0)} MP`
            : `${fmt(latest.gfPerMp, 2)} / MP · ${fmt(latest.mp, 0)} MP`
          : '—',
      accent: 'var(--brand)',
      tone: 'text-primary',
      badge: null as string | null,
    },
    {
      key: 'xg',
      label: perMatch ? 'xG / MP' : tx('Expected Goals (xG)', 'ประตูคาดหวัง (xG)'),
      value: perMatch
        ? fmt(latest?.xgPerMp ?? null, 2)
        : fmt(latest?.xg ?? null, 2),
      sub:
        latest?.xg != null
          ? perMatch
            ? `${tx('Total', 'รวม')} ${fmt(latest.xg, 2)} xG`
            : `${fmt(latest.xgPerMp, 2)} xG / MP`
          : tx('Premier League only', 'เฉพาะพรีเมียร์ลีก'),
      accent: 'var(--info)',
      tone: 'text-primary',
      badge: group === 'all' && latest?.xg != null ? 'PL' : null,
    },
    {
      key: 'xgDiff',
      label: tx('Finishing (G − xG)', 'ความคม (ประตู − xG)'),
      value: xgDiff != null ? signed(xgDiff, 2) : '—',
      sub:
        xgDiff == null
          ? tx('Premier League only', 'เฉพาะพรีเมียร์ลีก')
          : xgDiff > 0
            ? tx('Clinical · above xG', 'คมกว่าค่าคาดหวัง')
            : xgDiff < 0
              ? tx('Below expected xG', 'ต่ำกว่าค่าคาดหวัง')
              : tx('On expected pace', 'ตรงตามค่าคาดหวัง'),
      accent:
        xgDiff == null
          ? 'var(--brand)'
          : xgDiff >= 0
            ? 'var(--success)'
            : 'var(--danger)',
      tone: xgDiffTone,
      badge: group === 'all' && xgDiff != null ? 'PL' : null,
    },
    {
      key: 'sh',
      label: perMatch ? t('attack.kpi.shPerMp') : tx('Total Shots', 'โอกาสยิงทั้งหมด'),
      value: perMatch
        ? fmt(latest?.shPerMp ?? null, 2)
        : fmt(latest?.sh ?? null, 0),
      sub:
        latest?.sot != null
          ? perMatch
            ? `${fmt(latest.sotPerMp, 2)} SoT/MP · ${fmt(latest.sh, 0)} Sh`
            : `${fmt(latest.sot, 0)} SoT · ${fmt(latest.shPerMp, 2)} Sh/MP`
          : '—',
      accent: 'var(--brand)',
      tone: 'text-primary',
      badge: null,
    },
    {
      key: 'conv',
      label: t('attack.kpi.gPerSh'),
      value: fmt(latest?.gPerSh ?? null, 2),
      sub:
        latest?.sotPct != null
          ? `SoT% ${pct(latest.sotPct, 2)} · G/SoT ${fmt(latest.gPerSot, 2)}`
          : '—',
      accent: '#0d9488',
      tone: 'text-primary',
      badge: null,
    },
  ];

  const TIP: Partial<Record<SortKey, string>> = {
    season: t('colTip.season'),
    mp: t('colTip.mp'),
    gls: t('colTip.gls'),
    gfPerMp: t('colTip.gfPerMp'),
    xg: t('colTip.xg'),
    xgDiff: t('colTip.gfMinusXg'),
    sh: t('colTip.sh'),
    sot: t('colTip.sot'),
    sotPct: t('colTip.sotPct'),
    gPerSh: t('colTip.gPerSh'),
    pk: t('colTip.pk'),
    pkatt: t('colTip.pkatt'),
    topScorer: t('colTip.topScorer'),
  };

  const columns: { key: SortKey; label: string; align: 'left' | 'right' }[] = [
    { key: 'season', label: t('attack.table.season'), align: 'left' },
    { key: 'mp', label: 'MP', align: 'right' },
    { key: 'gls', label: 'Gls', align: 'right' },
    { key: 'gfPerMp', label: 'GF/MP', align: 'right' },
    { key: 'xg', label: 'xG', align: 'right' },
    { key: 'xgDiff', label: 'G−xG', align: 'right' },
    { key: 'sh', label: 'Sh', align: 'right' },
    { key: 'sot', label: 'SoT', align: 'right' },
    { key: 'sotPct', label: 'SoT%', align: 'right' },
    { key: 'gPerSh', label: 'G/Sh', align: 'right' },
    { key: 'pk', label: 'PK', align: 'right' },
    { key: 'pkatt', label: 'PKatt', align: 'right' },
    { key: 'topScorer', label: t('attack.table.topScorer'), align: 'left' },
  ];

  const sotBarWidth =
    latest?.sotPct != null ? Math.min(100, Math.max(4, latest.sotPct * 100)) : 0;
  const gShBarWidth =
    latest?.gPerSh != null ? Math.min(100, Math.max(4, latest.gPerSh * 100)) : 0;

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-7 px-4 pb-16 pt-6 sm:px-6 lg:px-10">
      {/* -------------------------------------------------- Editorial Masthead */}
      <header className="flex flex-col gap-4 border-b border-border pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface p-2 shadow-sm dark:shadow-none">
              <ClubCrest slug={club.slug} size={32} alt={clubName} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                <span>{tx('Attacking Analytics', 'วิเคราะห์เกมรุก')}</span>
                <span className="text-border">•</span>
                <span className="text-secondary">{clubName}</span>
                {firstSeason && lastSeason && (
                  <>
                    <span className="text-border">•</span>
                    <span className="rounded-md bg-brand-soft px-2 py-0.5 text-[10px] font-bold tabular-nums text-brand">
                      {lastSeason}
                    </span>
                  </>
                )}
              </div>
              <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-primary sm:text-3xl">
                {t('attack.title')}
              </h1>
              <p className="mt-1 max-w-3xl text-xs text-muted">{t('attack.note')}</p>
            </div>
          </div>

          {/* Totals vs Per-Match Toggle */}
          <div className="inline-flex shrink-0 self-start rounded-xl border border-border bg-surface p-1 text-xs font-bold">
            <button
              type="button"
              aria-pressed={!perMatch}
              onClick={() => setPerMatch(false)}
              className={`rounded-lg px-3 py-1.5 transition-colors ${
                !perMatch
                  ? 'bg-primary text-surface'
                  : 'text-muted hover:text-primary'
              }`}
            >
              {t('defense.totals')}
            </button>
            <button
              type="button"
              aria-pressed={perMatch}
              onClick={() => setPerMatch(true)}
              className={`rounded-lg px-3 py-1.5 transition-colors ${
                perMatch
                  ? 'bg-primary text-surface'
                  : 'text-muted hover:text-primary'
              }`}
            >
              {t('defense.perMatch')}
            </button>
          </div>
        </div>

        <div className="-mb-2">
          <CompetitionTabs group={group} onChange={setGroup} />
        </div>
      </header>

      {/* -------------------------------------------------- Attack KPI Ribbon */}
      <section className="flex min-w-0 flex-col gap-4">
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 lg:grid-cols-5">
          {kpiCards.map((k) => (
            <div
              key={k.key}
              className="relative flex min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface p-4"
            >
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-[2.5px]"
                style={{ background: k.accent }}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[11px] font-bold uppercase tracking-wider text-muted">
                  {k.label}
                </span>
                {k.badge && (
                  <span className="shrink-0 rounded bg-bg-secondary px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-muted">
                    {k.badge}
                  </span>
                )}
              </div>
              <span
                className={`mt-2.5 font-display text-2xl font-extrabold tabular-nums sm:text-3xl ${k.tone}`}
              >
                {k.value}
              </span>
              <span className="mt-1.5 truncate text-xs tabular-nums text-muted">
                {k.sub}
              </span>
            </div>
          ))}
        </div>

        {/* Shot Conversion Funnel + Penalty Breakdown */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Shot Conversion Funnel */}
          <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5 lg:col-span-8">
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Target size={15} className="text-brand" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                    {tx('Shot Conversion Funnel', 'เส้นทางการเปลี่ยนโอกาสเป็นประตู')}
                  </p>
                  <h2 className="font-display text-sm font-bold text-primary sm:text-base">
                    {tx(
                      `Shots → On Target → Goals (${lastSeason ?? '—'})`,
                      `โอกาสยิง → ตรงกรอบ → ประตู (${lastSeason ?? '—'})`,
                    )}
                  </h2>
                </div>
              </div>
              {latest?.gPerSot != null && (
                <span className="rounded-lg bg-bg-secondary px-2.5 py-1 text-xs font-semibold tabular-nums text-secondary">
                  G/SoT: <strong className="text-primary">{fmt(latest.gPerSot, 2)}</strong>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* Step 1: Shots */}
              <div className="rounded-xl border border-border bg-bg-secondary/50 p-3">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted">
                  <span>1. {tx('Shots', 'ยิงทั้งหมด')}</span>
                  <span className="tabular-nums text-secondary">100.00%</span>
                </div>
                <div className="mt-1.5 flex items-baseline justify-between gap-2">
                  <span className="font-display text-2xl font-extrabold tabular-nums text-primary">
                    {fmt(latest?.sh ?? null, 0)}
                  </span>
                  <span className="text-xs tabular-nums text-muted">
                    {fmt(latest?.shPerMp ?? null, 2)} / MP
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: latest?.sh ? '100%' : '0%',
                      background: 'var(--brand)',
                    }}
                  />
                </div>
              </div>

              {/* Step 2: On Target */}
              <div className="rounded-xl border border-border bg-bg-secondary/50 p-3">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted">
                  <span>2. {tx('On Target', 'ตรงกรอบ')}</span>
                  <span className="tabular-nums font-bold text-[#0d9488]">
                    {latest?.sotPct != null ? pct(latest.sotPct, 2) : '—'}
                  </span>
                </div>
                <div className="mt-1.5 flex items-baseline justify-between gap-2">
                  <span className="font-display text-2xl font-extrabold tabular-nums text-primary">
                    {fmt(latest?.sot ?? null, 0)}
                  </span>
                  <span className="text-xs tabular-nums text-muted">
                    {fmt(latest?.sotPerMp ?? null, 2)} / MP
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-[#0d9488]"
                    style={{ width: `${sotBarWidth}%` }}
                  />
                </div>
              </div>

              {/* Step 3: Goals */}
              <div className="rounded-xl border border-border bg-bg-secondary/50 p-3">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted">
                  <span>3. {tx('Goals', 'ประตู')}</span>
                  <span className="tabular-nums font-bold text-success">
                    {latest?.gPerSh != null ? `${fmt(latest.gPerSh, 2)} G/Sh` : '—'}
                  </span>
                </div>
                <div className="mt-1.5 flex items-baseline justify-between gap-2">
                  <span className="font-display text-2xl font-extrabold tabular-nums text-primary">
                    {fmt(latest?.gls ?? null, 0)}
                  </span>
                  <span className="text-xs tabular-nums text-muted">
                    {fmt(latest?.gfPerMp ?? null, 2)} / MP
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-success"
                    style={{ width: `${gShBarWidth}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Penalty Breakdown */}
          <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-4 sm:p-5 lg:col-span-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Crosshair size={15} className="text-brand" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                    {tx('Spot-Kick Split', 'สัดส่วนจุดโทษ')}
                  </p>
                  <h2 className="font-display text-sm font-bold text-primary sm:text-base">
                    {tx('Penalty Breakdown', 'สถิติจุดโทษ')}
                  </h2>
                </div>
              </div>
              {pkConv != null && (
                <span className="rounded-lg bg-brand-soft px-2 py-0.5 text-xs font-bold tabular-nums text-brand">
                  {pct(pkConv, 2)}
                </span>
              )}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-border bg-bg-secondary/50 px-2.5 py-2 text-center">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">
                  PK
                </span>
                <span className="mt-0.5 block font-display text-xl font-extrabold tabular-nums text-primary">
                  {fmt(latest?.pk ?? null, 0)}
                </span>
              </div>
              <div className="rounded-xl border border-border bg-bg-secondary/50 px-2.5 py-2 text-center">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">
                  PKatt
                </span>
                <span className="mt-0.5 block font-display text-xl font-extrabold tabular-nums text-primary">
                  {fmt(latest?.pkatt ?? null, 0)}
                </span>
              </div>
              <div className="rounded-xl border border-border bg-bg-secondary/50 px-2.5 py-2 text-center">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">
                  npG
                </span>
                <span className="mt-0.5 block font-display text-xl font-extrabold tabular-nums text-primary">
                  {fmt(nonPkGoals, 0)}
                </span>
              </div>
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] text-muted">
                <span>{tx('Open-play / non-PK share', 'สัดส่วนประตูไม่รวมจุดโทษ')}</span>
                <span className="font-semibold tabular-nums text-secondary">
                  {nonPkShare != null ? pct(nonPkShare, 2) : '—'}
                </span>
              </div>
              <div className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-border">
                <div
                  className="h-full bg-info"
                  style={{
                    width: nonPkShare != null ? `${nonPkShare * 100}%` : '0%',
                  }}
                />
                <div
                  className="h-full"
                  style={{
                    width: nonPkShare != null ? `${(1 - nonPkShare) * 100}%` : '0%',
                    background: 'var(--brand)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- Season Pace */}
      <SeasonPace side="attack" />

      {/* -------------------------------------------------- Charts */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard
          eyebrow={tx('Scoring Trajectory', 'แนวโน้มการทำประตู')}
          title={
            perMatch
              ? t('attack.chart.goals')
              : tx('Total Goals & xG by Season', 'ประตูรวมและ xG รายฤดูกาล')
          }
          legend={
            <>
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: 'var(--brand)' }}
                />
                {perMatch ? 'GF/MP' : 'Gls'}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: 'var(--info)' }}
                />
                {perMatch ? 'xG/MP' : 'xG'}
              </span>
            </>
          }
          action={
            <LabelsBtn
              on={lblOn('goals')}
              onClick={() => toggleLbl('goals')}
            />
          }
        >
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart
              data={data}
              margin={{ top: 10, right: 12, bottom: 8, left: 0 }}
            >
              <CartesianGrid
                stroke={gridStroke}
                strokeDasharray="3 3"
                vertical={false}
              />
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
                width={38}
              />
              <Tooltip content={(props) => <AttackChartTooltip {...props} />} />
              <Area
                type="monotone"
                dataKey={perMatch ? 'gfPerMp' : 'gls'}
                name={perMatch ? 'GF/MP' : 'Gls'}
                stroke="var(--brand)"
                strokeWidth={2.2}
                fill="var(--brand)"
                fillOpacity={0.14}
                isAnimationActive={false}
                connectNulls
              >
                {lblOn('goals') && (
                  <LabelList
                    dataKey={perMatch ? 'gfPerMp' : 'gls'}
                    position="top"
                    fontSize={10}
                    fill="var(--text-muted)"
                    formatter={perMatch ? decFmt : intFmt}
                  />
                )}
              </Area>
              <Line
                type="monotone"
                dataKey={perMatch ? 'xgPerMp' : 'xg'}
                name={perMatch ? 'xG/MP' : 'xG'}
                stroke="var(--info)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: 'var(--info)' }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
                connectNulls
              >
                {lblOn('goals') && (
                  <LabelList
                    dataKey={perMatch ? 'xgPerMp' : 'xg'}
                    position="bottom"
                    fontSize={10}
                    fill="var(--text-muted)"
                    formatter={decFmt}
                  />
                )}
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          eyebrow={tx('Shot Volume & Precision', 'ปริมาณและความแม่นยำการยิง')}
          title={
            perMatch
              ? t('attack.chart.shots')
              : tx('Total Shots & Accuracy by Season', 'จำนวนยิงรวมและความแม่นยำรายฤดูกาล')
          }
          legend={
            <>
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: 'var(--brand)' }}
                />
                {perMatch ? 'Sh/MP' : 'Sh'}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <span className="inline-block h-2 w-2 rounded-full bg-[#0d9488]" />
                SoT%
              </span>
            </>
          }
          action={
            <LabelsBtn
              on={lblOn('shots')}
              onClick={() => toggleLbl('shots')}
            />
          }
        >
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart
              data={data}
              margin={{ top: 10, right: 16, bottom: 8, left: 0 }}
            >
              <CartesianGrid
                stroke={gridStroke}
                strokeDasharray="3 3"
                vertical={false}
              />
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
                width={38}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={axisTick}
                axisLine={false}
                tickLine={false}
                width={44}
                domain={[0, 1]}
                tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
              />
              <Tooltip content={(props) => <AttackChartTooltip {...props} />} />
              <Area
                type="monotone"
                dataKey={perMatch ? 'shPerMp' : 'sh'}
                name={perMatch ? 'Sh/MP' : 'Sh'}
                stroke="var(--brand)"
                strokeWidth={2.2}
                fill="var(--brand)"
                fillOpacity={0.14}
                isAnimationActive={false}
                connectNulls
              >
                {lblOn('shots') && (
                  <LabelList
                    dataKey={perMatch ? 'shPerMp' : 'sh'}
                    position="top"
                    fontSize={10}
                    fill="var(--text-muted)"
                    formatter={perMatch ? decFmt : intFmt}
                  />
                )}
              </Area>
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="sotPct"
                name="SoT%"
                stroke="#0d9488"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#0d9488' }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
                connectNulls
              >
                {lblOn('shots') && (
                  <LabelList
                    dataKey="sotPct"
                    position="top"
                    fontSize={10}
                    fill="var(--text-muted)"
                    formatter={pctFmt}
                  />
                )}
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      {/* -------------------------------------------------- Season Attack Table */}
      <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
              {tx('Season Ledger', 'ตารางสถิติรายฤดูกาล')}
            </p>
            <h3 className="mt-0.5 font-display text-lg font-bold tracking-tight text-primary">
              {t('attack.table.title')}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            {bestSeasonKey && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-bold text-brand">
                <Award size={12} />
                {tx('Peak GF/MP:', 'ยิงสูงสุด/นัด:')} {seasonShort(bestSeasonKey)}
              </span>
            )}
            <span className="rounded-full bg-bg-secondary px-2.5 py-1 text-[11px] font-semibold tabular-nums text-secondary">
              {sorted.length} {tx('seasons', 'ฤดูกาล')}
            </span>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[1080px] border-collapse">
            <thead className="sticky top-0 z-10 bg-surface-elevated">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    title={TIP[col.key]}
                    onClick={() => toggleSort(col.key)}
                    className={`cursor-pointer select-none whitespace-nowrap border-b border-border px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-muted transition-colors hover:bg-bg-secondary ${
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
                          <ArrowUp size={13} className="text-brand" />
                        ) : (
                          <ArrowDown size={13} className="text-brand" />
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
              {sorted.map((r) => {
                const isBest = r.season === bestSeasonKey;
                return (
                  <tr
                    key={r.season}
                    className="border-b border-border transition-colors hover:bg-bg-secondary"
                    style={isBest ? { background: 'var(--brand-soft)' } : undefined}
                  >
                    <td className="whitespace-nowrap px-3 py-3 text-sm font-semibold text-primary">
                      <span className="inline-flex items-center gap-1.5 tabular-nums">
                        {r.season}
                        {isBest && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-brand px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-surface">
                            <Flame size={10} />
                            {tx('Best', 'เด่น')}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums text-secondary">
                      {fmt(r.mp, 0)}
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-bold tabular-nums text-primary">
                      {fmt(r.gls, 0)}
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-semibold tabular-nums text-primary">
                      {fmt(r.gfPerMp, 2)}
                    </td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums text-secondary">
                      {fmt(r.xg, 2)}
                    </td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums">
                      {r.xgDiff != null ? (
                        <span
                          className={`inline-block rounded-md px-2 py-0.5 text-xs font-bold ${
                            r.xgDiff > 0
                              ? 'bg-success-soft text-success'
                              : r.xgDiff < 0
                                ? 'bg-danger-soft text-danger'
                                : 'bg-bg-secondary text-muted'
                          }`}
                        >
                          {signed(r.xgDiff, 2)}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums text-secondary">
                      {fmt(r.sh, 0)}
                    </td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums text-secondary">
                      {fmt(r.sot, 0)}
                    </td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums text-secondary">
                      {r.sotPct != null ? pct(r.sotPct, 2) : '—'}
                    </td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums text-secondary">
                      {fmt(r.gPerSh, 2)}
                    </td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums text-secondary">
                      {fmt(r.pk, 0)}
                    </td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums text-secondary">
                      {fmt(r.pkatt, 0)}
                    </td>
                    <td className="px-3 py-3 text-sm text-secondary">
                      <span
                        className="block max-w-[170px] truncate"
                        title={r.topScorer ?? undefined}
                      >
                        {dash(r.topScorer)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* -------------------------------------------------- Shooting Matchlog */}
      <section className="flex min-w-0 flex-col gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
            {tx('Match-by-Match Shooting Log', 'บันทึกสถิติการยิงรายนัด')}
          </p>
          <h3 className="mt-0.5 font-display text-lg font-bold tracking-tight text-primary">
            {tx('Shooting Matchlog Browser', 'สำรวจบันทึกการยิงแต่ละนัด')}
          </h3>
        </div>
        <MatchlogPanel
          type="shooting"
          titleKey="matchLog.tabs.shooting"
          group={group}
        />
      </section>
    </main>
  );
}
