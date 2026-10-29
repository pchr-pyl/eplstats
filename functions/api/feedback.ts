import { Env, json, str } from './_shared';

const TYPES = new Set(['bug', 'idea', 'other']);
const IMG_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const IMG_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const MAX_IMG_BYTES = 5 * 1024 * 1024;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'multipart form required' }, 400);
  }

  const message = str(form.get('message'));
  if (!message) return json({ error: 'message required' }, 400);

  const type = TYPES.has(String(form.get('type'))) ? String(form.get('type')) : 'other';
  const contact = str(form.get('contact'), 200);
  const page = str(form.get('page'), 300);
  const ua = str(request.headers.get('user-agent'), 300);

  let imageKey: string | null = null;
  const image = form.get('image');
  if (image && typeof image === 'object' && 'arrayBuffer' in image) {
    const file = image as File;
    if (!IMG_MIME.has(file.type)) return json({ error: 'image type' }, 400);
    if (file.size > MAX_IMG_BYTES) return json({ error: 'image too large' }, 400);
    imageKey = `fb-${crypto.randomUUID()}.${IMG_EXT[file.type]}`;
    await env.IMG.put(imageKey, await file.arrayBuffer(), {
      metadata: { contentType: file.type },
    });
  }

  await env.DB.prepare(
    'INSERT INTO feedback (type, message, contact, page, ua, image) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(type, message, contact, page, ua, imageKey)
    .run();

  return json({ ok: true }, 201);
};
