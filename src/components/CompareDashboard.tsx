'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Flame, RotateCcw, Shield, Sparkles, Target, TrendingUp } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import type { CompGroup, MatchRow, MatchlogTable, SeasonMatchlogs } from '@/lib/types';
import { compInGroup, seasonShort } from '@/lib/stats';
import { useClub, useClubData } from './ClubProvider';
import { ClubCrest } from './LeagueHome';
import { fmt, pct, signed } from '@/lib/format';
import { loadMatchlogs, LOAD_FAILED } from './matchlog-shared';
import { CompetitionTabs } from './CompetitionTabs';

type PaceMetric = 'pts' | 'gd' | 'xg';
type ScopeMode = 'aligned' | 'full';

function matchPts(result: string | null): number {
  if (result === 'W') return 3;
  if (result === 'D') return 1;
  return 0;
}

function cumPoints(rows: MatchRow[]): number[] {
  let total = 0;
  return rows.map((r) => {
    total += matchPts(r.result);
    return total;
  });
}

function cumGd(rows: MatchRow[]): number[] {
  let total = 0;
  return rows.map((r) => {
    total += (r.gf ?? 0) - (r.ga ?? 0);
    return total;
  });
}

function cumXg(rows: MatchRow[]): (number | null)[] {
  let total = 0;
  let hasAny = false;
  return rows.map((r) => {
    if (r.xg != null) {
      total += r.xg;
      hasAny = true;
    }
    return hasAny ? total : null;
  });
}

interface SeasonStats {
  mp: number;
  w: number;
  d: number;
  l: number;
  winRate: number | null;
  drawRate: number | null;
  lossRate: number | null;
  points: number | null;
  ppg: number | null;
  gf: number | null;
  ga: number | null;
  gd: number | null;
  gfPer: number | null;
  gaPer: number | null;
  cs: number;
  csRate: number | null;
  xg: number | null;
  xga: number | null;
  xgd: number | null;
  xgPer: number | null;
  xgaPer: number | null;
  xgN: number;
}

interface SeasonData {
  rows: MatchRow[];
  cumPts: number[];
  cumGd: number[];
  cumXg: (number | null)[];
  fullPpg: number | null;
  fullPts: number;
}

interface LogStats {
  sh: number | null;
  sot: number | null;
  sota: number | null;
  saves: number | null;
  loading: boolean;
}

function computeStats(rows: MatchRow[]): SeasonStats {
  const mp = rows.length;
  let w = 0;
  let d = 0;
  let l = 0;
  let gf = 0;
  let ga = 0;
  let gfCount = 0;
  let gaCount = 0;
  let cs = 0;
  let xg = 0;
  let xga = 0;
  let xgN = 0;

  for (const m of rows) {
    if (m.result === 'W') w += 1;
    else if (m.result === 'D') d += 1;
    else if (m.result === 'L') l += 1;
    if (m.gf != null) {
      gf += m.gf;
      gfCount += 1;
    }
    if (m.ga != null) {
      ga += m.ga;
      gaCount += 1;
      if (m.ga === 0) cs += 1;
    }
    if (m.xg != null || m.xga != null) {
      xg += m.xg ?? 0;
      xga += m.xga ?? 0;
      xgN += 1;
    }
  }

  const points = mp > 0 ? 3 * w + d : null;
  return {
    mp,
    w,
    d,
    l,
    winRate: mp > 0 ? w / mp : null,
    drawRate: mp > 0 ? d / mp : null,
    lossRate: mp > 0 ? l / mp : null,
    points,
    ppg: mp > 0 && points != null ? points / mp : null,
    gf: gfCount > 0 ? gf : null,
    ga: gaCount > 0 ? ga : null,
    gd: gfCount > 0 && gaCount > 0 ? gf - ga : null,
    gfPer: gfCount > 0 ? gf / gfCount : null,
    gaPer: gaCount > 0 ? ga / gaCount : null,
    cs,
    csRate: gaCount > 0 ? cs / gaCount : null,
    xg: xgN > 0 ? xg : null,
    xga: xgN > 0 ? xga : null,
    xgd: xgN > 0 ? xg - xga : null,
    xgPer: xgN > 0 ? xg / xgN : null,
    xgaPer: xgN > 0 ? xga / xgN : null,
    xgN,
  };
}

