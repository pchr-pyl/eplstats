'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronUp,
  Plus,
  Search,
  Share2,
  Sparkles,
  Swords,
  Wallet,
  X,
} from 'lucide-react';
import { LabelsBtn } from './LabelsBtn';
import { ShareBtn } from './ShareBtn';
import { ClubCrest } from './LeagueHome';
import { useI18n } from '@/i18n/I18nContext';
import { useTheme } from './ThemeProvider';
import type { ClubIndexEntry, LeagueData, SquadCompareData } from '@/lib/types';
import { fmt, gbp, signed } from '@/lib/format';
import { seasonShort } from '@/lib/stats';

const MAX_CLUBS = 8;
const DEFAULTS = ['man-utd', 'arsenal'];

interface Row {
  season: string;
  [slug: string]: string | number | null;
}

const PRESETS: { id: string; en: string; th: string; slugs: string[] }[] = [
  {
    id: 'big6',
    en: 'Big Six',
    th: 'บิ๊กซิกซ์ (6 ทีม)',
    slugs: ['arsenal', 'chelsea', 'liverpool', 'man-city', 'man-utd', 'tottenham'],
  },
  {
    id: 'nw',
    en: 'Man Utd vs Liverpool',
    th: 'ศึกแดงเดือด',
    slugs: ['man-utd', 'liverpool'],
  },
  {
    id: 'manc',
    en: 'Manchester vs North London',
    th: 'แมนเชสเตอร์ vs ลอนดอนเหนือ',
    slugs: ['man-city', 'man-utd', 'arsenal', 'tottenham'],
  },
  {
    id: 'challengers',
    en: 'New Challengers',
    th: 'กลุ่มท้าชิงรุ่นใหม่',
    slugs: ['aston-villa', 'newcastle-united', 'brighton', 'nottingham-forest'],
  },
];

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
  const { theme } = useTheme();
  const th = lang === 'th';
  const dark = theme === 'dark';
  const tx = (en: string, thText: string) => (th ? thText : en);

  const clubMap = useMemo(() => new Map(clubs.map((c) => [c.slug, c])), [clubs]);
  const seasons = useMemo(() => Object.keys(league).sort(), [league]);

  const [picked, setPicked] = useState<string[]>(() =>
    DEFAULTS.filter((s) => clubs.some((c) => c.slug === s)),
  );
  const [season, setSeason] = useState(() => seasons[seasons.length - 1] ?? '');
  const [perMatch, setPerMatch] = useState(false);
  const [xgMetric, setXgMetric] = useState<'xg' | 'xga' | 'xgd'>('xg');
  const [lgSort, setLgSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({
    key: 'pts',
    dir: 'desc',
  });
  const [sqSort, setSqSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({
    key: 'weeklyBill',
    dir: 'desc',
  });
  const [lbl, setLbl] = useState<Record<string, boolean>>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const urlReadyRef = useRef(false);

  // Hydrate URL query (?clubs=a,b&season=2025-2026) asynchronously on mount
  useEffect(() => {
    let alive = true;
    Promise.resolve().then(() => {
      if (!alive) return;
      try {
        const sp = new URLSearchParams(window.location.search);
        const cs = sp.get('clubs');
        const sn = sp.get('season');
        if (cs) {
          const valid = cs
            .split(',')
            .filter((s) => clubMap.has(s))
            .slice(0, MAX_CLUBS);
          if (valid.length) setPicked(valid);
        }
        if (sn && seasons.includes(sn)) setSeason(sn);
      } catch {
        // ignore
      } finally {
        urlReadyRef.current = true;
      }
    });
    return () => {
      alive = false;
    };
  }, [clubMap, seasons]);

  useEffect(() => {
    if (!urlReadyRef.current) return;
    try {
      const url = new URL(window.location.href);
      if (picked.length) url.searchParams.set('clubs', picked.join(','));
      else url.searchParams.delete('clubs');
      if (season) url.searchParams.set('season', season);
      window.history.replaceState(null, '', url.toString());
    } catch {
      // ignore
    }
  }, [picked, season]);

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
      cur.dir === 'asc' ? (
        <ArrowUp size={12} />
      ) : (
        <ArrowDown size={12} />
      )
    ) : (
      <ArrowUpDown size={12} className="opacity-30" />
    );

  const name = (slug: string) => {
    const c = clubMap.get(slug);
    return th && c?.nameTh ? c.nameTh : (c?.name ?? slug);
  };
  const shortName = (slug: string) => {
    const c = clubMap.get(slug);
    return th && c?.nameTh ? c.nameTh : (c?.shortName ?? c?.name ?? slug);
  };
  const color = (slug: string) => {
    const c = clubMap.get(slug);
    return (dark ? c?.brandDark : c?.brandLight) || c?.color || '#888888';
  };

  const toggle = (slug: string) =>
    setPicked((prev) =>
      prev.includes(slug)
        ? prev.filter((s) => s !== slug)
        : prev.length < MAX_CLUBS
        ? [...prev, slug]
        : prev,
    );

  const sideRows = useMemo(() => league[season] ?? [], [league, season]);
  const currentSeasonSlugs = useMemo(
    () => new Set(sideRows.map((r) => r.slug)),
    [sideRows],
  );

  // Top 4 preset dynamically derived from selected season
  const top4Preset = useMemo(
    () =>
      [...sideRows]
        .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
        .slice(0, 4)
        .map((r) => r.slug),
    [sideRows],
  );

  // Filtered club picker groups
  const { currentClubs, historicalClubs } = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    const match = (c: ClubIndexEntry) =>
      !q ||
      c.name.toLowerCase().includes(q) ||
      (c.nameTh ?? '').toLowerCase().includes(q) ||
      (c.shortName ?? '').toLowerCase().includes(q);
    return {
      currentClubs: clubs.filter((c) => currentSeasonSlugs.has(c.slug) && match(c)),
      historicalClubs: clubs.filter((c) => !currentSeasonSlugs.has(c.slug) && match(c)),
    };
  }, [clubs, currentSeasonSlugs, pickerQuery]);

  // Era H2H summary when exactly 2 clubs are picked
  const duelSummary = useMemo(() => {
    if (picked.length !== 2) return null;
    const [a, b] = picked;
    let seasonsA = 0;
    let seasonsB = 0;
    let shared = 0;
    let higherA = 0;
    let higherB = 0;
    let ptsA = 0;
    let ptsB = 0;
    let bestA = 99;
    let bestB = 99;
    for (const s of seasons) {
      const ra = (league[s] ?? []).find((x) => x.slug === a);
      const rb = (league[s] ?? []).find((x) => x.slug === b);
      if (ra) {
        seasonsA++;
        ptsA += ra.pts;
        if (ra.rank != null && ra.rank < bestA) bestA = ra.rank;
      }
      if (rb) {
        seasonsB++;
        ptsB += rb.pts;
        if (rb.rank != null && rb.rank < bestB) bestB = rb.rank;
      }
      if (ra && rb && ra.rank != null && rb.rank != null) {
        shared++;
        if (ra.rank < rb.rank) higherA++;
        else if (rb.rank < ra.rank) higherB++;
      }
    }
    return {
      a,
      b,
      seasonsA,
      seasonsB,
      shared,
      higherA,
      higherB,
      avgPtsA: seasonsA ? ptsA / seasonsA : 0,
      avgPtsB: seasonsB ? ptsB / seasonsB : 0,
      bestA: bestA < 99 ? bestA : null,
      bestB: bestB < 99 ? bestB : null,
    };
  }, [picked, seasons, league]);

  const series = (field: 'rank' | 'pts' | 'gd' | 'xg' | 'xga' | 'xgd'): Row[] =>
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

  const leagueRows = useMemo(() => {
    const rs = picked.map((slug) => {
      const found = sideRows.find((x) => x.slug === slug);
      const mp = found?.mp ?? null;
      const pts = found?.pts ?? null;
      return {
        slug,
        mp,
        w: found?.w ?? null,
        d: found?.d ?? null,
        l: found?.l ?? null,
        gf: found?.gf ?? null,
        ga: found?.ga ?? null,
        gd: found?.gd ?? null,
        pts,
        ppg: mp && pts != null ? pts / mp : null,
        xg: found?.xg ?? null,
        xga: found?.xga ?? null,
        xgd: found?.xgd ?? null,
        cs: found?.cs ?? null,
        rank: found?.rank ?? null,
      };
    });
    const k = lgSort.key;
    const val = (r: (typeof rs)[number]): number | string | null =>
      k === 'club'
        ? name(r.slug)
        : ((r as Record<string, unknown>)[k] as number | null);
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
    return [...rs].sort((a, b) =>
      lgSort.dir === 'asc' ? cmp(a, b) : -cmp(a, b),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, sideRows, lgSort, lang, clubs]);

  // Column leaders for subtle highlighting
  const bestLg = useMemo(() => {
    const maxOf = (fn: (r: (typeof leagueRows)[number]) => number | null) => {
      const vals = leagueRows.map(fn).filter((v): v is number => v != null);
      return vals.length ? Math.max(...vals) : null;
    };
    const minOf = (fn: (r: (typeof leagueRows)[number]) => number | null) => {
      const vals = leagueRows.map(fn).filter((v): v is number => v != null);
      return vals.length ? Math.min(...vals) : null;
    };
    return {
      pts: maxOf((r) => r.pts),
      gf: maxOf((r) => r.gf),
      ga: minOf((r) => r.ga),
      gd: maxOf((r) => r.gd),
      xg: maxOf((r) => r.xg),
      xga: minOf((r) => r.xga),
    };
  }, [leagueRows]);

  const squadRows = useMemo(() => {
    const rows = picked.map((slug) => {
      const s = squad[season]?.[slug];
      const lgRow = sideRows.find((x) => x.slug === slug);
      const pts = lgRow?.pts ?? null;
      const yearlyBill = s?.yearlyBill ?? null;
      const costPerPtM =
        yearlyBill != null && pts != null && pts > 0
          ? yearlyBill / pts / 1e6
          : null;
      return {
        slug,
        name: shortName(slug),
        color: color(slug),
        players: s?.players ?? null,
        avgAge: s?.avgAge ?? null,
        weeklyBill: s?.weeklyBill ?? null,
        weeklyBillM: s?.weeklyBill != null ? s.weeklyBill / 1e6 : null,
        yearlyBill,
        costPerPtM,
        topEarner: s?.topEarner ?? null,
      };
    });
    const k = sqSort.key;
    const val = (r: (typeof rows)[number]): number | string | null =>
      k === 'club'
        ? r.name
        : ((r as Record<string, unknown>)[k] as number | string | null);
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
    return rows.sort((a, b) =>
      sqSort.dir === 'asc' ? cmp(a, b) : -cmp(a, b),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, season, squad, sideRows, clubs, sqSort, lang, dark]);

  const bestValueClub = useMemo(() => {
    const valid = squadRows.filter((r) => r.costPerPtM != null);
    if (valid.length < 2) return null;
    return valid.reduce((a, b) => (b.costPerPtM! < a.costPerPtM! ? b : a));
  }, [squadRows]);

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  const renderTrendChart = (
    title: string,
    field: 'rank' | 'pts' | 'gd' | 'xg' | 'xga' | 'xgd',
    reversed = false,
    extraHeader?: React.ReactNode,
  ) => (
    <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-base font-bold text-primary sm:text-lg">
            {title}
          </h3>
          {extraHeader}
        </div>
        <div className="flex items-center gap-1.5">
          <LabelsBtn on={lblOn(field)} onClick={() => toggleLbl(field)} />
          <ShareBtn />
        </div>
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer>
          <LineChart
            data={series(field)}
            margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
          >
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
            <Legend formatter={(v: string) => shortName(v)} />
            {picked.map((slug) => (
              <Line
                key={slug}
                dataKey={slug}
                stroke={color(slug)}
                strokeWidth={2.3}
                dot={{ r: 2.5 }}
                activeDot={{ r: 5 }}
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

  const renderSquadBar = (
    title: string,
    field: 'avgAge' | 'weeklyBill' | 'costPerPtM',
    money = false,
  ) => {
    const dataKey =
      field === 'weeklyBill' ? 'weeklyBillM' : field;
    return (
      <div className="min-w-0">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h4 className="font-display text-sm font-bold text-primary">
            {title}
          </h4>
          <div className="flex items-center gap-1.5">
            <LabelsBtn on={lblOn(field)} onClick={() => toggleLbl(field)} />
            <ShareBtn />
          </div>
        </div>
        <div className="h-48 w-full">
          <ResponsiveContainer>
            <BarChart
              data={squadRows}
              margin={{ top: 10, right: 14, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke="var(--border-light)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                tickFormatter={(v: number) =>
                  money ? `£${fmt(v, 2)}M` : fmt(v, 2)
                }
                width={52}
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
                dataKey={dataKey}
                radius={[6, 6, 0, 0]}
                isAnimationActive={false}
              >
                {lblOn(field) && (
                  <LabelList
                    dataKey={dataKey}
                    position="top"
                    fontSize={10}
                    fill="var(--text-muted)"
                    formatter={(v: unknown) =>
                      money ? `£${fmt(Number(v), 2)}M` : fmt(Number(v), 2)
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
  };

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 pb-16 pt-6 sm:px-6 lg:px-10">
      {/* -------------------------------------------------- Masthead */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
            Premier League · 2014–2027 · {tx('Multi-Club Studio', 'สตูดิโอเปรียบเทียบสโมสร')}
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-primary sm:text-4xl">
            {t('clubCompare.compareTitle')}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-secondary">
            {tx(
              'Compare up to 8 Premier League clubs across 13 seasons: rankings, points, xG trajectories, squad wages and cost per point.',
              'เปรียบเทียบได้สูงสุด 8 สโมสรข้าม 13 ฤดูกาล: อันดับ คะแนน xG/xGA ค่าเหนื่อยทีม และความคุ้มค่าต่อคะแนน',
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Season Selector */}
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
              {t('table.season')}
            </span>
            <select
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              aria-label={t('table.season')}
              className="cursor-pointer bg-transparent text-sm font-bold tabular-nums text-primary outline-none"
            >
              {[...seasons].reverse().map((s) => (
                <option key={s} value={s} className="bg-surface text-primary">
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Totals vs Per Match */}
          <div className="inline-flex rounded-xl border border-border bg-surface p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setPerMatch(false)}
              className={`rounded-lg px-3 py-1 transition-colors ${
                !perMatch
                  ? 'bg-primary text-surface'
                  : 'text-muted hover:text-primary'
              }`}
            >
              {t('defense.totals')}
            </button>
            <button
              type="button"
              onClick={() => setPerMatch(true)}
              className={`rounded-lg px-3 py-1 transition-colors ${
                perMatch
                  ? 'bg-primary text-surface'
                  : 'text-muted hover:text-primary'
              }`}
            >
              {t('defense.perMatch')}
            </button>
          </div>

          <button
            type="button"
            onClick={copyShare}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-bold text-primary transition-colors hover:border-primary/40 hover:bg-bg-secondary"
          >
            {copied ? (
              <Check size={14} className="text-success" />
            ) : (
              <Share2 size={14} />
            )}
            <span>{copied ? tx('Copied', 'คัดลอกแล้ว') : tx('Share', 'แชร์')}</span>
          </button>
        </div>
      </header>

      {/* --------------------------- Presets & Clean Club Selection Bar */}
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        {/* Preset strip */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3.5">
          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-muted">
            <Sparkles size={13} className="text-brand" />
            {tx('Presets:', 'ชุดแนะนำ:')}
          </span>
          {top4Preset.length > 0 && (
            <button
              type="button"
              onClick={() => setPicked(top4Preset)}
              className="rounded-full border border-border bg-bg-secondary px-3 py-1 text-xs font-semibold text-primary transition-colors hover:border-brand/40 hover:bg-brand-soft hover:text-brand"
            >
              {tx(`Top 4 (${seasonShort(season)})`, `ท็อป 4 (${seasonShort(season)})`)}
            </button>
          )}
          {PRESETS.map((pr) => {
            const valid = pr.slugs.filter((s) => clubMap.has(s));
            const isSame =
              valid.length === picked.length &&
              valid.every((s) => picked.includes(s));
            return (
              <button
                key={pr.id}
                type="button"
                onClick={() => setPicked(valid)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  isSame
                    ? 'border-brand bg-brand-soft text-brand'
                    : 'border-border bg-bg-secondary text-secondary hover:border-primary/30 hover:text-primary'
                }`}
              >
                {th ? pr.th : pr.en}
              </button>
            );
          })}
        </div>

        {/* Selected Chips + Expandable Club Drawer Toggle */}
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {picked.map((slug) => (
              <span
                key={slug}
                className="inline-flex items-center gap-2 rounded-full border bg-bg-secondary/70 py-1 pl-2.5 pr-2 text-xs font-bold text-primary"
                style={{
                  borderColor: `color-mix(in srgb, ${color(slug)} 45%, var(--border))`,
                }}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: color(slug) }}
                />
                <ClubCrest slug={slug} size={16} />
                <span>{name(slug)}</span>
                <button
                  type="button"
                  onClick={() => toggle(slug)}
                  aria-label={`Remove ${name(slug)}`}
                  className="rounded-full p-0.5 text-muted hover:bg-surface hover:text-danger"
                >
                  <X size={12} />
                </button>
              </span>
            ))}

            {picked.length < MAX_CLUBS && (
              <button
                type="button"
                onClick={() => setPickerOpen((o) => !o)}
                className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1 text-xs font-bold text-secondary transition-colors hover:border-brand hover:text-brand"
              >
                <Plus size={13} />
                {tx(
                  `Add club (${picked.length}/${MAX_CLUBS})`,
                  `เพิ่มสโมสร (${picked.length}/${MAX_CLUBS})`,
                )}
                {pickerOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPickerOpen((o) => !o)}
              className="text-xs font-semibold text-muted hover:text-primary"
            >
              {pickerOpen
                ? tx('Hide club picker', 'ซ่อนตัวเลือก')
                : tx('Browse all 36 clubs', 'เลือกจากทั้งหมด 36 ทีม')}
            </button>
            {picked.length > 0 && (
              <button
                type="button"
                onClick={() => setPicked([])}
                className="text-xs font-semibold text-danger hover:underline"
              >
                {tx('Clear', 'ล้างทั้งหมด')}
              </button>
            )}
          </div>
        </div>

        {/* Collapsible Searchable Club Drawer */}
        {pickerOpen && (
          <div className="mt-4 border-t border-border pt-4">
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-border bg-bg-secondary/60 px-3 py-2 sm:max-w-xs">
              <Search size={14} className="text-muted" />
              <input
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                placeholder={tx('Search any PL club...', 'ค้นหาสโมสร...')}
                className="min-w-0 flex-1 bg-transparent text-xs text-primary outline-none placeholder:text-muted"
              />
              {pickerQuery && (
                <button
                  type="button"
                  onClick={() => setPickerQuery('')}
                  className="text-muted hover:text-primary"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {currentClubs.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">
                  PL {seasonShort(season)} ({currentClubs.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {currentClubs.map((c) => {
                    const active = picked.includes(c.slug);
                    const disabled = !active && picked.length >= MAX_CLUBS;
                    return (
                      <button
                        key={c.slug}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggle(c.slug)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
                          active
                            ? 'border-brand bg-brand-soft font-bold text-brand'
                            : 'border-border bg-bg-secondary/50 text-secondary hover:bg-bg-secondary hover:text-primary'
                        }`}
                      >
                        <ClubCrest slug={c.slug} size={14} />
                        {th && c.nameTh ? c.nameTh : c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {historicalClubs.length > 0 && (
              <div className="mt-3.5">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">
                  {tx('Other PL Era Clubs (2014–2027)', 'สโมสรอื่นในยุค PL 2014–2027')} (
                  {historicalClubs.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {historicalClubs.map((c) => {
                    const active = picked.includes(c.slug);
                    const disabled = !active && picked.length >= MAX_CLUBS;
                    return (
                      <button
                        key={c.slug}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggle(c.slug)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
                          active
                            ? 'border-brand bg-brand-soft font-bold text-brand'
                            : 'border-border bg-surface text-muted hover:bg-bg-secondary hover:text-primary'
                        }`}
                      >
                        <ClubCrest slug={c.slug} size={14} />
                        {th && c.nameTh ? c.nameTh : c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* --------------------------- 2-Club Era Tale of the Tape */}
      {duelSummary && (
        <section className="relative overflow-hidden rounded-2xl border border-border bg-surface p-5">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-[0.09] dark:opacity-[0.15]"
            style={{
              background: `linear-gradient(95deg, ${color(duelSummary.a)} 0%, transparent 48%, transparent 52%, ${color(duelSummary.b)} 100%)`,
            }}
          />
          <div className="relative grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <div className="flex items-center gap-3">
              <ClubCrest slug={duelSummary.a} size={42} />
              <div>
                <Link
                  href={`/${duelSummary.a}/`}
                  className="font-display text-xl font-bold text-primary hover:text-brand"
                >
                  {name(duelSummary.a)}
                </Link>
                <p className="text-xs text-muted tabular-nums">
                  {duelSummary.seasonsA} {tx('PL seasons', 'ซีซัน')} ·{' '}
                  {tx('Avg', 'เฉลี่ย')} {fmt(duelSummary.avgPtsA, 2)} {t('table.pts')} ·{' '}
                  {tx('Best', 'สูงสุด')} #{duelSummary.bestA ?? '—'}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center rounded-xl border border-border bg-bg-secondary/75 px-5 py-2.5 text-center">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                <Swords size={12} />
                {tx(`Higher Finish (${duelSummary.shared} shared PL seasons)`, `จบอันดับเหนือกว่า (${duelSummary.shared} ซีซันร่วมกัน)`)}
              </span>
              <div className="mt-1 flex items-baseline gap-3 font-display text-2xl font-extrabold tabular-nums">
                <span style={{ color: color(duelSummary.a) }}>{duelSummary.higherA}</span>
                <span className="text-xs text-muted">—</span>
                <span style={{ color: color(duelSummary.b) }}>{duelSummary.higherB}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 md:flex-row-reverse md:text-right">
              <ClubCrest slug={duelSummary.b} size={42} />
              <div>
                <Link
                  href={`/${duelSummary.b}/`}
                  className="font-display text-xl font-bold text-primary hover:text-brand"
                >
                  {name(duelSummary.b)}
                </Link>
                <p className="text-xs text-muted tabular-nums">
                  {duelSummary.seasonsB} {tx('PL seasons', 'ซีซัน')} ·{' '}
                  {tx('Avg', 'เฉลี่ย')} {fmt(duelSummary.avgPtsB, 2)} {t('table.pts')} ·{' '}
                  {tx('Best', 'สูงสุด')} #{duelSummary.bestB ?? '—'}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {picked.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center text-sm text-muted">
          {tx(
            'Select at least one club above (or choose a preset like Big Six) to compare trends, stats and wage bills.',
            'เลือกอย่างน้อย 1 สโมสรด้านบน หรือกดชุดแนะนำ เช่น บิ๊กซิกซ์ เพื่อเริ่มเปรียบเทียบ',
          )}
        </section>
      ) : (
        <>
          {/* ------------------------------------ Multi-Season Trend Grid */}
          <div className="grid gap-5 lg:grid-cols-2">
            {renderTrendChart(t('clubCompare.rank'), 'rank', true)}
            {renderTrendChart(
              `${t('table.pts')}${perMatch ? '/MP' : ''}`,
              'pts',
            )}
            {renderTrendChart(
              `${t('table.gd')}${perMatch ? '/MP' : ''}`,
              'gd',
            )}
            {renderTrendChart(
              `${xgMetric.toUpperCase()}${perMatch ? '/MP' : ''}`,
              xgMetric,
              false,
              <div className="inline-flex rounded-lg border border-border bg-bg-secondary p-0.5 text-[11px] font-bold">
                {(['xg', 'xga', 'xgd'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setXgMetric(k)}
                    className={`rounded-md px-2 py-0.5 uppercase transition-colors ${
                      xgMetric === k
                        ? 'bg-surface text-primary shadow-xs'
                        : 'text-muted hover:text-primary'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>,
            )}
          </div>

          {/* --------------------------------- Season League Table Compare */}
          <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                  PL {seasonShort(season)}
                </p>
                <h2 className="font-display text-lg font-bold text-primary">
                  {t('home.leagueTable')}
                </h2>
              </div>
              <span className="text-[11px] text-muted">
                {tx('Green highlights lead each stat among selected clubs.', 'สีเขียวแสดงทีมที่นำในแต่ละตัวชี้วัด')}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse">
                <thead className="bg-surface-elevated">
                  <tr>
                    {[
                      { key: 'club', label: t('table.club'), tip: '' },
                      { key: 'mp', label: 'MP', tip: t('colTip.mp') },
                      { key: 'w', label: 'W', tip: t('colTip.w') },
                      { key: 'd', label: 'D', tip: t('colTip.d') },
                      { key: 'l', label: 'L', tip: t('colTip.l') },
                      { key: 'gf', label: 'GF', tip: t('colTip.gf') },
                      { key: 'ga', label: 'GA', tip: t('colTip.ga') },
                      { key: 'gd', label: 'GD', tip: t('colTip.gd') },
                      { key: 'pts', label: t('table.pts'), tip: t('colTip.pts') },
                      { key: 'ppg', label: 'PPG', tip: '' },
                      { key: 'xg', label: 'xG', tip: t('colTip.xg') },
                      { key: 'xga', label: 'xGA', tip: t('colTip.xga') },
                      { key: 'xgd', label: 'xGD', tip: t('colTip.xgd') },
                    ].map((c, i) => (
                      <th
                        key={c.key}
                        title={c.tip || undefined}
                        onClick={() => clickSort(lgSort, setLgSort, c.key)}
                        className={`cursor-pointer border-b border-border px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted transition-colors hover:bg-bg-secondary ${
                          i === 0 ? 'text-left' : 'text-right'
                        }`}
                      >
                        <div
                          className={`flex items-center gap-1 ${
                            i === 0 ? '' : 'justify-end'
                          }`}
                        >
                          <span>{c.label}</span>
                          {arrow(lgSort, c.key)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light tabular-nums">
                  {leagueRows.map((r) => (
                    <tr
                      key={r.slug}
                      className="transition-colors hover:bg-bg-secondary/60"
                    >
                      <td className="px-3 py-2.5 text-sm font-semibold text-primary">
                        <Link
                          href={`/${r.slug}/`}
                          className="inline-flex items-center gap-2 hover:text-brand"
                        >
                          <ClubCrest slug={r.slug} size={18} />
                          <span>{name(r.slug)}</span>
                          <span className="rounded bg-bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-muted">
                            {r.rank != null ? `#${r.rank}` : '—'}
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-right text-sm text-secondary">
                        {r.mp ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right text-sm text-secondary">
                        {r.w ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right text-sm text-secondary">
                        {r.d ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right text-sm text-secondary">
                        {r.l ?? '—'}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right text-sm ${
                          r.gf != null && r.gf === bestLg.gf && picked.length > 1
                            ? 'font-bold text-success'
                            : 'text-secondary'
                        }`}
                      >
                        {r.gf ?? '—'}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right text-sm ${
                          r.ga != null && r.ga === bestLg.ga && picked.length > 1
                            ? 'font-bold text-success'
                            : 'text-secondary'
                        }`}
                      >
                        {r.ga ?? '—'}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right text-sm ${
                          r.gd != null && r.gd === bestLg.gd && picked.length > 1
                            ? 'font-bold text-success'
                            : 'text-secondary'
                        }`}
                      >
                        {r.gd != null ? (r.gd > 0 ? `+${r.gd}` : r.gd) : '—'}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right font-display text-sm font-extrabold ${
                          r.pts != null && r.pts === bestLg.pts && picked.length > 1
                            ? 'text-success'
                            : 'text-primary'
                        }`}
                      >
                        {r.pts ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right text-sm text-secondary">
                        {fmt(r.ppg, 2)}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right text-sm ${
                          r.xg != null && r.xg === bestLg.xg && picked.length > 1
                            ? 'font-bold text-success'
                            : 'text-secondary'
                        }`}
                      >
                        {fmt(r.xg, 2)}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right text-sm ${
                          r.xga != null && r.xga === bestLg.xga && picked.length > 1
                            ? 'font-bold text-success'
                            : 'text-secondary'
                        }`}
                      >
                        {fmt(r.xga, 2)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-sm text-secondary">
                        {signed(r.xgd, 2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* --------------------------- Squad Costs & Wage Efficiency */}
          <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
              <div>
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                  <Wallet size={13} />
                  {tx('Squad Structure & Wage Efficiency', 'โครงสร้างทีมและความคุ้มค่าค่าเหนื่อย')} ·{' '}
                  {seasonShort(season)}
                </p>
                <h2 className="font-display text-lg font-bold text-primary">
                  {t('clubCompare.squadCompare')}
                </h2>
              </div>
              {bestValueClub && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1 text-xs font-bold text-success">
                  <ClubCrest slug={bestValueClub.slug} size={15} />
                  {tx('Best value:', 'คุ้มค่าสุด:')} {bestValueClub.name} (£
                  {fmt(bestValueClub.costPerPtM, 2)}M / pt)
                </span>
              )}
            </div>

            <div className="grid gap-6 p-5 lg:grid-cols-3">
              {renderSquadBar(t('clubCompare.avgAge'), 'avgAge')}
              {renderSquadBar(t('clubCompare.weeklyBill'), 'weeklyBill', true)}
              {renderSquadBar(
                tx('Annual Wage / Point (£M)', 'ค่าเหนื่อยต่อปี / แต้ม (£M)'),
                'costPerPtM',
                true,
              )}
            </div>

            <div className="overflow-x-auto border-t border-border">
              <table className="w-full min-w-[780px] border-collapse">
                <thead className="bg-surface-elevated">
                  <tr>
                    {[
                      { key: 'club', label: t('table.club'), tip: '' },
                      { key: 'players', label: t('clubCompare.players'), tip: t('colTip.players') },
                      { key: 'avgAge', label: t('clubCompare.avgAge'), tip: t('colTip.avgAge') },
                      { key: 'weeklyBill', label: t('clubCompare.weeklyBill'), tip: t('colTip.weeklyBill') },
                      { key: 'yearlyBill', label: t('clubCompare.yearlyBill'), tip: t('colTip.yearlyBill') },
                      { key: 'costPerPtM', label: tx('£M / Pt', '£M / แต้ม'), tip: '' },
                      { key: 'topEarner', label: t('clubCompare.topEarner'), tip: t('colTip.topEarner') },
                    ].map((c, i) => (
                      <th
                        key={c.key}
                        title={c.tip || undefined}
                        onClick={() => clickSort(sqSort, setSqSort, c.key)}
                        className={`cursor-pointer border-b border-border px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted transition-colors hover:bg-bg-secondary ${
                          i === 0 || i === 6 ? 'text-left' : 'text-right'
                        }`}
                      >
                        <div
                          className={`flex items-center gap-1 ${
                            i === 0 || i === 6 ? '' : 'justify-end'
                          }`}
                        >
                          <span>{c.label}</span>
                          {arrow(sqSort, c.key)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light tabular-nums">
                  {squadRows.map((r) => (
                    <tr
                      key={r.slug}
                      className="transition-colors hover:bg-bg-secondary/60"
                    >
                      <td className="px-3 py-2.5 text-sm font-semibold text-primary">
                        <Link
                          href={`/${r.slug}/squad/`}
                          className="inline-flex items-center gap-2 hover:text-brand"
                        >
                          <ClubCrest slug={r.slug} size={18} />
                          {name(r.slug)}
                        </Link>
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
                      <td className="px-3 py-2.5 text-right text-sm font-semibold text-primary">
                        {gbp(r.yearlyBill, 0)}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right text-sm font-bold ${
                          bestValueClub?.slug === r.slug
                            ? 'text-success'
                            : 'text-secondary'
                        }`}
                      >
                        {r.costPerPtM != null ? `£${fmt(r.costPerPtM, 2)}M` : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-sm text-secondary">
                        {r.topEarner ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-border bg-bg-secondary/35 px-5 py-3 text-xs text-muted">
              {t('clubCompare.squadNote')}
            </p>
          </section>
        </>
      )}
    </main>
  );
}
