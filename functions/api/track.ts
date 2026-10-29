import { Env, readJson, str } from './_shared';

export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const body = await readJson(request);
  const path = str(body?.path, 300);
  if (!path || path.startsWith('/api') || path.startsWith('/admin'))
    return new Response(null, { status: 204 });

  const club = str(body?.club, 60);
  const referrer = str(body?.referrer, 500);

  waitUntil(
    env.DB.prepare('INSERT INTO pageviews (path, club, referrer) VALUES (?, ?, ?)')
      .bind(path, club, referrer)
      .run(),
  );
  return new Response(null, { status: 204 });
};
