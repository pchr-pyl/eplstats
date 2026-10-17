'use client';

import { useEffect } from 'react';
import type { MatchRow, CompGroup } from '@/lib/types';
import { MatchLog } from './MatchLog';

export function SeasonModal({
  season,
  group,
  matches,
  onClose,
}: {
  season: string;
  group: CompGroup;
  matches: MatchRow[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-3xl">
        <MatchLog
          matches={matches}
          season={season}
          group={group}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
