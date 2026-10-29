import { Env, checkAuth, json } from '../_shared';

const H = "(device IS NULL OR device <> 'bot')";

interface Row {
  [k: string]: unknown;
}

function sectionOf(path: string): string {
  const segs = path.replace(/\/$/, '').split('/').filter(Boolean);
  if (segs.length === 0) return 'home';
  if (segs[0] === 'clubs-compare') return 'clubs-compare';
  return segs[1] ?? 'overview';
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!(await checkAuth(request, env))) return json({ error: 'unauthorized' }, 401);

  const audienceCol = (c: string) =>
    env.DB.prepare(
      `SELECT ${c} AS k, COUNT(*) AS n, COUNT(DISTINCT date(created_at,'+7 hours') || visitor) AS v
       FROM pageviews WHERE ${H} AND ${c} IS NOT NULL AND created_at > datetime('now','-30 days')
       GROUP BY ${c} ORDER BY n DESC${c === 'country' ? ' LIMIT 15' : ''}`,
    ).all();

  const [
    totals,
    byDay,
    heatmap,
    paths30d,
    refs30d,
    audDevice,
    audCountry,
    audLang,
    audTheme,
    recent,
    topPaths,
    topClubs,
    feedbackByType,
  ] = await Promise.all([
    env.DB.prepare(
      `SELECT
        (SELECT COUNT(*) FROM pageviews WHERE ${H}) AS views,
        (SELECT COUNT(*) FROM pageviews WHERE ${H} AND created_at > datetime('now','-30 days')) AS views30d,
        (SELECT COUNT(*) FROM pageviews WHERE ${H} AND created_at > datetime('now','-7 days')) AS views7d,
        (SELECT COUNT(*) FROM pageviews WHERE ${H} AND created_at <= datetime('now','-7 days') AND created_at > datetime('now','-14 days')) AS viewsPrev7d,
        (SELECT COUNT(*) FROM pageviews WHERE ${H} AND date(created_at,'+7 hours') = date('now','+7 hours')) AS viewsToday,
        (SELECT COUNT(DISTINCT visitor) FROM pageviews WHERE ${H} AND visitor IS NOT NULL AND date(created_at,'+7 hours') = date('now','+7 hours')) AS visitorsToday,
        (SELECT COUNT(DISTINCT date(created_at,'+7 hours') || visitor) FROM pageviews WHERE ${H} AND visitor IS NOT NULL AND created_at > datetime('now','-7 days')) AS visitorDays7d,
        (SELECT COUNT(*) FROM pageviews WHERE device = 'bot' AND created_at > datetime('now','-30 days')) AS bots30d,
        (SELECT MIN(created_at) FROM pageviews WHERE visitor IS NOT NULL) AS trackedSince,
        (SELECT COUNT(*) FROM feedback) AS feedback`,
    ).first(),
    env.DB.prepare(
      `SELECT date(created_at,'+7 hours') AS day, COUNT(*) AS n, COUNT(DISTINCT visitor) AS visitors
       FROM pageviews WHERE ${H} AND created_at > datetime('now','-30 days') GROUP BY day ORDER BY day`,
    ).all(),
    env.DB.prepare(
      `SELECT CAST(strftime('%w', created_at, '+7 hours') AS INTEGER) AS dow,
              CAST(strftime('%H', created_at, '+7 hours') AS INTEGER) AS hour, COUNT(*) AS n
       FROM pageviews WHERE ${H} AND created_at > datetime('now','-30 days') GROUP BY dow, hour`,
    ).all(),
    env.DB.prepare(
      `SELECT path, COUNT(*) AS n FROM pageviews WHERE ${H} AND created_at > datetime('now','-30 days') GROUP BY path`,
    ).all(),
    env.DB.prepare(
      `SELECT referrer, COUNT(*) AS n FROM pageviews WHERE ${H} AND created_at > datetime('now','-30 days')
       GROUP BY referrer ORDER BY n DESC LIMIT 1000`,
    ).all(),
    audienceCol('device'),
    audienceCol('country'),
    audienceCol('lang'),
    audienceCol('theme'),
    env.DB.prepare(
      `SELECT created_at, path, club, device, country, lang FROM pageviews WHERE ${H} ORDER BY id DESC LIMIT 25`,
    ).all(),
    env.DB.prepare(
      `SELECT path, COUNT(*) AS n FROM pageviews WHERE ${H} GROUP BY path ORDER BY n DESC LIMIT 20`,
    ).all(),
    env.DB.prepare(
      `SELECT club, COUNT(*) AS n FROM pageviews
       WHERE ${H} AND club IS NOT NULL AND club != ''
       GROUP BY club ORDER BY n DESC LIMIT 15`,
    ).all(),
    env.DB.prepare(`SELECT type, COUNT(*) AS n FROM feedback GROUP BY type`).all(),
  ]);

  // sections: aggregate paths into site sections
  const sectionMap = new Map<string, number>();
  for (const r of paths30d.results as Row[]) {
    const s = sectionOf(String(r.path ?? ''));
    sectionMap.set(s, (sectionMap.get(s) ?? 0) + (r.n as number));
  }
  const sections = [...sectionMap.entries()]
    .map(([section, n]) => ({ section, n }))
    .sort((a, b) => b.n - a.n);

  // referrers: direct / internal / external hosts
  const selfHost = new URL(request.url).hostname;
  const isInternal = (host: string) =>
    host === selfHost ||
    host === 'eplstats.pages.dev' ||
    host.endsWith('.eplstats.pages.dev') ||
    host === 'localhost' ||
    host === '127.0.0.1';
  let direct = 0;
  let internal = 0;
  const extMap = new Map<string, number>();
  for (const r of refs30d.results as Row[]) {
    const ref = r.referrer as string | null;
    const n = r.n as number;
    if (ref == null) {
      direct += n;
      continue;
    }
    let host: string;
    try {
      host = new URL(ref).hostname.replace(/^www\./, '');
    } catch {
      host = 'other';
    }
    if (isInternal(host)) internal += n;
    else extMap.set(host, (extMap.get(host) ?? 0) + n);
  }
  const external = [...extMap.entries()]
    .map(([host, n]) => ({ host, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 15);

  return json({
    totals,
    byDay: byDay.results,
    heatmap: heatmap.results,
    sections,
    referrers: { direct, internal, external },
    audience: {
      device: audDevice.results,
      country: audCountry.results,
      lang: audLang.results,
      theme: audTheme.results,
    },
    recent: recent.results,
    topPaths: topPaths.results,
    topClubs: topClubs.results,
    feedbackByType: feedbackByType.results,
  });
};
