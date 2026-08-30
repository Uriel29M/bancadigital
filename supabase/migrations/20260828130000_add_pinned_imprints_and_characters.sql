alter table public.imprint_settings add column if not exists is_pinned boolean not null default false;
alter table public.character_settings add column if not exists is_pinned boolean not null default false;
