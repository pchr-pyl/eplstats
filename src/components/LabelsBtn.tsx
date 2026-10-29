'use client';

import { useI18n } from '@/i18n/I18nContext';

export function LabelsBtn({ on, onClick }: { on: boolean; onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      title={t('chart.labels')}
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-md border px-2 py-1 text-[10px] font-semibold tabular-nums transition ${
        on
          ? 'border-brand bg-brand-soft text-brand'
          : 'border-border text-muted hover:text-primary'
      }`}
    >
      123
    </button>
  );
}
