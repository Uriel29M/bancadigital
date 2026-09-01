import { createClient } from 'npm:@supabase/supabase-js@2';
const env = (n: string) => Deno.env.get(n) || '';
const supabaseAdminKey = () => { if (env('SUPABASE_SERVICE_ROLE_KEY')) return env('SUPABASE_SERVICE_ROLE_KEY'); try { return JSON.parse(env('SUPABASE_SECRET_KEYS')).default || ''; } catch { return ''; } };
const messages = [
  'Se você quiser, posso mostrar onde ficam sua estante, os perfis e as conversas da Banca.',
  'Passando para lembrar que posso indicar uma leitura por personagem, editora, saga ou estilo. Sem pressa — é só chamar.'
];
Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  const admin = createClient(env('SUPABASE_URL'), supabaseAdminKey());
  const { data: guria } = await admin.from('profiles').select('id').eq('username', 'guria').eq('is_bot', true).eq('is_official', true).maybeSingle();
  if (!guria) return Response.json({ ok: false, reason: 'guria_not_provisioned' });
  const { data: users } = await admin.from('profiles').select('id,username,created_at,guria_proactive_enabled,is_banned,allow_messages').eq('is_bot', false).eq('is_banned', false).eq('guria_proactive_enabled', true).eq('allow_messages', true).gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()).limit(500);
  let sent = 0;
  for (const user of users || []) {
    const age = Date.now() - Date.parse(user.created_at);
    const slot = age >= 72 * 3600000 ? 1 : age >= 24 * 3600000 ? 0 : -1;
    if (slot < 0) continue;
    const { data: rows } = await admin.from('chat_messages').select('sender_id,created_at,guria_event_key').or(`and(sender_id.eq.${guria.id},recipient_id.eq.${user.id}),and(sender_id.eq.${user.id},recipient_id.eq.${guria.id})`).order('created_at', { ascending: false }).limit(6);
    if ((rows || []).some((row) => row.sender_id === user.id)) continue;
    if ((rows || []).some((row) => row.guria_event_key === `proactive:${slot}:${user.id}`)) continue;
    const blocked = await admin.from('profile_blocks').select('blocker_id').or(`and(blocker_id.eq.${user.id},blocked_id.eq.${guria.id}),and(blocker_id.eq.${guria.id},blocked_id.eq.${user.id})`).maybeSingle();
    if (blocked.data) continue;
    const result = await admin.from('chat_messages').insert({ sender_id: guria.id, recipient_id: user.id, body: messages[slot], metadata: { guria_type: 'proactive', official_ai: true }, guria_event_key: `proactive:${slot}:${user.id}` });
    if (!result.error) sent++;
  }
  return Response.json({ ok: true, sent });
});
