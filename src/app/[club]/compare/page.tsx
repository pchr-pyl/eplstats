import { CompareDashboard } from '@/components/CompareDashboard';

export default async function ComparePage({ params }: { params: Promise<{ club: string }> }) {
  await params;
  return <CompareDashboard />;
}

export const dynamicParams = false;
