import { getSquad, getSeasonRows, getPlayers } from '@/lib/data';
import { seasonShort } from '@/lib/stats';
import { AppHeader } from '@/components/AppHeader';
import { SquadDashboard } from '@/components/SquadDashboard';

export default async function SquadPage({ params }: { params: Promise<{ club: string }> }) {
  const { club } = await params;
  const squad = getSquad(club);
  const players = getPlayers(club);
  const rows = getSeasonRows(club);
  const allRows = rows.filter((r) => r.competition === 'All Competitions');
  const sorted = [...allRows].sort((a, b) => a.season.localeCompare(b.season));
  const first = sorted[0]?.season ?? '';
  const last = sorted[sorted.length - 1]?.season ?? '';
  const seasonRange = first && last ? `${seasonShort(first)} – ${seasonShort(last)}` : '';

  return (
    <div className="hero-glow relative flex min-h-screen flex-col bg-bg">
      <AppHeader seasonRange={seasonRange} />
      <SquadDashboard data={squad} playersData={players} />
    </div>
  );
}

export const dynamicParams = false;
