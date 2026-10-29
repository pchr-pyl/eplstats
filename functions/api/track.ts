import { Env, readJson, sha256Hex, str, thaiDate, visitorSalt } from './_shared';

const BOT_RE = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit/i;

function deviceOf(ua: string): string {
  if (BOT_RE.test(ua)) return 'bot';
  if (/ipad|tablet/i.test(ua) || (/android/i.test(ua) && !/mobi/i.test(ua))) return 'tablet';
  if (/mobi|iphone|android/i.test(ua)) return 'mobile';
  return 'desktop';
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const body = await readJson(request);
  const path = str(body?.path, 300);
  if (!path || path.startsWith('/api') || path.startsWith('/admin'))
    return new Response(null, { status: 204 });

  const club = str(body?.club, 60);
  const referrer = str(body?.referrer, 500);
  const ua = request.headers.get('user-agent') ?? '';
  const device = deviceOf(ua);
  const country = str(
    (request as unknown as { cf?: { country?: string } }).cf?.country,
    2,
  );
  const lang = body?.lang === 'th' || body?.lang === 'en' ? (body.lang as string) : null;
  const theme = body?.theme === 'light' || body?.theme === 'dark' ? (body.theme as string) : null;

  const ip = request.headers.get('cf-connecting-ip') ?? '';
  const hash = await sha256Hex(`${thaiDate()}|${ip}|${ua}|${visitorSalt(env)}`);
  const visitor = hash.slice(0, 16);

  waitUntil(
    env.DB.prepare(
      'INSERT INTO pageviews (path, club, referrer, visitor, device, country, lang, theme) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
      .bind(path, club, referrer, visitor, device, country, lang, theme)
      .run(),
  );
  return new Response(null, { status: 204 });
};
