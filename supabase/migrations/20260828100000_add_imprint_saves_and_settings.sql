create table if not exists public.imprint_settings (
  imprint_key text primary key,
  imprint_name text not null,
  cover_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.imprint_saves (
  user_id uuid not null references public.profiles(id) on delete cascade,
  imprint_key text not null,
  imprint_name text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, imprint_key)
);

create index if not exists imprint_saves_user_idx on public.imprint_saves(user_id, created_at desc);

alter table public.imprint_settings enable row level security;
alter table public.imprint_saves enable row level security;

drop policy if exists "imprint settings are public" on public.imprint_settings;
drop policy if exists "moderators manage imprint settings" on public.imprint_settings;
drop policy if exists "imprint saves are public" on public.imprint_saves;
drop policy if exists "users manage own imprint saves" on public.imprint_saves;

create policy "imprint settings are public" on public.imprint_settings for select using (true);
create policy "moderators manage imprint settings" on public.imprint_settings for all using (public.is_moderator()) with check (public.is_moderator());
create policy "imprint saves are public" on public.imprint_saves for select using (auth.uid() = user_id or not public.is_blocked_between(user_id));
create policy "users manage own imprint saves" on public.imprint_saves for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select on public.imprint_settings to anon, authenticated;
grant select, insert, update, delete on public.imprint_settings to authenticated;
grant select, insert, update, delete on public.imprint_saves to authenticated;
