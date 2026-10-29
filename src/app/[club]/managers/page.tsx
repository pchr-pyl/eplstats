import type { Metadata } from 'next';
import { tabMeta } from '@/lib/seo';
import { ManagersPage } from '@/components/managers/ManagersPage';

export async function generateMetadata({ params }: { params: Promise<{ club: string }> }): Promise<Metadata> {
  const { club } = await params;
  return tabMeta(club, 'Managers', 'managers', 'manager eras, records, points per match and match-by-match logs');
}

export default async function ManagersRoutePage({ params }: { params: Promise<{ club: string }> }) {
  await params;
  return <ManagersPage />;
}

export const dynamicParams = false;
