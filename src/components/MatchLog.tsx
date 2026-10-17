'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import type { MatchRow, CompGroup, MatchlogType, SeasonMatchlogs } from '@/lib/types';
import { matchesForSeason } from '@/lib/stats';
import {
  loadMatchlogs,
  StatTable,
  ScoresList,
  SideToggle,
} from './matchlog-shared';

type TabKey = 'scores' | MatchlogType;
const TABS: TabKey[] = ['scores', 'shooting', 'keeper', 'misc'];

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
  const { t } = useI18n();
  const [tab, setTab] = useState<TabKey>('scores');
  const [side, setSide] = useState<'for' | 'against'>('for');
  const [matchlogs, setMatchlogs] = useState<SeasonMatchlogs | null>(null);

  const rows = matchesForSeason(matches, season, group);
  const showComp = group === 'all' || group === 'europe';

  const w = rows.filter((m) => m.result === 'W').length;
  const d = rows.filter((m) => m.result === 'D').length;
  const l = rows.filter((m) => m.result === 'L').length;

  useEffect(() => {
    if (tab === 'scores' || matchlogs != null) return;
    let live = true;
    loadMatchlogs(season).then((data) => {
      if (live) setMatchlogs(data);
    });
    return () => {
      live = false;
    };
  }, [tab, season, matchlogs]);

  const loading = tab !== 'scores' && matchlogs == null;
  const statTable = tab !== 'scores' ? matchlogs?.[tab]?.[side] : undefined;

  return (
    <div className="min-w-0 rounded-2xl border border-border bg-surface shadow-sm dark:shadow-none">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-baseline gap-3">
          <h3 className="truncate font-display text-lg font-semibold text-primary">
            {season} · {t(`competitions.${group}`)}
          </h3>
          <span className="whitespace-nowrap text-sm text-muted">
            {rows.length} {t('matchLog.matches')} · {w}W {d}D {l}L
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-bg-secondary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          aria-label={t('matchLog.close')}
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex min-w-0 items-center gap-2 overflow-x-auto border-b border-border px-4 py-2">
        {TABS.map((k) => {
          const active = k === tab;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              aria-pressed={active}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${
                active
                  ? 'bg-brand-soft text-brand'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              {t(`matchLog.tabs.${k}`)}
            </button>
          );
        })}
        {tab !== 'scores' && <SideToggle side={side} onChange={setSide} />}
      </div>

      {tab === 'scores' ? (
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
  );
}
