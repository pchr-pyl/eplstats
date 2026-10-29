'use client';

import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LabelList,
} from 'recharts';
import { LabelsBtn } from './LabelsBtn';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import type { ClubIndexEntry, LeagueData, SquadCompareData } from '@/lib/types';
import { fmt, gbp } from '@/lib/format';
import { seasonShort } from '@/lib/stats';

const MAX_CLUBS = 8;
const DEFAULTS = ['man-utd', 'arsenal'];

interface Row {
  season: string;
  [slug: string]: string | number | null;
}

export function ClubsCompare({
  clubs,
  league,
  squad,
}: {
  clubs: ClubIndexEntry[];
  league: LeagueData;
  squad: SquadCompareData;
}) {
  const { t, lang } = useI18n();
  const [picked, setPicked] = useState<string[]>(() =>
    DEFAULTS.filter((s) => clubs.some((c) => c.slug === s)),
  );
  const seasons = useMemo(() => Object.keys(league).sort(), [league]);
  const [season, setSeason] = useState(() => seasons[seasons.length - 1] ?? '');
  const [perMatch, setPerMatch] = useState(false);
  const [lgSort, setLgSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'pts', dir: 'desc' });
  const [sqSort, setSqSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'weeklyBill', dir: 'desc' });
  const [lbl, setLbl] = useState<Record<string, boolean>>({});
  const lblOn = (k: string) => !!lbl[k];
  const toggleLbl = (k: string) => setLbl((p) => ({ ...p, [k]: !p[k] }));
  const numFmt = (v: unknown) => fmt(Number(v));

  const clickSort = (
    cur: { key: string; dir: 'asc' | 'desc' },
    set: typeof setLgSort,
    key: string,
  ) =>
    set({
      key,
      dir: cur.key === key && cur.dir === 'desc' ? 'asc' : 'desc',
    });

  const arrow = (cur: { key: string; dir: 'asc' | 'desc' }, key: string) =>
    cur.key === key ? (
      cur.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
    ) : (
      <ArrowUpDown size={12} className="opacity-30" />
    );

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
        const v = r ? r[field] : null;
        row[slug] =
          perMatch && field !== 'rank' && typeof v === 'number' && r?.mp
            ? v / r.mp
            : v;
      }
      return row;
    });

  const chart = (
    title: string,
    field: 'rank' | 'pts' | 'gd' | 'xg' | 'xga',
    reversed = false,
  ) => (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-display text-lg font-semibold text-primary">
          {title}
        </h3>
        <LabelsBtn on={lblOn(field)} onClick={() => toggleLbl(field)} />
      </div>
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
              >
                {lblOn(field) && (
                  <LabelList
                    dataKey={slug}
                    position="top"
                    fontSize={9}
                    fill={color(slug)}
                    formatter={numFmt}
                  />
                )}
              </Line>
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );

  const sideRows = league[season] ?? [];

  const leagueRows = useMemo(() => {
    const rs = picked.map((slug) => {
      const found = sideRows.find((x) => x.slug === slug);
      return (
        found ?? {
          slug, name: slug, color: '#888888', mp: null, w: null, d: null,
          l: null, gf: null, ga: null, gd: null, pts: null, xg: null,
          xga: null, xgd: null, cs: null, rank: null,
        }
      );
    });
    const k = lgSort.key;
    const val = (r: (typeof rs)[number]): number | string | null =>
      k === 'club' ? name(r.slug) : ((r as Record<string, unknown>)[k] as number | null);
    const cmp = (a: (typeof rs)[number], b: (typeof rs)[number]) => {
      const av = val(a);
      const bv = val(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv));
    };
    return [...rs].sort((a, b) => (lgSort.dir === 'asc' ? cmp(a, b) : -cmp(a, b)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, sideRows, lgSort, lang, clubs]);

  const squadRows = useMemo(
    () => {
      const rows = picked.map((slug) => {
        const c = clubs.find((x) => x.slug === slug);
        const s = squad[season]?.[slug];
        return {
          slug,
          name: c?.shortName ?? c?.name ?? slug,
          color: c?.color ?? '#888888',
          players: s?.players ?? null,
          avgAge: s?.avgAge ?? null,
          weeklyBill: s?.weeklyBill ?? null,
          weeklyBillM: s?.weeklyBill != null ? s.weeklyBill / 1e6 : null,
          yearlyBill: s?.yearlyBill ?? null,
          topEarner: s?.topEarner ?? null,
        };
      });
      const k = sqSort.key;
      const val = (r: (typeof rows)[number]): number | string | null =>
        k === 'club' ? r.name : ((r as Record<string, unknown>)[k] as number | string | null);
      const cmp = (a: (typeof rows)[number], b: (typeof rows)[number]) => {
        const av = val(a);
        const bv = val(b);
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv));
      };
      return rows.sort((a, b) => (sqSort.dir === 'asc' ? cmp(a, b) : -cmp(a, b)));
    },
    [picked, season, squad, clubs, sqSort],
  );

  const squadBar = (
    title: string,
    field: 'avgAge' | 'weeklyBill',
    money = false,
  ) => (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="font-display text-sm font-semibold text-primary">
          {title}
        </h4>
        <LabelsBtn on={lblOn(field)} onClick={() => toggleLbl(field)} />
      </div>
      <div className="h-48 w-full">
        <ResponsiveContainer>
          <BarChart
            data={squadRows}
            margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
          >
            <CartesianGrid stroke="var(--border-light)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              tickFormatter={(v: number) =>
                money ? `£${fmt(v)}M` : fmt(v, 2)
              }
              width={48}
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
                typeof v === 'number'
                  ? money
                    ? `£${fmt(v, 2)}M`
                    : fmt(v, 2)
                  : '—'
              }
            />
            <Bar
              dataKey={money ? 'weeklyBillM' : field}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            >
              {lblOn(field) && (
                <LabelList
                  dataKey={money ? 'weeklyBillM' : field}
                  position="top"
                  fontSize={10}
                  fill="var(--text-muted)"
                  formatter={(v: unknown) =>
                    money ? `£${fmt(Number(v))}M` : fmt(Number(v))
                  }
                />
              )}
              {squadRows.map((r) => (
                <Cell key={r.slug} fill={r.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

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
                <img
                  aria-hidden
                  src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/logos/${c.slug}.png`}
                  width={16}
                  height={16}
                  alt=""
                  className="inline-block h-4 w-4 object-contain"
                />
                {lang === 'th' && c.nameTh ? c.nameTh : c.name}
              </button>
            );
          })}
        </div>
      </section>

      {picked.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted">{t('clubCompare.perMatchNote')}</p>
            <div className="flex rounded-lg border border-border bg-surface-elevated p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setPerMatch(false)}
                className={`rounded-md px-3 py-1 transition ${
                  !perMatch ? 'bg-brand text-surface' : 'text-muted hover:text-primary'
                }`}
              >
                {t('defense.totals')}
              </button>
              <button
                type="button"
                onClick={() => setPerMatch(true)}
                className={`rounded-md px-3 py-1 transition ${
                  perMatch ? 'bg-brand text-surface' : 'text-muted hover:text-primary'
                }`}
              >
                {t('defense.perMatch')}
              </button>
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {chart(t('clubCompare.rank'), 'rank', true)}
            {chart(`${t('table.pts')}${perMatch ? '/MP' : ''}`, 'pts')}
            {chart(`${t('table.gd')}${perMatch ? '/MP' : ''}`, 'gd')}
            {chart(`xG${perMatch ? '/MP' : ''}`, 'xg')}
          </div>
        </>
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
                {([
                  { key: 'club', label: t('table.club'), tip: '' },
                  { key: 'mp', label: 'MP', tip: t('colTip.mp') },
                  { key: 'w', label: 'W', tip: t('colTip.w') },
                  { key: 'd', label: 'D', tip: t('colTip.d') },
                  { key: 'l', label: 'L', tip: t('colTip.l') },
                  { key: 'gf', label: 'GF', tip: t('colTip.gf') },
                  { key: 'ga', label: 'GA', tip: t('colTip.ga') },
                  { key: 'gd', label: 'GD', tip: t('colTip.gd') },
                  { key: 'pts', label: t('table.pts'), tip: t('colTip.pts') },
                  { key: 'xg', label: 'xG', tip: t('colTip.xg') },
                  { key: 'xga', label: 'xGA', tip: t('colTip.xga') },
                ]).map((c, i) => (
                  <th
                    key={c.key}
                    title={c.tip || undefined}
                    onClick={() => clickSort(lgSort, setLgSort, c.key)}
                    className={`cursor-pointer border-b border-border px-3 py-3 text-xs font-semibold uppercase tracking-wider text-muted transition-colors hover:bg-bg-secondary ${
                      i === 0 ? 'text-left' : 'text-right'
                    }`}
                  >
                    <div className={`flex items-center gap-1 ${i === 0 ? '' : 'justify-end'}`}>
                      <span>{c.label}</span>
                      {arrow(lgSort, c.key)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leagueRows.map((r) => (
                <tr key={r.slug} className="border-b border-border-light">
                  <td className="px-3 py-2.5 text-sm font-medium text-primary">
                    <span className="inline-flex items-center gap-2">
                      <img
                        aria-hidden
                        src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/logos/${r.slug}.png`}
                        width={18}
                        height={18}
                        alt=""
                        className="inline-block h-5 w-5 object-contain"
                      />
                      {name(r.slug)}
                      <span className="text-xs text-muted">
                        {r.rank != null ? `#${r.rank}` : '—'}
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-sm text-secondary">{r.mp ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right text-sm text-secondary">{r.w ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right text-sm text-secondary">{r.d ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right text-sm text-secondary">{r.l ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right text-sm text-secondary">{r.gf ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right text-sm text-secondary">{r.ga ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right text-sm text-secondary">{r.gd ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right text-sm font-semibold text-primary">{r.pts ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right text-sm text-secondary">{fmt(r.xg)}</td>
                  <td className="px-3 py-2.5 text-right text-sm text-secondary">{fmt(r.xga)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {picked.length > 0 && (
        <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm dark:shadow-none">
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
            <h3 className="font-display text-lg font-semibold text-primary">
              {t('clubCompare.squadCompare')}
            </h3>
            <span className="text-xs text-muted">{season}</span>
          </div>
          <div className="grid gap-6 p-4 lg:grid-cols-2">
            {squadBar(t('clubCompare.avgAge'), 'avgAge')}
            {squadBar(t('clubCompare.weeklyBill'), 'weeklyBill', true)}
          </div>
          <div className="overflow-x-auto border-t border-border">
            <table className="w-full min-w-[720px] border-collapse">
              <thead className="bg-surface-elevated">
                <tr>
                  {([
                    { key: 'club', label: t('table.club'), tip: '' },
                    { key: 'players', label: t('clubCompare.players'), tip: t('colTip.players') },
                    { key: 'avgAge', label: t('clubCompare.avgAge'), tip: t('colTip.avgAge') },
                    { key: 'weeklyBill', label: t('clubCompare.weeklyBill'), tip: t('colTip.weeklyBill') },
                    { key: 'yearlyBill', label: t('clubCompare.yearlyBill'), tip: t('colTip.yearlyBill') },
                    { key: 'topEarner', label: t('clubCompare.topEarner'), tip: t('colTip.topEarner') },
                  ]).map((c, i) => (
                    <th
                      key={c.key}
                      title={c.tip || undefined}
                      onClick={() => clickSort(sqSort, setSqSort, c.key)}
                      className={`cursor-pointer border-b border-border px-3 py-3 text-xs font-semibold uppercase tracking-wider text-muted transition-colors hover:bg-bg-secondary ${
                        i === 0 || i === 5 ? 'text-left' : 'text-right'
                      }`}
                    >
                      <div className={`flex items-center gap-1 ${i === 0 || i === 5 ? '' : 'justify-end'}`}>
                        <span>{c.label}</span>
                        {arrow(sqSort, c.key)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {squadRows.map((r) => (
                  <tr key={r.slug} className="border-b border-border-light">
                    <td className="px-3 py-2.5 text-sm font-medium text-primary">
                      <span className="inline-flex items-center gap-2">
                        <img
                          aria-hidden
                          src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/logos/${r.slug}.png`}
                          width={18}
                          height={18}
                          alt=""
                          className="inline-block h-5 w-5 object-contain"
                        />
                        {name(r.slug)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm text-secondary">
                      {r.players ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm text-secondary">
                      {fmt(r.avgAge, 2)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm text-secondary">
                      {gbp(r.weeklyBill, 0)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm text-secondary">
                      {gbp(r.yearlyBill, 0)}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-secondary">
                      {r.topEarner ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-3 text-xs text-muted">
            {t('clubCompare.squadNote')}
          </p>
        </section>
      )}
    </main>
  );
}
