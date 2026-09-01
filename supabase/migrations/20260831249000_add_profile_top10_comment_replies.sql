alter table public.profile_top10_list_comments
  add column if not exists parent_id uuid references public.profile_top10_list_comments(id) on delete cascade;

create index if not exists profile_top10_list_comments_parent_idx on public.profile_top10_list_comments(parent_id);
