'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import type { MatchRow, CompGroup, SeasonMatchlogs } from '@/lib/types';
import { matchesForSeason, compInGroup } from '@/lib/stats';
import { CompetitionTabs } from './CompetitionTabs';
import {
  loadMatchlogs,
  StatTable,
  ScoresList,
  SideToggle,
} from './matchlog-shared';

export function MatchlogBrowser({
  type,
  matches,
  seasons,
  titleKey,
}: {
  type: 'scores' | 'shooting' | 'misc';
  matches: MatchRow[];
  seasons: string[];
  titleKey: string;
}) {
  const { t } = useI18n();
  const [season, setSeason] = useState(seasons[seasons.length - 1] ?? '');
  const [group, setGroup] = useState<CompGroup>('all');
  const [side, setSide] = useState<'for' | 'against'>('for');
  const [loaded, setLoaded] = useState<{ season: string; data: SeasonMatchlogs } | null>(null);

  useEffect(() => {
    if (type === 'scores') return;
    let live = true;
    loadMatchlogs(season).then((data) => {
      if (live) setLoaded({ season, data });
    });
    return () => {
      live = false;
    };
  }, [season, type]);

  const rows = type === 'scores' ? matchesForSeason(matches, season, group) : [];
  const showComp = group === 'all' || group === 'europe';

  const loading = type !== 'scores' && loaded?.season !== season;
  const statTable = type !== 'scores' && !loading ? loaded?.data[type]?.[side] : undefined;
  const statCount =
    statTable == null
      ? null
      : statTable.rows.filter((r) => {
          const i = statTable.columns.indexOf('Comp');
          return i < 0 || compInGroup(r[i] ?? '', group);
        }).length;

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-6 py-8 lg:px-10">
      <div className="min-w-0 rounded-2xl border border-border bg-surface shadow-sm dark:shadow-none">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-baseline gap-3">
            <h2 className="truncate font-display text-lg font-semibold text-primary">
              {t(titleKey)}
            </h2>
            <span className="whitespace-nowrap text-sm text-muted">
              {type === 'scores'
                ? `${rows.length} ${t('matchLog.matches')}`
                : statCount != null
                  ? `${statCount} ${t('matchLog.matches')}`
                  : ''}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-sm text-muted">
            <label htmlFor="matchlog-season">{t('table.season')}</label>
            <select
              id="matchlog-season"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            >
              {[...seasons].reverse().map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-2 overflow-x-auto border-b border-border px-4 py-2">
          <CompetitionTabs group={group} onChange={setGroup} />
          {type !== 'scores' && <SideToggle side={side} onChange={setSide} />}
        </div>

        {type === 'scores' ? (
          rows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">{t('matchLog.noData')}</p>
          ) : (
            <ScoresList rows={rows} showComp={showComp} />
          )
        ) : loading ? (
          <p className="px-4 py-6 text-sm text-muted">{t('matchLog.loading')}</p>
        ) : statTable ? (
          <StatTable table={statTable} group={group} />
        ) : (
          <p className="px-4 py-6 text-sm text-muted">{t('matchLog.noStatData')}</p>
        )}
      </div>
    </main>
  );
}
