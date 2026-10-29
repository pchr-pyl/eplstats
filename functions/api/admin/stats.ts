import { Env, checkAuth, json } from '../_shared';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!(await checkAuth(request, env))) return json({ error: 'unauthorized' }, 401);

  const [totals, byDay, topPaths, topClubs, feedbackByType] = await Promise.all([
    env.DB.prepare(
      `SELECT
        (SELECT COUNT(*) FROM pageviews) AS views,
        (SELECT COUNT(*) FROM pageviews WHERE created_at > datetime('now','-30 days')) AS views30d,
        (SELECT COUNT(*) FROM pageviews WHERE created_at > datetime('now','-7 days')) AS views7d,
        (SELECT COUNT(*) FROM pageviews WHERE date(created_at) = date('now')) AS viewsToday,
        (SELECT COUNT(*) FROM feedback) AS feedback`,
    ).first(),
    env.DB.prepare(
      `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS n
       FROM pageviews WHERE created_at > datetime('now','-30 days')
       GROUP BY day ORDER BY day`,
    ).all(),
    env.DB.prepare(
      `SELECT path, COUNT(*) AS n FROM pageviews GROUP BY path ORDER BY n DESC LIMIT 20`,
    ).all(),
    env.DB.prepare(
      `SELECT club, COUNT(*) AS n FROM pageviews
       WHERE club IS NOT NULL AND club != ''
       GROUP BY club ORDER BY n DESC LIMIT 15`,
    ).all(),
    env.DB.prepare(`SELECT type, COUNT(*) AS n FROM feedback GROUP BY type`).all(),
  ]);

  return json({
    totals,
    byDay: byDay.results,
    topPaths: topPaths.results,
    topClubs: topClubs.results,
    feedbackByType: feedbackByType.results,
  });
};
