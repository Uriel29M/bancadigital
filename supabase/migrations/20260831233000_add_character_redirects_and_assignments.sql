alter table public.character_settings
  add column if not exists redirect_character_key text,
  add column if not exists assigned_character_keys text[] not null default '{}';
