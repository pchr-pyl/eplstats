'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Calendar,
  Crosshair,
  RotateCcw,
  Shield,
  SlidersHorizontal,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';
import type { CompGroup } from '@/lib/types';
import { rowsForGroup, matchesForSeason, seasonShort } from '@/lib/stats';
import { fmt, signed, pct } from '@/lib/format';
import { CompetitionTabs } from './CompetitionTabs';
import { KpiCards } from './KpiCards';
import { TrendCharts } from './TrendCharts';
import { SeasonTable } from './SeasonTable';
import { DataNote } from './DataNote';
import { ClubCrest } from './LeagueHome';
import { useI18n } from '@/i18n/I18nContext';
import { useClub, useClubData } from './ClubProvider';

export function Dashboard() {
  const { club } = useClub();
  const { rows, matches } = useClubData();
  const { t, lang } = useI18n();
  const th = lang === 'th';
  const tx = (en: string, thText: string) => (th ? thText : en);

  const [group, setGroup] = useState<CompGroup>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const groupRows = useMemo(() => rowsForGroup(rows, group), [rows, group]);

  const seasons = useMemo(
    () => [...new Set(rows.map((r) => r.season))].sort(),
    [rows],
  );
  const firstSeason = seasons[0] ?? '';
  const lastSeason = seasons[seasons.length - 1] ?? '';
  const lo = from ?? firstSeason;
  const hi = to ?? lastSeason;
  const isFilteredRange = lo !== firstSeason || hi !== lastSeason;

  const rangedRows = useMemo(
    () => groupRows.filter((r) => r.season >= lo && r.season <= hi),
    [groupRows, lo, hi],
  );

  const changeGroup = (g: CompGroup) => {
    setGroup(g);
    setSelected(null);
  };

  const toggleSeason = (season: string) =>
    setSelected((prev) => (prev === season ? null : season));

  const clubName = th && club.nameTh ? club.nameTh : club.name;
  const seasonRangeText =
    firstSeason && lastSeason
      ? `${seasonShort(firstSeason)}–${seasonShort(lastSeason)}`
      : '';

  // Latest season pulse metrics from rangedRows + matches
  const latestPulse = useMemo(() => {
    const sorted = [...rangedRows].sort((a, b) => a.season.localeCompare(b.season));
    const latest = sorted[sorted.length - 1] ?? null;
    if (!latest) return null;

    const seasonMatches = matchesForSeason(matches, latest.season, group).filter(
      (m) => m.gf != null && m.ga != null && ['W', 'D', 'L'].includes(m.result ?? ''),
    );
    const last5 = seasonMatches.slice(-5);
    const formPts = last5.reduce(
      (sum, m) => sum + (m.result === 'W' ? 3 : m.result === 'D' ? 1 : 0),
      0,
    );

    const mp = latest.mp ?? 0;
    const w = latest.w ?? 0;
    const d = latest.d ?? 0;
    const l = latest.l ?? 0;
    const wPct = mp > 0 ? (w / mp) * 100 : 0;
    const dPct = mp > 0 ? (d / mp) * 100 : 0;
    const lPct = mp > 0 ? (l / mp) * 100 : 0;
    const cleanRank = latest.rank ? latest.rank.replace(/\*\*/g, '').trim() : null;
    const isChamp =
      !!latest.rank &&
      (latest.rank.includes('**') ||
        cleanRank?.toLowerCase().includes('1st') ||
        cleanRank === 'W');

    return {
      latest,
      cleanRank,
      isChamp,
      mp,
      w,
      d,
      l,
      wPct,
      dPct,
      lPct,
      winRateVal: mp > 0 ? w / mp : null,
      last5,
      formPts,
      formMax: last5.length * 3,
    };
  }, [rangedRows, matches, group]);

  const quickLinks = [
    { href: `/${club.slug}/matches/`, label: t('nav.matches'), icon: Calendar },
    { href: `/${club.slug}/season/`, label: t('nav.season'), icon: TrendingUp },
    { href: `/${club.slug}/attack/`, label: t('nav.attack'), icon: Crosshair },
    { href: `/${club.slug}/defense/`, label: t('nav.defense'), icon: Shield },
    { href: `/${club.slug}/squad/`, label: t('nav.squad'), icon: Users },
  ];

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-7 px-4 pb-16 pt-6 sm:px-6 lg:px-10">
      {/* ------------------------------------------------ Editorial Club Masthead */}
      <header className="flex flex-col gap-5 border-b border-border pb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface p-2 shadow-sm sm:h-16 sm:w-16 dark:shadow-none">
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-[3px] bg-brand"
              />
              <ClubCrest slug={club.slug} size={44} alt={clubName} />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                <span>
                  {tx(
                    `Premier League Club Dossier${seasonRangeText ? ` · ${seasonRangeText}` : ''}`,
                    `แฟ้มข้อมูลสโมสรพรีเมียร์ลีก${seasonRangeText ? ` · ${seasonRangeText}` : ''}`,
                  )}
                </span>
                <span className="text-border">•</span>
                <span className="rounded-md bg-brand-soft px-2 py-0.5 text-[10px] font-bold text-brand">
                  {t(`competitions.${group}`)}
                </span>
                <span className="rounded-md bg-bg-secondary px-2 py-0.5 text-[10px] font-bold tabular-nums text-secondary">
                  {rangedRows.length} {tx(rangedRows.length === 1 ? 'Season' : 'Seasons', 'ฤดูกาล')}
                </span>
              </div>

              <h1 className="mt-1.5 truncate font-display text-3xl font-bold tracking-tight text-primary sm:text-4xl">
                {clubName}
              </h1>

              <p className="mt-1 text-sm text-secondary">
                {tx(
                  `Multi-season performance ledger, underlying xG trends, and match-by-match breakdowns (${lo} to ${hi}).`,
                  `สรุปผลงานหลายฤดูกาล แนวโน้ม xG เชิงลึก และสถิติรายแมตช์ (${lo} ถึง ${hi})`,
                )}
              </p>
            </div>
          </div>

          {/* Quick jump links */}
          <nav
            aria-label={tx('Club sections', 'หมวดหมู่สโมสร')}
            className="flex flex-wrap items-center gap-2"
          >
            {quickLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-bold text-primary transition-colors hover:border-brand/40 hover:bg-brand-soft hover:text-brand"
              >
                <Icon size={13} className="text-brand" />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
        </div>

        {/* Filter bar: Competition tabs + Season range */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface/70 px-3.5 py-2.5">
          <div className="-mb-2 min-w-0 flex-1">
            <CompetitionTabs group={group} onChange={changeGroup} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-muted sm:inline-flex">
              <SlidersHorizontal size={12} />
              {tx('Era', 'ช่วงฤดูกาล')}
            </span>
            <div className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-2.5 py-1.5">
              <label
                htmlFor="season-from"
                className="text-[11px] font-bold uppercase tracking-wider text-muted"
              >
                {t('filter.from')}
              </label>
              <select
                id="season-from"
                value={lo}
                onChange={(e) => setFrom(e.target.value)}
                className="cursor-pointer bg-transparent text-xs font-bold tabular-nums text-primary outline-none focus-visible:text-brand"
              >
                {seasons.map((s) => (
                  <option key={s} value={s} disabled={s > hi} className="bg-surface text-primary">
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-2.5 py-1.5">
              <label
                htmlFor="season-to"
                className="text-[11px] font-bold uppercase tracking-wider text-muted"
              >
                {t('filter.to')}
              </label>
              <select
                id="season-to"
                value={hi}
                onChange={(e) => setTo(e.target.value)}
                className="cursor-pointer bg-transparent text-xs font-bold tabular-nums text-primary outline-none focus-visible:text-brand"
              >
                {seasons.map((s) => (
                  <option key={s} value={s} disabled={s < lo} className="bg-surface text-primary">
                    {s}
                  </option>
                ))}
              </select>
            </div>
            {isFilteredRange && (
              <button
                type="button"
                onClick={() => {
                  setFrom(null);
                  setTo(null);
                }}
                className="inline-flex items-center gap-1 rounded-xl border border-border bg-bg-secondary px-2.5 py-1.5 text-xs font-semibold text-secondary transition-colors hover:border-brand/40 hover:text-brand"
                title={tx('Reset season range', 'รีเซ็ตช่วงฤดูกาล')}
              >
                <RotateCcw size={12} />
                <span>{tx('Reset', 'รีเซ็ต')}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* --------------------------------------------- Latest Season Pulse Strip */}
      {latestPulse && (
        <section
          aria-label={tx('Latest season pulse', 'ภาพรวมฤดูกาลล่าสุด')}
          className="relative overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5 dark:shadow-none"
        >
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-[3px] bg-brand"
          />

          <div className="grid grid-cols-1 items-center gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1.4fr)_minmax(0,1fr)]">
            {/* Left: Season Identity + W-D-L proportion bar */}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand">
                  {tx('Latest Season Pulse', 'ชีพจรฤดูกาลล่าสุด')}
                </span>
                <span className="rounded-md bg-bg-secondary px-2 py-0.5 text-[11px] font-bold tabular-nums text-primary">
                  {latestPulse.latest.season}
                </span>
                {latestPulse.cleanRank && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase ${
                      latestPulse.isChamp
                        ? 'bg-warning-soft text-warning'
                        : 'bg-brand-soft text-brand'
                    }`}
                  >
                    {latestPulse.isChamp && <Trophy size={11} />}
                    {latestPulse.cleanRank}
                  </span>
                )}
              </div>

              <div className="mt-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-display text-2xl font-extrabold tabular-nums tracking-tight text-primary sm:text-3xl">
                  {latestPulse.w}W – {latestPulse.d}D – {latestPulse.l}L
                </span>
                <span className="text-xs font-semibold tabular-nums text-muted">
                  {latestPulse.mp} {tx('MP', 'นัด')} · {pct(latestPulse.winRateVal, 2)}{' '}
                  {tx('Win', 'ชนะ')}
                </span>
              </div>

              {/* W-D-L bar */}
              <div
                className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-bg-secondary"
                aria-label={`${latestPulse.w}W ${latestPulse.d}D ${latestPulse.l}L`}
              >
                {latestPulse.wPct > 0 && (
                  <span
                    className="bg-success transition-all"
                    style={{ width: `${latestPulse.wPct}%` }}
                  />
                )}
                {latestPulse.dPct > 0 && (
                  <span
                    className="bg-muted/45 transition-all"
                    style={{ width: `${latestPulse.dPct}%` }}
                  />
                )}
                {latestPulse.lPct > 0 && (
                  <span
                    className="bg-danger transition-all"
                    style={{ width: `${latestPulse.lPct}%` }}
                  />
                )}
              </div>
            </div>

            {/* Middle: Headline Stat Pills */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:border-x lg:border-border lg:px-5">
              <div className="rounded-xl border border-border-light bg-bg-secondary/60 px-3 py-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  {tx('Points', 'คะแนน')}
                </div>
                <div className="mt-1 font-display text-xl font-extrabold tabular-nums text-primary">
                  {fmt(latestPulse.latest.pts, 0)}
                </div>
                <div className="text-[11px] font-medium tabular-nums text-muted">
                  {fmt(latestPulse.latest.ptsPerMp, 2)} {tx('PPG', '/นัด')}
                </div>
              </div>

              <div className="rounded-xl border border-border-light bg-bg-secondary/60 px-3 py-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  {tx('Goal Diff', 'ผลต่างประตู')}
                </div>
                <div
                  className={`mt-1 font-display text-xl font-extrabold tabular-nums ${
                    (latestPulse.latest.gd ?? 0) > 0
                      ? 'text-success'
                      : (latestPulse.latest.gd ?? 0) < 0
                        ? 'text-danger'
                        : 'text-primary'
                  }`}
                >
                  {signed(latestPulse.latest.gd, 0)}
                </div>
                <div className="text-[11px] font-medium tabular-nums text-muted">
                  {fmt(latestPulse.latest.gf, 0)}–{fmt(latestPulse.latest.ga, 0)}
                </div>
              </div>

              <div className="rounded-xl border border-border-light bg-bg-secondary/60 px-3 py-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  {latestPulse.latest.xgd != null ? 'xGD' : tx('Clean Sheets', 'คลีนชีต')}
                </div>
                {latestPulse.latest.xgd != null ? (
                  <>
                    <div
                      className={`mt-1 font-display text-xl font-extrabold tabular-nums ${
                        latestPulse.latest.xgd > 0
                          ? 'text-success'
                          : latestPulse.latest.xgd < 0
                            ? 'text-danger'
                            : 'text-primary'
                      }`}
                    >
                      {signed(latestPulse.latest.xgd, 2)}
                    </div>
                    <div className="text-[11px] font-medium tabular-nums text-muted">
                      {fmt(latestPulse.latest.xg, 2)}–{fmt(latestPulse.latest.xga, 2)}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mt-1 font-display text-xl font-extrabold tabular-nums text-primary">
                      {fmt(latestPulse.latest.cs, 0)}
                    </div>
                    <div className="text-[11px] font-medium tabular-nums text-muted">
                      {latestPulse.mp > 0 && latestPulse.latest.cs != null
                        ? pct(latestPulse.latest.cs / latestPulse.mp, 2)
                        : '—'}
                    </div>
                  </>
                )}
              </div>

              <div className="rounded-xl border border-border-light bg-bg-secondary/60 px-3 py-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  {tx('Goals / MP', 'ประตู / นัด')}
                </div>
                <div className="mt-1 font-display text-xl font-extrabold tabular-nums text-primary">
                  {latestPulse.mp > 0 && latestPulse.latest.gf != null
                    ? fmt(latestPulse.latest.gf / latestPulse.mp, 2)
                    : '—'}
                </div>
                <div className="text-[11px] font-medium tabular-nums text-muted">
                  {tx('GA', 'เสีย')}{' '}
                  {latestPulse.mp > 0 && latestPulse.latest.ga != null
                    ? fmt(latestPulse.latest.ga / latestPulse.mp, 2)
                    : '—'}
                </div>
              </div>
            </div>

            {/* Right: Last 5 Form + Deep link */}
            <div className="flex flex-col justify-between gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  {t('kpi.last5')}
                </span>
                <span className="text-xs font-bold tabular-nums text-primary">
                  {latestPulse.last5.length
                    ? `${latestPulse.formPts}/${latestPulse.formMax} ${t('kpi.points')}`
                    : '—'}
                </span>
              </div>

              <div
                className="flex flex-wrap items-center gap-1.5"
                aria-label={t('kpi.oldestFirst')}
              >
                {latestPulse.last5.length > 0 ? (
                  latestPulse.last5.map((m, i) => (
                    <span
                      key={`${m.date}-${i}`}
                      title={`${m.date} · ${m.venue === 'Home' ? 'H' : m.venue === 'Away' ? 'A' : 'N'} vs ${m.opponent ?? '—'} · ${m.gf}–${m.ga} (${m.result})`}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-extrabold tabular-nums transition-transform hover:scale-105 ${
                        m.result === 'W'
                          ? 'bg-success-soft text-success'
                          : m.result === 'L'
                            ? 'bg-danger-soft text-danger'
                            : 'bg-bg-secondary text-muted'
                      }`}
                    >
                      {m.result}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-muted">—</span>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className="text-[11px] text-muted">{t('kpi.oldestFirst')}</span>
                <Link
                  href={`/${club.slug}/season/`}
                  className="inline-flex items-center gap-1 text-xs font-bold text-brand transition-colors hover:underline"
                >
                  <span>{t('nav.season')}</span>
                  <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* --------------------------------------------------------- KPI Breakdown */}
      <section className="flex min-w-0 flex-col gap-3">
        <KpiCards rows={rangedRows} matches={matches} group={group} />
      </section>

      {/* ---------------------------------------------------------- Trend Charts */}
      <section className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
              {tx('Multi-Season Trajectories', 'แนวโน้มระยะยาวรายฤดูกาล')}
            </p>
            <h2 className="mt-0.5 font-display text-xl font-bold tracking-tight text-primary sm:text-2xl">
              {tx('Performance Trends', 'กราฟแนวโน้มผลงาน')}
            </h2>
          </div>
          <span className="text-xs font-medium tabular-nums text-muted">
            {lo} – {hi} · {t(`competitions.${group}`)}
          </span>
        </div>
        <TrendCharts rows={rangedRows} />
      </section>

      {/* ---------------------------------------------------------- Season Table */}
      <section className="flex min-w-0 flex-col gap-3">
        <SeasonTable
          rows={rangedRows}
          group={group}
          selectedSeason={selected}
          onSelect={toggleSeason}
          matches={matches}
        />
        <p className="text-xs text-muted">{t('table.hint')}</p>
      </section>

      <footer>
        <DataNote />
      </footer>
    </main>
  );
}
