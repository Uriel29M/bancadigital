alter table public.character_settings
  add column if not exists authored_text text;

