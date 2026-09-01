import { createClient } from 'npm:@supabase/supabase-js@2';
const env = (n: string) => Deno.env.get(n) || '';
const supabaseAdminKey = () => { if (env('SUPABASE_SERVICE_ROLE_KEY')) return env('SUPABASE_SERVICE_ROLE_KEY'); try { return JSON.parse(env('SUPABASE_SECRET_KEYS')).default || ''; } catch { return ''; } };
Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  const provisionSecret = env('GURIA_PROVISION_SECRET');
  if (!provisionSecret || request.headers.get('X-Guria-Provision-Secret') !== provisionSecret) return Response.json({ error: 'forbidden' }, { status: 403 });
  const admin = createClient(env('SUPABASE_URL'), supabaseAdminKey());
  const email = env('GURIA_AUTH_EMAIL', 'guria-bot@invalid.local');
  const { data: existing } = await admin.from('profiles').select('id').eq('username', 'guria').maybeSingle();
  let id = existing?.id;
  if (!id) {
    const created = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { username: 'guria' }, app_metadata: { bot: true } });
    if (created.error && !/already registered|already exists/i.test(created.error.message)) return Response.json({ error: 'create_failed' }, { status: 500 });
    id = created.data.user?.id;
    if (!id) { const users = await admin.auth.admin.listUsers({ perPage: 1000 }); id = users.data.users.find((user) => user.email === email)?.id; }
  }
  if (!id) return Response.json({ error: 'user_not_found' }, { status: 500 });
  const { error } = await admin.from('profiles').upsert({ id, username: 'guria', account_email: email, title: 'Guia da Banca', avatar_url: null, is_bot: true, is_official: true, bot_type: 'assistant', allow_messages: true, profile_hidden: false, is_banned: false }, { onConflict: 'id' });
  return error ? Response.json({ error: 'profile_failed' }, { status: 500 }) : Response.json({ ok: true, id });
});
