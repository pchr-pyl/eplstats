'use client';

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { ChevronDown } from 'lucide-react';
import type { MatchRow, CompGroup, MatchlogTable, MatchlogType, SeasonMatchlogs } from '@/lib/types';
import { compInGroup, canonicalComp } from '@/lib/stats';
import { useClubOptional, useClubData } from './ClubProvider';
import { managerForDate } from '@/lib/managers';
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
      </table>
    </div>
  );
}

// ------------------------------------------------- expandable match detail
// Stat rows: label -> candidate column names in the matchlogs `for`/`against`
// tables (mapped by NAME; blank on both sides -> row skipped).
const DETAIL_STATS: Record<
  MatchlogType,
  [string, string[]][]
> = {
  shooting: [
    ['shooting.sh', ['Sh']],
    ['shooting.sot', ['SoT']],
    ['shooting.sotPct', ['SoT%']],
    ['shooting.gSh', ['G/Sh']],
    ['shooting.dist', ['Dist']],
    ['shooting.fk', ['FK']],
    ['shooting.pk', ['PK', 'PKatt']],
  ],
  keeper: [
    ['keeper.sota', ['SoTA']],
    ['keeper.saves', ['Saves']],
    ['keeper.savePct', ['Save%']],
    ['keeper.cs', ['CS']],
  ],
  misc: [
    ['misc.crdY', ['CrdY']],
    ['misc.crdR', ['CrdR']],
    ['misc.fls', ['Fls']],
    ['misc.fld', ['Fld']],
    ['misc.off', ['Off']],
    ['misc.crs', ['Crs']],
    ['misc.int', ['Int']],
    ['misc.tklw', ['TklW']],
    ['misc.pkWon', ['PKwon']],
    ['misc.pkCon', ['PKcon']],
    ['misc.og', ['OG']],
    ['misc.recov', ['Recov']],
    ['misc.aerWon', ['Won']],
    ['misc.aerLost', ['Lost']],
    ['misc.aerPct', ['Won%']],
  ],
};

function findLogRow(table: MatchlogTable | undefined, m: MatchRow) {
  if (!table) return undefined;
  const di = table.columns.indexOf('Date');
  const oi = table.columns.indexOf('Opponent');
  if (di < 0) return undefined;
  const sameDay = table.rows.filter((r) => r[di] === m.date);
  if (sameDay.length === 1 || oi < 0 || !m.opponent) return sameDay[0];
  const first = m.opponent.split(' ')[0].toLowerCase();
  return (
    sameDay.find((r) => (r[oi] ?? '').toLowerCase().includes(first)) ??
    sameDay[0]
  );
}

function val(row: string[] | undefined, table: MatchlogTable, names: string[]) {
  if (!row) return '';
  for (const n of names) {
    const i = table.columns.indexOf(n);
    if (i >= 0 && row[i] != null && row[i] !== '') return row[i];
  }
  return '';
}

function num(v: string): number | null {
  const n = parseFloat(v);
  return v !== '' && !Number.isNaN(n) ? n : null;
}

