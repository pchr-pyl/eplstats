import { getClubIndex, getLeague } from '@/lib/data';
import { AppHeader } from '@/components/AppHeader';
import { LeagueHome } from '@/components/LeagueHome';

export default function Home() {
  const clubs = getClubIndex();
  const league = getLeague();
  return (
    <div className="hero-glow relative flex min-h-screen flex-col bg-bg">
      <AppHeader />
      <LeagueHome clubs={clubs} league={league} />
    </div>
  );
}
