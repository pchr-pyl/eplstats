'use client';

import { useMemo, useState } from 'react';
import { Crosshair } from 'lucide-react';
import type { ClubIndexEntry } from '@/lib/types';
import { fmt } from '@/lib/format';
import { seasonShort } from '@/lib/stats';
import { ClubCrest } from './PlayerPicker';
import { POS_LABELS, type DemoPlayer, type PeerScope } from './types';

interface AxisPreset {
  id: string;
  en: string;
  th: string;
  xKey: string;
  yKey: string;
  xEn: string;
  xTh: string;
  yEn: string;
  yTh: string;
  xUnit?: '%';
  yUnit?: '%';
  qTopRightEn: string;
  qTopRightTh: string;
  qTopLeftEn: string;
  qTopLeftTh: string;
  qBotRightEn: string;
  qBotRightTh: string;
}

const PRESETS: AxisPreset[] = [
  {
    id: 'output',
    en: 'Goals vs Assists',
    th: 'ประตู vs แอสซิสต์',
    xKey: 'gls90',
    yKey: 'ast90',
    xEn: 'Goals / 90',
    xTh: 'ประตู / 90',
    yEn: 'Assists / 90',
    yTh: 'แอสซิสต์ / 90',
    qTopRightEn: 'Dual Threat',
    qTopRightTh: 'ยิง-จ่ายครบเครื่อง',
    qTopLeftEn: 'Creator',
    qTopLeftTh: 'สายปั้นเกม',
    qBotRightEn: 'Pure Finisher',
    qBotRightTh: 'สายจบสกอร์',
  },
  {
    id: 'clinical',
    en: 'Volume vs Clinical',
    th: 'ปริมาณยิง vs ความคม',
    xKey: 'sh90',
    yKey: 'gSh',
    xEn: 'Shots / 90',
    xTh: 'ยิง / 90',
    yEn: 'Goals / Shot',
    yTh: 'ประตู / การยิง',
    qTopRightEn: 'High Volume + Clinical',
    qTopRightTh: 'ยิงเยอะและคม',
    qTopLeftEn: 'Selective & Sharp',
    qTopLeftTh: 'เลือกยิงแม่นคม',
    qBotRightEn: 'High Volume',
    qBotRightTh: 'ยิงปริมาณสูง',
  },
  {
    id: 'accuracy',
    en: 'Shots vs Accuracy',
    th: 'ยิง / 90 vs ตรงกรอบ %',
    xKey: 'sh90',
    yKey: 'sotPct',
    xEn: 'Shots / 90',
    xTh: 'ยิง / 90',
    yEn: 'Shot Accuracy %',
    yTh: 'ยิงตรงกรอบ %',
    yUnit: '%',
    qTopRightEn: 'Relentless & Accurate',
    qTopRightTh: 'ยิงถี่และตรงกรอบ',
    qTopLeftEn: 'Low Vol · Accurate',
    qTopLeftTh: 'ยิงน้อยแต่ตรงกรอบ',
    qBotRightEn: 'Speculative',
    qBotRightTh: 'เน้นส่องไกล/ปริมาณ',
  },
  {
    id: 'reliance',
    en: 'Minutes vs Output',
    th: 'สัดส่วนนาที vs G+A/90',
    xKey: 'share',
    yKey: 'ga90',
    xEn: 'Minutes Share %',
    xTh: 'สัดส่วนนาทีของทีม %',
    yEn: 'G+A / 90',
    yTh: 'G+A / 90',
    xUnit: '%',
    qTopRightEn: 'Talisman',
    qTopRightTh: 'เดอะแบกตัวจริง',
    qTopLeftEn: 'Super-Sub / Rotation',
    qTopLeftTh: 'ลงน้อยแต่คุ้มค่า',
    qBotRightEn: 'Workhorse',
    qBotRightTh: 'ลงสม่ำเสมอ',
  },
];

function fmtAxis(v: number | null, unit?: '%'): string {
  if (v == null || Number.isNaN(v)) return '—';
  return unit === '%' ? `${fmt(v, 2)}%` : fmt(v, 2);
}

