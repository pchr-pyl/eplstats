import { getClubIndex, getLeague, getSquadCompare } from '@/lib/data';
import { AppHeader } from '@/components/AppHeader';
import { ClubsCompare } from '@/components/ClubsCompare';

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
