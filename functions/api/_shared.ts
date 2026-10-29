// Shared helpers for Pages Functions. Files prefixed with _ are not routed.

export interface Env {
  DB: D1Database;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_SECRET?: string;
}

export const adminEmail = (env: Env) => env.ADMIN_EMAIL ?? 'admin@gmail.com';
const adminPassword = (env: Env) => env.ADMIN_PASSWORD ?? 'admin123';
const signingSecret = (env: Env) => env.ADMIN_SECRET ?? adminPassword(env);

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export function checkCredentials(env: Env, email: string, password: string): boolean {
  return email === adminEmail(env) && password === adminPassword(env);
}

async function hmacHex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function makeToken(env: Env): Promise<string> {
  const exp = String(Date.now() + TOKEN_TTL_MS);
  return `${exp}.${await hmacHex(signingSecret(env), exp)}`;
}

export async function checkAuth(request: Request, env: Env): Promise<boolean> {
  const header = request.headers.get('authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '');
  const [exp, sig] = token.split('.');
  if (!exp || !sig || !/^\d+$/.test(exp)) return false;
  if (Number(exp) < Date.now()) return false;
  const expected = await hmacHex(signingSecret(env), exp);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1)
    diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const text = await request.text();
    if (!text) return null;
    const data = JSON.parse(text);
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function str(v: unknown, max = 4000): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
}
