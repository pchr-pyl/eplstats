import { Env, checkAuth, json } from '../_shared';

// GET /api/img/<kv-key> — returns a stored feedback image (keys are flat:
// fb-<uuid>.<ext>).
export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  if (!(await checkAuth(request, env))) return json({ error: 'unauthorized' }, 401);
  const key = Array.isArray(params.key) ? params.key.join('/') : params.key;
  if (!/^fb-[a-zA-Z0-9.-]+$/.test(key)) return json({ error: 'bad key' }, 400);

  const { value, metadata } = await env.IMG.getWithMetadata<{ contentType?: string }>(
    key,
    'arrayBuffer',
  );
  if (value == null) return json({ error: 'not found' }, 404);

  return new Response(value as ArrayBuffer, {
    headers: {
      'Content-Type': metadata?.contentType ?? 'application/octet-stream',
      'Cache-Control': 'private, max-age=3600',
    },
  });
};
