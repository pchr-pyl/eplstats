import type { Metadata } from 'next';
import { tabMeta } from '@/lib/seo';
import { CompareDashboard } from '@/components/CompareDashboard';

export async function generateMetadata({ params }: { params: Promise<{ club: string }> }): Promise<Metadata> {
  const { club } = await params;
  return tabMeta(club, 'Season Pace', 'compare', 'match-by-match points pace compared across seasons');
}

export default async function ComparePage({ params }: { params: Promise<{ club: string }> }) {
  await params;
  return <CompareDashboard />;
}

export const dynamicParams = false;
