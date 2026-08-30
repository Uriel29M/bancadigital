alter table public.profiles
  add column if not exists shelf_section_order jsonb not null default '["saved", "series-saved", "read", "completed", "liked"]'::jsonb;

notify pgrst, 'reload schema';
