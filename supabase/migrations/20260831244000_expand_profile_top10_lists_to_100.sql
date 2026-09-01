alter table public.profile_top10_items
  drop constraint if exists profile_top10_items_rank_check;

alter table public.profile_top10_items
  add constraint profile_top10_items_rank_check
  check (rank between 1 and 100);
