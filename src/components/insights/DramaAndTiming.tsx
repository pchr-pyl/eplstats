'use client';

import Link from 'next/link';
import { Clock, Flame, Zap } from 'lucide-react';
import type { ClubIndexEntry } from '@/lib/types';
import type { Drama, FormClub, StatClub } from '@/lib/insights';
import type { GoalTimingSummary } from '@/lib/insightsExtended';
import { fmt } from '@/lib/format';
import { ClubCrest } from '@/components/LeagueHome';

const RES_STYLE: Record<string, string> = {
  W: 'bg-success/15 text-success',
  D: 'bg-bg-secondary text-muted',
  L: 'bg-danger/15 text-danger',
};

function ClubMeterRow({
  slug,
  label,
  n,
  max,
  barClass,
}: {
  slug: string;
  label: string;
  n: number;
  max: number;
  barClass: string;
}) {
  return (
    <div className="space-y-1 py-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <Link
          href={`/${slug}/`}
          className="inline-flex min-w-0 items-center gap-1.5 font-medium text-primary hover:text-brand"
        >
          <ClubCrest slug={slug} size={15} />
          <span className="truncate">{label}</span>
        </Link>
        <strong className="shrink-0 tabular-nums text-primary">{n}</strong>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-bg-secondary">
        <div
          className={`h-full rounded-full ${barClass}`}
          style={{ width: `${Math.max(12, (n / Math.max(1, max)) * 100)}%` }}
        />
      </div>
    </div>
  );
}

