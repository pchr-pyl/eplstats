'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Compass } from 'lucide-react';
import type { ClubIndexEntry } from '@/lib/types';
import type { TableInsightRow } from '@/lib/insightsExtended';
import { fmt } from '@/lib/format';
import { ClubCrest } from '@/components/LeagueHome';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function PowerQuadrant({
  table,
  clubs,
  th,
}: {
  table: TableInsightRow[];
  clubs: Map<string, ClubIndexEntry>;
  th: boolean;
}) {
  const hasXg = table.some((r) => r.xgPerMp != null && r.xgaPerMp != null);
  const [mode, setMode] = useState<'xg' | 'actual'>(hasXg ? 'xg' : 'actual');
  const [hovered, setHovered] = useState<TableInsightRow | null>(null);

  const nameOf = (slug: string) => {
    const c = clubs.get(slug);
    return th && c?.nameTh ? c.nameTh : c?.shortName ?? c?.name ?? slug;
  };

  const { pts, minX, maxX, minY, maxY, avgX, avgY } = useMemo(() => {
    const items = table
      .map((r) => ({
        row: r,
        x: mode === 'xg' ? r.xgPerMp : r.gfPerMp,
        y: mode === 'xg' ? r.xgaPerMp : r.gaPerMp,
      }))
      .filter((d): d is { row: TableInsightRow; x: number; y: number } => d.x != null && d.y != null);

    const xs = items.map((d) => d.x);
    const ys = items.map((d) => d.y);
    const mnX = Math.max(0, Math.min(...xs) - 0.22);
    const mxX = Math.max(...xs) + 0.22;
    const mnY = Math.max(0, Math.min(...ys) - 0.2);
    const mxY = Math.max(...ys) + 0.2;
    const aX = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 1.3;
    const aY = ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : 1.3;

    return { pts: items, minX: mnX, maxX: mxX, minY: mnY, maxY: mxY, avgX: aX, avgY: aY };
  }, [table, mode]);

  const W = 760;
  const H = 400;
  const pad = { l: 56, r: 28, t: 28, b: 46 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;

  // Higher attack = right; LOWER defense conceded = TOP (inverted Y!)
  const sx = (v: number) => pad.l + ((v - minX) / Math.max(0.1, maxX - minX)) * iw;
  const sy = (v: number) => pad.t + ((v - minY) / Math.max(0.1, maxY - minY)) * ih;

  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => minX + t * (maxX - minX));
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => minY + t * (maxY - minY));

  return (
    <section id="power-map" className="scroll-mt-24 rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
            <Compass size={13} />
            {th ? 'แผนที่ขุมพลัง 20 สโมสร' : '20-Club Power Quadrant'}
          </p>
          <h2 className="mt-0.5 font-display text-lg font-bold text-primary sm:text-xl">
            {th ? 'เกมรุก vs เกมรับ (ยิ่งขวา-บนยิ่งแกร่ง)' : 'Attack vs Defense Balance (Top-Right = Elite)'}
          </h2>
        </div>

        <div className="inline-flex rounded-lg border border-border bg-bg-secondary p-0.5 text-xs font-bold">
          {hasXg && (
            <button
              type="button"
              onClick={() => setMode('xg')}
              className={`rounded-md px-3 py-1 transition-colors ${
                mode === 'xg'
                  ? 'bg-surface text-primary shadow-sm'
                  : 'text-muted hover:text-primary'
              }`}
            >
              {th ? 'xG vs xGA / นัด' : 'Expected (xG / xGA)'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setMode('actual')}
            className={`rounded-md px-3 py-1 transition-colors ${
              mode === 'actual'
                ? 'bg-surface text-primary shadow-sm'
                : 'text-muted hover:text-primary'
            }`}
          >
            {th ? 'ประตูได้ vs เสีย / นัด' : 'Actual (GF / GA)'}
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full min-w-[580px] select-none"
          role="img"
          aria-label={th ? 'แผนที่เกมรุกและเกมรับพรีเมียร์ลีก' : 'Premier League attack vs defense quadrant'}
        >
          {/* Subtle Top-Right elite tint & Bottom-Left danger tint */}
          <rect
            x={sx(avgX)}
            y={pad.t}
            width={Math.max(0, W - pad.r - sx(avgX))}
            height={Math.max(0, sy(avgY) - pad.t)}
            className="fill-success"
            fillOpacity={0.05}
          />
          <rect
            x={pad.l}
            y={sy(avgY)}
            width={Math.max(0, sx(avgX) - pad.l)}
            height={Math.max(0, H - pad.b - sy(avgY))}
            className="fill-danger"
            fillOpacity={0.04}
          />

          {/* Grid lines */}
          {yTicks.map((tv, i) => (
            <g key={`y-${i}`}>
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
                {fmt(tv, 2)}
              </text>
            </g>
          ))}
          {xTicks.map((tv, i) => (
            <g key={`x-${i}`}>
              <line
                x1={sx(tv)}
                x2={sx(tv)}
                y1={pad.t}
                y2={H - pad.b}
                className="stroke-border/60"
                strokeWidth={0.8}
              />
              <text
                x={sx(tv)}
                y={H - pad.b + 16}
                textAnchor="middle"
                className="fill-muted text-[10px] tabular-nums"
              >
                {fmt(tv, 2)}
              </text>
            </g>
          ))}

          {/* League Average Crosshairs */}
          <line
            x1={sx(avgX)}
            x2={sx(avgX)}
            y1={pad.t}
            y2={H - pad.b}
            className="stroke-muted/60"
            strokeDasharray="4 4"
            strokeWidth={1.1}
          />
          <line
            x1={pad.l}
            x2={W - pad.r}
            y1={sy(avgY)}
            y2={sy(avgY)}
            className="stroke-muted/60"
            strokeDasharray="4 4"
            strokeWidth={1.1}
          />

          {/* Quadrant labels */}
          <text
            x={W - pad.r - 8}
            y={pad.t + 16}
            textAnchor="end"
            className="fill-success text-[10px] font-bold uppercase tracking-wider"
          >
            {th ? 'ลุ้นแชมป์ · รุกคมรับแน่น' : 'Elite Both Ends'}
          </text>
          <text
            x={pad.l + 8}
            y={pad.t + 16}
            textAnchor="start"
            className="fill-muted text-[10px] font-bold uppercase tracking-wider"
          >
            {th ? 'เน้นรับเหนียว · ยิงน้อย' : 'Defensive / Low Event'}
          </text>
          <text
            x={W - pad.r - 8}
            y={H - pad.b - 8}
            textAnchor="end"
            className="fill-warning text-[10px] font-bold uppercase tracking-wider"
          >
            {th ? 'เกมเปิดแลก · ยิงเยอะเสียเยอะ' : 'Open / Shootout'}
          </text>
          <text
            x={pad.l + 8}
            y={H - pad.b - 8}
            textAnchor="start"
            className="fill-danger text-[10px] font-bold uppercase tracking-wider"
          >
            {th ? 'โซนอันตราย · ฝืดและรั่ว' : 'Struggling Both Ends'}
          </text>

          {/* Club crests */}
          {pts.map(({ row, x, y }) => {
            const cx = sx(x);
            const cy = sy(y);
            const isHover = hovered?.slug === row.slug;
            const size = isHover ? 30 : 24;
            return (
              <g
                key={row.slug}
                className="cursor-pointer"
                onMouseEnter={() => setHovered(row)}
                onMouseLeave={() => setHovered((cur) => (cur?.slug === row.slug ? null : cur))}
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHover ? 18 : 14}
                  className={isHover ? 'fill-surface stroke-primary' : 'fill-surface/90 stroke-border'}
                  strokeWidth={isHover ? 2 : 1}
                />
                <image
                  href={`${BASE_PATH}/logos/${row.slug}.png`}
                  x={cx - size / 2}
                  y={cy - size / 2}
                  width={size}
                  height={size}
                  preserveAspectRatio="xMidYMid meet"
                />
              </g>
            );
          })}

          {/* Axis labels */}
          <text
            x={pad.l + iw / 2}
            y={H - 8}
            textAnchor="middle"
            className="fill-muted text-[11px] font-bold uppercase tracking-wider"
          >
            {mode === 'xg'
              ? th
                ? 'xG ต่อนัด (ยิ่งมากยิ่งสร้างโอกาสดี) →'
                : 'xG per Match (Better Attack) →'
              : th
              ? 'ประตูได้ต่อนัด (GF / นัด) →'
              : 'Goals Scored per Match →'}
          </text>
          <text
            x={16}
            y={pad.t + ih / 2}
            textAnchor="middle"
            transform={`rotate(-90 16 ${pad.t + ih / 2})`}
            className="fill-muted text-[11px] font-bold uppercase tracking-wider"
          >
            {mode === 'xg'
              ? th
                ? '← xGA ต่อนัด (ยิ่งสูงยิ่งรับแน่น)'
                : '← xGA per Match (Stronger Defense ↑)'
              : th
              ? '← ประตูเสียต่อนัด (ยิ่งสูงยิ่งรับแน่น)'
              : '← Goals Conceded / Match (Better Defense ↑)'}
          </text>
        </svg>
      </div>

      {/* Live Hover Readout Bar */}
      <div className="mt-3 flex min-h-[46px] flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-bg-secondary/70 px-3.5 py-2 text-xs">
        {hovered ? (
          <>
            <div className="flex items-center gap-2.5">
              <span className="rounded bg-surface px-1.5 py-0.5 font-bold tabular-nums text-muted">
                #{hovered.rank}
              </span>
              <ClubCrest slug={hovered.slug} size={18} />
              <Link href={`/${hovered.slug}/`} className="font-bold text-primary hover:text-brand">
                {nameOf(hovered.slug)}
              </Link>
              <span className="tabular-nums text-muted">
                {hovered.pts} {th ? 'แต้ม' : 'pts'} ({hovered.mp} {th ? 'นัด' : 'MP'})
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 tabular-nums">
              <span>
                <span className="text-muted">{th ? 'รุก:' : 'Attack:'} </span>
                <strong className="text-primary">
                  {mode === 'xg' ? fmt(hovered.xgPerMp, 2) : fmt(hovered.gfPerMp, 2)}/m
                </strong>
                <span className="ml-1 text-muted">
                  ({hovered.gf}G{hovered.xg != null ? ` · ${fmt(hovered.xg, 2)} xG` : ''})
                </span>
              </span>
              <span>
                <span className="text-muted">{th ? 'รับ:' : 'Defense:'} </span>
                <strong className="text-primary">
                  {mode === 'xg' ? fmt(hovered.xgaPerMp, 2) : fmt(hovered.gaPerMp, 2)}/m
                </strong>
                <span className="ml-1 text-muted">
                  ({hovered.ga}GA{hovered.xga != null ? ` · ${fmt(hovered.xga, 2)} xGA` : ''})
                </span>
              </span>
            </div>
          </>
        ) : (
          <div className="flex w-full flex-wrap items-center justify-between gap-2 text-muted">
            <span>
              {th
                ? 'ชี้ที่ตราสโมสรเพื่อดูรายละเอียดเกมรุก-เกมรับเทียบค่าเฉลี่ยลีก'
                : 'Hover any club crest to inspect attacking and defensive rates against the league average.'}
            </span>
            <span className="tabular-nums">
              {th ? 'ค่าเฉลี่ยลีก:' : 'League avg:'} {fmt(avgX, 2)} / {fmt(avgY, 2)}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
