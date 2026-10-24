-- Persist the MTProto bot authorization between Edge Function cold starts.
-- The table is server-only; session strings are credentials and must never be
-- exposed through the public Data API.
create table if not exists public.telegram_mtproto_session (
  id text primary key check (id in ('primary', 'cooldown')),
  session_string text not null,
  updated_at timestamptz not null default now()
);

alter table public.telegram_mtproto_session enable row level security;
revoke all on table public.telegram_mtproto_session from public, anon, authenticated;
grant all on table public.telegram_mtproto_session to service_role;
