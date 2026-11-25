'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useI18n } from '@/i18n/I18nContext';
import type {
  ClubIndexEntry,
  LeagueFormMatch,
  LeagueRoundMatch,
  LeagueSeasonData,
  LeagueMwData,
  LeagueTableViewRow,
  MatchRow,
  Zone,
} from '@/lib/types';
import { fmt, signed, bkkKickoff } from '@/lib/format';
import { seasonShort } from '@/lib/stats';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import {
  loadLeagueSeason,
  loadLeagueMw,
  formatDate,
  LoadFail,
  LOAD_FAILED,
  RESULT_STYLE,
} from './matchlog-shared';
import { MatchCard } from './MatchCard';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function ClubCrest({
  slug,
  size = 20,
  alt = '',
}: {
  slug: string;
  size?: number;
  alt?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${BASE_PATH}/logos/${slug}.png`}
      width={size}
      height={size}
      alt={alt}
      loading="lazy"
      className="inline-block shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}

type ViewKey = 'all' | 'home' | 'away' | 'last5' | 'xg';

const ZONE_STYLE: Record<string, string> = {
  cl: 'bg-[#1e6cff]',
  el: 'bg-[#ff7a00]',
  ecl: 'bg-[#00b87c]',
  rel: 'bg-danger',
};

function roundToMatchRows(
  matches: LeagueRoundMatch[],
  season: string,
  wk: number,
): MatchRow[] {
  return matches.map((m) => {
    const sm = m.score?.match(/(-?\d+)\s*[–-]\s*(-?\d+)/);
    return {
      season,
      date: m.date,
      time: m.time || null,
      competition: 'Premier League',
      round: `Matchweek ${wk}`,
      venue: null,
      result: null,
      gf: sm ? parseInt(sm[1], 10) : null,
      ga: sm ? parseInt(sm[2], 10) : null,
      gfPens: null,
      gaPens: null,
      opponent: null,
      possession: null,
      attendance: null,
      captain: null,
      formation: null,
      oppFormation: null,
      referee: null,
      notes: null,
      matchId: m.matchId ?? null,
      xg: null,
      xga: null,
    };
  });
}

function scoreGoals(score: string | null): number {
  if (!score) return 0;
  const sm = score.match(/(\d+)\s*[–-]\s*(\d+)/);
  return sm ? parseInt(sm[1], 10) + parseInt(sm[2], 10) : 0;
}

function parseScorePair(score: string | null): [number, number] | null {
  if (!score) return null;
  const sm = score.match(/(\d+)\s*[–-]\s*(\d+)/);
  return sm ? [parseInt(sm[1], 10), parseInt(sm[2], 10)] : null;
}

export function LeagueHome({
  clubs,
  seasons,
  initial,
}: {
  clubs: ClubIndexEntry[];
  seasons: string[];
  initial: LeagueSeasonData | null;
}) {
  const { t, lang } = useI18n();
  const th = lang === 'th';
  const tx = (en: string, thText: string) => (th ? thText : en);

  const clubOf = useMemo(() => {
    const m = new Map<string, ClubIndexEntry>();
    for (const c of clubs) m.set(c.slug, c);
    return m;
  }, [clubs]);
  const nameOf = (slug: string) => {
    const c = clubOf.get(slug);
    return th && c?.nameTh ? c.nameTh : c?.name ?? slug;
  };
  const shortOf = (slug: string) => {
    const c = clubOf.get(slug);
    return th && c?.nameTh ? c.nameTh : (c?.shortName ?? c?.name ?? slug);
  };

  const latestSeason = seasons[seasons.length - 1] ?? '';
  const [season, setSeason] = useState(initial?.season ?? latestSeason);
  const [view, setView] = useState<ViewKey>('all');
  const [extra, setExtra] = useState<
    Record<string, LeagueSeasonData | null | typeof LOAD_FAILED>
  >({});
  const [mw, setMw] = useState<number | null>(null);
  const [mwExtra, setMwExtra] = useState<
    Record<string, LeagueMwData | null | typeof LOAD_FAILED>
  >({});
  const [tableQuery, setTableQuery] = useState('');
  const [dirMode, setDirMode] = useState<'season' | 'all'>('season');
  const [dirQuery, setDirQuery] = useState('');

  const [openMatch, setOpenMatch] = useState<{
    mid: string;
    rows: MatchRow[];
    index: number;
  } | null>(null);
  const [openFixture, setOpenFixture] = useState<{
    m: LeagueRoundMatch;
    wk: number;
  } | null>(null);

  const loaded = season === initial?.season ? initial : (extra[season] ?? null);
  const data: LeagueSeasonData | null = loaded === LOAD_FAILED ? null : loaded;
  const loading =
    season !== initial?.season && !(season in extra) && loaded !== LOAD_FAILED;
  const failed = loaded === LOAD_FAILED;

  useEffect(() => {
    if (!season || season === initial?.season || season in extra) return;
    let live = true;
    loadLeagueSeason(season).then((d) => {
      if (live) setExtra((p) => ({ ...p, [season]: d }));
    });
    return () => {
      live = false;
    };
  }, [season, initial?.season, extra]);

  useEffect(() => {
    if (!season || season in mwExtra) return;
    let live = true;
    loadLeagueMw(season).then((d) => {
      if (live) setMwExtra((p) => ({ ...p, [season]: d }));
    });
    return () => {
      live = false;
    };
  }, [season, mwExtra]);

  const mwLoaded = mwExtra[season];
  const mwLoading = mwLoaded === undefined;
  const mwObj = mwLoaded === LOAD_FAILED || mwLoading ? null : mwLoaded;
  const mwWeek = useMemo(() => {
    if (mw == null || !mwObj) return null;
    return mwObj.weeks.find((w) => w.wk === mw) ?? null;
  }, [mw, mwObj]);

  const [tbSort, setTbSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({
    key: 'rank',
    dir: 'asc',
  });
  const tableRows: LeagueTableViewRow[] = useMemo(() => {
    if (mwWeek) return (mwWeek.views[view] ?? []) as LeagueTableViewRow[];
    if (!data) return [];
    return (data.views[view] ?? []) as LeagueTableViewRow[];
  }, [data, view, mwWeek]);

  const sortedRows = useMemo(() => {
    const k = tbSort.key;
    const val = (r: LeagueTableViewRow): number | string | null =>
      k === 'club'
        ? nameOf(r.slug)
        : ((r as unknown as Record<string, unknown>)[k] as number | null);
    const cmp = (a: LeagueTableViewRow, b: LeagueTableViewRow) => {
      const av = val(a);
      const bv = val(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv));
    };
    const sorted = [...tableRows].sort((a, b) =>
      tbSort.dir === 'asc' ? cmp(a, b) : -cmp(a, b),
    );
    const q = tableQuery.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((r) => {
      const c = clubOf.get(r.slug);
      return (
        (c?.name ?? '').toLowerCase().includes(q) ||
        (c?.nameTh ?? '').toLowerCase().includes(q) ||
        (c?.shortName ?? '').toLowerCase().includes(q)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableRows, tbSort, tableQuery, lang, clubs]);

  const hasNext = !mwWeek && data ? Object.keys(data.next).length > 0 : false;
  const allView = useMemo(
    () => (mwWeek ? mwWeek.views.all : (data?.views.all ?? [])),
    [mwWeek, data],
  );
  const allViewMap = useMemo(
    () => new Map(allView.map((r) => [r.slug, r])),
    [allView],
  );
  const formMap = mwWeek ? mwWeek.form : (data?.form ?? {});
  const rowOf = (slug: string) => allViewMap.get(slug);
  const formOf = (slug: string): LeagueFormMatch[] => formMap[slug] ?? [];
  const zones = useMemo(
    () => (mwWeek ? mwWeek.zones : (data?.zones ?? {})),
    [mwWeek, data],
  );
  const zonesProjected = mwWeek ? true : (data?.zonesProjected ?? false);
  const zoneLegend = useMemo(() => {
    const present = new Set(Object.values(zones).filter(Boolean));
    return (['cl', 'el', 'ecl', 'rel'] as const).filter((z) => present.has(z));
  }, [zones]);
  const seasonClubs = useMemo(
    () => (data ? data.views.all.map((r) => r.slug) : []),
    [data],
  );

  // Filtered directory clubs
  const directoryClubs = useMemo(() => {
    const base =
      dirMode === 'season' && data
        ? clubs
            .filter((c) => seasonClubs.includes(c.slug))
            .sort(
              (a, b) =>
                (allViewMap.get(a.slug)?.rank ?? 99) -
                (allViewMap.get(b.slug)?.rank ?? 99),
            )
        : [...clubs].sort((a, b) => b.seasons.length - a.seasons.length || a.name.localeCompare(b.name));
    const q = dirQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.nameTh ?? '').toLowerCase().includes(q) ||
        (c.shortName ?? '').toLowerCase().includes(q),
    );
  }, [clubs, dirMode, data, seasonClubs, allViewMap, dirQuery]);

  // Summary snapshot cards
  const mostCleanSheets = data?.views.all
    .filter((r) => r.mp > 0 && r.cs != null)
    .reduce<(typeof data.views.all)[number] | null>(
      (best, r) => (!best || r.cs > best.cs ? r : best),
      null,
    );
  const summary = data?.summary;
  const cards: {
    key: string;
    label: string;
    slug?: string;
    value?: string;
    who?: string;
    tone?: 'default' | 'pos' | 'neg';
  }[] = summary
    ? [
        {
          key: 'leader',
          label: t('home.summary.leader'),
          slug: summary.leader?.slug,
          value: `${summary.leader?.value ?? '—'} ${t('table.pts')}`,
        },
        {
          key: 'bestAttack',
          label: t('home.summary.bestAttack'),
          slug: summary.bestAttack?.slug,
          value: `${summary.bestAttack?.value ?? '—'} GF`,
        },
        {
          key: 'bestDefence',
          label: t('home.summary.bestDefence'),
          slug: summary.bestDefence?.slug,
          value: `${summary.bestDefence?.value ?? '—'} GA`,
        },
        {
          key: 'mostXg',
          label: t('home.summary.mostXg'),
          slug: summary.mostXg?.slug,
          value: `${fmt(summary.mostXg?.value ?? null)} xG`,
        },
        {
          key: 'overPerformer',
          label: t('home.summary.overPerformer'),
          slug: summary.overPerformer?.slug,
          value: signed(summary.overPerformer?.value ?? null),
          tone: 'pos',
        },
        {
          key: 'underPerformer',
          label: t('home.summary.underPerformer'),
          slug: summary.underPerformer?.slug,
          value: signed(summary.underPerformer?.value ?? null),
          tone: 'neg',
        },
        {
          key: 'mostCleanSheets',
          label: t('home.summary.mostCleanSheets'),
          slug: mostCleanSheets?.slug,
          value: `${mostCleanSheets?.cs ?? '—'} ${t('home.summary.cleanSheetUnit')}`,
        },
        {
          key: 'topScorer',
          label: t('home.summary.topScorer'),
          slug: summary.topScorer?.slug,
          value: `${summary.topScorer?.goals ?? '—'} G`,
          who: summary.topScorer?.player,
        },
      ]
    : [];

  const isXg = view === 'xg';
  const currentWkIdx =
    mwObj && mwObj.weeks.length
      ? mw != null
        ? mwObj.weeks.findIndex((w) => w.wk === mw)
        : mwObj.weeks.length - 1
      : -1;
  const activeWkNum =
    mwObj && currentWkIdx >= 0 ? mwObj.weeks[currentWkIdx]?.wk : null;

  const isCurrentSeason = season === latestSeason;

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 pb-16 pt-6 sm:px-6 lg:px-10">
      {/* -------------------------------------------------- Editorial Masthead */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
            <span>Premier League · 2014–2027</span>
            <span className="text-border">•</span>
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                isCurrentSeason
                  ? 'bg-success-soft text-success'
                  : 'bg-bg-secondary text-muted'
              }`}
            >
              {isCurrentSeason
                ? tx('In Progress', 'กำลังแข่งขัน')
                : tx('Completed Season', 'จบฤดูกาลแล้ว')}
            </span>
          </div>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-primary sm:text-4xl">
            {tx(`Premier League ${seasonShort(season)}`, `พรีเมียร์ลีก ${seasonShort(season)}`)}
          </h1>
          <p className="mt-1 text-sm text-secondary">
            {tx(
              'Interactive standings, matchweek time-travel, xG tables, round fixtures and every PL club dossier.',
              'ตารางคะแนนแบบโต้ตอบ ย้อนดูอันดับรายสัปดาห์ ตาราง xG โปรแกรมและผลการแข่งขัน พร้อมเจาะลึกทุกสโมสรพรีเมียร์ลีก',
            )}
          </p>
        </div>

        {/* Season selector + quick hub links */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-1.5">
            <label
              htmlFor="league-season"
              className="text-[11px] font-bold uppercase tracking-wider text-muted"
            >
              {t('table.season')}
            </label>
            <select
              id="league-season"
              value={season}
              onChange={(e) => {
                setSeason(e.target.value);
                setMw(null);
              }}
              className="cursor-pointer bg-transparent text-sm font-bold tabular-nums text-primary outline-none"
            >
              {[...seasons].reverse().map((s) => (
                <option key={s} value={s} className="bg-surface text-primary">
                  {s}
                </option>
              ))}
            </select>
            {loading && (
              <span
                className="h-3 w-3 animate-spin rounded-full border-2 border-border border-t-brand"
                aria-label="loading"
              />
            )}
          </div>

          <Link
            href="/insights/"
            className="hidden items-center gap-1 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-bold text-primary transition-colors hover:border-brand/40 hover:bg-brand-soft hover:text-brand sm:inline-flex"
          >
            <Sparkles size={13} className="text-brand" />
            {tx('Weekly Insights', 'บทสรุปลีก')}
          </Link>
          <Link
            href="/clubs-compare/"
            className="hidden items-center gap-1 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-bold text-primary transition-colors hover:border-brand/40 hover:bg-brand-soft hover:text-brand md:inline-flex"
          >
            {tx('Compare Clubs', 'เทียบสโมสร')}
            <ArrowRight size={13} />
          </Link>
        </div>
      </header>

      {failed && (
        <LoadFail
          onRetry={() =>
            setExtra((p) => {
              const n = { ...p };
              delete n[season];
              return n;
            })
          }
        />
      )}

      {/* ----------------------------------------- Season Snapshot Strip */}
      {cards.length > 0 && (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {cards.map((c) => {
            const clubAccent = c.slug ? clubOf.get(c.slug)?.color : undefined;
            const valTone =
              c.tone === 'pos'
                ? 'text-success'
                : c.tone === 'neg'
                ? 'text-danger'
                : 'text-primary';
            return (
              <Link
                key={c.key}
                href={c.slug ? `/${c.slug}/` : '#'}
                className="group relative flex min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface p-3.5 transition-all hover:border-primary/35"
              >
                {clubAccent && (
                  <span
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-[2.5px] opacity-75 transition-opacity group-hover:opacity-100"
                    style={{ background: clubAccent }}
                  />
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] font-bold uppercase tracking-wider text-muted">
                    {c.label}
                  </span>
                  {c.slug && <ClubCrest slug={c.slug} size={18} />}
                </div>
                <div className="mt-2.5 flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-primary group-hover:text-brand">
                    {c.key === 'topScorer'
                      ? c.who ?? '—'
                      : c.slug
                      ? nameOf(c.slug)
                      : '—'}
                  </span>
                  <span
                    className={`shrink-0 font-display text-lg font-extrabold tabular-nums ${valTone}`}
                  >
                    {c.value}
                  </span>
                </div>
              </Link>
            );
          })}
        </section>
      )}

      {/* -------------------------------------- Interactive League Table */}
      <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface">
        {/* Tabs + Search toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-elevated px-4 py-2.5">
          <div className="flex gap-1 overflow-x-auto">
            {(['all', 'home', 'away', 'last5', 'xg'] as ViewKey[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setView(k)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  view === k
                    ? 'bg-primary text-surface'
                    : 'text-muted hover:bg-bg-secondary hover:text-primary'
                }`}
              >
                {t(`home.tabs.${k}`)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5">
            <Search size={13} className="shrink-0 text-muted" />
            <input
              value={tableQuery}
              onChange={(e) => setTableQuery(e.target.value)}
              placeholder={tx('Filter club...', 'กรองชื่อทีม...')}
              className="w-28 bg-transparent text-xs text-primary outline-none placeholder:text-muted sm:w-40"
              aria-label={tx('Filter club in table', 'กรองชื่อสโมสรในตาราง')}
            />
            {tableQuery && (
              <button
                type="button"
                onClick={() => setTableQuery('')}
                className="text-muted hover:text-primary"
                aria-label="Clear filter"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Matchweek Time-Travel Scrubber */}
        {mwLoading ? (
          <div className="flex items-center gap-3 border-b border-border bg-bg-secondary/40 px-4 py-2">
            <span
              className="h-3 w-3 animate-spin rounded-full border-2 border-border border-t-brand"
              aria-label="loading"
            />
          </div>
        ) : mwObj && mwObj.weeks.length > 1 ? (
          <div className="flex items-center gap-2.5 border-b border-border bg-bg-secondary/40 px-4 py-2">
            <span className="shrink-0 rounded-md bg-surface px-2 py-0.5 text-xs font-bold tabular-nums text-primary shadow-xs">
              {t('home.rounds.mw')} {activeWkNum}
            </span>
            <button
              type="button"
              disabled={currentWkIdx <= 0}
              onClick={() => {
                const prev = mwObj.weeks[currentWkIdx - 1]?.wk;
                if (prev != null) setMw(prev);
              }}
              aria-label="Previous matchweek"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-primary disabled:opacity-35 hover:bg-bg-secondary"
            >
              <ChevronLeft size={13} />
            </button>
            <input
              type="range"
              min={0}
              max={mwObj.weeks.length - 1}
              value={currentWkIdx}
              onChange={(e) => {
                const i = parseInt(e.target.value, 10);
                const w = mwObj.weeks[i]?.wk;
                if (w != null) setMw(i === mwObj.weeks.length - 1 ? null : w);
              }}
              style={{ accentColor: 'var(--brand)' }}
              className="h-1.5 w-full min-w-0 cursor-pointer"
              aria-label={t('home.rounds.mw')}
            />
            <button
              type="button"
              disabled={currentWkIdx >= mwObj.weeks.length - 1}
              onClick={() => {
                const nextIdx = currentWkIdx + 1;
                if (nextIdx >= mwObj.weeks.length - 1) setMw(null);
                else {
                  const nxt = mwObj.weeks[nextIdx]?.wk;
                  if (nxt != null) setMw(nxt);
                }
              }}
              aria-label="Next matchweek"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-primary disabled:opacity-35 hover:bg-bg-secondary"
            >
              <ChevronRight size={13} />
            </button>
            {mw != null && (
              <button
                type="button"
                onClick={() => setMw(null)}
                className="shrink-0 whitespace-nowrap rounded-md bg-brand px-2.5 py-1 text-[10px] font-bold text-white"
              >
                {t('home.latest')}
              </button>
            )}
          </div>
        ) : null}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-0 border-collapse sm:min-w-[820px]">
            <thead className="bg-surface-elevated/80">
              <tr>
                {(isXg
                  ? [
                      { k: 'rank', h: '#', tip: t('colTip.rank') },
                      { k: 'club', h: t('table.club'), tip: '' },
                      { k: 'mp', h: t('home.cols.pl'), tip: t('colTip.pl') },
                      { k: 'xg', h: 'xG', tip: t('colTip.xg') },
                      { k: 'xga', h: 'xGA', tip: t('colTip.xga') },
                      { k: 'xgd', h: 'xGD', tip: t('colTip.xgd') },
                      { k: 'xpts', h: t('home.cols.xpts'), tip: t('colTip.xpts') },
                      { k: 'pts', h: t('table.pts'), tip: t('colTip.pts') },
                      { k: 'ptsMinusXpts', h: t('home.cols.ptsMinusXpts'), tip: t('colTip.ptsMinusXpts') },
                    ]
                  : [
                      { k: 'rank', h: '#', tip: t('colTip.rank') },
                      { k: 'club', h: t('table.club'), tip: '' },
                      { k: 'mp', h: t('home.cols.pl'), tip: t('colTip.pl') },
                      { k: 'w', h: 'W', tip: t('colTip.w') },
                      { k: 'd', h: 'D', tip: t('colTip.d') },
                      { k: 'l', h: 'L', tip: t('colTip.l') },
                      { k: 'gf', h: 'GF', tip: t('colTip.gf') },
                      { k: 'ga', h: 'GA', tip: t('colTip.ga') },
                      { k: 'gd', h: 'GD', tip: t('colTip.gd') },
                      { k: 'pts', h: t('table.pts'), tip: t('colTip.pts') },
                      { k: null, h: t('matchLog.form'), tip: t('colTip.form') },
                      ...(hasNext
                        ? [{ k: null, h: t('home.cols.next'), tip: t('colTip.next') }]
                        : []),
                    ]
                ).map((c, i) => (
                  <th
                    key={i}
                    title={c.tip || undefined}
                    onClick={
                      c.k
                        ? () =>
                            setTbSort((prev) => ({
                              key: c.k!,
                              dir:
                                prev.key === c.k && prev.dir === 'asc'
                                  ? 'desc'
                                  : 'asc',
                            }))
                        : undefined
                    }
                    className={`border-b border-border px-1.5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted sm:px-3 ${
                      i < 2 ? 'text-left' : 'text-right'
                    } ${c.k ? 'cursor-pointer select-none hover:bg-bg-secondary' : ''} ${
                      !isXg && [3, 4, 5, 10].includes(i)
                        ? 'hidden sm:table-cell'
                        : isXg && [2, 5, 7, 8].includes(i)
                        ? 'hidden sm:table-cell'
                        : ''
                    }`}
                  >
                    <span
                      className={`inline-flex items-center gap-0.5 ${
                        i < 2 ? '' : 'justify-end'
                      }`}
                    >
                      {c.h}
                      {c.k &&
                        (tbSort.key === c.k ? (
                          tbSort.dir === 'asc' ? (
                            <ArrowUp size={11} />
                          ) : (
                            <ArrowDown size={11} />
                          )
                        ) : (
                          <ArrowUpDown size={11} className="opacity-30" />
                        ))}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => {
                const z: Zone = view === 'all' ? (zones[r.slug] ?? null) : null;
                const fm = (mwWeek ? mwWeek.form?.[r.slug] : data?.form?.[r.slug]) ?? [];
                const nx = !mwWeek ? data?.next?.[r.slug] : undefined;
                const isDefaultRankSort =
                  view === 'all' && tbSort.key === 'rank' && tbSort.dir === 'asc' && !tableQuery;
                const zoneDivider =
                  isDefaultRankSort && (r.rank === 4 || r.rank === 17)
                    ? 'border-b-2 border-dashed border-border'
                    : 'border-b border-border-light';

                return (
                  <tr
                    key={r.slug}
                    className={`${zoneDivider} transition-colors hover:bg-bg-secondary/70`}
                  >
                    <td className="px-0 py-2.5 text-sm tabular-nums text-muted">
                      <span className="flex items-center">
                        <span
                          className={`mr-1 inline-block h-6 w-1 rounded-r ${
                            z ? ZONE_STYLE[z] : ''
                          }`}
                        />
                        <span className="px-1 font-semibold sm:px-2">
                          {r.rank ?? '—'}
                        </span>
                      </span>
                    </td>
                    <td className="px-1.5 py-2.5 text-sm font-semibold sm:px-3">
                      <Link
                        href={`/${r.slug}/`}
                        className="inline-flex max-w-full items-center gap-2 whitespace-nowrap text-primary hover:text-brand"
                      >
                        <ClubCrest slug={r.slug} size={19} />
                        <span className="hidden sm:inline">{nameOf(r.slug)}</span>
                        <span className="max-w-[5rem] truncate sm:hidden">
                          {shortOf(r.slug)}
                        </span>
                      </Link>
                    </td>
                    {isXg ? (
                      <>
                        <td className="hidden px-1.5 py-2.5 text-right text-sm tabular-nums text-secondary sm:table-cell sm:px-3">
                          {r.mp}
                        </td>
                        <td className="px-1.5 py-2.5 text-right text-sm tabular-nums text-secondary sm:px-3">
                          {fmt(r.xg ?? null)}
                        </td>
                        <td className="px-1.5 py-2.5 text-right text-sm tabular-nums text-secondary sm:px-3">
                          {fmt(r.xga ?? null)}
                        </td>
                        <td
                          className={`hidden px-1.5 py-2.5 text-right text-sm font-medium tabular-nums sm:table-cell sm:px-3 ${
                            (r.xgd ?? 0) > 0
                              ? 'text-success'
                              : (r.xgd ?? 0) < 0
                              ? 'text-danger'
                              : 'text-secondary'
                          }`}
                        >
                          {signed(r.xgd ?? null)}
                        </td>
                        <td className="px-1.5 py-2.5 text-right text-sm font-semibold tabular-nums text-primary sm:px-3">
                          {fmt(r.xpts ?? null)}
                        </td>
                        <td className="hidden px-1.5 py-2.5 text-right text-sm font-bold tabular-nums text-primary sm:table-cell sm:px-3">
                          {r.pts ?? '—'}
                        </td>
                        <td
                          className={`hidden px-1.5 py-2.5 text-right text-sm font-bold tabular-nums sm:table-cell sm:px-3 ${
                            (r.ptsMinusXpts ?? 0) > 0.5
                              ? 'text-success'
                              : (r.ptsMinusXpts ?? 0) < -0.5
                              ? 'text-danger'
                              : 'text-muted'
                          }`}
                        >
                          {signed(r.ptsMinusXpts ?? null)}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-1.5 py-2.5 text-right text-sm tabular-nums text-secondary sm:px-3">
                          {r.mp}
                        </td>
                        <td className="hidden px-1.5 py-2.5 text-right text-sm tabular-nums text-secondary sm:table-cell sm:px-3">
                          {r.w}
                        </td>
                        <td className="hidden px-1.5 py-2.5 text-right text-sm tabular-nums text-secondary sm:table-cell sm:px-3">
                          {r.d}
                        </td>
                        <td className="hidden px-1.5 py-2.5 text-right text-sm tabular-nums text-secondary sm:table-cell sm:px-3">
                          {r.l}
                        </td>
                        <td className="px-1.5 py-2.5 text-right text-sm tabular-nums text-secondary sm:px-3">
                          {r.gf ?? '—'}
                        </td>
                        <td className="px-1.5 py-2.5 text-right text-sm tabular-nums text-secondary sm:px-3">
                          {r.ga ?? '—'}
                        </td>
                        <td
                          className={`px-1.5 py-2.5 text-right text-sm font-semibold tabular-nums sm:px-3 ${
                            (r.gd ?? 0) > 0
                              ? 'text-success'
                              : (r.gd ?? 0) < 0
                              ? 'text-danger'
                              : 'text-muted'
                          }`}
                        >
                          {(r.gd ?? 0) > 0 ? `+${r.gd}` : r.gd}
                        </td>
                        <td className="px-1.5 py-2.5 text-right font-display text-sm font-extrabold tabular-nums text-primary sm:px-3">
                          {r.pts}
                        </td>
                        <td className="hidden px-1.5 py-2.5 sm:table-cell sm:px-3">
                          <span className="flex justify-end gap-0.5 sm:gap-1">
                            {fm.map((m, i) => (
                              <span
                                key={i}
                                title={`vs ${nameOf(m.opponent)} ${m.gf}-${m.ga} (${m.venue}) ${formatDate(m.date)}`}
                                className={`inline-flex h-4 w-4 items-center justify-center rounded-sm text-[10px] font-bold ${
                                  m.result === 'W'
                                    ? 'bg-success/20 text-success'
                                    : m.result === 'D'
                                    ? 'bg-bg-secondary text-muted'
                                    : 'bg-danger/20 text-danger'
                                }`}
                              >
                                {m.result}
                              </span>
                            ))}
                          </span>
                        </td>
                        {hasNext && (
                          <td className="hidden px-1.5 py-2.5 text-right sm:table-cell sm:px-3">
                            {nx ? (
                              <span
                                title={`vs ${nameOf(nx.opponent)} · ${formatDate(nx.date)} (${nx.venue})`}
                                className="inline-flex items-center gap-1"
                              >
                                <ClubCrest slug={nx.opponent} size={17} />
                                <span className="text-[10px] font-bold text-muted">
                                  {nx.venue}
                                </span>
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {view === 'all' && (zoneLegend.length > 0 || zonesProjected) && (
          <div className="flex flex-wrap items-center gap-4 border-t border-border bg-bg-secondary/35 px-4 py-3 text-xs text-muted">
            {zoneLegend.map((z) => (
              <span key={z} className="flex items-center gap-1.5">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-xs ${ZONE_STYLE[z]}`}
                />
                {t(`home.zones.${z}`)}
              </span>
            ))}
            {zonesProjected && <span>· {t('home.zones.projected')}</span>}
          </div>
        )}
      </section>

      {/* ----------------------------------- Results & Fixtures Rounds */}
      {(mwWeek || data?.rounds?.last || data?.rounds?.next) && (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {(mwWeek
            ? [
                {
                  key: 'results',
                  title: t('home.rounds.results'),
                  wk: mwWeek.wk,
                  matches: mwWeek.matches,
                },
              ]
            : ([
                data?.rounds?.last
                  ? {
                      key: 'last',
                      title: t('home.rounds.results'),
                      wk: data.rounds.last.wk,
                      matches: data.rounds.last.matches,
                    }
                  : null,
                data?.rounds?.next
                  ? {
                      key: 'next',
                      title: t('home.rounds.fixtures'),
                      wk: data.rounds.next.wk,
                      matches: data.rounds.next.matches,
                    }
                  : null,
              ].filter(Boolean) as {
                key: string;
                title: string;
                wk: number;
                matches: LeagueRoundMatch[];
              }[])
          ).map((rd) => {
            const totalRoundGoals = rd.matches.reduce(
              (acc, m) => acc + scoreGoals(m.score),
              0,
            );
            const hasPlayed = rd.matches.some((m) => Boolean(m.score));
            return (
              <div
                key={rd.key}
                className="min-w-0 rounded-2xl border border-border bg-surface p-4 sm:p-5"
              >
                <div className="mb-3 flex items-center justify-between gap-2 border-b border-border pb-2.5">
                  <h3 className="font-display text-base font-bold text-primary">
                    {rd.title} · {t('home.rounds.mw')} {rd.wk}
                  </h3>
                  {hasPlayed ? (
                    <span className="rounded-full bg-bg-secondary px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-muted">
                      {totalRoundGoals} {tx('goals', 'ประตู')}
                    </span>
                  ) : (
                    <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[10px] font-bold uppercase text-brand">
                      {tx('BKK Time', 'เวลาไทย')}
                    </span>
                  )}
                </div>

                <div className="flex flex-col divide-y divide-border-light">
                  {rd.matches.map((m, i) => {
                    const bk = bkkKickoff(m.date, m.time);
                    const played = !!(m.matchId && m.score);
                    const pair = parseScorePair(m.score);
                    const homeWin = pair ? pair[0] > pair[1] : false;
                    const awayWin = pair ? pair[1] > pair[0] : false;

                    return (
                      <button
                        key={i}
                        type="button"
                        aria-expanded={
                          openFixture?.m === m ? true : played ? undefined : false
                        }
                        onClick={() =>
                          played
                            ? setOpenMatch({
                                mid: m.matchId!,
                                rows: roundToMatchRows(rd.matches, season, rd.wk),
                                index: i,
                              })
                            : setOpenFixture({ m, wk: rd.wk })
                        }
                        className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                      >
                        <span
                          className={`flex-1 truncate text-right ${
                            homeWin
                              ? 'font-bold text-primary'
                              : pair
                              ? 'text-secondary'
                              : 'font-medium text-primary'
                          }`}
                        >
                          {m.home ? nameOf(m.home) : '—'}
                        </span>
                        {m.home && <ClubCrest slug={m.home} size={17} />}
                        <span className="w-20 shrink-0 text-center tabular-nums">
                          <span
                            className={`inline-block rounded-md px-2 py-0.5 text-xs font-extrabold leading-tight ${
                              m.score
                                ? 'bg-bg-secondary text-primary'
                                : 'bg-brand-soft/60 text-brand'
                            }`}
                          >
                            {m.score ?? (bk?.time || m.time || '—')}
                          </span>
                          {m.date && (
                            <span className="mt-0.5 block text-[10px] leading-tight text-muted">
                              {bk?.date ?? formatDate(m.date)}
                            </span>
                          )}
                        </span>
                        {m.away && <ClubCrest slug={m.away} size={17} />}
                        <span
                          className={`flex-1 truncate ${
                            awayWin
                              ? 'font-bold text-primary'
                              : pair
                              ? 'text-secondary'
                              : 'font-medium text-primary'
                          }`}
                        >
                          {m.away ? nameOf(m.away) : '—'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* ----------------------------------------- Club Directory Hub */}
      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
              {tx('Club Dossiers · 2014–2027', 'ทำเนียบสโมสรพรีเมียร์ลีก · 2014–2027')}
            </p>
            <h2 className="mt-0.5 font-display text-lg font-bold text-primary sm:text-xl">
              {tx('Explore Every Club', 'เจาะลึกข้อมูลรายสโมสร')}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-border bg-bg-secondary p-0.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setDirMode('season')}
                className={`rounded-md px-2.5 py-1 transition-colors ${
                  dirMode === 'season'
                    ? 'bg-surface text-primary shadow-sm'
                    : 'text-muted hover:text-primary'
                }`}
              >
                {tx(`PL ${seasonShort(season)} (${seasonClubs.length})`, `ซีซัน ${seasonShort(season)} (${seasonClubs.length})`)}
              </button>
              <button
                type="button"
                onClick={() => setDirMode('all')}
                className={`rounded-md px-2.5 py-1 transition-colors ${
                  dirMode === 'all'
                    ? 'bg-surface text-primary shadow-sm'
                    : 'text-muted hover:text-primary'
                }`}
              >
                {tx(`All Era (${clubs.length})`, `ทั้งหมด (${clubs.length})`)}
              </button>
            </div>

            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-bg-secondary/60 px-2.5 py-1.5">
              <Search size={13} className="text-muted" />
              <input
                value={dirQuery}
                onChange={(e) => setDirQuery(e.target.value)}
                placeholder={tx('Search club...', 'ค้นหาสโมสร...')}
                className="w-28 bg-transparent text-xs text-primary outline-none placeholder:text-muted sm:w-36"
                aria-label={tx('Search club directory', 'ค้นหาทำเนียบสโมสร')}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {directoryClubs.map((c) => {
            const st = allViewMap.get(c.slug);
            return (
              <Link
                key={c.slug}
                href={`/${c.slug}/`}
                className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-bg-secondary/35 p-3.5 transition-all hover:border-primary/40 hover:bg-surface"
              >
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-[2.5px] opacity-65 transition-opacity group-hover:opacity-100"
                  style={{ background: c.color }}
                />
                <div className="flex items-center gap-2.5">
                  <ClubCrest slug={c.slug} size={26} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-primary group-hover:text-brand">
                      {th && c.nameTh ? c.nameTh : c.name}
                    </p>
                    <p className="text-[11px] text-muted">
                      {c.seasons.length} {t('home.plSeasons')}
                    </p>
                  </div>
                </div>

                {st ? (
                  <div className="mt-2.5 flex items-center justify-between border-t border-border/60 pt-2 text-[11px] tabular-nums">
                    <span className="font-bold text-primary">
                      #{st.rank} · {st.pts} {t('table.pts')}
                    </span>
                    <span className="text-muted">
                      {st.w}W-{st.d}D-{st.l}L
                    </span>
                  </div>
                ) : (
                  <div className="mt-2.5 flex items-center justify-between border-t border-border/60 pt-2 text-[11px] text-muted">
                    <span>
                      {tx('Latest PL:', 'ล่าสุด:')} {seasonShort(c.latest)}
                    </span>
                    <ArrowRight size={12} className="opacity-50 group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </section>

      {openFixture && (
        <FixtureCard
          m={openFixture.m}
          wk={openFixture.wk}
          nameOf={nameOf}
          formOf={formOf}
          rowOf={rowOf}
          onClose={() => setOpenFixture(null)}
        />
      )}

      {openMatch && (
        <MatchCard
          mid={openMatch.mid}
          rows={openMatch.rows}
          index={openMatch.index}
          onNavigate={(i) => {
            const dir = i > openMatch.index ? 1 : -1;
            let j = i;
            while (
              j >= 0 &&
              j < openMatch.rows.length &&
              !openMatch.rows[j].matchId
            )
              j += dir;
            const r = openMatch.rows[j];
            if (r?.matchId)
              setOpenMatch({ ...openMatch, mid: r.matchId, index: j });
          }}
          onClose={() => setOpenMatch(null)}
        />
      )}
    </main>
  );
}

/* ------------------------------------------------- fixture preview modal */
function FixtureCard({
  m,
  wk,
  nameOf,
  formOf,
  rowOf,
  onClose,
}: {
  m: LeagueRoundMatch;
  wk: number;
  nameOf: (slug: string) => string;
  formOf: (slug: string) => LeagueFormMatch[];
  rowOf: (slug: string) => LeagueTableViewRow | undefined;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const cardRef = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<Element | null>(null);

  useEffect(() => {
    lastFocus.current = document.activeElement;
    document.body.style.overflow = 'hidden';
    cardRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey, true);
      (lastFocus.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  const bk = bkkKickoff(m.date, m.time);
  const when = bk
    ? `${bk.date} · ${bk.time}`
    : `${formatDate(m.date)}${m.time ? ` · ${m.time}` : ''}`;

  const renderTeam = (slug: string | null) => {
    if (!slug) return null;
    const fm = formOf(slug);
    const rec = fm.reduce(
      (a, f) => {
        a[f.result] += 1;
        return a;
      },
      { W: 0, D: 0, L: 0 } as Record<'W' | 'D' | 'L', number>,
    );
    const row = rowOf(slug);
    return (
      <div className="flex min-w-0 flex-col items-center gap-2 text-center">
        <ClubCrest slug={slug} size={44} />
        <div className="text-sm font-bold text-primary">{nameOf(slug)}</div>
        {row && (
          <div className="text-xs text-muted">
            {t('home.fixture.rank')} {row.rank ?? '—'} · {row.pts ?? '—'}{' '}
            {t('table.pts')}
            {row.mp ? ` · ${row.mp} ${t('home.cols.pl')}` : ''}
          </div>
        )}
        {fm.length > 0 && (
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              {t('home.fixture.form')}
            </span>
            <span className="flex justify-center gap-0.5">
              {fm.map((f, i) => (
                <span
                  key={i}
                  title={`vs ${nameOf(f.opponent)} ${f.gf}-${f.ga}`}
                  className={`flex h-5 w-5 items-center justify-center rounded-sm text-[10px] font-bold ${
                    RESULT_STYLE[f.result] ?? 'bg-bg-secondary text-muted'
                  }`}
                >
                  {f.result}
                </span>
              ))}
            </span>
            <span className="text-[10px] tabular-nums text-muted">
              {rec.W}W {rec.D}D {rec.L}L
            </span>
          </div>
        )}
      </div>
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('home.fixture.title')}
        tabIndex={-1}
        className="matchcard-in flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-surface shadow-2xl outline-none sm:max-w-lg sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-center gap-2 bg-[#15345b] px-4 py-3 text-xs text-white sm:px-6">
          <span className="min-w-0 truncate">
            Premier League · {t('home.rounds.mw')} {wk}
          </span>
          <button
            type="button"
            aria-label={t('match.close')}
            onClick={onClose}
            className="ml-auto rounded-lg p-1.5 hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-col gap-5 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            {renderTeam(m.home)}
            <div className="flex flex-col items-center gap-1 text-center">
              {m.score ? (
                <span className="font-display text-3xl font-bold tabular-nums text-primary">
                  {m.score}
                </span>
              ) : (
                <span className="text-xs font-bold uppercase tracking-widest text-muted">
                  {t('matchLog.upcoming')}
                </span>
              )}
              <span className="text-xs tabular-nums text-muted">{when}</span>
            </div>
            {renderTeam(m.away)}
          </div>
          <div className="flex flex-col gap-1 border-t border-border pt-4 text-xs text-muted">
            {m.stadium && (
              <div>
                {t('home.fixture.stadium')}: {m.stadium}
              </div>
            )}
            {m.referee && (
              <div>
                {t('matchLog.referee')}: {m.referee}
              </div>
            )}
            {m.h2h && (
              <a
                href={m.h2h}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 font-medium text-brand hover:underline"
              >
                {t('home.fixture.h2h')} <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
