'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  Calendar,
  Home,
  Shield,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import { AppHeader } from '@/components/AppHeader';
import { ClubCrest } from '@/components/LeagueHome';
import { ShareBtn } from '@/components/ShareBtn';
import { formatDate } from '@/components/matchlog-shared';
import { useI18n } from '@/i18n/I18nContext';
import type { ClubIndexEntry } from '@/lib/types';
import type { InsightsExtendedData } from '@/lib/insightsExtended';
import { bkkKickoff, fmt } from '@/lib/format';
import { seasonShort } from '@/lib/stats';
import { PowerQuadrant } from './PowerQuadrant';
import { MoreQuadrants } from './MoreQuadrants';
import type { QuadrantClub } from '@/lib/quadrants';
import { RacesAndLuck } from './RacesAndLuck';
import { DramaAndTiming } from './DramaAndTiming';

const RES_STYLE: Record<string, string> = {
  W: 'bg-success/15 text-success',
  D: 'bg-bg-secondary text-muted',
  L: 'bg-danger/15 text-danger',
};

function FormDots({ record }: { record: string }) {
  if (!record) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5">
      {record.split('').map((r, i) => (
        <span
          key={i}
          className={`inline-flex h-4 w-4 items-center justify-center rounded-sm text-[9px] font-bold ${RES_STYLE[r] ?? ''}`}
        >
          {r}
        </span>
      ))}
    </span>
  );
}

type SplitSort = 'home' | 'away' | 'skew';

