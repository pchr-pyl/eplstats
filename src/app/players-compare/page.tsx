import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Metadata } from 'next';
import { getClubIndex } from '@/lib/data';
import { AppHeader } from '@/components/AppHeader';
import { PlayersCompare, type PcSeason } from '@/components/PlayersCompare';

export const metadata: Metadata = {
  title: 'Compare Players — Premier League Player vs Player',
  description:
    'Compare any two Premier League players side by side: goals, assists, shooting per 90 and a percentile pizza chart against positional peers.',
  alternates: { canonical: '/players-compare/' },
};

const dir = join(process.cwd(), 'public', 'data', 'players-compare');

export default function PlayersComparePage() {
  const idx = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')) as { seasons: string[]; latest: string };
  const initial = JSON.parse(readFileSync(join(dir, `${idx.latest}.json`), 'utf8')) as PcSeason;
  return (
    <div className="hero-glow relative flex min-h-screen flex-col bg-bg">
      <AppHeader />
      <PlayersCompare clubs={getClubIndex()} seasons={idx.seasons} initial={initial} />
    </div>
  );
}
