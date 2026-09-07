create table if not exists public.telegram_cover_sources (
  source_url text primary key,
  chat_id text not null,
  message_id bigint not null,
  file_id text not null,
  file_unique_id text,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  file_size bigint not null check (file_size >= 0 and file_size <= 10485760),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint telegram_cover_source_url_valid check (length(source_url) <= 512),
  constraint telegram_cover_file_id_valid check (length(file_id) between 8 and 1024)
);
alter table public.telegram_cover_sources enable row level security;
revoke all on public.telegram_cover_sources from public, anon, authenticated;
grant all on public.telegram_cover_sources to service_role;
comment on table public.telegram_cover_sources is 'Server-managed, allowlisted Telegram image metadata. No image bytes or bot credentials are stored.';
