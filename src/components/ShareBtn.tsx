'use client';

import { useState } from 'react';
import { Link2, Check } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';

export function ShareBtn() {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const url = location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      title={copied ? t('chart.copied') : t('chart.share')}
      aria-label={t('chart.share')}
      onClick={copy}
      className={`rounded-md border px-2 py-1 transition ${
        copied
          ? 'border-success bg-success/15 text-success'
          : 'border-border text-muted hover:text-primary'
      }`}
    >
      {copied ? <Check size={12} /> : <Link2 size={12} />}
    </button>
  );
}
