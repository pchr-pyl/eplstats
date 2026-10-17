'use client';

import { useI18n } from '@/i18n/I18nContext';

export function DataNote() {
  const { t } = useI18n();
  return (
    <p className="text-xs text-muted">
      {t('dataNote')}
    </p>
  );
}
