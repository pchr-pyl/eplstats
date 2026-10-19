import { MatchlogBrowser } from '@/components/MatchlogBrowser';

export default async function MatchesPage({ params }: { params: Promise<{ club: string }> }) {
  await params;
  return <MatchlogBrowser type="scores" titleKey="matchLog.tabs.scores" />;
}

export const dynamicParams = false;
