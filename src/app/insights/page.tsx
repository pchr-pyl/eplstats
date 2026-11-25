import type { Metadata } from 'next';
import { InsightsClient } from '@/components/insights/InsightsClient';
import { getInsightsExtended } from '@/lib/insightsExtended';
import { getClubIndex } from '@/lib/data';

export const metadata: Metadata = {
  title: 'Premier League Insights',
  description:
    'Weekly EPL insights: 20-club attack vs defense power quadrant, points races, xG finishing luck, goal timing distribution, drama index, home/away splits and 38-game projections.',
  alternates: { canonical: '/insights/' },
};

export default function InsightsPage() {
  return <InsightsClient data={getInsightsExtended()} clubs={getClubIndex()} />;
}
