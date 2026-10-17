import { getSeasonRows, getMatches } from '@/lib/data';
import { seasonShort } from '@/lib/stats';
import { AppHeader } from '@/components/AppHeader';
import { MatchlogBrowser } from '@/components/MatchlogBrowser';

export default async function ShootingPage() {
  const rows = getSeasonRows();
  const matches = getMatches();
  const allRows = rows.filter((r) => r.competition === 'All Competitions');
  const sorted = [...allRows].sort((a, b) => a.season.localeCompare(b.season));
  const first = sorted[0]?.season ?? '';
  const last = sorted[sorted.length - 1]?.season ?? '';
  const seasonRange = first && last ? `${seasonShort(first)} – ${seasonShort(last)}` : '';
  const seasons = [...new Set(matches.map((m) => m.season))].sort();

  return (
    <div className="hero-glow relative flex min-h-screen flex-col bg-bg">
      <AppHeader seasonRange={seasonRange} />
      <MatchlogBrowser
        type="shooting"
        matches={matches}
        seasons={seasons}
        titleKey="matchLog.tabs.shooting"
      />
    </div>
  );
}
