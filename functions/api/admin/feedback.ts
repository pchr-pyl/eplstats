import { Env, checkAuth, json, readJson } from '../_shared';

const STATUSES = new Set(['new', 'in-progress', 'done', 'wontfix']);

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!(await checkAuth(request, env))) return json({ error: 'unauthorized' }, 401);
  const { results } = await env.DB.prepare(
    'SELECT id, created_at, type, message, contact, page, ua, image, status FROM feedback ORDER BY id DESC LIMIT 1000',
  ).all();
  return json({ feedback: results });
};

export const onRequestPatch: PagesFunction<Env> = async ({ request, env }) => {
  if (!(await checkAuth(request, env))) return json({ error: 'unauthorized' }, 401);
  const body = await readJson(request);
  const id = Number(body?.id);
  const status = String(body?.status);
  if (!Number.isInteger(id) || id <= 0 || !STATUSES.has(status))
    return json({ error: 'bad request' }, 400);

  const r = await env.DB.prepare('UPDATE feedback SET status = ? WHERE id = ?')
    .bind(status, id)
    .run<{ meta?: { changes?: number } }>();
  if (!r?.meta?.changes) return json({ error: 'not found' }, 404);
  return json({ ok: true });
};
