'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Calendar, ChevronDown, ChevronUp, ListFilter } from 'lucide-react';
import { fmt, pct, signed } from '@/lib/format';
import { seasonShort } from '@/lib/stats';
import { ScoresList, RESULT_STYLE } from '@/components/matchlog-shared';
import {
  csRate,
  daysInCharge,
  displayName,
  drawRate,
  gaPer,
  gfPer,
  isCurrent,
  lossRate,
  periodLong,
  periodShort,
  ppg,
  RollPoint,
  rollingWindow,
  StatBase,
  stintRuns,
  StintStat,
  surname,
  tenureDuration,
  VariantProps,
  winRate,
  xgaPer,
  xgPer,
} from './shared';

const numCell = 'px-3 py-2.5 text-right text-sm tabular-nums text-secondary whitespace-nowrap';
const L_ = (lang: 'th' | 'en', th: string, en: string) => (lang === 'th' ? th : en);

/** Measured pixel width of a wrapper div (ResizeObserver — async callback, no sync setState). */
function useWidth(ref: React.RefObject<HTMLElement | null>) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? el.clientWidth;
      setW(Math.round(next));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

function WdlProportionalBar({
  s,
  lang,
  showLabels = false,
}: {
  s: StatBase;
  lang: 'th' | 'en';
  showLabels?: boolean;
}) {
  if (s.mp === 0) return <span className="text-muted">—</span>;
  const wPct = (s.w / s.mp) * 100;
  const dPct = (s.d / s.mp) * 100;
  const lPct = (s.l / s.mp) * 100;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-bg-secondary">
        {s.w > 0 && (
          <span
            style={{ width: `${wPct}%`, background: 'var(--success)' }}
            className="h-full transition-all"
            title={`W: ${s.w} (${pct(winRate(s), 2)})`}
          />
        )}
        {s.d > 0 && (
          <span
            style={{ width: `${dPct}%`, background: 'var(--chart-neutral)' }}
            className="h-full transition-all"
            title={`D: ${s.d} (${pct(drawRate(s), 2)})`}
          />
        )}
        {s.l > 0 && (
          <span
            style={{ width: `${lPct}%`, background: 'var(--danger)' }}
            className="h-full transition-all"
            title={`L: ${s.l} (${pct(lossRate(s), 2)})`}
          />
        )}
      </div>
      {showLabels && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs tabular-nums">
          <span className="inline-flex items-center gap-1.5 font-medium text-success">
            <span className="h-2 w-2 rounded-full bg-success" />
            {L_(lang, 'ชนะ', 'W')} {s.w} ({pct(winRate(s), 2)})
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-muted">
            <span className="h-2 w-2 rounded-full bg-chart-neutral" />
            {L_(lang, 'เสมอ', 'D')} {s.d} ({pct(drawRate(s), 2)})
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-danger">
            <span className="h-2 w-2 rounded-full bg-danger" />
            {L_(lang, 'แพ้', 'L')} {s.l} ({pct(lossRate(s), 2)})
          </span>
        </div>
      )}
    </div>
  );
}

function MiniWdlCell({ s }: { s: StatBase }) {
  if (s.mp === 0) return <span className="text-muted">—</span>;
  return (
    <div className="flex items-center justify-end gap-2">
      <span className="tabular-nums text-secondary">
        {s.w}–{s.d}–{s.l}
      </span>
      <span className="flex h-1.5 w-14 overflow-hidden rounded-full bg-bg-secondary" aria-hidden>
        {s.w > 0 && <span style={{ width: `${(s.w / s.mp) * 100}%`, background: 'var(--success)' }} />}
        {s.d > 0 && <span style={{ width: `${(s.d / s.mp) * 100}%`, background: 'var(--chart-neutral)' }} />}
        {s.l > 0 && <span style={{ width: `${(s.l / s.mp) * 100}%`, background: 'var(--danger)' }} />}
      </span>
    </div>
  );
}

