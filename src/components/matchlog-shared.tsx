'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  ChevronRight,
  Clock,
  RefreshCw,
} from 'lucide-react';
import type { MatchRow, CompGroup, MatchlogTable, SeasonMatchlogs } from '@/lib/types';
import { compInGroup, canonicalComp } from '@/lib/stats';
import { useClubOptional } from './ClubProvider';
import { MatchCard } from '@/components/MatchCard';
import { fmt, dash, bkkKickoff } from '@/lib/format';

export type VenueFilter = 'all' | 'Home' | 'Away';
export type ResultFilter = 'all' | 'W' | 'D' | 'L';

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

const leagueMwCache = new Map<
  string,
  Promise<import('@/lib/types').LeagueMwData | null | typeof LOAD_FAILED>
>();

export function loadLeagueMw(
  season: string,
): Promise<import('@/lib/types').LeagueMwData | null | typeof LOAD_FAILED> {
  let p = leagueMwCache.get(`mw:${season}`);
  if (!p) {
    p = fetch(`${BASE_PATH}/data/league-mw/${season}.json`)
      .then((r) =>
        r.ok
          ? (r.json() as Promise<import('@/lib/types').LeagueMwData>)
          : Promise.reject(r.status),
      )
      .catch(() => {
        leagueMwCache.delete(`mw:${season}`);
        return LOAD_FAILED as typeof LOAD_FAILED;
      });
    leagueMwCache.set(`mw:${season}`, p);
  }
  return p;
}

export function LoadFail({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/25 bg-danger-soft/40 px-4 py-4 text-sm text-secondary m-4">
      <div className="flex items-center gap-2.5">
        <AlertCircle size={16} className="shrink-0 text-danger" />
        <span>{t('matchLog.loadFail')}</span>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
      >
        <RefreshCw size={12} />
        {t('matchLog.retry')}
      </button>
    </div>
  );
}

const COL_TIP: Record<string, string> = {
  GF: 'gf',
  GA: 'ga',
  xG: 'xg',
  xGA: 'xga',
  Sh: 'sh',
  SoT: 'sot',
  'SoT%': 'sotPct',
  'G/Sh': 'gPerSh',
  PK: 'pk',
  PKatt: 'pkatt',
  SoTA: 'sota',
  Saves: 'saves',
  'Save%': 'savePct',
  CS: 'cs',
  CrdY: 'crdY',
  CrdR: 'crdR',
  MP: 'mp',
};

const EXTRA_COL_TIP: Record<string, { en: string; th: string }> = {
  '2CrdY': { en: 'Second yellow card', th: 'ใบเหลืองที่สอง' },
  Fls: { en: 'Fouls committed', th: 'ทำฟาวล์' },
  Fld: { en: 'Fouls drawn', th: 'โดนทำฟาวล์' },
  Off: { en: 'Offsides', th: 'ล้ำหน้า' },
  Crs: { en: 'Crosses', th: 'ครอส' },
  CK: { en: 'Corner kicks', th: 'เตะมุม' },
  Int: { en: 'Interceptions', th: 'สกัดบอล' },
  TklW: { en: 'Tackles won', th: 'แท็กเกิลชนะ' },
  PKwon: { en: 'Penalties won', th: 'ได้จุดโทษ' },
  PKcon: { en: 'Penalties conceded', th: 'เสียจุดโทษ' },
  OG: { en: 'Own goals', th: 'เข้าประตูตัวเอง' },
  Recov: { en: 'Ball recoveries', th: 'เก็บบอลคืน' },
  'G/SoT': { en: 'Goals per shot on target', th: 'ประตูต่อยิงตรงกรอบ' },
  Dist: { en: 'Average shot distance', th: 'ระยะยิงเฉลี่ย' },
  FK: { en: 'Shots from free kicks', th: 'ยิงจากฟรีคิก' },
  PKA: { en: 'Penalties allowed', th: 'เสียประตูจากจุดโทษ' },
  PKsv: { en: 'Penalties saved', th: 'เซฟจุดโทษ' },
  PKm: { en: 'Penalties missed by opponent', th: 'คู่แข่งยิงจุดโทษพลาด' },
};

