import type { Metadata } from 'next';
import { tabMeta } from '@/lib/seo';
import { MatchlogBrowser } from '@/components/MatchlogBrowser';

export async function generateMetadata({ params }: { params: Promise<{ club: string }> }): Promise<Metadata> {
  const { club } = await params;
  return tabMeta(club, 'Matches', 'matches', 'every match result, fixture and xG since 2014');
}

export default async function MatchesPage({ params }: { params: Promise<{ club: string }> }) {
  await params;
  return <MatchlogBrowser type="scores" titleKey="matchLog.tabs.scores" />;
}

export const dynamicParams = false;
