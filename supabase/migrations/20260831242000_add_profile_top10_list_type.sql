alter table public.profile_top10_lists
  add column if not exists list_type text not null default 'character';

alter table public.profile_top10_lists
  drop constraint if exists profile_top10_lists_list_type_check;

alter table public.profile_top10_lists
  add constraint profile_top10_lists_list_type_check
  check (list_type in ('character', 'story'));
