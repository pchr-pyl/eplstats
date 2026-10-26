'use client';

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { ChevronDown } from 'lucide-react';
import type { MatchRow, CompGroup, MatchlogTable, SeasonMatchlogs } from '@/lib/types';
import { compInGroup, canonicalComp } from '@/lib/stats';
import { useClubOptional } from './ClubProvider';
import { MatchCard } from '@/components/MatchCard';
import { fmt, dash } from '@/lib/format';

export const COMP_SHORT: Record<string, string> = {
  'Premier League': 'PL',
  'FA Cup': 'FA',
  'EFL Cup': 'EFL',
  'Champions League': 'UCL',
  'Europa League': 'UEL',
  'Conference League': 'UECL',
  'Community Shield': 'CS',
  'UEFA Super Cup': 'SC',
  'Club World Cup': 'CWC',
  'International Champions Cup': 'ICC',
};

export const RESULT_STYLE: Record<string, string> = {
  W: 'bg-success/15 text-success',
  D: 'bg-bg-secondary text-muted',
  L: 'bg-danger/15 text-danger',
};

// Resolved by the loaders below when the fetch itself fails (network error or
// non-OK response). Failed results are NOT cached — the next call refetches.
export const LOAD_FAILED: unique symbol = Symbol('loadFailed');

const matchlogCache = new Map<string, Promise<SeasonMatchlogs | typeof LOAD_FAILED>>();

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function loadMatchlogs(
  slug: string,
  season: string,
): Promise<SeasonMatchlogs | typeof LOAD_FAILED> {
  const key = `${slug}|${season}`;
  let p = matchlogCache.get(key);
  if (!p) {
    p = fetch(`${BASE_PATH}/data/${slug}/matchlogs-${season}.json`)
      .then((r) =>
        r.ok ? (r.json() as Promise<SeasonMatchlogs>) : Promise.reject(r.status),
      )
      .catch(() => {
        matchlogCache.delete(key);
        return LOAD_FAILED as typeof LOAD_FAILED;
      });
    matchlogCache.set(key, p);
  }
  return p;
}

const lazyCache = new Map<string, Promise<unknown>>();

function loadLazy<T>(
  slug: string,
  kind: string,
  season: string,
): Promise<T | typeof LOAD_FAILED> {
  const key = `${slug}|${kind}|${season}`;
  let p = lazyCache.get(key) as Promise<T | typeof LOAD_FAILED> | undefined;
  if (!p) {
    p = fetch(`${BASE_PATH}/data/${slug}/${kind}-${season}.json`)
      .then((r) =>
        r.ok ? (r.json() as Promise<T>) : Promise.reject(r.status),
      )
      .catch(() => {
        lazyCache.delete(key);
        return LOAD_FAILED as typeof LOAD_FAILED;
      });
    lazyCache.set(key, p as Promise<unknown>);
  }
  return p;
}

export const loadKeepersSeason = (slug: string, season: string) =>
  loadLazy<import('@/lib/types').KeepersData>(slug, 'keepers', season);

export const loadSquadSeason = (slug: string, season: string) =>
  loadLazy<import('@/lib/types').SquadSeason>(slug, 'squad', season);

export const loadPlayersSeason = (slug: string, season: string) =>
  loadLazy<{ players?: import('@/lib/types').PlayerSeasonStats[] }>(
    slug,
    'players',
    season,
  );

const leagueCache = new Map<
  string,
  Promise<import('@/lib/types').LeagueSeasonData | null | typeof LOAD_FAILED>
>();

export function loadLeagueSeason(
  season: string,
): Promise<import('@/lib/types').LeagueSeasonData | null | typeof LOAD_FAILED> {
  let p = leagueCache.get(season);
  if (!p) {
    p = fetch(`${BASE_PATH}/data/league/${season}.json`)
      .then((r) =>
        r.ok
          ? (r.json() as Promise<import('@/lib/types').LeagueSeasonData>)
          : Promise.reject(r.status),
      )
      .catch(() => {
        leagueCache.delete(season);
        return LOAD_FAILED as typeof LOAD_FAILED;
      });
    leagueCache.set(season, p);
  }
  return p;
}

