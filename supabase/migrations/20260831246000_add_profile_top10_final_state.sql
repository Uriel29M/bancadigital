alter table public.profile_top10_lists
  add column if not exists is_final boolean not null default false;