function RollTooltip({
  active,
  payload,
  data,
  lang,
}: {
  active?: boolean;
  payload?: { payload: RollPoint }[];
  data: StintStat[];
  lang: 'th' | 'en';
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const stint = data.find((s) => s.id === p.sid)?.stint;
  return (
    <div className="rounded-xl border border-border bg-surface-elevated px-3.5 py-2.5 text-xs shadow-md">
      <div className="flex items-center gap-2 font-semibold text-primary">
        <span className="tabular-nums text-muted">{p.date}</span>
        <span
          className={`inline-flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold ${
            RESULT_STYLE[p.result] ?? ''
          }`}
        >
          {p.result}
        </span>
        <span>vs {p.opp ?? '—'}</span>
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-4 text-secondary">
        <span>{L_(lang, 'แต้ม/นัด (ค่าเฉลี่ยเคลื่อนที่)', 'Rolling PPG')}</span>
        <span className="font-bold tabular-nums text-primary">{fmt(p.ppg, 2)}</span>
      </div>
      {stint && (
        <div className="mt-1 border-t border-border-light pt-1 text-[11px] font-medium text-muted">
          {displayName(stint, lang)}
        </div>
      )}
    </div>
  );
}

export function VariantA({ data, roll, baseline, lang, hasXg, group }: VariantProps) {
  const L = (th: string, en: string) => (lang === 'th' ? th : en);
  const withGames = useMemo(() => data.filter((s) => s.mp > 0), [data]);
  const winN = rollingWindow(roll.length);

  // spotlight: current manager with matches, else latest stint with matches
  const cur = data.find((s) => isCurrent(s.stint) && s.mp > 0);
  const spotlight = cur ?? withGames[withGames.length - 1] ?? data[data.length - 1];
  const [sel, setSel] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [resFilter, setResFilter] = useState<'all' | 'W' | 'D' | 'L'>('all');

  const selStat = data.find((s) => s.id === sel) ?? spotlight;
  const runs = useMemo(() => stintRuns(roll), [roll]);
  const stintById = (sid: string | null) => data.find((s) => s.id === sid);

  // --- chart geometry: measured width drives tick thinning + band labels ---
  const chartWrap = useRef<HTMLDivElement>(null);
  const chartW = useWidth(chartWrap);
  const usableW = Math.max(chartW - 72, 100);
  const seasonTicks = useMemo(() => {
    const t: { i: number; season: string }[] = [];
    roll.forEach((p, idx) => {
      if (idx === 0 || roll[idx - 1].season !== p.season) t.push({ i: p.i, season: p.season });
    });
    return t;
  }, [roll]);
  const tickStep = Math.max(
    1,
    Math.ceil(seasonTicks.length / Math.max(1, Math.floor(usableW / 72))),
  );
  const tickVals = seasonTicks.filter((_, k) => k % tickStep === 0);
  const seasonAt = (i: number) =>
    tickVals.find((t) => t.i === i)?.season ?? roll[i]?.season ?? '';

  // --- era strip: label only segments whose measured width fits the text ---
  const stripRef = useRef<HTMLDivElement>(null);
  const [fits, setFits] = useState<Record<string, boolean>>({});
  const withGamesKey = withGames.map((s) => s.id).join(',');
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const measure = () => {
      const next: Record<string, boolean> = {};
      el.querySelectorAll('button[data-sid]').forEach((b) => {
        const btn = b as HTMLElement;
        const lab = btn.querySelector('span[data-lab]') as HTMLElement | null;
        next[btn.dataset.sid!] = lab ? lab.scrollWidth + 14 <= btn.clientWidth : false;
      });
      setFits(next);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [withGamesKey]);

  const filteredGames = useMemo(() => {
    if (!selStat) return [];
    const rev = [...selStat.games].reverse();
    return resFilter === 'all' ? rev : rev.filter((m) => m.result === resFilter);
  }, [selStat, resFilter]);

  if (withGames.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-8 text-center">
        <p className="text-secondary">{L('ไม่มีนัดในรายการนี้', 'No matches in this competition')}</p>
      </section>
    );
  }

  const selPpg = selStat ? ppg(selStat) : null;
  const selDelta = selPpg != null && baseline != null ? selPpg - baseline : null;
  const showComp = group === 'all' || group === 'europe';

  return (
    <>
      {/* -------------------------------------------------- Rolling PPG Chart */}
      <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none sm:p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
              {L('เส้นทางฟอร์มการเล่น', 'FORM TRAJECTORY')}
            </p>
            <h3 className="mt-0.5 font-display text-lg font-bold text-primary sm:text-xl">
              {L(`แต้มต่อนัด — ค่าเฉลี่ยเคลื่อนที่ ${winN} นัด`, `Points per match — rolling ${winN}`)}
            </h3>
          </div>
          {baseline != null && (
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-bg-secondary px-3 py-1 text-xs font-semibold text-secondary tabular-nums">
              <span className="h-0.5 w-3 border-t border-dashed border-muted" />
              {L('ค่าเฉลี่ยสโมสร', 'Club avg')}: <strong className="text-primary">{fmt(baseline, 2)}</strong>
            </span>
          )}
        </div>
        <div className="h-64 w-full sm:h-72" ref={chartWrap}>
          <ResponsiveContainer>
            <LineChart data={roll} margin={{ top: 18, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border-light)" />
              <XAxis
                dataKey="i"
                type="number"
                domain={[0, 'dataMax']}
                ticks={tickVals.map((t) => t.i)}
                tickFormatter={(i: number) => seasonShort(seasonAt(i))}
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 3]}
                ticks={[0, 1, 2, 3]}
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                tickLine={false}
                axisLine={false}
              />
              {runs.map((r, idx) => {
                const st = stintById(r.sid);
                const interim = st?.stint.interim ?? false;
                const bandPx =
                  roll.length > 1 ? ((r.x2 - r.x1 + 1) / (roll.length - 1)) * usableW : usableW;
                const lab = st ? surname(st.stint, lang) : '';
                const labelFits = bandPx > lab.length * 7 + 14;
                const isSelectedBand = st?.id === selStat?.id;
                return (
                  <ReferenceArea
                    key={`${r.sid}-${r.x1}`}
                    x1={r.x1}
                    x2={r.x2}
                    fill={isSelectedBand ? 'var(--brand)' : 'var(--bg-secondary)'}
                    fillOpacity={isSelectedBand ? 0.08 : interim ? 0.35 : idx % 2 === 0 ? 0.85 : 0}
                    label={
                      st && labelFits
                        ? {
                            value: lab,
                            position: 'insideTop',
                            fontSize: 10,
                            fill: isSelectedBand ? 'var(--brand)' : 'var(--text-muted)',
                            fontWeight: isSelectedBand ? 700 : 500,
                          }
                        : undefined
                    }
                  />
                );
              })}
              {baseline != null && (
                <ReferenceLine
                  y={baseline}
                  stroke="var(--text-muted)"
                  strokeDasharray="4 4"
                  label={{
                    value: fmt(baseline, 2),
                    position: 'insideTopRight',
                    fontSize: 10,
                    fill: 'var(--text-muted)',
                  }}
                />
              )}
              <Tooltip content={<RollTooltip data={data} lang={lang} />} />
              <Line
                dataKey="ppg"
                stroke="var(--brand)"
                strokeWidth={2.2}
                dot={false}
                activeDot={{ r: 4, fill: 'var(--brand)', stroke: 'var(--surface)', strokeWidth: 2 }}
                connectNulls
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* -------------------------------------- Proportional Era Strip Selector */}
      <section className="flex flex-col gap-4">
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                {L('ไทม์ไลน์ยุคสมัย (ความกว้างตามจำนวนนัด · ความเข้มสีตามแต้ม/นัด)', 'ERA TIMELINE (WIDTH = MATCHES · INTENSITY = PPG)')}
              </p>
              <h3 className="mt-0.5 font-display text-base font-bold text-primary sm:text-lg">
                {L('คลิกเพื่อเจาะลึกแต่ละยุคสมัย', 'Select an era to inspect')}
              </h3>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-brand" />
                {L('ปัจจุบัน', 'Current')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-2.5 w-4 rounded-sm border border-border"
                  style={{
                    background:
                      'repeating-linear-gradient(45deg, var(--brand-soft) 0 3px, var(--surface) 3px 6px)',
                  }}
                />
                {L('รักษาการ', 'Interim')}
              </span>
            </div>
          </div>

          <div
            ref={stripRef}
            role="group"
            aria-label={L('ยุคสมัยผู้จัดการ', 'Manager eras')}
            className="flex h-13 w-full gap-0.5 overflow-hidden rounded-xl border border-border bg-bg-secondary p-1"
          >
            {withGames.map((s) => {
              const p = ppg(s);
              const mix = p == null ? 10 : Math.round(12 + (Math.min(Math.max(p, 0), 3) / 3) * 72);
              const base = `color-mix(in srgb, var(--brand) ${mix}%, var(--surface))`;
              const bg = s.stint.interim
                ? `repeating-linear-gradient(45deg, ${base} 0 6px, color-mix(in srgb, var(--brand) ${Math.round(mix / 2)}%, var(--surface)) 6px 12px)`
                : base;
              const selected = selStat?.id === s.id;
              const desc = `${displayName(s.stint, lang)} · ${periodShort(s.stint, lang)} · ${fmt(p, 2)} ${L('แต้ม/นัด', 'PPG')}`;
              return (
                <button
                  key={s.id}
                  type="button"
                  data-sid={s.id}
                  aria-pressed={selected}
                  aria-label={desc}
                  title={desc}
                  onClick={() => {
                    setSel(s.id);
                    setResFilter('all');
                  }}
                  className={`relative flex min-w-7 cursor-pointer items-center justify-center rounded-lg text-[11px] font-bold text-primary transition-all focus-visible:outline-2 focus-visible:outline-brand ${
                    selected
                      ? 'ring-2 ring-primary ring-offset-1 ring-offset-bg-secondary'
                      : 'hover:brightness-95 dark:hover:brightness-110'
                  }`}
                  style={{ flexGrow: s.mp, background: bg }}
                >
                  {isCurrent(s.stint) && (
                    <span
                      aria-hidden
                      className="absolute left-1/2 top-1 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-brand shadow-sm"
                    />
                  )}
                  <span
                    data-lab
                    className={`truncate px-1.5 ${fits[s.id] ? '' : 'invisible absolute'}`}
                  >
                    {surname(s.stint, lang)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quick clickable pills for easy access on narrow screens or short stints */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {withGames.map((s) => {
              const selected = selStat?.id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setSel(s.id);
                    setResFilter('all');
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                    selected
                      ? 'border-brand bg-brand-soft text-brand'
                      : 'border-border bg-bg-secondary/60 text-secondary hover:border-primary/30 hover:text-primary'
                  }`}
                >
                  <span>{surname(s.stint, lang)}</span>
                  <span className="tabular-nums opacity-75">({s.mp})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* -------------------------------------------- Selected Era Detail Card */}
        {selStat && (
          <div
            className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm dark:shadow-none"
            style={{ borderTopWidth: 2, borderTopColor: 'var(--brand)' }}
          >
            <div className="p-4 sm:p-6">
              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-display text-2xl font-bold tracking-tight text-primary sm:text-3xl">
                      {displayName(selStat.stint, lang)}
                    </h4>
                    {isCurrent(selStat.stint) && (
                      <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-brand">
                        {L('ปัจจุบัน', 'Current')}
                      </span>
                    )}
                    {selStat.stint.interim && (
                      <span className="rounded-full border border-warning/30 bg-warning-soft px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-warning">
                        {L('รักษาการ', 'Interim')}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs font-medium text-muted">
                    <Calendar size={13} />
                    <span className="tabular-nums">{periodLong(selStat.stint, lang)}</span>
                    <span>·</span>
                    <span className="tabular-nums">
                      {daysInCharge(selStat.stint).toLocaleString()} {L('วัน', 'days')} (
                      {tenureDuration(daysInCharge(selStat.stint), lang)})
                    </span>
                  </p>
                </div>

                <div className="flex items-baseline gap-2 rounded-xl border border-border bg-bg-secondary/70 px-3.5 py-2">
                  <span className="font-display text-2xl font-bold tabular-nums text-primary">
                    {fmt(selPpg, 2)}
                  </span>
                  <div className="flex flex-col text-[11px] leading-tight">
                    <span className="font-bold uppercase tracking-wider text-muted">
                      {L('แต้ม/นัด', 'PPG')}
                    </span>
                    {selDelta != null && (
                      <span
                        className={`font-semibold tabular-nums ${
                          selDelta >= 0 ? 'text-success' : 'text-danger'
                        }`}
                      >
                        {signed(selDelta, 2)} {L('เทียบเฉลี่ย', 'vs avg')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* W-D-L Proportional Bar */}
              <div className="mt-4">
                <WdlProportionalBar s={selStat} lang={lang} showLabels />
              </div>

              {/* Key Metric Tiles */}
              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                <div className="rounded-xl border border-border-light bg-bg-secondary/50 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    {L('ลงเล่น', 'Matches')}
                  </div>
                  <div className="mt-1 font-display text-xl font-bold tabular-nums text-primary">
                    {selStat.mp}
                  </div>
                </div>
                <div className="rounded-xl border border-border-light bg-bg-secondary/50 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    {L('อัตราชนะ', 'Win %')}
                  </div>
                  <div className="mt-1 font-display text-xl font-bold tabular-nums text-primary">
                    {pct(winRate(selStat), 2)}
                  </div>
                </div>
                <div className="rounded-xl border border-border-light bg-bg-secondary/50 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    {L('ยิงได้/นัด', 'GF / Match')}
                  </div>
                  <div className="mt-1 font-display text-xl font-bold tabular-nums text-primary">
                    {fmt(gfPer(selStat), 2)}
                  </div>
                </div>
                <div className="rounded-xl border border-border-light bg-bg-secondary/50 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    {L('เสียประตู/นัด', 'GA / Match')}
                  </div>
                  <div className="mt-1 font-display text-xl font-bold tabular-nums text-primary">
                    {fmt(gaPer(selStat), 2)}
                  </div>
                </div>
                <div className="rounded-xl border border-border-light bg-bg-secondary/50 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    {L('คลีนชีต %', 'Clean Sheet %')}
                  </div>
                  <div className="mt-1 font-display text-xl font-bold tabular-nums text-primary">
                    {pct(csRate(selStat), 2)}
                  </div>
                </div>
                {hasXg && (
                  <div className="rounded-xl border border-border-light bg-bg-secondary/50 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                      xG / xGA
                    </div>
                    <div className="mt-1 font-display text-xl font-bold tabular-nums text-primary">
                      {selStat.xgN > 0
                        ? `${fmt(xgPer(selStat), 2)} / ${fmt(xgaPer(selStat), 2)}`
                        : '—'}
                    </div>
                  </div>
                )}
              </div>

              {/* Per-Season Breakdown Table */}
              {selStat.seasons.length > 0 && (
                <div className="mt-5 overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[740px] border-collapse">
                    <thead className="bg-surface-elevated">
                      <tr className="border-b border-border">
                        {[
                          L('ฤดูกาล', 'Season'),
                          'MP',
                          'W–D–L',
                          L('แต้ม/นัด', 'PPG'),
                          L('อัตราชนะ', 'Win %'),
                          'GF/GA ' + L('ต่อนัด', '/M'),
                          L('คลีนชีต %', 'CS %'),
                          ...(hasXg ? ['xG/xGA ' + L('ต่อนัด', '/M')] : []),
                        ].map((h, i) => (
                          <th
                            key={i}
                            className={`px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted whitespace-nowrap ${
                              i === 0 ? 'text-left' : 'text-right'
                            }`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selStat.seasons.map((ss) => (
                        <tr
                          key={ss.season}
                          className="border-b border-border-light transition-colors last:border-0 hover:bg-bg-secondary/50"
                        >
                          <td className="px-3 py-2.5 text-sm font-semibold text-primary whitespace-nowrap">
                            {seasonShort(ss.season)}
                          </td>
                          <td className={numCell}>{ss.mp}</td>
                          <td className="px-3 py-2.5 text-right text-sm whitespace-nowrap">
                            <MiniWdlCell s={ss} />
                          </td>
                          <td className="px-3 py-2.5 text-right text-sm font-semibold tabular-nums text-primary whitespace-nowrap">
                            {fmt(ppg(ss), 2)}
                          </td>
                          <td className={numCell}>{pct(winRate(ss), 2)}</td>
                          <td className={numCell}>
                            {fmt(gfPer(ss), 2)} / {fmt(gaPer(ss), 2)}
                          </td>
                          <td className={numCell}>{pct(csRate(ss), 2)}</td>
                          {hasXg && (
                            <td className={numCell}>
                              {ss.xgN > 0 ? `${fmt(xgPer(ss), 2)} / ${fmt(xgaPer(ss), 2)}` : '—'}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Interactive Match Log Drill-Down */}
              <div className="mt-5 border-t border-border pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    aria-expanded={showLog}
                    onClick={() => setShowLog((v) => !v)}
                    className="inline-flex items-center gap-2 rounded-xl border border-border bg-bg-secondary/70 px-3.5 py-2 text-xs font-bold text-primary transition-colors hover:border-brand/40 hover:bg-brand-soft hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
                  >
                    <ListFilter size={14} />
                    <span>
                      {showLog
                        ? L('ซ่อนบันทึกการแข่งขัน', 'Hide match log')
                        : L('ดูบันทึกการแข่งขันทั้งหมด', 'Inspect match log')}
                      {' '}
                      <span className="tabular-nums opacity-80">({selStat.games.length})</span>
                    </span>
                    {showLog ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {showLog && (
                    <div className="flex items-center gap-1.5">
                      {(['all', 'W', 'D', 'L'] as const).map((r) => {
                        const count =
                          r === 'all'
                            ? selStat.mp
                            : r === 'W'
                              ? selStat.w
                              : r === 'D'
                                ? selStat.d
                                : selStat.l;
                        const active = resFilter === r;
                        return (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setResFilter(r)}
                            className={`rounded-full border px-2.5 py-1 text-xs font-bold tabular-nums transition-colors ${
                              active
                                ? 'border-brand bg-brand-soft text-brand'
                                : 'border-border bg-surface text-secondary hover:text-primary'
                            }`}
                          >
                            {r === 'all' ? L('ทั้งหมด', 'All') : r} ({count})
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {showLog && (
                  <div className="mt-3 overflow-hidden rounded-xl border border-border bg-surface">
                    {filteredGames.length > 0 ? (
                      <ScoresList rows={filteredGames} showComp={showComp} />
                    ) : (
                      <p className="px-4 py-6 text-center text-sm text-muted">
                        {L('ไม่มีนัดในตัวกรองนี้', 'No matches for this filter')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