function Crest({ slug, size = 16 }: { slug: string; size?: number }) {
  return (
    <img
      src={`${BASE_PATH}/logos/${slug}.png`}
      width={size}
      height={size}
      alt=""
      aria-hidden
      loading="lazy"
      className="inline-block shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}

function MatchDetail({ m }: { m: MatchRow }) {
  const { t } = useI18n();
  const ctx = useClubOptional();
  const dataCtx = useClubData();
  const [logs, setLogs] = useState<SeasonMatchlogs | typeof LOAD_FAILED | null>(
    null,
  );

  useEffect(() => {
    if (!ctx) return;
    let live = true;
    loadMatchlogs(ctx.club.slug, m.season).then((d) => {
      if (live) setLogs(d);
    });
    return () => {
      live = false;
    };
  }, [ctx, ctx?.club.slug, m.season]);

  const stint = managerForDate(dataCtx.stints, m.date);
  const oppClub = ctx?.clubs.find(
    (c) =>
      c.slug === m.opponent ||
      c.name.toLowerCase() === m.opponent?.toLowerCase() ||
      c.shortName?.toLowerCase() === m.opponent?.toLowerCase(),
  );

  const info: [string, string | null][] = [
    ['xG', m.competition === 'Premier League' ? fmt(m.xg) : null],
    ['xGA', m.competition === 'Premier League' ? fmt(m.xga) : null],
    [t('matchLog.poss'), m.possession != null ? `${fmt(m.possession, 0)}%` : null],
    [t('matchLog.att'), m.attendance != null ? m.attendance.toLocaleString() : null],
    [t('matchLog.referee'), m.referee],
    [t('matchLog.captain'), m.captain],
    [
      t('matchLog.form'),
      m.formation
        ? `${m.formation}${m.oppFormation ? ` vs ${m.oppFormation}` : ''}`
        : m.oppFormation,
    ],
    [t('matchLog.manager'), stint?.name ?? null],
    [t('matchLog.notes'), m.notes],
  ];
  const infoShow = info.filter((x): x is [string, string] => x[1] != null);

  const statSections = (['shooting', 'keeper', 'misc'] as MatchlogType[])
    .map((typ) => {
      if (logs === null || logs === LOAD_FAILED) return null;
      const sides = logs[typ];
      const forT = sides?.for;
      const agT = sides?.against;
      const forR = findLogRow(forT, m);
      const agR = findLogRow(agT, m);
      if (!forR && !agR) return null;
      const rows = DETAIL_STATS[typ]
        .map(([key, names]) => ({
          key,
          fv: forT ? val(forR, forT, names) : '',
          av: agT ? val(agR, agT, names) : '',
        }))
        .filter((r) => r.fv !== '' || r.av !== '');
      if (!rows.length) return null;
      return { typ, rows };
    })
    .filter((x): x is { typ: MatchlogType; rows: { key: string; fv: string; av: string }[] } => x != null);

  return (
    <div className="mt-2 rounded-xl border border-border-light bg-bg-secondary/40 px-3 py-3 sm:mx-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-medium text-primary">
          {formatDate(m.date)} · {m.competition}
          {m.round ? ` · ${m.round}` : ''}
        </span>
        {m.venue && (
          <span className="text-muted">{t(`matchLog.venue.${m.venue}`)}</span>
        )}
        <span className="font-display font-semibold tabular-nums text-primary">
          {scoreText(m)}
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium text-primary">
          {oppClub && <Crest slug={oppClub.slug} />}
          {dash(m.opponent)}
        </span>
        {m.reportUrl && (
          <a
            href={m.reportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-xs font-medium text-brand hover:underline"
          >
            {t('matchLog.report')} ↗
          </a>
        )}
      </div>

      {infoShow.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4">
          {infoShow.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-muted">{k}</dt>
              <dd className="truncate font-medium text-primary">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      {logs === null && (
        <p className="mt-3 text-xs text-muted">{t('matchLog.loading')}</p>
      )}
      {logs === LOAD_FAILED && (
        <LoadFail
          onRetry={() =>
            ctx &&
            loadMatchlogs(ctx.club.slug, m.season).then((d) => setLogs(d))
          }
        />
      )}
      <div className="grid gap-x-8 lg:grid-cols-3">
      {statSections.map(({ typ, rows }) => (
        <div key={typ} className="mt-3 min-w-0">
          <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
            {t(`matchLog.detail.${typ}`)}
            {ctx && (
              <span className="ml-2 font-normal normal-case text-muted">
                {ctx.club.shortName ?? ctx.club.name} {t('matchLog.detail.vs')}{' '}
                {dash(m.opponent)}
              </span>
            )}
          </h4>
          <div className="flex flex-col gap-2">
            {rows.map(({ key, fv, av }) => {
              const fn = num(fv);
              const an = num(av);
              const total = Math.abs(fn ?? 0) + Math.abs(an ?? 0);
              const share = total > 0 ? (Math.abs(fn ?? 0) / total) * 100 : 50;
              const show = (n: number | null) =>
                n == null ? '—' : Number.isInteger(n) ? String(n) : fmt(n);
              return (
                <div key={key} className="flex flex-col gap-1">
                  <div className="grid grid-cols-[4rem_minmax(0,1fr)_4rem] items-center text-xs tabular-nums">
                    <span className="font-semibold text-primary">{show(fn)}</span>
                    <span className="truncate text-center text-muted">
                      {t(`matchLog.stat.${key}`)}
                    </span>
                    <span className="text-right font-semibold text-secondary">{show(an)}</span>
                  </div>
                  <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
                    <span
                      className={`rounded-l-full ${total > 0 ? 'bg-brand' : 'bg-bg-secondary'}`}
                      style={{ width: `${share}%` }}
                    />
                    <span
                      className={`flex-1 rounded-r-full ${total > 0 ? 'bg-muted/40' : 'bg-bg-secondary'}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}

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
  const listRef = useRef<HTMLUListElement>(null);

  const toggle = (i: number, el: HTMLElement) => {
    setOpen((cur) => {
      const next = cur === i ? null : i;
      if (next != null) {
        requestAnimationFrame(() => {
          const r = el.getBoundingClientRect();
          if (r.bottom > window.innerHeight || r.top < 0) {
            el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        });
      }
      return next;
    });
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
                onClick={(e) => toggle(i, e.currentTarget.parentElement as HTMLElement)}
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
            <div
              className="detail-anim grid"
              style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
              aria-hidden={!isOpen}
            >
              <div className="overflow-hidden">
                {isOpen && <MatchDetail m={m} />}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
