import { Dashboard } from '@/components/Dashboard';

export default async function Home({ params }: { params: Promise<{ club: string }> }) {
  await params;
  return <Dashboard />;
}

export const dynamicParams = false;
