create table if not exists public.profile_top10_item_votes (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.profile_top10_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id, user_id)
);

alter table public.profile_top10_item_votes enable row level security;

drop policy if exists "top10 votes readable" on public.profile_top10_item_votes;
create policy "top10 votes readable" on public.profile_top10_item_votes for select
using (exists (
  select 1 from public.profile_top10_items i
  join public.profile_top10_lists l on l.id = i.list_id
  where i.id = item_id and (l.is_public or l.owner_id = auth.uid())
));

drop policy if exists "top10 users manage votes" on public.profile_top10_item_votes;
create policy "top10 users manage votes" on public.profile_top10_item_votes for all
using (auth.uid() = user_id and exists (
  select 1 from public.profile_top10_items i
  join public.profile_top10_lists l on l.id = i.list_id
  where i.id = item_id and l.is_public
))
with check (auth.uid() = user_id and exists (
  select 1 from public.profile_top10_items i
  join public.profile_top10_lists l on l.id = i.list_id
  where i.id = item_id and l.is_public
));

create index if not exists profile_top10_item_votes_item_idx on public.profile_top10_item_votes(item_id);
