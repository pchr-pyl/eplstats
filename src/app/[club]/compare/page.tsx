import { getMatches, getSeasonRows } from '@/lib/data';
import { seasonShort } from '@/lib/stats';
import { AppHeader } from '@/components/AppHeader';
import { CompareDashboard } from '@/components/CompareDashboard';

export default async function ComparePage({ params }: { params: Promise<{ club: string }> }) {
  const { club } = await params;
  const matches = getMatches(club);
  const rows = getSeasonRows(club);
  const allRows = rows.filter((r) => r.competition === 'All Competitions');
  const sorted = [...allRows].sort((a, b) => a.season.localeCompare(b.season));
  const first = sorted[0]?.season ?? '';
  const last = sorted[sorted.length - 1]?.season ?? '';
  const seasonRange = first && last ? `${seasonShort(first)} – ${seasonShort(last)}` : '';

  return (
    <div className="hero-glow relative flex min-h-screen flex-col bg-bg">
      <AppHeader seasonRange={seasonRange} />
      <CompareDashboard matches={matches} />
    </div>
  );
}

export const dynamicParams = false;