export function InsightsClient({
  data,
  clubs,
  quadrants,
}: {
  quadrants: Record<string, QuadrantClub[]>;
  data: InsightsExtendedData;
  clubs: ClubIndexEntry[];
}) {
  const { lang } = useI18n();
  const th = lang === 'th';
  const tx = (en: string, t: string) => (th ? t : en);

  const [mwTab, setMwTab] = useState<'results' | 'preview'>(
    data.base.preview?.games.length ? 'preview' : 'results',
  );
  const [splitSort, setSplitSort] = useState<SplitSort>('home');

  const clubMap = useMemo(() => new Map(clubs.map((c) => [c.slug, c])), [clubs]);
  const rankMap = useMemo(() => new Map(data.table.map((r) => [r.slug, r.rank])), [data.table]);
  const tableMap = useMemo(() => new Map(data.table.map((r) => [r.slug, r])), [data.table]);

  const nameOf = (slug: string) => {
    const c = clubMap.get(slug);
    return th && c?.nameTh ? c.nameTh : c?.shortName ?? c?.name ?? slug;
  };

  const leader = data.table[0];
  const bestDef = [...data.table].sort((a, b) => a.ga - b.ga || a.rank - b.rank)[0];
  const hotXg = data.base.over[0];
  const coldXg = data.base.under[0];
  const hotForm = data.base.form[0];
  const topScorer = data.leaders.scorers[0];
  const secondScorer = data.leaders.scorers[1];

  // Home / Away sorted view
  const sortedSplits = useMemo(() => {
    const rows = data.base.vaSplit.map((v) => {
      const hPpg = v.home.mp > 0 ? v.home.pts / v.home.mp : 0;
      const aPpg = v.away.mp > 0 ? v.away.pts / v.away.mp : 0;
      return { ...v, hPpg, aPpg, skew: hPpg - aPpg };
    });
    if (splitSort === 'home') rows.sort((a, b) => b.hPpg - a.hPpg || b.home.pts - a.home.pts);
    else if (splitSort === 'away') rows.sort((a, b) => b.aPpg - a.aPpg || b.away.pts - a.away.pts);
    else rows.sort((a, b) => Math.abs(b.skew) - Math.abs(a.skew));
    return rows;
  }, [data.base.vaSplit, splitSort]);

  const { base, marquee, roundSummary } = data;
  const marqueeBk = marquee && marquee.time ? bkkKickoff(marquee.date, marquee.time) : null;

  const compareTopScorersHref =
    topScorer && secondScorer
      ? `/players-compare/?sa=${encodeURIComponent(base.season)}&a=${encodeURIComponent(topScorer.key)}&sb=${encodeURIComponent(base.season)}&b=${encodeURIComponent(secondScorer.key)}`
      : '/players-compare/';

  return (
    <div className="hero-glow relative flex min-h-screen flex-col bg-bg">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-[1320px] flex-1 flex-col gap-6 px-4 pb-20 pt-6 sm:px-6 lg:px-8">
        {/* -------------------------------------------- Masthead */}
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
              Premier League {seasonShort(base.season)}
              {base.round ? ` · ${base.round}` : ''} · {tx('Weekly Briefing', 'บทสรุปประจำสัปดาห์')}
            </p>
            <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-primary sm:text-4xl">
              {tx('Premier League Insights', 'บทสรุปเจาะลึกพรีเมียร์ลีก')}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-secondary">
              {tx(
                'League-wide pulse: attack vs defense power map, title & survival races, xG finishing luck, goal timing, drama index and 38-game projections.',
                'ภาพรวมเชิงลึกทั้งลีก: แผนที่ขุมพลังรุก-รับ, เส้นทางลุ้นแชมป์/หนีตกชั้น, ดัชนี xG, ช่วงเวลาทำประตู, ดราม่าท้ายเกม และตารางคาดการณ์จบฤดูกาล',
              )}
            </p>
          </div>
          <ShareBtn />
        </header>

        {/* ---------------------------------- Quick Section Jump Strip */}
        <nav
          aria-label="Insights sections"
          className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-semibold"
        >
          {[
            ['#matchweek', tx('Matchweek Pulse', 'สรุปสัปดาห์ & โปรแกรม')],
            ['#power-map', tx('Power Quadrant', 'แผนที่รุก-รับ')],
            ['#more-quadrants', tx('Club Comparisons', 'เปรียบเทียบ 5 มิติ')],
            ['#races', tx('Races & xG Luck', 'เส้นทางแต้ม & xG')],
            ['#drama', tx('Timing & Drama', 'ช่วงเวลาประตู & ดราม่า')],
            ['#splits', tx('Home/Away & Forecast', 'เหย้า-เยือน & คาดการณ์')],
            ['#leaders', tx('Player Leaders', 'ผู้นำสถิตินักเตะ')],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="shrink-0 rounded-full border border-border bg-surface px-3 py-1.5 text-secondary transition-colors hover:border-brand/40 hover:bg-brand-soft hover:text-brand"
            >
              {label}
            </a>
          ))}
        </nav>

        {/* ----------------------------- Hero: Briefing + Marquee Match */}
        <section className="grid gap-5 lg:grid-cols-12">
          {/* Left: 4 Auto-Generated Storyline Headlines */}
          <div className="grid gap-3 sm:grid-cols-2 lg:col-span-7">
            {/* 1. Leader & Best Defense */}
            {leader && (
              <article className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Trophy size={13} className="text-warning" />
                    {tx('Title Pace', 'จ่าฝูง')}
                  </span>
                  <span className="tabular-nums text-primary">{leader.mp} MP</span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <ClubCrest slug={leader.slug} size={32} />
                  <div className="min-w-0">
                    <Link
                      href={`/${leader.slug}/`}
                      className="block truncate font-display text-lg font-bold text-primary hover:text-brand"
                    >
                      {nameOf(leader.slug)}
                    </Link>
                    <p className="text-xs text-muted tabular-nums">
                      <strong className="text-primary">{leader.pts}</strong> {tx('pts', 'แต้ม')} ·{' '}
                      {fmt(leader.ppg, 2)} PPG · GD {leader.gd > 0 ? `+${leader.gd}` : leader.gd}
                    </p>
                  </div>
                </div>
                {bestDef && (
                  <p className="mt-3 border-t border-border/70 pt-2 text-[11px] text-muted">
                    <Shield size={11} className="mr-1 inline text-info" />
                    {tx('Tightest defense:', 'เกมรับแน่นสุด:')}{' '}
                    <strong className="text-primary">{nameOf(bestDef.slug)}</strong> ({bestDef.ga}{' '}
                    GA · {fmt(bestDef.gaPerMp, 2)}/m)
                  </p>
                )}
              </article>
            )}

            {/* 2. Hottest / Coldest xG Variance */}
            {(hotXg || coldXg) && (
              <article className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Sparkles size={13} className="text-success" />
                    {tx('xG Extremes', 'สุดขั้ว xG')}
                  </span>
                  <span>GF vs xG</span>
                </div>
                <div className="mt-3 space-y-2 text-xs">
                  {hotXg && (
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        href={`/${hotXg.slug}/`}
                        className="inline-flex min-w-0 items-center gap-1.5 font-bold text-primary hover:text-brand"
                      >
                        <ClubCrest slug={hotXg.slug} size={18} />
                        <span className="truncate">{nameOf(hotXg.slug)}</span>
                      </Link>
                      <span className="rounded-md bg-success-soft px-2 py-0.5 font-extrabold tabular-nums text-success">
                        +{fmt(hotXg.diff, 2)}
                      </span>
                    </div>
                  )}
                  {coldXg && (
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        href={`/${coldXg.slug}/`}
                        className="inline-flex min-w-0 items-center gap-1.5 font-bold text-primary hover:text-brand"
                      >
                        <ClubCrest slug={coldXg.slug} size={18} />
                        <span className="truncate">{nameOf(coldXg.slug)}</span>
                      </Link>
                      <span className="rounded-md bg-danger-soft px-2 py-0.5 font-extrabold tabular-nums text-danger">
                        −{fmt(coldXg.diff, 2)}
                      </span>
                    </div>
                  )}
                </div>
                <p className="mt-3 border-t border-border/70 pt-2 text-[11px] text-muted">
                  {tx('Hottest finishing vs most wasteful against xG.', 'ทีมยิงคมเกินคาด vs ทีมใช้โอกาสเปลืองสุดเทียบ xG')}
                </p>
              </article>
            )}

            {/* 3. Form Leader */}
            {hotForm && (
              <article className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted">
                  <span>{tx('Hottest Form (Last 5)', 'ฟอร์มร้อนสุด 5 นัด')}</span>
                  <span className="tabular-nums font-extrabold text-success">
                    {hotForm.pts}/15 {tx('pts', 'แต้ม')}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <Link
                    href={`/${hotForm.slug}/`}
                    className="flex min-w-0 items-center gap-2 font-display text-base font-bold text-primary hover:text-brand"
                  >
                    <ClubCrest slug={hotForm.slug} size={24} />
                    <span className="truncate">{nameOf(hotForm.slug)}</span>
                  </Link>
                  <FormDots record={hotForm.record} />
                </div>
                <p className="mt-3 border-t border-border/70 pt-2 text-[11px] tabular-nums text-muted">
                  {hotForm.w}W {hotForm.d}D {hotForm.l}L · {hotForm.gf} {tx('scored', 'ยิง')} /{' '}
                  {hotForm.ga} {tx('conceded', 'เสีย')}
                </p>
              </article>
            )}

            {/* 4. Top Scorer Pulse */}
            {topScorer && (
              <article className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Award size={13} className="text-brand" />
                    {tx('Golden Boot Leader', 'ดาวซัลโวสูงสุด')}
                  </span>
                  <span className="tabular-nums font-extrabold text-brand">
                    {topScorer.gls} {tx('goals', 'ประตู')}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2.5">
                  <ClubCrest slug={topScorer.club} size={24} />
                  <div className="min-w-0">
                    <p className="truncate font-display text-base font-bold text-primary">
                      {topScorer.name}
                    </p>
                    <p className="truncate text-xs text-muted tabular-nums">
                      {nameOf(topScorer.club)} · {topScorer.gls}G {topScorer.ast}A ·{' '}
                      {fmt(topScorer.ga90, 2)} G+A/90
                    </p>
                  </div>
                </div>
                <Link
                  href={compareTopScorersHref}
                  className="mt-3 inline-flex items-center gap-1 border-t border-border/70 pt-2 text-[11px] font-bold text-brand hover:underline"
                >
                  {tx('Compare top scorers head-to-head', 'เทียบดาวซัลโวอันดับ 1 vs 2')}
                  <ArrowRight size={12} />
                </Link>
              </article>
            )}
          </div>

          {/* Right: Marquee Next Fixture Spotlight */}
          {marquee && (
            <article className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface p-5 lg:col-span-5">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-28 opacity-[0.09] dark:opacity-[0.15]"
                style={{
                  background: `linear-gradient(100deg, ${clubMap.get(marquee.home)?.color ?? '#da291c'} 0%, transparent 50%, ${clubMap.get(marquee.away)?.color ?? '#2563eb'} 100%)`,
                }}
              />

              <div className="relative flex items-center justify-between gap-2">
                <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-brand">
                  {tx('Marquee Next Fixture', 'คู่บิ๊กแมตช์นัดถัดไป')}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold tabular-nums text-muted">
                  <Calendar size={12} />
                  {marqueeBk ? `${marqueeBk.date} · ${marqueeBk.time} BKK` : formatDate(marquee.date)}
                </span>
              </div>

              <div className="relative my-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
                <div className="flex flex-col items-center">
                  <ClubCrest slug={marquee.home} size={46} />
                  <Link
                    href={`/${marquee.home}/`}
                    className="mt-2 font-display text-base font-bold text-primary hover:text-brand"
                  >
                    {nameOf(marquee.home)}
                  </Link>
                  <span className="mt-0.5 text-[11px] font-bold tabular-nums text-muted">
                    #{marquee.homeRank} · {marquee.homePts} {tx('pts', 'แต้ม')}
                  </span>
                  <div className="mt-2">
                    <FormDots record={marquee.homeForm} />
                  </div>
                </div>

                <div className="flex flex-col items-center">
                  <span className="rounded-full border border-border bg-bg-secondary px-2.5 py-1 font-display text-xs font-extrabold text-muted">
                    VS
                  </span>
                </div>

                <div className="flex flex-col items-center">
                  <ClubCrest slug={marquee.away} size={46} />
                  <Link
                    href={`/${marquee.away}/`}
                    className="mt-2 font-display text-base font-bold text-primary hover:text-brand"
                  >
                    {nameOf(marquee.away)}
                  </Link>
                  <span className="mt-0.5 text-[11px] font-bold tabular-nums text-muted">
                    #{marquee.awayRank} · {marquee.awayPts} {tx('pts', 'แต้ม')}
                  </span>
                  <div className="mt-2">
                    <FormDots record={marquee.awayForm} />
                  </div>
                </div>
              </div>

              {/* Quick Tale of the Tape */}
              <div className="relative space-y-1.5 rounded-xl border border-border bg-bg-secondary/60 px-3.5 py-2.5 text-xs tabular-nums">
                <div className="flex justify-between">
                  <strong className="text-primary">{fmt(marquee.homePpgAtHome, 2)}</strong>
                  <span className="text-muted">{tx('Home PPG vs Away PPG', 'PPG เหย้า vs PPG เยือน')}</span>
                  <strong className="text-primary">{fmt(marquee.awayPpgAway, 2)}</strong>
                </div>
                <div className="flex justify-between">
                  <strong className="text-primary">
                    {marquee.homeGf} : {marquee.homeGa}
                  </strong>
                  <span className="text-muted">{tx('Season GF : GA', 'ได้ : เสียทั้งซีซัน')}</span>
                  <strong className="text-primary">
                    {marquee.awayGf} : {marquee.awayGa}
                  </strong>
                </div>
              </div>

              <div className="relative mt-3 flex justify-end">
                <Link
                  href="/clubs-compare/"
                  className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline"
                >
                  {tx('Open full club comparison', 'เปิดหน้าเปรียบเทียบสโมสร')}
                  <ArrowRight size={13} />
                </Link>
              </div>
            </article>
          )}
        </section>

        {/* ----------------------------- Matchweek Pulse (Results / Preview) */}
        <section id="matchweek" className="scroll-mt-24 rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                {tx('Matchweek Pulse', 'จังหวะประจำสัปดาห์')}
              </p>
              <h2 className="mt-0.5 font-display text-lg font-bold text-primary sm:text-xl">
                {mwTab === 'results'
                  ? `${tx('Latest Results', 'ผลแข่งล่าสุด')} · ${base.round ?? ''}`
                  : `${tx('Upcoming Schedule', 'โปรแกรมสัปดาห์ถัดไป')} · MW ${base.preview?.wk ?? ''}`}
              </h2>
            </div>

            <div className="inline-flex rounded-lg border border-border bg-bg-secondary p-0.5 text-xs font-bold">
              {base.preview && base.preview.games.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMwTab('preview')}
                  className={`rounded-md px-3 py-1 transition-colors ${
                    mwTab === 'preview'
                      ? 'bg-surface text-primary shadow-sm'
                      : 'text-muted hover:text-primary'
                  }`}
                >
                  {tx(`Next · MW ${base.preview.wk}`, `นัดหน้า · MW ${base.preview.wk}`)}
                </button>
              )}
              <button
                type="button"
                onClick={() => setMwTab('results')}
                className={`rounded-md px-3 py-1 transition-colors ${
                  mwTab === 'results'
                    ? 'bg-surface text-primary shadow-sm'
                    : 'text-muted hover:text-primary'
                }`}
              >
                {tx(`Results · ${base.round ?? ''}`, `ผลล่าสุด · ${base.round ?? ''}`)}
              </button>
            </div>
          </div>

          {mwTab === 'results' ? (
            <div className="mt-4">
              {/* Round Summary KPIs */}
              <div className="mb-4 flex flex-wrap items-center gap-3 text-xs tabular-nums">
                <span className="rounded-lg bg-bg-secondary px-3 py-1.5">
                  <span className="text-muted">{tx('Total goals:', 'ประตูรวม:')} </span>
                  <strong className="text-primary">{roundSummary.totalGoals}</strong>
                  <span className="ml-1 text-muted">({fmt(roundSummary.avgGoals, 2)}/m)</span>
                </span>
                <span className="rounded-lg bg-bg-secondary px-3 py-1.5">
                  <span className="text-muted">{tx('Home W / D / Away W:', 'เจ้าบ้าน / เสมอ / เยือน:')} </span>
                  <strong className="text-primary">
                    {roundSummary.homeWins} / {roundSummary.draws} / {roundSummary.awayWins}
                  </strong>
                </span>
                {base.topScoring && (
                  <span className="rounded-lg bg-brand-soft/70 px-3 py-1.5 font-semibold text-brand">
                    {tx('Goal fest:', 'ยิงกระจาย:')} {nameOf(base.topScoring.home)}{' '}
                    {base.topScoring.hg}–{base.topScoring.ag} {nameOf(base.topScoring.away)}
                  </span>
                )}
                {base.xgFest && (
                  <span className="rounded-lg bg-info-soft/70 px-3 py-1.5 font-semibold text-info">
                    {tx('Highest xG:', 'xG สูงสุด:')} {nameOf(base.xgFest.home)} vs{' '}
                    {nameOf(base.xgFest.away)} (
                    {fmt((base.xgFest.homeXg ?? 0) + (base.xgFest.awayXg ?? 0), 2)} xG)
                  </span>
                )}
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
                {base.games.map((g) => (
                  <div
                    key={`${g.home}-${g.away}`}
                    className="rounded-xl border border-border bg-bg-secondary/45 px-3 py-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between text-[10px] text-muted">
                      <span>{formatDate(g.date)}</span>
                      {g.homeXg != null && g.awayXg != null && (
                        <span className="tabular-nums">
                          xG {fmt(g.homeXg, 2)}–{fmt(g.awayXg, 2)}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/${g.home}/`}
                          className={`inline-flex min-w-0 items-center gap-1.5 hover:text-brand ${
                            g.hg > g.ag ? 'font-bold text-primary' : 'text-secondary'
                          }`}
                        >
                          <ClubCrest slug={g.home} size={15} />
                          <span className="truncate">{nameOf(g.home)}</span>
                        </Link>
                        <span
                          className={`tabular-nums ${
                            g.hg > g.ag ? 'font-extrabold text-primary' : 'text-muted'
                          }`}
                        >
                          {g.hg}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/${g.away}/`}
                          className={`inline-flex min-w-0 items-center gap-1.5 hover:text-brand ${
                            g.ag > g.hg ? 'font-bold text-primary' : 'text-secondary'
                          }`}
                        >
                          <ClubCrest slug={g.away} size={15} />
                          <span className="truncate">{nameOf(g.away)}</span>
                        </Link>
                        <span
                          className={`tabular-nums ${
                            g.ag > g.hg ? 'font-extrabold text-primary' : 'text-muted'
                          }`}
                        >
                          {g.ag}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-border/70">
              {(base.preview?.games ?? []).map((g, i) => {
                const bk = bkkKickoff(g.date, g.time);
                const hr = rankMap.get(g.home) ?? 99;
                const ar = rankMap.get(g.away) ?? 99;
                const isBig = hr <= 6 && ar <= 6;
                return (
                  <div
                    key={i}
                    className="grid grid-cols-1 items-center gap-2 py-2.5 text-sm sm:grid-cols-[120px_1fr_auto_1fr]"
                  >
                    <div className="flex items-center gap-2 text-xs tabular-nums text-muted">
                      <span>{bk ? `${bk.date} ${bk.time}` : formatDate(g.date)}</span>
                      {isBig && (
                        <span className="rounded bg-brand-soft px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-brand">
                          TOP 6
                        </span>
                      )}
                    </div>
                    <div className="flex min-w-0 items-center gap-2 sm:justify-end">
                      <FormDots record={g.homeForm} />
                      <Link
                        href={`/${g.home}/`}
                        className="truncate font-semibold text-primary hover:text-brand"
                      >
                        {nameOf(g.home)}
                      </Link>
                      <span className="text-[10px] font-bold tabular-nums text-muted">#{hr}</span>
                      <ClubCrest slug={g.home} size={18} />
                    </div>
                    <span className="hidden px-2 text-center text-[11px] font-bold text-muted sm:inline">
                      vs
                    </span>
                    <div className="flex min-w-0 items-center gap-2">
                      <ClubCrest slug={g.away} size={18} />
                      <span className="text-[10px] font-bold tabular-nums text-muted">#{ar}</span>
                      <Link
                        href={`/${g.away}/`}
                        className="truncate font-semibold text-primary hover:text-brand"
                      >
                        {nameOf(g.away)}
                      </Link>
                      <FormDots record={g.awayForm} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ----------------------------- 20-Club Power Quadrant */}
        <PowerQuadrant table={data.table} clubs={clubMap} th={th} />
        <MoreQuadrants data={quadrants} clubs={clubMap} th={th} />

        {/* ----------------------------- Points Races + xG Luck */}
        <RacesAndLuck
          pointsRace={data.pointsRace}
          table={data.table}
          xgRace={base.xgRace}
          clubs={clubMap}
          th={th}
        />

        {/* ----------------------------- Goal Timing + Drama + Form */}
        <DramaAndTiming
          goalTiming={data.goalTiming}
          drama={base.drama}
          form={base.form}
          unbeaten={base.unbeaten}
          winRun={base.winRun}
          winless={base.winless}
          clubs={clubMap}
          th={th}
        />

        {/* ------------------ Home/Away Skew + Projected 38-Game Table */}
        <div id="splits" className="grid scroll-mt-24 gap-6 lg:grid-cols-12">
          {/* Home vs Away PPG Visual */}
          <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6 lg:col-span-6">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-4">
              <div>
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                  <Home size={13} />
                  {tx('Home Fortress vs Road Warriors', 'เจ้าบ้านจอมโหด vs ทีมเยือนตัวแสบ')}
                </p>
                <h2 className="mt-0.5 font-display text-lg font-bold text-primary">
                  {tx('Home vs Away Points / Match', 'คะแนนต่อนัด (เหย้า vs เยือน)')}
                </h2>
              </div>

              <div className="inline-flex rounded-lg border border-border bg-bg-secondary p-0.5 text-[11px] font-bold">
                {(
                  [
                    ['home', tx('Home', 'เหย้า')],
                    ['away', tx('Away', 'เยือน')],
                    ['skew', tx('Skew', 'ต่างสุด')],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSplitSort(id)}
                    className={`rounded-md px-2 py-1 transition-colors ${
                      splitSort === id
                        ? 'bg-surface text-primary shadow-sm'
                        : 'text-muted hover:text-primary'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {sortedSplits.map((v) => (
                <div
                  key={v.slug}
                  className="grid grid-cols-[126px_1fr_84px] items-center gap-2 text-xs"
                >
                  <Link
                    href={`/${v.slug}/`}
                    className="inline-flex min-w-0 items-center gap-1.5 font-medium text-primary hover:text-brand"
                  >
                    <ClubCrest slug={v.slug} size={15} />
                    <span className="truncate">{nameOf(v.slug)}</span>
                  </Link>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 text-[9px] font-bold text-muted">H</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-secondary">
                        <div
                          className="h-full rounded-full bg-brand/85"
                          style={{ width: `${(v.hPpg / 3) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 text-[9px] font-bold text-muted">A</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-secondary">
                        <div
                          className="h-full rounded-full bg-info/85"
                          style={{ width: `${(v.aPpg / 3) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="text-right tabular-nums">
                    <div className="font-bold text-primary">
                      {fmt(v.hPpg, 2)} / {fmt(v.aPpg, 2)}
                    </div>
                    <div className="text-[10px] text-muted">
                      {v.home.pts}H · {v.away.pts}A
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Projected 38-Game Table */}
          <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6 lg:col-span-6">
            <div className="border-b border-border pb-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                {tx('38-Game Pace Extrapolation', 'คาดการณ์จบ 38 นัดจากค่าเฉลี่ย PPG ปัจจุบัน')}
              </p>
              <h2 className="mt-0.5 font-display text-lg font-bold text-primary">
                {tx('Projected Final Standings', 'ตารางคะแนนคาดการณ์จบฤดูกาล')}
              </h2>
            </div>

            <div className="mt-3 max-h-[420px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface text-[10px] uppercase tracking-wider text-muted">
                  <tr>
                    <th className="py-1.5 pr-1 text-left font-bold">#</th>
                    <th className="px-2 py-1.5 text-left font-bold">{tx('Club', 'ทีม')}</th>
                    <th className="px-2 py-1.5 text-right font-bold">{tx('PPG', 'PPG')}</th>
                    <th className="px-2 py-1.5 text-right font-bold">{tx('Proj Pts', 'แต้มคาด')}</th>
                    <th className="py-1.5 pl-2 text-right font-bold">Δ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {base.projections.map((p) => {
                    const delta = p.cur - p.projRank;
                    const row = tableMap.get(p.slug);
                    const zoneBar =
                      p.projRank <= 4
                        ? 'bg-info'
                        : p.projRank === 5
                        ? 'bg-warning'
                        : p.projRank >= 18
                        ? 'bg-danger'
                        : 'bg-transparent';
                    return (
                      <tr key={p.slug}>
                        <td className="py-2 pr-1 tabular-nums text-muted">
                          <span className="inline-flex items-center gap-1.5">
                            <span className={`h-3.5 w-1 rounded-full ${zoneBar}`} />
                            {p.projRank}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <Link
                            href={`/${p.slug}/`}
                            className="inline-flex items-center gap-1.5 font-semibold text-primary hover:text-brand"
                          >
                            <ClubCrest slug={p.slug} size={15} />
                            <span className="truncate">{nameOf(p.slug)}</span>
                          </Link>
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-muted">
                          {row ? fmt(row.ppg, 2) : '—'}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          <div className="inline-flex items-center gap-2">
                            <div className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-bg-secondary sm:block">
                              <div
                                className="h-full rounded-full bg-primary/70"
                                style={{ width: `${Math.min(100, (p.projPts / 100) * 100)}%` }}
                              />
                            </div>
                            <strong className="font-extrabold text-primary">
                              {fmt(p.projPts, 2)}
                            </strong>
                          </div>
                        </td>
                        <td
                          className={`py-2 pl-2 text-right font-bold tabular-nums ${
                            delta > 0
                              ? 'text-success'
                              : delta < 0
                              ? 'text-danger'
                              : 'text-muted'
                          }`}
                        >
                          {delta > 0 ? `▲${delta}` : delta < 0 ? `▼${-delta}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 border-t border-border pt-2.5 text-[10px] text-muted">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-info" /> Top 4 (UCL)
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-warning" /> #5 (UEL)
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-danger" /> #18–20 ({tx('Relegation', 'ตกชั้น')})
              </span>
            </div>
          </section>
        </div>

        {/* ----------------------------- Player Leaders Spotlight */}
        {(data.leaders.scorers.length > 0 || data.leaders.assisters.length > 0) && (
          <section id="leaders" className="scroll-mt-24 rounded-2xl border border-border bg-surface p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                  <Users size={13} />
                  {tx('Individual Standouts', 'ผู้นำสถิตินักเตะ')} · PL {seasonShort(base.season)}
                </p>
                <h2 className="mt-0.5 font-display text-lg font-bold text-primary sm:text-xl">
                  {tx('Golden Boot, Playmakers & Efficiency', 'ดาวซัลโว จอมแอสซิสต์ และประสิทธิภาพต่อ 90 นาที')}
                </h2>
              </div>
              <Link
                href={compareTopScorersHref}
                className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand-soft px-3.5 py-1.5 text-xs font-bold text-brand hover:bg-brand hover:text-white"
              >
                {tx('Compare Players', 'เปรียบเทียบนักเตะ')}
                <ArrowRight size={13} />
              </Link>
            </div>

            <div className="mt-4 grid gap-5 md:grid-cols-3">
              {[
                {
                  title: tx('Top Scorers', 'ดาวซัลโว (ประตู)'),
                  rows: data.leaders.scorers,
                  val: (r: (typeof data.leaders.scorers)[number]) => String(r.gls),
                  sub: (r: (typeof data.leaders.scorers)[number]) => `${r.ast}A · ${r.min}'`,
                },
                {
                  title: tx('Top Assisters', 'จอมแอสซิสต์'),
                  rows: data.leaders.assisters,
                  val: (r: (typeof data.leaders.assisters)[number]) => String(r.ast),
                  sub: (r: (typeof data.leaders.assisters)[number]) => `${r.gls}G · ${r.min}'`,
                },
                {
                  title: tx('Best G+A / 90 (≥30% min)', 'G+A / 90 นาทีสูงสุด'),
                  rows: data.leaders.ga90,
                  val: (r: (typeof data.leaders.ga90)[number]) => fmt(r.ga90, 2),
                  sub: (r: (typeof data.leaders.ga90)[number]) => `${r.gls}G ${r.ast}A`,
                },
              ].map((col) => (
                <div key={col.title} className="rounded-xl border border-border bg-bg-secondary/40 p-4">
                  <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted">
                    {col.title}
                  </h3>
                  <div className="divide-y divide-border/70">
                    {col.rows.map((p, idx) => (
                      <div key={p.key} className="flex items-center justify-between gap-2 py-2 text-xs">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="w-4 text-[10px] font-bold tabular-nums text-muted">
                            {idx + 1}
                          </span>
                          <ClubCrest slug={p.club} size={16} />
                          <div className="min-w-0">
                            <p className="truncate font-bold text-primary">{p.name}</p>
                            <p className="truncate text-[10px] tabular-nums text-muted">
                              {nameOf(p.club)} · {col.sub(p)}
                            </p>
                          </div>
                        </div>
                        <strong className="shrink-0 font-display text-sm font-extrabold tabular-nums text-primary">
                          {col.val(p)}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
