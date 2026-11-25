'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  ChevronDown,
  ChevronUp,
  Globe,
  Grid3X3,
  List,
  Trophy,
} from 'lucide-react';
import { AppHeader } from '@/components/AppHeader';
import { ClubCrest } from '@/components/LeagueHome';
import { ShareBtn } from '@/components/ShareBtn';
import { formatDate } from '@/components/matchlog-shared';
import { useI18n } from '@/i18n/I18nContext';
import type { ClubIndexEntry } from '@/lib/types';
import type {
  EuroCampaign,
  EuroComp,
  EuroStageCode,
  EuropeData,
} from '@/lib/europe';
import { bkkKickoff, fmt } from '@/lib/format';
import { seasonShort } from '@/lib/stats';

/* Restrained, low-noise competition styles:
 * Hierarchy comes from weight + subtle neutral/tinted contrast, not rainbow fills. */
const COMP_META: Record<
  EuroComp,
  {
    short: string;
    en: string;
    th: string;
    dot: string;
    matrixCell: string;
  }
> = {
  'Champions League': {
    short: 'UCL',
    en: 'UEFA Champions League',
    th: 'ยูฟ่า แชมเปียนส์ลีก (UCL)',
    dot: 'bg-primary',
    matrixCell: 'border-primary/20 bg-primary/10 text-primary font-bold',
  },
  'Europa League': {
    short: 'UEL',
    en: 'UEFA Europa League',
    th: 'ยูฟ่า ยูโรปาลีก (UEL)',
    dot: 'bg-muted',
    matrixCell: 'border-border bg-bg-secondary text-secondary font-semibold',
  },
  'Conference League': {
    short: 'UECL',
    en: 'UEFA Conference League',
    th: 'ยูฟ่า คอนเฟอเรนซ์ลีก (UECL)',
    dot: 'bg-border',
    matrixCell: 'border-border/80 bg-transparent text-muted font-medium',
  },
  'UEFA Super Cup': {
    short: 'SC',
    en: 'UEFA Super Cup',
    th: 'ยูฟ่า ซูเปอร์คัพ',
    dot: 'bg-warning',
    matrixCell: 'border-border bg-bg-secondary text-muted font-medium',
  },
};

const COMP_ORDER: EuroComp[] = [
  'Champions League',
  'Europa League',
  'Conference League',
  'UEFA Super Cup',
];

function stageBadgeClass(code: EuroStageCode): string {
  switch (code) {
    case 'winner':
      return 'border-warning/35 bg-warning-soft/60 text-warning font-bold';
    case 'final':
      return 'border-primary/25 bg-primary/8 text-primary font-semibold';
    case 'ongoing':
      return 'border-brand/30 bg-brand-soft/60 text-brand font-semibold';
    default:
      return 'border-border bg-bg-secondary/80 text-secondary font-medium';
  }
}

const RES_TEXT: Record<string, string> = {
  W: 'text-success font-bold',
  D: 'text-muted font-semibold',
  L: 'text-danger font-bold',
};

type CompFilter = 'all' | 'Champions League' | 'Europa League' | 'Conference League';
type LbSortKey = 'appearances' | 'trophies' | 'finals' | 'mp' | 'w' | 'gd' | 'winPct' | 'ppg';

