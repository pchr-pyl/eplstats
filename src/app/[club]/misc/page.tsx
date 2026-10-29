import type { Metadata } from 'next';
import { tabMeta } from '@/lib/seo';
import { MatchlogBrowser } from '@/components/MatchlogBrowser';

export async function generateMetadata({ params }: { params: Promise<{ club: string }> }): Promise<Metadata> {
  const { club } = await params;
  return tabMeta(club, 'Misc Stats', 'misc', 'fouls, cards, offsides and discipline stats per match');
}

export default async function MiscPage({ params }: { params: Promise<{ club: string }> }) {
  await params;
  return <MatchlogBrowser type="misc" titleKey="matchLog.tabs.misc" />;
}

export const dynamicParams = false;
