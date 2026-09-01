-- Requer supabase start e a migration aplicada. Não usa contas reais.
begin;
select plan(5);
select ok(to_regclass('public.guria_knowledge') is not null, 'base de conhecimento existe');
select ok(to_regclass('public.guria_ai_jobs') is not null, 'fila idempotente existe');
select ok(to_regclass('public.guria_moderation_events') is not null, 'eventos de moderação existem');
select ok((select relrowsecurity from pg_class where oid = 'public.guria_knowledge'::regclass), 'conhecimento tem RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.guria_moderation_events'::regclass), 'moderação tem RLS');
select * from finish();
rollback;
