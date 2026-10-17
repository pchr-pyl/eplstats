'use client';

import { useI18n } from '@/i18n/I18nContext';
import type { CompGroup } from '@/lib/types';

const GROUPS: CompGroup[] = ['all', 'premier-league', 'fa-cup', 'efl-cup', 'europe'];

export function CompetitionTabs({
  group,
  onChange,
}: {
  group: CompGroup;
  onChange: (group: CompGroup) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="flex min-w-0 gap-2 overflow-x-auto pb-2">
      {GROUPS.map((g) => {
        const active = g === group;
        return (
          <button
            key={g}
            type="button"
            onClick={() => onChange(g)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              active
                ? 'bg-brand-soft text-brand'
                : 'bg-surface border border-border text-secondary hover:text-primary'
            }`}
            aria-pressed={active}
          >
            {t(`competitions.${g}`)}
          </button>
        );
      })}
    </div>
  );
}