const FLOAT_COLS = new Set(['SoT%', 'G/Sh', 'G/SoT', 'Save%', 'Dist', 'Won%', 'xG', 'xGA', 'npxG']);

export function formatDate(iso: string): string {
  const parts = iso.split('-');
  if (parts.length < 3) return iso;
  const [y, m, d] = parts;
  return `${d}/${m}/${y.slice(-2)}`;
}

export function scoreText(m: MatchRow): string {
  if (m.gf == null || m.ga == null) return '—';
  let s = `${m.gf}–${m.ga}`;
  if (m.gfPens != null && m.gaPens != null) s += ` (${m.gfPens}–${m.gaPens} p)`;
  return s;
}

export function filterStatRows(
  table: MatchlogTable,
  group: CompGroup,
  venueFilter: VenueFilter = 'all',
  resultFilter: ResultFilter = 'all',
  searchQuery = '',
): string[][] {
  const cols = table.columns;
  const compIdx = cols.indexOf('Comp');
  const venueIdx = cols.indexOf('Venue');
  const resultIdx = cols.indexOf('Result');
  const oppIdx = cols.indexOf('Opponent');
  const q = searchQuery.trim().toLowerCase();

  return table.rows.filter((r) => {
    if (compIdx >= 0 && !compInGroup(r[compIdx] ?? '', group)) return false;
    if (venueFilter !== 'all' && venueIdx >= 0 && (r[venueIdx] ?? '') !== venueFilter) {
      return false;
    }
    if (resultFilter !== 'all' && resultIdx >= 0 && (r[resultIdx] ?? '') !== resultFilter) {
      return false;
    }
    if (q && oppIdx >= 0 && !(r[oppIdx] ?? '').toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });
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
    <span className="ml-auto inline-flex shrink-0 items-center gap-0.5 rounded-full border border-border bg-bg-secondary p-0.5">
      {(['for', 'against'] as const).map((s) => {
        const active = s === side;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            aria-pressed={active}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${
              active
                ? 'bg-surface text-primary shadow-sm ring-1 ring-border/70'
                : 'text-muted hover:text-primary'
            }`}
          >
            {s === 'for' ? forLabel : t('matchLog.side.against')}
          </button>
        );
      })}
    </span>
  );
}

function formatStatCell(col: string, raw: string): string {
  if (!raw) return '—';
  if (FLOAT_COLS.has(col) || raw.includes('.')) {
    const n = parseFloat(raw);
    if (!Number.isNaN(n)) return fmt(n, 2);
  }
  return raw;
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
    if (FLOAT_COLS.has(col)) return fmt(sum, 2);
    return Number.isInteger(sum) ? fmt(sum, 0) : fmt(sum, 2);
  });

  return out;
}

function venueBadgeStyle(v: string): string {
  if (v === 'Home') return 'bg-brand-soft text-brand';
  if (v === 'Away') return 'bg-bg-secondary text-secondary';
  if (v === 'Neutral') return 'bg-warning-soft text-warning';
  return 'bg-bg-secondary text-muted';
}

function venueShort(v: string, th: boolean): string {
  if (v === 'Home') return th ? 'เหย้า' : 'H';
  if (v === 'Away') return th ? 'เยือน' : 'A';
  if (v === 'Neutral') return th ? 'กลาง' : 'N';
  return v || '—';
}

const COMP_BADGE_STYLE: Record<string, string> = {
  PL: 'bg-brand-soft/75 text-brand',
  UCL: 'bg-info-soft text-info',
  UEL: 'bg-warning-soft text-warning',
  UECL: 'bg-success-soft text-success',
  FA: 'bg-danger-soft/70 text-danger',
  EFL: 'bg-bg-secondary text-secondary',
};

export function StatTable({
  table,
  group,
  venueFilter = 'all',
  resultFilter = 'all',
  searchQuery = '',
  contained = true,
}: {
  table: MatchlogTable;
  group: CompGroup;
  venueFilter?: VenueFilter;
  resultFilter?: ResultFilter;
  searchQuery?: string;
  contained?: boolean;
}) {
  const { t, lang } = useI18n();
  const th = lang === 'th';
  const [sort, setSort] = useState<{ ci: number; dir: 'asc' | 'desc' } | null>(null);

  const cols = table.columns;
  const oppIdx = cols.indexOf('Opponent');
  const endIdx = cols[cols.length - 1] === 'Match Report' ? cols.length - 1 : cols.length;
  const view = useMemo(() => cols.slice(0, endIdx), [cols, endIdx]);

  const filteredRows = useMemo(
    () => filterStatRows(table, group, venueFilter, resultFilter, searchQuery),
    [table, group, venueFilter, resultFilter, searchQuery],
  );

  const activeSort = sort && sort.ci < view.length ? sort : null;

  const sortedRows = useMemo(() => {
    if (!activeSort) return filteredRows;
    const { ci, dir } = activeSort;
    const col = view[ci];
    const isNumeric = ci > oppIdx || col === 'GF' || col === 'GA';
    const copy = [...filteredRows];
    copy.sort((a, b) => {
      const av = (a[ci] ?? '').trim();
      const bv = (b[ci] ?? '').trim();
      if (!av && !bv) return 0;
      if (!av) return 1;
      if (!bv) return -1;
      let cmp = 0;
      if (isNumeric) {
        const an = parseFloat(av);
        const bn = parseFloat(bv);
        if (Number.isNaN(an) && Number.isNaN(bn)) cmp = av.localeCompare(bv);
        else if (Number.isNaN(an)) return 1;
        else if (Number.isNaN(bn)) return -1;
        else cmp = an - bn;
      } else {
        cmp = av.localeCompare(bv);
      }
      return dir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [filteredRows, activeSort, view, oppIdx]);

  const toggleSort = (ci: number) => {
    const col = view[ci];
    const defaultDir: 'asc' | 'desc' =
      ci > oppIdx || col === 'GF' || col === 'GA' || col === 'Date' ? 'desc' : 'asc';
    setSort((prev) => {
      if (!prev || prev.ci !== ci) return { ci, dir: defaultDir };
      if (prev.dir === defaultDir) {
        return { ci, dir: defaultDir === 'desc' ? 'asc' : 'desc' };
      }
      return null;
    });
  };

  if (filteredRows.length === 0) {
    return (
      <div className="px-5 py-10 text-center">
        <p className="text-sm font-medium text-secondary">{t('matchLog.noStatData')}</p>
        <p className="mt-1 text-xs text-muted">
          {th
            ? 'ลองปรับตัวกรองรายการ สนาม ผลการแข่งขัน หรือคำค้นหา'
            : 'Try adjusting the competition, venue, result, or search filters.'}
        </p>
      </div>
    );
  }

  const totalRow = totalsRow(view, filteredRows, t('matchLog.total'));

  return (
    <div className={`${contained ? 'max-h-[560px]' : 'max-h-[72vh]'} overflow-auto`}>
      <table className="w-full min-w-[760px] border-collapse">
        <thead className="sticky top-0 z-10 bg-surface-elevated/95 backdrop-blur-sm">
          <tr className="border-b border-border">
            {view.map((c, i) => {
              const tipKey = COL_TIP[c];
              const extraTip = EXTRA_COL_TIP[c];
              const title = tipKey
                ? t(`colTip.${tipKey}`)
                : extraTip
                  ? th
                    ? extraTip.th
                    : extraTip.en
                  : undefined;
              const isRight = i > oppIdx || c === 'GF' || c === 'GA';
              const isSorted = activeSort?.ci === i;
              const sortable = c !== 'Time' && c !== 'Day';

              return (
                <th
                  key={`${c}-${i}`}
                  title={title}
                  className={`whitespace-nowrap px-2.5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted ${
                    isRight ? 'text-right' : 'text-left'
                  }`}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(i)}
                      className={`inline-flex items-center gap-1 transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${
                        isSorted ? 'text-brand' : ''
                      } ${isRight ? 'flex-row-reverse' : ''}`}
                    >
                      <span>{c}</span>
                      {isSorted ? (
                        activeSort.dir === 'asc' ? (
                          <ArrowUp size={11} />
                        ) : (
                          <ArrowDown size={11} />
                        )
                      ) : (
                        <ArrowUpDown size={10} className="opacity-35" />
                      )}
                    </button>
                  ) : (
                    c
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-light">
          {sortedRows.map((r, ri) => (
            <tr
              key={`${r[0] ?? ri}-${r[oppIdx] ?? ''}-${ri}`}
              className="group transition-colors hover:bg-brand-soft/35"
            >
              {view.map((c, ci) => {
                const v = r[ci] ?? '';
                if (c === 'Date') {
                  return (
                    <td
                      key={ci}
                      className="whitespace-nowrap px-2.5 py-2.5 text-xs font-medium tabular-nums text-muted"
                    >
                      {formatDate(v)}
                    </td>
                  );
                }
                if (c === 'Comp') {
                  const short = COMP_SHORT[canonicalComp(v)] ?? v;
                  return (
                    <td key={ci} className="whitespace-nowrap px-2.5 py-2.5">
                      <span
                        className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${
                          COMP_BADGE_STYLE[short] ?? 'bg-bg-secondary text-muted'
                        }`}
                      >
                        {short}
                      </span>
                    </td>
                  );
                }
                if (c === 'Venue') {
                  return (
                    <td key={ci} className="whitespace-nowrap px-2.5 py-2.5">
                      <span
                        className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-bold ${venueBadgeStyle(v)}`}
                        title={v ? t(`matchLog.venue.${v}`) : undefined}
                      >
                        {venueShort(v, th)}
                      </span>
                    </td>
                  );
                }
                if (c === 'Result') {
                  return (
                    <td key={ci} className="whitespace-nowrap px-2.5 py-2.5">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${
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
                    <td
                      key={ci}
                      className="whitespace-nowrap px-2.5 py-2.5 text-xs font-semibold text-primary transition-colors group-hover:text-brand"
                    >
                      {dash(v)}
                    </td>
                  );
                }
                if (c === 'GF' || c === 'GA') {
                  return (
                    <td
                      key={ci}
                      className="whitespace-nowrap px-2.5 py-2.5 text-right text-xs font-semibold tabular-nums text-primary"
                    >
                      {v || '—'}
                    </td>
                  );
                }
                if (c === 'CrdY') {
                  const n = parseInt(v, 10);
                  return (
                    <td key={ci} className="whitespace-nowrap px-2.5 py-2.5 text-right text-xs tabular-nums">
                      {!Number.isNaN(n) && n > 0 ? (
                        <span className="inline-flex min-w-[22px] justify-center rounded-md bg-warning-soft px-1.5 py-0.5 font-bold text-warning">
                          {n}
                        </span>
                      ) : (
                        <span className="text-muted">{v || '—'}</span>
                      )}
                    </td>
                  );
                }
                if (c === 'CrdR' || c === '2CrdY') {
                  const n = parseInt(v, 10);
                  return (
                    <td key={ci} className="whitespace-nowrap px-2.5 py-2.5 text-right text-xs tabular-nums">
                      {!Number.isNaN(n) && n > 0 ? (
                        <span className="inline-flex min-w-[22px] justify-center rounded-md bg-danger-soft px-1.5 py-0.5 font-bold text-danger">
                          {n}
                        </span>
                      ) : (
                        <span className="text-muted">{v || '—'}</span>
                      )}
                    </td>
                  );
                }
                if (c === 'OG' || c === 'PKcon') {
                  const n = parseInt(v, 10);
                  return (
                    <td
                      key={ci}
                      className={`whitespace-nowrap px-2.5 py-2.5 text-right text-xs tabular-nums ${
                        !Number.isNaN(n) && n > 0 ? 'font-bold text-danger' : 'text-secondary'
                      }`}
                    >
                      {v || '—'}
                    </td>
                  );
                }
                if (c === 'PKwon') {
                  const n = parseInt(v, 10);
                  return (
                    <td
                      key={ci}
                      className={`whitespace-nowrap px-2.5 py-2.5 text-right text-xs tabular-nums ${
                        !Number.isNaN(n) && n > 0 ? 'font-bold text-success' : 'text-secondary'
                      }`}
                    >
                      {v || '—'}
                    </td>
                  );
                }

                const formatted = formatStatCell(c, v);
                return (
                  <td
                    key={ci}
                    className={`whitespace-nowrap px-2.5 py-2.5 text-xs tabular-nums ${
                      ci > oppIdx ? 'text-right text-secondary' : 'text-left text-muted'
                    }`}
                  >
                    {formatted}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot className="sticky bottom-0 z-10 bg-surface-elevated/95 backdrop-blur-sm">
          <tr className="border-t-2 border-border">
            {view.map((c, ci) => {
              const isRight = ci > oppIdx || c === 'GF' || c === 'GA';
              return (
                <td
                  key={ci}
                  className={`whitespace-nowrap px-2.5 py-2.5 text-xs font-bold tabular-nums text-primary ${
                    isRight ? 'text-right' : 'text-left'
                  }`}
                >
                  {totalRow[ci] ?? ''}
                </td>
              );
            })}
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
  const { t, lang } = useI18n();
  const th = lang === 'th';
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
      className={`divide-y divide-border-light ${contained ? 'max-h-[560px] overflow-y-auto' : ''}`}
    >
      {rows.map((m, i) => {
        const played = m.result != null;
        const isOpen = open === i;
        const bk = bkkKickoff(m.date, m.time);
        const compShort = COMP_SHORT[m.competition] ?? m.competition;
        const hasXg = played && m.xg != null && m.xga != null;
        const xgDiff = hasXg ? (m.xg ?? 0) - (m.xga ?? 0) : 0;

        const secondaryMeta = played
          ? [
              m.possession != null
                ? `${t('matchLog.poss')} ${
                    Number.isInteger(m.possession)
                      ? fmt(m.possession, 0)
                      : fmt(m.possession, 2)
                  }%`
                : null,
              m.formation ? `${t('matchLog.form')} ${m.formation}` : null,
              m.attendance != null
                ? `${t('matchLog.att')} ${m.attendance.toLocaleString()}`
                : null,
              m.referee,
              m.notes,
            ].filter(Boolean)
          : [m.round, m.notes].filter(Boolean);

        const rowBody = (
          <div className="flex flex-col gap-1.5">
            {/* Primary line */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              {/* Date column */}
              <div className="flex w-[4.5rem] shrink-0 flex-col">
                <span className="text-xs font-semibold tabular-nums text-primary">
                  {bk?.date ?? formatDate(m.date)}
                </span>
                {m.round && (
                  <span className="truncate text-[10px] text-muted" title={m.round}>
                    {m.round.replace('Matchweek ', 'MW ')}
                  </span>
                )}
              </div>

              {/* Competition + Venue pills */}
              <div className="flex shrink-0 items-center gap-1.5">
                {showComp && (
                  <span
                    className={`inline-flex w-11 justify-center rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${
                      COMP_BADGE_STYLE[compShort] ?? 'bg-bg-secondary text-muted'
                    }`}
                  >
                    {compShort}
                  </span>
                )}
                {m.venue && (
                  <span
                    className={`inline-flex min-w-[26px] justify-center rounded-md px-1.5 py-0.5 text-[10px] font-bold ${venueBadgeStyle(m.venue)}`}
                    title={t(`matchLog.venue.${m.venue}`)}
                  >
                    {venueShort(m.venue, th)}
                  </span>
                )}
              </div>

              {/* Opponent */}
              <div className="min-w-0 flex-1">
                <span className="block truncate text-left text-sm font-semibold text-primary transition-colors group-hover:text-brand">
                  {dash(m.opponent)}
                </span>
              </div>

              {/* Right: Score + W/D/L pill OR Upcoming BKK Kickoff badge */}
              {played ? (
                <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
                  {hasXg && (
                    <span
                      className={`hidden items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums md:inline-flex ${
                        xgDiff > 0.25
                          ? 'bg-success-soft/70 text-success'
                          : xgDiff < -0.25
                            ? 'bg-danger-soft/70 text-danger'
                            : 'bg-bg-secondary text-secondary'
                      }`}
                    >
                      <span className="text-[10px] uppercase opacity-75">xG</span>
                      <span>
                        {fmt(m.xg, 2)}–{fmt(m.xga, 2)}
                      </span>
                    </span>
                  )}
                  <span className="min-w-[3.2rem] text-right font-display text-sm font-bold tabular-nums text-primary sm:text-base">
                    {scoreText(m)}
                  </span>
                  <span
                    className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                      RESULT_STYLE[m.result ?? ''] ?? 'bg-bg-secondary text-muted'
                    }`}
                  >
                    {m.result}
                  </span>
                  <ChevronRight
                    size={15}
                    aria-hidden
                    className={`shrink-0 text-muted transition-all group-hover:translate-x-0.5 group-hover:text-brand ${
                      isOpen ? 'rotate-90 text-brand' : ''
                    }`}
                  />
                </div>
              ) : (
                <div className="flex shrink-0 items-center gap-1.5">
                  {(bk?.time ?? m.time) && (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-brand/25 bg-brand-soft/70 px-2 py-0.5 text-[11px] font-bold tabular-nums text-brand">
                      <Clock size={11} />
                      <span>{bk?.time ?? m.time}</span>
                      {bk && <span className="hidden text-[9px] font-semibold opacity-80 sm:inline">BKK</span>}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-lg border border-border bg-bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary">
                    <Calendar size={11} className="text-muted" />
                    <span>{t('matchLog.upcoming')}</span>
                  </span>
                </div>
              )}
            </div>

            {/* Secondary meta row (xG on mobile + possession/formation/attendance/ref) */}
            {(hasXg || secondaryMeta.length > 0) && (
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pl-0 text-[11px] text-muted sm:pl-[5.25rem]">
                {hasXg && (
                  <span
                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums md:hidden ${
                      xgDiff > 0.25
                        ? 'bg-success-soft/70 text-success'
                        : xgDiff < -0.25
                          ? 'bg-danger-soft/70 text-danger'
                          : 'bg-bg-secondary text-secondary'
                    }`}
                  >
                    xG {fmt(m.xg, 2)}–{fmt(m.xga, 2)}
                  </span>
                )}
                {secondaryMeta.map((item, idx) => (
                  <span key={idx} className="inline-flex items-center gap-2.5">
                    {idx > 0 && <span className="text-border">·</span>}
                    <span className="truncate">{item}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        );

        return (
          <li
            key={`${m.date}-${m.opponent ?? ''}-${i}`}
            className={played ? '' : 'bg-bg-secondary/30 px-4 py-3'}
          >
            {played ? (
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => openAt(i)}
                className={`group relative block w-full border-l-2 px-4 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${
                  isOpen
                    ? 'border-l-brand bg-brand-soft/45'
                    : 'border-l-transparent hover:border-l-brand hover:bg-brand-soft/30'
                }`}
              >
                {rowBody}
              </button>
            ) : (
              <div className="border-l-2 border-l-brand/40 pl-3">{rowBody}</div>
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
