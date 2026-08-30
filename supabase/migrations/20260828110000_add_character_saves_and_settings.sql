create table if not exists public.character_settings (
  character_key text primary key,
  character_name text not null,
  cover_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.character_saves (
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_key text not null,
  character_name text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, character_key)
);

create index if not exists character_saves_user_idx on public.character_saves(user_id, created_at desc);

alter table public.character_settings enable row level security;
alter table public.character_saves enable row level security;

drop policy if exists "character settings are public" on public.character_settings;
drop policy if exists "moderators manage character settings" on public.character_settings;
drop policy if exists "character saves are public" on public.character_saves;
drop policy if exists "users manage own character saves" on public.character_saves;

create policy "character settings are public" on public.character_settings for select using (true);
create policy "moderators manage character settings" on public.character_settings for all using (public.is_moderator()) with check (public.is_moderator());
create policy "character saves are public" on public.character_saves for select using (auth.uid() = user_id or not public.is_blocked_between(user_id));
create policy "users manage own character saves" on public.character_saves for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select on public.character_settings to anon, authenticated;
grant select, insert, update, delete on public.character_settings to authenticated;
grant select, insert, update, delete on public.character_saves to authenticated;
