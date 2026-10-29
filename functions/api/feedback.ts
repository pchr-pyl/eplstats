import { Env, json, readJson, str } from './_shared';

const TYPES = new Set(['bug', 'idea', 'other']);

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJson(request);
  const message = str(body?.message);
  if (!message) return json({ error: 'message required' }, 400);

  const type = TYPES.has(String(body?.type)) ? String(body?.type) : 'other';
  const contact = str(body?.contact, 200);
  const page = str(body?.page, 300);
  const ua = str(request.headers.get('user-agent'), 300);

  await env.DB.prepare(
    'INSERT INTO feedback (type, message, contact, page, ua) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(type, message, contact, page, ua)
    .run();

  return json({ ok: true }, 201);
};
