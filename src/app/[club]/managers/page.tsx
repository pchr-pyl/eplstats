import { ManagersPage } from '@/components/managers/ManagersPage';

export default async function ManagersRoutePage({ params }: { params: Promise<{ club: string }> }) {
  await params;
  return <ManagersPage />;
}

export const dynamicParams = false;
