create table if not exists public.profile_top10_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_top10_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.profile_top10_lists(id) on delete cascade,
  character_key text not null,
  character_name text not null,
  rank smallint not null check (rank between 1 and 10),
  unique (list_id, character_key),
  unique (list_id, rank)
);

alter table public.profile_top10_lists enable row level security;
alter table public.profile_top10_items enable row level security;

drop policy if exists "top10 owner manages lists" on public.profile_top10_lists;
create policy "top10 owner manages lists" on public.profile_top10_lists for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "top10 public lists readable" on public.profile_top10_lists;
create policy "top10 public lists readable" on public.profile_top10_lists for select using (is_public or auth.uid() = owner_id);

drop policy if exists "top10 owner manages items" on public.profile_top10_items;
create policy "top10 owner manages items" on public.profile_top10_items for all using (exists (select 1 from public.profile_top10_lists l where l.id = list_id and l.owner_id = auth.uid())) with check (exists (select 1 from public.profile_top10_lists l where l.id = list_id and l.owner_id = auth.uid()));
drop policy if exists "top10 public items readable" on public.profile_top10_items;
create policy "top10 public items readable" on public.profile_top10_items for select using (exists (select 1 from public.profile_top10_lists l where l.id = list_id and (l.is_public or l.owner_id = auth.uid())));

create index if not exists profile_top10_lists_owner_idx on public.profile_top10_lists(owner_id, created_at);
create index if not exists profile_top10_items_list_rank_idx on public.profile_top10_items(list_id, rank);
