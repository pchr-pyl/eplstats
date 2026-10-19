'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/i18n/I18nContext';
import type { ClubIndexEntry, LeagueData } from '@/lib/types';
import { fmt } from '@/lib/format';

export function LeagueHome({
  clubs,
  league,
}: {
  clubs: ClubIndexEntry[];
  league: LeagueData;
}) {
  const { t, lang } = useI18n();
  const seasons = useMemo(() => Object.keys(league).sort(), [league]);
  const [season, setSeason] = useState(() => seasons[seasons.length - 1] ?? '');
  const table = league[season] ?? [];

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
      </section>

      <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm dark:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead className="bg-surface-elevated">
              <tr>
                {[
                  '#',
                  t('table.club'),
                  t('table.mp'),
                  'W',
                  'D',
                  'L',
                  'GF',
                  'GA',
                  'GD',
                  t('table.pts'),
                  'xG',
                  'xGA',
                ].map((h, i) => (
                  <th
                    key={i}
                    className={`border-b border-border px-3 py-3 text-xs font-semibold uppercase tracking-wider text-muted ${
                      i < 2 ? 'text-left' : 'text-right'
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.map((r) => (
                <tr
                  key={r.slug}
                  className="border-b border-border-light transition-colors hover:bg-bg-secondary"
                >
                  <td className="px-3 py-2.5 text-sm text-muted">{r.rank ?? '—'}</td>
                  <td className="px-3 py-2.5 text-sm font-medium">
                    <Link
                      href={`/${r.slug}/`}
                      className="inline-flex items-center gap-2 text-primary hover:text-brand"
                    >
                      <span
                        aria-hidden
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ background: r.color }}
                      />
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-right text-sm text-secondary">{r.mp}</td>
                  <td className="px-3 py-2.5 text-right text-sm text-secondary">{r.w}</td>
                  <td className="px-3 py-2.5 text-right text-sm text-secondary">{r.d}</td>
                  <td className="px-3 py-2.5 text-right text-sm text-secondary">{r.l}</td>
                  <td className="px-3 py-2.5 text-right text-sm text-secondary">{r.gf}</td>
                  <td className="px-3 py-2.5 text-right text-sm text-secondary">{r.ga}</td>
                  <td className="px-3 py-2.5 text-right text-sm text-secondary">{r.gd}</td>
                  <td className="px-3 py-2.5 text-right text-sm font-semibold text-primary">
                    {r.pts}
                  </td>
                  <td className="px-3 py-2.5 text-right text-sm text-secondary">{fmt(r.xg)}</td>
                  <td className="px-3 py-2.5 text-right text-sm text-secondary">{fmt(r.xga)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {clubs.map((c) => (
            <Link
              key={c.slug}
              href={`/${c.slug}/`}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm transition-colors hover:border-brand dark:shadow-none"
            >
              <span
                aria-hidden
                className="inline-block h-5 w-5 shrink-0 rounded-full"
                style={{ background: c.color }}
              />
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


