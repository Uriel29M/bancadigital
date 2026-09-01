alter table public.character_settings
  add column if not exists character_type text not null default 'character';

alter table public.character_settings
  drop constraint if exists character_settings_character_type_check;

alter table public.character_settings
  add constraint character_settings_character_type_check
  check (character_type in ('character', 'team'));
