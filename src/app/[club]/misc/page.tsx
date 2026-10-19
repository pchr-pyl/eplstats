import { MatchlogBrowser } from '@/components/MatchlogBrowser';

export default async function MiscPage({ params }: { params: Promise<{ club: string }> }) {
  await params;
  return <MatchlogBrowser type="misc" titleKey="matchLog.tabs.misc" />;
}

export const dynamicParams = false;
