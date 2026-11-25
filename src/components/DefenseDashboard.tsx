'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Shield,
  Award,
  Sparkles,
} from 'lucide-react';
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
  LabelList,
} from 'recharts';
import { useI18n } from '@/i18n/I18nContext';
import type {
  CompGroup,
  KeepersData,
  GkSeasonRow,
  TeamStatsBySeason,
} from '@/lib/types';
import {
  mergedGkRows,
  rowsForGroup,
  seasonShort,
  teamStatsForGroup,
} from '@/lib/stats';
import { fmt, pct, signed, dash } from '@/lib/format';
import { useClub, useClubData } from './ClubProvider';
import { ClubCrest } from './LeagueHome';
import { loadKeepersSeason, LOAD_FAILED } from './matchlog-shared';
import { CompetitionTabs } from './CompetitionTabs';
import { MatchlogPanel } from './MatchlogBrowser';
import { SeasonPace } from './SeasonPace';
import { LabelsBtn } from './LabelsBtn';
import { ShareBtn } from './ShareBtn';

type SortKey =
  | 'season'
  | 'player'
  | 'mp'
  | 'ga'
  | 'sota'
  | 'saves'
  | 'savePct'
  | 'cs';
type DefSortKey =
  | 'season'
  | 'mp'
  | 'ga'
  | 'gaPerMp'
  | 'xga'
  | 'xgaDiff'
  | 'shA'
  | 'sota'
  | 'saves'
  | 'savePct'
  | 'cs'
  | 'csPct';
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
  /** Positive = defensive overperformance (conceded fewer than xGA: xGA - GA) */
  xgaDiff: number | null;
  shA: number | null;
  shAPerMp: number | null;
  sota: number | null;
  sotaPerMp: number | null;
  saves: number | null;
  savesPerMp: number | null;
  savePct: number | null;
  cs: number | null;
  csPct: number | null;
  kN: number;
}

const intFmt = (v: unknown) => fmt(Number(v), 0);
const decFmt = (v: unknown) => fmt(Number(v), 2);
const pctFmt = (v: unknown) => pct(Number(v), 2);
const signedDecFmt = (v: unknown) => signed(Number(v), 2);

