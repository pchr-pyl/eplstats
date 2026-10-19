'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/i18n/I18nContext';
import type {
  ClubIndexEntry,
  LeagueSeasonData,
  LeagueTableViewRow,
  Zone,
} from '@/lib/types';
import { fmt, signed } from '@/lib/format';
import { loadLeagueSeason, formatDate, LoadFail, LOAD_FAILED } from './matchlog-shared';

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

  const tableRows: LeagueTableViewRow[] = useMemo(() => {
    if (!data) return [];
    return (data.views[view] ?? []) as LeagueTableViewRow[];
  }, [data, view]);

  const hasNext = data ? Object.keys(data.next).length > 0 : false;
  const zones = data?.zones ?? {};
  const zoneLegend = useMemo(() => {
    const present = new Set(Object.values(zones).filter(Boolean));
    return (['cl', 'el', 'ecl', 'rel'] as const).filter((z) => present.has(z));
  }, [zones]);
  const seasonClubs = useMemo(
    () => (data ? data.views.all.map((r) => r.slug) : []),
    [data]
  );

  const summary = data?.summary;
  const cards: { key: string; label: string; slug?: string; value?: string; who?: string }[] = summary
    ? [
        { key: 'leader', label: t('home.summary.leader'), slug: summary.leader?.slug, value: `${summary.leader?.value ?? '—'} ${t('table.pts')}` },
        { key: 'bestAttack', label: t('home.summary.bestAttack'), slug: summary.bestAttack?.slug, value: `${summary.bestAttack?.value ?? '—'} GF` },
        { key: 'bestDefence', label: t('home.summary.bestDefence'), slug: summary.bestDefence?.slug, value: `${summary.bestDefence?.value ?? '—'} GA` },
        { key: 'mostXg', label: t('home.summary.mostXg'), slug: summary.mostXg?.slug, value: fmt(summary.mostXg?.value ?? null) },
        { key: 'overPerformer', label: t('home.summary.overPerformer'), slug: summary.overPerformer?.slug, value: signed(summary.overPerformer?.value ?? null) },
        { key: 'underPerformer', label: t('home.summary.underPerformer'), slug: summary.underPerformer?.slug, value: signed(summary.underPerformer?.value ?? null) },
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
                  ? 'bg-brand text-on-brand'
                  : 'text-muted hover:bg-bg-secondary hover:text-primary'
              }`}
            >
              {t(`home.tabs.${k}`)}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-0 sm:min-w-[820px] border-collapse">
            <thead className="bg-surface-elevated">
              <tr>
                {(
                  isXg
                    ? ['#', t('table.club'), t('home.cols.pl'), 'xG', 'xGA', 'xGD', t('home.cols.xpts'), t('table.pts'), t('home.cols.ptsMinusXpts')]
                    : ['#', t('table.club'), t('home.cols.pl'), 'W', 'D', 'L', t('home.cols.score'), 'GD', t('table.pts'), t('matchLog.form'), ...(hasNext ? [t('home.cols.next')] : [])]
                ).map((h, i) => (
                  <th
                    key={i}
                    className={`border-b border-border px-1.5 py-3 text-xs sm:px-3 font-semibold uppercase tracking-wider text-muted ${
                      i < 2 ? 'text-left' : 'text-right'
                    } ${
                      !isXg && [3,4,5,6,10].includes(i) ? 'hidden sm:table-cell' : isXg && [2,5,7,8].includes(i) ? 'hidden sm:table-cell' : ''
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r) => {
                const z: Zone = view === 'all' ? (zones[r.slug] ?? null) : null;
                const fm = data?.form?.[r.slug] ?? [];
                const nx = data?.next?.[r.slug];
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
                        <td className="hidden px-1.5 py-2.5 text-right sm:px-3 text-sm text-secondary sm:table-cell">
                          {r.gf}-{r.ga}
                        </td>
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
        {(view === 'all' && (zoneLegend.length > 0 || data?.zonesProjected)) && (
          <div className="flex flex-wrap items-center gap-4 border-t border-border px-4 py-3 text-xs text-muted">
            {zoneLegend.map((z) => (
              <span key={z} className="flex items-center gap-1.5">
                <span className={`inline-block h-3 w-3 rounded-sm ${ZONE_STYLE[z]}`} />
                {t(`home.zones.${z}`)}
              </span>
            ))}
            {data?.zonesProjected && <span>{t('home.zones.projected')}</span>}
          </div>
        )}
      </section>

      {(data?.rounds?.last || data?.rounds?.next) && (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {(['last', 'next'] as const).map((k) => {
            const rd = data?.rounds?.[k];
            if (!rd) return null;
            return (
              <div
                key={k}
                className="min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none"
              >
                <h3 className="mb-3 text-sm font-semibold text-primary">
                  {t(`home.rounds.${k === 'last' ? 'results' : 'fixtures'}`)} · {t('home.rounds.mw')} {rd.wk}
                </h3>
                <div className="flex flex-col divide-y divide-border-light">
                  {rd.matches.map((m, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5 text-sm">
                      <span className="flex-1 truncate text-right text-primary">
                        {m.home ? nameOf(m.home) : '—'}
                      </span>
                      {m.home && <ClubCrest slug={m.home} size={16} />}
                      <span className="w-14 shrink-0 text-center font-semibold text-primary">
                        {m.score ?? (m.time || '—')}
                      </span>
                      {m.away && <ClubCrest slug={m.away} size={16} />}
                      <span className="flex-1 truncate text-primary">
                        {m.away ? nameOf(m.away) : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
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
    </main>
  );
}