export function DramaAndTiming({
  goalTiming,
  drama,
  form,
  unbeaten,
  winRun,
  winless,
  clubs,
  th,
}: {
  goalTiming: GoalTimingSummary;
  drama: Drama;
  form: FormClub[];
  unbeaten: StatClub[];
  winRun: StatClub[];
  winless: StatClub[];
  clubs: Map<string, ClubIndexEntry>;
  th: boolean;
}) {
  const nameOf = (slug: string) => {
    const c = clubs.get(slug);
    return th && c?.nameTh ? c.nameTh : c?.shortName ?? c?.name ?? slug;
  };

  const maxBucket = Math.max(1, ...goalTiming.buckets.map((b) => b.count));
  const peakBucket = goalTiming.buckets.reduce(
    (a, b) => (b.count > a.count ? b : a),
    goalTiming.buckets[0],
  );
  const firstHalfPct =
    goalTiming.totalGoals > 0 ? (goalTiming.firstHalf / goalTiming.totalGoals) * 100 : 0;
  const secondHalfPct =
    goalTiming.totalGoals > 0 ? (goalTiming.secondHalf / goalTiming.totalGoals) * 100 : 0;

  return (
    <div id="drama" className="scroll-mt-24 space-y-6">
      {/* ---------------------------------- Goal Timing Distribution */}
      {goalTiming.totalGoals > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                <Clock size={13} />
                {th ? 'ช่วงเวลาทำประตูทั้งลีก' : 'League Goal Timing'} ·{' '}
                {goalTiming.totalGoals} {th ? 'ประตูจาก' : 'goals across'}{' '}
                {goalTiming.matchesParsed} {th ? 'นัด' : 'matches'}
              </p>
              <h2 className="mt-0.5 font-display text-lg font-bold text-primary sm:text-xl">
                {th ? 'นาทีไหนที่พรีเมียร์ลีกยิงกันดุที่สุด' : 'When Premier League Goals Happen'}
              </h2>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-border bg-bg-secondary/70 px-3.5 py-2 text-xs tabular-nums">
              <div>
                <span className="text-muted">{th ? 'ครึ่งแรก:' : '1st Half:'} </span>
                <strong className="text-primary">
                  {goalTiming.firstHalf} ({fmt(firstHalfPct, 2)}%)
                </strong>
              </div>
              <span className="text-border">|</span>
              <div>
                <span className="text-muted">{th ? 'ครึ่งหลัง:' : '2nd Half:'} </span>
                <strong className="text-primary">
                  {goalTiming.secondHalf} ({fmt(secondHalfPct, 2)}%)
                </strong>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-6 lg:grid-cols-12">
            {/* 6-bucket column bars */}
            <div className="flex flex-col justify-end lg:col-span-7">
              <div className="grid h-44 grid-cols-6 items-end gap-2.5 sm:gap-4">
                {goalTiming.buckets.map((b) => {
                  const isPeak = peakBucket && b.id === peakBucket.id;
                  const hPct = Math.max(10, (b.count / maxBucket) * 100);
                  return (
                    <div key={b.id} className="flex h-full flex-col items-center justify-end gap-1.5">
                      <span className="text-[11px] font-bold tabular-nums text-primary">
                        {b.count}
                      </span>
                      <div className="flex w-full flex-1 items-end">
                        <div
                          className={`w-full rounded-t-lg transition-all ${
                            isPeak ? 'bg-brand' : 'bg-info/70'
                          }`}
                          style={{ height: `${hPct}%` }}
                          title={`${b.label}: ${b.count} (${fmt(b.pct, 2)}%)`}
                        />
                      </div>
                      <div className="text-center">
                        <div className="text-[11px] font-bold tabular-nums text-primary">
                          {b.label}
                        </div>
                        <div className="text-[10px] tabular-nums text-muted">
                          {fmt(b.pct, 2)}%
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] text-muted">
                {th
                  ? `ช่วงเวลาอันตรายที่สุด: ${peakBucket.label} (${peakBucket.count} ประตู · ${fmt(peakBucket.pct, 2)}%)`
                  : `Deadliest window: ${peakBucket.label} with ${peakBucket.count} goals (${fmt(peakBucket.pct, 2)}% of all goals).`}
              </p>
            </div>

            {/* Fast Starters vs Late Surgeons */}
            <div className="grid gap-4 sm:grid-cols-2 lg:col-span-5">
              <div className="rounded-xl border border-border bg-bg-secondary/40 p-3.5">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-info">
                  {th ? "ออกตัวแรง (ยิงนาที 1–30')" : "Fast Starters (1–30')"}
                </p>
                {goalTiming.fastStarters.map((x) => (
                  <ClubMeterRow
                    key={x.slug}
                    slug={x.slug}
                    label={nameOf(x.slug)}
                    n={x.n}
                    max={goalTiming.fastStarters[0]?.n ?? 1}
                    barClass="bg-info"
                  />
                ))}
              </div>
              <div className="rounded-xl border border-border bg-bg-secondary/40 p-3.5">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-brand">
                  {th ? "ทีเด็ดท้ายเกม (ยิงนาที 76–90+')" : "Late Surgeons (76–90+')"}
                </p>
                {goalTiming.lateSurgeons.map((x) => (
                  <ClubMeterRow
                    key={x.slug}
                    slug={x.slug}
                    label={nameOf(x.slug)}
                    n={x.n}
                    max={goalTiming.lateSurgeons[0]?.n ?? 1}
                    barClass="bg-brand"
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ---------------------------------- Clutch & Collapse Drama */}
      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="border-b border-border pb-4">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
            <Zap size={13} />
            {th ? 'ดราม่าและหัวจิตหัวใจ' : 'Clutch & Collapse Index'}
          </p>
          <h2 className="mt-0.5 font-display text-lg font-bold text-primary sm:text-xl">
            {th ? 'ทีมจอมคัมแบ็ก vs ทีมนำแล้วหลุด' : 'Comebacks, Late Winners & Blown Leads'}
          </h2>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              {
                key: 'comeback',
                en: 'Comeback Wins',
                th: 'พลิกแซงชนะ',
                subEn: 'Trailed at any point & won',
                subTh: 'ตกเป็นรองก่อนกลับมาชนะ',
                list: drama.comebackWins,
                titleCls: 'text-success',
                barCls: 'bg-success',
              },
              {
                key: 'fightback',
                en: 'Fightback Draws',
                th: 'ไล่ตีเสมอเก็บแต้ม',
                subEn: 'Trailed & rescued a draw',
                subTh: 'ตามหลังแล้วตีเสมอแบ่งแต้ม',
                list: drama.fightbacks,
                titleCls: 'text-info',
                barCls: 'bg-info',
              },
              {
                key: 'late',
                en: "80'+ Late Winners",
                th: "ประตูชัยนาที 80'+",
                subEn: 'Decisive goal from 80th min',
                subTh: 'ยิงตัดสินชัยช่วงท้ายเกม',
                list: drama.lateWinners,
                titleCls: 'text-brand',
                barCls: 'bg-brand',
              },
              {
                key: 'blown',
                en: 'Blown Leads',
                th: 'นำก่อนแต่ไม่ชนะ',
                subEn: 'Led at some point, dropped pts',
                subTh: 'ขึ้นนำแล้วโดนตีเสมอ/แซงแพ้',
                list: drama.blownLeads,
                titleCls: 'text-danger',
                barCls: 'bg-danger',
              },
            ] as const
          ).map((col) => (
            <div
              key={col.key}
              className="rounded-xl border border-border bg-bg-secondary/40 p-4"
            >
              <p className={`text-xs font-extrabold uppercase tracking-wide ${col.titleCls}`}>
                {th ? col.th : col.en}
              </p>
              <p className="mb-2 mt-0.5 text-[11px] text-muted">
                {th ? col.subTh : col.subEn}
              </p>
              {col.list.length === 0 ? (
                <p className="py-3 text-xs text-muted">—</p>
              ) : (
                col.list.map((x) => (
                  <ClubMeterRow
                    key={x.slug}
                    slug={x.slug}
                    label={nameOf(x.slug)}
                    n={x.n}
                    max={col.list[0]?.n ?? 1}
                    barClass={col.barCls}
                  />
                ))
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------- Form Power & Streaks */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Hot & Cold Form */}
        <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6 lg:col-span-7">
          <div className="border-b border-border pb-3.5">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
              <Flame size={13} />
              {th ? 'ฟอร์ม 5 นัดหลังสุด (ซ้ายสุด = ล่าสุด)' : 'Last-5 Form Guide (Left = Latest)'}
            </p>
            <h2 className="mt-0.5 font-display text-lg font-bold text-primary">
              {th ? 'ทีมร้อนแรง vs ทีมฟอร์มฝืด' : 'Hottest & Coldest Clubs'}
            </h2>
          </div>

          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-success">
                {th ? 'ร้อนแรงที่สุด (Top 5)' : 'On Fire (Top 5)'}
              </p>
              <div className="divide-y divide-border/70">
                {form.slice(0, 5).map((f) => (
                  <div key={f.slug} className="flex items-center justify-between gap-2 py-2 text-xs">
                    <Link
                      href={`/${f.slug}/`}
                      className="inline-flex min-w-0 items-center gap-1.5 font-semibold text-primary hover:text-brand"
                    >
                      <ClubCrest slug={f.slug} size={16} />
                      <span className="truncate">{nameOf(f.slug)}</span>
                    </Link>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="flex gap-0.5">
                        {f.record.split('').map((r, i) => (
                          <span
                            key={i}
                            className={`inline-flex h-4 w-4 items-center justify-center rounded-sm text-[9px] font-bold ${RES_STYLE[r] ?? ''}`}
                          >
                            {r}
                          </span>
                        ))}
                      </span>
                      <strong className="w-5 text-right tabular-nums text-success">{f.pts}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-danger">
                {th ? 'ฟอร์มฝืดที่สุด (Bottom 5)' : 'Coldest Run (Bottom 5)'}
              </p>
              <div className="divide-y divide-border/70">
                {form
                  .slice(-5)
                  .reverse()
                  .map((f) => (
                    <div key={f.slug} className="flex items-center justify-between gap-2 py-2 text-xs">
                      <Link
                        href={`/${f.slug}/`}
                        className="inline-flex min-w-0 items-center gap-1.5 font-semibold text-primary hover:text-brand"
                      >
                        <ClubCrest slug={f.slug} size={16} />
                        <span className="truncate">{nameOf(f.slug)}</span>
                      </Link>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="flex gap-0.5">
                          {f.record.split('').map((r, i) => (
                            <span
                              key={i}
                              className={`inline-flex h-4 w-4 items-center justify-center rounded-sm text-[9px] font-bold ${RES_STYLE[r] ?? ''}`}
                            >
                              {r}
                            </span>
                          ))}
                        </span>
                        <strong className="w-5 text-right tabular-nums text-danger">{f.pts}</strong>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </section>

        {/* Active Streaks */}
        <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6 lg:col-span-5">
          <div className="border-b border-border pb-3.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
              {th ? 'สถิติต่อเนื่องปัจจุบัน' : 'Active Streaks'}
            </p>
            <h2 className="mt-0.5 font-display text-lg font-bold text-primary">
              {th ? 'ไร้พ่าย / ชนะรวด / ไร้ชัย' : 'Unbeaten, Winning & Winless Runs'}
            </h2>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            {(
              [
                [th ? 'ไร้พ่าย' : 'Unbeaten', unbeaten, 'text-success'],
                [th ? 'ชนะรวด' : 'Win Run', winRun, 'text-brand'],
                [th ? 'ไม่ชนะใคร' : 'Winless', winless, 'text-danger'],
              ] as const
            ).map(([label, list, cls]) => (
              <div key={label}>
                <p className={`mb-2 text-[11px] font-bold uppercase ${cls}`}>{label}</p>
                {list.length === 0 ? (
                  <p className="text-xs text-muted">—</p>
                ) : (
                  <div className="divide-y divide-border/60">
                    {list.map((x) => (
                      <div key={x.slug} className="flex items-center justify-between gap-1 py-1.5 text-xs">
                        <Link
                          href={`/${x.slug}/`}
                          className="inline-flex min-w-0 items-center gap-1 font-medium text-primary hover:text-brand"
                        >
                          <ClubCrest slug={x.slug} size={14} />
                          <span className="truncate">{nameOf(x.slug)}</span>
                        </Link>
                        <strong className={`shrink-0 tabular-nums ${cls}`}>{x.n}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
