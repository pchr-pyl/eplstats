'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownUp,
  Calendar,
  Clock,
  Flag,
  RotateCcw,
  Search,
  Shield,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { useClub, useClubData } from './ClubProvider';
import type { CompGroup, MatchRow, MatchlogTable, SeasonMatchlogs } from '@/lib/types';
import { matchesForSeason, seasonShort } from '@/lib/stats';
import { bkkKickoff, fmt, signed } from '@/lib/format';
import { CompetitionTabs } from './CompetitionTabs';
import { ShareBtn } from './ShareBtn';
import {
  loadMatchlogs,
  StatTable,
  ScoresList,
  SideToggle,
  LoadFail,
  LOAD_FAILED,
  COMP_SHORT,
  formatDate,
  filterStatRows,
  type VenueFilter,
  type ResultFilter,
} from './matchlog-shared';

export type MatchlogPanelType = 'scores' | 'shooting' | 'keeper' | 'misc';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

function ClubLogo({ slug, name, size = 44 }: { slug: string; name: string; size?: number }) {
  return (
    <div className="flex shrink-0 items-center justify-center rounded-2xl border border-border bg-surface p-2 shadow-sm dark:shadow-none">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${BASE_PATH}/logos/${slug}.png`}
        alt={name}
        width={size}
        height={size}
        className="object-contain"
        style={{ width: size, height: size }}
      />
    </div>
  );
}

function TableLoadingSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-2.5 p-5">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-9 animate-pulse rounded-lg bg-bg-secondary"
          style={{ opacity: Math.max(0.3, 1 - i * 0.09) }}
        />
      ))}
    </div>
  );
}

function KpiSkeletonRibbon({ count = 5 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-[104px] animate-pulse rounded-2xl border border-border bg-surface p-4"
        />
      ))}
    </div>
  );
}

function sumColumn(
  table: MatchlogTable,
  rows: string[][],
  candidates: string[],
): { total: number; count: number; col: string } | null {
  for (const name of candidates) {
    const ci = table.columns.indexOf(name);
    if (ci < 0) continue;
    let total = 0;
    let count = 0;
    for (const r of rows) {
      const raw = (r[ci] ?? '').trim();
      if (raw === '') continue;
      const n = parseFloat(raw);
      if (Number.isNaN(n)) continue;
      total += n;
      count += 1;
    }
    return { total, count, col: name };
  }
  return null;
}

interface FilterToolbarProps {
  venueFilter: VenueFilter;
  onVenueChange: (v: VenueFilter) => void;
  resultFilter: ResultFilter;
  onResultChange: (r: ResultFilter) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onReset: () => void;
  shownCount: number;
  totalCount: number;
  compact?: boolean;
}

function FilterToolbar({
  venueFilter,
  onVenueChange,
  resultFilter,
  onResultChange,
  searchQuery,
  onSearchChange,
  onReset,
  shownCount,
  totalCount,
  compact = false,
}: FilterToolbarProps) {
  const { t, lang } = useI18n();
  const th = lang === 'th';
  const tx = (en: string, thText: string) => (th ? thText : en);
  const hasFilters =
    venueFilter !== 'all' || resultFilter !== 'all' || searchQuery.trim() !== '';

  return (
    <div
      className={`flex flex-wrap items-center gap-2.5 ${
        compact ? 'px-4 py-2.5' : 'px-4 py-3 sm:px-5'
      }`}
    >
      {/* Venue pills */}
      <div
        role="group"
        aria-label={tx('Venue filter', 'กรองสนาม')}
        className="inline-flex items-center gap-0.5 rounded-full border border-border bg-bg-secondary p-0.5"
      >
        {(['all', 'Home', 'Away'] as const).map((v) => {
          const active = venueFilter === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onVenueChange(v)}
              aria-pressed={active}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${
                active
                  ? 'bg-surface text-primary shadow-sm ring-1 ring-border/70'
                  : 'text-muted hover:text-primary'
              }`}
            >
              {v === 'all' ? tx('All venues', 'ทุกสนาม') : t(`matchLog.venue.${v}`)}
            </button>
          );
        })}
      </div>

      {/* Result pills */}
      <div
        role="group"
        aria-label={tx('Result filter', 'กรองผลการแข่งขัน')}
        className="inline-flex items-center gap-0.5 rounded-full border border-border bg-bg-secondary p-0.5"
      >
        {(['all', 'W', 'D', 'L'] as const).map((r) => {
          const active = resultFilter === r;
          const activeClass =
            r === 'W'
              ? 'bg-success-soft text-success ring-1 ring-success/25'
              : r === 'L'
                ? 'bg-danger-soft text-danger ring-1 ring-danger/25'
                : r === 'D'
                  ? 'bg-surface text-primary shadow-sm ring-1 ring-border/70'
                  : 'bg-surface text-primary shadow-sm ring-1 ring-border/70';
          return (
            <button
              key={r}
              type="button"
              onClick={() => onResultChange(r)}
              aria-pressed={active}
              className={`rounded-full px-2.5 py-1 text-xs font-bold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${
                active ? activeClass : 'text-muted hover:text-primary'
              }`}
            >
              {r === 'all' ? tx('All', 'ทุกผล') : r}
            </button>
          );
        })}
      </div>

      {/* Opponent search */}
      <div className="relative min-w-[180px] flex-1 sm:max-w-[260px]">
        <Search
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={tx('Search opponent…', 'ค้นหาคู่แข่ง…')}
          className="w-full rounded-full border border-border bg-surface py-1.5 pl-8 pr-8 text-xs font-medium text-primary placeholder:text-muted transition-colors focus:border-brand focus:outline-none"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label={tx('Clear search', 'ล้างคำค้นหา')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-primary"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Count + Reset */}
      <div className="ml-auto flex items-center gap-2 text-xs text-muted">
        <span className="tabular-nums">
          {hasFilters
            ? tx(
                `${shownCount} of ${totalCount} matches`,
                `แสดง ${shownCount} จาก ${totalCount} นัด`,
              )
            : `${totalCount} ${t('matchLog.matches')}`}
        </span>
        {hasFilters && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand-soft/60 px-2.5 py-1 text-[11px] font-semibold text-brand transition-colors hover:bg-brand-soft"
          >
            <RotateCcw size={11} />
            <span>{tx('Reset', 'ล้าง')}</span>
          </button>
        )}
      </div>
    </div>
  );
}

