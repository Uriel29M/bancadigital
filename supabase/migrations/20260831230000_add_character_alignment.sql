alter table public.character_settings
  add column if not exists character_alignment text;

alter table public.character_settings
  drop constraint if exists character_settings_character_alignment_check;

alter table public.character_settings
  add constraint character_settings_character_alignment_check
  check (character_alignment in ('hero', 'villain', 'antihero', 'support'));