export function LeagueScatter({
  A,
  B,
  seasonA,
  seasonB,
  poolA,
  clubs,
  colorA,
  colorB,
  scope,
  th,
  onPickFromScatter,
}: {
  A: DemoPlayer;
  B: DemoPlayer;
  seasonA: string;
  seasonB: string;
  poolA: DemoPlayer[];
  clubs: Map<string, ClubIndexEntry>;
  colorA: string;
  colorB: string;
  scope: PeerScope;
  th: boolean;
  onPickFromScatter: (slot: 'A' | 'B', p: DemoPlayer, season: string) => void;
}) {
  const [presetId, setPresetId] = useState<string>('output');
  const [clickSlot, setClickSlot] = useState<'A' | 'B'>('B');
  const [hovered, setHovered] = useState<DemoPlayer | null>(null);

  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];

  const { dots, maxX, maxY, avgX, avgY } = useMemo(() => {
    const base = poolA.filter((p) => {
      if (!p.eligible) return false;
      if (scope === 'pos' && p.pos !== A.pos) return false;
      return p.v[preset.xKey] != null && p.v[preset.yKey] != null;
    });
    const xs = base.map((p) => p.v[preset.xKey]!);
    const ys = base.map((p) => p.v[preset.yKey]!);
    const ax = A.v[preset.xKey];
    const ay = A.v[preset.yKey];
    const bx = B.v[preset.xKey];
    const by = B.v[preset.yKey];
    const allX = [...xs, ...(ax != null ? [ax] : []), ...(bx != null ? [bx] : [])];
    const allY = [...ys, ...(ay != null ? [ay] : []), ...(by != null ? [by] : [])];
    const mX = Math.max(0.1, ...allX) * 1.1;
    const mY = Math.max(0.1, ...allY) * 1.12;
    const meanX = xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : mX / 2;
    const meanY = ys.length ? ys.reduce((s, y) => s + y, 0) / ys.length : mY / 2;
    return {
      dots: base,
      maxX: preset.xUnit === '%' ? Math.min(100, Math.max(mX, 50)) : mX,
      maxY: preset.yUnit === '%' ? Math.min(100, Math.max(mY, 50)) : mY,
      avgX: meanX,
      avgY: meanY,
    };
  }, [poolA, scope, A, B, preset]);

  const W = 720;
  const H = 370;
  const pad = { l: 54, r: 26, t: 22, b: 44 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;

  const sx = (v: number) => pad.l + (Math.max(0, Math.min(maxX, v)) / maxX) * iw;
  const sy = (v: number) => pad.t + ih - (Math.max(0, Math.min(maxY, v)) / maxY) * ih;

  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * maxX);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * maxY);

  const ax = A.v[preset.xKey];
  const ay = A.v[preset.yKey];
  const bx = B.v[preset.xKey];
  const by = B.v[preset.yKey];

  const clubName = (slug: string) => {
    const c = clubs.get(slug);
    return th ? c?.nameTh ?? c?.name ?? slug : c?.name ?? slug;
  };

  const crossSeason = seasonA !== seasonB;

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
            <Crosshair size={13} />
            {th ? 'แผนที่บริบททั้งลีก' : 'League Landscape'} · PL {seasonShort(seasonA)}
          </p>
          <h2 className="mt-0.5 font-display text-lg font-bold text-primary sm:text-xl">
            {th ? 'ตำแหน่งของทั้งคู่เทียบกับเพื่อนร่วมลีก' : 'Where They Sit Against the League'}
          </h2>
        </div>

        {/* Click target toggle */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted">{th ? 'คลิกจุดเพื่อแทนที่:' : 'Click dot sets:'}</span>
          <div className="inline-flex rounded-lg border border-border bg-bg-secondary p-0.5 font-bold">
            {(['A', 'B'] as const).map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setClickSlot(slot)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors ${
                  clickSlot === slot
                    ? 'bg-surface text-primary shadow-sm'
                    : 'text-muted hover:text-primary'
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: slot === 'A' ? colorA : colorB }}
                />
                {slot}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Axis preset selector */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((pr) => (
            <button
              key={pr.id}
              type="button"
              onClick={() => setPresetId(pr.id)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                pr.id === preset.id
                  ? 'border-primary bg-primary text-surface'
                  : 'border-border bg-bg-secondary text-secondary hover:text-primary'
              }`}
            >
              {th ? pr.th : pr.en}
            </button>
          ))}
        </div>

        <span className="text-[11px] text-muted">
          {dots.length}{' '}
          {scope === 'pos'
            ? th
              ? `${POS_LABELS[A.pos].th}ที่ผ่านเกณฑ์ 30%`
              : `qualified ${A.pos}s`
            : th
            ? 'ผู้เล่นเอาท์ฟิลด์ที่ผ่านเกณฑ์ 30%'
            : 'qualified outfield peers'}
          {crossSeason &&
            (th
              ? ` (${seasonShort(seasonA)} · ซ้อนจุดของ ${B.name} ${seasonShort(seasonB)})`
              : ` (${seasonShort(seasonA)} pool · ${B.name} ${seasonShort(seasonB)} overlaid)`)}
        </span>
      </div>

      {/* Scatter SVG */}
      <div className="relative mt-4 overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full min-w-[540px] select-none"
          role="img"
          aria-label={th ? preset.th : preset.en}
        >
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

          {/* League average crosshairs */}
          <line
            x1={sx(avgX)}
            x2={sx(avgX)}
            y1={pad.t}
            y2={H - pad.b}
            className="stroke-muted/50"
            strokeDasharray="4 4"
            strokeWidth={1.1}
          />
          <line
            x1={pad.l}
            x2={W - pad.r}
            y1={sy(avgY)}
            y2={sy(avgY)}
            className="stroke-muted/50"
            strokeDasharray="4 4"
            strokeWidth={1.1}
          />

          {/* Quadrant annotations */}
          <text
            x={W - pad.r - 6}
            y={pad.t + 14}
            textAnchor="end"
            className="fill-muted/70 text-[10px] font-bold uppercase tracking-wider"
          >
            {th ? preset.qTopRightTh : preset.qTopRightEn}
          </text>
          <text
            x={pad.l + 8}
            y={pad.t + 14}
            textAnchor="start"
            className="fill-muted/70 text-[10px] font-bold uppercase tracking-wider"
          >
            {th ? preset.qTopLeftTh : preset.qTopLeftEn}
          </text>
          <text
            x={W - pad.r - 6}
            y={H - pad.b - 8}
            textAnchor="end"
            className="fill-muted/70 text-[10px] font-bold uppercase tracking-wider"
          >
            {th ? preset.qBotRightTh : preset.qBotRightEn}
          </text>

          {/* Peer dots */}
          {dots.map((p) => {
            const isA = p.key === A.key;
            const isB = !crossSeason && p.key === B.key;
            if (isA || isB) return null;
            const px = sx(p.v[preset.xKey]!);
            const py = sy(p.v[preset.yKey]!);
            const isHover = hovered?.key === p.key;
            return (
              <circle
                key={p.key}
                cx={px}
                cy={py}
                r={isHover ? 6.5 : 3.8}
                className={
                  isHover
                    ? 'cursor-pointer fill-primary stroke-surface'
                    : 'cursor-pointer fill-muted/45 hover:fill-primary'
                }
                strokeWidth={isHover ? 1.8 : 0}
                onMouseEnter={() => setHovered(p)}
                onMouseLeave={() => setHovered((cur) => (cur?.key === p.key ? null : cur))}
                onClick={() => onPickFromScatter(clickSlot, p, seasonA)}
              />
            );
          })}

          {/* Highlighted Player B */}
          {bx != null && by != null && (
            <g
              className="cursor-pointer"
              onMouseEnter={() => setHovered(B)}
              onMouseLeave={() => setHovered((cur) => (cur?.key === B.key ? null : cur))}
            >
              <circle cx={sx(bx)} cy={sy(by)} r={13} fill={colorB} fillOpacity={0.18} />
              <circle
                cx={sx(bx)}
                cy={sy(by)}
                r={7}
                fill={colorB}
                className="stroke-surface"
                strokeWidth={2}
              />
              <text
                x={sx(bx) + (sx(bx) > W - 150 ? -11 : 11)}
                y={sy(by) + 1}
                textAnchor={sx(bx) > W - 150 ? 'end' : 'start'}
                dominantBaseline="central"
                className="fill-primary text-[11px] font-extrabold"
                style={{
                  paintOrder: 'stroke',
                  stroke: 'var(--surface)',
                  strokeWidth: 3.5,
                }}
              >
                {B.name.split(' ').slice(-1)[0]}
                {crossSeason ? ` '${seasonB.slice(2, 4)}` : ''}
              </text>
            </g>
          )}

          {/* Highlighted Player A */}
          {ax != null && ay != null && (
            <g
              className="cursor-pointer"
              onMouseEnter={() => setHovered(A)}
              onMouseLeave={() => setHovered((cur) => (cur?.key === A.key ? null : cur))}
            >
              <circle cx={sx(ax)} cy={sy(ay)} r={13} fill={colorA} fillOpacity={0.18} />
              <circle
                cx={sx(ax)}
                cy={sy(ay)}
                r={7}
                fill={colorA}
                className="stroke-surface"
                strokeWidth={2}
              />
              <text
                x={sx(ax) + (sx(ax) > W - 150 ? -11 : 11)}
                y={sy(ay) - 11}
                textAnchor={sx(ax) > W - 150 ? 'end' : 'start'}
                dominantBaseline="central"
                className="fill-primary text-[11px] font-extrabold"
                style={{
                  paintOrder: 'stroke',
                  stroke: 'var(--surface)',
                  strokeWidth: 3.5,
                }}
              >
                {A.name.split(' ').slice(-1)[0]}
                {crossSeason ? ` '${seasonA.slice(2, 4)}` : ''}
              </text>
            </g>
          )}

          {/* Axis labels */}
          <text
            x={pad.l + iw / 2}
            y={H - 8}
            textAnchor="middle"
            className="fill-muted text-[11px] font-bold uppercase tracking-wider"
          >
            {th ? preset.xTh : preset.xEn}
          </text>
          <text
            x={16}
            y={pad.t + ih / 2}
            textAnchor="middle"
            transform={`rotate(-90 16 ${pad.t + ih / 2})`}
            className="fill-muted text-[11px] font-bold uppercase tracking-wider"
          >
            {th ? preset.yTh : preset.yEn}
          </text>
        </svg>
      </div>

      {/* Hover readout footer */}
      <div className="mt-3 flex min-h-[44px] flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-bg-secondary/70 px-3.5 py-2 text-xs">
        {hovered ? (
          <>
            <div className="flex items-center gap-2">
              <ClubCrest slug={hovered.club} size={18} />
              <strong className="text-primary">{hovered.name}</strong>
              <span className="text-muted">
                {clubName(hovered.club)} · {hovered.pos} · {hovered.min}&apos;
              </span>
            </div>
            <div className="flex items-center gap-4 tabular-nums">
              <span>
                <span className="text-muted">{th ? preset.xTh : preset.xEn}: </span>
                <strong className="text-primary">
                  {fmtAxis(hovered.v[preset.xKey], preset.xUnit)}
                </strong>
              </span>
              <span>
                <span className="text-muted">{th ? preset.yTh : preset.yEn}: </span>
                <strong className="text-primary">
                  {fmtAxis(hovered.v[preset.yKey], preset.yUnit)}
                </strong>
              </span>
              <span className="hidden text-muted sm:inline">
                ({hovered.gls}G {hovered.ast}A)
              </span>
            </div>
          </>
        ) : (
          <div className="flex w-full flex-wrap items-center justify-between gap-2 text-muted">
            <span>
              {th
                ? 'ชี้ที่จุดใดก็ได้เพื่อดูชื่อนักเตะ หรือคลิกเพื่อดึงมาเปรียบเทียบทันที'
                : 'Hover any peer dot to identify the player, or click a dot to load them straight into the comparison.'}
            </span>
            <span className="tabular-nums">
              {th ? 'ค่าเฉลี่ยกลุ่ม:' : 'Peer avg:'} {fmtAxis(avgX, preset.xUnit)} ·{' '}
              {fmtAxis(avgY, preset.yUnit)}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