function ScoresKpiRibbon({
  rows,
  nextMatch,
  upcomingCount,
}: {
  rows: MatchRow[];
  nextMatch: MatchRow | null;
  upcomingCount: number;
}) {
  const { t, lang } = useI18n();
  const th = lang === 'th';
  const tx = (en: string, thText: string) => (th ? thText : en);

  const stats = useMemo(() => {
    const played = rows.filter((m) => m.result != null);
    const mp = played.length;
    const w = played.filter((m) => m.result === 'W').length;
    const d = played.filter((m) => m.result === 'D').length;
    const l = played.filter((m) => m.result === 'L').length;
    const gf = played.reduce((acc, m) => acc + (m.gf ?? 0), 0);
    const ga = played.reduce((acc, m) => acc + (m.ga ?? 0), 0);
    const gd = gf - ga;
    const pts = w * 3 + d;
    const cs = played.filter((m) => m.ga === 0).length;
    const fts = played.filter((m) => m.gf === 0).length;
    const xgRows = played.filter((m) => m.xg != null && m.xga != null);
    const xg = xgRows.length ? xgRows.reduce((acc, m) => acc + (m.xg ?? 0), 0) : null;
    const xga = xgRows.length ? xgRows.reduce((acc, m) => acc + (m.xga ?? 0), 0) : null;
    const xgGf = xgRows.length ? xgRows.reduce((acc, m) => acc + (m.gf ?? 0), 0) : null;
    const possRows = played.filter((m) => m.possession != null);
    const avgPoss = possRows.length
      ? possRows.reduce((acc, m) => acc + (m.possession ?? 0), 0) / possRows.length
      : null;

    return {
      mp,
      w,
      d,
      l,
      gf,
      ga,
      gd,
      pts,
      winPct: mp > 0 ? (w / mp) * 100 : null,
      ppg: mp > 0 ? pts / mp : null,
      gfPerMp: mp > 0 ? gf / mp : null,
      gaPerMp: mp > 0 ? ga / mp : null,
      cs,
      csPct: mp > 0 ? (cs / mp) * 100 : null,
      fts,
      xg,
      xga,
      xgCount: xgRows.length,
      xgDelta: xg != null && xgGf != null ? xgGf - xg : null,
      avgPoss,
    };
  }, [rows]);

  const nextBk = nextMatch ? bkkKickoff(nextMatch.date, nextMatch.time) : null;
  const nextComp = nextMatch
    ? COMP_SHORT[nextMatch.competition] ?? nextMatch.competition
    : '';

  return (
    <section className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {/* 1. Played + W-D-L visual bar */}
        <article className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
              {tx('Played & Record', 'แข่งแล้ว & สถิติ')}
            </span>
            {upcomingCount > 0 && (
              <span className="rounded-md bg-brand-soft px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-brand">
                +{upcomingCount} {tx('left', 'นัด')}
              </span>
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-2.5">
            <span className="font-display text-2xl font-bold tabular-nums text-primary">
              {stats.mp}
            </span>
            <span className="text-xs font-bold tabular-nums">
              <span className="text-success">{stats.w}W</span>{' '}
              <span className="text-muted">{stats.d}D</span>{' '}
              <span className="text-danger">{stats.l}L</span>
            </span>
          </div>
          <div className="mt-3">
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-bg-secondary">
              {stats.mp > 0 && (
                <>
                  <div
                    className="bg-success transition-all"
                    style={{ width: `${(stats.w / stats.mp) * 100}%` }}
                  />
                  <div
                    className="bg-chart-neutral transition-all"
                    style={{ width: `${(stats.d / stats.mp) * 100}%` }}
                  />
                  <div
                    className="bg-danger transition-all"
                    style={{ width: `${(stats.l / stats.mp) * 100}%` }}
                  />
                </>
              )}
            </div>
          </div>
        </article>

        {/* 2. Win % & PPG */}
        <article className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
            {tx('Win Rate', 'อัตราชนะ')}
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold tabular-nums text-primary">
              {stats.winPct != null ? `${fmt(stats.winPct, 2)}%` : '—'}
            </span>
          </div>
          <p className="mt-2 text-xs tabular-nums text-muted">
            {stats.ppg != null
              ? tx(
                  `${fmt(stats.ppg, 2)} pts/gm · ${stats.pts} pts`,
                  `${fmt(stats.ppg, 2)} แต้ม/นัด · ${stats.pts} แต้ม`,
                )
              : '—'}
          </p>
        </article>

        {/* 3. Goals For : Against (GD) */}
        <article className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
              {tx('Goals (GF : GA)', 'ประตูได้ : เสีย')}
            </span>
            {stats.mp > 0 && (
              <span
                className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
                  stats.gd > 0
                    ? 'bg-success-soft text-success'
                    : stats.gd < 0
                      ? 'bg-danger-soft text-danger'
                      : 'bg-bg-secondary text-muted'
                }`}
              >
                {stats.gd > 0 ? `+${stats.gd}` : stats.gd} GD
              </span>
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-1.5 font-display text-2xl font-bold tabular-nums text-primary">
            <span>{stats.mp > 0 ? stats.gf : '—'}</span>
            <span className="text-base text-muted">:</span>
            <span className="text-secondary">{stats.mp > 0 ? stats.ga : '—'}</span>
          </div>
          <p className="mt-2 text-xs tabular-nums text-muted">
            {stats.gfPerMp != null && stats.gaPerMp != null
              ? tx(
                  `${fmt(stats.gfPerMp, 2)} / ${fmt(stats.gaPerMp, 2)} per game`,
                  `${fmt(stats.gfPerMp, 2)} / ${fmt(stats.gaPerMp, 2)} ต่อนัด`,
                )
              : '—'}
          </p>
        </article>

        {/* 4. xG : xGA (when available) or Avg Possession fallback */}
        <article className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none">
          {stats.xg != null && stats.xga != null ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  xG : xGA
                </span>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                    stats.xg - stats.xga > 0
                      ? 'bg-success-soft text-success'
                      : stats.xg - stats.xga < 0
                        ? 'bg-danger-soft text-danger'
                        : 'bg-bg-secondary text-muted'
                  }`}
                >
                  {signed(stats.xg - stats.xga, 2)} xGD
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5 font-display text-2xl font-bold tabular-nums text-primary">
                <span>{fmt(stats.xg, 2)}</span>
                <span className="text-base text-muted">:</span>
                <span className="text-secondary">{fmt(stats.xga, 2)}</span>
              </div>
              <p className="mt-2 text-xs tabular-nums text-muted">
                {stats.xgDelta != null
                  ? `G−xG ${signed(stats.xgDelta, 2)} · PL (${stats.xgCount})`
                  : `PL (${stats.xgCount})`}
              </p>
            </>
          ) : (
            <>
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                {tx('Avg Possession', 'ครองบอลเฉลี่ย')}
              </span>
              <div className="mt-2 font-display text-2xl font-bold tabular-nums text-primary">
                {stats.avgPoss != null ? `${fmt(stats.avgPoss, 2)}%` : '—'}
              </div>
              <p className="mt-2 text-xs text-muted">
                {tx('xG available for PL only', 'xG มีเฉพาะพรีเมียร์ลีก')}
              </p>
            </>
          )}
        </article>

        {/* 5. Clean Sheets */}
        <article className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
              {tx('Clean Sheets', 'คลีนชีต')}
            </span>
            <Shield size={14} className="text-brand/70" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold tabular-nums text-primary">
              {stats.mp > 0 ? stats.cs : '—'}
            </span>
            {stats.csPct != null && (
              <span className="text-xs font-semibold tabular-nums text-success">
                {fmt(stats.csPct, 2)}%
              </span>
            )}
          </div>
          <p className="mt-2 text-xs tabular-nums text-muted">
            {stats.mp > 0
              ? tx(
                  `Failed to score: ${stats.fts}`,
                  `ยิงไม่ได้: ${stats.fts} นัด`,
                )
              : '—'}
          </p>
        </article>
      </div>

      {/* Next Upcoming Match Spotlight Pill */}
      {nextMatch && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/25 bg-brand-soft/45 px-4 py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              <Sparkles size={11} />
              <span>{tx('Next Fixture', 'นัดถัดไป')}</span>
            </span>
            <span className="rounded-md bg-surface px-2 py-0.5 text-[11px] font-bold text-primary ring-1 ring-border">
              {nextComp}
            </span>
            {nextMatch.round && (
              <span className="text-xs font-medium text-secondary">
                {nextMatch.round}
              </span>
            )}
            <span className="text-border">•</span>
            <span className="text-sm font-bold text-primary">
              {nextMatch.venue ? `${t(`matchLog.venue.${nextMatch.venue}`)} vs ` : 'vs '}
              <span className="text-brand">{nextMatch.opponent ?? '—'}</span>
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-semibold tabular-nums text-primary">
              <Calendar size={12} className="text-brand" />
              <span>{nextBk?.date ?? formatDate(nextMatch.date)}</span>
            </span>
            {(nextBk?.time ?? nextMatch.time) && (
              <span className="inline-flex items-center gap-1 rounded-lg border border-brand/25 bg-surface px-2.5 py-1 text-xs font-bold tabular-nums text-brand">
                <Clock size={12} />
                <span>{nextBk?.time ?? nextMatch.time}</span>
                {nextBk && <span className="text-[10px] font-semibold opacity-75">UTC+7</span>}
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function MiscKpiRibbon({
  table,
  rows,
  sideLabel,
}: {
  table: MatchlogTable;
  rows: string[][];
  sideLabel: string;
}) {
  const { lang } = useI18n();
  const th = lang === 'th';
  const tx = (en: string, thText: string) => (th ? thText : en);

  const summary = useMemo(() => {
    const n = rows.length;
    const crdY = sumColumn(table, rows, ['CrdY']);
    const crdR = sumColumn(table, rows, ['CrdR']);
    const crd2Y = sumColumn(table, rows, ['2CrdY']);
    const fls = sumColumn(table, rows, ['Fls']);
    const fld = sumColumn(table, rows, ['Fld']);
    const off = sumColumn(table, rows, ['Off']);
    const crs = sumColumn(table, rows, ['Crs', 'CK', 'Corners']);
    const inter = sumColumn(table, rows, ['Int']);
    const tklw = sumColumn(table, rows, ['TklW']);

    return { n, crdY, crdR, crd2Y, fls, fld, off, crs, inter, tklw };
  }, [table, rows]);

  const n = summary.n;
  const foulsTotal = (summary.fls?.total ?? 0) + (summary.fld?.total ?? 0);
  const flsShare = foulsTotal > 0 ? ((summary.fls?.total ?? 0) / foulsTotal) * 100 : 50;

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {/* 1. Yellow Cards */}
      <article className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
            {tx('Yellow Cards', 'ใบเหลือง')}
          </span>
          <span className="h-4 w-3 rounded-[2px] bg-warning shadow-xs" aria-hidden />
        </div>
        <div className="mt-2 font-display text-2xl font-bold tabular-nums text-primary">
          {summary.crdY && summary.crdY.count > 0 ? fmt(summary.crdY.total, 0) : '—'}
        </div>
        <p className="mt-2 text-xs tabular-nums text-muted">
          {summary.crdY && summary.crdY.count > 0
            ? tx(
                `${fmt(summary.crdY.total / summary.crdY.count, 2)} / match`,
                `${fmt(summary.crdY.total / summary.crdY.count, 2)} / นัด`,
              )
            : sideLabel}
        </p>
      </article>

      {/* 2. Red Cards */}
      <article className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
            {tx('Red Cards', 'ใบแดง')}
          </span>
          <span className="h-4 w-3 rounded-[2px] bg-danger shadow-xs" aria-hidden />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span
            className={`font-display text-2xl font-bold tabular-nums ${
              summary.crdR && summary.crdR.total > 0 ? 'text-danger' : 'text-primary'
            }`}
          >
            {summary.crdR && summary.crdR.count > 0 ? fmt(summary.crdR.total, 0) : '—'}
          </span>
          {summary.crd2Y && summary.crd2Y.total > 0 && (
            <span className="rounded bg-danger-soft px-1.5 py-0.5 text-[10px] font-bold text-danger">
              {fmt(summary.crd2Y.total, 0)} 2Y
            </span>
          )}
        </div>
        <p className="mt-2 text-xs tabular-nums text-muted">
          {summary.crdR && summary.crdR.count > 0
            ? tx(
                `${fmt(summary.crdR.total / summary.crdR.count, 2)} / match`,
                `${fmt(summary.crdR.total / summary.crdR.count, 2)} / นัด`,
              )
            : sideLabel}
        </p>
      </article>

      {/* 3. Fouls Committed vs Drawn */}
      <article className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
            {tx('Fouls (Com : Drw)', 'ฟาวล์ (ทำ : โดน)')}
          </span>
        </div>
        <div className="mt-2 flex items-baseline gap-1.5 font-display text-2xl font-bold tabular-nums text-primary">
          <span>{summary.fls && summary.fls.count > 0 ? fmt(summary.fls.total, 0) : '—'}</span>
          <span className="text-base text-muted">:</span>
          <span className="text-secondary">
            {summary.fld && summary.fld.count > 0 ? fmt(summary.fld.total, 0) : '—'}
          </span>
        </div>
        {foulsTotal > 0 ? (
          <div className="mt-2 space-y-1">
            <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-bg-secondary">
              <div className="bg-warning" style={{ width: `${flsShare}%` }} />
              <div className="bg-info" style={{ width: `${100 - flsShare}%` }} />
            </div>
            <p className="text-[11px] tabular-nums text-muted">
              {fmt((summary.fls?.total ?? 0) / Math.max(1, summary.fls?.count ?? n), 2)} :{' '}
              {fmt((summary.fld?.total ?? 0) / Math.max(1, summary.fld?.count ?? n), 2)}{' '}
              {tx('/ gm', '/ นัด')}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted">—</p>
        )}
      </article>

      {/* 4. Offsides */}
      <article className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
            {tx('Offsides', 'ล้ำหน้า')}
          </span>
          <Flag size={13} className="text-muted" />
        </div>
        <div className="mt-2 font-display text-2xl font-bold tabular-nums text-primary">
          {summary.off && summary.off.count > 0 ? fmt(summary.off.total, 0) : '—'}
        </div>
        <p className="mt-2 text-xs tabular-nums text-muted">
          {summary.off && summary.off.count > 0
            ? tx(
                `${fmt(summary.off.total / summary.off.count, 2)} / match`,
                `${fmt(summary.off.total / summary.off.count, 2)} / นัด`,
              )
            : '—'}
        </p>
      </article>

      {/* 5. Crosses / Corners */}
      <article className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
            {summary.crs?.col === 'CK' || summary.crs?.col === 'Corners'
              ? tx('Corners', 'เตะมุม')
              : tx('Crosses', 'ครอสบอล')}
          </span>
          <Target size={13} className="text-brand/70" />
        </div>
        <div className="mt-2 font-display text-2xl font-bold tabular-nums text-primary">
          {summary.crs && summary.crs.count > 0 ? fmt(summary.crs.total, 0) : '—'}
        </div>
        <p className="mt-2 text-xs tabular-nums text-muted">
          {summary.crs && summary.crs.count > 0
            ? tx(
                `${fmt(summary.crs.total / summary.crs.count, 2)} / match`,
                `${fmt(summary.crs.total / summary.crs.count, 2)} / นัด`,
              )
            : '—'}
        </p>
      </article>

      {/* 6. Interceptions & Tackles Won */}
      <article className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
            {tx('Int · Tkl Won', 'สกัด · แท็กเกิล')}
          </span>
          <Shield size={13} className="text-info" />
        </div>
        <div className="mt-2 flex items-baseline gap-1.5 font-display text-2xl font-bold tabular-nums text-primary">
          <span>{summary.inter && summary.inter.count > 0 ? fmt(summary.inter.total, 0) : '—'}</span>
          <span className="text-base text-muted">·</span>
          <span className="text-secondary">
            {summary.tklw && summary.tklw.count > 0 ? fmt(summary.tklw.total, 0) : '—'}
          </span>
        </div>
        <p className="mt-2 text-xs tabular-nums text-muted">
          {summary.inter && summary.inter.count > 0 && summary.tklw && summary.tklw.count > 0
            ? `${fmt(summary.inter.total / summary.inter.count, 2)} · ${fmt(
                summary.tklw.total / summary.tklw.count,
                2,
              )} ${tx('/ gm', '/ นัด')}`
            : '—'}
        </p>
      </article>
    </section>
  );
}

/**
 * Embedded matchlog panel (used inside AttackDashboard / DefenseDashboard).
 * Preserves exact exported signature `{ type, titleKey, group }`.
 */
export function MatchlogPanel({
  type,
  titleKey,
  group,
}: {
  type: MatchlogPanelType;
  titleKey: string;
  group?: CompGroup;
}) {
  const { t } = useI18n();
  const { club } = useClub();
  const { matches } = useClubData();
  const seasons = useMemo(
    () => [...new Set(matches.map((m) => m.season))].sort(),
    [matches],
  );
  const [selectedSeason, setSelectedSeason] = useState(
    seasons[seasons.length - 1] ?? '',
  );
  const season = seasons.includes(selectedSeason)
    ? selectedSeason
    : (seasons[seasons.length - 1] ?? '');

  const [internalGroup, setInternalGroup] = useState<CompGroup>('all');
  const controlled = group !== undefined;
  const activeGroup = group ?? internalGroup;
  const [side, setSide] = useState<'for' | 'against'>('for');
  const [venueFilter, setVenueFilter] = useState<VenueFilter>('all');
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loaded, setLoaded] = useState<
    { key: string; data: SeasonMatchlogs } | typeof LOAD_FAILED | null
  >(null);

  const cacheKey = `${club.slug}|${season}`;

  const fetchSeason = (s: string) => {
    const k = `${club.slug}|${s}`;
    loadMatchlogs(club.slug, s).then((data) =>
      setLoaded(data === LOAD_FAILED ? LOAD_FAILED : { key: k, data }),
    );
  };

  useEffect(() => {
    if (type === 'scores' || !season) return;
    let live = true;
    loadMatchlogs(club.slug, season).then((data) => {
      if (live) {
        setLoaded(data === LOAD_FAILED ? LOAD_FAILED : { key: cacheKey, data });
      }
    });
    return () => {
      live = false;
    };
  }, [club.slug, season, type, cacheKey]);

  const allScoreRows = useMemo(
    () => (type === 'scores' ? matchesForSeason(matches, season, activeGroup) : []),
    [type, matches, season, activeGroup],
  );

  const filteredScoreRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allScoreRows.filter((m) => {
      if (venueFilter !== 'all' && m.venue !== venueFilter) return false;
      if (resultFilter !== 'all' && m.result !== resultFilter) return false;
      if (q && !(m.opponent ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allScoreRows, venueFilter, resultFilter, searchQuery]);

  const showComp = activeGroup === 'all' || activeGroup === 'europe';

  const loadedData = loaded === LOAD_FAILED ? null : loaded;
  const loading =
    type !== 'scores' &&
    (loaded === null || (loaded !== LOAD_FAILED && loaded.key !== cacheKey));
  const statTable =
    type !== 'scores' && !loading ? loadedData?.data[type]?.[side] : undefined;

  const statTotalInGroup = useMemo(
    () => (statTable ? filterStatRows(statTable, activeGroup).length : 0),
    [statTable, activeGroup],
  );
  const statShownCount = useMemo(
    () =>
      statTable
        ? filterStatRows(statTable, activeGroup, venueFilter, resultFilter, searchQuery).length
        : 0,
    [statTable, activeGroup, venueFilter, resultFilter, searchQuery],
  );

  const resetFilters = () => {
    setVenueFilter('all');
    setResultFilter('all');
    setSearchQuery('');
  };

  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm dark:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-elevated/50 px-4 py-3">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <h2 className="truncate font-display text-lg font-bold text-primary">
            {t(titleKey)}
          </h2>
          <span className="whitespace-nowrap rounded-md bg-bg-secondary px-2 py-0.5 text-xs font-semibold tabular-nums text-muted">
            {type === 'scores'
              ? `${filteredScoreRows.length} ${t('matchLog.matches')}`
              : statTable
                ? `${statShownCount} ${t('matchLog.matches')}`
                : '—'}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs text-muted">
          {type !== 'scores' && <SideToggle side={side} onChange={setSide} />}
          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-2.5 py-1">
            <label
              htmlFor={`matchlog-season-${type}`}
              className="text-[10px] font-bold uppercase tracking-wider text-muted"
            >
              {t('table.season')}
            </label>
            <select
              id={`matchlog-season-${type}`}
              value={season}
              onChange={(e) => setSelectedSeason(e.target.value)}
              className="bg-transparent text-xs font-semibold text-primary focus:outline-none"
            >
              {[...seasons].reverse().map((s) => (
                <option key={s} value={s} className="bg-surface text-primary">
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!controlled && (
        <div className="flex min-w-0 items-center gap-2 overflow-x-auto border-b border-border px-4 pt-2.5">
          <CompetitionTabs group={activeGroup} onChange={setInternalGroup} />
        </div>
      )}

      <div className="border-b border-border bg-bg-secondary/30">
        <FilterToolbar
          venueFilter={venueFilter}
          onVenueChange={setVenueFilter}
          resultFilter={resultFilter}
          onResultChange={setResultFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onReset={resetFilters}
          shownCount={type === 'scores' ? filteredScoreRows.length : statShownCount}
          totalCount={type === 'scores' ? allScoreRows.length : statTotalInGroup}
          compact
        />
      </div>

      {type === 'scores' ? (
        filteredScoreRows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">{t('matchLog.noData')}</p>
        ) : (
          <ScoresList rows={filteredScoreRows} showComp={showComp} contained={false} />
        )
      ) : loading ? (
        <TableLoadingSkeleton rows={6} />
      ) : loaded === LOAD_FAILED ? (
        <LoadFail onRetry={() => fetchSeason(season)} />
      ) : statTable ? (
        <StatTable
          table={statTable}
          group={activeGroup}
          venueFilter={venueFilter}
          resultFilter={resultFilter}
          searchQuery={searchQuery}
        />
      ) : (
        <p className="px-4 py-8 text-center text-sm text-muted">{t('matchLog.noStatData')}</p>
      )}
    </div>
  );
}

/**
 * Full-page redesigned browser for /[club]/matches (type="scores")
 * and /[club]/misc (type="misc").
 */
export function MatchlogBrowser({
  type,
  titleKey,
}: {
  type: MatchlogPanelType;
  titleKey: string;
}) {
  const { t, lang } = useI18n();
  const th = lang === 'th';
  const tx = (en: string, thText: string) => (th ? thText : en);
  const { club } = useClub();
  const { matches } = useClubData();

  const seasons = useMemo(
    () => [...new Set(matches.map((m) => m.season))].sort(),
    [matches],
  );
  const latestSeason = seasons[seasons.length - 1] ?? '';

  const [selectedSeason, setSelectedSeason] = useState(latestSeason);
  const season = seasons.includes(selectedSeason) ? selectedSeason : latestSeason;

  const [activeGroup, setActiveGroup] = useState<CompGroup>('all');
  const [side, setSide] = useState<'for' | 'against'>('for');
  const [venueFilter, setVenueFilter] = useState<VenueFilter>('all');
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [newestFirst, setNewestFirst] = useState(false);

  const [loaded, setLoaded] = useState<
    { key: string; data: SeasonMatchlogs } | typeof LOAD_FAILED | null
  >(null);

  const cacheKey = `${club.slug}|${season}`;

  const fetchSeason = (s: string) => {
    const k = `${club.slug}|${s}`;
    loadMatchlogs(club.slug, s).then((data) =>
      setLoaded(data === LOAD_FAILED ? LOAD_FAILED : { key: k, data }),
    );
  };

  useEffect(() => {
    if (type === 'scores' || !season) return;
    let live = true;
    loadMatchlogs(club.slug, season).then((data) => {
      if (live) {
        setLoaded(data === LOAD_FAILED ? LOAD_FAILED : { key: cacheKey, data });
      }
    });
    return () => {
      live = false;
    };
  }, [club.slug, season, type, cacheKey]);

  const seasonMatchesInGroup = useMemo(
    () => matchesForSeason(matches, season, activeGroup),
    [matches, season, activeGroup],
  );

  const upcomingInSeason = useMemo(
    () => seasonMatchesInGroup.filter((m) => m.result == null),
    [seasonMatchesInGroup],
  );
  const nextMatch = upcomingInSeason[0] ?? null;

  const filteredScoreRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = seasonMatchesInGroup.filter((m) => {
      if (venueFilter !== 'all' && m.venue !== venueFilter) return false;
      if (resultFilter !== 'all' && m.result !== resultFilter) return false;
      if (q && !(m.opponent ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
    return newestFirst ? [...filtered].reverse() : filtered;
  }, [seasonMatchesInGroup, venueFilter, resultFilter, searchQuery, newestFirst]);

  const loadedData = loaded === LOAD_FAILED ? null : loaded;
  const loading =
    type !== 'scores' &&
    (loaded === null || (loaded !== LOAD_FAILED && loaded.key !== cacheKey));
  const statTable =
    type !== 'scores' && !loading ? loadedData?.data[type]?.[side] : undefined;

  const statTotalInGroup = useMemo(
    () => (statTable ? filterStatRows(statTable, activeGroup) : []),
    [statTable, activeGroup],
  );
  const statFilteredRows = useMemo(
    () =>
      statTable
        ? filterStatRows(statTable, activeGroup, venueFilter, resultFilter, searchQuery)
        : [],
    [statTable, activeGroup, venueFilter, resultFilter, searchQuery],
  );

  const clubDisplayName = th && club.nameTh ? club.nameTh : club.name;
  const showComp = activeGroup === 'all' || activeGroup === 'europe';
  const isCurrentSeason = season === latestSeason;

  const eyebrow =
    type === 'scores'
      ? tx('Club Match Archive', 'คลังผลการแข่งขันและโปรแกรม')
      : type === 'misc'
        ? tx('Discipline & Misc Logs', 'สถิติวินัยและรายละเอียดรายนัด')
        : tx('Match-by-Match Logs', 'สถิติรายนัด');

  const subtitle =
    type === 'scores'
      ? tx(
          'Every fixture, result, xG, and Bangkok kickoff time — click any completed match to open the full match dossier.',
          'ครบทุกผลการแข่งขัน โปรแกรมล่วงหน้า ค่า xG และเวลาแข่งไทย (UTC+7) — คลิกนัดที่แข่งแล้วเพื่อเปิดรายละเอียดแมตช์',
        )
      : type === 'misc'
        ? tx(
            'Match-level discipline and physical output: yellow & red cards, fouls committed vs drawn, offsides, crosses, and tackles.',
            'เจาะลึกวินัยและสถิติเสริมรายนัด: ใบเหลือง-แดง ฟาวล์ที่ทำและโดน ล้ำหน้า การครอส และการเข้าสกัด',
          )
        : tx(
            'Match-by-match performance breakdown across competitions.',
            'สรุปสถิติรายนัดแยกตามรายการแข่งขัน',
          );

  const resetFilters = () => {
    setVenueFilter('all');
    setResultFilter('all');
    setSearchQuery('');
  };

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 pb-16 pt-6 sm:px-6 lg:px-10">
      {/* -------------------------------------------------- Editorial Masthead */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div className="flex min-w-0 items-start gap-3.5 sm:gap-4">
          <ClubLogo slug={club.slug} name={clubDisplayName} size={44} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
              <span className="text-brand">{eyebrow}</span>
              <span className="text-border">•</span>
              <span className="truncate">{clubDisplayName}</span>
              <span className="text-border">•</span>
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold tracking-normal ${
                  isCurrentSeason
                    ? 'bg-success-soft text-success'
                    : 'bg-bg-secondary text-muted'
                }`}
              >
                {isCurrentSeason
                  ? tx('In Progress', 'กำลังแข่งขัน')
                  : tx('Archive', 'ฤดูกาลที่ผ่านมา')}
              </span>
            </div>
            <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-primary sm:text-4xl">
              {t(titleKey)}
              {season ? (
                <span className="ml-2.5 text-2xl font-semibold text-muted sm:text-3xl">
                  {seasonShort(season)}
                </span>
              ) : null}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-secondary">{subtitle}</p>
          </div>
        </div>

        {/* Season selector + Share */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 shadow-sm dark:shadow-none">
            <label
              htmlFor="browser-season"
              className="text-[11px] font-bold uppercase tracking-wider text-muted"
            >
              {t('table.season')}
            </label>
            <select
              id="browser-season"
              value={season}
              onChange={(e) => setSelectedSeason(e.target.value)}
              className="bg-transparent text-sm font-bold text-primary focus:outline-none"
            >
              {[...seasons].reverse().map((s) => (
                <option key={s} value={s} className="bg-surface text-primary">
                  {s}
                </option>
              ))}
            </select>
          </div>
          <ShareBtn />
        </div>
      </header>

      {/* -------------------------------------------------- Season Summary KPI Ribbon */}
      {type === 'scores' ? (
        <ScoresKpiRibbon
          rows={filteredScoreRows}
          nextMatch={nextMatch}
          upcomingCount={upcomingInSeason.length}
        />
      ) : type === 'misc' ? (
        loading ? (
          <KpiSkeletonRibbon count={6} />
        ) : statTable ? (
          <MiscKpiRibbon
            table={statTable}
            rows={statFilteredRows}
            sideLabel={
              side === 'for'
                ? club.shortName ?? clubDisplayName
                : t('matchLog.side.against')
            }
          />
        ) : null
      ) : null}

      {/* -------------------------------------------------- Main Interactive Card */}
      <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm dark:shadow-none">
        {/* Competition tabs + SideToggle / Order toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-elevated/40 px-4 pt-3 sm:px-5">
          <CompetitionTabs group={activeGroup} onChange={setActiveGroup} />

          <div className="mb-2 flex items-center gap-2">
            {type === 'scores' ? (
              <button
                type="button"
                onClick={() => setNewestFirst((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-secondary transition-colors hover:border-brand/40 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
              >
                <ArrowDownUp size={12} className="text-brand" />
                <span>
                  {newestFirst
                    ? tx('Newest first', 'ล่าสุดขึ้นก่อน')
                    : tx('Oldest first', 'เรียงตามปฏิทิน')}
                </span>
              </button>
            ) : (
              <SideToggle side={side} onChange={setSide} />
            )}
          </div>
        </div>

        {/* Venue + Result + Opponent search toolbar */}
        <div className="border-b border-border bg-bg-secondary/30">
          <FilterToolbar
            venueFilter={venueFilter}
            onVenueChange={setVenueFilter}
            resultFilter={resultFilter}
            onResultChange={setResultFilter}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onReset={resetFilters}
            shownCount={
              type === 'scores' ? filteredScoreRows.length : statFilteredRows.length
            }
            totalCount={
              type === 'scores'
                ? seasonMatchesInGroup.length
                : statTotalInGroup.length
            }
          />
        </div>

        {/* Table / Match list body */}
        {type === 'scores' ? (
          filteredScoreRows.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-semibold text-secondary">{t('matchLog.noData')}</p>
              <p className="mt-1 text-xs text-muted">
                {tx(
                  'Try changing the season, competition, venue, result, or search term.',
                  'ลองเปลี่ยนฤดูกาล รายการ สนาม ผลการแข่งขัน หรือคำค้นหา',
                )}
              </p>
            </div>
          ) : (
            <ScoresList rows={filteredScoreRows} showComp={showComp} contained={false} />
          )
        ) : loading ? (
          <TableLoadingSkeleton rows={10} />
        ) : loaded === LOAD_FAILED ? (
          <LoadFail onRetry={() => fetchSeason(season)} />
        ) : statTable ? (
          <StatTable
            table={statTable}
            group={activeGroup}
            venueFilter={venueFilter}
            resultFilter={resultFilter}
            searchQuery={searchQuery}
            contained={false}
          />
        ) : (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-semibold text-secondary">{t('matchLog.noStatData')}</p>
          </div>
        )}
      </section>
    </main>
  );
}
