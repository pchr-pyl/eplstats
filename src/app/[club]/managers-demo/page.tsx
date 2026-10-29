import { ManagersDemo } from '@/components/managers-demo/ManagersDemo';

export default async function ManagersDemoPage({ params }: { params: Promise<{ club: string }> }) {
  await params;
  return <ManagersDemo />;
}

export const dynamicParams = false;
