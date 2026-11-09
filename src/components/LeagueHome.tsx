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
import { ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, X } from 'lucide-react';
import { loadLeagueSeason, loadLeagueMw, formatDate, LoadFail, LOAD_FAILED, RESULT_STYLE } from './matchlog-shared';
import { MatchCard } from './MatchCard';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function ClubCrest({ slug, size = 20, alt = '' }: { slug: string; size?: number; alt?: string }) {
  return (
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

function roundToMatchRows(matches: LeagueRoundMatch[], season: string, wk: number): MatchRow[] {
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
  const clubOf = useMemo(() => {
    const m = new Map<string, ClubIndexEntry>();
    for (const c of clubs) m.set(c.slug, c);
    return m;
  }, [clubs]);
  const nameOf = (slug: string) => {
    const c = clubOf.get(slug);
    return lang === 'th' && c?.nameTh ? c.nameTh : c?.name ?? slug;
  };
  const shortOf = (slug: string) => {
    const c = clubOf.get(slug);
    return lang === 'th' && c?.nameTh ? c.nameTh : (c?.shortName ?? c?.name ?? slug);
  };

  const [season, setSeason] = useState(initial?.season ?? seasons[seasons.length - 1] ?? '');
  const [view, setView] = useState<ViewKey>('all');
  const [extra, setExtra] = useState<
    Record<string, LeagueSeasonData | null | typeof LOAD_FAILED>
  >({});
  const [mw, setMw] = useState<number | null>(null);
  const [mwExtra, setMwExtra] = useState<
    Record<string, LeagueMwData | null | typeof LOAD_FAILED>
  >({});
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
  const data: LeagueSeasonData | null =
    loaded === LOAD_FAILED ? null : loaded;
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
    setMw(null);
  }, [season]);

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

  const [tbSort, setTbSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'rank', dir: 'asc' });
  const tableRows: LeagueTableViewRow[] = useMemo(() => {
    if (mwWeek) return (mwWeek.views[view] ?? []) as LeagueTableViewRow[];
    if (!data) return [];
    return (data.views[view] ?? []) as LeagueTableViewRow[];
  }, [data, view, mwWeek]);

  const sortedRows = useMemo(() => {
    const k = tbSort.key;
    const val = (r: LeagueTableViewRow): number | string | null =>
      k === 'club' ? nameOf(r.slug) : ((r as unknown as Record<string, unknown>)[k] as number | null);
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
    return [...tableRows].sort((a, b) => (tbSort.dir === 'asc' ? cmp(a, b) : -cmp(a, b)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableRows, tbSort, lang, clubs]);

  const hasNext = !mwWeek && data ? Object.keys(data.next).length > 0 : false;
  const allView = mwWeek ? mwWeek.views.all : (data?.views.all ?? []);
  const formMap = mwWeek ? mwWeek.form : (data?.form ?? {});
  const rowOf = (slug: string) => allView.find((r) => r.slug === slug);
  const formOf = (slug: string): LeagueFormMatch[] => formMap[slug] ?? [];
  const zones = mwWeek ? mwWeek.zones : (data?.zones ?? {});
  const zonesProjected = mwWeek ? true : (data?.zonesProjected ?? false);
  const zoneLegend = useMemo(() => {
    const present = new Set(Object.values(zones).filter(Boolean));
    return (['cl', 'el', 'ecl', 'rel'] as const).filter((z) => present.has(z));
  }, [zones]);
  const seasonClubs = useMemo(
    () => (data ? data.views.all.map((r) => r.slug) : []),
    [data]
  );

  // Keep the season table order when clubs share the highest clean-sheet count.
  const mostCleanSheets = data?.views.all
    .filter((r) => r.mp > 0 && r.cs != null)
    .reduce<(typeof data.views.all)[number] | null>((best, r) => !best || r.cs > best.cs ? r : best, null);
  const summary = data?.summary;
  const cards: { key: string; label: string; slug?: string; value?: string; who?: string }[] = summary
    ? [
        { key: 'leader', label: t('home.summary.leader'), slug: summary.leader?.slug, value: `${summary.leader?.value ?? '—'} ${t('table.pts')}` },
        { key: 'bestAttack', label: t('home.summary.bestAttack'), slug: summary.bestAttack?.slug, value: `${summary.bestAttack?.value ?? '—'} GF` },
        { key: 'bestDefence', label: t('home.summary.bestDefence'), slug: summary.bestDefence?.slug, value: `${summary.bestDefence?.value ?? '—'} GA` },
        { key: 'mostXg', label: t('home.summary.mostXg'), slug: summary.mostXg?.slug, value: fmt(summary.mostXg?.value ?? null) },
        { key: 'overPerformer', label: t('home.summary.overPerformer'), slug: summary.overPerformer?.slug, value: signed(summary.overPerformer?.value ?? null) },
        { key: 'underPerformer', label: t('home.summary.underPerformer'), slug: summary.underPerformer?.slug, value: signed(summary.underPerformer?.value ?? null) },
        { key: 'mostCleanSheets', label: t('home.summary.mostCleanSheets'), slug: mostCleanSheets?.slug, value: `${mostCleanSheets?.cs ?? '—'} ${t('home.summary.cleanSheetUnit')}` },
        { key: 'topScorer', label: t('home.summary.topScorer'), slug: summary.topScorer?.slug, value: `${summary.topScorer?.goals ?? '—'}`, who: summary.topScorer?.player },
      ]
    : [];

  const isXg = view === 'xg';

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-6 py-8 lg:px-10">
      <section className="flex flex-wrap items-center gap-3">
        <label htmlFor="league-season" className="text-sm text-secondary">
          {t('table.season')}
        </label>
        <select
          id="league-season"
          value={season}
          onChange={(e) => setSeason(e.target.value)}
          className="h-9 rounded-full border border-border bg-surface px-3 text-sm text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        >
          {seasons.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {loading && (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-border border-t-brand" aria-label="loading" />
        )}
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
      </section>

      {cards.length > 0 && (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {cards.map((c) => (
            <Link
              key={c.key}
              href={c.slug ? `/${c.slug}/` : '#'}
              className="flex min-w-0 flex-col gap-1 rounded-2xl border border-border bg-surface p-3 shadow-sm transition-colors hover:border-brand dark:shadow-none"
            >
              <span className="flex items-center gap-2">
                {c.slug && <ClubCrest slug={c.slug} size={18} />}
                <span className="text-xs font-medium text-muted">{c.label}</span>
              </span>
              <span className="text-sm font-medium leading-snug text-primary">
                {c.key === 'topScorer' ? c.who ?? '—' : c.slug ? nameOf(c.slug) : '—'}
              </span>
              <span className="font-display text-lg font-bold text-primary">{c.value}</span>
            </Link>
          ))}
        </section>
      )}

      <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm dark:shadow-none">
        <div className="flex gap-1 overflow-x-auto border-b border-border bg-surface-elevated px-3 py-2">
          {(['all', 'home', 'away', 'last5', 'xg'] as ViewKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setView(k)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                view === k
                  ? 'bg-brand text-surface'
                  : 'text-muted hover:bg-bg-secondary hover:text-primary'
              }`}
            >
              {t(`home.tabs.${k}`)}
            </button>
          ))}
        </div>
        {mwLoading ? (
          <div className="flex items-center gap-3 border-b border-border bg-surface-elevated px-3 py-2">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-border border-t-brand" aria-label="loading" />
          </div>
        ) : mwObj && mwObj.weeks.length > 1 ? (
          <div className="flex items-center gap-3 border-b border-border bg-surface-elevated px-3 py-2">
            <span className="text-xs font-medium text-muted">
              {t('home.rounds.mw')} {(mw != null
                ? (mwObj.weeks.find((w) => w.wk === mw)?.wk ?? mwObj.weeks[mwObj.weeks.length - 1].wk)
                : mwObj.weeks[mwObj.weeks.length - 1].wk)}
            </span>
            <input
              type="range"
              min={0}
              max={mwObj.weeks.length - 1}
              value={mw != null ? (mwObj.weeks.findIndex((w) => w.wk === mw)) : mwObj.weeks.length - 1}
              onChange={(e) => {
                const i = parseInt(e.target.value, 10);
                const w = mwObj.weeks[i]?.wk;
                if (w != null) setMw(w);
              }}
              style={{ accentColor: 'var(--brand)' }}
              className="h-2 w-full min-w-0"
              aria-label={t('home.rounds.mw')}
            />
            {mw != null && (
              <button
                type="button"
                onClick={() => setMw(null)}
                className="whitespace-nowrap rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-medium text-surface"
              >
                {t('home.latest')}
              </button>
            )}
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-0 sm:min-w-[820px] border-collapse">
            <thead className="bg-surface-elevated">
              <tr>
                {(
                  isXg
                    ? ([
                        { k: 'rank', h: '#', tip: t('colTip.rank') },
                        { k: 'club', h: t('table.club'), tip: '' },
                        { k: 'mp', h: t('home.cols.pl'), tip: t('colTip.pl') },
                        { k: 'xg', h: 'xG', tip: t('colTip.xg') },
                        { k: 'xga', h: 'xGA', tip: t('colTip.xga') },
                        { k: 'xgd', h: 'xGD', tip: t('colTip.xgd') },
                        { k: 'xpts', h: t('home.cols.xpts'), tip: t('colTip.xpts') },
                        { k: 'pts', h: t('table.pts'), tip: t('colTip.pts') },
                        { k: 'ptsMinusXpts', h: t('home.cols.ptsMinusXpts'), tip: t('colTip.ptsMinusXpts') },
                      ])
                    : ([
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
                        ...(hasNext ? [{ k: null, h: t('home.cols.next'), tip: t('colTip.next') }] : []),
                      ])
                ).map((c, i) => (
                  <th
                    key={i}
                    title={c.tip || undefined}
                    onClick={c.k ? () => setTbSort((prev) => ({ key: c.k!, dir: prev.key === c.k && prev.dir === 'asc' ? 'desc' : 'asc' })) : undefined}
                    className={`border-b border-border px-1.5 py-3 text-xs sm:px-3 font-semibold uppercase tracking-wider text-muted ${
                      i < 2 ? 'text-left' : 'text-right'
                    } ${c.k ? 'cursor-pointer select-none hover:bg-bg-secondary' : ''} ${
                      !isXg && [3,4,5,10].includes(i) ? 'hidden sm:table-cell' : isXg && [2,5,7,8].includes(i) ? 'hidden sm:table-cell' : ''
                    }`}
                  >
                    <span className={`inline-flex items-center gap-0.5 ${i < 2 ? '' : 'justify-end'}`}>
                      {c.h}
                      {c.k && (tbSort.key === c.k ? (tbSort.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} className="opacity-30" />)}
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
                return (
                  <tr
                    key={r.slug}
                    className="border-b border-border-light transition-colors hover:bg-bg-secondary"
                  >
                    <td className="px-0 py-2.5 text-sm text-muted">
                      <span className="flex items-center">
                        <span
                          className={`mr-1 inline-block h-6 w-1 rounded-r ${z ? ZONE_STYLE[z] : ''}`}
                        />
                        <span className="px-1 sm:px-2">{r.rank ?? '—'}</span>
                      </span>
                    </td>
                    <td className="px-1.5 py-2.5 text-sm font-medium sm:px-3">
                      <Link
                        href={`/${r.slug}/`}
                        className="inline-flex max-w-full items-center gap-2 whitespace-nowrap text-primary hover:text-brand"
                      >
                        <ClubCrest slug={r.slug} size={18} />
                        <span className="hidden sm:inline">{nameOf(r.slug)}</span>
                        <span className="max-w-[5rem] truncate sm:hidden">{shortOf(r.slug)}</span>
                      </Link>
                    </td>
                    {isXg ? (
                      <>
                        <td className="hidden px-1.5 py-2.5 text-right sm:px-3 text-sm text-secondary sm:table-cell">{r.mp}</td>
                        <td className="px-1.5 py-2.5 text-right sm:px-3 text-sm text-secondary">{fmt(r.xg ?? null)}</td>
                        <td className="px-1.5 py-2.5 text-right sm:px-3 text-sm text-secondary">{fmt(r.xga ?? null)}</td>
                        <td className="hidden px-1.5 py-2.5 text-right sm:px-3 text-sm text-secondary sm:table-cell">{fmt(r.xgd ?? null)}</td>
                        <td className="px-1.5 py-2.5 text-right sm:px-3 text-sm text-secondary">{fmt(r.xpts ?? null)}</td>
                        <td className="hidden px-1.5 py-2.5 text-right sm:px-3 text-sm font-semibold text-primary sm:table-cell">{r.pts ?? '—'}</td>
                        <td className="hidden px-1.5 py-2.5 text-right sm:px-3 text-sm text-secondary sm:table-cell">{fmt(r.ptsMinusXpts ?? null)}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-1.5 py-2.5 text-right sm:px-3 text-sm text-secondary">{r.mp}</td>
                        <td className="hidden px-1.5 py-2.5 text-right sm:px-3 text-sm text-secondary sm:table-cell">{r.w}</td>
                        <td className="hidden px-1.5 py-2.5 text-right sm:px-3 text-sm text-secondary sm:table-cell">{r.d}</td>
                        <td className="hidden px-1.5 py-2.5 text-right sm:px-3 text-sm text-secondary sm:table-cell">{r.l}</td>
                        <td className="px-1.5 py-2.5 text-right sm:px-3 text-sm text-secondary">{r.gf ?? '—'}</td>
                        <td className="px-1.5 py-2.5 text-right sm:px-3 text-sm text-secondary">{r.ga ?? '—'}</td>
                        <td className="px-1.5 py-2.5 text-right sm:px-3 text-sm text-secondary">
                          {(r.gd ?? 0) > 0 ? `+${r.gd}` : r.gd}
                        </td>
                        <td className="px-1.5 py-2.5 text-right sm:px-3 text-sm font-semibold text-primary">{r.pts}</td>
                        <td className="px-1.5 py-2.5 sm:px-3">
                          <span className="flex justify-end gap-0.5 sm:gap-1">
                            {fm.map((m, i) => (
                              <span
                                key={i}
                                title={`vs ${nameOf(m.opponent)} ${m.gf}-${m.ga} (${m.venue}) ${formatDate(m.date)}`}
                                className={`${i < fm.length - 3 ? 'hidden sm:inline-flex' : 'inline-flex'} h-4 w-4 items-center justify-center rounded-sm text-[10px] font-bold ${
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
                          <td className="hidden px-1.5 py-2.5 text-right sm:px-3 sm:table-cell">
                            {nx ? (
                              <span title={`${formatDate(nx.date)} (${nx.venue})`} className="inline-flex">
                                <ClubCrest slug={nx.opponent} size={16} />
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
        {(view === 'all' && (zoneLegend.length > 0 || zonesProjected)) && (
          <div className="flex flex-wrap items-center gap-4 border-t border-border px-4 py-3 text-xs text-muted">
            {zoneLegend.map((z) => (
              <span key={z} className="flex items-center gap-1.5">
                <span className={`inline-block h-3 w-3 rounded-sm ${ZONE_STYLE[z]}`} />
                {t(`home.zones.${z}`)}
              </span>
            ))}
            {zonesProjected && <span>{t('home.zones.projected')}</span>}
          </div>
        )}
      </section>

      {(mwWeek || data?.rounds?.last || data?.rounds?.next) && (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {(
            mwWeek
              ? [{ key: 'results', title: t('home.rounds.results'), wk: mwWeek.wk, matches: mwWeek.matches }]
              : ([
                  data?.rounds?.last ? { key: 'last', title: t('home.rounds.results'), wk: data.rounds.last.wk, matches: data.rounds.last.matches } : null,
                  data?.rounds?.next ? { key: 'next', title: t('home.rounds.fixtures'), wk: data.rounds.next.wk, matches: data.rounds.next.matches } : null,
                ].filter(Boolean) as { key: string; title: string; wk: number; matches: import('@/lib/types').LeagueRoundMatch[] }[])
          ).map((rd) => (
            <div
              key={rd.key}
              className="min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none"
            >
              <h3 className="mb-3 text-sm font-semibold text-primary">
                {rd.title} · {t('home.rounds.mw')} {rd.wk}
              </h3>
              <div className="flex flex-col divide-y divide-border-light">
                {rd.matches.map((m, i) => {
                  const bk = bkkKickoff(m.date, m.time);
                  const played = !!(m.matchId && m.score);
                  const inner = (
                    <>
                      <span className="flex-1 truncate text-right text-primary">
                        {m.home ? nameOf(m.home) : '—'}
                      </span>
                      {m.home && <ClubCrest slug={m.home} size={16} />}
                      <span className="w-20 shrink-0 text-center">
                        <span className="block font-semibold leading-tight text-primary">
                          {m.score ?? (bk?.time || m.time || '—')}
                        </span>
                        {m.date && (
                          <span className="block text-[10px] leading-tight text-muted">
                            {bk?.date ?? formatDate(m.date)}
                          </span>
                        )}
                      </span>
                      {m.away && <ClubCrest slug={m.away} size={16} />}
                      <span className="flex-1 truncate text-primary">
                        {m.away ? nameOf(m.away) : '—'}
                      </span>
                    </>
                  );
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-expanded={openFixture?.m === m ? true : played ? undefined : false}
                      onClick={() =>
                        played
                          ? setOpenMatch({
                              mid: m.matchId!,
                              rows: roundToMatchRows(rd.matches, season, rd.wk),
                              index: i,
                            })
                          : setOpenFixture({ m, wk: rd.wk })
                      }
                      className="-mx-4 flex w-[calc(100%+2rem)] items-center gap-2 px-4 py-1.5 text-left text-sm transition-colors hover:bg-bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                    >
                      {inner}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {clubs
            .filter((c) => !data || seasonClubs.includes(c.slug))
            .map((c) => (
              <Link
                key={c.slug}
                href={`/${c.slug}/`}
                className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm transition-colors hover:border-brand dark:shadow-none"
              >
                <ClubCrest slug={c.slug} size={24} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-primary">
                    {lang === 'th' && c.nameTh ? c.nameTh : c.name}
                  </span>
                  <span className="text-xs text-muted">
                    {c.seasons.length} {t('home.plSeasons')}
                  </span>
                </span>
              </Link>
            ))}
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

  const teamPanel = (slug: string | null) => {
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
            {t('home.fixture.rank')} {row.rank ?? '—'} · {row.pts ?? '—'} {t('table.pts')}
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
                  className={`flex h-5 w-5 items-center justify-center rounded-sm text-[10px] font-bold ${RESULT_STYLE[f.result] ?? 'bg-bg-secondary text-muted'}`}
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
            {teamPanel(m.home)}
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
            {teamPanel(m.away)}
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
