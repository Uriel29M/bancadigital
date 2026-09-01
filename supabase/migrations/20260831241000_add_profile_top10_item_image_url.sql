alter table public.profile_top10_items
  add column if not exists image_url text;
