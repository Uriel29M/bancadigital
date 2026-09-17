const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};
const reply = (body, status) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json' },
});
const denied = () => reply({ error: 'Usuário ou senha inválidos.' }, 401);

// The password grant authenticates this public endpoint; no existing JWT is needed.
export function createHandler({ url, publicKey, serviceKey, fetcher = fetch }) {
  return async request => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
    if (!url || !publicKey || !serviceKey) return reply({ error: 'Login indisponível.' }, 503);
    try {
      const raw = await request.text();
      if (raw.length > 8192) return denied();
      const { username, password, captchaToken } = JSON.parse(raw);
      if (typeof username !== 'string' || !/^[a-z0-9_]{3,24}$/i.test(username)
        || typeof password !== 'string' || !password || password.length > 4096) return denied();
      const lookup = await fetcher(`${url}/rest/v1/rpc/resolve_username_login`, {
        method: 'POST',
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_username: username.toLowerCase() }),
      });
      if (!lookup.ok) return reply({ error: 'Login indisponível.' }, 503);
      const email = await lookup.json();
      // Always attempt the password grant, including nonexistent/limited accounts.
      const auth = await fetcher(`${url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: publicKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: typeof email === 'string' && email ? email : `${crypto.randomUUID()}@invalid.local`,
          password,
          gotrue_meta_security: { captcha_token: typeof captchaToken === 'string' ? captchaToken : undefined },
        }),
      });
      if (!auth.ok || !email) return denied();
      const session = await auth.json();
      if (!session.access_token || !session.refresh_token) return denied();
      // No lookup result or Auth error payload is returned. Tokens require the correct password.
      return reply({ access_token: session.access_token, refresh_token: session.refresh_token }, 200);
    } catch {
      return denied();
    }
  };
}
