import type { MetadataRoute } from 'next';
import { getClubIndex } from '@/lib/data';

export const dynamic = 'force-static';

const BASE = 'https://eplstats.pages.dev';
const TABS = ['', '/attack', '/defense', '/squad', '/managers', '/matches', '/misc', '/compare'];

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/clubs-compare/`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/insights/`, changeFrequency: 'weekly', priority: 0.8 },
    ...getClubIndex().flatMap((c) =>
      TABS.map((t) => ({
        url: `${BASE}/${c.slug}${t}/`,
        changeFrequency: 'weekly' as const,
        priority: t === '' ? 0.9 : 0.7,
      })),
    ),
  ];
}
