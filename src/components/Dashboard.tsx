'use client';

import { useState, useMemo } from 'react';
import type { SeasonRow, MatchRow, CompGroup } from '@/lib/types';
import { rowsForGroup } from '@/lib/stats';
import { CompetitionTabs } from './CompetitionTabs';
import { KpiCards } from './KpiCards';
import { TrendCharts } from './TrendCharts';
import { SeasonTable } from './SeasonTable';
import { DataNote } from './DataNote';
import { useI18n } from '@/i18n/I18nContext';

export function Dashboard({ rows, matches }: { rows: SeasonRow[]; matches: MatchRow[] }) {
  const { t } = useI18n();
  const [group, setGroup] = useState<CompGroup>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const groupRows = useMemo(() => rowsForGroup(rows, group), [rows, group]);

  const seasons = useMemo(
    () => [...new Set(rows.map((r) => r.season))].sort(),
    [rows]
  );
  const firstSeason = seasons[0] ?? '';
  const lastSeason = seasons[seasons.length - 1] ?? '';
  const lo = from ?? firstSeason;
  const hi = to ?? lastSeason;
  const rangedRows = useMemo(
    () => groupRows.filter((r) => r.season >= lo && r.season <= hi),
    [groupRows, lo, hi]
  );

  const changeGroup = (g: CompGroup) => {
    setGroup(g);
    setSelected(null);
  };

  const toggleSeason = (season: string) =>
    setSelected((prev) => (prev === season ? null : season));

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-6 py-8 lg:px-10">
      <section className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CompetitionTabs group={group} onChange={changeGroup} />
          <div className="flex items-center gap-2 text-sm text-muted">
            <label htmlFor="season-from">{t('filter.from')}</label>
            <select
              id="season-from"
              value={lo}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            >
              {seasons.map((s) => (
                <option key={s} value={s} disabled={s > hi}>
                  {s}
                </option>
              ))}
            </select>
            <label htmlFor="season-to">{t('filter.to')}</label>
            <select
              id="season-to"
              value={hi}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            >
              {seasons.map((s) => (
                <option key={s} value={s} disabled={s < lo}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        <KpiCards rows={rangedRows} />
      </section>

      <section className="flex min-w-0 flex-col gap-4">
        <TrendCharts rows={rangedRows} />
      </section>

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
