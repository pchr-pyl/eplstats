'use client';

import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useI18n } from '@/i18n/I18nContext';
import type { ClubIndexEntry, LeagueData } from '@/lib/types';
import { fmt } from '@/lib/format';
import { seasonShort } from '@/lib/stats';

const MAX_CLUBS = 4;
const DEFAULTS = ['man-utd', 'arsenal'];

interface Row {
  season: string;
  [slug: string]: string | number | null;
}

export function ClubsCompare({
  clubs,
  league,
}: {
  clubs: ClubIndexEntry[];
  league: LeagueData;
}) {
  const { t, lang } = useI18n();
  const [picked, setPicked] = useState<string[]>(() =>
    DEFAULTS.filter((s) => clubs.some((c) => c.slug === s)),
  );
  const seasons = useMemo(() => Object.keys(league).sort(), [league]);
  const [season, setSeason] = useState(() => seasons[seasons.length - 1] ?? '');

  const name = (slug: string) => {
    const c = clubs.find((x) => x.slug === slug);
    return lang === 'th' && c?.nameTh ? c.nameTh : (c?.name ?? slug);
  };
  const color = (slug: string) =>
    clubs.find((x) => x.slug === slug)?.color ?? '#888888';

  const toggle = (slug: string) =>
    setPicked((prev) =>
      prev.includes(slug)
        ? prev.filter((s) => s !== slug)
        : prev.length < MAX_CLUBS
          ? [...prev, slug]
          : prev,
    );

  const series = (field: 'rank' | 'pts' | 'gd' | 'xg' | 'xga'): Row[] =>
    seasons.map((s) => {
      const row: Row = { season: s };
      for (const slug of picked) {
        const r = (league[s] ?? []).find((x) => x.slug === slug);
        row[slug] = r ? r[field] : null;
      }
      return row;
    });

  const chart = (
    title: string,
    field: 'rank' | 'pts' | 'gd' | 'xg' | 'xga',
    reversed = false,
  ) => (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none">
      <h3 className="mb-2 font-display text-lg font-semibold text-primary">
        {title}
      </h3>
      <div className="h-56 w-full">
        <ResponsiveContainer>
          <LineChart data={series(field)} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border-light)" vertical={false} />
            <XAxis
              dataKey="season"
              tickFormatter={(v: string) => seasonShort(v)}
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            />
            <YAxis
              reversed={reversed}
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                fontSize: 13,
              }}
              labelStyle={{ color: 'var(--text)' }}
              formatter={(
                v: number | string | readonly (string | number)[] | undefined,
              ) =>
                typeof v === 'number' && !Number.isInteger(v)
                  ? fmt(v)
                  : typeof v === 'string' || typeof v === 'number'
                    ? v
                    : '—'
              }
            />
            <Legend formatter={(v: string) => name(v)} />
            {picked.map((slug) => (
              <Line
                key={slug}
                dataKey={slug}
                stroke={color(slug)}
                strokeWidth={2}
                dot={false}
                connectNulls
                type="monotone"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );

  const sideRows = league[season] ?? [];

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-6 py-8 lg:px-10">
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold text-primary">
          {t('clubCompare.compareTitle')}
        </h2>
        <p className="text-sm text-muted">{t('clubCompare.pickClubs')}</p>
        <div className="flex flex-wrap gap-2">
          {clubs.map((c) => {
            const active = picked.includes(c.slug);
            return (
              <button
                key={c.slug}
                type="button"
                onClick={() => toggle(c.slug)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${
                  active
                    ? 'border-brand bg-brand-soft text-brand'
                    : 'border-border bg-surface text-secondary hover:bg-bg-secondary'
                }`}
                aria-pressed={active}
              >
                <span
                  aria-hidden
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: c.color }}
                />
                {lang === 'th' && c.nameTh ? c.nameTh : c.name}
              </button>
            );
          })}
        </div>
      </section>

      {picked.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {chart(t('clubCompare.rank'), 'rank', true)}
          {chart(t('table.pts'), 'pts')}
          {chart(t('table.gd'), 'gd')}
          {chart('xG / xGA', 'xg')}
        </div>
      )}

      <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm dark:shadow-none">
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          <h3 className="font-display text-lg font-semibold text-primary">
            {t('home.leagueTable')}
          </h3>
          <select
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className="h-8 rounded-full border border-border bg-surface px-3 text-sm text-primary"
          >
            {seasons.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead className="bg-surface-elevated">
              <tr>
                {[t('table.club'), 'MP', 'W', 'D', 'L', 'GF', 'GA', 'GD', t('table.pts'), 'xG', 'xGA'].map(
                  (h, i) => (
                    <th
                      key={i}
                      className={`border-b border-border px-3 py-3 text-xs font-semibold uppercase tracking-wider text-muted ${
                        i === 0 ? 'text-left' : 'text-right'
                      }`}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {picked.map((slug) => {
                const r = sideRows.find((x) => x.slug === slug);
                return (
                  <tr key={slug} className="border-b border-border-light">
                    <td className="px-3 py-2.5 text-sm font-medium text-primary">
                      <span className="inline-flex items-center gap-2">
                        <span
                          aria-hidden
                          className="inline-block h-3 w-3 rounded-full"
                          style={{ background: color(slug) }}
                        />
                        {name(slug)}
                        <span className="text-xs text-muted">
                          {r?.rank != null ? `#${r.rank}` : '—'}
                        </span>
                      </span>
                    </td>
                    {r ? (
                      <>
                        <td className="px-3 py-2.5 text-right text-sm text-secondary">{r.mp}</td>
                        <td className="px-3 py-2.5 text-right text-sm text-secondary">{r.w}</td>
                        <td className="px-3 py-2.5 text-right text-sm text-secondary">{r.d}</td>
                        <td className="px-3 py-2.5 text-right text-sm text-secondary">{r.l}</td>
                        <td className="px-3 py-2.5 text-right text-sm text-secondary">{r.gf}</td>
                        <td className="px-3 py-2.5 text-right text-sm text-secondary">{r.ga}</td>
                        <td className="px-3 py-2.5 text-right text-sm text-secondary">{r.gd}</td>
                        <td className="px-3 py-2.5 text-right text-sm font-semibold text-primary">{r.pts}</td>
                        <td className="px-3 py-2.5 text-right text-sm text-secondary">{fmt(r.xg)}</td>
                        <td className="px-3 py-2.5 text-right text-sm text-secondary">{fmt(r.xga)}</td>
                      </>
                    ) : (
                      <td colSpan={10} className="px-3 py-2.5 text-right text-sm text-muted">
                        —
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