export function LoadFail({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3 px-4 py-6 text-sm text-muted">
      <span>{t('matchLog.loadFail')}</span>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-full border border-border bg-bg-secondary px-3 py-1 font-medium text-primary transition-colors hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
      >
        {t('matchLog.retry')}
      </button>
    </div>
  );
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(-2)}`;
}

export function scoreText(m: MatchRow): string {
  if (m.gf == null || m.ga == null) return '—';
  let s = `${m.gf}–${m.ga}`;
  if (m.gfPens != null && m.gaPens != null) s += ` (${m.gfPens}–${m.gaPens} p)`;
  return s;
}

export function SideToggle({
  side,
  onChange,
}: {
  side: 'for' | 'against';
  onChange: (s: 'for' | 'against') => void;
}) {
  const { t } = useI18n();
  const ctx = useClubOptional();
  const forLabel = ctx?.club.shortName ?? t('matchLog.side.for');
  return (
    <span className="ml-auto flex shrink-0 gap-1 rounded-full bg-bg-secondary p-0.5">
      {(['for', 'against'] as const).map((s) => {
        const active = s === side;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            aria-pressed={active}
            className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${
              active ? 'bg-surface text-primary shadow-sm' : 'text-muted hover:text-primary'
            }`}
          >
            {s === 'for' ? forLabel : t('matchLog.side.against')}
          </button>
        );
      })}
    </span>
  );
}

function totalsRow(view: string[], rows: string[][], totalLabel: string): string[] {
  const resIdx = view.indexOf('Result');
  let w = 0;
  let d = 0;
  let l = 0;
  if (resIdx >= 0) {
    for (const r of rows) {
      const v = r[resIdx] ?? '';
      if (v === 'W') w += 1;
      else if (v === 'D') d += 1;
      else if (v === 'L') l += 1;
    }
  }
  const record = `${w}W ${d}D ${l}L`;

  const ratioDefs: [string, string, string, boolean][] = [
    ['SoT%', 'SoT', 'Sh', true],
    ['G/Sh', 'Gls', 'Sh', false],
    ['G/SoT', 'Gls', 'SoT', false],
    ['Save%', 'Saves', 'SoTA', true],
  ];

  const sums: (number | null)[] = view.map(() => null);

  for (let ci = 0; ci < view.length; ci += 1) {
    const col = view[ci];
    if (
      col === 'Date' ||
      col === 'Result' ||
      col === 'Time' ||
      col === 'Comp' ||
      col === 'Round' ||
      col === 'Day' ||
      col === 'Venue' ||
      col === 'Opponent' ||
      ratioDefs.some(([name]) => name === col)
    ) {
      continue;
    }
    let sum = 0;
    let count = 0;
    for (const r of rows) {
      const v = r[ci] ?? '';
      if (v === '') continue;
      const n = parseFloat(v);
      if (Number.isNaN(n)) continue;
      sum += n;
      count += 1;
    }
    sums[ci] = count > 0 ? sum : null;
  }

  for (const [name, numName, denName, asPct] of ratioDefs) {
    const ri = view.indexOf(name);
    if (ri < 0) continue;
    const ni = view.indexOf(numName);
    const di = view.indexOf(denName);
    if (ni < 0 || di < 0) {
      sums[ri] = null;
      continue;
    }
    let numSum = 0;
    let denSum = 0;
    let usable = 0;
    for (const r of rows) {
      const nv = r[ni] ?? '';
      const dv = r[di] ?? '';
      if (nv === '' || dv === '') continue;
      const n = parseFloat(nv);
      const d = parseFloat(dv);
      if (Number.isNaN(n) || Number.isNaN(d)) continue;
      numSum += n;
      denSum += d;
      usable += 1;
    }
    if (usable === 0 || denSum === 0) {
      sums[ri] = null;
    } else {
      const ratio = numSum / denSum;
      sums[ri] = asPct ? ratio * 100 : ratio;
    }
  }

  const out: string[] = view.map((col, ci) => {
    if (col === 'Date') return totalLabel;
    if (col === 'Result') return record;
    if (
      col === 'Time' ||
      col === 'Comp' ||
      col === 'Round' ||
      col === 'Day' ||
      col === 'Venue' ||
      col === 'Opponent'
    ) {
      return '';
    }
    const sum = sums[ci];
    if (sum === null) return '—';
    return Number.isInteger(sum) ? fmt(sum, 0) : fmt(sum, 2);
  });

  return out;
}

