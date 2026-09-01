alter table public.character_settings
  add column if not exists deviantart_fanarts_enabled boolean not null default false,
  add column if not exists deviantart_gallery_url text,
  add column if not exists deviantart_fanart_image_urls text;
