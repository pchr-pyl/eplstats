'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { useClub } from './ClubProvider';
import type { MatchRow, CompGroup, MatchlogType, SeasonMatchlogs } from '@/lib/types';
import { matchesForSeason } from '@/lib/stats';
import {
  loadMatchlogs,
  StatTable,
  ScoresList,
  SideToggle,
  LoadFail,
  LOAD_FAILED,
  type VenueFilter,
  type ResultFilter,
} from './matchlog-shared';

type TabKey = 'scores' | MatchlogType;
const TABS: TabKey[] = ['scores', 'shooting', 'keeper', 'misc'];
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

function TableSkeleton() {
  return (
    <div className="space-y-2.5 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-8 animate-pulse rounded-lg bg-bg-secondary"
          style={{ opacity: 1 - i * 0.12 }}
        />
      ))}
    </div>
  );
}

export function MatchLog({
  matches,
  season,
  group,
  onClose,
}: {
  matches: MatchRow[];
  season: string;
  group: CompGroup;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const th = lang === 'th';
  const tx = (en: string, thText: string) => (th ? thText : en);
  const { club } = useClub();
  const [tab, setTab] = useState<TabKey>('scores');
  const [side, setSide] = useState<'for' | 'against'>('for');
  const [venueFilter, setVenueFilter] = useState<VenueFilter>('all');
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [matchlogs, setMatchlogs] = useState<
    { key: string; data: SeasonMatchlogs } | typeof LOAD_FAILED | null
  >(null);

  const cacheKey = `${club.slug}|${season}`;
  const allRows = useMemo(
    () => matchesForSeason(matches, season, group),
    [matches, season, group],
  );
  const showComp = group === 'all' || group === 'europe';

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allRows.filter((m) => {
      if (venueFilter !== 'all' && m.venue !== venueFilter) return false;
      if (resultFilter !== 'all' && m.result !== resultFilter) return false;
      if (q && !(m.opponent ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allRows, venueFilter, resultFilter, searchQuery]);

  const w = allRows.filter((m) => m.result === 'W').length;
  const d = allRows.filter((m) => m.result === 'D').length;
  const l = allRows.filter((m) => m.result === 'L').length;
  const played = w + d + l;

  useEffect(() => {
    if (tab === 'scores') return;
    let live = true;
    loadMatchlogs(club.slug, season).then((data) => {
      if (live) {
        setMatchlogs(data === LOAD_FAILED ? LOAD_FAILED : { key: cacheKey, data });
      }
    });
    return () => {
      live = false;
    };
  }, [tab, club.slug, season, cacheKey]);

  const loading =
    tab !== 'scores' &&
    (matchlogs === null ||
      (matchlogs !== LOAD_FAILED && matchlogs.key !== cacheKey));
  const statTable =
    tab !== 'scores' && !loading && matchlogs !== LOAD_FAILED && matchlogs !== null
      ? matchlogs.data[tab]?.[side]
      : undefined;

  const hasFilter = venueFilter !== 'all' || resultFilter !== 'all' || searchQuery.trim() !== '';

  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-lg dark:shadow-none">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-border bg-surface-elevated/60 px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface p-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${BASE_PATH}/logos/${club.slug}.png`}
              alt={club.name}
              width={24}
              height={24}
              className="h-6 w-6 object-contain"
            />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-2">
              <h3 className="truncate font-display text-lg font-bold text-primary">
                {season} · {t(`competitions.${group}`)}
              </h3>
              <span className="whitespace-nowrap text-xs font-medium tabular-nums text-muted">
                {allRows.length} {t('matchLog.matches')}
              </span>
            </div>
            {played > 0 && (
              <div className="mt-1 flex items-center gap-2">
                <div className="flex items-center gap-1 text-[11px] font-bold tabular-nums">
                  <span className="text-success">{w}W</span>
                  <span className="text-muted">{d}D</span>
                  <span className="text-danger">{l}L</span>
                </div>
                <div className="flex h-1.5 w-24 overflow-hidden rounded-full bg-bg-secondary">
                  <div className="bg-success" style={{ width: `${(w / played) * 100}%` }} />
                  <div className="bg-chart-neutral" style={{ width: `${(d / played) * 100}%` }} />
                  <div className="bg-danger" style={{ width: `${(l / played) * 100}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-muted transition-colors hover:border-brand/40 hover:bg-bg-secondary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          aria-label={t('matchLog.close')}
        >
          <X size={16} />
        </button>
      </div>

      {/* Tabs + SideToggle */}
      <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto border-b border-border px-4 py-2">
        {TABS.map((k) => {
          const active = k === tab;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              aria-pressed={active}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${
                active
                  ? 'bg-brand-soft text-brand'
                  : 'text-secondary hover:bg-bg-secondary hover:text-primary'
              }`}
            >
              {t(`matchLog.tabs.${k}`)}
            </button>
          );
        })}
        {tab !== 'scores' && <SideToggle side={side} onChange={setSide} />}
      </div>

      {/* Compact filter strip */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-bg-secondary/35 px-4 py-2">
        <div className="inline-flex items-center gap-0.5 rounded-full border border-border bg-surface p-0.5">
          {(['all', 'Home', 'Away'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVenueFilter(v)}
              aria-pressed={venueFilter === v}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
                venueFilter === v
                  ? 'bg-brand-soft text-brand'
                  : 'text-muted hover:text-primary'
              }`}
            >
              {v === 'all' ? tx('All', 'ทั้งหมด') : t(`matchLog.venue.${v}`)}
            </button>
          ))}
        </div>

        <div className="inline-flex items-center gap-0.5 rounded-full border border-border bg-surface p-0.5">
          {(['all', 'W', 'D', 'L'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setResultFilter(r)}
              aria-pressed={resultFilter === r}
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold transition-colors ${
                resultFilter === r
                  ? r === 'W'
                    ? 'bg-success-soft text-success'
                    : r === 'L'
                      ? 'bg-danger-soft text-danger'
                      : 'bg-brand-soft text-brand'
                  : 'text-muted hover:text-primary'
              }`}
            >
              {r === 'all' ? tx('All', 'ทุกผล') : r}
            </button>
          ))}
        </div>

        <div className="relative ml-auto min-w-[140px] flex-1 sm:max-w-[200px]">
          <Search
            size={12}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={tx('Opponent…', 'ค้นหาคู่แข่ง…')}
            className="w-full rounded-full border border-border bg-surface py-1 pl-7 pr-6 text-xs text-primary placeholder:text-muted focus:border-brand focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label={tx('Clear search', 'ล้างคำค้นหา')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-primary"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {hasFilter && (
          <button
            type="button"
            onClick={() => {
              setVenueFilter('all');
              setResultFilter('all');
              setSearchQuery('');
            }}
            className="text-[11px] font-semibold text-brand hover:underline"
          >
            {tx('Reset', 'รีเซ็ต')}
          </button>
        )}
      </div>

      {/* Body */}
      {tab === 'scores' ? (
        filteredRows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">{t('matchLog.noData')}</p>
        ) : (
          <ScoresList rows={filteredRows} showComp={showComp} />
        )
      ) : loading ? (
        <TableSkeleton />
      ) : matchlogs === LOAD_FAILED ? (
        <LoadFail
          onRetry={() =>
            loadMatchlogs(club.slug, season).then((data) =>
              setMatchlogs(data === LOAD_FAILED ? LOAD_FAILED : { key: cacheKey, data }),
            )
          }
        />
      ) : statTable ? (
        <StatTable
          table={statTable}
          group={group}
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
