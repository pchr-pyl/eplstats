import { Env, checkCredentials, json, makeToken, readJson, str } from '../_shared';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJson(request);
  const email = str(body?.email, 200) ?? '';
  const password = str(body?.password, 200) ?? '';
  if (!checkCredentials(env, email, password)) return json({ error: 'invalid' }, 401);
  return json({ token: await makeToken(env) });
};
