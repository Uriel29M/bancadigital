import { createHandler } from './handler.mjs';
const env = (name: string) => Deno.env.get(name) || '';
function key(primary: string, bundled: string) {
  if (env(primary)) return env(primary);
  try { return Object.values(JSON.parse(env(bundled)))[0] as string || ''; } catch { return ''; }
}
Deno.serve(createHandler({
  url: env('SUPABASE_URL'),
  publicKey: key('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEYS'),
  serviceKey: key('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEYS'),
}));
