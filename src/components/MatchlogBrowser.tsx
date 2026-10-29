'use client';

import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { useClub, useClubData } from './ClubProvider';
import type { CompGroup, SeasonMatchlogs } from '@/lib/types';
import { matchesForSeason, compInGroup } from '@/lib/stats';
import { CompetitionTabs } from './CompetitionTabs';
import {
  loadMatchlogs,
  StatTable,
  ScoresList,
  SideToggle,
  LoadFail,
  LOAD_FAILED,
} from './matchlog-shared';

export type MatchlogPanelType = 'scores' | 'shooting' | 'keeper' | 'misc';

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
    [matches]
  );
  const [season, setSeason] = useState(seasons[seasons.length - 1] ?? '');
  const [internalGroup, setInternalGroup] = useState<CompGroup>('all');
  const controlled = group !== undefined;
  const activeGroup = group ?? internalGroup;
  const [side, setSide] = useState<'for' | 'against'>('for');
  const [loaded, setLoaded] = useState<
    { season: string; data: SeasonMatchlogs } | typeof LOAD_FAILED | null
  >(null);

  const fetchSeason = (s: string) => {
    loadMatchlogs(club.slug, s).then((data) =>
      setLoaded(data === LOAD_FAILED ? LOAD_FAILED : { season: s, data }),
    );
  };

  useEffect(() => {
    if (type === 'scores') return;
    let live = true;
    loadMatchlogs(club.slug, season).then((data) => {
      if (live)
        setLoaded(data === LOAD_FAILED ? LOAD_FAILED : { season, data });
    });
    return () => {
      live = false;
    };
  }, [club.slug, season, type]);

  const rows =
    type === 'scores' ? matchesForSeason(matches, season, activeGroup) : [];
  const showComp = activeGroup === 'all' || activeGroup === 'europe';

  const loadedData = loaded === LOAD_FAILED ? null : loaded;
  const loading =
    type !== 'scores' &&
    (loaded === null ||
      (loaded !== LOAD_FAILED && loaded.season !== season));
  const statTable =
    type !== 'scores' && !loading ? loadedData?.data[type]?.[side] : undefined;
  const statCount =
    statTable == null
      ? null
      : statTable.rows.filter((r: string[]) => {
          const i = statTable.columns.indexOf('Comp');
          return i < 0 || compInGroup(r[i] ?? '', activeGroup);
        }).length;

  return (
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
        {!controlled && (
          <CompetitionTabs group={activeGroup} onChange={setInternalGroup} />
        )}
        {type !== 'scores' && <SideToggle side={side} onChange={setSide} />}
      </div>

      {type === 'scores' ? (
        rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">{t('matchLog.noData')}</p>
        ) : (
          <ScoresList rows={rows} showComp={showComp} contained={false} />
        )
      ) : loading ? (
        <p className="px-4 py-6 text-sm text-muted">{t('matchLog.loading')}</p>
      ) : loaded === LOAD_FAILED ? (
        <LoadFail onRetry={() => fetchSeason(season)} />
      ) : statTable ? (
        <StatTable table={statTable} group={activeGroup} />
      ) : (
        <p className="px-4 py-6 text-sm text-muted">{t('matchLog.noStatData')}</p>
      )}
    </div>
  );
}

export function MatchlogBrowser({
  type,
  titleKey,
}: {
  type: MatchlogPanelType;
  titleKey: string;
}) {
  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-6 py-8 lg:px-10">
      <MatchlogPanel type={type} titleKey={titleKey} />
    </main>
  );
}
