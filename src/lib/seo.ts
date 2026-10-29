import type { Metadata } from 'next';
import { getClubIndex } from './data';

export function tabMeta(
  clubSlug: string,
  tab: string,
  path: string,
  what: string,
): Metadata {
  const entry = getClubIndex().find((c) => c.slug === clubSlug);
  if (!entry) return {};
  const title = `${entry.name} ${tab} — EPL Stats`;
  const description = `${entry.name} ${what} — season-by-season Premier League data since 2014.`;
  return {
    title,
    description,
    alternates: { canonical: `/${clubSlug}/${path}/` },
    openGraph: { title, description },
  };
}
