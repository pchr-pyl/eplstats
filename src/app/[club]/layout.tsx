import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getClubIndex, getManagers, getMatches, getSeasonRows } from '@/lib/data';
import { seasonShort } from '@/lib/stats';
import { ClubProvider } from '@/components/ClubProvider';
import { AppHeader } from '@/components/AppHeader';

export const dynamicParams = false;

export function generateStaticParams() {
  return getClubIndex().map((c) => ({ club: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ club: string }>;
}): Promise<Metadata> {
  const { club } = await params;
  const entry = getClubIndex().find((c) => c.slug === club);
  if (!entry) return {};
  return { title: `${entry.name} — Premier League — Club Analytics` };
}

export default async function ClubLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ club: string }>;
}) {
  const { club } = await params;
  const entry = getClubIndex().find((c) => c.slug === club);
  if (!entry) notFound();
  const stints = getManagers(club);
  const rows = getSeasonRows(club);
  const matches = getMatches(club);
  const hasManagers = stints.length > 0;

  const allRows = rows.filter((r) => r.competition === 'All Competitions');
  const sorted = [...allRows].sort((a, b) => a.season.localeCompare(b.season));
  const first = sorted[0]?.season ?? '';
  const last = sorted[sorted.length - 1]?.season ?? '';
  const seasonRange = first && last ? `${seasonShort(first)} – ${seasonShort(last)}` : '';

  return (
    <ClubProvider
      club={entry}
      clubs={getClubIndex()}
      hasManagers={hasManagers}
      rows={rows}
      matches={matches}
      stints={stints}
    >
      <div
        className="club-theme"
        style={
          {
            '--club-brand-light': entry.brandLight ?? entry.color,
            '--club-brand-dark': entry.brandDark ?? entry.color,
          } as React.CSSProperties
        }
        data-has-managers={hasManagers}
      >
        <div className="hero-glow relative flex min-h-screen flex-col bg-bg">
          <AppHeader seasonRange={seasonRange} />
          {children}
        </div>
      </div>
    </ClubProvider>
  );
}
