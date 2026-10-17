'use client';

import { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import type { SeasonRow, MatchRow, CompGroup } from '@/lib/types';
import { winRate, csRate } from '@/lib/stats';
import { fmt, pct, signed, dash } from '@/lib/format';
import { SeasonModal } from './SeasonModal';

type SortKey =
  | 'season' | 'competition' | 'mp' | 'w' | 'd' | 'l'
  | 'gf' | 'ga' | 'gd' | 'pts' | 'ptsPerMp'
  | 'xg' | 'xga' | 'xgd' | 'cs' | 'winRate' | 'csRate'
  | 'topScorer' | 'goalkeeper' | 'notes';

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
  const { t } = useI18n();
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'season', dir: 'desc' });

  const numeric = (fn: (r: SeasonRow) => number | null) => (r: SeasonRow) => fn(r) ?? -Infinity;
  const text = (fn: (r: SeasonRow) => string | null) => (r: SeasonRow) => fn(r) ?? '';

  const columns: Col[] = useMemo(() => {
    const base: Col[] = [
      { key: 'season', label: t('table.season'), align: 'left', sortValue: text(r => r.season) },
    ];
    if (group === 'all') {
      base.push({ key: 'competition', label: t('table.competition'), align: 'left', sortValue: text(r => r.competition) });
    }
    base.push(
      { key: 'mp', label: t('table.mp'), align: 'right', sortValue: numeric(r => r.mp) },
      { key: 'w', label: t('table.w'), align: 'right', sortValue: numeric(r => r.w) },
      { key: 'd', label: t('table.d'), align: 'right', sortValue: numeric(r => r.d) },
      { key: 'l', label: t('table.l'), align: 'right', sortValue: numeric(r => r.l) },
      { key: 'gf', label: t('table.gf'), align: 'right', sortValue: numeric(r => r.gf) },
      { key: 'ga', label: t('table.ga'), align: 'right', sortValue: numeric(r => r.ga) },
      { key: 'gd', label: t('table.gd'), align: 'right', sortValue: numeric(r => r.gd) },
      { key: 'pts', label: t('table.pts'), align: 'right', sortValue: numeric(r => r.pts) },
      { key: 'ptsPerMp', label: t('table.ptsPerMp'), align: 'right', sortValue: numeric(r => r.ptsPerMp) },
      { key: 'xg', label: t('table.xg'), align: 'right', sortValue: numeric(r => r.xg) },
      { key: 'xga', label: t('table.xga'), align: 'right', sortValue: numeric(r => r.xga) },
      { key: 'xgd', label: t('table.xgd'), align: 'right', sortValue: numeric(r => r.xgd) },
      { key: 'cs', label: t('table.cs'), align: 'right', sortValue: numeric(r => r.cs) },
      { key: 'winRate', label: t('table.winRate'), align: 'right', sortValue: numeric(r => winRate(r)), render: r => pct(winRate(r), 2) },
      { key: 'csRate', label: t('table.csRate'), align: 'right', sortValue: numeric(r => csRate(r)), render: r => pct(csRate(r), 2) },
      { key: 'topScorer', label: t('table.topScorer'), align: 'left', sortValue: text(r => r.topScorer), render: r => <span className="block truncate max-w-[140px]" title={r.topScorer ?? undefined}>{dash(r.topScorer)}</span> },
      { key: 'goalkeeper', label: t('table.goalkeeper'), align: 'left', sortValue: text(r => r.goalkeeper), render: r => <span className="block truncate max-w-[140px]" title={r.goalkeeper ?? undefined}>{dash(r.goalkeeper)}</span> },
      { key: 'notes', label: t('table.notes'), align: 'left', sortValue: text(r => r.notes), render: r => <span className="block truncate max-w-[160px]" title={r.notes ?? undefined}>{dash(r.notes)}</span> },
    );
    return base;
  }, [t, group]);

  const sortedRows = useMemo(() => {
    const col = columns.find(c => c.key === sort.key);
    const copy = [...rows];
    copy.sort((a, b) => {
      const aVal = col?.sortValue ? col.sortValue(a) : null;
      const bVal = col?.sortValue ? col.sortValue(b) : null;
      let cmp = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') cmp = aVal - bVal;
      else cmp = String(aVal).localeCompare(String(bVal));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [rows, sort, columns]);

  const toggleSort = (key: SortKey) => setSort(prev => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));

  const renderCell = (col: Col, r: SeasonRow) => {
    if (col.render) return col.render(r);
    switch (col.key) {
      case 'season': return (
        <div className="flex items-center gap-2">
          <span className="font-medium text-primary">{r.season}</span>
          {r.rank && <RankBadge rank={r.rank} />}
        </div>
      );
      case 'competition': return <span className="text-secondary">{dash(r.competition)}</span>;
      case 'gd': return <span>{signed(r.gd, 0)}</span>;
      case 'xgd': return <span>{signed(r.xgd, 2)}</span>;
      case 'ptsPerMp': return <span>{fmt(r.ptsPerMp, 2)}</span>;
      case 'xg': case 'xga': return <span>{fmt(r[col.key], 2)}</span>;
      default: {
        const raw = (r as unknown as Record<string, unknown>)[col.key];
        if (typeof raw === 'number') return <span>{fmt(raw, 0)}</span>;
        if (typeof raw === 'string') return <span>{dash(raw)}</span>;
        return <span>—</span>;
      }
    }
  };

  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm dark:shadow-none">
      <div className="border-b border-border px-4 py-3">
        <h3 className="font-display text-lg font-semibold text-primary">
          {t('table.title')}
        </h3>
      </div>
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full min-w-[1000px] border-collapse">
        <thead className="sticky top-0 z-10 bg-surface-elevated">
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                onClick={() => toggleSort(col.key)}
                className={`cursor-pointer border-b border-border px-3 py-3 text-xs font-semibold uppercase tracking-wider text-muted transition-colors hover:bg-bg-secondary ${col.align === 'left' ? 'text-left' : 'text-right'}`}
              >
                <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : 'justify-start'}`}>
                  <span>{col.label}</span>
                  {sort.key === col.key ? (sort.dir === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} className="opacity-30" />}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((r, idx) => (
            <tr
              key={`${r.season}-${r.competition}-${idx}`}
              onClick={() => onSelect?.(r.season)}
              className={`border-b border-border transition-colors hover:bg-bg-secondary ${
                onSelect ? 'cursor-pointer' : ''
              } ${selectedSeason === r.season ? 'bg-brand-soft' : ''}`}
            >
              {columns.map(col => (
                <td key={col.key} className={`px-3 py-3 text-sm ${col.align === 'left' ? 'text-left' : 'text-right'}`}>
                  <span className={col.key === 'season' ? '' : 'text-secondary'}>{renderCell(col, r)}</span>
                </td>
              ))}
            </tr>
          ))}
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
  const isGold = clean.toLowerCase().includes('1st') || clean === 'W' || clean === 'F' || rank.includes('**');
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${isGold ? 'bg-brand-soft text-brand' : 'bg-bg-secondary text-muted'}`}>
      {clean}
    </span>
  );
}
