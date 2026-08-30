import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function serviceKey() {
  const rawKeys = Deno.env.get("SUPABASE_SECRET_KEYS") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  try { return Object.values(JSON.parse(rawKeys))[0] as string; } catch { return rawKeys; }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ error: "Authentication required" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!url || !publishableKey || !serviceKey()) return json({ error: "Supabase secrets are not configured" }, 500);

  const authClient = createClient(url, publishableKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: userError } = await authClient.auth.getUser();
  if (userError || !user) return json({ error: "Invalid session" }, 401);

  const admin = createClient(url, serviceKey());
  // Arquivos antigos de perfil ficam na pasta do próprio usuário. Remova-os
  // antes do Auth para que objetos do Storage não impeçam a exclusão.
  for (const bucket of ["avatars", "blog-images", "publisher-covers"]) {
    const listed = await admin.storage.from(bucket).list(user.id, { limit: 1000 });
    if (listed.error || !listed.data?.length) continue;
    const removed = await admin.storage.from(bucket).remove(listed.data.map(file => `${user.id}/${file.name}`));
    if (removed.error) return json({ error: `Não foi possível remover os arquivos da conta: ${removed.error.message}` }, 500);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return json({ error: deleteError.message }, 500);
  return json({ deleted: true });
});
