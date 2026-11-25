'use client';

import { useState, useMemo } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  Search,
  Trophy,
  X,
} from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import type { SeasonRow, MatchRow, CompGroup } from '@/lib/types';
import { winRate, csRate } from '@/lib/stats';
import { fmt, pct, signed, dash } from '@/lib/format';
import { SeasonModal } from './SeasonModal';

type SortKey =
  | 'season'
  | 'competition'
  | 'mp'
  | 'w'
  | 'd'
  | 'l'
  | 'gf'
  | 'ga'
  | 'gd'
  | 'pts'
  | 'ptsPerMp'
  | 'xg'
  | 'xga'
  | 'xgd'
  | 'cs'
  | 'winRate'
  | 'csRate'
  | 'topScorer'
  | 'goalkeeper'
  | 'notes';

type SortDir = 'asc' | 'desc';

interface Col {
  key: SortKey;
  label: string;
  align?: 'left' | 'right';
  render?: (r: SeasonRow) => React.ReactNode;
  sortValue?: (r: SeasonRow) => number | string | null;
}

export function SeasonTable({
  rows,
  group,
  selectedSeason,
  onSelect,
  matches,
}: {
  rows: SeasonRow[];
  group: CompGroup;
  selectedSeason?: string | null;
  onSelect?: (season: string) => void;
  matches: MatchRow[];
}) {
  const { t, lang } = useI18n();
  const th = lang === 'th';
  const tx = (en: string, thText: string) => (th ? thText : en);

  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: 'season',
    dir: 'desc',
  });
  const [query, setQuery] = useState('');

  const numeric = (fn: (r: SeasonRow) => number | null) => (r: SeasonRow) =>
    fn(r) ?? -Infinity;
  const text = (fn: (r: SeasonRow) => string | null) => (r: SeasonRow) =>
    fn(r) ?? '';

  const columns: Col[] = useMemo(() => {
    const base: Col[] = [
      {
        key: 'season',
        label: t('table.season'),
        align: 'left',
        sortValue: text((r) => r.season),
      },
    ];
    if (group === 'all') {
      base.push({
        key: 'competition',
        label: t('table.competition'),
        align: 'left',
        sortValue: text((r) => r.competition),
      });
    }
    base.push(
      { key: 'mp', label: t('table.mp'), align: 'right', sortValue: numeric((r) => r.mp) },
      { key: 'w', label: t('table.w'), align: 'right', sortValue: numeric((r) => r.w) },
      { key: 'd', label: t('table.d'), align: 'right', sortValue: numeric((r) => r.d) },
      { key: 'l', label: t('table.l'), align: 'right', sortValue: numeric((r) => r.l) },
      { key: 'gf', label: t('table.gf'), align: 'right', sortValue: numeric((r) => r.gf) },
      { key: 'ga', label: t('table.ga'), align: 'right', sortValue: numeric((r) => r.ga) },
      { key: 'gd', label: t('table.gd'), align: 'right', sortValue: numeric((r) => r.gd) },
      { key: 'pts', label: t('table.pts'), align: 'right', sortValue: numeric((r) => r.pts) },
      {
        key: 'ptsPerMp',
        label: t('table.ptsPerMp'),
        align: 'right',
        sortValue: numeric((r) => r.ptsPerMp),
      },
      { key: 'xg', label: t('table.xg'), align: 'right', sortValue: numeric((r) => r.xg) },
      { key: 'xga', label: t('table.xga'), align: 'right', sortValue: numeric((r) => r.xga) },
      { key: 'xgd', label: t('table.xgd'), align: 'right', sortValue: numeric((r) => r.xgd) },
      { key: 'cs', label: t('table.cs'), align: 'right', sortValue: numeric((r) => r.cs) },
      {
        key: 'winRate',
        label: t('table.winRate'),
        align: 'right',
        sortValue: numeric((r) => winRate(r)),
        render: (r) => <span className="tabular-nums">{pct(winRate(r), 2)}</span>,
      },
      {
        key: 'csRate',
        label: t('table.csRate'),
        align: 'right',
        sortValue: numeric((r) => csRate(r)),
        render: (r) => <span className="tabular-nums">{pct(csRate(r), 2)}</span>,
      },
      {
        key: 'topScorer',
        label: t('table.topScorer'),
        align: 'left',
        sortValue: text((r) => r.topScorer),
        render: (r) => (
          <span
            className="block max-w-[140px] truncate text-primary"
            title={r.topScorer ?? undefined}
          >
            {dash(r.topScorer)}
          </span>
        ),
      },
      {
        key: 'goalkeeper',
        label: t('table.goalkeeper'),
        align: 'left',
        sortValue: text((r) => r.goalkeeper),
        render: (r) => (
          <span
            className="block max-w-[140px] truncate"
            title={r.goalkeeper ?? undefined}
          >
            {dash(r.goalkeeper)}
          </span>
        ),
      },
      {
        key: 'notes',
        label: t('table.notes'),
        align: 'left',
        sortValue: text((r) => r.notes),
        render: (r) => (
          <span
            className="block max-w-[160px] truncate text-muted"
            title={r.notes ?? undefined}
          >
            {dash(r.notes)}
          </span>
        ),
      },
    );
    return base;
  }, [t, group]);

  const TIP: Partial<Record<SortKey, string>> = {
    season: t('colTip.season'),
    mp: t('colTip.mp'),
    w: t('colTip.w'),
    d: t('colTip.d'),
    l: t('colTip.l'),
    gf: t('colTip.gf'),
    ga: t('colTip.ga'),
    gd: t('colTip.gd'),
    pts: t('colTip.pts'),
    ptsPerMp: t('colTip.ptsPerMp'),
    xg: t('colTip.xg'),
    xga: t('colTip.xga'),
    xgd: t('colTip.xgd'),
    cs: t('colTip.cs'),
    winRate: t('colTip.winRate'),
    csRate: t('colTip.csRate'),
    topScorer: t('colTip.topScorer'),
  };

  const sortedRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) =>
          [r.season, r.rank, r.competition, r.topScorer, r.goalkeeper, r.notes]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q)),
        )
      : rows;

    const col = columns.find((c) => c.key === sort.key);
    const copy = [...filtered];
    copy.sort((a, b) => {
      const aVal = col?.sortValue ? col.sortValue(a) : null;
      const bVal = col?.sortValue ? col.sortValue(b) : null;
      let cmp = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') cmp = aVal - bVal;
      else cmp = String(aVal).localeCompare(String(bVal));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [rows, sort, columns, query]);

  const toggleSort = (key: SortKey) =>
    setSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc',
    }));

  const renderCell = (col: Col, r: SeasonRow) => {
    if (col.render) return col.render(r);
    switch (col.key) {
      case 'season':
        return (
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="font-semibold tabular-nums text-primary group-hover:text-brand">
              {r.season}
            </span>
            {r.rank && <RankBadge rank={r.rank} />}
            {onSelect && (
              <ChevronRight
                size={14}
                className="ml-auto shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100"
              />
            )}
          </div>
        );
      case 'competition':
        return <span className="text-secondary">{dash(r.competition)}</span>;
      case 'gd':
        return (
          <span
            className={`font-semibold tabular-nums ${
              r.gd != null && r.gd > 0
                ? 'text-success'
                : r.gd != null && r.gd < 0
                  ? 'text-danger'
                  : 'text-secondary'
            }`}
          >
            {signed(r.gd, 0)}
          </span>
        );
      case 'xgd':
        return (
          <span
            className={`font-semibold tabular-nums ${
              r.xgd != null && r.xgd > 0
                ? 'text-success'
                : r.xgd != null && r.xgd < 0
                  ? 'text-danger'
                  : 'text-secondary'
            }`}
          >
            {signed(r.xgd, 2)}
          </span>
        );
      case 'pts':
        return (
          <span className="font-display font-bold tabular-nums text-primary">
            {fmt(r.pts, 0)}
          </span>
        );
      case 'ptsPerMp':
        return (
          <span className="font-semibold tabular-nums text-primary">
            {fmt(r.ptsPerMp, 2)}
          </span>
        );
      case 'xg':
      case 'xga':
        return <span className="tabular-nums">{fmt(r[col.key], 2)}</span>;
      default: {
        const raw = (r as unknown as Record<string, unknown>)[col.key];
        if (typeof raw === 'number')
          return <span className="tabular-nums">{fmt(raw, 0)}</span>;
        if (typeof raw === 'string') return <span>{dash(raw)}</span>;
        return <span>—</span>;
      }
    }
  };

  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm dark:shadow-none">
      {/* Header bar with search + click affordance */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
              {tx('Historical Ledger', 'บันทึกผลงานรายฤดูกาล')}
            </p>
            <span className="rounded-md bg-bg-secondary px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-secondary">
              {sortedRows.length}/{rows.length}
            </span>
          </div>
          <h3 className="mt-0.5 font-display text-lg font-bold text-primary">
            {t('table.title')}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onSelect && (
            <span className="hidden rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-semibold text-brand sm:inline-flex">
              {tx('Click row for season breakdown', 'คลิกแถวเพื่อดูรายแมตช์')}
            </span>
          )}
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tx('Filter season, scorer, notes…', 'ค้นหาฤดูกาล, ดาวซัลโว…')}
              aria-label={tx('Filter seasons', 'ค้นหาฤดูกาล')}
              className="w-48 rounded-xl border border-border bg-bg-secondary/60 py-1.5 pl-8 pr-7 text-xs text-primary placeholder:text-muted focus:border-brand focus:bg-surface focus:outline-none sm:w-56"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label={tx('Clear filter', 'ล้างการค้นหา')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-primary"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full min-w-[1040px] border-collapse">
          <thead className="sticky top-0 z-10 bg-surface-elevated">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  title={TIP[col.key]}
                  onClick={() => toggleSort(col.key)}
                  className={`cursor-pointer border-b border-border px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-muted transition-colors hover:bg-bg-secondary hover:text-primary ${
                    col.align === 'left' ? 'text-left' : 'text-right'
                  } ${sort.key === col.key ? 'text-brand' : ''}`}
                >
                  <div
                    className={`flex items-center gap-1 ${
                      col.align === 'right' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <span>{col.label}</span>
                    {sort.key === col.key ? (
                      sort.dir === 'asc' ? (
                        <ArrowUp size={13} />
                      ) : (
                        <ArrowDown size={13} />
                      )
                    ) : (
                      <ArrowUpDown size={13} className="opacity-30" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-sm text-muted"
                >
                  {tx('No matching seasons found.', 'ไม่พบฤดูกาลที่ตรงกับคำค้นหา')}
                </td>
              </tr>
            ) : (
              sortedRows.map((r, idx) => (
                <tr
                  key={`${r.season}-${r.competition}-${idx}`}
                  onClick={() => onSelect?.(r.season)}
                  className={`group border-b border-border-light transition-colors hover:bg-bg-secondary/80 ${
                    onSelect ? 'cursor-pointer' : ''
                  } ${selectedSeason === r.season ? 'bg-brand-soft' : ''}`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-3 py-3 text-sm ${
                        col.align === 'left' ? 'text-left' : 'text-right tabular-nums'
                      }`}
                    >
                      <span className={col.key === 'season' ? '' : 'text-secondary'}>
                        {renderCell(col, r)}
                      </span>
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedSeason && (
        <SeasonModal
          season={selectedSeason}
          group={group}
          matches={matches}
          onClose={() => onSelect?.(selectedSeason)}
        />
      )}
    </div>
  );
}

function RankBadge({ rank }: { rank: string }) {
  const clean = rank.replace(/\*\*/g, '').trim();
  const low = clean.toLowerCase();
  const numMatch = /^(\d+)/.exec(clean);
  const pos = numMatch ? parseInt(numMatch[1], 10) : null;

  const isChampion = low.includes('1st') || clean === 'W' || rank.includes('**');
  const isTop4 = pos != null && pos >= 2 && pos <= 4;
  const isEurope =
    (pos != null && pos >= 5 && pos <= 6) || clean === 'F' || clean === 'SF';
  const isRelegated = pos != null && pos >= 18;

  let tone = 'bg-bg-secondary text-muted';
  if (isChampion) {
    tone = 'border border-warning/35 bg-warning-soft text-warning';
  } else if (isTop4) {
    tone = 'bg-info-soft text-info';
  } else if (isEurope) {
    tone = 'bg-brand-soft text-brand';
  } else if (isRelegated) {
    tone = 'bg-danger-soft text-danger';
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tabular-nums ${tone}`}
    >
      {isChampion && <Trophy size={10} />}
      {clean}
    </span>
  );
}
