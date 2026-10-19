import { getAttack } from '@/lib/data';
import { AttackDashboard } from '@/components/AttackDashboard';

export default async function AttackPage({ params }: { params: Promise<{ club: string }> }) {
  const { club } = await params;
  return <AttackDashboard attack={getAttack(club)} />;
}

export const dynamicParams = false;
