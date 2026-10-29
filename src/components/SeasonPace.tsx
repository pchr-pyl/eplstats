'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  TooltipContentProps,
} from 'recharts';
import { useI18n } from '@/i18n/I18nContext';
import { useClub, useClubData } from '@/components/ClubProvider';
import { LOAD_FAILED, loadMatchlogs } from '@/components/matchlog-shared';
import { seasonShort } from '@/lib/stats';
import { fmt, pct, signed } from '@/lib/format';
import type { MatchRow } from '@/lib/types';
import {
  RACE_BY_KEY,
  RACE_DEFS,
  aggregate,
  bySeason,
  cumSeries,
  extrasFrom,
  metricOfAgg,
  playedPl,
} from '@/lib/pace';
import type {
  ExtrasMap,
  MatchExtras,
  PaceSide,
  RaceMetric,
  WinAgg,
} from '@/lib/pace';

const seasonLabel = (s: string) => `${s.slice(0, 5)}${s.slice(-2)}`;

type Vars = Record<string, string | number>;
const fill = (s: string, v: Vars) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ''));

const ord = (x: number): string => {
  const s = String(x);
  if (x % 100 >= 11 && x % 100 <= 13) return `${s}th`;
  const suffix = ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[x % 10] ?? 'th';
  return `${s}${suffix}`;
};

/* ------------------------------------------------ metric/card config per side */

interface CardDef {
  label: string;
  kind: 'int' | 'dec' | 'pct';
  /** true = lower better, false = higher better, null = neutral (no delta color) */
  lower: boolean | null;
  get: (a: WinAgg) => number | null;
  per: (a: WinAgg) => number | null;
  cov: (a: WinAgg) => [number, number] | null;
}

const noCov = () => null;
const covXg = (a: WinAgg): [number, number] => [a.xgN, a.k];
const covSh = (a: WinAgg): [number, number] => [a.shN, a.k];
const covShA = (a: WinAgg): [number, number] => [a.shAN, a.k];
const covK = (a: WinAgg): [number, number] => [a.kN, a.k];
const noPer = () => null;

const CARDS: Record<PaceSide, CardDef[]> = {
  attack: [
    { label: 'Pts', kind: 'int', lower: false, get: (a) => a.pts, per: (a) => (a.k ? a.pts / a.k : null), cov: noCov },
    { label: 'GF', kind: 'int', lower: false, get: (a) => a.gf, per: (a) => (a.k ? a.gf / a.k : null), cov: noCov },
    { label: 'xG', kind: 'dec', lower: false, get: (a) => (a.xgN ? a.xg : null), per: (a) => (a.xgN ? a.xg / a.xgN : null), cov: covXg },
    { label: 'GF−xG', kind: 'dec', lower: false, get: (a) => (a.xgN ? a.gf - a.xg : null), per: noPer, cov: noCov },
    { label: 'Sh', kind: 'int', lower: false, get: (a) => (a.shN ? a.sh : null), per: (a) => (a.shN ? a.sh / a.shN : null), cov: covSh },
    { label: 'SoT', kind: 'int', lower: false, get: (a) => (a.shN ? a.sot : null), per: (a) => (a.shN ? a.sot / a.shN : null), cov: covSh },
    { label: 'SoT%', kind: 'pct', lower: false, get: (a) => (a.shN && a.sh ? a.sot / a.sh : null), per: noPer, cov: covSh },
    { label: 'G/Sh', kind: 'dec', lower: false, get: (a) => (a.shN && a.sh ? a.shGf / a.sh : null), per: noPer, cov: covSh },
  ],
  defense: [
    { label: 'Pts', kind: 'int', lower: false, get: (a) => a.pts, per: (a) => (a.k ? a.pts / a.k : null), cov: noCov },
    { label: 'GA', kind: 'int', lower: true, get: (a) => a.ga, per: (a) => (a.k ? a.ga / a.k : null), cov: noCov },
    { label: 'xGA', kind: 'dec', lower: true, get: (a) => (a.xgN ? a.xga : null), per: (a) => (a.xgN ? a.xga / a.xgN : null), cov: covXg },
    { label: 'GA−xGA', kind: 'dec', lower: true, get: (a) => (a.xgN ? a.ga - a.xga : null), per: noPer, cov: noCov },
    { label: 'ShA', kind: 'int', lower: true, get: (a) => (a.shAN ? a.shA : null), per: (a) => (a.shAN ? a.shA / a.shAN : null), cov: covShA },
    { label: 'SoTA', kind: 'int', lower: true, get: (a) => (a.kN ? a.sotA : null), per: (a) => (a.kN ? a.sotA / a.kN : null), cov: covK },
    { label: 'Saves', kind: 'int', lower: null, get: (a) => (a.kN ? a.saves : null), per: (a) => (a.kN ? a.saves / a.kN : null), cov: covK },
    { label: 'Save%', kind: 'pct', lower: false, get: (a) => (a.kN && a.sotA ? a.saves / a.sotA : null), per: noPer, cov: covK },
    { label: 'CS', kind: 'int', lower: false, get: (a) => a.cs, per: (a) => (a.k ? a.cs / a.k : null), cov: noCov },
  ],
};