export function EuropeClient({
  data,
  clubs,
}: {
  data: EuropeData;
  clubs: ClubIndexEntry[];
}) {
  const { lang } = useI18n();
  const th = lang === 'th';
  const tx = (en: string, thText: string) => (th ? thText : en);

  const clubMap = useMemo(() => new Map(clubs.map((c) => [c.slug, c])), [clubs]);
  const nameOf = (slug: string) => {
    const c = clubMap.get(slug);
    return th && c?.nameTh ? c.nameTh : (c?.name ?? slug);
  };
  const shortOf = (slug: string) => {
    const c = clubMap.get(slug);
    return th && c?.nameTh ? c.nameTh : (c?.shortName ?? c?.name ?? slug);
  };

  const [selectedSeason, setSelectedSeason] = useState<string>(data.latestSeason);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [archiveView, setArchiveView] = useState<'matrix' | 'timeline'>('matrix');
  const [finalsFilter, setFinalsFilter] = useState<'all' | 'won' | 'english'>('all');
  const [lbComp, setLbComp] = useState<CompFilter>('all');
  const [lbSort, setLbSort] = useState<{ key: LbSortKey; dir: 'asc' | 'desc' }>({
    key: 'appearances',
    dir: 'desc',
  });

  const activeSeasonData = useMemo(
    () =>
      data.bySeason.find((s) => s.season === selectedSeason) ??
      data.bySeason[0],
    [data.bySeason, selectedSeason],
  );

  // club -> season -> campaigns[] (excluding Super Cup for main matrix)
  const matrixMap = useMemo(() => {
    const m = new Map<string, Map<string, EuroCampaign[]>>();
    for (const s of data.bySeason) {
      for (const c of s.campaigns) {
        if (c.competition === 'UEFA Super Cup') continue;
        let byS = m.get(c.slug);
        if (!byS) {
          byS = new Map();
          m.set(c.slug, byS);
        }
        const arr = byS.get(s.season);
        if (arr) arr.push(c);
        else byS.set(s.season, [c]);
      }
    }
    return m;
  }, [data.bySeason]);

  const filteredFinals = useMemo(() => {
    if (finalsFilter === 'won') return data.finals.filter((f) => f.won);
    if (finalsFilter === 'english') return data.finals.filter((f) => f.allEnglish);
    return data.finals;
  }, [data.finals, finalsFilter]);

  const leaderboardRows = useMemo(() => {
    const byClub = new Map<
      string,
      {
        slug: string;
        appearances: number;
        uclApps: number;
        uelApps: number;
        ueclApps: number;
        trophies: number;
        finals: number;
        mp: number;
        w: number;
        d: number;
        l: number;
        gf: number;
        ga: number;
        gd: number;
        winPct: number;
        ppg: number;
        bestStageEn: string;
        bestStageTh: string;
      }
    >();

    if (lbComp === 'all') {
      for (const r of data.leaderboard) {
        byClub.set(r.slug, {
          slug: r.slug,
          appearances: r.appearances,
          uclApps: r.uclApps,
          uelApps: r.uelApps,
          ueclApps: r.ueclApps,
          trophies: r.trophies,
          finals: r.finals,
          mp: r.mp,
          w: r.w,
          d: r.d,
          l: r.l,
          gf: r.gf,
          ga: r.ga,
          gd: r.gd,
          winPct: r.winPct,
          ppg: r.ppg,
          bestStageEn: r.bestStageEn,
          bestStageTh: r.bestStageTh,
        });
      }
    } else {
      const stageOrder: Record<EuroStageCode, number> = {
        winner: 10,
        final: 9,
        sf: 8,
        qf: 7,
        r16: 6,
        r32: 5,
        kpo: 4,
        group: 3,
        qual: 2,
        ongoing: 1,
      };
      const bestTrack = new Map<string, EuroCampaign>();
      for (const s of data.bySeason) {
        for (const c of s.campaigns) {
          if (c.competition !== lbComp) continue;
          const cur = byClub.get(c.slug) ?? {
            slug: c.slug,
            appearances: 0,
            uclApps: 0,
            uelApps: 0,
            ueclApps: 0,
            trophies: 0,
            finals: 0,
            mp: 0,
            w: 0,
            d: 0,
            l: 0,
            gf: 0,
            ga: 0,
            gd: 0,
            winPct: 0,
            ppg: 0,
            bestStageEn: '—',
            bestStageTh: '—',
          };
          cur.appearances++;
          if (c.competition === 'Champions League') cur.uclApps++;
          if (c.competition === 'Europa League') cur.uelApps++;
          if (c.competition === 'Conference League') cur.ueclApps++;
          if (c.stageCode === 'winner') cur.trophies++;
          if (c.stageCode === 'winner' || c.stageCode === 'final') cur.finals++;
          cur.mp += c.mp;
          cur.w += c.w;
          cur.d += c.d;
          cur.l += c.l;
          cur.gf += c.gf;
          cur.ga += c.ga;
          cur.gd = cur.gf - cur.ga;
          const prevBest = bestTrack.get(c.slug);
          if (!prevBest || stageOrder[c.stageCode] > stageOrder[prevBest.stageCode]) {
            bestTrack.set(c.slug, c);
            cur.bestStageEn = c.stageEn;
            cur.bestStageTh = c.stageTh;
          }
          byClub.set(c.slug, cur);
        }
      }
      for (const cur of byClub.values()) {
        const pts = cur.w * 3 + cur.d;
        cur.winPct = cur.mp > 0 ? (cur.w / cur.mp) * 100 : 0;
        cur.ppg = cur.mp > 0 ? pts / cur.mp : 0;
      }
    }

    const arr = [...byClub.values()];
    arr.sort((a, b) => {
      const diff = a[lbSort.key] - b[lbSort.key];
      if (diff !== 0) return lbSort.dir === 'asc' ? diff : -diff;
      return b.trophies - a.trophies || b.mp - a.mp;
    });
    return arr;
  }, [data.leaderboard, data.bySeason, lbComp, lbSort]);

  const toggleLbSort = (key: LbSortKey) =>
    setLbSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc',
    }));

  const sortArrow = (key: LbSortKey) =>
    lbSort.key === key ? (
      lbSort.dir === 'asc' ? (
        <ArrowUp size={11} />
      ) : (
        <ArrowDown size={11} />
      )
    ) : (
      <ArrowUpDown size={11} className="opacity-30" />
    );

  const jumpToCampaign = (season: string, slug: string, comp: EuroComp) => {
    setSelectedSeason(season);
    setExpandedKey(`${season}||${comp}||${slug}`);
    const el = document.getElementById('spotlight');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const recentPills = [...data.seasons].reverse().slice(0, 6);
  const seasonsLatestFirst = [...data.seasons].reverse();
  const latestSeasonRow = data.bySeason[0];

  return (
    <div className="hero-glow relative flex min-h-screen flex-col bg-bg">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 pb-20 pt-6 sm:px-6 lg:px-10">
        {/* -------------------------------------------- Masthead */}
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
              <Globe size={13} className="text-info" />
              UEFA COMPETITIONS · PREMIER LEAGUE CLUBS · 2014–2027
            </p>
            <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-primary sm:text-4xl">
              {tx('Premier League in Europe', 'เวทียุโรปของทีมพรีเมียร์ลีก')}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-secondary">
              {tx(
                'Every English club campaign across UEFA Champions League, Europa League, Conference League and Super Cup from 2014/15 through 2026/27.',
                'รวมประวัติทุกสโมสรพรีเมียร์ลีกในเวทียุโรปทั้ง UCL, UEL, UECL และ Super Cup ตั้งแต่ฤดูกาล 2014/15 ถึง 2026/27 พร้อมเส้นทางและผลแข่งทุกนัด',
              )}
            </p>
          </div>
          <ShareBtn />
        </header>

        {/* ----------------------------------------- Era KPI Ribbon */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-4">
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-[2.5px] bg-[#ca8a04]"
            />
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
              {tx('European Trophies', 'แชมป์ยุโรปรวม')}
            </p>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="font-display text-3xl font-extrabold tabular-nums text-primary">
                {data.totals.trophies}
              </span>
              <Trophy size={18} className="text-[#ca8a04]" />
            </div>
            <p className="mt-1.5 text-xs tabular-nums text-muted">
              {data.totals.uclTitles} UCL · {data.totals.uelTitles} UEL ·{' '}
              {data.totals.ueclTitles} UECL · {data.totals.superCupTitles} SC
            </p>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-4">
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-[2.5px] bg-[#2563eb]"
            />
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
              {tx('EPL Clubs in Europe', 'จำนวนสโมสรที่ได้ไปยุโรป')}
            </p>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="font-display text-3xl font-extrabold tabular-nums text-primary">
                {data.totals.uniqueClubs}
              </span>
              <span className="text-xs font-semibold text-muted">
                {tx('clubs', 'สโมสร')}
              </span>
            </div>
            <p className="mt-1.5 text-xs tabular-nums text-muted">
              {data.totals.totalCampaigns}{' '}
              {tx('campaigns across 13 seasons', 'แคมเปญใน 13 ฤดูกาล')}
            </p>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-4">
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-[2.5px] bg-[#059669]"
            />
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
              {tx('Combined Win Rate', 'อัตราชนะรวมในเวทียุโรป')}
            </p>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="font-display text-3xl font-extrabold tabular-nums text-success">
                {fmt(data.totals.overallWinPct, 2)}%
              </span>
            </div>
            <p className="mt-1.5 text-xs tabular-nums text-muted">
              {data.totals.totalWins} {tx('wins in', 'ชนะจาก')}{' '}
              {data.totals.totalMatches} {tx('matches', 'นัด')}
            </p>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-4">
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-[2.5px] bg-brand"
            />
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
              {tx(`Active ${seasonShort(data.latestSeason)}`, `ฤดูกาลล่าสุด ${seasonShort(data.latestSeason)}`)}
            </p>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="font-display text-3xl font-extrabold tabular-nums text-primary">
                {latestSeasonRow?.uniqueClubs ?? 0}
              </span>
              <span className="text-xs font-semibold text-muted">
                {tx('EPL clubs', 'ทีม EPL')}
              </span>
            </div>
            <p className="mt-1.5 text-xs tabular-nums text-muted">
              {latestSeasonRow?.uclCount ?? 0} UCL · {latestSeasonRow?.uelCount ?? 0} UEL ·{' '}
              {latestSeasonRow?.ueclCount ?? 0} UECL
            </p>
          </div>
        </section>

        {/* ------------------------------------ Quick Section Jump Strip */}
        <nav
          aria-label="Europe sections"
          className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-semibold"
        >
          {[
            ['#spotlight', tx('Season Spotlight', 'เจาะลึกรายฤดูกาล')],
            ['#matrix', tx('All-Seasons Matrix (14/15–26/27)', 'ตารางประวัติทุกปี (14/15–26/27)')],
            ['#finals', tx('Finals & Trophies', 'ทำเนียบแชมป์ & นัดชิง')],
            ['#leaderboard', tx('All-Time Leaderboard', 'อันดับผลงานรวมยุโรป')],
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

        {/* --------------------------------------- 1. Season Spotlight */}
        {activeSeasonData && (
          <section
            id="spotlight"
            className="scroll-mt-24 rounded-2xl border border-border bg-surface p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                  {tx('Season Breakdown · Click a club to view match log', 'เจาะลึกรายฤดูกาล · คลิกที่ทีมเพื่อดูผลแข่งทุกนัด')}
                </p>
                <h2 className="mt-0.5 font-display text-xl font-bold text-primary sm:text-2xl">
                  {tx(
                    `European Campaigns · ${activeSeasonData.season}`,
                    `ทีมพรีเมียร์ลีกในเวทียุโรป · ${activeSeasonData.season}`,
                  )}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {recentPills.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setSelectedSeason(s);
                      setExpandedKey(null);
                    }}
                    className={`hidden rounded-lg px-2.5 py-1.5 text-xs font-semibold tabular-nums transition-colors sm:inline-block ${
                      s === selectedSeason
                        ? 'bg-primary text-surface'
                        : 'bg-bg-secondary text-muted hover:text-primary'
                    }`}
                  >
                    {seasonShort(s)}
                  </button>
                ))}
                <select
                  value={selectedSeason}
                  onChange={(e) => {
                    setSelectedSeason(e.target.value);
                    setExpandedKey(null);
                  }}
                  aria-label={tx('Select European season', 'เลือกฤดูกาลเวทียุโรป')}
                  className="rounded-lg border border-border bg-bg-secondary px-3 py-1.5 text-xs font-semibold tabular-nums text-primary"
                >
                  {seasonsLatestFirst.map((s) => (
                    <option key={s} value={s} className="bg-surface text-primary">
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quiet Season Summary Line */}
            <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs tabular-nums text-muted">
              <span className="font-semibold text-primary">
                {activeSeasonData.uniqueClubs} {tx('EPL clubs', 'สโมสร EPL')}
              </span>
              {activeSeasonData.uclCount > 0 && <span>UCL: {activeSeasonData.uclCount}</span>}
              {activeSeasonData.uelCount > 0 && <span>UEL: {activeSeasonData.uelCount}</span>}
              {activeSeasonData.ueclCount > 0 && <span>UECL: {activeSeasonData.ueclCount}</span>}
              {activeSeasonData.superCupCount > 0 && (
                <span>Super Cup: {activeSeasonData.superCupCount}</span>
              )}
              {activeSeasonData.trophiesWon > 0 && (
                <span className="inline-flex items-center gap-1 font-semibold text-warning">
                  <Trophy size={12} />
                  {activeSeasonData.trophiesWon} {tx('trophy won', 'แชมป์')}
                </span>
              )}
            </div>

            {/* Competition Panels */}
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              {COMP_ORDER.map((comp) => {
                const list = activeSeasonData.campaigns.filter(
                  (c) => c.competition === comp,
                );
                if (!list.length) return null;
                const st = COMP_META[comp];

                return (
                  <div
                    key={comp}
                    className="rounded-2xl border border-border bg-bg-secondary/30 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between gap-2 border-b border-border/70 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${st.dot}`} />
                        <h3 className="font-display text-base font-bold text-primary">
                          {th ? st.th : st.en}
                        </h3>
                      </div>
                      <span className="text-xs tabular-nums text-muted">
                        {list.length} {tx('clubs', 'ทีม')}
                      </span>
                    </div>

                    <div className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border bg-surface">
                      {list.map((c) => {
                        const rowKey = `${c.season}||${c.competition}||${c.slug}`;
                        const isOpen = expandedKey === rowKey;
                        return (
                          <div key={rowKey}>
                            <button
                              type="button"
                              onClick={() => setExpandedKey(isOpen ? null : rowKey)}
                              aria-expanded={isOpen}
                              className="flex w-full flex-wrap items-center justify-between gap-2 px-3.5 py-3 text-left transition-colors hover:bg-bg-secondary/50"
                            >
                              <div className="flex min-w-0 items-center gap-2.5">
                                <ClubCrest slug={c.slug} size={20} />
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="truncate text-sm font-semibold text-primary">
                                      {nameOf(c.slug)}
                                    </span>
                                    {c.droppedFromUcl && (
                                      <span className="rounded bg-bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted">
                                        {tx('from UCL', 'ตกจาก UCL')}
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-0.5 flex flex-wrap items-center gap-2.5 text-[11px] tabular-nums text-muted">
                                    <span>
                                      {c.mp} {tx('MP', 'นัด')} ·{' '}
                                      <span className="font-semibold text-secondary">
                                        {c.w}W-{c.d}D-{c.l}L
                                      </span>
                                    </span>
                                    <span>
                                      {c.gf}:{c.ga} ({c.gd > 0 ? `+${c.gd}` : c.gd})
                                    </span>
                                    <span className="hidden sm:inline">
                                      {fmt(c.winPct, 2)}% W
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex shrink-0 items-center gap-2">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] ${stageBadgeClass(c.stageCode)}`}
                                >
                                  {c.stageCode === 'winner' && <Trophy size={11} />}
                                  {th ? c.stageTh : c.stageEn}
                                </span>
                                {isOpen ? (
                                  <ChevronUp size={15} className="text-muted" />
                                ) : (
                                  <ChevronDown size={15} className="text-muted" />
                                )}
                              </div>
                            </button>

                            {isOpen && (
                              <div className="border-t border-border bg-bg-secondary/40 px-3.5 py-3">
                                <div className="mb-2 flex items-center justify-between text-[11px]">
                                  <span className="font-semibold uppercase tracking-wider text-muted">
                                    {tx('Match Log', 'ผลการแข่งขันทั้งหมด')} ({c.matches.length})
                                  </span>
                                  <Link
                                    href={`/${c.slug}/matches/`}
                                    className="font-semibold text-primary underline-offset-2 hover:text-brand hover:underline"
                                  >
                                    {tx('Club archive →', 'ดูประวัติทีมทั้งหมด →')}
                                  </Link>
                                </div>
                                <div className="max-h-72 divide-y divide-border/70 overflow-y-auto rounded-lg border border-border bg-surface text-xs">
                                  {c.matches.map((m, idx) => {
                                    const bk =
                                      m.result == null && m.time
                                        ? bkkKickoff(m.date, m.time)
                                        : null;
                                    const scoreStr =
                                      m.gf != null && m.ga != null
                                        ? `${m.gf}–${m.ga}${
                                            m.gfPens != null && m.gaPens != null
                                              ? ` (${m.gfPens}–${m.gaPens}p)`
                                              : ''
                                          }`
                                        : bk
                                        ? `${bk.time} BKK`
                                        : m.time || 'TBD';
                                    return (
                                      <div
                                        key={`${m.date}-${idx}`}
                                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                                      >
                                        <div className="flex min-w-0 items-center gap-2">
                                          <span className="w-16 shrink-0 tabular-nums text-[11px] text-muted">
                                            {formatDate(m.date)}
                                          </span>
                                          <span className="w-4 shrink-0 text-center text-[10px] font-semibold text-muted">
                                            {m.venue === 'Home'
                                              ? 'H'
                                              : m.venue === 'Away'
                                              ? 'A'
                                              : 'N'}
                                          </span>
                                          <span className="truncate font-medium text-primary">
                                            {m.opponent ?? '—'}
                                          </span>
                                          {m.round && (
                                            <span className="hidden truncate text-[10px] text-muted sm:inline">
                                              · {m.round}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2.5 tabular-nums">
                                          <span className="font-semibold text-primary">
                                            {scoreStr}
                                          </span>
                                          {m.result && (
                                            <span
                                              className={`w-3.5 text-center text-[11px] ${
                                                RES_TEXT[m.result] ?? 'text-muted'
                                              }`}
                                            >
                                              {m.result}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Upcoming European Fixtures */}
            {selectedSeason === data.latestSeason && data.upcoming.length > 0 && (
              <div className="mt-5 rounded-xl border border-border bg-bg-secondary/35 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                    <Calendar size={14} className="text-muted" />
                    {tx('Next European Fixtures (BKK Time)', 'โปรแกรมเวทียุโรปนัดถัดไป (เวลาไทย)')}
                  </p>
                  <span className="text-[11px] tabular-nums text-muted">
                    {data.upcoming.length} {tx('scheduled', 'นัดที่รอแข่ง')}
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {data.upcoming.slice(0, 9).map((u, idx) => {
                    const bk = u.time ? bkkKickoff(u.date, u.time) : null;
                    const st = COMP_META[u.competition];
                    return (
                      <div
                        key={`${u.slug}-${u.date}-${idx}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="shrink-0 rounded bg-bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-secondary">
                            {st.short}
                          </span>
                          <ClubCrest slug={u.slug} size={16} />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-primary">
                              {shortOf(u.slug)}{' '}
                              <span className="font-normal text-muted">
                                ({u.venue === 'Home' ? 'H' : u.venue === 'Away' ? 'A' : 'N'})
                              </span>{' '}
                              vs {u.opponent ?? '—'}
                            </p>
                            <p className="truncate text-[10px] text-muted">
                              {u.round ?? u.competition}
                            </p>
                          </div>
                        </div>
                        <span className="shrink-0 text-right text-[10px] tabular-nums text-muted">
                          {bk ? (
                            <>
                              <span className="block font-semibold text-primary">
                                {bk.time}
                              </span>
                              <span>{bk.date}</span>
                            </>
                          ) : (
                            formatDate(u.date)
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ----------------------- 2. All-Seasons Participation Matrix */}
        <section
          id="matrix"
          className="scroll-mt-24 rounded-2xl border border-border bg-surface p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                {tx('Historical Qualification Map · 2014/15 – 2026/27', 'ประวัติการไปเวทียุโรปทุกฤดูกาล · 2014/15 – 2026/27')}
              </p>
              <h2 className="mt-0.5 font-display text-lg font-bold text-primary sm:text-xl">
                {tx(
                  'Which EPL Clubs Qualified Each Season',
                  'ทีมในพรีเมียร์ลีกแต่ละปีไปรายการยุโรปไหนบ้าง',
                )}
              </h2>
            </div>

            <div className="inline-flex rounded-lg border border-border bg-bg-secondary p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setArchiveView('matrix')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 transition-colors ${
                  archiveView === 'matrix'
                    ? 'bg-surface text-primary shadow-sm'
                    : 'text-muted hover:text-primary'
                }`}
              >
                <Grid3X3 size={13} />
                {tx('Matrix', 'ตารางเมทริกซ์')}
              </button>
              <button
                type="button"
                onClick={() => setArchiveView('timeline')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 transition-colors ${
                  archiveView === 'timeline'
                    ? 'bg-surface text-primary shadow-sm'
                    : 'text-muted hover:text-primary'
                }`}
              >
                <List size={13} />
                {tx('Year by Year', 'ไล่ตามปี')}
              </button>
            </div>
          </div>

          {/* Calm Legend */}
          <div className="mt-3.5 flex flex-wrap items-center gap-3 text-[11px] text-muted">
            {(['Champions League', 'Europa League', 'Conference League'] as EuroComp[]).map(
              (c) => (
                <span key={c} className="inline-flex items-center gap-1.5">
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[10px] ${COMP_META[c].matrixCell}`}
                  >
                    {COMP_META[c].short}
                  </span>
                  <span>
                    {th
                      ? COMP_META[c].th.split(' (')[0]
                      : COMP_META[c].en.replace('UEFA ', '')}
                  </span>
                </span>
              ),
            )}
            <span className="inline-flex items-center gap-1">
              <span className="inline-flex items-center gap-0.5 rounded border border-warning/40 bg-warning-soft/60 px-1.5 py-0.5 text-[10px] font-bold text-warning">
                <Trophy size={9} />
                {tx('Winner', 'แชมป์')}
              </span>
            </span>
            <span className="text-muted/80">
              · {tx('Click any cell to inspect matches', 'คลิกช่องใดก็ได้เพื่อดูผลแข่ง')}
            </span>
          </div>

          {archiveView === 'matrix' ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[960px] border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface-elevated">
                    <th className="sticky left-0 z-10 bg-surface-elevated px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                      {tx('Club', 'สโมสร')}
                    </th>
                    {data.seasons.map((s) => (
                      <th
                        key={s}
                        className={`px-1.5 py-2.5 text-center text-[10px] font-semibold tabular-nums ${
                          s === selectedSeason ? 'text-primary underline underline-offset-4' : 'text-muted'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedSeason(s)}
                          className="hover:text-primary"
                        >
                          {seasonShort(s)}
                        </button>
                      </th>
                    ))}
                    <th className="px-2 py-2.5 text-right text-[10px] font-semibold uppercase text-muted">
                      {tx('Total', 'รวม')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {data.leaderboard.map((club) => {
                    const clubSeasons = matrixMap.get(club.slug);
                    return (
                      <tr
                        key={club.slug}
                        className="transition-colors hover:bg-bg-secondary/45"
                      >
                        <td className="sticky left-0 z-10 bg-surface px-3 py-2 font-semibold text-primary">
                          <Link
                            href={`/${club.slug}/`}
                            className="inline-flex items-center gap-2 whitespace-nowrap hover:text-brand"
                          >
                            <ClubCrest slug={club.slug} size={17} />
                            <span>{shortOf(club.slug)}</span>
                          </Link>
                        </td>
                        {data.seasons.map((s) => {
                          const camps = clubSeasons?.get(s) ?? [];
                          if (!camps.length) {
                            return (
                              <td
                                key={s}
                                className="px-1 py-2 text-center text-border"
                              >
                                ·
                              </td>
                            );
                          }
                          const ucl = camps.find(
                            (x) => x.competition === 'Champions League',
                          );
                          const uel = camps.find(
                            (x) => x.competition === 'Europa League',
                          );
                          const uecl = camps.find(
                            (x) => x.competition === 'Conference League',
                          );
                          const primary = ucl ?? uel ?? uecl ?? camps[0];
                          const dropped = Boolean(ucl && uel);
                          const winnerCamp = camps.find(
                            (x) => x.stageCode === 'winner',
                          );
                          const finalCamp = camps.find(
                            (x) => x.stageCode === 'final',
                          );
                          const displayCamp = winnerCamp ?? finalCamp ?? primary;
                          const st = COMP_META[displayCamp.competition];
                          const badgeText = dropped ? 'UCL→UEL' : st.short;
                          const tooltip = camps
                            .map(
                              (c) =>
                                `${c.competition} (${th ? c.stageTh : c.stageEn}): ${c.w}W-${c.d}D-${c.l}L`,
                            )
                            .join(' | ');
                          const cellStyle = winnerCamp
                            ? 'border-warning/40 bg-warning-soft/60 text-warning font-bold'
                            : st.matrixCell;

                          return (
                            <td key={s} className="px-1 py-1.5 text-center">
                              <button
                                type="button"
                                title={`${nameOf(club.slug)} ${seasonShort(s)} — ${tooltip}`}
                                onClick={() =>
                                  jumpToCampaign(
                                    s,
                                    club.slug,
                                    displayCamp.competition,
                                  )
                                }
                                className={`inline-flex min-w-[44px] items-center justify-center gap-0.5 rounded-md border px-1.5 py-1 text-[10px] transition-colors hover:border-primary/50 ${cellStyle}`}
                              >
                                {winnerCamp && <Trophy size={9} />}
                                <span>{badgeText}</span>
                              </button>
                            </td>
                          );
                        })}
                        <td className="px-2 py-2 text-right font-bold tabular-nums text-primary">
                          {club.appearances}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-border/80 rounded-xl border border-border">
              {data.bySeason.map((s) => (
                <div key={s.season} className="p-4">
                  <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSeason(s.season);
                        document
                          .getElementById('spotlight')
                          ?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="font-display text-base font-bold text-primary hover:text-brand"
                    >
                      {s.season}
                    </button>
                    <span className="text-xs tabular-nums text-muted">
                      {s.uniqueClubs} {tx('clubs', 'ทีม')} · {s.uclCount} UCL ·{' '}
                      {s.uelCount} UEL
                      {s.ueclCount > 0 ? ` · ${s.ueclCount} UECL` : ''}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {s.campaigns
                      .filter((c) => c.competition !== 'UEFA Super Cup')
                      .map((c) => {
                        const st = COMP_META[c.competition];
                        const isWin = c.stageCode === 'winner';
                        return (
                          <button
                            key={`${c.competition}-${c.slug}`}
                            type="button"
                            onClick={() =>
                              jumpToCampaign(s.season, c.slug, c.competition)
                            }
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors hover:border-primary/40 ${
                              isWin
                                ? 'border-warning/40 bg-warning-soft/50 font-semibold text-primary'
                                : 'border-border bg-bg-secondary/50 text-primary'
                            }`}
                          >
                            <span className="text-[10px] font-bold text-muted">
                              {st.short}
                            </span>
                            <ClubCrest slug={c.slug} size={15} />
                            <span className="font-medium">{shortOf(c.slug)}</span>
                            <span className="text-[10px] text-muted">
                              · {th ? c.stageTh : c.stageEn}
                            </span>
                            {isWin && <Trophy size={11} className="text-warning" />}
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ----------------------------- 3. Finals & Trophy Roll */}
        <section
          id="finals"
          className="scroll-mt-24 rounded-2xl border border-border bg-surface p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                <Trophy size={13} className="text-warning" />
                {tx('European Finals & Super Cups · 2014–2027', 'ทำเนียบแชมป์และนัดชิงยุโรป · 2014–2027')}
              </p>
              <h2 className="mt-0.5 font-display text-lg font-bold text-primary sm:text-xl">
                {tx('Trophy Cabinet & Final Appearances', 'ผลงานนัดชิงชนะเลิศของทีมพรีเมียร์ลีก')}
              </h2>
            </div>

            <div className="inline-flex rounded-lg border border-border bg-bg-secondary p-0.5 text-xs font-semibold">
              {(
                [
                  ['all', tx(`All (${data.finals.length})`, `ทั้งหมด (${data.finals.length})`)],
                  ['won', tx('Champions Only', 'แชมป์เท่านั้น')],
                  ['english', tx('All-English Finals', 'ชิงกันเอง (EPL)')],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFinalsFilter(id)}
                  className={`rounded-md px-2.5 py-1 transition-colors ${
                    finalsFilter === id
                      ? 'bg-surface text-primary shadow-sm'
                      : 'text-muted hover:text-primary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredFinals.map((f, idx) => {
              const st = COMP_META[f.competition];
              return (
                <article
                  key={`${f.season}-${f.competition}-${f.slug}-${idx}`}
                  className="flex flex-col justify-between rounded-xl border border-border bg-bg-secondary/25 p-4"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-semibold text-muted">
                      {st.short} · {seasonShort(f.season)}
                      {f.allEnglish ? ' · All-EPL' : ''}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        f.won
                          ? 'border-warning/35 bg-warning-soft/60 text-warning'
                          : 'border-border bg-bg-secondary text-muted'
                      }`}
                    >
                      {f.won && <Trophy size={10} />}
                      {f.won ? tx('Winner', 'แชมป์') : tx('Runner-up', 'รองแชมป์')}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <ClubCrest slug={f.slug} size={22} />
                      <div className="min-w-0">
                        <Link
                          href={`/${f.slug}/`}
                          className="block truncate font-display text-sm font-bold text-primary hover:text-brand"
                        >
                          {nameOf(f.slug)}
                        </Link>
                        <p className="truncate text-[11px] text-muted">
                          vs{' '}
                          {f.opponentSlug ? (
                            <Link
                              href={`/${f.opponentSlug}/`}
                              className="font-medium text-secondary hover:text-brand"
                            >
                              {nameOf(f.opponentSlug)}
                            </Link>
                          ) : (
                            f.opponent ?? '—'
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right tabular-nums">
                      <span className="font-display text-lg font-bold text-primary">
                        {f.score}
                      </span>
                      {f.pens && (
                        <span className="block text-[10px] text-muted">
                          ({f.pens} {tx('pens', 'จุดโทษ')})
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* ----------------------------- 4. All-Time European Leaderboard */}
        <section
          id="leaderboard"
          className="scroll-mt-24 overflow-hidden rounded-2xl border border-border bg-surface"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                {tx('Cumulative Record · 2014/15 – 2026/27', 'สถิติสะสมในเวทียุโรป · 2014/15 – 2026/27')}
              </p>
              <h2 className="mt-0.5 font-display text-lg font-bold text-primary sm:text-xl">
                {tx('All-Time EPL European Leaderboard', 'ตารางอันดับผลงานรวมในเวทียุโรป')}
              </h2>
            </div>

            <div className="inline-flex rounded-lg border border-border bg-bg-secondary p-0.5 text-xs font-semibold">
              {(
                [
                  ['all', tx('All Europe', 'ทุกรายการ')],
                  ['Champions League', 'UCL'],
                  ['Europa League', 'UEL'],
                  ['Conference League', 'UECL'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setLbComp(id)}
                  className={`rounded-md px-2.5 py-1 transition-colors ${
                    lbComp === id
                      ? 'bg-surface text-primary shadow-sm'
                      : 'text-muted hover:text-primary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-xs">
              <thead className="bg-surface-elevated">
                <tr>
                  <th className="border-b border-border px-3 py-2.5 text-left text-[11px] font-semibold uppercase text-muted">
                    #
                  </th>
                  <th className="border-b border-border px-3 py-2.5 text-left text-[11px] font-semibold uppercase text-muted">
                    {tx('Club', 'สโมสร')}
                  </th>
                  {lbComp === 'all' && (
                    <th className="border-b border-border px-3 py-2.5 text-left text-[11px] font-semibold uppercase text-muted">
                      {tx('Split', 'แยกตามรายการ')}
                    </th>
                  )}
                  {(
                    [
                      ['appearances', tx('Seasons', 'ปี')],
                      ['trophies', tx('Titles', 'แชมป์')],
                      ['finals', tx('Finals', 'ชิง')],
                      ['mp', 'MP'],
                      ['w', 'W'],
                      ['gd', 'GD'],
                      ['winPct', 'Win%'],
                      ['ppg', 'PPG'],
                    ] as [LbSortKey, string][]
                  ).map(([k, label]) => (
                    <th
                      key={k}
                      onClick={() => toggleLbSort(k)}
                      className="cursor-pointer border-b border-border px-3 py-2.5 text-right text-[11px] font-semibold uppercase text-muted hover:bg-bg-secondary"
                    >
                      <span className="inline-flex items-center justify-end gap-1">
                        {label}
                        {sortArrow(k)}
                      </span>
                    </th>
                  ))}
                  <th className="border-b border-border px-3 py-2.5 text-left text-[11px] font-semibold uppercase text-muted">
                    {tx('Best Finish', 'ผลงานดีสุด')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light tabular-nums">
                {leaderboardRows.map((r, idx) => {
                  const splitParts = [
                    r.uclApps > 0 ? `${r.uclApps} UCL` : null,
                    r.uelApps > 0 ? `${r.uelApps} UEL` : null,
                    r.ueclApps > 0 ? `${r.ueclApps} UECL` : null,
                  ].filter(Boolean);
                  return (
                    <tr
                      key={r.slug}
                      className="transition-colors hover:bg-bg-secondary/50"
                    >
                      <td className="px-3 py-2.5 text-muted">{idx + 1}</td>
                      <td className="px-3 py-2.5 text-sm font-semibold text-primary">
                        <Link
                          href={`/${r.slug}/`}
                          className="inline-flex items-center gap-2 hover:text-brand"
                        >
                          <ClubCrest slug={r.slug} size={18} />
                          <span>{nameOf(r.slug)}</span>
                        </Link>
                      </td>
                      {lbComp === 'all' && (
                        <td className="px-3 py-2.5 text-muted">
                          {splitParts.join(' · ') || '—'}
                        </td>
                      )}
                      <td className="px-3 py-2.5 text-right font-semibold text-primary">
                        {r.appearances}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-primary">
                        {r.trophies > 0 ? (
                          <span className="inline-flex items-center gap-1 text-warning">
                            <Trophy size={11} />
                            {r.trophies}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right text-secondary">
                        {r.finals > 0 ? r.finals : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right text-secondary">
                        {r.mp}
                      </td>
                      <td className="px-3 py-2.5 text-right text-primary">
                        {r.w}
                      </td>
                      <td className="px-3 py-2.5 text-right text-secondary">
                        {r.gd > 0 ? `+${r.gd}` : r.gd}
                      </td>
                      <td className="px-3 py-2.5 text-right text-secondary">
                        {fmt(r.winPct, 2)}%
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-primary">
                        {fmt(r.ppg, 2)}
                      </td>
                      <td className="px-3 py-2.5 text-secondary">
                        {th ? r.bestStageTh : r.bestStageEn}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border bg-bg-secondary/35 px-5 py-3 text-[11px] text-muted">
            {tx(
              'Includes every European campaign played by Premier League clubs during their PL seasons from 2014/15 through 2026/27 (source: fbref match logs).',
              'รวมทุกแคมเปญเวทียุโรปของสโมสรพรีเมียร์ลีกในช่วงที่ลงเล่นในพรีเมียร์ลีกตั้งแต่ฤดูกาล 2014/15 ถึง 2026/27 (ที่มา: บันทึกการแข่งขัน fbref)',
            )}
          </p>
        </section>
      </main>
    </div>
  );
}
