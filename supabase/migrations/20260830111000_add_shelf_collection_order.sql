alter table public.profiles
  add column if not exists shelf_collection_order jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
