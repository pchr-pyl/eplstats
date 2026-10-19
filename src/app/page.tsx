import { getClubIndex, getLeague, getLeagueSeason } from '@/lib/data';
import { AppHeader } from '@/components/AppHeader';
import { LeagueHome } from '@/components/LeagueHome';

export default function Home() {
  const clubs = getClubIndex();
  const seasons = Object.keys(getLeague()).sort();
  const latest = seasons[seasons.length - 1] ?? '';
  const initial = latest ? getLeagueSeason(latest) : null;
  return (
    <div className="hero-glow relative flex min-h-screen flex-col bg-bg">
      <AppHeader />
      <LeagueHome clubs={clubs} seasons={seasons} initial={initial} />
    </div>
  );
}
