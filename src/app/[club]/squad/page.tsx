import { getPlayers, getSquad } from '@/lib/data';
import { SquadDashboard } from '@/components/SquadDashboard';
import type { PlayersData, SquadData } from '@/lib/types';

export default async function SquadPage({ params }: { params: Promise<{ club: string }> }) {
  const { club } = await params;
  const squad = getSquad(club);
  const players = getPlayers(club);
  const squadSeasons = Object.keys(squad.seasons ?? {}).sort();
  const latestSquad = squadSeasons[squadSeasons.length - 1];
  const inline: SquadData = {
    ...squad,
    seasons: latestSquad ? { [latestSquad]: squad.seasons![latestSquad] } : {},
    availableSeasons: squadSeasons,
  };
  const playersInline: PlayersData = {
    latest: players.latest,
    seasons:
      players.latest && players.seasons[players.latest]
        ? { [players.latest]: players.seasons[players.latest] }
        : {},
  };
  return <SquadDashboard data={inline} playersData={playersInline} />;
}

export const dynamicParams = false;
