import { ManagersClient } from '@/components/ManagersClient';

export default async function ManagersPage({ params }: { params: Promise<{ club: string }> }) {
  await params;
  return <ManagersClient />;
}

export const dynamicParams = false;
