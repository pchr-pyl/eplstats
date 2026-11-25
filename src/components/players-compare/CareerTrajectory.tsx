'use client';

import { useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import type { ClubIndexEntry } from '@/lib/types';
import { fmt } from '@/lib/format';
import { seasonShort } from '@/lib/stats';
import { ClubCrest } from './PlayerPicker';
import { buildDemoPool, type DemoPlayer, type PcSeason } from './types';

type TrendKey = 'ga90' | 'gls90' | 'ast90' | 'ga' | 'min';

const TREND_METRICS: { id: TrendKey; en: string; th: string; int?: boolean }[] = [
  { id: 'ga90', en: 'G+A / 90', th: 'G+A / 90' },
  { id: 'gls90', en: 'Goals / 90', th: 'ประตู / 90' },
  { id: 'ast90', en: 'Assists / 90', th: 'แอสซิสต์ / 90' },
  { id: 'ga', en: 'Total G+A', th: 'รวม G+A', int: true },
  { id: 'min', en: 'Minutes', th: 'นาทีลงเล่น', int: true },
];

interface CareerPoint {
  season: string;
  player: DemoPlayer;
  val: number | null;
}

function getVal(p: DemoPlayer, k: TrendKey): number | null {
  if (k === 'ga') return p.gls + p.ast;
  if (k === 'min') return p.min;
  return p.v[k] ?? null;
}

export function CareerTrajectory({
  A,
  B,
  seasonA,
  seasonB,
  seasons,
  seasonsCache,
  loadingAll,
  clubs,
  colorA,
  colorB,
  th,
  onSelectSeasonPoint,
}: {
  A: DemoPlayer;
  B: DemoPlayer;
  seasonA: string;
  seasonB: string;
  seasons: string[];
  seasonsCache: Record<string, PcSeason>;
  loadingAll: boolean;
  clubs: Map<string, ClubIndexEntry>;
  colorA: string;
  colorB: string;
  th: boolean;
  onSelectSeasonPoint: (slot: 'A' | 'B', season: string, key: string) => void;
}) {
  const [metric, setMetric] = useState<TrendKey>('ga90');
  const [hoverSeason, setHoverSeason] = useState<string | null>(null);

  const metricMeta = TREND_METRICS.find((m) => m.id === metric) ?? TREND_METRICS[0];
  const samePlayer = A.name === B.name;

  const { seriesA, seriesB, visibleSeasons, maxVal } = useMemo(() => {
    const mapA = new Map<string, CareerPoint>();
    const mapB = new Map<string, CareerPoint>();

    for (const s of seasons) {
      const raw = seasonsCache[s];
      if (!raw) continue;
      const pool = buildDemoPool(raw);
      // Match by exact name (handles transfers; if multiple rows in a split season, pick highest min)
      const matchesA = pool.filter((p) => p.name === A.name).sort((x, y) => y.min - x.min);
      if (matchesA[0]) {
        mapA.set(s, { season: s, player: matchesA[0], val: getVal(matchesA[0], metric) });
      }
      const matchesB = pool.filter((p) => p.name === B.name).sort((x, y) => y.min - x.min);
      if (matchesB[0]) {
        mapB.set(s, { season: s, player: matchesB[0], val: getVal(matchesB[0], metric) });
      }
    }

    const activeSeasons = seasons.filter((s) => mapA.has(s) || mapB.has(s));
    const vals: number[] = [];
    for (const pt of mapA.values()) if (pt.val != null) vals.push(pt.val);
    for (const pt of mapB.values()) if (pt.val != null) vals.push(pt.val);

    return {
      seriesA: mapA,
      seriesB: mapB,
      visibleSeasons: activeSeasons,
      maxVal: Math.max(metricMeta.int ? 5 : 0.4, ...vals) * 1.14,
    };
  }, [seasons, seasonsCache, A.name, B.name, metric, metricMeta.int]);

  const W = 720;
  const H = 260;
  const pad = { l: 48, r: 24, t: 22, b: 36 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;

  const sx = (idx: number) =>
    visibleSeasons.length <= 1
      ? pad.l + iw / 2
      : pad.l + (idx / (visibleSeasons.length - 1)) * iw;
  const sy = (v: number) => pad.t + ih - (Math.max(0, v) / maxVal) * ih;

  const buildPath = (map: Map<string, CareerPoint>) => {
    const segs: string[] = [];
    let drawing = false;
    visibleSeasons.forEach((s, i) => {
      const pt = map.get(s);
      if (pt && pt.val != null) {
        segs.push(`${drawing ? 'L' : 'M'}${sx(i).toFixed(1)} ${sy(pt.val).toFixed(1)}`);
        drawing = true;
      } else {
        drawing = false;
      }
    });
    return segs.join(' ');
  };

  const fmtV = (v: number | null) => {
    if (v == null) return '—';
    return metricMeta.int ? String(Math.round(v)) : fmt(v, 2);
  };

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * maxVal);
  const inspectedSeason = hoverSeason ?? seasonA;
  const infoA = seriesA.get(inspectedSeason);
  const infoB = seriesB.get(inspectedSeason);

  const clubShort = (slug: string) => {
    const c = clubs.get(slug);
    return th ? c?.nameTh ?? c?.name ?? slug : c?.shortName ?? c?.name ?? slug;
  };

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
            <TrendingUp size={13} />
            {th ? 'เส้นทางพรีเมียร์ลีก 2014–2027' : 'PL Career Arc · 2014–2027'}
          </p>
          <h2 className="mt-0.5 font-display text-lg font-bold text-primary sm:text-xl">
            {samePlayer
              ? th
                ? `พัฒนาการรายฤดูกาลของ ${A.name}`
                : `${A.name} — Season-by-Season Evolution`
              : th
              ? 'กราฟฟอร์มรายฤดูกาลเทียบกัน'
              : 'Multi-Season Trajectory'}
          </h2>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {TREND_METRICS.map((tm) => (
            <button
              key={tm.id}
              type="button"
              onClick={() => setMetric(tm.id)}
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                tm.id === metric
                  ? 'border-primary bg-primary text-surface'
                  : 'border-border bg-bg-secondary text-secondary hover:text-primary'
              }`}
            >
              {th ? tm.th : tm.en}
            </button>
          ))}
        </div>
      </div>

      {visibleSeasons.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted">
          {loadingAll
            ? th
              ? 'กำลังโหลดประวัติทุกฤดูกาล...'
              : 'Loading all 13 Premier League seasons...'
            : '—'}
        </div>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="h-auto w-full min-w-[520px] select-none"
              role="img"
              aria-label={th ? 'กราฟเส้นทางรายฤดูกาล' : 'Career trajectory chart'}
            >
              {/* Y gridlines */}
              {yTicks.map((tv, i) => (
                <g key={i}>
                  <line
                    x1={pad.l}
                    x2={W - pad.r}
                    y1={sy(tv)}
                    y2={sy(tv)}
                    className="stroke-border/60"
                    strokeWidth={0.8}
                  />
                  <text
                    x={pad.l - 8}
                    y={sy(tv)}
                    textAnchor="end"
                    dominantBaseline="central"
                    className="fill-muted text-[10px] tabular-nums"
                  >
                    {metricMeta.int ? Math.round(tv) : fmt(tv, 2)}
                  </text>
                </g>
              ))}

              {/* Hover column guide */}
              {visibleSeasons.map((s, i) => {
                const x = sx(i);
                const isHover = s === hoverSeason;
                return (
                  <g key={s}>
                    {isHover && (
                      <line
                        x1={x}
                        x2={x}
                        y1={pad.t}
                        y2={H - pad.b}
                        className="stroke-primary/30"
                        strokeDasharray="3 3"
                      />
                    )}
                    <text
                      x={x}
                      y={H - 12}
                      textAnchor="middle"
                      className={`text-[10px] tabular-nums ${
                        s === seasonA || s === seasonB
                          ? 'fill-primary font-bold'
                          : 'fill-muted'
                      }`}
                    >
                      {seasonShort(s)}
                    </text>
                    {/* Invisible hover slice */}
                    <rect
                      x={x - iw / Math.max(2, visibleSeasons.length * 2)}
                      y={pad.t}
                      width={iw / Math.max(1, visibleSeasons.length)}
                      height={ih}
                      fill="transparent"
                      onMouseEnter={() => setHoverSeason(s)}
                      onMouseLeave={() => setHoverSeason(null)}
                    />
                  </g>
                );
              })}

              {/* Paths */}
              {!samePlayer && (
                <path
                  d={buildPath(seriesB)}
                  fill="none"
                  stroke={colorB}
                  strokeWidth={2.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              <path
                d={buildPath(seriesA)}
                fill="none"
                stroke={colorA}
                strokeWidth={2.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Points for B */}
              {visibleSeasons.map((s, i) => {
                const pt = seriesB.get(s);
                if (!pt || pt.val == null) return null;
                const pinned = s === seasonB;
                if (samePlayer && !pinned) return null;
                return (
                  <g
                    key={`b-${s}`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoverSeason(s)}
                    onClick={() => onSelectSeasonPoint('B', s, pt.player.key)}
                  >
                    {pinned && (
                      <circle
                        cx={sx(i)}
                        cy={sy(pt.val)}
                        r={10}
                        fill="none"
                        stroke={colorB}
                        strokeWidth={2}
                      />
                    )}
                    <circle
                      cx={sx(i)}
                      cy={sy(pt.val)}
                      r={pinned ? 5.5 : 4}
                      fill={colorB}
                      className="stroke-surface"
                      strokeWidth={1.6}
                    />
                  </g>
                );
              })}

              {/* Points for A */}
              {visibleSeasons.map((s, i) => {
                const pt = seriesA.get(s);
                if (!pt || pt.val == null) return null;
                const pinned = s === seasonA;
                return (
                  <g
                    key={`a-${s}`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoverSeason(s)}
                    onClick={() => onSelectSeasonPoint('A', s, pt.player.key)}
                  >
                    {pinned && (
                      <circle
                        cx={sx(i)}
                        cy={sy(pt.val)}
                        r={10}
                        fill="none"
                        stroke={colorA}
                        strokeWidth={2}
                      />
                    )}
                    <circle
                      cx={sx(i)}
                      cy={sy(pt.val)}
                      r={pinned ? 5.5 : 4}
                      fill={colorA}
                      className="stroke-surface"
                      strokeWidth={1.6}
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Readout bar */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-bg-secondary/70 px-3.5 py-2.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-surface px-2 py-0.5 font-bold tabular-nums text-primary shadow-xs">
                PL {seasonShort(inspectedSeason)}
              </span>
              {loadingAll && (
                <span className="text-[11px] text-muted">
                  {th ? 'กำลังโหลดฤดูกาลอื่น...' : 'Loading remaining seasons...'}
                </span>
              )}
              {!loadingAll && (
                <span className="hidden text-muted sm:inline">
                  {th
                    ? 'คลิกจุดบนกราฟเพื่อสลับไปเปรียบเทียบฤดูกาลนั้น'
                    : 'Click any dot to jump directly to that season.'}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 tabular-nums">
              {infoA && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorA }} />
                  <ClubCrest slug={infoA.player.club} size={15} />
                  <strong className="text-primary">{A.name.split(' ').slice(-1)[0]}</strong>
                  <span className="text-muted">({clubShort(infoA.player.club)})</span>
                  <strong className="text-primary">{fmtV(infoA.val)}</strong>
                  <span className="text-muted">
                    [{infoA.player.gls}G {infoA.player.ast}A · {infoA.player.min}&apos;]
                  </span>
                </span>
              )}
              {!samePlayer && infoB && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorB }} />
                  <ClubCrest slug={infoB.player.club} size={15} />
                  <strong className="text-primary">{B.name.split(' ').slice(-1)[0]}</strong>
                  <span className="text-muted">({clubShort(infoB.player.club)})</span>
                  <strong className="text-primary">{fmtV(infoB.val)}</strong>
                  <span className="text-muted">
                    [{infoB.player.gls}G {infoB.player.ast}A · {infoB.player.min}&apos;]
                  </span>
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
