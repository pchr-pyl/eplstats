'use client';

import { createContext, useContext } from 'react';
import type { ClubIndexEntry, SeasonRow, MatchRow, ManagerStint } from '@/lib/types';

interface ClubContextValue {
  club: ClubIndexEntry;
  clubs: ClubIndexEntry[];
  hasManagers: boolean;
}

interface ClubDataValue {
  rows: SeasonRow[];
  matches: MatchRow[];
  stints: ManagerStint[];
}

const ClubContext = createContext<ClubContextValue | null>(null);
const ClubDataContext = createContext<ClubDataValue | null>(null);

export function ClubProvider({
  club,
  clubs,
  hasManagers,
  rows,
  matches,
  stints,
  children,
}: {
  club: ClubIndexEntry;
  clubs: ClubIndexEntry[];
  hasManagers: boolean;
  rows: SeasonRow[];
  matches: MatchRow[];
  stints: ManagerStint[];
  children: React.ReactNode;
}) {
  return (
    <ClubContext.Provider value={{ club, clubs, hasManagers }}>
      <ClubDataContext.Provider value={{ rows, matches, stints }}>
        {children}
      </ClubDataContext.Provider>
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

export function useClubData(): ClubDataValue {
  const ctx = useContext(ClubDataContext);
  if (!ctx) throw new Error('useClubData must be used inside ClubProvider');
  return ctx;
}
