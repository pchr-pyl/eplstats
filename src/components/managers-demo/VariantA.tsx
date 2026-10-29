'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { fmt, pct, signed } from '@/lib/format';
import { seasonShort } from '@/lib/stats';
import {
  csRate,
  daysInCharge,
  displayName,
  gaPer,
  gfPer,
  isCurrent,
  periodLong,
  periodShort,
  ppg,
  RollPoint,
  StatBase,
  stintRuns,
  StintStat,
  surname,
  VariantProps,
  winRate,
  xgaPer,
  xgPer,
} from './shared';

const numCell = 'px-3 py-2 text-right text-sm text-secondary whitespace-nowrap';
const L_ = (lang: 'th' | 'en', th: string, en: string) => (lang === 'th' ? th : en);

/** Measured pixel width of a wrapper div (ResizeObserver). */
function useWidth(ref: React.RefObject<HTMLElement | null>) {
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

function StatLine({ s, baseline, L }: { s: StatBase; baseline: number | null; L: (t: string, e: string) => string }) {
  const p = ppg(s);
  const delta = p != null && baseline != null ? p - baseline : null;
  return (
    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm">
      <span className="text-lg font-semibold text-primary">
        {s.w}–{s.d}–{s.l}
      </span>
      <span className="text-secondary">
        {fmt(p)} <span className="text-muted">{L('แต้ม/นัด', 'pts/match')}</span>
      </span>
      <span className="text-secondary">
        {pct(winRate(s), 2)} <span className="text-muted">{L('อัตราชนะ', 'win rate')}</span>
      </span>
      {delta != null && (
        <span className={delta >= 0 ? 'text-success' : 'text-danger'}>
          {signed(delta)} <span className="text-muted">{L('เทียบค่าเฉลี่ยสโมสร', 'vs club avg')}</span>
        </span>
      )}
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
    <div className="rounded-lg border border-border bg-surface-elevated px-3 py-2 text-xs shadow-sm">
      <div className="font-medium text-primary">
        {p.date} · {p.result} {L_(lang, 'vs', 'vs')} {p.opp ?? '—'}
      </div>
      <div className="text-secondary">
        {L_(lang, 'แต้ม/นัด 10 นัดล่าสุด', 'Rolling 10-match PPG')}: {fmt(p.ppg)}
      </div>
      {stint && <div className="text-muted">{displayName(stint, lang)}</div>}
    </div>
  );
}

export function VariantA({ data, roll, baseline, lang }: VariantProps) {
  const L = (th: string, en: string) => (lang === 'th' ? th : en);
  const withGames = data.filter((s) => s.mp > 0);

  // spotlight: current manager with matches, else latest stint with matches
  const cur = data.find((s) => isCurrent(s.stint) && s.mp > 0);
  const spotlight = cur ?? withGames[withGames.length - 1] ?? data[data.length - 1];
  const [sel, setSel] = useState<string | null>(null);
  const selStat = data.find((s) => s.id === sel) ?? spotlight;
  const runs = stintRuns(roll);
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
  useLayoutEffect(() => {
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
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withGames.map((s) => s.id).join(',')]);

  return (
    <>
      {/* spotlight */}
      {spotlight && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: 'var(--brand)' }} />
            {isCurrent(spotlight.stint) && spotlight.mp > 0
              ? L('ผู้จัดการปัจจุบัน', 'Current manager')
              : L('ผู้จัดการล่าสุดในข้อมูล', 'Latest manager in data')}
          </div>
          <h2
            className="font-display font-semibold leading-tight text-primary"
            style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)' }}
          >
            {displayName(spotlight.stint, lang)}
          </h2>
          <p className="text-sm text-secondary">
            {L('ตั้งแต่', 'since')} {spotlight.stint.from} · {daysInCharge(spotlight.stint)}{' '}
            {L('วัน', 'days')}
          </p>
          {spotlight.mp > 0 ? (
            <StatLine s={spotlight} baseline={baseline} L={L} />
          ) : (
            <p className="text-sm text-muted">{L('ยังไม่มีนัดที่ลงเล่น', 'No matches played yet')}</p>
          )}
        </section>
      )}

      {/* rolling PPG chart */}
      <section className="rounded-2xl border border-border bg-surface p-4">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h3 className="font-display text-lg font-semibold text-primary">
            {L('แต้มต่อนัด — ค่าเฉลี่ย 10 นัดล่าสุด', 'Points per match — rolling 10')}
          </h3>
          {baseline != null && (
            <span className="text-xs text-muted">
              {L('ค่าเฉลี่ยสโมสร', 'club avg')} {fmt(baseline)}
            </span>
          )}
        </div>
        <div className="h-64 w-full sm:h-72" ref={chartWrap}>
          <ResponsiveContainer>
            <LineChart data={roll} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
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
                return (
                  <ReferenceArea
                    key={`${r.sid}-${r.x1}`}
                    x1={r.x1}
                    x2={r.x2}
                    fill="var(--bg-secondary)"
                    fillOpacity={interim ? 0.35 : idx % 2 === 0 ? 0.9 : 0}
                    label={
                      st && labelFits
                        ? {
                            value: lab,
                            position: 'insideTop',
                            fontSize: 10,
                            fill: 'var(--text-muted)',
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
                    value: fmt(baseline),
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
                strokeWidth={2}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* era strip */}
      <section className="flex flex-col gap-3">
        <div
          ref={stripRef}
          role="group"
          aria-label={L('ยุคสมัยผู้จัดการ', 'Manager eras')}
          className="flex h-12 w-full gap-0.5 overflow-hidden rounded-lg border border-border bg-surface p-0.5"
        >
          {withGames.map((s) => {
            const p = ppg(s);
            const mix = p == null ? 8 : Math.round(10 + (Math.min(Math.max(p, 0), 3) / 3) * 80);
            const base = `color-mix(in srgb, var(--brand) ${mix}%, var(--surface))`;
            const bg = s.stint.interim
              ? `repeating-linear-gradient(45deg, ${base} 0 6px, color-mix(in srgb, var(--brand) ${Math.round(mix / 2)}%, var(--surface)) 6px 12px)`
              : base;
            const selected = selStat?.id === s.id;
            const desc = `${displayName(s.stint, lang)} · ${periodShort(s.stint, lang)} · ${fmt(p)} ${L('แต้ม/นัด', 'pts/match')}`;
            return (
              <button
                key={s.id}
                type="button"
                data-sid={s.id}
                aria-pressed={selected}
                aria-label={desc}
                title={desc}
                onClick={() => setSel(s.id)}
                className={`relative flex min-w-7 items-center justify-center rounded text-[11px] font-medium text-primary transition-all focus-visible:outline-2 focus-visible:outline-brand ${
                  selected ? 'ring-2 ring-brand ring-inset' : 'hover:brightness-95 dark:hover:brightness-110'
                }`}
                style={{ flexGrow: s.mp, background: bg }}
              >
                {isCurrent(s.stint) && (
                  <span
                    aria-hidden
                    className="absolute left-1/2 top-1 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
                    style={{ background: 'var(--brand)' }}
                  />
                )}
                <span
                  data-lab
                  className={`truncate px-1 ${fits[s.id] ? '' : 'invisible absolute'}`}
                >
                  {surname(s.stint, lang)}
                </span>
              </button>
            );
          })}
          {withGames.length === 0 && (
            <span className="flex w-full items-center justify-center text-xs text-muted">—</span>
          )}
        </div>

        {/* detail panel */}
        {selStat && (
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-3">
                <h4 className="font-display text-xl font-semibold text-primary">
                  {displayName(selStat.stint, lang)}
                </h4>
                {selStat.stint.interim && (
                  <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted">
                    {L('รักษาการ', 'interim')}
                  </span>
                )}
              </div>
              <span className="text-sm text-muted">{periodLong(selStat.stint, lang)}</span>
            </div>
            <StatLine s={selStat} baseline={baseline} L={L} />
            {selStat.seasons.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      {[
                        L('ฤดูกาล', 'Season'),
                        'MP',
                        'W–D–L',
                        L('แต้ม/นัด', 'Pts/match'),
                        L('อัตราชนะ', 'Win rate'),
                        'GF/GA ' + L('ต่อนัด', '/match'),
                        L('คลีนชีต %', 'Clean sheet %'),
                        'xG/xGA ' + L('ต่อนัด', '/match'),
                      ].map((h, i) => (
                        <th
                          key={i}
                          className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted whitespace-nowrap ${i === 0 ? 'text-left' : 'text-right'}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selStat.seasons.map((ss) => (
                      <tr key={ss.season} className="border-b border-border-light last:border-0">
                        <td className="px-3 py-2 text-sm font-medium text-primary whitespace-nowrap">
                          {seasonShort(ss.season)}
                        </td>
                        <td className={numCell}>{ss.mp}</td>
                        <td className={numCell}>
                          {ss.w}–{ss.d}–{ss.l}
                        </td>
                        <td className={numCell}>{fmt(ppg(ss))}</td>
                        <td className={numCell}>{pct(winRate(ss), 2)}</td>
                        <td className={numCell}>
                          {fmt(gfPer(ss))} / {fmt(gaPer(ss))}
                        </td>
                        <td className={numCell}>{pct(csRate(ss), 2)}</td>
                        <td className={numCell}>
                          {ss.xgN > 0 ? `${fmt(xgPer(ss))} / ${fmt(xgaPer(ss))}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>
    </>
  );
}
