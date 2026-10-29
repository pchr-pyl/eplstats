'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const NON_CLUB = new Set(['admin', 'clubs-compare', 'api', 'data', '_next']);

export function TrackView() {
  const pathname = usePathname();
  const referrer = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    if (referrer.current == null) referrer.current = document.referrer || null;
    const seg = pathname.split('/').filter(Boolean)[0] ?? '';
    const club = seg && !NON_CLUB.has(seg) ? seg : null;
    const body = JSON.stringify({ path: pathname, club, referrer: referrer.current });
    try {
      navigator.sendBeacon(
        `${BASE_PATH}/api/track`,
        new Blob([body], { type: 'application/json' }),
      );
    } catch {
      // tracking is best-effort
    }
  }, [pathname]);

  return null;
}
