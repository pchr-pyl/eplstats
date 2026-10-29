import type { Metadata } from 'next';
import { InsightsClient } from '@/components/InsightsClient';
import { getInsights } from '@/lib/insights';
import { getClubIndex } from '@/lib/data';

export const metadata: Metadata = {
  title: 'Premier League Insights',
  description:
    'Weekly EPL insights: latest matchweek roundup, form table, xG overperformers, defensive standouts, streaks and the next big fixture.',
  alternates: { canonical: '/insights/' },
};

export default function InsightsPage() {
  return <InsightsClient data={getInsights()} clubs={getClubIndex()} />;
}