/** like-for-like per-season value columns (after the score column). */
interface LikeCol {
  label: string;
  dec: number;
  get: (m: MatchRow, e: MatchExtras | undefined) => number | null;
}
const LIKE_COLS: Record<PaceSide, LikeCol[]> = {
  attack: [
    { label: 'xG', dec: 2, get: (m) => m.xg },
    { label: 'Sh', dec: 0, get: (_m, e) => e?.sh ?? null },
  ],
  defense: [
    { label: 'xGA', dec: 2, get: (m) => m.xga },
    { label: 'ShA', dec: 0, get: (_m, e) => e?.shA ?? null },
  ],
};

/* ------------------------------------------------ ui bits */

function Seg<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { v: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex rounded-lg border border-border bg-surface p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          aria-pressed={value === o.v}
          onClick={() => onChange(o.v)}
          className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-brand ${
            value === o.v
              ? 'bg-surface-elevated font-medium text-primary shadow-sm dark:shadow-none'
              : 'text-muted hover:text-secondary'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function fmtKind(v: number | null, kind: CardDef['kind']): string {
  if (v == null) return '—';
  if (kind === 'pct') return pct(v, 2);
  return fmt(v, kind === 'int' ? 0 : 2);
}

function RaceTooltip({ side, metric }: { side: PaceSide; metric: RaceMetric }) {
  const dec = RACE_BY_KEY[side][metric].dec;
  return function Tip({ active, payload, label }: TooltipContentProps) {
    if (!active || !payload?.length) return null;
    const items = [...payload]
      .filter((e) => typeof e.value === 'number')
      .sort((a, b) => (b.value as number) - (a.value as number));
    return (
      <div className="rounded-lg border border-border bg-surface-elevated p-3 shadow-sm">
        <p className="mb-1 text-xs font-semibold text-primary">
          {RACE_BY_KEY[side][metric].label} · {label}
        </p>
        <div className="flex flex-col gap-0.5">
          {items.map((e, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: e.color ?? e.stroke }}
              />
              <span className="text-secondary">{e.name}:</span>
              <span className="ml-auto font-semibold tabular-nums text-primary">
                {fmt(e.value as number, dec)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };
}

/* ------------------------------------------------ main */

export function SeasonPace({ side }: { side: PaceSide }) {
  const { t, lang } = useI18n();
  const { club } = useClub();
  const { matches } = useClubData();
  const cards = CARDS[side];
  const raceDefs = RACE_DEFS[side];
  const likeCols = LIKE_COLS[side];

  const games = useMemo(() => playedPl(matches), [matches]);
  const seasonMap = useMemo(() => bySeason(games), [games]);
  const scope = useMemo(() => [...seasonMap.keys()].sort(), [seasonMap]);
  const scopeKey = scope.join('|');
  const current = scope[scope.length - 1] ?? '';
  const curGames = useMemo(() => seasonMap.get(current) ?? [], [seasonMap, current]);
  const playedCur = curGames.length;

  const [nRaw, setN] = useState<number | null>(null);
  const [cmpRaw, setCmp] = useState<string | null>(null);
  const [metric, setMetric] = useState<RaceMetric>('pts');
  const [showAll, setShowAll] = useState(true);
  const [range, setRange] = useState<'early' | 'full'>('early');

  const n = Math.min(38, Math.max(1, nRaw ?? playedCur ?? 1));
  const compare = cmpRaw ?? scope[scope.length - 2] ?? null;
  const cmpGames = useMemo(
    () => (compare ? (seasonMap.get(compare) ?? []) : []),
    [seasonMap, compare],
  );
  const xMax = range === 'early' ? Math.min(38, Math.max(n + 5, 10)) : 38;

  const [extrasMaps, setExtrasMaps] = useState<Record<string, ExtrasMap> | null>(null);
  useEffect(() => {
    let live = true;
    const seasons = scopeKey ? scopeKey.split('|') : [];
    Promise.all(seasons.map((s) => loadMatchlogs(club.slug, s))).then((res) => {
      if (!live) return;
      const rec: Record<string, ExtrasMap> = {};
      res.forEach((r, i) => {
        rec[seasons[i]] = extrasFrom(r === LOAD_FAILED ? null : r);
      });
      setExtrasMaps(rec);
    });
    return () => {
      live = false;
    };
  }, [club.slug, scopeKey]);

  const aggs = useMemo(
    () =>
      scope.map((s) =>
        aggregate(s, seasonMap.get(s) ?? [], extrasMaps?.[s] ?? null, n),
      ),
    [scope, seasonMap, extrasMaps, n],
  );
  const curAgg = aggs.find((a) => a.season === current);
  const cmpAgg = aggs.find((a) => a.season === compare) ?? null;

  const chartData = useMemo(() => {
    const series = new Map<string, number[]>();
    for (const s of scope) {
      series.set(s, cumSeries(seasonMap.get(s) ?? [], extrasMaps?.[s] ?? null, metric));
    }
    const rows: Record<string, number>[] = [];
    for (let k = 1; k <= xMax; k += 1) {
      const row: Record<string, number> = { k };
      for (const [s, arr] of series) {
        const v = arr[k - 1];
        if (v != null) row[s] = v;
      }
      rows.push(row);
    }
    return rows;
  }, [scope, seasonMap, extrasMaps, metric, xMax]);

  const metricDef = RACE_BY_KEY[side][metric];
  const ranked = useMemo(() => {
    const copy = [...aggs];
    copy.sort((a, b) => {
      const av = metricOfAgg(a, metric);
      const bv = metricOfAgg(b, metric);
      return metricDef.lower ? av - bv : bv - av;
    });
    return copy;
  }, [aggs, metric, metricDef.lower]);
  const curRank = ranked.findIndex((a) => a.season === current) + 1;

  const likeRows = useMemo(() => {
    const find = (m: MatchRow) =>
      cmpGames.find((c) => c.opponent === m.opponent && c.venue === m.venue) ?? null;
    return curGames.slice(0, n).map((m, i) => ({ k: i + 1, cur: m, cmp: find(m) }));
  }, [curGames, cmpGames, n]);

  const likeTotals = useMemo(() => {
    const sums = likeCols.map(() => ({ cur: 0, cmp: 0, n: 0 }));
    let mp = 0;
    let cp = 0;
    let cmpPts = 0;
    for (const r of likeRows) {
      if (!r.cmp) continue;
      mp += 1;
      cp += r.cur.result === 'W' ? 3 : r.cur.result === 'D' ? 1 : 0;
      cmpPts += r.cmp.result === 'W' ? 3 : r.cmp.result === 'D' ? 1 : 0;
      likeCols.forEach((c, i) => {
        const vc = c.get(r.cur, extrasMaps?.[r.cur.season]?.get(r.cur.date));
        const vp = c.get(r.cmp!, extrasMaps?.[r.cmp!.season]?.get(r.cmp!.date));
        if (vc != null && vp != null) {
          sums[i].cur += vc;
          sums[i].cmp += vp;
          sums[i].n += 1;
        }
      });
    }
    return { mp, cp, cmpPts, sums };
  }, [likeRows, likeCols, extrasMaps]);

  const venue = (m: MatchRow) =>
    m.venue === 'Home' ? t('pace.home') : m.venue === 'Away' ? t('pace.away') : '—';
  const score = (m: MatchRow) => `${m.gf}–${m.ga}`;
  const ptsOf = (m: MatchRow) => (m.result === 'W' ? 3 : m.result === 'D' ? 1 : 0);
  const extrasOf = (m: MatchRow) => extrasMaps?.[m.season]?.get(m.date);

  const axisTick = { fill: 'var(--text-muted)', fontSize: 11 };
  const gridStroke = 'var(--border)';
  const others = scope.filter((s) => s !== current && s !== compare);

  if (!current) return null;

  return (
    <>
      {/* controls + duel cards */}
      <section className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-primary">
            {t('pace.title')}
            <span className="rounded bg-bg-secondary px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-muted">
              PL
            </span>
          </h2>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5">
            <span className="text-sm text-muted">
              {fill(t('pace.afterN'), { n })}
            </span>
            <button
              type="button"
              aria-label="decrease"
              onClick={() => setN(Math.max(1, n - 1))}
              className="rounded px-1.5 text-muted hover:text-primary focus-visible:outline-2 focus-visible:outline-brand"
            >
              −
            </button>
            <input
              type="range"
              min={1}
              max={38}
              value={n}
              onChange={(e) => setN(Number(e.target.value))}
              aria-label="N"
              className="w-32 accent-[var(--brand)]"
            />
            <button
              type="button"
              aria-label="increase"
              onClick={() => setN(Math.min(38, n + 1))}
              className="rounded px-1.5 text-muted hover:text-primary focus-visible:outline-2 focus-visible:outline-brand"
            >
              +
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            {t('pace.compareVs')}
            <select
              value={compare ?? ''}
              onChange={(e) => setCmp(e.target.value)}
              className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-primary focus-visible:outline-2 focus-visible:outline-brand"
            >
              {scope
                .filter((s) => s !== current)
                .map((s) => (
                  <option key={s} value={s}>
                    {seasonLabel(s)}
                  </option>
                ))}
            </select>
          </label>
          <Seg
            label={t('pace.raceMetric')}
            value={metric}
            onChange={setMetric}
            options={raceDefs.map((d) => ({ v: d.key, label: d.label }))}
          />
          <label className="flex cursor-pointer items-center gap-1.5 text-sm text-muted">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="accent-[var(--brand)]"
            />
            {t('pace.showAll')}
          </label>
        </div>
        <p className="-mt-2 text-xs text-muted">{t('pace.plOnly')}</p>

        <div className="flex flex-col gap-3">
          <h3 className="font-display text-lg font-semibold text-primary">
            {fill(t('pace.duelTitle'), {
              cur: seasonLabel(current),
              cmp: compare ? seasonLabel(compare) : '—',
              n,
            })}
          </h3>
          {playedCur < n && (
            <p className="text-xs text-warning">
              {fill(t('pace.currentShort'), {
                cur: seasonLabel(current),
                n: playedCur,
              })}
            </p>
          )}
          {curAgg && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {cards.map((c) => {
                const cur = c.get(curAgg);
                const cmp = cmpAgg ? c.get(cmpAgg) : null;
                const delta = cur != null && cmp != null ? cur - cmp : null;
                const better =
                  delta == null || c.lower == null
                    ? false
                    : c.lower
                      ? delta < 0
                      : delta > 0;
                const worse =
                  delta == null || c.lower == null
                    ? false
                    : c.lower
                      ? delta > 0
                      : delta < 0;
                const deltaText =
                  delta == null
                    ? '—'
                    : c.kind === 'pct'
                      ? `${signed(delta * 100, 2)} pt`
                      : signed(delta, c.kind === 'int' ? 0 : 2);
                const cov = c.cov(curAgg);
                const cmpCov = cmpAgg ? c.cov(cmpAgg) : null;
                return (
                  <div
                    key={c.label}
                    className="flex flex-col rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none"
                  >
                    <span className="text-xs font-medium text-muted">{c.label}</span>
                    <span className="mt-2 font-body text-2xl font-bold text-primary">
                      {fmtKind(cur, c.kind)}
                      {cov && cur != null && cov[0] < cov[1] && (
                        <span className="ml-1 text-xs font-normal text-muted">
                          ({cov[0]}/{cov[1]})
                        </span>
                      )}
                    </span>
                    <span className="mt-1 text-xs text-muted">
                      {t('pace.vsShort')} {compare ? seasonLabel(compare) : '—'}:{' '}
                      <span className="font-medium text-secondary">
                        {fmtKind(cmp, c.kind)}
                        {cmpCov && cmp != null && cmpCov[0] < cmpCov[1] &&
                          ` (${cmpCov[0]}/${cmpCov[1]})`}
                      </span>
                    </span>
                    <span
                      className={`mt-1 text-sm font-semibold tabular-nums ${
                        better ? 'text-success' : worse ? 'text-danger' : 'text-muted'
                      }`}
                    >
                      {deltaText}
                    </span>
                    {c.per(curAgg) != null && (
                      <span className="text-[11px] text-muted">
                        {fmt(c.per(curAgg), 2)} {t('pace.perGame')}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* race chart */}
      <section className="min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none">
        <div className="mb-3 flex flex-wrap items-center gap-4">
          <h3 className="font-display text-lg font-semibold text-primary">
            {fill(t('pace.raceTitle'), { metric: metricDef.label })}
          </h3>
          <Seg
            label="x-range"
            value={range}
            onChange={setRange}
            options={[
              { v: 'early', label: t('pace.range.early') },
              { v: 'full', label: t('pace.range.full') },
            ]}
          />
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <span className="inline-block h-0.5 w-5" style={{ background: 'var(--brand)' }} />
            {seasonShort(current)}
          </span>
          {compare && (
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <span
                className="inline-block h-0 w-5 border-t-2 border-dashed"
                style={{ borderColor: 'var(--info)' }}
              />
              {seasonShort(compare)}
            </span>
          )}
          {showAll && others.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <span
                className="inline-block h-0.5 w-5 opacity-40"
                style={{ background: 'var(--text-muted)' }}
              />
              {t('pace.otherSeasons')}
            </span>
          )}
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="k"
              type="number"
              domain={[1, xMax]}
              tick={axisTick}
              axisLine={{ stroke: gridStroke }}
              tickLine={false}
              tickCount={10}
            />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} width={36} />
            <Tooltip content={RaceTooltip({ side, metric })} />
            <ReferenceLine
              x={n}
              stroke="var(--text-muted)"
              strokeDasharray="4 4"
              label={{ value: `N=${n}`, position: 'top', fill: 'var(--text-muted)', fontSize: 11 }}
            />
            {showAll &&
              others.map((s) => (
                <Line
                  key={s}
                  type="monotone"
                  dataKey={s}
                  name={seasonShort(s)}
                  stroke="var(--text-muted)"
                  strokeOpacity={0.35}
                  strokeWidth={1}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            {compare && (
              <Line
                type="monotone"
                dataKey={compare}
                name={seasonShort(compare)}
                stroke="var(--info)"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                isAnimationActive={false}
              />
            )}
            <Line
              type="monotone"
              dataKey={current}
              name={seasonShort(current)}
              stroke="var(--brand)"
              strokeWidth={3}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </section>

      {/* ranking table */}
      <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm dark:shadow-none">
        <div className="border-b border-border px-4 py-3">
          <h3 className="font-display text-lg font-semibold text-primary">
            {fill(t('pace.rankTitle'), { n })}
          </h3>
          {curRank > 0 && (
            <p className="mt-0.5 text-xs text-muted">
              {fill(t('pace.rankBadge'), {
                rank: lang === 'th' ? curRank : ord(curRank),
                total: scope.length,
                metric: metricDef.label,
              })}
            </p>
          )}
        </div>
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead className="sticky top-0 z-10 bg-surface-elevated">
              <tr>
                <th className="whitespace-nowrap border-b border-border px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                  #
                </th>
                <th className="whitespace-nowrap border-b border-border px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                  {t('pace.season')}
                </th>
                <th className="whitespace-nowrap border-b border-border px-2.5 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted">
                  {cards[0].label}
                </th>
                <th className="whitespace-nowrap border-b border-border px-2.5 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted">
                  W-D-L
                </th>
                {cards.slice(1).map((c) => (
                  <th
                    key={c.label}
                    className="whitespace-nowrap border-b border-border px-2.5 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted"
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ranked.map((a, i) => {
                const isCur = a.season === current;
                const isCmp = a.season === compare;
                return (
                  <tr
                    key={a.season}
                    className="border-b border-border"
                    style={
                      isCur
                        ? { background: 'var(--brand-soft)' }
                        : isCmp
                          ? { background: 'var(--info-soft)' }
                          : undefined
                    }
                  >
                    <td className="px-2.5 py-2 text-xs tabular-nums text-muted">{i + 1}</td>
                    <td className="whitespace-nowrap px-2.5 py-2 text-xs font-semibold text-primary">
                      {seasonLabel(a.season)}
                      {isCur && <span className="ml-1 text-[10px] text-brand">●</span>}
                    </td>
                    <td className="px-2.5 py-2 text-right text-xs tabular-nums text-secondary">
                      {fmtKind(cards[0].get(a), cards[0].kind)}
                    </td>
                    <td className="px-2.5 py-2 text-right text-xs tabular-nums text-secondary">
                      {a.w}-{a.d}-{a.l}
                    </td>
                    {cards.slice(1).map((c) => {
                      const v = c.get(a);
                      const cv = c.cov(a);
                      return (
                        <td
                          key={c.label}
                          className="px-2.5 py-2 text-right text-xs tabular-nums text-secondary"
                        >
                          {c.label === 'GF−xG' || c.label === 'GA−xGA'
                            ? v != null
                              ? signed(v)
                              : '—'
                            : fmtKind(v, c.kind)}
                          {cv && v != null && cv[0] < cv[1] && (
                            <span className="text-muted"> ({cv[0]}/{cv[1]})</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* like-for-like */}
      {compare && (
        <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm dark:shadow-none">
          <div className="border-b border-border px-4 py-3">
            <h3 className="font-display text-lg font-semibold text-primary">
              {t('pace.likeTitle')}
            </h3>
            <p className="mt-0.5 text-xs text-muted">{t('pace.likeNote')}</p>
          </div>
          <div className="overflow-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <thead className="bg-surface-elevated">
                <tr>
                  <th className="whitespace-nowrap border-b border-border px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                    {t('pace.gw')}
                  </th>
                  <th className="whitespace-nowrap border-b border-border px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                    {t('pace.opponent')}
                  </th>
                  <th className="whitespace-nowrap border-b border-border px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                    {t('pace.venue')}
                  </th>
                  <th className="whitespace-nowrap border-b border-border px-2.5 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted">
                    {seasonLabel(current)}
                  </th>
                  {likeCols.map((c) => (
                    <th
                      key={`c-${c.label}`}
                      className="whitespace-nowrap border-b border-border px-2.5 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted"
                    >
                      {c.label}
                    </th>
                  ))}
                  <th className="whitespace-nowrap border-b border-border px-2.5 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted">
                    {seasonLabel(compare)}
                  </th>
                  {likeCols.map((c) => (
                    <th
                      key={`p-${c.label}`}
                      className="whitespace-nowrap border-b border-border px-2.5 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted"
                    >
                      {c.label}
                    </th>
                  ))}
                  <th className="whitespace-nowrap border-b border-border px-2.5 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted">
                    {t('pace.deltaPts')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {likeRows.map((r) => {
                  const d = r.cmp ? ptsOf(r.cur) - ptsOf(r.cmp) : null;
                  return (
                    <tr key={r.k} className="border-b border-border">
                      <td className="px-2.5 py-2 text-xs tabular-nums text-muted">{r.k}</td>
                      <td className="whitespace-nowrap px-2.5 py-2 text-xs font-medium text-primary">
                        {r.cur.opponent ?? '—'}
                      </td>
                      <td className="px-2.5 py-2 text-xs text-muted">{venue(r.cur)}</td>
                      <td className="px-2.5 py-2 text-right text-xs tabular-nums text-secondary">
                        {score(r.cur)}
                      </td>
                      {likeCols.map((c) => (
                        <td
                          key={`c-${c.label}`}
                          className="px-2.5 py-2 text-right text-xs tabular-nums text-secondary"
                        >
                          {fmt(c.get(r.cur, extrasOf(r.cur)), c.dec)}
                        </td>
                      ))}
                      {r.cmp ? (
                        <>
                          <td className="px-2.5 py-2 text-right text-xs tabular-nums text-secondary">
                            {score(r.cmp)}
                          </td>
                          {likeCols.map((c) => (
                            <td
                              key={`p-${c.label}`}
                              className="px-2.5 py-2 text-right text-xs tabular-nums text-secondary"
                            >
                              {fmt(c.get(r.cmp!, extrasOf(r.cmp!)), c.dec)}
                            </td>
                          ))}
                          <td
                            className={`px-2.5 py-2 text-right text-xs font-semibold tabular-nums ${
                              d! > 0 ? 'text-success' : d! < 0 ? 'text-danger' : 'text-muted'
                            }`}
                          >
                            {signed(d, 0)}
                          </td>
                        </>
                      ) : (
                        <td
                          colSpan={likeCols.length + 2}
                          className="px-2.5 py-2 text-right text-xs text-muted"
                        >
                          {t('pace.noFixture')}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-surface-elevated">
                  <td colSpan={3} className="px-2.5 py-2 text-xs font-semibold text-primary">
                    {t('pace.matchedPairs')} {likeTotals.mp}/{likeRows.length}
                  </td>
                  <td className="px-2.5 py-2 text-right text-xs font-semibold tabular-nums text-primary">
                    {likeTotals.cp} pts
                  </td>
                  {likeTotals.sums.map((s, i) => (
                    <td
                      key={`tc-${i}`}
                      className="px-2.5 py-2 text-right text-xs font-semibold tabular-nums text-primary"
                    >
                      {s.n ? fmt(s.cur, likeCols[i].dec) : '—'}
                    </td>
                  ))}
                  <td className="px-2.5 py-2 text-right text-xs font-semibold tabular-nums text-primary">
                    {likeTotals.cmpPts} pts
                  </td>
                  {likeTotals.sums.map((s, i) => (
                    <td
                      key={`tp-${i}`}
                      className="px-2.5 py-2 text-right text-xs font-semibold tabular-nums text-primary"
                    >
                      {s.n ? fmt(s.cmp, likeCols[i].dec) : '—'}
                    </td>
                  ))}
                  <td
                    className={`px-2.5 py-2 text-right text-xs font-semibold tabular-nums ${
                      likeTotals.cp - likeTotals.cmpPts > 0
                        ? 'text-success'
                        : likeTotals.cp - likeTotals.cmpPts < 0
                          ? 'text-danger'
                          : 'text-muted'
                    }`}
                  >
                    {signed(likeTotals.cp - likeTotals.cmpPts, 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