export function StatTable({ table, group }: { table: MatchlogTable; group: CompGroup }) {
  const { t } = useI18n();
  const cols = table.columns;
  const compIdx = cols.indexOf('Comp');
  const oppIdx = cols.indexOf('Opponent');
  const endIdx = cols[cols.length - 1] === 'Match Report' ? cols.length - 1 : cols.length;
  const view = cols.slice(0, endIdx);
  const rows = table.rows.filter(
    (r) => compIdx < 0 || compInGroup(r[compIdx] ?? '', group),
  );

  if (rows.length === 0) {
    return <p className="px-4 py-6 text-sm text-muted">{t('matchLog.noStatData')}</p>;
  }

  const totalRow = totalsRow(view, rows, t('matchLog.total'));

  return (
    <div className="max-h-[560px] overflow-auto">
      <table className="w-full min-w-[720px] border-collapse">
        <thead className="sticky top-0 z-10 bg-surface-elevated">
          <tr>
            {view.map((c, i) => (
              <th
                key={`${c}-${i}`}
                className={`whitespace-nowrap border-b border-border px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted ${
                  i > oppIdx ? 'text-right' : 'text-left'
                }`}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b border-border transition-colors hover:bg-bg-secondary">
              {view.map((c, ci) => {
                const v = r[ci] ?? '';
                if (c === 'Date') {
                  return (
                    <td key={ci} className="whitespace-nowrap px-2.5 py-2 text-xs tabular-nums text-muted">
                      {formatDate(v)}
                    </td>
                  );
                }
                if (c === 'Comp') {
                  return (
                    <td key={ci} className="px-2.5 py-2">
                      <span className="rounded bg-bg-secondary px-1 py-0.5 text-[10px] font-semibold text-muted">
                        {COMP_SHORT[canonicalComp(v)] ?? v}
                      </span>
                    </td>
                  );
                }
                if (c === 'Result') {
                  return (
                    <td key={ci} className="px-2.5 py-2">
                      <span
                        className={`rounded px-1 py-0.5 text-xs font-bold ${
                          RESULT_STYLE[v] ?? 'bg-bg-secondary text-muted'
                        }`}
                      >
                        {v || '—'}
                      </span>
                    </td>
                  );
                }
                if (c === 'Opponent') {
                  return (
                    <td key={ci} className="whitespace-nowrap px-2.5 py-2 text-xs font-medium text-primary">
                      {dash(v)}
                    </td>
                  );
                }
                return (
                  <td
                    key={ci}
                    className={`whitespace-nowrap px-2.5 py-2 text-xs tabular-nums ${
                      ci > oppIdx ? 'text-right text-secondary' : 'text-left text-muted'
                    }`}
                  >
                    {v || '—'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot className="sticky bottom-0 z-10 bg-surface-elevated">
          <tr className="border-t-2 border-border">
            {view.map((_, ci) => (
              <td
                key={ci}
                className={`whitespace-nowrap px-2.5 py-2 text-xs tabular-nums font-semibold text-primary ${
                  ci > oppIdx ? 'text-right' : 'text-left'
                }`}
              >
                {totalRow[ci] ?? ''}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ------------------------------------------------- expandable match detail
// Stat rows: label -> candidate column names in the matchlogs `for`/`against`
// tables (mapped by NAME; blank on both sides -> row skipped).
export function ScoresList({
  rows,
  showComp,
  contained = true,
}: {
  rows: MatchRow[];
  showComp: boolean;
  contained?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState<number | null>(null);
  const [openMid, setOpenMid] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // deep link ?match={id} — opens on mount and follows popstate;
  // falls back to opening by id when the match isn't in the current rows
  useEffect(() => {
    const sync = () => {
      const id = new URLSearchParams(window.location.search).get('match');
      const i = id ? rows.findIndex((r) => r.matchId === id) : -1;
      setOpen(i >= 0 ? i : null);
      setOpenMid(i < 0 && id ? id : null);
    };
    window.addEventListener('popstate', sync);
    const raf = requestAnimationFrame(sync);
    return () => {
      window.removeEventListener('popstate', sync);
      cancelAnimationFrame(raf);
    };
  }, [rows]);

  const openAt = (i: number | null) => {
    setOpen(i);
    setOpenMid(null);
    const url = new URL(window.location.href);
    if (i != null && rows[i]?.matchId) url.searchParams.set('match', rows[i].matchId!);
    else url.searchParams.delete('match');
    window.history.pushState({}, '', url.toString());
  };

  return (
    <ul
      ref={listRef}
      className={`divide-y divide-border ${contained ? 'max-h-[560px] overflow-y-auto' : ''}`}
    >
      {rows.map((m, i) => {
        const played = m.result != null;
        const isOpen = open === i;
        const meta = played
          ? [
              m.round,
              m.venue ? t(`matchLog.venue.${m.venue}`) : null,
              m.possession != null ? `${t('matchLog.poss')} ${fmt(m.possession, 0)}%` : null,
              m.xg != null ? `xG ${fmt(m.xg, 2)}` : null,
              m.xga != null ? `xGA ${fmt(m.xga, 2)}` : null,
              m.formation ? `${t('matchLog.form')} ${m.formation}` : null,
              m.attendance != null ? `${t('matchLog.att')} ${m.attendance.toLocaleString()}` : null,
              m.referee,
              m.notes,
            ].filter(Boolean)
          : [];

        const rowContent = (
          <div className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-xs tabular-nums text-muted">
              {formatDate(m.date)}
            </span>
            {showComp && (
              <span className="w-10 shrink-0 rounded bg-bg-secondary px-1 py-0.5 text-center text-[10px] font-semibold text-muted">
                {COMP_SHORT[m.competition] ?? m.competition}
              </span>
            )}
            <span
              className={`w-7 shrink-0 rounded px-1 py-0.5 text-center text-xs font-bold ${
                RESULT_STYLE[m.result ?? ''] ?? 'bg-bg-secondary text-muted'
              }`}
            >
              {m.result ?? '—'}
            </span>
            <span className="min-w-0 flex-1 truncate text-left text-sm font-medium text-primary">
              {dash(m.opponent)}
            </span>
            {played ? (
              <span className="shrink-0 font-display text-sm font-semibold tabular-nums text-primary">
                {scoreText(m)}
              </span>
            ) : (
              <span className="shrink-0 text-xs text-muted">
                {t('matchLog.upcoming')}
                {m.time ? ` · ${m.time}` : ''}
              </span>
            )}
            {played && (
              <ChevronDown
                size={14}
                aria-hidden
                className={`shrink-0 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            )}
          </div>
        );

        return (
          <li key={`${m.date}-${i}`} className={played ? '' : 'px-4 py-2.5'}>
            {played ? (
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => openAt(i)}
                className="block w-full px-4 py-2.5 text-left transition-colors hover:bg-bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
              >
                {rowContent}
                {meta.length > 0 && (
                  <div className="mt-1 truncate pl-16 text-xs text-muted sm:pl-[7.5rem]">
                    {meta.join(' · ')}
                  </div>
                )}
              </button>
            ) : (
              <div className="transition-colors">{rowContent}</div>
            )}
          </li>
        );
      })}
      {(open != null && rows[open]?.matchId) || openMid ? (
        <MatchCard
          key={openMid ?? rows[open ?? 0]?.matchId ?? ''}
          mid={openMid ?? rows[open ?? 0]?.matchId ?? ''}
          rows={rows}
          index={open ?? -1}
          onNavigate={(i) => openAt(i)}
          onClose={() => openAt(null)}
        />
      ) : null}
    </ul>
  );
}
