import type { Metadata } from 'next';
import { tabMeta } from '@/lib/seo';
import { SeasonDetail } from '@/components/SeasonDetail';

export async function generateMetadata({ params }: { params: Promise<{ club: string }> }): Promise<Metadata> {
  const { club } = await params;
  return tabMeta(club, 'Season Detail', 'season', 'per-match shots, shots conceded, goals, xG and possession for any season');
}

export default async function SeasonPage({ params }: { params: Promise<{ club: string }> }) {
  const { club } = await params;
  return <SeasonDetail key={club} />;
}

export const dynamicParams = false;
