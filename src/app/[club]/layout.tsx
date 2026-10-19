import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getClubIndex, getManagers } from '@/lib/data';
import { ClubProvider } from '@/components/ClubProvider';

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
  const hasManagers = getManagers(club).length > 0;
  return (
    <ClubProvider club={entry} clubs={getClubIndex()} hasManagers={hasManagers}>
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
        {children}
      </div>
    </ClubProvider>
  );
}
