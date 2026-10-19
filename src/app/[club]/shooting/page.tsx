import { MatchlogBrowser } from '@/components/MatchlogBrowser';

export default async function ShootingPage({ params }: { params: Promise<{ club: string }> }) {
  await params;
  return <MatchlogBrowser type="shooting" titleKey="matchLog.tabs.shooting" />;
}

export const dynamicParams = false;
