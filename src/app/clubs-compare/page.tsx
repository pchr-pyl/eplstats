import { getClubIndex, getLeague, getSquadCompare } from '@/lib/data';
import { AppHeader } from '@/components/AppHeader';
import type { Metadata } from 'next';
import { ClubsCompare } from '@/components/ClubsCompare';

export const metadata: Metadata = {
  title: 'Compare Clubs — Head-to-Head Stats & Squad Costs',
  description:
    'Compare Premier League clubs side by side: points, goal difference, xG trends, wage bills, average squad age and top earners.',
  alternates: { canonical: '/clubs-compare/' },
};

export default function ClubsComparePage() {
  return (
    <div className="hero-glow relative flex min-h-screen flex-col bg-bg">
      <AppHeader />
      <ClubsCompare
        clubs={getClubIndex()}
        league={getLeague()}
        squad={getSquadCompare()}
      />
    </div>
  );
}
