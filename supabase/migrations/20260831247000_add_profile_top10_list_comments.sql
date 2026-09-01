create table if not exists public.profile_top10_list_comments (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.profile_top10_lists(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

alter table public.profile_top10_list_comments enable row level security;

drop policy if exists "top10 list comments readable" on public.profile_top10_list_comments;
create policy "top10 list comments readable" on public.profile_top10_list_comments for select using (exists (
  select 1 from public.profile_top10_lists l where l.id = list_id and (l.is_public or l.owner_id = auth.uid())
));

drop policy if exists "top10 users manage list comments" on public.profile_top10_list_comments;
create policy "top10 users manage list comments" on public.profile_top10_list_comments for all using (
  auth.uid() = user_id and exists (
    select 1 from public.profile_top10_lists l where l.id = list_id and l.is_public
  )
) with check (
  auth.uid() = user_id and exists (
    select 1 from public.profile_top10_lists l where l.id = list_id and l.is_public
  )
);

create index if not exists profile_top10_list_comments_list_idx on public.profile_top10_list_comments(list_id, created_at);