function DefenseChartTooltip({
  active,
  payload,
  label,
  labelOf,
}: TooltipContentProps & { labelOf: (key: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-3 shadow-md">
      <p className="mb-1.5 border-b border-border pb-1 font-display text-xs font-bold text-primary">
        {label}
      </p>
      <div className="flex flex-col gap-1">
        {payload.map((entry, idx) => {
          const value = entry.value;
          const dataKey = String(entry.dataKey ?? '');
          let text = '—';
          if (typeof value === 'number' && !Number.isNaN(value)) {
            if (dataKey === 'savePct' || dataKey === 'csPct') {
              text = pct(value, 2);
            } else if (dataKey === 'psxgPlusMinus') {
              text = signed(value, 2);
            } else if (
              dataKey.endsWith('PerMp') ||
              dataKey === 'xga' ||
              dataKey === 'psxg'
            ) {
              text = fmt(value, 2);
            } else {
              text = fmt(value, 0);
            }
          }
          const color = entry.color ?? 'var(--text-muted)';
          return (
            <div
              key={idx}
              className="flex items-center justify-between gap-4 text-xs"
            >
              <span className="flex items-center gap-1.5 text-secondary">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="font-medium">{labelOf(dataKey)}</span>
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
  note,
  legend,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  note?: ReactNode;
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
          {legend && (
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              {legend}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {action}
          <ShareBtn />
        </div>
      </div>
      {note}
      {children}
    </div>
  );
}

function saveBarColor(ratio: number | null): string {
  if (ratio == null) return 'var(--border)';
  if (ratio >= 0.74) return 'var(--success)';
  if (ratio >= 0.67) return 'var(--info)';
  return 'var(--warning)';
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
  const { t, lang } = useI18n();
  const { club } = useClub();
  const { rows } = useClubData();
  const th = lang === 'th';
  const tx = (en: string, thText: string) => (th ? thText : en);
  const clubName = th && club.nameTh ? club.nameTh : club.name;

  const [group, setGroup] = useState<CompGroup>('all');
  const [extra, setExtra] = useState<KeepersData[]>([]);
  const [lazyLoading, setLazyLoading] = useState(
    () => (lazySeasons?.length ?? 0) > 0,
  );

  useEffect(() => {
    if (!lazySeasons?.length) return;
    let live = true;
    Promise.all(
      lazySeasons.map((s) => loadKeepersSeason(club.slug, s)),
    ).then((results) => {
      if (!live) return;
      setExtra(
        results.filter(
          (r): r is KeepersData => r != null && r !== LOAD_FAILED,
        ),
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

  const { perGkSeason, psxg, psxgPerGk, perGkComp } = merged;

  const gkRows = useMemo(() => {
    if (group === 'all') return { rows: perGkSeason, fallback: false };
    const m = mergedGkRows(perGkComp ?? [], group);
    return m.length
      ? { rows: m, fallback: false }
      : { rows: perGkSeason, fallback: true };
  }, [group, perGkSeason, perGkComp]);

  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: 'season',
    dir: 'desc',
  });
  const [defSort, setDefSort] = useState<{ key: DefSortKey; dir: SortDir }>({
    key: 'season',
    dir: 'desc',
  });
  const [perMatch, setPerMatch] = useState(true);
  const [lbl, setLbl] = useState<Record<string, boolean>>({});
  const lblOn = (k: string) => !!lbl[k];
  const toggleLbl = (k: string) => setLbl((p) => ({ ...p, [k]: !p[k] }));

  const defRows = useMemo<DefRow[]>(() => {
    const groupMap = new Map(
      rowsForGroup(rows, group).map((r) => [r.season, r]),
    );
    const plMap = new Map(
      rows
        .filter((r) => r.competition === 'Premier League')
        .map((r) => [r.season, r]),
    );
    return teamStatsForGroup(teamStats, group).map((r) => {
      const xgaRow =
        group === 'all' ? plMap.get(r.season) : groupMap.get(r.season);
      const shCovered = r.mp > 0 && r.shAN / r.mp >= 0.5;
      const kCovered = r.mp > 0 && r.kN / r.mp >= 0.5;
      const xga = xgaRow?.xga ?? null;
      const xgaGa = xgaRow?.ga ?? null;
      return {
        season: r.season,
        short: seasonShort(r.season),
        mp: r.mp,
        ga: r.ga,
        gaPerMp: r.ga != null && r.mp ? r.ga / r.mp : null,
        xga,
        xgaPerMp: xga != null && xgaRow?.mp ? xga / xgaRow.mp : null,
        xgaDiff: xga != null && xgaGa != null ? xga - xgaGa : null,
        shA: shCovered ? r.shA : null,
        shAPerMp:
          shCovered && r.shA != null && r.shAN ? r.shA / r.shAN : null,
        sota: kCovered ? r.sota : null,
        sotaPerMp:
          kCovered && r.sota != null && r.kN ? r.sota / r.kN : null,
        saves: kCovered ? r.saves : null,
        savesPerMp:
          kCovered && r.saves != null && r.kN ? r.saves / r.kN : null,
        savePct:
          kCovered && r.saves != null && r.sota ? r.saves / r.sota : null,
        cs: r.cs,
        csPct: r.cs != null && r.kN ? r.cs / r.kN : null,
        kN: r.kN,
      };
    });
  }, [teamStats, rows, group]);

  const latestSeason = defRows[defRows.length - 1] ?? null;
  const bestDefSeasonKey = useMemo(() => {
    const eligible = defRows.filter((r) => r.gaPerMp != null && r.mp >= 5);
    const pool = eligible.length
      ? eligible
      : defRows.filter((r) => r.gaPerMp != null);
    if (!pool.length) return null;
    return pool.reduce((best, r) =>
      (r.gaPerMp ?? Infinity) < (best.gaPerMp ?? Infinity) ? r : best,
    ).season;
  }, [defRows]);

  const latestPsxg = useMemo(() => {
    const valid = psxg
      .filter((r) => r.psxg != null && r.psxgPlusMinus != null)
      .sort((a, b) => a.season.localeCompare(b.season));
    return valid[valid.length - 1] ?? null;
  }, [psxg]);

  // PSxG maps by (season|player) and cumulative per player
  const psxgBySeasonPlayer = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of psxgPerGk ?? []) {
      if (r.psxgPlusMinus != null) {
        map.set(`${r.season}|${r.player}`, r.psxgPlusMinus);
      }
    }
    return map;
  }, [psxgPerGk]);

  const psxgByPlayer = useMemo(() => {
    const map = new Map<string, { total: number; seasons: number }>();
    for (const r of psxgPerGk ?? []) {
      if (r.psxgPlusMinus == null) continue;
      const cur = map.get(r.player) ?? { total: 0, seasons: 0 };
      cur.total += r.psxgPlusMinus;
      cur.seasons += 1;
      map.set(r.player, cur);
    }
    return map;
  }, [psxgPerGk]);

  const perGk = useMemo(() => {
    const groups = new Map<string, GkSeasonRow[]>();
    for (const r of gkRows.rows) {
      const arr = groups.get(r.player) ?? [];
      arr.push(r);
      groups.set(r.player, arr);
    }
    const out = Array.from(groups.entries()).map(([player, list]) => {
      const sota = sum(list.map((r) => r.sota));
      const saves = sum(list.map((r) => r.saves));
      const ga = sum(list.map((r) => r.ga));
      const cs = sum(list.map((r) => r.cs));
      const mp = sum(list.map((r) => r.mp));
      const savePct = sota > 0 ? saves / sota : null;
      const csPct = mp > 0 ? cs / mp : null;
      const psxgAgg = psxgByPlayer.get(player) ?? null;
      return {
        player,
        mp,
        sota,
        saves,
        ga,
        cs,
        savePct,
        csPct,
        sotaPerMp: mp > 0 ? sota / mp : null,
        gaPerMp: mp > 0 ? ga / mp : null,
        psxgPlusMinus: psxgAgg?.total ?? null,
        psxgSeasons: psxgAgg?.seasons ?? 0,
      };
    });
    out.sort((a, b) => b.sota - a.sota || b.mp - a.mp);
    return out;
  }, [gkRows, psxgByPlayer]);

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
    setSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc',
    }));
  };

  const toggleDefSort = (key: DefSortKey) => {
    setDefSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc',
    }));
  };

  const axisTick = { fill: 'var(--text-muted)', fontSize: 11 };
  const gridStroke = 'var(--border-light)';

  const chartLabel = (name: string) => {
    switch (name) {
      case 'sota':
        return t('keepers.sota');
      case 'saves':
        return t('keepers.saves');
      case 'ga':
        return t('keepers.ga');
      case 'xga':
        return 'xGA';
      case 'savePct':
        return t('keepers.savePct');
      case 'psxg':
        return t('keepers.psxg');
      case 'psxgPlusMinus':
        return t('keepers.goalsPrevented');
      case 'sotaPerMp':
        return `${t('keepers.sota')}/MP`;
      case 'savesPerMp':
        return `${t('keepers.saves')}/MP`;
      case 'gaPerMp':
        return `${t('keepers.ga')}/MP`;
      case 'xgaPerMp':
        return 'xGA/MP';
      default:
        return name;
    }
  };

  const xgaDiff = latestSeason?.xgaDiff ?? null;
  const xgaDiffTone =
    xgaDiff == null
      ? 'text-muted'
      : xgaDiff > 0
        ? 'text-success'
        : xgaDiff < 0
          ? 'text-danger'
          : 'text-primary';

  const hasPsxg = latestPsxg != null;
  const psxgVal = latestPsxg?.psxgPlusMinus ?? null;

  const kpiCards = [
    {
      key: 'ga',
      label: perMatch
        ? t('defense.kpi.gaPerMp')
        : tx('Goals Conceded', 'ประตูที่เสีย'),
      value: perMatch
        ? fmt(latestSeason?.gaPerMp ?? null, 2)
        : fmt(latestSeason?.ga ?? null, 0),
      sub:
        latestSeason != null
          ? perMatch
            ? `${fmt(latestSeason.ga, 0)} GA · ${fmt(latestSeason.mp, 0)} MP`
            : `${fmt(latestSeason.gaPerMp, 2)} / MP · ${fmt(latestSeason.mp, 0)} MP`
          : '—',
      accent: 'var(--brand)',
      tone: 'text-primary',
      badge: null as string | null,
    },
    {
      key: 'xga',
      label: perMatch ? 'xGA / MP' : tx('Expected GA (xGA)', 'ประตูเสียคาดหวัง (xGA)'),
      value: perMatch
        ? fmt(latestSeason?.xgaPerMp ?? null, 2)
        : fmt(latestSeason?.xga ?? null, 2),
      sub:
        latestSeason?.xga != null
          ? perMatch
            ? `${tx('Total', 'รวม')} ${fmt(latestSeason.xga, 2)} xGA`
            : `${fmt(latestSeason.xgaPerMp, 2)} xGA / MP`
          : tx('Premier League only', 'เฉพาะพรีเมียร์ลีก'),
      accent: 'var(--info)',
      tone: 'text-primary',
      badge: group === 'all' && latestSeason?.xga != null ? 'PL' : null,
    },
    {
      key: 'overperf',
      label: tx('Def. Overperf (xGA − GA)', 'ป้องกันเกินคาด (xGA − GA)'),
      value: xgaDiff != null ? signed(xgaDiff, 2) : '—',
      sub:
        xgaDiff == null
          ? tx('Premier League only', 'เฉพาะพรีเมียร์ลีก')
          : xgaDiff > 0
            ? tx('Conceded fewer than xGA', 'เสียน้อยกว่าที่คาด')
            : xgaDiff < 0
              ? tx('Conceded more than xGA', 'เสียมากกว่าที่คาด')
              : tx('In line with xGA', 'ใกล้เคียงค่าคาดหวัง'),
      accent:
        xgaDiff == null
          ? 'var(--brand)'
          : xgaDiff >= 0
            ? 'var(--success)'
            : 'var(--danger)',
      tone: xgaDiffTone,
      badge: group === 'all' && xgaDiff != null ? 'PL' : null,
    },
    {
      key: 'cs',
      label: tx('Clean Sheets & CS%', 'คลีนชีต & %'),
      value:
        latestSeason?.csPct != null ? pct(latestSeason.csPct, 2) : '—',
      sub:
        latestSeason?.cs != null
          ? `${fmt(latestSeason.cs, 0)} CS · ${fmt(latestSeason.kN || latestSeason.mp, 0)} MP`
          : '—',
      accent: 'var(--success)',
      tone: 'text-primary',
      badge: null,
    },
    {
      key: 'savePct',
      label: t('defense.kpi.savePct'),
      value:
        latestSeason?.savePct != null ? pct(latestSeason.savePct, 2) : '—',
      sub:
        latestSeason?.saves != null && latestSeason?.sota != null
          ? `${fmt(latestSeason.saves, 0)} / ${fmt(latestSeason.sota, 0)} SoTA`
          : '—',
      accent: '#8b5cf6',
      tone: 'text-primary',
      badge: null,
    },
    hasPsxg
      ? {
          key: 'psxg',
          label: t('defense.kpi.goalsPrevented'),
          value: signed(psxgVal, 2),
          sub: `${seasonShort(latestPsxg.season)} PL · ${tx('Legacy PSxG', 'ข้อมูล PSxG เดิม')}`,
          accent:
            psxgVal != null && psxgVal >= 0 ? 'var(--success)' : 'var(--danger)',
          tone:
            psxgVal == null
              ? 'text-muted'
              : psxgVal > 0
                ? 'text-success'
                : psxgVal < 0
                  ? 'text-danger'
                  : 'text-primary',
          badge: 'PSxG',
        }
      : {
          key: 'sha',
          label: perMatch
            ? t('defense.kpi.shAPerMp')
            : tx('Shots Faced', 'โดนยิงทั้งหมด'),
          value: perMatch
            ? fmt(latestSeason?.shAPerMp ?? null, 2)
            : fmt(latestSeason?.shA ?? null, 0),
          sub:
            latestSeason?.sotaPerMp != null
              ? `${fmt(latestSeason.sotaPerMp, 2)} SoTA/MP`
              : '—',
          accent: '#0d9488',
          tone: 'text-primary',
          badge: null,
        },
  ];

  const DEF_TIP: Partial<Record<DefSortKey, string>> = {
    season: t('colTip.season'),
    mp: t('colTip.mp'),
    ga: t('colTip.ga'),
    gaPerMp: t('colTip.gaPerMp'),
    xga: t('colTip.xga'),
    xgaDiff: tx(
      'Expected goals against minus actual goals against — positive means outperforming xGA',
      'xGA หักลบประตูเสียจริง — บวกหมายถึงเสียน้อยกว่าที่คาด',
    ),
    shA: t('colTip.sha'),
    sota: t('colTip.sota'),
    saves: t('colTip.saves'),
    savePct: t('colTip.savePct'),
    cs: t('colTip.cs'),
    csPct: t('colTip.csPct'),
  };

  const defColumns: {
    key: DefSortKey;
    label: string;
    align: 'left' | 'right';
  }[] = [
    { key: 'season', label: t('defense.table.season'), align: 'left' },
    { key: 'mp', label: 'MP', align: 'right' },
    { key: 'ga', label: 'GA', align: 'right' },
    { key: 'gaPerMp', label: 'GA/MP', align: 'right' },
    { key: 'xga', label: 'xGA', align: 'right' },
    { key: 'xgaDiff', label: 'xGA−GA', align: 'right' },
    { key: 'shA', label: 'ShA', align: 'right' },
    { key: 'sota', label: 'SoTA', align: 'right' },
    { key: 'saves', label: 'Saves', align: 'right' },
    { key: 'savePct', label: 'Save%', align: 'right' },
    { key: 'cs', label: 'CS', align: 'right' },
    { key: 'csPct', label: 'CS%', align: 'right' },
  ];

  const GK_TIP: Partial<Record<SortKey, string>> = {
    season: t('colTip.season'),
    mp: t('colTip.mp'),
    ga: t('colTip.ga'),
    sota: t('colTip.sota'),
    saves: t('colTip.saves'),
    savePct: t('colTip.savePct'),
    cs: t('colTip.cs'),
  };

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
    <p className="mb-3 rounded-lg bg-bg-secondary px-2.5 py-1.5 text-xs text-muted">
      {t('defense.allCompsNote')}
    </p>
  );

  const topKeepers = useMemo(
    () => perGk.filter((k) => k.mp > 0).slice(0, 6),
    [perGk],
  );

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
                <span>
                  {tx(
                    'Defensive & Goalkeeping Analytics',
                    'วิเคราะห์เกมรับและผู้รักษาประตู',
                  )}
                </span>
                <span className="text-border">•</span>
                <span className="text-secondary">{clubName}</span>
                {latestSeason && (
                  <>
                    <span className="text-border">•</span>
                    <span className="rounded-md bg-brand-soft px-2 py-0.5 text-[10px] font-bold tabular-nums text-brand">
                      {latestSeason.short}
                    </span>
                  </>
                )}
                {lazyLoading && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted">
                    <span
                      className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-border border-t-brand"
                      aria-label="loading"
                    />
                    {tx('Loading history', 'กำลังโหลดประวัติ')}
                  </span>
                )}
              </div>
              <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-primary sm:text-3xl">
                {t('defense.title')}
              </h1>
              <p className="mt-1 max-w-3xl text-xs text-muted">
                {t('defense.note')}
              </p>
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

      {/* -------------------------------------------------- Defense & GK KPI Ribbon */}
      <section className="grid grid-cols-2 gap-3.5 md:grid-cols-3 lg:grid-cols-6">
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
      </section>

      {/* -------------------------------------------------- Season Pace */}
      <SeasonPace side="defense" />

      {/* -------------------------------------------------- Defense & GK Charts */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard
          eyebrow={tx('Conceding Trajectory', 'แนวโน้มการเสียประตู')}
          title={
            perMatch
              ? t('defense.chart.gaXga')
              : tx('Total GA & xGA by Season', 'ประตูเสียรวมและ xGA รายฤดูกาล')
          }
          legend={
            <>
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: 'var(--brand)' }}
                />
                {perMatch ? 'GA/MP' : 'GA'}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: 'var(--info)' }}
                />
                {perMatch ? 'xGA/MP' : 'xGA'}
              </span>
            </>
          }
          action={
            <LabelsBtn
              on={lblOn('gaxga')}
              onClick={() => toggleLbl('gaxga')}
            />
          }
        >
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart
              data={defRows}
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
              <Tooltip
                content={(props) => (
                  <DefenseChartTooltip {...props} labelOf={chartLabel} />
                )}
              />
              <Area
                type="monotone"
                dataKey={perMatch ? 'gaPerMp' : 'ga'}
                name={perMatch ? 'gaPerMp' : 'ga'}
                stroke="var(--brand)"
                strokeWidth={2.2}
                fill="var(--brand)"
                fillOpacity={0.14}
                isAnimationActive={false}
                connectNulls
              >
                {lblOn('gaxga') && (
                  <LabelList
                    dataKey={perMatch ? 'gaPerMp' : 'ga'}
                    position="top"
                    fontSize={10}
                    fill="var(--text-muted)"
                    formatter={perMatch ? decFmt : intFmt}
                  />
                )}
              </Area>
              <Line
                type="monotone"
                dataKey={perMatch ? 'xgaPerMp' : 'xga'}
                name={perMatch ? 'xgaPerMp' : 'xga'}
                stroke="var(--info)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: 'var(--info)' }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
                connectNulls
              >
                {lblOn('gaxga') && (
                  <LabelList
                    dataKey={perMatch ? 'xgaPerMp' : 'xga'}
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
          eyebrow={tx('Shot-Stopping Volume', 'ปริมาณการป้องกันประตู')}
          title={t('keepers.chart.bySeason')}
          legend={
            <>
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <span className="inline-block h-2 w-2 rounded-full bg-[#0d9488]" />
                {perMatch ? 'SoTA/MP' : 'SoTA'}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <span className="inline-block h-2 w-2 rounded-full bg-[#8b5cf6]" />
                {perMatch ? 'Saves/MP' : 'Saves'}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: 'var(--danger)' }}
                />
                {perMatch ? 'GA/MP' : 'GA'}
              </span>
            </>
          }
          action={
            <LabelsBtn
              on={lblOn('bySeason')}
              onClick={() => toggleLbl('bySeason')}
            />
          }
        >
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart
              data={defRows}
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
              <Tooltip
                content={(props) => (
                  <DefenseChartTooltip {...props} labelOf={chartLabel} />
                )}
              />
              <Area
                type="monotone"
                dataKey={perMatch ? 'sotaPerMp' : 'sota'}
                name={perMatch ? 'sotaPerMp' : 'sota'}
                stroke="#0d9488"
                strokeWidth={2}
                fill="#0d9488"
                fillOpacity={0.14}
                isAnimationActive={false}
                connectNulls
              >
                {lblOn('bySeason') && (
                  <LabelList
                    dataKey={perMatch ? 'sotaPerMp' : 'sota'}
                    position="top"
                    fontSize={10}
                    fill="var(--text-muted)"
                    formatter={perMatch ? decFmt : intFmt}
                  />
                )}
              </Area>
              <Line
                type="monotone"
                dataKey={perMatch ? 'savesPerMp' : 'saves'}
                name={perMatch ? 'savesPerMp' : 'saves'}
                stroke="#8b5cf6"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#8b5cf6' }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
                connectNulls
              >
                {lblOn('bySeason') && (
                  <LabelList
                    dataKey={perMatch ? 'savesPerMp' : 'saves'}
                    position="bottom"
                    fontSize={10}
                    fill="var(--text-muted)"
                    formatter={perMatch ? decFmt : intFmt}
                  />
                )}
              </Line>
              <Line
                type="monotone"
                dataKey={perMatch ? 'gaPerMp' : 'ga'}
                name={perMatch ? 'gaPerMp' : 'ga'}
                stroke="var(--danger)"
                strokeWidth={2.2}
                dot={{ r: 3, fill: 'var(--danger)' }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          eyebrow={tx('Goalkeeper Breakdown', 'เทียบผู้รักษาประตู')}
          title={t('keepers.chart.perGk')}
          note={allCompsNote}
          legend={
            <>
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <span className="inline-block h-2 w-2 rounded-full bg-[#0d9488]" />
                {perMatch ? 'SoTA/MP' : 'SoTA'}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: 'var(--danger)' }}
                />
                {perMatch ? 'GA/MP' : 'GA'}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <span className="inline-block h-2 w-2 rounded-full bg-[#8b5cf6]" />
                Save%
              </span>
            </>
          }
          action={
            <LabelsBtn
              on={lblOn('perGk')}
              onClick={() => toggleLbl('perGk')}
            />
          }
        >
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart
              data={perGk}
              margin={{ top: 10, right: 16, bottom: 24, left: 0 }}
            >
              <CartesianGrid
                stroke={gridStroke}
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="player"
                tick={{ ...axisTick, fontSize: 10 }}
                axisLine={{ stroke: 'var(--border)' }}
                tickLine={false}
                interval={0}
                angle={-30}
                textAnchor="end"
                height={60}
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
              <Tooltip
                content={(props) => (
                  <DefenseChartTooltip {...props} labelOf={chartLabel} />
                )}
              />
              <Bar
                dataKey={perMatch ? 'sotaPerMp' : 'sota'}
                name={perMatch ? 'sotaPerMp' : 'sota'}
                fill="#0d9488"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              >
                {lblOn('perGk') && (
                  <LabelList
                    dataKey={perMatch ? 'sotaPerMp' : 'sota'}
                    position="top"
                    fontSize={9}
                    fill="var(--text-muted)"
                    formatter={perMatch ? decFmt : intFmt}
                  />
                )}
              </Bar>
              <Bar
                dataKey={perMatch ? 'gaPerMp' : 'ga'}
                name={perMatch ? 'gaPerMp' : 'ga'}
                fill="var(--danger)"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              >
                {lblOn('perGk') && (
                  <LabelList
                    dataKey={perMatch ? 'gaPerMp' : 'ga'}
                    position="top"
                    fontSize={9}
                    fill="var(--text-muted)"
                    formatter={perMatch ? decFmt : intFmt}
                  />
                )}
              </Bar>
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="savePct"
                name="savePct"
                stroke="#8b5cf6"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#8b5cf6' }}
                isAnimationActive={false}
              >
                {lblOn('perGk') && (
                  <LabelList
                    dataKey="savePct"
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

        <ChartCard
          eyebrow={tx('Post-Shot Expected Goals', 'ประตูคาดหวังหลังการยิง (PSxG)')}
          title={t('keepers.chart.goalsPrevented')}
          note={
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted">
              <span>{t('defense.psxgNote')}</span>
              <span className="text-border">•</span>
              <span>{t('keepers.goalsPreventedNote')}</span>
            </div>
          }
          legend={
            goalsPrevented.length > 0 ? (
              <>
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: 'var(--danger)' }}
                  />
                  GA
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: 'var(--info)' }}
                  />
                  PSxG
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: 'var(--chart-neutral)' }}
                  />
                  PSxG+/-
                </span>
              </>
            ) : undefined
          }
          action={
            goalsPrevented.length > 0 ? (
              <LabelsBtn on={lblOn('gp')} onClick={() => toggleLbl('gp')} />
            ) : undefined
          }
        >
          {goalsPrevented.length === 0 ? (
            <div className="flex h-[260px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-bg-secondary/40 px-6 text-center">
              <Shield size={24} className="text-muted opacity-50" />
              <p className="max-w-sm text-xs text-muted">
                {t('defense.noPsxg')}
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart
                data={goalsPrevented}
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
                  width={36}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={axisTick}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <Tooltip
                  content={(props) => (
                    <DefenseChartTooltip {...props} labelOf={chartLabel} />
                  )}
                />
                <Bar
                  dataKey="ga"
                  name="ga"
                  fill="var(--danger)"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                >
                  {lblOn('gp') && (
                    <LabelList
                      dataKey="ga"
                      position="top"
                      fontSize={10}
                      fill="var(--text-muted)"
                      formatter={intFmt}
                    />
                  )}
                </Bar>
                <Bar
                  dataKey="psxg"
                  name="psxg"
                  fill="var(--info)"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                >
                  {lblOn('gp') && (
                    <LabelList
                      dataKey="psxg"
                      position="top"
                      fontSize={10}
                      fill="var(--text-muted)"
                      formatter={decFmt}
                    />
                  )}
                </Bar>
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="psxgPlusMinus"
                  name="psxgPlusMinus"
                  stroke="var(--chart-neutral)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: 'var(--chart-neutral)' }}
                  isAnimationActive={false}
                >
                  {lblOn('gp') && (
                    <LabelList
                      dataKey="psxgPlusMinus"
                      position="top"
                      fontSize={10}
                      fill="var(--text-muted)"
                      formatter={signedDecFmt}
                    />
                  )}
                </Line>
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </section>

      {/* -------------------------------------------------- Goalkeeper Comparison Cards */}
      {topKeepers.length > 0 && (
        <section className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                {tx('Goalkeeper Profiles', 'โปรไฟล์ผู้รักษาประตู')}
              </p>
              <h3 className="mt-0.5 font-display text-lg font-bold tracking-tight text-primary">
                {tx('Goalkeeper Comparison', 'เปรียบเทียบผู้รักษาประตู')}
              </h3>
            </div>
            {gkRows.fallback && (
              <span className="rounded-lg bg-bg-secondary px-2.5 py-1 text-xs text-muted">
                {t('defense.allCompsNote')}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {topKeepers.map((gk) => {
              const barPct =
                gk.savePct != null
                  ? Math.min(100, Math.max(0, gk.savePct * 100))
                  : 0;
              return (
                <div
                  key={gk.player}
                  className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface p-4"
                >
                  <span
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-[2px] opacity-80"
                    style={{ background: saveBarColor(gk.savePct) }}
                  />
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="truncate font-display text-base font-bold text-primary">
                        {gk.player}
                      </h4>
                      <p className="text-xs tabular-nums text-muted">
                        {fmt(gk.mp, 0)} MP · {fmt(gk.saves, 0)}{' '}
                        {tx('saves', 'เซฟ')} · {fmt(gk.cs, 0)} CS
                      </p>
                    </div>
                    {gk.psxgPlusMinus != null && (
                      <span
                        title={tx(
                          `Cumulative PL PSxG+/- across ${gk.psxgSeasons} seasons`,
                          `PSxG+/- สะสมใน PL ตลอด ${gk.psxgSeasons} ฤดูกาล`,
                        )}
                        className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-bold tabular-nums ${
                          gk.psxgPlusMinus > 0
                            ? 'bg-success-soft text-success'
                            : gk.psxgPlusMinus < 0
                              ? 'bg-danger-soft text-danger'
                              : 'bg-bg-secondary text-muted'
                        }`}
                      >
                        <Sparkles size={10} />
                        PSxG {signed(gk.psxgPlusMinus, 2)}
                      </span>
                    )}
                  </div>

                  {/* Save % Meter */}
                  <div className="mt-3.5">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="font-semibold text-muted">
                        {t('keepers.savePct')}
                      </span>
                      <span className="font-display text-base font-extrabold tabular-nums text-primary">
                        {gk.savePct != null ? pct(gk.savePct, 2) : '—'}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-bg-secondary">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${barPct}%`,
                          background: saveBarColor(gk.savePct),
                        }}
                      />
                    </div>
                  </div>

                  {/* Mini Stat Row */}
                  <div className="mt-3.5 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">
                        GA/MP
                      </span>
                      <span className="mt-0.5 block text-xs font-bold tabular-nums text-primary">
                        {fmt(gk.gaPerMp, 2)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">
                        SoTA/MP
                      </span>
                      <span className="mt-0.5 block text-xs font-bold tabular-nums text-primary">
                        {fmt(gk.sotaPerMp, 2)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">
                        CS%
                      </span>
                      <span className="mt-0.5 block text-xs font-bold tabular-nums text-primary">
                        {gk.csPct != null ? pct(gk.csPct, 2) : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* -------------------------------------------------- Team Defence by Season Table */}
      <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
              {tx('Season Ledger', 'ตารางสถิติรายฤดูกาล')}
            </p>
            <h3 className="mt-0.5 font-display text-lg font-bold tracking-tight text-primary">
              {t('defense.table.title')}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            {bestDefSeasonKey && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-bold text-brand">
                <Award size={12} />
                {tx('Tightest GA/MP:', 'เสียน้อยสุด/นัด:')}{' '}
                {seasonShort(bestDefSeasonKey)}
              </span>
            )}
            <span className="rounded-full bg-bg-secondary px-2.5 py-1 text-[11px] font-semibold tabular-nums text-secondary">
              {sortedDefRows.length} {tx('seasons', 'ฤดูกาล')}
            </span>
          </div>
        </div>
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[1000px] border-collapse">
            <thead className="sticky top-0 z-10 bg-surface-elevated">
              <tr>
                {defColumns.map((col) => (
                  <th
                    key={col.key}
                    title={DEF_TIP[col.key]}
                    onClick={() => toggleDefSort(col.key)}
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
                      {defSort.key === col.key ? (
                        defSort.dir === 'asc' ? (
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
              {sortedDefRows.map((r) => {
                const isBest = r.season === bestDefSeasonKey;
                return (
                  <tr
                    key={r.season}
                    className="border-b border-border transition-colors hover:bg-bg-secondary"
                    style={
                      isBest ? { background: 'var(--brand-soft)' } : undefined
                    }
                  >
                    <td className="whitespace-nowrap px-3 py-3 text-sm font-semibold text-primary">
                      <span className="inline-flex items-center gap-1.5 tabular-nums">
                        {r.season}
                        {isBest && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-brand px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-surface">
                            <Shield size={10} />
                            {tx('Best', 'แกร่ง')}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums text-secondary">
                      {fmt(r.mp, 0)}
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-bold tabular-nums text-primary">
                      {fmt(r.ga, 0)}
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-semibold tabular-nums text-primary">
                      {fmt(r.gaPerMp, 2)}
                    </td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums text-secondary">
                      {fmt(r.xga, 2)}
                    </td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums">
                      {r.xgaDiff != null ? (
                        <span
                          className={`inline-block rounded-md px-2 py-0.5 text-xs font-bold ${
                            r.xgaDiff > 0
                              ? 'bg-success-soft text-success'
                              : r.xgaDiff < 0
                                ? 'bg-danger-soft text-danger'
                                : 'bg-bg-secondary text-muted'
                          }`}
                        >
                          {signed(r.xgaDiff, 2)}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums text-secondary">
                      {fmt(r.shA, 0)}
                    </td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums text-secondary">
                      {fmt(r.sota, 0)}
                    </td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums text-secondary">
                      {fmt(r.saves, 0)}
                    </td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums text-secondary">
                      {r.savePct != null ? pct(r.savePct, 2) : '—'}
                    </td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums text-secondary">
                      {fmt(r.cs, 0)}
                    </td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums text-secondary">
                      {r.csPct != null ? pct(r.csPct, 2) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* -------------------------------------------------- Goalkeepers by Season Table */}
      <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3.5 sm:px-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
              {tx('Goalkeeper Season Log', 'สถิติผู้รักษาประตูรายฤดูกาล')}
            </p>
            <h3 className="mt-0.5 font-display text-lg font-bold tracking-tight text-primary">
              {t('keepers.table.title')}
            </h3>
          </div>
          <span className="rounded-full bg-bg-secondary px-2.5 py-1 text-[11px] font-semibold tabular-nums text-secondary">
            {sortedRows.length} {tx('entries', 'รายการ')}
          </span>
        </div>
        {gkRows.fallback && (
          <div className="border-b border-border bg-bg-secondary/50 px-4 py-2 text-xs text-muted sm:px-5">
            {t('defense.allCompsNote')}
          </div>
        )}
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead className="sticky top-0 z-10 bg-surface-elevated">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    title={GK_TIP[col.key]}
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
              {sortedRows.map((row, idx) => {
                const saveRatio =
                  row.savePct != null ? row.savePct / 100 : null;
                const rowPsxg = psxgBySeasonPlayer.get(
                  `${row.season}|${row.player}`,
                );
                return (
                  <tr
                    key={`${row.season}-${row.player}-${idx}`}
                    className="border-b border-border transition-colors hover:bg-bg-secondary"
                  >
                    <td className="whitespace-nowrap px-3 py-3 text-sm font-medium tabular-nums text-primary">
                      {row.season}
                    </td>
                    <td className="px-3 py-3 text-sm font-semibold text-primary">
                      <span className="inline-flex items-center gap-2">
                        <span>{dash(row.player)}</span>
                        {rowPsxg != null && (
                          <span
                            title="PL PSxG+/-"
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                              rowPsxg > 0
                                ? 'bg-success-soft text-success'
                                : rowPsxg < 0
                                  ? 'bg-danger-soft text-danger'
                                  : 'bg-bg-secondary text-muted'
                            }`}
                          >
                            PSxG {signed(rowPsxg, 2)}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums text-secondary">
                      {fmt(row.mp, 0)}
                    </td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums text-secondary">
                      {fmt(row.ga, 0)}
                    </td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums text-secondary">
                      {fmt(row.sota, 0)}
                    </td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums text-secondary">
                      {fmt(row.saves, 0)}
                    </td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums text-primary">
                      {saveRatio != null ? (
                        <div className="inline-flex items-center justify-end gap-2">
                          <div className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-bg-secondary sm:block">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(100, Math.max(0, saveRatio * 100))}%`,
                                background: saveBarColor(saveRatio),
                              }}
                            />
                          </div>
                          <span className="font-semibold">
                            {pct(saveRatio, 2)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums text-secondary">
                      {fmt(row.cs, 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* -------------------------------------------------- Keeper Matchlog */}
      <section className="flex min-w-0 flex-col gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
            {tx('Match-by-Match Goalkeeping Log', 'บันทึกผู้รักษาประตูรายนัด')}
          </p>
          <h3 className="mt-0.5 font-display text-lg font-bold tracking-tight text-primary">
            {tx('Goalkeeper Matchlog Browser', 'สำรวจบันทึกการเซฟแต่ละนัด')}
          </h3>
        </div>
        <MatchlogPanel
          type="keeper"
          titleKey="matchLog.tabs.keeper"
          group={group}
        />
      </section>
    </main>
  );
}
