import type { Metadata } from 'next';
import { getTeamStats } from '@/lib/data';
import { tabMeta } from '@/lib/seo';
import { AttackDashboard } from '@/components/AttackDashboard';

export async function generateMetadata({ params }: { params: Promise<{ club: string }> }): Promise<Metadata> {
  const { club } = await params;
  return tabMeta(club, 'Attack', 'attack', 'goals, xG, shots and finishing stats by season');
}

export default async function AttackPage({ params }: { params: Promise<{ club: string }> }) {
  const { club } = await params;
  return <AttackDashboard teamStats={getTeamStats(club)} />;
}

export const dynamicParams = false;
