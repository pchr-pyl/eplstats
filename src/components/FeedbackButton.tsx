'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { MessageSquare, X } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const TYPES = ['bug', 'idea', 'other'] as const;

export function FeedbackButton() {
  const { t } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<(typeof TYPES)[number]>('bug');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  if (pathname?.startsWith('/admin')) return null;

  const submit = async () => {
    if (!message.trim() || state === 'sending') return;
    setState('sending');
    try {
      const r = await fetch(`${BASE_PATH}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, message: message.trim(), contact: contact.trim() || null, page: pathname }),
      });
      setState(r.ok ? 'sent' : 'error');
      if (r.ok) setMessage('');
    } catch {
      setState('error');
    }
  };

  const close = () => {
    setOpen(false);
    setState('idle');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('feedback.button')}
        className="fixed bottom-5 right-5 z-[60] flex h-11 w-11 items-center justify-center rounded-full bg-brand text-white shadow-lg transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <MessageSquare size={18} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <div
            role="dialog"
            aria-label={t('feedback.title')}
            className="w-full max-w-md rounded-t-2xl border border-border bg-surface p-5 shadow-xl sm:rounded-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-primary">
                {t('feedback.title')}
              </h3>
              <button
                type="button"
                onClick={close}
                aria-label={t('feedback.close')}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-bg-secondary hover:text-primary"
              >
                <X size={16} />
              </button>
            </div>

            {state === 'sent' ? (
              <p className="py-6 text-center text-sm text-primary">{t('feedback.thanks')}</p>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex gap-2">
                  {TYPES.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setType(k)}
                      aria-pressed={type === k}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                        type === k
                          ? 'bg-brand-soft text-brand'
                          : 'border border-border bg-surface text-secondary hover:text-primary'
                      }`}
                    >
                      {t(`feedback.${k}`)}
                    </button>
                  ))}
                </div>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder={t('feedback.message')}
                  className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm text-primary placeholder:text-muted focus:border-brand focus:outline-none"
                />
                <input
                  type="email"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder={t('feedback.contact')}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-primary placeholder:text-muted focus:border-brand focus:outline-none"
                />
                {state === 'error' && (
                  <p className="text-xs text-danger">{t('feedback.error')}</p>
                )}
                <button
                  type="button"
                  onClick={submit}
                  disabled={!message.trim() || state === 'sending'}
                  className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {state === 'sending' ? t('feedback.sending') : t('feedback.submit')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
