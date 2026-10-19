'use client';

import { createContext, useContext } from 'react';
import type { ClubIndexEntry } from '@/lib/types';

interface ClubContextValue {
  club: ClubIndexEntry;
  clubs: ClubIndexEntry[];
  hasManagers: boolean;
}

const ClubContext = createContext<ClubContextValue | null>(null);

export function ClubProvider({
  club,
  clubs,
  hasManagers,
  children,
}: {
  club: ClubIndexEntry;
  clubs: ClubIndexEntry[];
  hasManagers: boolean;
  children: React.ReactNode;
}) {
  return (
    <ClubContext.Provider value={{ club, clubs, hasManagers }}>
      {children}
    </ClubContext.Provider>
  );
}

export function useClub(): ClubContextValue {
  const ctx = useContext(ClubContext);
  if (!ctx) throw new Error('useClub must be used inside ClubProvider');
  return ctx;
}

export function useClubOptional(): ClubContextValue | null {
  return useContext(ClubContext);
}
