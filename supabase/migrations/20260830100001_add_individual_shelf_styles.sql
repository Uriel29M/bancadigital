alter table public.profiles add column if not exists shelf_styles jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';
