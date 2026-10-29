'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/i18n/I18nContext';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const NON_CLUB = new Set(['admin', 'clubs-compare', 'api', 'data', '_next']);

export function TrackView() {
  const pathname = usePathname();
  const { lang } = useI18n();
  const langRef = useRef(lang);
  const prev = useRef<string | null>(null);

  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  useEffect(() => {
    if (!pathname) return;
    // first pageview: real external referrer; SPA navigations: previous path
    const referrer =
      prev.current == null
        ? document.referrer || null
        : `${location.origin}${prev.current}`;
    prev.current = pathname;
    const seg = pathname.split('/').filter(Boolean)[0] ?? '';
    const club = seg && !NON_CLUB.has(seg) ? seg : null;
    const theme = document.documentElement.dataset.theme ?? null;
    const body = JSON.stringify({ path: pathname, club, referrer, lang: langRef.current, theme });
    try {
      navigator.sendBeacon(
        `${BASE_PATH}/api/track`,
        new Blob([body], { type: 'application/json' }),
      );
    } catch {
      // tracking is best-effort
    }
  }, [pathname]); // lang via ref: toggling it must not count an extra pageview

  return null;
}
