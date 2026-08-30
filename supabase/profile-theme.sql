-- Execute este arquivo no SQL Editor do Supabase.
alter table public.profiles add column if not exists profile_background_theme text;
alter table public.profiles add column if not exists profile_accent_theme text;

alter table public.profiles drop constraint if exists profiles_background_theme_check;
alter table public.profiles add constraint profiles_background_theme_check
  check (profile_background_theme is null or profile_background_theme in ('black', 'white', 'graphite', 'night-blue', 'wine'));

alter table public.profiles drop constraint if exists profiles_accent_theme_check;
alter table public.profiles add constraint profiles_accent_theme_check
  check (profile_accent_theme is null or profile_accent_theme in ('black', 'white', 'blue', 'purple', 'green', 'orange'));
