'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Flame, LineChart as LineChartIcon } from 'lucide-react';
import type { ClubIndexEntry } from '@/lib/types';
import type { XgRaceClub } from '@/lib/insights';
import type { PointsRaceClub, TableInsightRow } from '@/lib/insightsExtended';
import { fmt } from '@/lib/format';
import { ClubCrest } from '@/components/LeagueHome';
import { useTheme } from '@/components/ThemeProvider';

type RacePreset = 'title' | 'europe' | 'relegation';
type LuckMode = 'att' | 'def' | 'net';

const FALLBACK_COLORS = ['#ef4444', '#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

export function RacesAndLuck({
  pointsRace,
  table,
  xgRace,
  clubs,
  th,
}: {
  pointsRace: PointsRaceClub[];
  table: TableInsightRow[];
  xgRace: XgRaceClub[];
  clubs: Map<string, ClubIndexEntry>;
  th: boolean;
}) {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [preset, setPreset] = useState<RacePreset>('title');
  const [hoverMp, setHoverMp] = useState<number | null>(null);
  const [luckMode, setLuckMode] = useState<LuckMode>('att');
  const [xgClub, setXgClub] = useState<string>(table[0]?.slug ?? xgRace[0]?.slug ?? '');

  const nameOf = (slug: string) => {
    const c = clubs.get(slug);
    return th && c?.nameTh ? c.nameTh : c?.shortName ?? c?.name ?? slug;
  };

  const colorOf = (slug: string, idx: number) => {
    const c = clubs.get(slug);
    return (dark ? c?.brandDark : c?.brandLight) || c?.color || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
  };

  // Pick clubs for the Points Race preset
  const activeClubs = useMemo(() => {
    if (preset === 'title') return pointsRace.slice(0, 5);
    if (preset === 'europe') return pointsRace.slice(3, 9);
    return pointsRace.slice(-6);
  }, [pointsRace, preset]);

  const maxMp = useMemo(
    () => Math.max(1, ...activeClubs.map((c) => c.series.length)),
    [activeClubs],
  );
  const maxPts = useMemo(() => {
    const m = Math.max(10, ...activeClubs.flatMap((c) => c.series.map((p) => p.pts)));
    return Math.ceil(m / 5) * 5;
  }, [activeClubs]);

  // Diverging xG Luck data (all 20 clubs)
  const luckRows = useMemo(() => {
    return table
      .map((r) => ({
        row: r,
        val: luckMode === 'att' ? r.attLuck : luckMode === 'def' ? r.defLuck : r.netLuck,
      }))
      .filter((x): x is { row: TableInsightRow; val: number } => x.val != null)
      .sort((a, b) => b.val - a.val);
  }, [table, luckMode]);

  const maxLuck = useMemo(
    () => Math.max(1, ...luckRows.map((x) => Math.abs(x.val))),
    [luckRows],
  );

  // Single-club GF vs xG cumulative race
  const activeXgRace = xgRace.find((r) => r.slug === xgClub) ?? xgRace[0];
  const xgPts = activeXgRace?.points ?? [];
  const lastXgPt = xgPts.at(-1);

  // Points race SVG dims
  const W = 760;
  const H = 260;
  const pad = { l: 42, r: 22, t: 18, b: 34 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const sx = (mp: number) =>
    maxMp <= 1 ? pad.l + iw / 2 : pad.l + ((mp - 1) / (maxMp - 1)) * iw;
  const sy = (pts: number) => pad.t + ih - (pts / maxPts) * ih;

  const inspectedMp = hoverMp ?? maxMp;

  return (
    <div id="races" className="scroll-mt-24 space-y-6">
      {/* -------------------------------------- Multi-Club Points Race */}
      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
              <LineChartIcon size={13} />
              {th ? 'เส้นทางคะแนนสะสมรายนัด' : 'Cumulative Points Race'}
            </p>
            <h2 className="mt-0.5 font-display text-lg font-bold text-primary sm:text-xl">
              {th ? 'ศึกชิงแชมป์ โควตายุโรป และหนีตกชั้น' : 'Title, European & Survival Battles'}
            </h2>
          </div>

          <div className="inline-flex rounded-lg border border-border bg-bg-secondary p-0.5 text-xs font-bold">
            {(
              [
                ['title', th ? 'ลุ้นแชมป์ (Top 5)' : 'Title (Top 5)'],
                ['europe', th ? 'โควตายุโรป (#4–9)' : 'Europe (#4–9)'],
                ['relegation', th ? 'หนีตกชั้น (#15–20)' : 'Survival (#15–20)'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPreset(id)}
                className={`rounded-md px-2.5 py-1 transition-colors ${
                  preset === id
                    ? 'bg-surface text-primary shadow-sm'
                    : 'text-muted hover:text-primary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Legend chips */}
        <div className="mt-3.5 flex flex-wrap gap-3 text-xs">
          {activeClubs.map((c, idx) => (
            <Link
              key={c.slug}
              href={`/${c.slug}/`}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-secondary/60 px-2.5 py-1 font-semibold text-primary hover:border-primary/40"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: colorOf(c.slug, idx) }}
              />
              <ClubCrest slug={c.slug} size={14} />
              <span>{nameOf(c.slug)}</span>
              <span className="tabular-nums text-muted">{c.pts}</span>
            </Link>
          ))}
        </div>

        {/* SVG Chart */}
        <div className="mt-3 overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full min-w-[520px] select-none"
            role="img"
            aria-label={th ? 'กราฟเส้นทางคะแนนสะสม' : 'Cumulative points race chart'}
          >
            {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
              const v = Math.round(t * maxPts);
              return (
                <g key={i}>
                  <line
                    x1={pad.l}
                    x2={W - pad.r}
                    y1={sy(v)}
                    y2={sy(v)}
                    className="stroke-border/60"
                    strokeWidth={0.8}
                  />
                  <text
                    x={pad.l - 8}
                    y={sy(v)}
                    textAnchor="end"
                    dominantBaseline="central"
                    className="fill-muted text-[10px] tabular-nums"
                  >
                    {v}
                  </text>
                </g>
              );
            })}

            {/* Matchweek ticks + hover bands */}
            {Array.from({ length: maxMp }, (_, i) => i + 1).map((mp) => {
              const x = sx(mp);
              const showLabel =
                maxMp <= 14 || mp === 1 || mp === maxMp || mp % Math.ceil(maxMp / 10) === 0;
              return (
                <g key={mp}>
                  {hoverMp === mp && (
                    <line
                      x1={x}
                      x2={x}
                      y1={pad.t}
                      y2={H - pad.b}
                      className="stroke-primary/35"
                      strokeDasharray="3 3"
                    />
                  )}
                  {showLabel && (
                    <text
                      x={x}
                      y={H - 10}
                      textAnchor="middle"
                      className={`text-[10px] tabular-nums ${
                        mp === inspectedMp ? 'fill-primary font-bold' : 'fill-muted'
                      }`}
                    >
                      MW{mp}
                    </text>
                  )}
                  <rect
                    x={x - iw / Math.max(2, maxMp * 2)}
                    y={pad.t}
                    width={iw / Math.max(1, maxMp)}
                    height={ih}
                    fill="transparent"
                    onMouseEnter={() => setHoverMp(mp)}
                    onMouseLeave={() => setHoverMp(null)}
                  />
                </g>
              );
            })}

            {/* Lines */}
            {activeClubs.map((c, idx) => {
              const stroke = colorOf(c.slug, idx);
              const d = c.series
                .map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.mp).toFixed(1)} ${sy(p.pts).toFixed(1)}`)
                .join(' ');
              const curPt = c.series.find((p) => p.mp === inspectedMp) ?? c.series.at(-1);
              return (
                <g key={c.slug}>
                  <path
                    d={d}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {curPt && (
                    <circle
                      cx={sx(curPt.mp)}
                      cy={sy(curPt.pts)}
                      r={4.2}
                      fill={stroke}
                      className="stroke-surface"
                      strokeWidth={1.6}
                    />
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Matchweek Readout */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-bg-secondary/70 px-3.5 py-2 text-xs">
          <span className="font-bold tabular-nums text-primary">
            {th ? `หลังผ่านนัดที่ ${inspectedMp}` : `After Match ${inspectedMp}`}
          </span>
          <div className="flex flex-wrap items-center gap-3 tabular-nums">
            {activeClubs
              .map((c, idx) => ({
                slug: c.slug,
                color: colorOf(c.slug, idx),
                pt: c.series.find((p) => p.mp === inspectedMp),
              }))
              .filter((x) => x.pt)
              .sort((a, b) => (b.pt?.pts ?? 0) - (a.pt?.pts ?? 0))
              .map((x) => (
                <span key={x.slug} className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: x.color }} />
                  <span className="text-secondary">{nameOf(x.slug)}</span>
                  <strong className="text-primary">{x.pt!.pts}</strong>
                </span>
              ))}
          </div>
        </div>
      </section>

      {/* --------------------- xG Over/Underperformance + Club GF vs xG */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* All-20 Diverging xG Luck Chart */}
        <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6 lg:col-span-7">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                <Flame size={13} />
                {th ? 'ความคม vs ดวง (ทั้ง 20 ทีม)' : 'Over & Underperformance (All 20 Clubs)'}
              </p>
              <h2 className="mt-0.5 font-display text-lg font-bold text-primary">
                {luckMode === 'att'
                  ? th
                    ? 'ยิงเกิน xG หรือต่ำกว่า xG (GF − xG)'
                    : 'Finishing vs Expectation (GF − xG)'
                  : luckMode === 'def'
                  ? th
                    ? 'เซฟ/เกมรับเหนือคาด (xGA − GA)'
                    : 'Goalkeeping & Defense vs xGA (xGA − GA)'
                  : th
                  ? 'ผลต่างสุทธิเทียบ xGD (GD − xGD)'
                  : 'Net Variance (GD − xGD)'}
              </h2>
            </div>

            <div className="inline-flex rounded-lg border border-border bg-bg-secondary p-0.5 text-xs font-bold">
              {(
                [
                  ['att', th ? 'เกมรุก' : 'Attack'],
                  ['def', th ? 'เกมรับ' : 'Defense'],
                  ['net', th ? 'สุทธิ' : 'Net'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setLuckMode(id)}
                  className={`rounded-md px-2.5 py-1 transition-colors ${
                    luckMode === id
                      ? 'bg-surface text-primary shadow-sm'
                      : 'text-muted hover:text-primary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {luckRows.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted">
              {th ? 'ยังไม่มีข้อมูล xG ในฤดูกาลนี้' : 'No xG data available for this season.'}
            </p>
          ) : (
            <div className="mt-3 space-y-1.5">
              {luckRows.map(({ row, val }) => {
                const pos = val >= 0;
                const wPct = (Math.abs(val) / maxLuck) * 100;
                return (
                  <div
                    key={row.slug}
                    className="grid grid-cols-[120px_1fr_54px] items-center gap-2 text-xs sm:grid-cols-[148px_1fr_60px]"
                  >
                    <Link
                      href={`/${row.slug}/`}
                      className="flex min-w-0 items-center gap-1.5 font-medium text-primary hover:text-brand"
                    >
                      <ClubCrest slug={row.slug} size={15} />
                      <span className="truncate">{nameOf(row.slug)}</span>
                    </Link>

                    {/* Diverging center-zero bar */}
                    <div className="grid grid-cols-2 items-center gap-0.5">
                      <div className="flex h-3 justify-end overflow-hidden rounded-l bg-bg-secondary">
                        {!pos && (
                          <div
                            className="h-full rounded-l bg-danger/80"
                            style={{ width: `${wPct}%` }}
                          />
                        )}
                      </div>
                      <div className="flex h-3 justify-start overflow-hidden rounded-r bg-bg-secondary">
                        {pos && (
                          <div
                            className="h-full rounded-r bg-success/80"
                            style={{ width: `${wPct}%` }}
                          />
                        )}
                      </div>
                    </div>

                    <span
                      className={`text-right font-bold tabular-nums ${
                        pos ? 'text-success' : 'text-danger'
                      }`}
                    >
                      {pos ? `+${fmt(val, 2)}` : `−${fmt(Math.abs(val), 2)}`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Single-club Goals vs xG Cumulative Curve */}
        <section className="flex flex-col rounded-2xl border border-border bg-surface p-5 sm:p-6 lg:col-span-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                {th ? 'เจาะจงรายสโมสร' : 'Club Finishing Curve'}
              </p>
              <h2 className="mt-0.5 font-display text-lg font-bold text-primary">
                {th ? 'ประตูสะสม vs xG สะสม' : 'Cumulative Goals vs xG'}
              </h2>
            </div>

            <select
              value={xgClub}
              onChange={(e) => setXgClub(e.target.value)}
              aria-label={th ? 'เลือกสโมสร' : 'Select club'}
              className="rounded-lg border border-border bg-bg-secondary px-2.5 py-1.5 text-xs font-bold text-primary"
            >
              {table.map((r) => (
                <option key={r.slug} value={r.slug}>
                  #{r.rank} {nameOf(r.slug)}
                </option>
              ))}
            </select>
          </div>

          {lastXgPt && (
            <div className="mt-4 grid grid-cols-3 gap-2 text-center tabular-nums">
              <div className="rounded-xl bg-bg-secondary px-2 py-2.5">
                <div className="text-[10px] font-bold uppercase text-muted">
                  {th ? 'ประตูจริง' : 'Goals'}
                </div>
                <div className="mt-0.5 text-xl font-extrabold text-primary">{lastXgPt.gf}</div>
              </div>
              <div className="rounded-xl bg-bg-secondary px-2 py-2.5">
                <div className="text-[10px] font-bold uppercase text-muted">xG</div>
                <div className="mt-0.5 text-xl font-extrabold text-info">
                  {lastXgPt.xg != null ? fmt(lastXgPt.xg, 2) : '—'}
                </div>
              </div>
              <div className="rounded-xl bg-bg-secondary px-2 py-2.5">
                <div className="text-[10px] font-bold uppercase text-muted">
                  {th ? 'ส่วนต่าง' : 'GF − xG'}
                </div>
                <div
                  className={`mt-0.5 text-xl font-extrabold ${
                    lastXgPt.xg == null
                      ? 'text-muted'
                      : lastXgPt.gf >= lastXgPt.xg
                      ? 'text-success'
                      : 'text-danger'
                  }`}
                >
                  {lastXgPt.xg != null
                    ? `${lastXgPt.gf >= lastXgPt.xg ? '+' : '−'}${fmt(
                        Math.abs(lastXgPt.gf - lastXgPt.xg),
                        2,
                      )}`
                    : '—'}
                </div>
              </div>
            </div>
          )}

          {/* Clean SVG Curve */}
          <div className="mt-4 flex-1">
            {xgPts.length > 0 ? (() => {
              const cW = 420;
              const cH = 220;
              const cp = { l: 34, r: 16, t: 14, b: 28 };
              const ciw = cW - cp.l - cp.r;
              const cih = cH - cp.t - cp.b;
              const maxG = Math.max(
                5,
                ...xgPts.map((p) => Math.max(p.gf, p.xg ?? 0)),
              ) * 1.12;
              const cx = (i: number) =>
                xgPts.length <= 1 ? cp.l + ciw / 2 : cp.l + (i / (xgPts.length - 1)) * ciw;
              const cy = (v: number) => cp.t + cih - (v / maxG) * cih;
              const gfPath = xgPts
                .map((p, i) => `${i === 0 ? 'M' : 'L'}${cx(i).toFixed(1)} ${cy(p.gf).toFixed(1)}`)
                .join(' ');
              const xgPath = xgPts
                .map((p, i) =>
                  p.xg != null
                    ? `${i === 0 ? 'M' : 'L'}${cx(i).toFixed(1)} ${cy(p.xg).toFixed(1)}`
                    : '',
                )
                .filter(Boolean)
                .join(' ');
              const clubStroke = colorOf(xgClub, 0);
              return (
                <svg viewBox={`0 0 ${cW} ${cH}`} className="h-auto w-full select-none">
                  {[0, 0.33, 0.66, 1].map((t, i) => {
                    const v = t * maxG;
                    return (
                      <g key={i}>
                        <line
                          x1={cp.l}
                          x2={cW - cp.r}
                          y1={cy(v)}
                          y2={cy(v)}
                          className="stroke-border/60"
                          strokeWidth={0.8}
                        />
                        <text
                          x={cp.l - 6}
                          y={cy(v)}
                          textAnchor="end"
                          dominantBaseline="central"
                          className="fill-muted text-[9px] tabular-nums"
                        >
                          {Math.round(v)}
                        </text>
                      </g>
                    );
                  })}
                  {xgPath && (
                    <path
                      d={xgPath}
                      fill="none"
                      stroke="var(--info)"
                      strokeWidth={2}
                      strokeDasharray="5 4"
                    />
                  )}
                  <path d={gfPath} fill="none" stroke={clubStroke} strokeWidth={2.6} />
                  {xgPts.map((p, i) => (
                    <g key={p.mp}>
                      {(i === 0 || i === xgPts.length - 1 || i % Math.max(1, Math.floor(xgPts.length / 5)) === 0) && (
                        <text
                          x={cx(i)}
                          y={cH - 8}
                          textAnchor="middle"
                          className="fill-muted text-[9px] tabular-nums"
                        >
                          M{p.mp}
                        </text>
                      )}
                    </g>
                  ))}
                </svg>
              );
            })() : (
              <p className="py-8 text-center text-xs text-muted">—</p>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-0.5 w-4 rounded"
                style={{ background: colorOf(xgClub, 0) }}
              />
              {th ? 'ประตูจริง (GF)' : 'Actual Goals'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 border-t-2 border-dashed border-info" />
              {th ? 'ประตูคาดหวัง (xG)' : 'Expected Goals (xG)'}
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
