'use client';

import { useState } from 'react';
import { Layers, PieChart } from 'lucide-react';
import type { ClubIndexEntry } from '@/lib/types';
import { seasonShort } from '@/lib/stats';
import {
  CAT_META,
  PIZZA_METRICS,
  POS_LABELS,
  formatDelta,
  formatMetricVal,
  rankInPool,
  rawMetricVal,
  type DemoMetric,
  type DemoPlayer,
  type PeerScope,
} from './types';

function pctBadgeClass(pct: number | null): string {
  if (pct == null) return 'bg-bg-secondary text-muted';
  if (pct >= 85) return 'bg-success-soft text-success';
  if (pct >= 65) return 'bg-info-soft text-info';
  if (pct >= 40) return 'bg-bg-secondary text-primary';
  return 'bg-bg-secondary text-muted';
}

/* ----------------------------------------------------- Overlay Radar */
function OverlayRadar({
  A,
  B,
  poolA,
  poolB,
  colorA,
  colorB,
  scope,
  th,
  activeId,
  onSelect,
}: {
  A: DemoPlayer;
  B: DemoPlayer;
  poolA: DemoPlayer[];
  poolB: DemoPlayer[];
  colorA: string;
  colorB: string;
  scope: PeerScope;
  th: boolean;
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const n = PIZZA_METRICS.length;
  const C = 210;
  const R0 = 18;
  const R1 = 136;
  const pt = (idx: number, pct: number) => {
    const a = -90 + (idx * 360) / n;
    const r = R0 + ((R1 - R0) * Math.max(4, pct)) / 100;
    return [C + r * Math.cos((a * Math.PI) / 180), C + r * Math.sin((a * Math.PI) / 180)] as const;
  };
  const labelPt = (idx: number, radius: number) => {
    const a = -90 + (idx * 360) / n;
    return [C + radius * Math.cos((a * Math.PI) / 180), C + radius * Math.sin((a * Math.PI) / 180)] as const;
  };

  const pctA = PIZZA_METRICS.map((m) => rankInPool(poolA, A, m, scope).pct ?? 5);
  const pctB = PIZZA_METRICS.map((m) => rankInPool(poolB, B, m, scope).pct ?? 5);
  const polyA = pctA.map((p, i) => pt(i, p).join(',')).join(' ');
  const polyB = pctB.map((p, i) => pt(i, p).join(',')).join(' ');

  return (
    <svg
      viewBox={`-56 -8 ${C * 2 + 112} ${C * 2 + 16}`}
      className="mx-auto w-full max-w-[540px] select-none"
      role="img"
      aria-label={`${A.name} vs ${B.name}`}
    >
      {/* Concentric percentile rings */}
      {[25, 50, 75, 100].map((lvl) => {
        const r = R0 + ((R1 - R0) * lvl) / 100;
        return (
          <g key={lvl}>
            <circle
              cx={C}
              cy={C}
              r={r}
              fill="none"
              className="stroke-border"
              strokeWidth={lvl === 50 ? 1.2 : 0.9}
              strokeDasharray={lvl === 50 ? '3 3' : undefined}
            />
            {lvl < 100 && (
              <text
                x={C + 4}
                y={C - r + 3}
                className="fill-muted text-[9px] font-semibold tabular-nums"
              >
                {lvl}
              </text>
            )}
          </g>
        );
      })}

      {/* Spokes */}
      {PIZZA_METRICS.map((m, i) => {
        const [x1, y1] = labelPt(i, R1);
        const active = m.id === activeId;
        return (
          <line
            key={m.id}
            x1={C}
            y1={C}
            x2={x1}
            y2={y1}
            className={active ? 'stroke-primary/50' : 'stroke-border'}
            strokeWidth={active ? 1.6 : 0.9}
          />
        );
      })}

      {/* Polygon B then A */}
      <polygon
        points={polyB}
        fill={colorB}
        fillOpacity={0.18}
        stroke={colorB}
        strokeWidth={2.4}
        strokeLinejoin="round"
      />
      <polygon
        points={polyA}
        fill={colorA}
        fillOpacity={0.22}
        stroke={colorA}
        strokeWidth={2.6}
        strokeLinejoin="round"
      />

      {/* Interactive vertices + axis labels */}
      {PIZZA_METRICS.map((m, i) => {
        const [ax, ay] = pt(i, pctA[i]);
        const [bx, by] = pt(i, pctB[i]);
        const [lx, ly] = labelPt(i, R1 + 22);
        const anchor = Math.abs(lx - C) < 16 ? 'middle' : lx > C ? 'start' : 'end';
        const active = m.id === activeId;
        const catAccent = CAT_META.find((c) => c.id === m.cat)?.accent ?? '#888';

        return (
          <g
            key={m.id}
            className="cursor-pointer"
            onMouseEnter={() => onSelect(m.id)}
            onClick={() => onSelect(m.id)}
          >
            {/* Invisible wider hit corridor */}
            <line
              x1={C}
              y1={C}
              x2={lx}
              y2={ly}
              stroke="transparent"
              strokeWidth={24}
            />
            <circle
              cx={bx}
              cy={by}
              r={active ? 5.5 : 3.8}
              fill={colorB}
              className="stroke-surface transition-all"
              strokeWidth={1.6}
            />
            <circle
              cx={ax}
              cy={ay}
              r={active ? 5.5 : 3.8}
              fill={colorA}
              className="stroke-surface transition-all"
              strokeWidth={1.6}
            />
            <text
              x={lx}
              y={ly}
              textAnchor={anchor}
              dominantBaseline="central"
              className={`text-[11px] uppercase transition-colors ${
                active ? 'fill-primary font-extrabold' : 'fill-muted font-semibold'
              }`}
              letterSpacing=".04em"
            >
              {th ? m.shortTh : m.shortEn}
            </text>
            {/* Category dot beneath/beside active label */}
            {active && (
              <circle
                cx={anchor === 'middle' ? lx : anchor === 'start' ? lx - 7 : lx + 7}
                cy={anchor === 'middle' ? ly + 11 : ly}
                r={2.8}
                fill={catAccent}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------ Single Percentile Pizza */
function InteractivePizza({
  p,
  pool,
  color,
  scope,
  th,
  activeId,
  onSelect,
}: {
  p: DemoPlayer;
  pool: DemoPlayer[];
  color: string;
  scope: PeerScope;
  th: boolean;
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const n = PIZZA_METRICS.length;
  const C = 190;
  const R0 = 24;
  const R1 = 118;
  const gap = 1.6;
  const pt = (a: number, r: number) => [
    C + r * Math.cos((a * Math.PI) / 180),
    C + r * Math.sin((a * Math.PI) / 180),
  ];
  const wedge = (i: number, r: number) => {
    const step = 360 / n;
    const a0 = -90 + i * step + gap;
    const a1 = -90 + (i + 1) * step - gap;
    const [x0, y0] = pt(a0, R0);
    const [x1, y1] = pt(a0, r);
    const [x2, y2] = pt(a1, r);
    const [x3, y3] = pt(a1, R0);
    return `M${x0} ${y0} L${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2} L${x3} ${y3} A${R0} ${R0} 0 0 0 ${x0} ${y0}Z`;
  };

  return (
    <svg
      viewBox={`-54 0 ${C * 2 + 108} ${C * 2}`}
      className="mx-auto w-full max-w-[440px] select-none"
      role="img"
      aria-label={p.name}
    >
      {/* Guide rings */}
      {[25, 50, 75].map((lvl) => (
        <circle
          key={lvl}
          cx={C}
          cy={C}
          r={R0 + ((R1 - R0) * lvl) / 100}
          fill="none"
          className="stroke-border/60"
          strokeDasharray="2 3"
        />
      ))}

      {PIZZA_METRICS.map((m, i) => {
        const { pct } = rankInPool(pool, p, m, scope);
        const mid = -90 + (i + 0.5) * (360 / n);
        const [lx, ly] = pt(mid, R1 + 15);
        const [vx, vy] = pt(
          mid,
          pct == null ? R0 + 14 : Math.max(R0 + 16, R0 + ((R1 - R0) * pct) / 100 - 11),
        );
        const anchor = Math.abs(lx - C) < 12 ? 'middle' : lx > C ? 'start' : 'end';
        const active = m.id === activeId;

        return (
          <g
            key={m.id}
            className="cursor-pointer"
            onMouseEnter={() => onSelect(m.id)}
            onClick={() => onSelect(m.id)}
          >
            <path
              d={wedge(i, R1)}
              className={active ? 'fill-bg-secondary stroke-primary/40' : 'fill-bg-secondary'}
              strokeWidth={active ? 1.3 : 0}
            />
            {pct != null && (
              <path
                d={wedge(i, R0 + ((R1 - R0) * pct) / 100)}
                fill={color}
                opacity={active ? 1 : 0.8}
                className="transition-opacity"
              />
            )}
            {pct != null && (
              <text
                x={vx}
                y={vy}
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-white text-[11px] font-bold tabular-nums"
                style={{
                  paintOrder: 'stroke',
                  stroke: 'rgba(0,0,0,.3)',
                  strokeWidth: 2.2,
                }}
              >
                {pct}
              </text>
            )}
            <text
              x={lx}
              y={ly}
              textAnchor={anchor}
              dominantBaseline="central"
              className={`text-[10px] uppercase ${
                active ? 'fill-primary font-extrabold' : 'fill-muted font-semibold'
              }`}
              letterSpacing=".04em"
            >
              {th ? m.shortTh : m.shortEn}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ----------------------------------------------------- Wrapper Section */
export function ProfileVisuals({
  A,
  B,
  seasonA,
  seasonB,
  poolA,
  poolB,
  clubs,
  colorA,
  colorB,
  scope,
  onScopeChange,
  th,
}: {
  A: DemoPlayer;
  B: DemoPlayer;
  seasonA: string;
  seasonB: string;
  poolA: DemoPlayer[];
  poolB: DemoPlayer[];
  clubs: Map<string, ClubIndexEntry>;
  colorA: string;
  colorB: string;
  scope: PeerScope;
  onScopeChange: (s: PeerScope) => void;
  th: boolean;
}) {
  const [chartType, setChartType] = useState<'overlay' | 'pizza'>('overlay');
  const [activeId, setActiveId] = useState<string>(PIZZA_METRICS[2].id); // G+A default

  const activeMetric: DemoMetric =
    PIZZA_METRICS.find((m) => m.id === activeId) ?? PIZZA_METRICS[0];
  const rA = rankInPool(poolA, A, activeMetric, scope);
  const rB = rankInPool(poolB, B, activeMetric, scope);
  const valA = rawMetricVal(activeMetric, A, 'per90');
  const valB = rawMetricVal(activeMetric, B, 'per90');
  const diff = valA != null && valB != null ? valA - valB : null;

  const clubName = (slug: string) => {
    const c = clubs.get(slug);
    return th ? c?.nameTh ?? c?.name ?? slug : c?.name ?? slug;
  };

  const scopeLabel = (p: DemoPlayer) =>
    scope === 'all'
      ? th
        ? 'เทียบผู้เล่นเอาท์ฟิลด์ทั้งหมดในลีก'
        : 'vs all PL outfield peers'
      : th
      ? `เทียบ${POS_LABELS[p.pos].th}ในลีก`
      : `vs ${p.pos} peers`;

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
            {th ? 'โปรไฟล์เปอร์เซ็นไทล์ (1–99)' : 'Percentile Profile (1–99)'}
          </p>
          <h2 className="mt-0.5 font-display text-lg font-bold text-primary sm:text-xl">
            {th ? 'โครงสร้างสไตล์การเล่นเทียบตำแหน่ง' : 'Tactical Footprint & Peer Percentiles'}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Peer scope toggle */}
          <div className="inline-flex rounded-lg border border-border bg-bg-secondary p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => onScopeChange('pos')}
              className={`rounded-md px-2.5 py-1 transition-colors ${
                scope === 'pos'
                  ? 'bg-surface text-primary shadow-sm'
                  : 'text-muted hover:text-primary'
              }`}
            >
              {th ? 'ตำแหน่งเดียวกัน' : 'Same Pos'}
            </button>
            <button
              type="button"
              onClick={() => onScopeChange('all')}
              className={`rounded-md px-2.5 py-1 transition-colors ${
                scope === 'all'
                  ? 'bg-surface text-primary shadow-sm'
                  : 'text-muted hover:text-primary'
              }`}
            >
              {th ? 'เอาท์ฟิลด์ทั้งลีก' : 'All Outfield'}
            </button>
          </div>

          {/* Chart mode toggle */}
          <div className="inline-flex rounded-lg border border-border bg-bg-secondary p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setChartType('overlay')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors ${
                chartType === 'overlay'
                  ? 'bg-surface text-primary shadow-sm'
                  : 'text-muted hover:text-primary'
              }`}
            >
              <Layers size={13} />
              {th ? 'ซ้อนทับ' : 'Overlay'}
            </button>
            <button
              type="button"
              onClick={() => setChartType('pizza')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors ${
                chartType === 'pizza'
                  ? 'bg-surface text-primary shadow-sm'
                  : 'text-muted hover:text-primary'
              }`}
            >
              <PieChart size={13} />
              {th ? 'พิซซ่าคู่' : 'Dual Pizza'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Chart Body */}
      {chartType === 'overlay' ? (
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs">
            <span className="inline-flex items-center gap-2 font-bold text-primary">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorA }} />
              {A.name}
              <span className="font-normal text-muted">
                ({seasonShort(seasonA)} · {scopeLabel(A)})
              </span>
            </span>
            <span className="inline-flex items-center gap-2 font-bold text-primary">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorB }} />
              {B.name}
              <span className="font-normal text-muted">
                ({seasonShort(seasonB)} · {scopeLabel(B)})
              </span>
            </span>
          </div>
          <div className="mt-2">
            <OverlayRadar
              A={A}
              B={B}
              poolA={poolA}
              poolB={poolB}
              colorA={colorA}
              colorB={colorB}
              scope={scope}
              th={th}
              activeId={activeId}
              onSelect={setActiveId}
            />
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-6 md:grid-cols-2 md:divide-x md:divide-border">
          {[
            { p: A, s: seasonA, pool: poolA, c: colorA },
            { p: B, s: seasonB, pool: poolB, c: colorB },
          ].map(({ p, s, pool, c }, idx) => (
            <div key={`${idx}-${p.key}-${s}`} className="min-w-0 md:px-4">
              <div className="text-center">
                <h3 className="font-bold text-primary">{p.name}</h3>
                <p className="mt-0.5 text-xs text-muted">
                  {clubName(p.club)} · PL {seasonShort(s)}
                </p>
                <span className="mt-1.5 inline-block rounded-full bg-bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-muted">
                  {scopeLabel(p)}
                </span>
              </div>
              <InteractivePizza
                p={p}
                pool={pool}
                color={c}
                scope={scope}
                th={th}
                activeId={activeId}
                onSelect={setActiveId}
              />
            </div>
          ))}
        </div>
      )}

      {/* Live Metric Inspector Strip */}
      <div className="mt-4 rounded-xl border border-border bg-bg-secondary/70 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
              {th ? 'คลิกหรือชี้ที่กราฟเพื่อดูรายละเอียด' : 'Hover or tap any axis to inspect'}
            </span>
            <p className="text-sm font-bold text-primary">
              {th ? activeMetric.th : activeMetric.en}
              {activeMetric.lowerBetter && (
                <span className="ml-2 text-xs font-normal text-muted">
                  ({th ? 'ยิ่งน้อยยิ่งดี' : 'lower is better'})
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 tabular-nums">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorA }} />
              <div className="text-right">
                <div className="text-sm font-extrabold text-primary">
                  {formatMetricVal(activeMetric, A, 'per90')}
                </div>
                <div className="text-[11px] text-muted">
                  {rA.rank != null ? `#${rA.rank}/${rA.total}` : '—'}
                </div>
              </div>
              <span
                className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${pctBadgeClass(rA.pct)}`}
              >
                P{rA.pct ?? '—'}
              </span>
            </div>

            <div className="hidden h-7 w-px bg-border sm:block" />

            <div className="text-center">
              <div className="text-[10px] uppercase text-muted">
                {th ? 'ส่วนต่าง (A−B)' : 'Diff (A−B)'}
              </div>
              <div className="text-xs font-bold text-primary">
                {formatDelta(activeMetric, diff, 'per90')}
              </div>
            </div>

            <div className="hidden h-7 w-px bg-border sm:block" />

            <div className="flex items-center gap-2">
              <span
                className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${pctBadgeClass(rB.pct)}`}
              >
                P{rB.pct ?? '—'}
              </span>
              <div>
                <div className="text-sm font-extrabold text-primary">
                  {formatMetricVal(activeMetric, B, 'per90')}
                </div>
                <div className="text-[11px] text-muted">
                  {rB.rank != null ? `#${rB.rank}/${rB.total}` : '—'}
                </div>
              </div>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorB }} />
            </div>
          </div>
        </div>
      </div>

      {/* Quick metric pills for mobile / keyboard */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {PIZZA_METRICS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setActiveId(m.id)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              m.id === activeId
                ? 'bg-primary text-surface'
                : 'bg-bg-secondary text-muted hover:text-primary'
            }`}
          >
            {th ? m.shortTh : m.shortEn}
          </button>
        ))}
      </div>

      <p className="mt-4 border-t border-border pt-3 text-[11px] leading-relaxed text-muted">
        {th
          ? 'เปอร์เซ็นไทล์ (1–99) คำนวณเทียบกับผู้เล่นเอาท์ฟิลด์ที่ลงเล่นอย่างน้อย 30% ของนาทีสูงสุดในทีมภายในฤดูกาลของนักเตะแต่ละคน อ้างอิงจากประตู แอสซิสต์ การยิง และการลงเล่น (ไม่มีข้อมูลเกมรับ/การจ่ายบอล) จึงสะท้อนสไตล์และบทบาทเกมรุก ไม่ใช่คะแนนรวม'
          : "Percentiles (1–99) rank each player within their own selected PL season against qualified outfield peers (≥30% of team max minutes). Built from goals, assists, shooting and playing time — defensive and passing metrics aren't included, so treat this as an attacking & role footprint."}
      </p>
    </section>
  );
}
