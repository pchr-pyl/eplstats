import { buildSiteStats } from '@/lib/siteStats';

export const dynamic = 'force-static';

export function GET() {
  return Response.json(buildSiteStats());
}
