import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Metadata } from 'next';
import { getClubIndex } from '@/lib/data';
import { AppHeader } from '@/components/AppHeader';
import { PlayersCompare } from '@/components/players-compare/PlayersCompare';
import type { PcSeason } from '@/components/players-compare/types';

export const metadata: Metadata = {
  title: 'Compare Players — Premier League Player vs Player',
  description:
    'Compare any two Premier League outfield players across clubs and eras: percentile radar & pizza charts, league scatter context, career trajectories and statistical twins.',
  alternates: { canonical: '/players-compare/' },
};

const dir = join(process.cwd(), 'public', 'data', 'players-compare');

export default function PlayersComparePage() {
  const idx = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')) as {
    seasons: string[];
    latest: string;
  };
  const defaultSeason = idx.seasons.includes('2025-2026') ? '2025-2026' : idx.latest;
  const preloadList = Array.from(new Set([defaultSeason, idx.latest]));
  const initialSeasons: Record<string, PcSeason> = {};
  for (const s of preloadList) {
    initialSeasons[s] = JSON.parse(readFileSync(join(dir, `${s}.json`), 'utf8')) as PcSeason;
  }

  return (
    <div className="hero-glow relative flex min-h-screen flex-col bg-bg">
      <AppHeader />
      <PlayersCompare
        clubs={getClubIndex()}
        seasons={idx.seasons}
        initialSeasons={initialSeasons}
        defaultSeason={defaultSeason}
      />
    </div>
  );
}
