import { Env, checkAuth, json } from '../_shared';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!(await checkAuth(request, env))) return json({ error: 'unauthorized' }, 401);
  const { results } = await env.DB.prepare(
    'SELECT id, created_at, type, message, contact, page, ua, image FROM feedback ORDER BY id DESC LIMIT 1000',
  ).all();
  return json({ feedback: results });
};
