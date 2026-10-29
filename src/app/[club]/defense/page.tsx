import { getKeepers, getTeamStats } from '@/lib/data';
import { DefenseDashboard } from '@/components/DefenseDashboard';
import type { KeepersData } from '@/lib/types';

export default async function DefensePage({ params }: { params: Promise<{ club: string }> }) {
  const { club } = await params;
  const keepers = getKeepers(club);
  const seasons = [...new Set(keepers.matchLog.map((r) => r.season))].sort();
  const latest = seasons[seasons.length - 1];
  const inline: KeepersData = {
    matchLog: keepers.matchLog.filter((r) => r.season === latest),
    perGkSeason: keepers.perGkSeason.filter((r) => r.season === latest),
    psxg: keepers.psxg.filter((r) => r.season === latest),
    psxgPerGk: keepers.psxgPerGk.filter((r) => r.season === latest),
    perGkComp: (keepers.perGkComp ?? []).filter((r) => r.season === latest),
  };
  return (
    <DefenseDashboard
      data={inline}
      lazySeasons={latest ? seasons.slice(0, -1) : []}
      teamStats={getTeamStats(club)}
    />
  );
}

export const dynamicParams = false;
