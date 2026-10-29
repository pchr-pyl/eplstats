import { getTeamStats } from '@/lib/data';
import { AttackDashboard } from '@/components/AttackDashboard';

export default async function AttackPage({ params }: { params: Promise<{ club: string }> }) {
  const { club } = await params;
  return <AttackDashboard teamStats={getTeamStats(club)} />;
}

export const dynamicParams = false;