function sumMatchlogColumn(
  table: MatchlogTable | undefined,
  dates: Set<string>,
  colName: string,
  group: CompGroup,
): number | null {
  if (!table) return null;
  const compIdx = table.columns.indexOf('Comp');
  const dateIdx = table.columns.indexOf('Date');
  const colIdx = table.columns.indexOf(colName);
  if (compIdx < 0 || dateIdx < 0 || colIdx < 0) return null;
  let sum = 0;
  let count = 0;
  for (const r of table.rows) {
    if (!compInGroup(r[compIdx] ?? '', group)) continue;
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
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#f97316',
  '#14b8a6',
  '#6366f1',
  '#84cc16',
  '#eab308',
  'var(--danger)',
];

/* ------------------------------------------- Module-level subcomponents */

function PaceTooltip({
  active,
  payload,
  label,
  matchweekLabel,
  metric,
}: {
  active?: boolean;
  payload?: { name?: string | number; dataKey?: string | number; value?: number | null; color?: string }[];
  label?: string | number;
  matchweekLabel: string;
  metric: PaceMetric;
}) {
  if (!active || !payload?.length) return null;
  const sorted = [...payload].sort((a, b) => {
    const av = typeof a.value === 'number' ? a.value : -Infinity;
    const bv = typeof b.value === 'number' ? b.value : -Infinity;
    return bv - av;
  });

  const formatVal = (v: unknown) => {
    if (typeof v !== 'number' || Number.isNaN(v)) return '—';
    if (metric === 'xg') return fmt(v, 2);
    if (metric === 'gd') return signed(v, 0);
    return fmt(v, 0);
  };

  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-3 shadow-md">
      <p className="mb-1.5 text-xs font-bold text-primary tabular-nums">
        {matchweekLabel} {label}
      </p>
      <div className="flex flex-col gap-1">
        {sorted.map((entry, idx) => {
          const color = entry.color ?? 'var(--text-muted)';
          const name = String((typeof entry.name === 'string' ? entry.name : entry.dataKey) ?? '');
          return (
            <div key={idx} className="flex items-center justify-between gap-4 text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold text-secondary">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                <span>{name}</span>
              </span>
              <span className="font-bold tabular-nums text-primary">{formatVal(entry.value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-border-light bg-bg-secondary/60 p-2.5">
      <span className="text-[11px] font-semibold text-muted">{label}</span>
      <span
        className={`mt-1 font-display text-xl font-bold tabular-nums ${
          highlight ? 'text-success' : 'text-primary'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function WdlMiniBar({ w, d, l, mp }: { w: number; d: number; l: number; mp: number }) {
  if (mp <= 0) return null;
  return (
    <span className="flex h-1.5 w-14 overflow-hidden rounded-full bg-bg-secondary" aria-hidden>
      {w > 0 && <span style={{ width: `${(w / mp) * 100}%`, background: 'var(--success)' }} />}
      {d > 0 && <span style={{ width: `${(d / mp) * 100}%`, background: 'var(--chart-neutral)' }} />}
      {l > 0 && <span style={{ width: `${(l / mp) * 100}%`, background: 'var(--danger)' }} />}
    </span>
  );
}

/* ----------------------------------------------------- Main Component */

export function CompareDashboard() {
  const { t, lang } = useI18n();
  const L = (th: string, en: string) => (lang === 'th' ? th : en);
  const { club } = useClub();
  const { matches } = useClubData();

  const [group, setGroup] = useState<CompGroup>('all');
  const [paceMetric, setPaceMetric] = useState<PaceMetric>('pts');
  const [scopeMode, setScopeMode] = useState<ScopeMode>('aligned');

  const clubName = lang === 'th' && club.nameTh ? club.nameTh : club.name;

  // All played seasons in chronological order (oldest -> newest)
  const seasons = useMemo(() => {
    const set = new Set(
      matches
        .filter((m) => compInGroup(m.competition, group) && m.result)
        .map((m) => m.season),
    );
    return Array.from(set).sort();
  }, [matches, group]);

  // Display order in picker: latest first
  const seasonsLatestFirst = useMemo(() => [...seasons].reverse(), [seasons]);

  // Precompute full-season stats across all available seasons for presets
  const allSeasonSummaries = useMemo(() => {
    const map = new Map<string, SeasonData>();
    for (const season of seasons) {
      const rows = matches
        .filter(
          (m) =>
            m.season === season &&
            compInGroup(m.competition, group) &&
            (m.result === 'W' || m.result === 'D' || m.result === 'L'),
        )
        .sort((a, b) => a.date.localeCompare(b.date));
      const cp = cumPoints(rows);
      const fullPts = cp[cp.length - 1] ?? 0;
      map.set(season, {
        rows,
        cumPts: cp,
        cumGd: cumGd(rows),
        cumXg: cumXg(rows),
        fullPts,
        fullPpg: rows.length > 0 ? fullPts / rows.length : null,
      });
    }
    return map;
  }, [matches, seasons, group]);

  const [selected, setSelected] = useState<string[]>(() => {
    const a = seasons[seasons.length - 2] ?? '';
    const b = seasons[seasons.length - 1] ?? '';
    return [...new Set([b, a].filter(Boolean))];
  });

  const effective = useMemo(() => {
    const keep = selected.filter((s) => seasons.includes(s));
    if (keep.length) return keep;
    return seasonsLatestFirst.slice(0, 2);
  }, [selected, seasons, seasonsLatestFirst]);

  // Stable color assignment based on latest-first position in selected list (or stable palette)
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    // Latest-first index across effective seasons gives top contrast for the first 4 picks
    const ordered = [...effective].sort((a, b) => b.localeCompare(a));
    ordered.forEach((s, i) => {
      map.set(s, LINE_COLORS[i % LINE_COLORS.length]);
    });
    return map;
  }, [effective]);

  const getColor = (season: string) => {
    const assigned = colorMap.get(season);
    if (assigned) return assigned;
    const idx = seasonsLatestFirst.indexOf(season);
    return LINE_COLORS[idx >= 0 ? idx % LINE_COLORS.length : 0];
  };

  // Lazy load matchlogs for selected seasons
  const [matchlogs, setMatchlogs] = useState<
    Record<string, SeasonMatchlogs | 'loading' | 'failed'>
  >({});

  useEffect(() => {
    let live = true;
    for (const season of effective) {
      loadMatchlogs(club.slug, season).then((r) => {
        if (!live) return;
        const next = r === LOAD_FAILED ? 'failed' : r;
        setMatchlogs((prev) => (prev[season] === next ? prev : { ...prev, [season]: next }));
      });
    }
    return () => {
      live = false;
    };
  }, [effective, club.slug]);

  const { maxLen, matchweek, hasDifferentLengths } = useMemo(() => {
    if (!effective.length) return { maxLen: 0, matchweek: 0, hasDifferentLengths: false };
    const lens = effective.map((s) => allSeasonSummaries.get(s)?.rows.length ?? 0);
    const maxL = Math.max(...lens);
    const minL = Math.min(...lens);
    return {
      maxLen: maxL,
      matchweek: minL,
      hasDifferentLengths: maxL !== minL && minL > 0,
    };
  }, [effective, allSeasonSummaries]);

  const hasXg = useMemo(
    () =>
      effective.some((s) =>
        (allSeasonSummaries.get(s)?.rows ?? []).some((m) => m.xg != null || m.xga != null),
      ),
    [effective, allSeasonSummaries],
  );

  const activePaceMetric: PaceMetric = paceMetric === 'xg' && !hasXg ? 'pts' : paceMetric;

  const chartData = useMemo(() => {
    return Array.from({ length: maxLen }, (_, i) => {
      const entry: Record<string, number | null> & { match: number } = {
        match: i + 1,
      };
      for (const season of effective) {
        const sd = allSeasonSummaries.get(season);
        if (!sd) {
          entry[season] = null;
        } else if (activePaceMetric === 'pts') {
          entry[season] = sd.cumPts[i] ?? null;
        } else if (activePaceMetric === 'gd') {
          entry[season] = sd.cumGd[i] ?? null;
        } else {
          entry[season] = sd.cumXg[i] ?? null;
        }
      }
      return entry;
    });
  }, [maxLen, effective, allSeasonSummaries, activePaceMetric]);

  // Compute stats for both aligned (first `matchweek` games) and full season
  const stats = useMemo<Record<string, SeasonStats>>(() => {
    const map: Record<string, SeasonStats> = {};
    for (const season of effective) {
      const rows = allSeasonSummaries.get(season)?.rows ?? [];
      const slice = scopeMode === 'aligned' ? rows.slice(0, matchweek) : rows;
      map[season] = computeStats(slice);
    }
    return map;
  }, [effective, allSeasonSummaries, matchweek, scopeMode]);

  const logStats = useMemo<Record<string, LogStats>>(() => {
    const map: Record<string, LogStats> = {};
    for (const season of effective) {
      const ml = matchlogs[season];
      const loading = ml == null || ml === 'loading';
      if (loading || ml === 'failed' || typeof ml !== 'object') {
        map[season] = { sh: null, sot: null, sota: null, saves: null, loading };
        continue;
      }
      const rows = allSeasonSummaries.get(season)?.rows ?? [];
      const slice = scopeMode === 'aligned' ? rows.slice(0, matchweek) : rows;
      const dates = new Set(slice.map((m) => m.date));
      map[season] = {
        sh: sumMatchlogColumn(ml.shooting?.for, dates, 'Sh', group),
        sot: sumMatchlogColumn(ml.shooting?.for, dates, 'SoT', group),
        sota: sumMatchlogColumn(ml.keeper?.for, dates, 'SoTA', group),
        saves: sumMatchlogColumn(ml.keeper?.for, dates, 'Saves', group),
        loading: false,
      };
    }
    return map;
  }, [effective, matchweek, matchlogs, allSeasonSummaries, group, scopeMode]);

  // Presets computed from available seasons in the active competition group
  const presets = useMemo(() => {
    const latest = seasonsLatestFirst[0];
    const prev = seasonsLatestFirst[1];
    const last3 = seasonsLatestFirst.slice(0, 3);

    // Rank completed/meaningful seasons by PPG (prefer >= 10 games for PL/all if available)
    const minPresetMp = group === 'all' || group === 'premier-league' ? 10 : 3;
    const withMin = seasons.filter((s) => (allSeasonSummaries.get(s)?.rows.length ?? 0) >= minPresetMp);
    const pool = withMin.length >= 2 ? withMin : seasons;
    const byPpg = [...pool].sort((a, b) => {
      const pa = allSeasonSummaries.get(a)?.fullPpg ?? -1;
      const pb = allSeasonSummaries.get(b)?.fullPpg ?? -1;
      return pb - pa || b.localeCompare(a);
    });

    const bestOther = byPpg.find((s) => s !== latest) ?? byPpg[0];
    const latestVsBest = [...new Set([latest, bestOther].filter(Boolean))];
    const top4 = byPpg.slice(0, 4);
    const latestVsPrev = [...new Set([latest, prev].filter(Boolean))];

    return [
      {
        id: 'latest-best',
        label: L('ล่าสุด vs ดีที่สุด', 'Latest vs Best'),
        seasons: latestVsBest,
      },
      {
        id: 'last-3',
        label: L('3 ฤดูกาลล่าสุด', 'Last 3 Seasons'),
        seasons: last3,
      },
      {
        id: 'top-4',
        label: L('ท็อป 4 ฤดูกาล', 'Top 4 Seasons'),
        seasons: top4,
      },
      {
        id: 'latest-prev',
        label: L('ล่าสุด vs ก่อนหน้า', 'Latest vs Previous'),
        seasons: latestVsPrev,
      },
    ].filter((p) => p.seasons.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasons, seasonsLatestFirst, allSeasonSummaries, group, lang]);

  const isPresetActive = (presetSeasons: string[]) =>
    presetSeasons.length === effective.length &&
    presetSeasons.every((s) => effective.includes(s));

  // Column leaders across effective seasons for emerald table highlighting + snapshot strip
  const leaders = useMemo(() => {
    const maxKey = (fn: (s: string) => number | null) => {
      let bestVal: number | null = null;
      let bestSeason: string | null = null;
      for (const season of effective) {
        const v = fn(season);
        if (v == null) continue;
        if (bestVal == null || v > bestVal) {
          bestVal = v;
          bestSeason = season;
        }
      }
      return { value: bestVal, season: bestSeason };
    };
    const minKey = (fn: (s: string) => number | null) => {
      let bestVal: number | null = null;
      let bestSeason: string | null = null;
      for (const season of effective) {
        const v = fn(season);
        if (v == null) continue;
        if (bestVal == null || v < bestVal) {
          bestVal = v;
          bestSeason = season;
        }
      }
      return { value: bestVal, season: bestSeason };
    };

    return {
      pts: maxKey((s) => stats[s]?.points ?? null),
      ppg: maxKey((s) => stats[s]?.ppg ?? null),
      winRate: maxKey((s) => stats[s]?.winRate ?? null),
      gf: maxKey((s) => stats[s]?.gf ?? null),
      gfPer: maxKey((s) => stats[s]?.gfPer ?? null),
      ga: minKey((s) => stats[s]?.ga ?? null),
      gaPer: minKey((s) => stats[s]?.gaPer ?? null),
      gd: maxKey((s) => stats[s]?.gd ?? null),
      csRate: maxKey((s) => stats[s]?.csRate ?? null),
      xg: maxKey((s) => stats[s]?.xg ?? null),
      xgPer: maxKey((s) => stats[s]?.xgPer ?? null),
      xga: minKey((s) => stats[s]?.xga ?? null),
      xgaPer: minKey((s) => stats[s]?.xgaPer ?? null),
      xgd: maxKey((s) => stats[s]?.xgd ?? null),
      sh: maxKey((s) => logStats[s]?.sh ?? null),
      sot: maxKey((s) => logStats[s]?.sot ?? null),
      sota: minKey((s) => logStats[s]?.sota ?? null),
      saves: maxKey((s) => logStats[s]?.saves ?? null),
    };
  }, [effective, stats, logStats]);

  const orderedEffective = useMemo(
    () => [...effective].sort((a, b) => b.localeCompare(a)),
    [effective],
  );

  function toggleSeason(season: string) {
    setSelected(() => {
      const set = new Set(effective);
      if (set.has(season)) {
        if (set.size === 1) return effective;
        set.delete(season);
      } else {
        set.add(season);
      }
      return seasonsLatestFirst.filter((s) => set.has(s));
    });
  }

  function resetSelection() {
    setSelected(seasonsLatestFirst.slice(0, 2));
  }

  const axisTick = { fill: 'var(--text-muted)', fontSize: 11 };
  const gridStroke = 'var(--border-light)';
  const multiSelected = effective.length > 1;
  const isLead = (val: number | null, leadVal: number | null) =>
    multiSelected && val != null && leadVal != null && val === leadVal;

  const spanLabel =
    seasons.length >= 2
      ? `${seasons[0].slice(0, 4)}–${seasons[seasons.length - 1].slice(-4)}`
      : seasons[0] ?? '2014–2027';

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 pb-16 pt-6 sm:px-6 lg:px-10">
      {/* -------------------------------------------------- Editorial Masthead */}
      <header className="flex flex-col gap-4 border-b border-border pb-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface p-2 shadow-sm dark:shadow-none sm:h-14 sm:w-14">
              <ClubCrest slug={club.slug} size={40} alt={clubName} />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                {L('เปรียบเทียบจังหวะคะแนนข้ามฤดูกาล', 'CROSS-SEASON PACE & BENCHMARK')} · {spanLabel} · {clubName}
              </p>
              <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-primary sm:text-4xl">
                {t('compare.title')}
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-secondary">
                {L(
                  'เทียบเส้นทางแต้มสะสม เกมรุก เกมรับ และ xG นัดต่อนัดของสโมสรข้ามฤดูกาลอย่างยุติธรรมที่จำนวนนัดเท่ากัน',
                  'Track match-by-match points pace, attack, defense, and xG across seasons aligned at the exact same match count.',
                )}
              </p>
            </div>
          </div>

          {/* Preset Quick Buttons */}
          {presets.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-muted">
                <Sparkles size={13} className="text-brand" />
                {L('ชุดเปรียบเทียบ:', 'Presets:')}
              </span>
              {presets.map((pr) => {
                const active = isPresetActive(pr.seasons);
                return (
                  <button
                    key={pr.id}
                    type="button"
                    onClick={() => setSelected(pr.seasons)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand ${
                      active
                        ? 'border-brand bg-brand-soft text-brand'
                        : 'border-border bg-surface text-secondary hover:border-primary/30 hover:text-primary'
                    }`}
                  >
                    {pr.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <CompetitionTabs group={group} onChange={setGroup} />
      </header>

      {/* -------------------------------------------------- Season Picker Strip */}
      <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
              {t('compare.seasons')}
            </span>
            <span className="rounded-full bg-bg-secondary px-2 py-0.5 text-[11px] font-bold tabular-nums text-primary">
              {effective.length} / {seasons.length} {L('ฤดูกาล', 'selected')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetSelection}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-secondary px-3 py-1 text-xs font-semibold text-secondary transition-colors hover:border-primary/30 hover:text-primary focus-visible:outline-2 focus-visible:outline-brand"
            >
              <RotateCcw size={12} />
              <span>{L('รีเซ็ต (2 ล่าสุด)', 'Reset (Latest 2)')}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {seasonsLatestFirst.map((season) => {
            const isSelected = effective.includes(season);
            const color = getColor(season);
            const mp = allSeasonSummaries.get(season)?.rows.length ?? 0;
            return (
              <button
                key={season}
                type="button"
                onClick={() => toggleSeason(season)}
                aria-pressed={isSelected}
                className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold tabular-nums transition-all focus-visible:outline-2 focus-visible:outline-brand sm:text-sm ${
                  isSelected
                    ? 'bg-bg-secondary/80 text-primary shadow-xs dark:shadow-none'
                    : 'border-border bg-surface text-muted hover:border-primary/30 hover:text-secondary'
                }`}
                style={
                  isSelected
                    ? {
                        borderColor: color,
                        backgroundColor: `color-mix(in srgb, ${color} 10%, var(--surface))`,
                      }
                    : undefined
                }
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${isSelected ? '' : 'border-2 bg-transparent'}`}
                  style={
                    isSelected
                      ? { backgroundColor: color }
                      : { borderColor: color, opacity: 0.4 }
                  }
                />
                <span>{seasonShort(season)}</span>
                <span className="text-[11px] font-normal opacity-70">({mp})</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ------------------------------------ Selected Seasons Snapshot Strip */}
      {orderedEffective.length > 0 && (
        <section
          aria-label={L('สรุปฤดูกาลที่เลือก', 'Selected seasons snapshot')}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          {/* 1. Best PPG */}
          {leaders.ppg.season && stats[leaders.ppg.season] && (
            <article
              className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none"
              style={{ borderTopWidth: 2, borderTopColor: getColor(leaders.ppg.season) }}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                    <TrendingUp size={13} className="text-success" />
                    {L('แต้ม/นัดสูงสุด', 'Best PPG')}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-bg-secondary px-2 py-0.5 text-[11px] font-bold tabular-nums text-primary">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: getColor(leaders.ppg.season) }}
                    />
                    {seasonShort(leaders.ppg.season)}
                  </span>
                </div>
                <div className="mt-2.5 flex items-baseline gap-2">
                  <span className="font-display text-3xl font-bold tabular-nums text-success">
                    {fmt(stats[leaders.ppg.season].ppg, 2)}
                  </span>
                  <span className="text-xs font-medium text-muted">
                    {L('แต้ม/นัด', 'PPG')}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-xs text-secondary tabular-nums">
                {fmt(stats[leaders.ppg.season].points, 0)} {t('compare.points')} ·{' '}
                {stats[leaders.ppg.season].w}–{stats[leaders.ppg.season].d}–{stats[leaders.ppg.season].l} (
                {stats[leaders.ppg.season].mp} {L('นัด', 'MP')})
              </p>
            </article>
          )}

          {/* 2. Best Attack */}
          {leaders.gfPer.season && stats[leaders.gfPer.season] && (
            <article
              className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none"
              style={{ borderTopWidth: 2, borderTopColor: getColor(leaders.gfPer.season) }}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                    <Flame size={13} className="text-brand" />
                    {L('เกมรุกดีที่สุด', 'Best Attack')}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-bg-secondary px-2 py-0.5 text-[11px] font-bold tabular-nums text-primary">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: getColor(leaders.gfPer.season) }}
                    />
                    {seasonShort(leaders.gfPer.season)}
                  </span>
                </div>
                <div className="mt-2.5 flex items-baseline gap-2">
                  <span className="font-display text-3xl font-bold tabular-nums text-primary">
                    {fmt(stats[leaders.gfPer.season].gfPer, 2)}
                  </span>
                  <span className="text-xs font-medium text-muted">
                    {L('ประตู/นัด', 'GF / match')}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-xs text-secondary tabular-nums">
                {fmt(stats[leaders.gfPer.season].gf, 0)} {L('ประตูทั้งหมด', 'total goals')} · GD{' '}
                {signed(stats[leaders.gfPer.season].gd, 0)}
              </p>
            </article>
          )}

          {/* 3. Tightest Defense */}
          {leaders.gaPer.season && stats[leaders.gaPer.season] && (
            <article
              className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none"
              style={{ borderTopWidth: 2, borderTopColor: getColor(leaders.gaPer.season) }}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                    <Shield size={13} className="text-info" />
                    {L('เกมรับเหนียวสุด', 'Tightest Defense')}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-bg-secondary px-2 py-0.5 text-[11px] font-bold tabular-nums text-primary">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: getColor(leaders.gaPer.season) }}
                    />
                    {seasonShort(leaders.gaPer.season)}
                  </span>
                </div>
                <div className="mt-2.5 flex items-baseline gap-2">
                  <span className="font-display text-3xl font-bold tabular-nums text-primary">
                    {fmt(stats[leaders.gaPer.season].gaPer, 2)}
                  </span>
                  <span className="text-xs font-medium text-muted">
                    {L('เสีย/นัด', 'GA / match')}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-xs text-secondary tabular-nums">
                {fmt(stats[leaders.gaPer.season].ga, 0)} {L('เสียประตู', 'conceded')} ·{' '}
                {stats[leaders.gaPer.season].cs} CS ({pct(stats[leaders.gaPer.season].csRate, 2)})
              </p>
            </article>
          )}

          {/* 4. Highest xG (or Best Goal Diff when xG unavailable) */}
          {hasXg && leaders.xgPer.season && stats[leaders.xgPer.season] ? (
            <article
              className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none"
              style={{ borderTopWidth: 2, borderTopColor: getColor(leaders.xgPer.season) }}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                    <Target size={13} className="text-warning" />
                    {L('xG สูงสุด', 'Highest xG')}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-bg-secondary px-2 py-0.5 text-[11px] font-bold tabular-nums text-primary">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: getColor(leaders.xgPer.season) }}
                    />
                    {seasonShort(leaders.xgPer.season)}
                  </span>
                </div>
                <div className="mt-2.5 flex items-baseline gap-2">
                  <span className="font-display text-3xl font-bold tabular-nums text-primary">
                    {fmt(stats[leaders.xgPer.season].xgPer, 2)}
                  </span>
                  <span className="text-xs font-medium text-muted">
                    {L('xG/นัด', 'xG / match')}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-xs text-secondary tabular-nums">
                {fmt(stats[leaders.xgPer.season].xg, 2)} xG · xGD{' '}
                {signed(stats[leaders.xgPer.season].xgd, 2)}
              </p>
            </article>
          ) : leaders.gd.season && stats[leaders.gd.season] ? (
            <article
              className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none"
              style={{ borderTopWidth: 2, borderTopColor: getColor(leaders.gd.season) }}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                    <Target size={13} className="text-warning" />
                    {L('ผลต่างประตูสูงสุด', 'Best Goal Diff')}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-bg-secondary px-2 py-0.5 text-[11px] font-bold tabular-nums text-primary">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: getColor(leaders.gd.season) }}
                    />
                    {seasonShort(leaders.gd.season)}
                  </span>
                </div>
                <div className="mt-2.5 flex items-baseline gap-2">
                  <span className="font-display text-3xl font-bold tabular-nums text-primary">
                    {signed(stats[leaders.gd.season].gd, 0)}
                  </span>
                  <span className="text-xs font-medium text-muted">GD</span>
                </div>
              </div>
              <p className="mt-2 text-xs text-secondary tabular-nums">
                {fmt(stats[leaders.gd.season].gf, 0)} GF · {fmt(stats[leaders.gd.season].ga, 0)} GA
              </p>
            </article>
          ) : null}
        </section>
      )}

      {/* ---------------------------------------- Match-by-Match Pace Chart */}
      <section className="min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none sm:p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
              {L('เส้นทางนัดต่อนัด', 'MATCH-BY-MATCH PACE')}
            </p>
            <h3 className="mt-0.5 font-display text-lg font-bold text-primary sm:text-xl">
              {activePaceMetric === 'pts'
                ? t('compare.chartTitle')
                : activePaceMetric === 'gd'
                  ? L('ผลต่างประตูสะสม', 'Cumulative goal difference')
                  : L('xG สะสม (พรีเมียร์ลีก)', 'Cumulative xG (Premier League)')}
            </h3>
          </div>

          <div className="inline-flex rounded-xl border border-border bg-bg-secondary p-1 text-xs font-bold">
            {(
              [
                ['pts', L('แต้มสะสม', 'Points')],
                ['gd', L('ผลต่างประตู', 'Goal Diff')],
                ...(hasXg ? [['xg', 'xG']] : []),
              ] as [PaceMetric, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPaceMetric(key)}
                className={`rounded-lg px-3 py-1 transition-colors ${
                  activePaceMetric === key
                    ? 'bg-surface text-primary shadow-xs dark:shadow-none'
                    : 'text-muted hover:text-primary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Inline Legend */}
        <div className="mb-3 flex flex-wrap items-center gap-3 text-xs font-semibold">
          {orderedEffective.map((season) => {
            const color = getColor(season);
            return (
              <span key={season} className="inline-flex items-center gap-1.5 tabular-nums text-primary">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span>{season}</span>
              </span>
            );
          })}
          {hasDifferentLengths && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted">
              <span className="h-0.5 w-3 border-t border-dashed border-muted" />
              {L(`จุดเทียบเท่ากัน: นัดที่ ${matchweek}`, `Aligned mark: MW ${matchweek}`)}
            </span>
          )}
        </div>

        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={chartData} margin={{ top: 12, right: 12, bottom: 8, left: 0 }}>
            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="match"
              tick={axisTick}
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={false}
            />
            <YAxis
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              width={36}
              domain={activePaceMetric === 'gd' ? ['auto', 'auto'] : [0, 'auto']}
            />
            {activePaceMetric === 'gd' && (
              <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />
            )}
            {hasDifferentLengths && (
              <ReferenceLine
                x={matchweek}
                stroke="var(--text-muted)"
                strokeDasharray="4 4"
                label={{
                  value: `MW ${matchweek}`,
                  position: 'insideTopRight',
                  fontSize: 10,
                  fill: 'var(--text-muted)',
                }}
              />
            )}
            <Tooltip
              content={
                <PaceTooltip
                  matchweekLabel={t('compare.matchweek')}
                  metric={activePaceMetric}
                />
              }
            />
            {orderedEffective.map((season) => {
              const color = getColor(season);
              return (
                <Line
                  key={season}
                  type="monotone"
                  dataKey={season}
                  name={season}
                  stroke={color}
                  strokeWidth={2.5}
                  dot={{ r: 2.5, fill: color }}
                  activeDot={{ r: 5, fill: color, stroke: 'var(--surface)', strokeWidth: 2 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </section>

      {/* ----------------------------------------- Benchmark Comparison Table */}
      <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm dark:shadow-none">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
              {L('ตารางเทียบมาตรฐาน', 'BENCHMARK COMPARISON TABLE')}
            </p>
            <h3 className="mt-0.5 font-display text-lg font-bold text-primary">
              {scopeMode === 'aligned'
                ? t('compare.statTitle').replace('{matchweek}', String(matchweek))
                : L('สถิติเต็มฤดูกาล (ตามจำนวนนัดที่ลงเล่น)', 'Full-season totals (all played matches)')}
            </h3>
            {multiSelected && (
              <p className="mt-0.5 text-xs text-muted">
                {L(
                  'ตัวเลขสีเขียวเข้มแสดงฤดูกาลที่นำในแต่ละคอลัมน์',
                  'Emerald highlights indicate the leading season in each column',
                )}
              </p>
            )}
          </div>

          {hasDifferentLengths && (
            <div className="inline-flex rounded-xl border border-border bg-bg-secondary p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setScopeMode('aligned')}
                className={`rounded-lg px-3 py-1 transition-colors ${
                  scopeMode === 'aligned'
                    ? 'bg-surface text-primary shadow-xs dark:shadow-none'
                    : 'text-muted hover:text-primary'
                }`}
              >
                {L(`เทียบเท่ากัน (${matchweek} นัด)`, `Aligned (${matchweek} MP)`)}
              </button>
              <button
                type="button"
                onClick={() => setScopeMode('full')}
                className={`rounded-lg px-3 py-1 transition-colors ${
                  scopeMode === 'full'
                    ? 'bg-surface text-primary shadow-xs dark:shadow-none'
                    : 'text-muted hover:text-primary'
                }`}
              >
                {L('เต็มฤดูกาล', 'Full Season')}
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse whitespace-nowrap">
            <thead className="bg-surface-elevated">
              <tr className="border-b border-border text-[11px] font-bold uppercase tracking-wider text-muted">
                <th className="px-4 py-3 text-left">{t('table.season')}</th>
                <th className="px-3 py-3 text-right">{t('table.mp')}</th>
                <th className="px-3 py-3 text-right">W–D–L</th>
                <th className="px-3 py-3 text-right">{t('compare.points')}</th>
                <th className="px-3 py-3 text-right">{L('แต้ม/นัด', 'PPG')}</th>
                <th className="px-3 py-3 text-right">{t('compare.winRate')}</th>
                <th className="px-3 py-3 text-right">{t('compare.gf')}</th>
                <th className="px-3 py-3 text-right">{t('compare.ga')}</th>
                <th className="px-3 py-3 text-right">{t('compare.gd')}</th>
                <th className="px-3 py-3 text-right">GF/M</th>
                <th className="px-3 py-3 text-right">GA/M</th>
                <th className="px-3 py-3 text-right">{L('คลีนชีต %', 'CS %')}</th>
                {hasXg && (
                  <>
                    <th className="px-3 py-3 text-right">xG</th>
                    <th className="px-3 py-3 text-right">xGA</th>
                    <th className="px-3 py-3 text-right">xGD</th>
                  </>
                )}
                <th className="px-3 py-3 text-right">{t('compare.sh')}</th>
                <th className="px-3 py-3 text-right">{t('compare.sot')}</th>
                <th className="px-3 py-3 text-right">{t('compare.sota')}</th>
                <th className="px-3 py-3 text-right">{t('compare.saves')}</th>
              </tr>
            </thead>
            <tbody>
              {orderedEffective.map((season) => {
                const s = stats[season];
                const ls = logStats[season];
                const color = getColor(season);
                if (!s) return null;
                const cell = (lead: boolean) =>
                  `px-3 py-3 text-right text-sm tabular-nums ${
                    lead ? 'font-bold text-success' : 'text-secondary'
                  }`;
                const logShow = (v: number | null) => (ls?.loading ? '…' : fmt(v, 0));
                return (
                  <tr
                    key={season}
                    className="border-b border-border-light transition-colors last:border-0 hover:bg-bg-secondary/60"
                  >
                    <td className="px-4 py-3 text-sm font-bold text-primary tabular-nums">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                        <span>{season}</span>
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-medium tabular-nums text-primary">
                      {s.mp}
                    </td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-secondary">
                          {s.w}–{s.d}–{s.l}
                        </span>
                        <WdlMiniBar w={s.w} d={s.d} l={s.l} mp={s.mp} />
                      </div>
                    </td>
                    <td className={cell(isLead(s.points, leaders.pts.value))}>
                      {fmt(s.points, 0)}
                    </td>
                    <td className={cell(isLead(s.ppg, leaders.ppg.value))}>
                      {fmt(s.ppg, 2)}
                    </td>
                    <td className={cell(isLead(s.winRate, leaders.winRate.value))}>
                      {pct(s.winRate, 2)}
                    </td>
                    <td className={cell(isLead(s.gf, leaders.gf.value))}>
                      {fmt(s.gf, 0)}
                    </td>
                    <td className={cell(isLead(s.ga, leaders.ga.value))}>
                      {fmt(s.ga, 0)}
                    </td>
                    <td className={cell(isLead(s.gd, leaders.gd.value))}>
                      {signed(s.gd, 0)}
                    </td>
                    <td className={cell(isLead(s.gfPer, leaders.gfPer.value))}>
                      {fmt(s.gfPer, 2)}
                    </td>
                    <td className={cell(isLead(s.gaPer, leaders.gaPer.value))}>
                      {fmt(s.gaPer, 2)}
                    </td>
                    <td className={cell(isLead(s.csRate, leaders.csRate.value))}>
                      {pct(s.csRate, 2)}
                    </td>
                    {hasXg && (
                      <>
                        <td className={cell(isLead(s.xg, leaders.xg.value))}>
                          {fmt(s.xg, 2)}
                        </td>
                        <td className={cell(isLead(s.xga, leaders.xga.value))}>
                          {fmt(s.xga, 2)}
                        </td>
                        <td className={cell(isLead(s.xgd, leaders.xgd.value))}>
                          {signed(s.xgd, 2)}
                        </td>
                      </>
                    )}
                    <td className={cell(isLead(ls?.sh ?? null, leaders.sh.value))}>
                      {logShow(ls?.sh ?? null)}
                    </td>
                    <td className={cell(isLead(ls?.sot ?? null, leaders.sot.value))}>
                      {logShow(ls?.sot ?? null)}
                    </td>
                    <td className={cell(isLead(ls?.sota ?? null, leaders.sota.value))}>
                      {logShow(ls?.sota ?? null)}
                    </td>
                    <td className={cell(isLead(ls?.saves ?? null, leaders.saves.value))}>
                      {logShow(ls?.saves ?? null)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ----------------------------------------- Side-by-Side Detail Cards */}
      <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {orderedEffective.map((season) => {
          const s = stats[season];
          const ls = logStats[season];
          const color = getColor(season);
          if (!s) return null;
          const logShow = (v: number | null): string => (ls.loading ? '…' : fmt(v, 0));
          return (
            <article
              key={season}
              className="min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none sm:p-5"
              style={{ borderTopWidth: 3, borderTopColor: color }}
            >
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="flex items-center gap-2 font-display text-lg font-bold text-primary">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <span>{season}</span>
                  <span className="text-xs font-medium text-muted">
                    · {t('compare.statTitle').replace('{matchweek}', String(s.mp))}
                  </span>
                </h4>
                <span className="rounded-full bg-bg-secondary px-2.5 py-0.5 text-xs font-bold tabular-nums text-primary">
                  {fmt(s.ppg, 2)} {L('แต้ม/นัด', 'PPG')}
                </span>
              </div>

              {/* Proportional W-D-L Bar */}
              {s.mp > 0 && (
                <div className="mb-4">
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-bg-secondary" aria-hidden>
                    {s.w > 0 && (
                      <span style={{ width: `${(s.w / s.mp) * 100}%`, background: 'var(--success)' }} />
                    )}
                    {s.d > 0 && (
                      <span style={{ width: `${(s.d / s.mp) * 100}%`, background: 'var(--chart-neutral)' }} />
                    )}
                    {s.l > 0 && (
                      <span style={{ width: `${(s.l / s.mp) * 100}%`, background: 'var(--danger)' }} />
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-4">
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
                    {t('compare.groupResults')}
                  </p>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    <StatTile label={t('compare.w')} value={fmt(s.w, 0)} />
                    <StatTile label={t('compare.d')} value={fmt(s.d, 0)} />
                    <StatTile label={t('compare.l')} value={fmt(s.l, 0)} />
                    <StatTile
                      label={t('compare.points')}
                      value={fmt(s.points, 0)}
                      highlight={isLead(s.points, leaders.pts.value)}
                    />
                    <StatTile
                      label={t('compare.winRate')}
                      value={pct(s.winRate, 2)}
                      highlight={isLead(s.winRate, leaders.winRate.value)}
                    />
                    <StatTile label={t('compare.drawRate')} value={pct(s.drawRate, 2)} />
                    <StatTile label={t('compare.lossRate')} value={pct(s.lossRate, 2)} />
                    <StatTile
                      label={t('compare.gd')}
                      value={signed(s.gd, 0)}
                      highlight={isLead(s.gd, leaders.gd.value)}
                    />
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
                    {t('compare.groupAttack')}
                  </p>
                  <div className={`grid gap-2.5 ${hasXg ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
                    <StatTile
                      label={t('compare.gf')}
                      value={fmt(s.gf, 0)}
                      highlight={isLead(s.gf, leaders.gf.value)}
                    />
                    <StatTile
                      label={t('compare.sh')}
                      value={logShow(ls.sh)}
                      highlight={isLead(ls.sh, leaders.sh.value)}
                    />
                    <StatTile
                      label={t('compare.sot')}
                      value={logShow(ls.sot)}
                      highlight={isLead(ls.sot, leaders.sot.value)}
                    />
                    {hasXg && (
                      <StatTile
                        label="xG"
                        value={fmt(s.xg, 2)}
                        highlight={isLead(s.xg, leaders.xg.value)}
                      />
                    )}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
                    {t('compare.groupDefence')}
                  </p>
                  <div className={`grid gap-2.5 ${hasXg ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
                    <StatTile
                      label={t('compare.ga')}
                      value={fmt(s.ga, 0)}
                      highlight={isLead(s.ga, leaders.ga.value)}
                    />
                    <StatTile
                      label={t('compare.sota')}
                      value={logShow(ls.sota)}
                      highlight={isLead(ls.sota, leaders.sota.value)}
                    />
                    <StatTile
                      label={t('compare.saves')}
                      value={logShow(ls.saves)}
                      highlight={isLead(ls.saves, leaders.saves.value)}
                    />
                    {hasXg && (
                      <StatTile
                        label="xGA"
                        value={fmt(s.xga, 2)}
                        highlight={isLead(s.xga, leaders.xga.value)}
                      />
                    )}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <footer>
        <p className="text-xs text-muted">{t('compare.note')}</p>
      </footer>
    </main>
  );
}
