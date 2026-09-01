alter table public.profile_top10_lists
  add column if not exists character_categories text[] not null default array['team', 'villain', 'support', 'hero', 'antihero'];

alter table public.profile_top10_lists
  drop constraint if exists profile_top10_lists_character_categories_check;

alter table public.profile_top10_lists
  add constraint profile_top10_lists_character_categories_check
  check (character_categories <@ array['team', 'villain', 'support', 'hero', 'antihero']::text[]);
