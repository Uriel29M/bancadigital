-- Execute este arquivo no SQL Editor do Supabase.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  account_email text unique,
  avatar_url text check (avatar_url is null or avatar_url ~* '^https?://'),
  plan text not null default 'free' check (plan in ('free', 'premium', 'moderator', 'banca', 'admin')),
  title text,
  profile_hidden boolean not null default false,
  is_banned boolean not null default false,
  silenced_until timestamptz,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists account_email text;
alter table public.profiles drop constraint if exists profiles_avatar_url_check;
alter table public.profiles add constraint profiles_avatar_url_check check (avatar_url is null or avatar_url ~* '^https?://');
alter table public.profiles add column if not exists title_color text default '#ffd45c';
alter table public.profiles add column if not exists profile_background_theme text;
alter table public.profiles add column if not exists profile_accent_theme text;
alter table public.profiles drop constraint if exists profiles_background_theme_check;
alter table public.profiles add constraint profiles_background_theme_check check (profile_background_theme is null or profile_background_theme in ('black', 'white', 'graphite', 'night-blue', 'wine', 'forest', 'plum', 'sand', 'ocean'));
alter table public.profiles drop constraint if exists profiles_accent_theme_check;
alter table public.profiles add constraint profiles_accent_theme_check check (profile_accent_theme is null or profile_accent_theme in ('black', 'white', 'blue', 'purple', 'green', 'orange', 'pink', 'cyan', 'teal', 'yellow', 'indigo', 'crimson'));
update public.profiles set title = left(trim(title), 10) where title is not null and char_length(title) > 10;
alter table public.profiles drop constraint if exists profiles_title_length_check;
alter table public.profiles add constraint profiles_title_length_check check (title is null or char_length(title) between 1 and 10);
alter table public.profiles add column if not exists shelf_saved_public boolean not null default true;
alter table public.profiles add column if not exists shelf_series_public boolean not null default true;
alter table public.profiles add column if not exists shelf_read_public boolean not null default true;
alter table public.profiles add column if not exists shelf_completed_public boolean not null default true;
alter table public.profiles add column if not exists shelf_liked_public boolean not null default true;
alter table public.profiles add column if not exists shelf_categories jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists profile_hidden boolean not null default false;
alter table public.profiles add column if not exists is_banned boolean not null default false;
alter table public.profiles add column if not exists silenced_until timestamptz;
alter table public.profiles add column if not exists likes_public boolean not null default true;
alter table public.profiles add column if not exists wall_description text not null default '';
alter table public.profiles add column if not exists profile_banner_url text;
alter table public.profiles drop constraint if exists profiles_wall_description_length_check;
alter table public.profiles add constraint profiles_wall_description_length_check check (char_length(wall_description) <= 500);
alter table public.profiles add column if not exists allow_mentions boolean not null default true;
alter table public.profiles add column if not exists allow_messages boolean not null default true;
alter table public.profiles add column if not exists shelf_sort_orders jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists shelf_section_order jsonb not null default '["saved", "series-saved", "read", "completed", "liked"]'::jsonb;
alter table public.profiles add column if not exists shelf_collection_order jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists shelf_style text not null default 'none';
alter table public.profiles add column if not exists shelf_styles jsonb not null default '{}'::jsonb;
alter table public.profiles drop constraint if exists profiles_shelf_style_check;
alter table public.profiles add constraint profiles_shelf_style_check check (shelf_style in ('none', 'wood', 'retro', 'neon', 'comic', 'minimal'));
notify pgrst, 'reload schema';
alter table public.profiles add column if not exists notifications_enabled boolean not null default true;
alter table public.profiles add column if not exists shelf_blogs_public boolean not null default true;
alter table public.profiles add column if not exists profile_wall_public boolean not null default true;
alter table public.profiles add column if not exists shelf_saved_public_collections boolean not null default true;
alter table public.profiles add column if not exists profile_activity_public boolean not null default true;
alter table public.profiles add column if not exists xp integer not null default 0;
alter table public.profiles add column if not exists level integer not null default 1;
alter table public.profiles add column if not exists daily_streak integer not null default 0;
alter table public.profiles add column if not exists last_checkin_at timestamptz;
alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles add constraint profiles_plan_check check (plan in ('free', 'premium', 'moderator', 'banca', 'admin'));
create unique index if not exists profiles_account_email_key on public.profiles(account_email) where account_email is not null;

create table if not exists public.profile_xp_events (
  id bigint generated by default as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  event_key text not null,
  xp integer not null check (xp > 0),
  created_at timestamptz not null default now(),
  unique (user_id, event_key)
);
create index if not exists profile_xp_events_created_idx on public.profile_xp_events(created_at desc);
create index if not exists profile_xp_events_user_created_idx on public.profile_xp_events(user_id, created_at desc);
alter table public.profile_xp_events drop constraint if exists profile_xp_events_xp_check;
alter table public.profile_xp_events add constraint profile_xp_events_xp_check check (xp <> 0);

create table if not exists public.publisher_settings (
  publisher_key text primary key,
  publisher_name text not null,
  cover_url text,
  is_pinned boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.blog_posts (
  id bigint generated by default as identity primary key,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 3 and 140),
  excerpt text not null default '' check (char_length(excerpt) <= 500),
  content_html text not null default '',
  cover_url text,
  image_2_url text,
  image_3_url text,
  status text not null default 'published' check (status in ('draft', 'published')),
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);
create index if not exists blog_posts_published_idx on public.blog_posts(status, is_featured desc, published_at desc);
create index if not exists blog_posts_author_idx on public.blog_posts(author_id, updated_at desc);

create table if not exists public.blog_likes (
  blog_id bigint not null references public.blog_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blog_id, user_id)
);
create index if not exists blog_likes_blog_idx on public.blog_likes(blog_id);

create table if not exists public.blog_comments (
  id bigint generated by default as identity primary key,
  blog_id bigint not null references public.blog_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id bigint references public.blog_comments(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
alter table public.blog_comments add column if not exists parent_id bigint references public.blog_comments(id) on delete cascade;
create index if not exists blog_comments_blog_idx on public.blog_comments(blog_id, created_at desc);

create table if not exists public.blog_comment_likes (
  blog_comment_id bigint not null references public.blog_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blog_comment_id, user_id)
);
create index if not exists blog_comment_likes_comment_idx on public.blog_comment_likes(blog_comment_id);

create table if not exists public.blog_saves (
  blog_id bigint not null references public.blog_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blog_id, user_id)
);
create index if not exists blog_saves_user_idx on public.blog_saves(user_id, created_at desc);

insert into storage.buckets (id, name, public) values ('blog-images', 'blog-images', true) on conflict (id) do nothing;

create table if not exists public.profile_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.profile_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists profile_blocks_blocked_idx on public.profile_blocks(blocked_id);

create or replace function public.is_blocked_between(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id is not null
    and auth.uid() is not null
    and exists (
      select 1
      from public.profile_blocks block
      where (block.blocker_id = auth.uid() and block.blocked_id = p_user_id)
         or (block.blocker_id = p_user_id and block.blocked_id = auth.uid())
    )
$$;

grant execute on function public.is_blocked_between(uuid) to authenticated;

create table if not exists public.notifications (
  id bigint generated by default as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null default 'system',
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 500),
  href text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

alter table public.notifications add column if not exists expires_at timestamptz;
update public.notifications
set expires_at = created_at + interval '24 hours'
where expires_at is null;
alter table public.notifications
  alter column expires_at set default (now() + interval '24 hours'),
  alter column expires_at set not null;

create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_user_unread_idx on public.notifications(user_id) where read_at is null;
create index if not exists notifications_expires_idx on public.notifications(expires_at);

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then
  null;
end;
$$;

create or replace function public.create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_actor_id uuid default null,
  p_href text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if p_user_id is null or p_user_id = p_actor_id or not exists (select 1 from public.profiles where id = p_user_id and notifications_enabled) then return; end if;
  insert into public.notifications(user_id, actor_id, type, title, body, href, metadata)
  values (p_user_id, p_actor_id, p_type, p_title, p_body, p_href, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

revoke execute on function public.create_notification(uuid, text, text, text, uuid, text, jsonb) from anon, authenticated;

create or replace function public.purge_expired_notifications()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  delete from public.notifications where expires_at <= now();
  return new;
end;
$$;

drop trigger if exists purge_expired_notifications_trigger on public.notifications;
create trigger purge_expired_notifications_trigger
before insert on public.notifications
for each statement execute procedure public.purge_expired_notifications();

create or replace function public.purge_my_expired_notifications()
returns integer language plpgsql security definer set search_path = public
as $$
declare v_count integer;
begin
  if auth.uid() is null then return 0; end if;
  delete from public.notifications where user_id = auth.uid() and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.purge_my_expired_notifications() from anon;
grant execute on function public.purge_my_expired_notifications() to authenticated;

create table if not exists public.chat_messages (
  id bigint generated by default as identity primary key,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  check (sender_id <> recipient_id)
);

create index if not exists chat_messages_sender_recipient_idx on public.chat_messages(sender_id, recipient_id, created_at desc);
create index if not exists chat_messages_expires_idx on public.chat_messages(expires_at);

create table if not exists public.chat_rooms (
  id text primary key,
  name text not null unique,
  access text not null default 'public' check (access in ('public', 'premium', 'staff', 'faction'))
);
alter table public.chat_rooms drop constraint if exists chat_rooms_access_check;
alter table public.chat_rooms add constraint chat_rooms_access_check check (access in ('public', 'premium', 'staff', 'faction'));

insert into public.chat_rooms (id, name, access) values
  ('geral', 'Chat Geral', 'public'),
  ('decenautas', 'Decenautas', 'public'),
  ('marvetes', 'Marvetes', 'public'),
  ('leitores-colecionadores', 'Leitores e Colecionadores', 'premium'),
  ('staff', 'Chat da Staff', 'staff')
on conflict (id) do update set name = excluded.name, access = excluded.access;

alter table public.chat_messages add column if not exists room_id text references public.chat_rooms(id) on delete cascade;
alter table public.chat_messages add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.chat_messages alter column recipient_id drop not null;
alter table public.chat_messages drop constraint if exists chat_messages_destination_check;
alter table public.chat_messages add constraint chat_messages_destination_check check (
  (room_id is null and recipient_id is not null) or (room_id is not null and recipient_id is null)
);
create index if not exists chat_messages_room_created_idx on public.chat_messages(room_id, created_at desc);

create table if not exists public.chat_room_sheriffs (
  room_id text primary key references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now()
);
create unique index if not exists chat_room_sheriffs_user_room_idx on public.chat_room_sheriffs(room_id, user_id);
alter table public.chat_room_sheriffs enable row level security;

create or replace function public.is_chat_room_sheriff(p_room_id text)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.chat_room_sheriffs sheriff join public.chat_rooms room on room.id = sheriff.room_id where sheriff.room_id = p_room_id and room.id in ('geral', 'decenautas', 'marvetes', 'leitores-colecionadores') and sheriff.user_id = auth.uid())
$$;

create or replace function public.get_chat_room_sheriff(p_room_id text)
returns table(user_id uuid, username text, avatar_url text)
language sql stable security definer set search_path = public
as $$
  select sheriff.user_id, profile.username, profile.avatar_url
  from public.chat_room_sheriffs sheriff
  join public.profiles profile on profile.id = sheriff.user_id
  join public.chat_rooms room on room.id = sheriff.room_id
  where sheriff.room_id = p_room_id and room.id in ('geral', 'decenautas', 'marvetes', 'leitores-colecionadores') and auth.uid() is not null
$$;

create or replace function public.set_chat_room_sheriff(p_room_id text, p_username text)
returns table(user_id uuid, username text, avatar_url text)
language plpgsql security definer set search_path = public
as $$
declare
  v_user public.profiles%rowtype;
  v_previous_user public.profiles%rowtype;
  v_room_name text;
begin
  if not public.is_moderator() then raise exception 'Apenas moderadores e administradores podem trocar o xerife'; end if;
  if not exists (select 1 from public.chat_rooms where id = p_room_id and id in ('geral', 'decenautas', 'marvetes', 'leitores-colecionadores')) then raise exception 'Apenas as salas públicas principais podem ter xerife'; end if;
  select room.name into v_room_name from public.chat_rooms room where room.id = p_room_id;
  if nullif(trim(p_username), '') is null then
    select profile.* into v_previous_user from public.chat_room_sheriffs sheriff join public.profiles profile on profile.id = sheriff.user_id where sheriff.room_id = p_room_id;
    delete from public.chat_room_sheriffs where room_id = p_room_id;
    if v_previous_user.id is not null then
      perform public.create_notification(v_previous_user.id, 'chat_sheriff_removed', 'Cargo de xerife removido', 'Você não é mais o xerife de ' || coalesce(v_room_name, 'uma sala pública') || '.', auth.uid(), null, jsonb_build_object('room_id', p_room_id));
    end if;
    return;
  end if;
  select profile.* into v_user from public.profiles profile where lower(profile.username) = lower(trim(p_username));
  if not found then raise exception 'Usuário não encontrado'; end if;
  insert into public.chat_room_sheriffs(room_id, user_id, assigned_by)
  values (p_room_id, v_user.id, auth.uid())
  on conflict (room_id) do update set user_id = excluded.user_id, assigned_by = excluded.assigned_by, assigned_at = now();
  perform public.create_notification(v_user.id, 'chat_sheriff', 'Você foi nomeado xerife', 'Você agora é o xerife de ' || coalesce(v_room_name, 'uma sala pública') || '. Você pode destacar e excluir mensagens nessa sala.', auth.uid(), null, jsonb_build_object('room_id', p_room_id));
  return query select v_user.id as user_id, v_user.username as username, v_user.avatar_url as avatar_url;
end;
$$;

grant execute on function public.get_chat_room_sheriff(text) to authenticated;
grant execute on function public.set_chat_room_sheriff(text, text) to authenticated;
notify pgrst, 'reload schema';

-- As fixações guardam uma cópia da mensagem para continuarem visíveis mesmo
-- depois que a mensagem original expirar e for removida.
create table if not exists public.chat_pins (
  id bigint generated by default as identity primary key,
  room_id text not null references public.chat_rooms(id) on delete cascade,
  message_id bigint not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  sender_id uuid,
  sender_username text not null default 'usuário',
  sender_avatar_url text,
  pinned_by uuid references public.profiles(id) on delete set null,
  pinned_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (room_id, message_id)
);

create index if not exists chat_pins_room_idx on public.chat_pins(room_id, pinned_at asc);

create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and plan in ('moderator', 'banca', 'admin')) $$;

create or replace function public.pin_chat_message(p_room_id text, p_message_id bigint, p_duration text)
returns public.chat_pins language plpgsql security definer set search_path = public
as $$
declare
  v_message public.chat_messages%rowtype;
  v_pin public.chat_pins;
  v_expires_at timestamptz;
begin
  if not (public.is_moderator() or public.is_chat_room_sheriff(p_room_id)) then raise exception 'Apenas moderadores, administradores ou o xerife podem fixar mensagens'; end if;
  if p_duration not in ('24h', '7d', '1m', 'forever') then raise exception 'Duração da fixação inválida'; end if;
  perform pg_advisory_xact_lock(hashtext(p_room_id));
  select * into v_message from public.chat_messages where id = p_message_id and room_id = p_room_id;
  if not found then raise exception 'Mensagem de sala não encontrada'; end if;
  if p_duration = '24h' then v_expires_at := now() + interval '24 hours';
  elsif p_duration = '7d' then v_expires_at := now() + interval '7 days';
  elsif p_duration = '1m' then v_expires_at := now() + interval '1 month';
  else v_expires_at := null;
  end if;

  delete from public.chat_pins where room_id = p_room_id and (expires_at is not null and expires_at <= now());
  delete from public.chat_pins where room_id = p_room_id and message_id = p_message_id;
  if (select count(*) from public.chat_pins where room_id = p_room_id) >= 3 then
    delete from public.chat_pins where id = (
      select id from public.chat_pins where room_id = p_room_id order by pinned_at asc, id asc limit 1
    );
  end if;

  insert into public.chat_pins (
    room_id, message_id, body, metadata, sender_id, sender_username, sender_avatar_url, pinned_by, expires_at
  )
  select p_room_id, p_message_id, v_message.body, v_message.metadata, v_message.sender_id,
    coalesce(profile.username, 'usuário'), profile.avatar_url, auth.uid(), v_expires_at
  from public.profiles profile where profile.id = v_message.sender_id
  returning * into v_pin;
  if not found then
    insert into public.chat_pins (room_id, message_id, body, metadata, sender_id, pinned_by, expires_at)
    values (p_room_id, p_message_id, v_message.body, v_message.metadata, v_message.sender_id, auth.uid(), v_expires_at)
    returning * into v_pin;
  end if;
  return v_pin;
end;
$$;

create or replace function public.unpin_chat_message(p_room_id text, p_message_id bigint)
returns boolean language plpgsql security definer set search_path = public
as $$
begin
  if not (public.is_moderator() or public.is_chat_room_sheriff(p_room_id)) then raise exception 'Apenas moderadores, administradores ou o xerife podem desfixar mensagens'; end if;
  delete from public.chat_pins where room_id = p_room_id and message_id = p_message_id;
  return found;
end;
$$;

grant execute on function public.pin_chat_message(text, bigint, text) to authenticated;
grant execute on function public.unpin_chat_message(text, bigint) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object then
  null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.chat_pins;
exception when duplicate_object then
  null;
end;
$$;

create or replace function public.purge_expired_chat_messages()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  delete from public.chat_messages where expires_at <= now();
  return new;
end;
$$;

drop trigger if exists purge_expired_chat_messages_trigger on public.chat_messages;
create trigger purge_expired_chat_messages_trigger
before insert on public.chat_messages
for each statement execute procedure public.purge_expired_chat_messages();

create table if not exists public.shelf_collections (
  id text primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  cover_url text,
  is_public boolean not null default true,
  item_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shelf_collections add column if not exists collection_type text not null default 'comic';
alter table public.shelf_collections add column if not exists blog_ids jsonb not null default '[]'::jsonb;
alter table public.shelf_collections add column if not exists is_featured boolean not null default false;
alter table public.shelf_collections add column if not exists cover_styles jsonb not null default '{}'::jsonb;
alter table public.shelf_collections add column if not exists cover_choices jsonb not null default '{}'::jsonb;
alter table public.shelf_collections add column if not exists sort_order text not null default 'added_desc';
alter table public.shelf_collections drop constraint if exists shelf_collections_type_check;
alter table public.shelf_collections add constraint shelf_collections_type_check check (collection_type in ('comic', 'blog'));

insert into public.shelf_collections (id, owner_id, name, cover_url, is_public, item_ids)
select category->>'id', profiles.id, category->>'name', category->>'coverUrl', coalesce((category->>'isPublic')::boolean, true), coalesce(category->'itemIds', '[]'::jsonb)
from public.profiles
cross join lateral jsonb_array_elements(coalesce(profiles.shelf_categories, '[]'::jsonb)) as category
where category->>'id' is not null and category->>'name' is not null
on conflict (id) do nothing;

alter table public.profiles drop column if exists shelf_categories;

create table if not exists public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

-- Capas oficiais e preferência de capa dos usuários Premium.
create table if not exists public.comic_cover_variants (
  item_id text not null,
  variant_key text not null,
  label text not null check (char_length(label) between 1 and 80),
  cover_url text not null check (cover_url ~ '^https://static[.]dc[.]com/'),
  source_url text,
  created_at timestamptz not null default now(),
  primary key (item_id, variant_key)
);

alter table public.comic_cover_variants drop constraint if exists comic_cover_variants_cover_url_check;
alter table public.comic_cover_variants add constraint comic_cover_variants_cover_url_check check (
  cover_url ~ '^https://'
);

create table if not exists public.user_cover_choices (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null,
  variant_key text not null,
  label text not null default 'Capa variante',
  cover_url text not null check (cover_url ~ '^https://static[.]dc[.]com/'),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
alter table public.user_cover_choices drop constraint if exists user_cover_choices_cover_url_check;
alter table public.user_cover_choices add constraint user_cover_choices_cover_url_check check (
  cover_url ~ '^https://'
);
create index if not exists user_cover_choices_item_idx on public.user_cover_choices(item_id);

create table if not exists public.user_cover_styles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null,
  style text not null default 'normal' check (style in ('normal', 'grayscale', 'gold')),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
create index if not exists user_cover_styles_item_idx on public.user_cover_styles(item_id);

create table if not exists public.user_series_cover_choices (
  user_id uuid not null references public.profiles(id) on delete cascade,
  series_id text not null,
  item_id text not null,
  cover_url text not null check (cover_url ~ '^https://'),
  variant_key text,
  is_variant boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, series_id)
);
create index if not exists user_series_cover_choices_series_idx on public.user_series_cover_choices(series_id);

create or replace function public.validate_user_cover_choice()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.comic_cover_variants variant
    where variant.item_id = new.item_id
      and variant.variant_key = new.variant_key
      and variant.cover_url = new.cover_url
  ) then
    raise exception 'Capa variante não cadastrada para esta edição';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_user_cover_choice_trigger on public.user_cover_choices;
create trigger validate_user_cover_choice_trigger
before insert or update on public.user_cover_choices
for each row execute procedure public.validate_user_cover_choice();

-- Revisão manual das capas encontradas pelo cover-variants-bot.
create or replace function public.review_bot_action(p_action_id bigint, p_status text)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_action public.bot_actions%rowtype;
  v_item_id text;
  v_variant_key text;
  v_label text;
  v_cover_url text;
  v_source_url text;
begin
  if not public.is_admin() then raise exception 'Apenas administradores podem revisar ações de bots'; end if;
  if p_status not in ('approved', 'rejected') then raise exception 'Status de revisão inválido'; end if;
  select * into v_action from public.bot_actions where id = p_action_id for update;
  if not found then raise exception 'Ação do bot não encontrada'; end if;
  if v_action.status <> 'pending' then raise exception 'Esta ação já foi revisada'; end if;
  if p_status = 'approved' and v_action.action = 'cover_variant_candidate' then
    v_item_id := nullif(trim(v_action.metadata->>'item_id'), '');
    v_variant_key := nullif(trim(v_action.metadata->>'variant_key'), '');
    v_label := nullif(trim(v_action.metadata->>'label'), '');
    v_cover_url := nullif(trim(v_action.metadata->>'cover_url'), '');
    v_source_url := nullif(trim(v_action.metadata->>'source_url'), '');
    if v_item_id is null or v_variant_key is null or v_label is null or v_cover_url is null or v_cover_url !~ '^https://' then
      raise exception 'A proposta de capa não contém dados válidos';
    end if;
    insert into public.comic_cover_variants(item_id, variant_key, label, cover_url, source_url)
    values (v_item_id, v_variant_key, left(v_label, 80), v_cover_url, v_source_url)
    on conflict (item_id, variant_key) do update set label = excluded.label, cover_url = excluded.cover_url, source_url = excluded.source_url;
  end if;
  update public.bot_actions set status = p_status, reviewed_by = auth.uid(), reviewed_at = now() where id = p_action_id;
end;
$$;
grant execute on function public.review_bot_action(bigint, text) to authenticated;

create table if not exists public.comic_likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create table if not exists public.reading_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null,
  page integer not null default 1 check (page > 0),
  total_pages integer not null default 1 check (total_pages > 0),
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
alter table public.reading_progress add column if not exists completion_source text;
update public.reading_progress set completion_source = 'manual' where completed and completion_source is null;
alter table public.reading_progress drop constraint if exists reading_progress_completion_source_check;
alter table public.reading_progress add constraint reading_progress_completion_source_check check (completion_source is null or completion_source in ('manual', 'normal'));

create table if not exists public.comic_read_counts (
  item_id text primary key,
  clicks bigint not null default 0 check (clicks >= 0),
  updated_at timestamptz not null default now()
);
create index if not exists comic_read_counts_clicks_idx on public.comic_read_counts(clicks desc);

create table if not exists public.comic_monthly_read_counts (
  item_id text not null,
  month_start date not null,
  clicks bigint not null default 0 check (clicks >= 0),
  updated_at timestamptz not null default now(),
  primary key (item_id, month_start)
);

-- Edições ocultadas do catálogo público. Moderadores ainda conseguem visualizá-las.
create table if not exists public.catalog_item_visibility (
  item_id text primary key,
  is_hidden boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index if not exists catalog_item_visibility_hidden_idx on public.catalog_item_visibility(is_hidden);
create index if not exists comic_monthly_read_counts_idx on public.comic_monthly_read_counts(month_start, clicks desc);

create table if not exists public.comic_download_counts (
  item_id text primary key,
  downloads bigint not null default 0 check (downloads >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.homepage_settings (
  id boolean primary key default true check (id),
  section_order jsonb not null default '["recommendations", "character-banner", "continue", "recent", "new-series", "monthly", "pinned-publishers", "best-series", "featured-collections", "random", "tips", "artist", "random-publisher", "downloads", "most-read-covers", "editorial-banner"]'::jsonb,
  hidden_sections jsonb not null default '[]'::jsonb,
  legendary_sunday_enabled boolean not null default true,
  legendary_manual_date date,
  updated_at timestamptz not null default now()
);
alter table public.homepage_settings add column if not exists section_order jsonb not null default '["recommendations", "character-banner", "continue", "recent", "new-series", "monthly", "pinned-publishers", "best-series", "featured-collections", "random", "tips", "artist", "random-publisher", "downloads", "most-read-covers", "editorial-banner"]'::jsonb;
alter table public.homepage_settings add column if not exists hidden_sections jsonb not null default '[]'::jsonb;
alter table public.homepage_settings add column if not exists legendary_sunday_enabled boolean not null default true;
alter table public.homepage_settings add column if not exists legendary_manual_date date;
insert into public.homepage_settings (id) values (true) on conflict (id) do nothing;
create index if not exists comic_download_counts_downloads_idx on public.comic_download_counts(downloads desc);

create table if not exists public.homepage_banners (
  id bigint generated by default as identity primary key,
  item_id text not null,
  series_id text not null,
  title text not null check (char_length(title) between 1 and 200),
  image_url text not null check (image_url ~ '^https://'),
  source_url text,
  banner_key text not null,
  is_active boolean not null default true,
  approved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id, banner_key)
);
create index if not exists homepage_banners_active_idx on public.homepage_banners(is_active, created_at desc);

create table if not exists public.shelf_collection_likes (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  collection_id text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, collection_id, user_id)
);

create table if not exists public.publisher_saves (
  user_id uuid not null references public.profiles(id) on delete cascade,
  publisher_key text not null,
  publisher_name text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, publisher_key)
);
create index if not exists publisher_saves_user_idx on public.publisher_saves(user_id, created_at desc);

create table if not exists public.imprint_settings (
  imprint_key text primary key,
  imprint_name text not null,
  cover_url text,
  wikipedia_url text,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.prevent_non_admin_imprint_wiki_url()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT' and new.wikipedia_url is not null)
    or (tg_op = 'UPDATE' and new.wikipedia_url is distinct from old.wikipedia_url) then
    if not public.is_admin() then
      raise exception 'Apenas administradores podem alterar o link da Wikipédia do selo';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_non_admin_imprint_wiki_url_trigger on public.imprint_settings;
create trigger prevent_non_admin_imprint_wiki_url_trigger
before insert or update on public.imprint_settings
for each row execute function public.prevent_non_admin_imprint_wiki_url();
create table if not exists public.imprint_saves (
  user_id uuid not null references public.profiles(id) on delete cascade,
  imprint_key text not null,
  imprint_name text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, imprint_key)
);
create index if not exists imprint_saves_user_idx on public.imprint_saves(user_id, created_at desc);

create table if not exists public.character_settings (
  character_key text primary key,
  character_name text not null,
  cover_url text,
  wikipedia_url text,
  authored_text text,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.prevent_non_admin_character_wiki_url()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT' and new.wikipedia_url is not null)
    or (tg_op = 'UPDATE' and new.wikipedia_url is distinct from old.wikipedia_url) then
    if not public.is_admin() then
      raise exception 'Apenas administradores podem alterar o link da Wikipédia do personagem';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_non_admin_character_wiki_url_trigger on public.character_settings;
create trigger prevent_non_admin_character_wiki_url_trigger
before insert or update on public.character_settings
for each row execute function public.prevent_non_admin_character_wiki_url();
create table if not exists public.character_saves (
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_key text not null,
  character_name text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, character_key)
);
create index if not exists character_saves_user_idx on public.character_saves(user_id, created_at desc);

create table if not exists public.shelf_collection_saves (
  user_id uuid not null references public.profiles(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  collection_id text not null references public.shelf_collections(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, collection_id)
);
create index if not exists shelf_collection_saves_user_idx on public.shelf_collection_saves(user_id, created_at desc);
create index if not exists shelf_collection_saves_collection_idx on public.shelf_collection_saves(collection_id);

create table if not exists public.shelf_collection_comments (
  id bigint generated by default as identity primary key,
  collection_id text not null references public.shelf_collections(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists shelf_collection_comments_collection_idx on public.shelf_collection_comments(collection_id, created_at asc);

create table if not exists public.profile_wall_comments (
  id bigint generated by default as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id bigint references public.profile_wall_comments(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
alter table public.profile_wall_comments add column if not exists parent_id bigint references public.profile_wall_comments(id) on delete cascade;
create index if not exists profile_wall_comments_profile_idx on public.profile_wall_comments(profile_id, created_at desc);

create or replace function public.notify_profile_wall_comment()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_profile_username text;
  v_parent_author uuid;
  v_href text;
begin
  select username into v_profile_username from public.profiles where id = NEW.profile_id;
  v_href := case when v_profile_username is null then null else '?perfil=' || v_profile_username end;
  perform public.create_notification(NEW.profile_id, case when NEW.parent_id is null then 'profile_wall_comment' else 'profile_wall_reply' end, case when NEW.parent_id is null then 'Novo comentário no seu mural' else 'Nova resposta no seu mural' end, case when NEW.parent_id is null then 'Alguém comentou no seu mural.' else 'Alguém respondeu no seu mural.' end, NEW.user_id, v_href, jsonb_build_object('profile_id', NEW.profile_id, 'profile_username', v_profile_username, 'comment_id', NEW.id));
  if NEW.parent_id is not null then
    select user_id into v_parent_author from public.profile_wall_comments where id = NEW.parent_id;
    perform public.create_notification(v_parent_author, 'profile_wall_reply', 'Nova resposta ao seu comentário', 'Alguém respondeu a um comentário seu no mural.', NEW.user_id, v_href, jsonb_build_object('profile_id', NEW.profile_id, 'profile_username', v_profile_username, 'comment_id', NEW.id));
  end if;
  return NEW;
end;
$$;

drop trigger if exists notify_profile_wall_comment_trigger on public.profile_wall_comments;
create trigger notify_profile_wall_comment_trigger after insert on public.profile_wall_comments for each row execute procedure public.notify_profile_wall_comment();

create table if not exists public.comments (
  id bigint generated by default as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null,
  parent_id bigint references public.comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
alter table public.comments add column if not exists parent_id bigint references public.comments(id) on delete cascade;

create table if not exists public.comment_likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  comment_id bigint not null references public.comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, comment_id)
);

create table if not exists public.moderation_actions (
  id bigint generated by default as identity primary key,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  duration_until timestamptz,
  reason text,
  internal_note text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Fila interna para propostas de automações/bots. Nunca gera notificações aos usuários.
create table if not exists public.bot_actions (
  id bigint generated by default as identity primary key,
  bot_name text not null check (char_length(trim(bot_name)) between 1 and 80),
  action text not null check (char_length(trim(action)) between 1 and 120),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 500),
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists bot_actions_status_created_idx on public.bot_actions(status, created_at desc);

-- Relatos feitos pelos leitores quando uma edição não consegue abrir.
create table if not exists public.file_reports (
  id bigint generated by default as identity primary key,
  item_id text not null,
  reporter_id uuid references public.profiles(id) on delete cascade,
  item_snapshot jsonb not null default '{}'::jsonb,
  reason text not null default 'Arquivo não abriu',
  status text not null default 'pending' check (status in ('pending', 'resolved', 'ignored')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.file_reports add column if not exists notified_at timestamptz;
alter table public.file_reports add column if not exists source text not null default 'user';
alter table public.file_reports add column if not exists bot_name text;
alter table public.file_reports drop constraint if exists file_reports_source_check;
alter table public.file_reports add constraint file_reports_source_check check (source in ('user', 'bot'));
alter table public.file_reports drop constraint if exists file_reports_bot_name_check;
alter table public.file_reports add constraint file_reports_bot_name_check check (source = 'user' or nullif(trim(bot_name), '') is not null);
create index if not exists file_reports_status_created_idx on public.file_reports(status, created_at desc);
create unique index if not exists file_reports_pending_reporter_item_idx on public.file_reports(item_id, reporter_id) where status = 'pending';
create unique index if not exists file_reports_pending_bot_item_idx on public.file_reports(item_id, bot_name) where status = 'pending' and source = 'bot';

create or replace function public.notify_resolved_file_report_once()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if old.status is distinct from 'resolved' and new.status = 'resolved' and new.notified_at is null and new.reporter_id is not null then
    perform public.create_notification(
      new.reporter_id,
      'file_report_resolved',
      'Relato de arquivo resolvido',
      'Seu relato foi verificado pela equipe. Obrigado por ajudar a Banca Digital.',
      auth.uid(),
      null,
      jsonb_build_object('item_id', new.item_id, 'report_id', new.id)
    );
    new.notified_at := now();
  end if;
  return new;
end;
$$;
revoke execute on function public.notify_resolved_file_report_once() from anon, authenticated;
drop trigger if exists file_report_resolved_cleanup_trigger on public.file_reports;
drop trigger if exists file_report_resolved_notification_trigger on public.file_reports;
create trigger file_report_resolved_notification_trigger
before update of status on public.file_reports
for each row execute function public.notify_resolved_file_report_once();

create or replace function public.submit_bot_action(p_bot_name text, p_action text, p_title text, p_body text, p_metadata jsonb default '{}'::jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  insert into public.bot_actions(bot_name, action, title, body, metadata)
  values (left(trim(p_bot_name), 80), left(trim(p_action), 120), left(trim(p_title), 120), left(trim(p_body), 500), coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.submit_bot_action(text, text, text, text, jsonb) from anon, authenticated;

create table if not exists public.achievements (
  id bigint generated by default as identity primary key,
  achievement_key text unique,
  name text not null,
  description text,
  icon text default '★'
);
alter table public.achievements add column if not exists achievement_key text;
drop index if exists public.achievements_key_unique;
create unique index if not exists achievements_key_unique on public.achievements(achievement_key);

create table if not exists public.user_achievements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_id bigint not null references public.achievements(id) on delete cascade,
  awarded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create or replace function public.notify_new_follow()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  perform public.create_notification(NEW.following_id, 'follow', 'Novo seguidor', 'Alguém começou a seguir você.', NEW.follower_id, null, '{}'::jsonb);
  return NEW;
end;
$$;

drop trigger if exists notify_new_follow_trigger on public.profile_follows;
create trigger notify_new_follow_trigger after insert on public.profile_follows for each row execute procedure public.notify_new_follow();

create or replace function public.notify_new_chat_message()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_preview text := regexp_replace(trim(NEW.body), '\s+', ' ', 'g');
begin
  if NEW.room_id is not null then return NEW; end if;
  if char_length(v_preview) > 300 then
    v_preview := left(v_preview, 297) || '...';
  end if;
  perform public.create_notification(NEW.recipient_id, 'message', 'Nova mensagem privada', 'Você recebeu uma nova mensagem privada: "' || v_preview || '"', NEW.sender_id, null, '{}'::jsonb);
  return NEW;
end;
$$;

create or replace function public.can_access_chat_room(p_room_id text)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.chat_rooms room
    left join public.profiles profile on profile.id = auth.uid()
    where room.id = p_room_id
      and (
        room.access = 'public'
        or (room.access = 'premium' and profile.plan in ('premium', 'admin'))
        or (room.access = 'staff' and profile.plan in ('moderator', 'banca', 'admin'))
      )
  )
$$;

create or replace function public.notify_chat_mentions()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_mentioned record;
  v_mentioned_id uuid;
begin
  for v_mentioned in select distinct lower((regexp_matches(NEW.body, '@([A-Za-z0-9_]{3,24})', 'gi'))[1]) as username loop
    select id into v_mentioned_id from public.profiles where lower(username) = v_mentioned.username limit 1;
    if v_mentioned_id is not null and v_mentioned_id <> NEW.sender_id and exists (select 1 from public.profiles where id = v_mentioned_id and allow_mentions) then
      perform public.create_notification(
        v_mentioned_id,
        'chat_mention',
        'Você foi mencionado no chat',
        'Alguém mencionou você em uma conversa.',
        NEW.sender_id,
        null,
        jsonb_build_object('room_id', NEW.room_id, 'message_id', NEW.id)
      );
    end if;
    v_mentioned_id := null;
  end loop;
  return NEW;
end;
$$;

drop trigger if exists notify_chat_mentions_trigger on public.chat_messages;
create trigger notify_chat_mentions_trigger after insert on public.chat_messages for each row execute procedure public.notify_chat_mentions();

drop trigger if exists notify_new_chat_message_trigger on public.chat_messages;
create trigger notify_new_chat_message_trigger after insert on public.chat_messages for each row execute procedure public.notify_new_chat_message();

create or replace function public.notify_collection_like()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_name text;
begin
  select name into v_name from public.shelf_collections where id = NEW.collection_id and owner_id = NEW.owner_id;
  perform public.create_notification(NEW.owner_id, 'collection_like', 'Coleção curtida', 'Sua coleção "' || coalesce(v_name, 'sem nome') || '" recebeu uma curtida.', NEW.user_id, null, jsonb_build_object('collection_id', NEW.collection_id));
  return NEW;
end;
$$;

drop trigger if exists notify_collection_like_trigger on public.shelf_collection_likes;
create trigger notify_collection_like_trigger after insert on public.shelf_collection_likes for each row execute procedure public.notify_collection_like();

create or replace function public.notify_comment_activity()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_parent_author uuid;
  v_mentioned_id uuid;
  v_mentioned record;
begin
  if NEW.parent_id is not null then
    select user_id into v_parent_author from public.comments where id = NEW.parent_id;
    perform public.create_notification(v_parent_author, 'comment_reply', 'Nova resposta ao seu comentário', 'Alguém respondeu a um comentário seu.', NEW.user_id, null, jsonb_build_object('item_id', NEW.item_id, 'comment_id', NEW.id));
  end if;
  for v_mentioned in select distinct lower((regexp_matches(NEW.body, '@([A-Za-z0-9_]{3,24})', 'gi'))[1]) as username loop
    select id into v_mentioned_id from public.profiles where lower(username) = v_mentioned.username limit 1;
    if v_mentioned_id is not null and exists (select 1 from public.profiles where id = v_mentioned_id and allow_mentions) then
      perform public.create_notification(v_mentioned_id, 'mention', 'Você foi mencionado', 'Alguém mencionou você em um comentário.', NEW.user_id, null, jsonb_build_object('item_id', NEW.item_id, 'comment_id', NEW.id));
    end if;
    v_mentioned_id := null;
  end loop;
  return NEW;
end;
$$;

drop trigger if exists notify_comment_activity_trigger on public.comments;
create trigger notify_comment_activity_trigger after insert on public.comments for each row execute procedure public.notify_comment_activity();

create or replace function public.notify_comment_like()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_comment record;
  v_body text;
begin
  select user_id, item_id, parent_id into v_comment
  from public.comments
  where id = NEW.comment_id;
  v_body := case when v_comment.parent_id is null
    then 'Alguém curtiu seu comentário.'
    else 'Alguém curtiu sua resposta.'
  end;
  perform public.create_notification(v_comment.user_id, 'comment_like', 'Comentário curtido', v_body, NEW.user_id, null, jsonb_build_object('comment_id', NEW.comment_id, 'item_id', v_comment.item_id));
  return NEW;
end;
$$;

drop trigger if exists notify_comment_like_trigger on public.comment_likes;
create trigger notify_comment_like_trigger after insert on public.comment_likes for each row execute procedure public.notify_comment_like();

create or replace function public.notify_blog_comment_activity()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_blog_author uuid;
  v_parent_author uuid;
  v_mentioned record;
  v_mentioned_id uuid;
  v_href text := '?pagina=blogs&blog=' || NEW.blog_id::text;
begin
  select author_id into v_blog_author from public.blog_posts where id = NEW.blog_id;
  if NEW.parent_id is not null then
    select user_id into v_parent_author from public.blog_comments where id = NEW.parent_id;
    perform public.create_notification(v_parent_author, 'comment_reply', 'Nova resposta no blog', 'Alguém respondeu ao seu comentário em um blog.', NEW.user_id, v_href, jsonb_build_object('blog_id', NEW.blog_id, 'comment_id', NEW.id));
  else
    perform public.create_notification(v_blog_author, 'comment_reply', 'Novo comentário no seu blog', 'Alguém comentou em uma publicação sua.', NEW.user_id, v_href, jsonb_build_object('blog_id', NEW.blog_id, 'comment_id', NEW.id));
  end if;
  for v_mentioned in select distinct lower((regexp_matches(NEW.body, '@([A-Za-z0-9_]{3,24})', 'gi'))[1]) as username loop
    select id into v_mentioned_id from public.profiles where lower(username) = v_mentioned.username limit 1;
    if v_mentioned_id is not null and exists (select 1 from public.profiles where id = v_mentioned_id and allow_mentions) then
      perform public.create_notification(v_mentioned_id, 'mention', 'Você foi mencionado em um comentário de blog', 'Alguém mencionou você em um comentário.', NEW.user_id, v_href, jsonb_build_object('blog_id', NEW.blog_id, 'comment_id', NEW.id));
    end if;
    v_mentioned_id := null;
  end loop;
  return NEW;
end;
$$;

drop trigger if exists notify_blog_comment_activity_trigger on public.blog_comments;
create trigger notify_blog_comment_activity_trigger after insert on public.blog_comments for each row execute procedure public.notify_blog_comment_activity();

create or replace function public.notify_blog_comment_like()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_comment record;
begin
  select user_id, blog_id into v_comment from public.blog_comments where id = NEW.blog_comment_id;
  perform public.create_notification(v_comment.user_id, 'comment_like', 'Comentário de blog curtido', 'Alguém curtiu seu comentário em um blog.', NEW.user_id, '?pagina=blogs&blog=' || v_comment.blog_id::text, jsonb_build_object('blog_id', v_comment.blog_id, 'comment_id', NEW.blog_comment_id));
  return NEW;
end;
$$;

drop trigger if exists notify_blog_comment_like_trigger on public.blog_comment_likes;
create trigger notify_blog_comment_like_trigger after insert on public.blog_comment_likes for each row execute procedure public.notify_blog_comment_like();

create or replace function public.notify_moderation_action()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_title text; v_body text;
begin
  v_title := case NEW.action when 'title' then 'Seu título foi atualizado' when 'silence' then 'Você foi silenciado' when 'unsilence' then 'Seu silêncio foi removido' when 'ban' then 'Sua conta foi suspensa' when 'unban' then 'Sua conta foi reativada' when 'hide' then 'Seu perfil foi ocultado' when 'unhide' then 'Seu perfil voltou a ficar visível' else 'Atualização de moderação' end;
  v_body := case NEW.action when 'title' then 'A equipe atualizou o título do seu perfil.' when 'silence' then 'Você não poderá comentar até o fim do período aplicado.' when 'unsilence' then 'Você pode comentar novamente.' else 'Uma ação de moderação foi aplicada à sua conta.' end;
  perform public.create_notification(NEW.target_id, 'moderation', v_title, v_body, NEW.actor_id, null, jsonb_build_object('action', NEW.action));
  return NEW;
end;
$$;

drop trigger if exists notify_moderation_action_trigger on public.moderation_actions;
create trigger notify_moderation_action_trigger after insert on public.moderation_actions for each row execute procedure public.notify_moderation_action();

-- O histórico interno substitui a notificação pública das ações de moderação.
create or replace function public.notify_moderation_action()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  return NEW;
end;
$$;

insert into storage.buckets (id, name, public) values ('publisher-covers', 'publisher-covers', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('faction-abafac', 'faction-abafac', true) on conflict (id) do nothing;
drop policy if exists "publisher covers are public" on storage.objects;
drop policy if exists "moderators upload publisher covers" on storage.objects;
drop policy if exists "moderators update publisher covers" on storage.objects;
drop policy if exists "blog images are public" on storage.objects;
drop policy if exists "users upload blog images" on storage.objects;
drop policy if exists "users update own blog images" on storage.objects;
drop policy if exists "users delete own blog images" on storage.objects;
create policy "blog images are public" on storage.objects for select using (bucket_id = 'blog-images');
create policy "users upload blog images" on storage.objects for insert with check (bucket_id = 'blog-images' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "users update own blog images" on storage.objects for update using (bucket_id = 'blog-images' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "users delete own blog images" on storage.objects for delete using (bucket_id = 'blog-images' and auth.uid()::text = (storage.foldername(name))[1]);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and plan = 'admin') $$;

create or replace function public.is_legendary_sunday()
returns boolean language sql stable
as $$ select extract(dow from timezone('America/Sao_Paulo', now())) = 0 $$;
grant execute on function public.is_legendary_sunday() to anon, authenticated;

create or replace function public.is_legendary_event_active()
returns boolean language sql stable security definer set search_path = public
as $$
  select (
    extract(dow from timezone('America/Sao_Paulo', now())) = 0
    and exists (
      select 1 from public.homepage_settings
      where id = true and legendary_sunday_enabled
    )
  ) or exists (
    select 1 from public.homepage_settings
    where id = true
      and extract(dow from timezone('America/Sao_Paulo', now())) <> 0
      and legendary_manual_date = timezone('America/Sao_Paulo', now())::date
  )
$$;
grant execute on function public.is_legendary_event_active() to anon, authenticated;

create or replace function public.update_homepage_section_order(p_order jsonb)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_required jsonb := '["recommendations", "character-banner", "continue", "recent", "new-series", "monthly", "pinned-publishers", "best-series", "featured-collections", "random", "tips", "artist", "random-publisher", "downloads", "most-read-covers", "editorial-banner"]'::jsonb;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and plan in ('banca', 'admin')
  ) then
    raise exception 'Apenas usuários banca ou administradores podem reorganizar a página inicial';
  end if;
  if jsonb_typeof(p_order) <> 'array' or jsonb_array_length(p_order) <> jsonb_array_length(v_required) then
    raise exception 'A ordem da página inicial é inválida';
  end if;
  if not (p_order @> v_required) or (select count(*) from jsonb_array_elements_text(p_order)) <> (select count(distinct value) from jsonb_array_elements_text(p_order)) then
    raise exception 'A ordem da página inicial é inválida';
  end if;
  update public.homepage_settings set section_order = p_order, updated_at = now() where id = true;
end;
$$;
grant execute on function public.update_homepage_section_order(jsonb) to authenticated;

create or replace function public.update_homepage_section_visibility(p_section_key text, p_hidden boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_required jsonb := '["recommendations", "character-banner", "continue", "recent", "new-series", "monthly", "pinned-publishers", "best-series", "featured-collections", "random", "tips", "artist", "random-publisher", "downloads", "most-read-covers", "editorial-banner"]'::jsonb;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and plan in ('banca', 'admin')) then
    raise exception 'Apenas usuários banca ou administradores podem ocultar seções da página inicial';
  end if;
  if p_section_key is null or not (v_required @> jsonb_build_array(p_section_key)) then
    raise exception 'Seção da página inicial inválida';
  end if;
  update public.homepage_settings
  set hidden_sections = case
    when coalesce(p_hidden, false) then (
      select jsonb_agg(value order by value)
      from (
        select distinct value
        from jsonb_array_elements_text(coalesce(hidden_sections, '[]'::jsonb))
        union
        select p_section_key
      ) entries
    )
    else (
      select coalesce(jsonb_agg(value order by value), '[]'::jsonb)
      from jsonb_array_elements_text(coalesce(hidden_sections, '[]'::jsonb))
      where value <> p_section_key
    )
  end,
  updated_at = now()
  where id = true;
end;
$$;
grant execute on function public.update_homepage_section_visibility(text, boolean) to authenticated;

create or replace function public.set_legendary_sunday_enabled(p_enabled boolean)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Apenas administradores podem alterar o Domingo lendário'; end if;
  update public.homepage_settings
  set legendary_sunday_enabled = coalesce(p_enabled, true), updated_at = now()
  where id = true;
end;
$$;
grant execute on function public.set_legendary_sunday_enabled(boolean) to authenticated;

create or replace function public.set_legendary_event_override(p_enabled boolean)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Apenas administradores podem ativar o evento em outro dia'; end if;
  update public.homepage_settings
  set legendary_manual_date = case when coalesce(p_enabled, false) then timezone('America/Sao_Paulo', now())::date else null end,
      updated_at = now()
  where id = true;
end;
$$;
grant execute on function public.set_legendary_event_override(boolean) to authenticated;

create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and plan in ('moderator', 'banca', 'admin')) $$;

create schema if not exists private;
create table if not exists private.anti_spam_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null check (channel in ('comment', 'chat')),
  body_fingerprint text not null,
  created_at timestamptz not null default now()
);
create index if not exists anti_spam_events_user_channel_created_idx on private.anti_spam_events (user_id, channel, created_at desc);
create index if not exists anti_spam_events_user_fingerprint_created_idx on private.anti_spam_events (user_id, body_fingerprint, created_at desc);
revoke all on table private.anti_spam_events from anon, authenticated;
alter table private.anti_spam_events enable row level security;

create or replace function public.can_post_content(p_channel text, p_body text)
returns boolean language plpgsql volatile security definer set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid(); v_plan text; v_created_at timestamptz; v_now timestamptz := now();
  v_fingerprint text := md5(lower(regexp_replace(coalesce(trim(p_body), ''), '\\s+', ' ', 'g')));
  v_limit integer := case when p_channel = 'chat' then 12 else 5 end;
  v_recent_count integer; v_duplicate_count integer; v_last_at timestamptz; v_violation_count integer; v_silence interval;
begin
  if v_user_id is null or p_channel not in ('comment', 'chat') or length(trim(coalesce(p_body, ''))) = 0 then return false; end if;
  select plan, created_at into v_plan, v_created_at from public.profiles where id = v_user_id;
  if not found or v_plan in ('moderator', 'banca', 'admin') then return found; end if;
  if exists (select 1 from public.profiles where id = v_user_id and (is_banned or (silenced_until is not null and silenced_until > v_now))) then return false; end if;
  select count(*), max(created_at) into v_recent_count, v_last_at from private.anti_spam_events where user_id = v_user_id and channel = p_channel and created_at > v_now - interval '1 minute';
  select count(*) into v_duplicate_count from private.anti_spam_events where user_id = v_user_id and channel = p_channel and body_fingerprint = v_fingerprint and created_at > v_now - interval '10 minutes';
  if v_created_at > v_now - interval '24 hours' and v_last_at is not null and v_last_at > v_now - interval '30 seconds' then return false; end if;
  if v_duplicate_count >= 1 then return false; end if;
  if v_recent_count >= v_limit then
    select count(*) into v_violation_count from private.anti_spam_events where user_id = v_user_id and channel = p_channel and created_at > v_now - interval '24 hours' and (body_fingerprint = v_fingerprint or created_at > v_now - interval '1 minute');
    v_silence := case when v_violation_count >= 40 then interval '24 hours' when v_violation_count >= 20 then interval '2 hours' when v_violation_count >= 10 then interval '30 minutes' else interval '5 minutes' end;
    update public.profiles set silenced_until = greatest(coalesce(silenced_until, v_now), v_now + v_silence) where id = v_user_id;
  end if;
  insert into private.anti_spam_events(user_id, channel, body_fingerprint) values (v_user_id, p_channel, v_fingerprint);
  return true;
end;
$$;
revoke all on function public.can_post_content(text, text) from public, anon;
grant execute on function public.can_post_content(text, text) to authenticated;

create or replace function public.can_comment()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and not is_banned and (silenced_until is null or silenced_until <= now())) $$;

create or replace function public.can_customize_covers()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and (plan in ('premium', 'moderator', 'admin') or (plan = 'free' and public.is_legendary_event_active()))) $$;

create or replace function public.can_apply_cover_style(p_style text)
returns boolean language sql stable security definer set search_path = public
as $$
  select auth.uid() is not null
    and (
      p_style = 'grayscale'
      or exists (select 1 from public.profiles where id = auth.uid() and (plan in ('premium', 'moderator', 'admin') or (plan = 'free' and public.is_legendary_event_active())))
    )
$$;

create policy "publisher covers are public" on storage.objects for select using (bucket_id = 'publisher-covers');
create policy "moderators upload publisher covers" on storage.objects for insert with check (bucket_id = 'publisher-covers' and public.is_moderator() and auth.uid()::text = (storage.foldername(name))[1]);
create policy "moderators update publisher covers" on storage.objects for update using (bucket_id = 'publisher-covers' and public.is_moderator() and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "faction abafacs are public" on storage.objects;
drop policy if exists "faction managers upload abafacs" on storage.objects;
drop policy if exists "faction managers delete abafacs" on storage.objects;
create policy "faction abafacs are public" on storage.objects for select using (bucket_id = 'faction-abafac');
create policy "faction managers upload abafacs" on storage.objects for insert with check (
  bucket_id = 'faction-abafac'
  and auth.uid()::text = (storage.foldername(name))[2]
  and exists (select 1 from public.faction_roles where user_id = auth.uid() and faction_id = (storage.foldername(name))[1] and role in ('leader', 'curator'))
);
create policy "faction managers delete abafacs" on storage.objects for delete using (
  bucket_id = 'faction-abafac'
  and exists (select 1 from public.faction_roles where user_id = auth.uid() and faction_id = (storage.foldername(name))[1] and role in ('leader', 'curator'))
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, account_email, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)), new.email,
    'https://api.dicebear.com/9.x/thumbs/svg?seed=' || new.id::text || '&backgroundColor=f3f4f6&shapeColor=e85b68');
  insert into public.profile_follows (follower_id, following_id)
  select new.id, profile.id
  from public.profiles profile
  where profile.plan = 'banca' and profile.id <> new.id
  on conflict (follower_id, following_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.get_login_email(p_username text)
returns text language sql security definer set search_path = public
as $$ select account_email from public.profiles where lower(username) = lower(p_username) limit 1 $$;
grant execute on function public.get_login_email(text) to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.publisher_settings enable row level security;
alter table public.homepage_settings enable row level security;
alter table public.homepage_banners enable row level security;
alter table public.blog_posts enable row level security;
alter table public.blog_likes enable row level security;
alter table public.blog_comments enable row level security;
alter table public.blog_comment_likes enable row level security;
alter table public.blog_saves enable row level security;
alter table public.profile_follows enable row level security;
alter table public.profile_blocks enable row level security;
alter table public.notifications enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_pins enable row level security;
alter table public.chat_room_sheriffs enable row level security;
alter table public.chat_rooms enable row level security;
alter table public.favorites enable row level security;
alter table public.publisher_saves enable row level security;
alter table public.imprint_settings enable row level security;
alter table public.imprint_saves enable row level security;
alter table public.character_settings enable row level security;
alter table public.character_saves enable row level security;
alter table public.comic_cover_variants enable row level security;
alter table public.catalog_item_visibility enable row level security;
alter table public.user_cover_choices enable row level security;
alter table public.user_cover_styles enable row level security;
alter table public.user_series_cover_choices enable row level security;
alter table public.comic_likes enable row level security;
alter table public.reading_progress enable row level security;
alter table public.comic_read_counts enable row level security;
alter table public.comic_monthly_read_counts enable row level security;
alter table public.comic_download_counts enable row level security;
alter table public.shelf_collections enable row level security;
alter table public.shelf_collection_likes enable row level security;
alter table public.comments enable row level security;
alter table public.comment_likes enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.bot_actions enable row level security;
alter table public.file_reports enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.profile_xp_events enable row level security;

drop policy if exists "profiles are public" on public.profiles;
drop policy if exists "catalog item visibility is public" on public.catalog_item_visibility;
drop policy if exists "admins manage catalog item visibility" on public.catalog_item_visibility;
create policy "catalog item visibility is public" on public.catalog_item_visibility for select using (true);
create policy "admins manage catalog item visibility" on public.catalog_item_visibility for all using (public.is_admin()) with check (public.is_admin());
grant select on public.catalog_item_visibility to anon, authenticated;
grant insert, update, delete on public.catalog_item_visibility to authenticated;
drop policy if exists "publisher settings are public" on public.publisher_settings;
drop policy if exists "moderators manage publisher settings" on public.publisher_settings;
drop policy if exists "homepage settings are public" on public.homepage_settings;
drop policy if exists "homepage banners are public" on public.homepage_banners;
drop policy if exists "admins manage homepage banners" on public.homepage_banners;
drop policy if exists "published blogs are public" on public.blog_posts;
drop policy if exists "authors manage own blogs" on public.blog_posts;
drop policy if exists "moderators manage blogs" on public.blog_posts;
drop policy if exists "blog likes are public" on public.blog_likes;
drop policy if exists "users manage own blog likes" on public.blog_likes;
drop policy if exists "blog comments are public" on public.blog_comments;
drop policy if exists "users create blog comments" on public.blog_comments;
drop policy if exists "users delete own blog comments" on public.blog_comments;
drop policy if exists "blog comment likes are public" on public.blog_comment_likes;
drop policy if exists "users manage blog comment likes" on public.blog_comment_likes;
drop policy if exists "blog saves are visible" on public.blog_saves;
drop policy if exists "users manage own blog saves" on public.blog_saves;
drop policy if exists "profile follows are public" on public.profile_follows;
drop policy if exists "users manage own follows" on public.profile_follows;
drop policy if exists "users read own profile blocks" on public.profile_blocks;
drop policy if exists "users create profile blocks" on public.profile_blocks;
drop policy if exists "users delete profile blocks" on public.profile_blocks;
drop policy if exists "users read own notifications" on public.notifications;
drop policy if exists "users update own notifications" on public.notifications;
drop policy if exists "admins insert notifications" on public.notifications;
drop policy if exists "participants read chat messages" on public.chat_messages;
drop policy if exists "users send chat messages" on public.chat_messages;
drop policy if exists "participants delete chat messages" on public.chat_messages;
drop policy if exists "chat rooms are visible to members" on public.chat_rooms;
drop policy if exists "active chat pins are visible to members" on public.chat_pins;
drop policy if exists "users update own profile" on public.profiles;
drop policy if exists "users read own favorites" on public.favorites;
drop policy if exists "favorites are public" on public.favorites;
drop policy if exists "users manage own favorites" on public.favorites;
drop policy if exists "publisher saves are public" on public.publisher_saves;
drop policy if exists "users manage own publisher saves" on public.publisher_saves;
drop policy if exists "imprint settings are public" on public.imprint_settings;
drop policy if exists "moderators manage imprint settings" on public.imprint_settings;
drop policy if exists "imprint saves are public" on public.imprint_saves;
drop policy if exists "users manage own imprint saves" on public.imprint_saves;
drop policy if exists "character settings are public" on public.character_settings;
drop policy if exists "moderators manage character settings" on public.character_settings;
drop policy if exists "character saves are public" on public.character_saves;
drop policy if exists "users manage own character saves" on public.character_saves;
drop policy if exists "cover variants are public" on public.comic_cover_variants;
drop policy if exists "admins manage cover variants" on public.comic_cover_variants;
drop policy if exists "cover choices are public" on public.user_cover_choices;
drop policy if exists "premium users manage own cover choices" on public.user_cover_choices;
drop policy if exists "cover styles are public" on public.user_cover_styles;
drop policy if exists "premium users manage own cover styles" on public.user_cover_styles;
drop policy if exists "users manage own cover styles" on public.user_cover_styles;
drop policy if exists "series cover choices are public" on public.user_series_cover_choices;
drop policy if exists "users manage own series cover choices" on public.user_series_cover_choices;
drop policy if exists "comic likes are public" on public.comic_likes;
drop policy if exists "users manage own comic likes" on public.comic_likes;
drop policy if exists "reading progress is public" on public.reading_progress;
drop policy if exists "users manage own reading progress" on public.reading_progress;
drop policy if exists "comic read counts are public" on public.comic_read_counts;
drop policy if exists "comic monthly read counts are public" on public.comic_monthly_read_counts;
drop policy if exists "comic download counts are public" on public.comic_download_counts;
drop policy if exists "public collections are visible" on public.shelf_collections;
drop policy if exists "owners manage collections" on public.shelf_collections;
drop policy if exists "moderators feature collections" on public.shelf_collections;
drop policy if exists "admins delete public collections" on public.shelf_collections;
drop policy if exists "staff delete public collections" on public.shelf_collections;
drop policy if exists "collection likes are public" on public.shelf_collection_likes;
drop policy if exists "users manage collection likes" on public.shelf_collection_likes;
drop policy if exists "comments are public" on public.comments;
drop policy if exists "users create own comments" on public.comments;
drop policy if exists "users delete own comments" on public.comments;
drop policy if exists "comment likes are public" on public.comment_likes;
drop policy if exists "users manage comment likes" on public.comment_likes;
drop policy if exists "moderation history visible to moderators" on public.moderation_actions;
drop policy if exists "moderators create moderation history" on public.moderation_actions;
drop policy if exists "staff read bot actions" on public.bot_actions;
drop policy if exists "admins review bot actions" on public.bot_actions;
drop policy if exists "moderators review bot actions" on public.bot_actions;
drop policy if exists "users create file reports" on public.file_reports;
drop policy if exists "reporters read own file reports" on public.file_reports;
drop policy if exists "reporters reopen own file reports" on public.file_reports;
drop policy if exists "staff read file reports" on public.file_reports;
drop policy if exists "staff review file reports" on public.file_reports;
drop policy if exists "achievements are public" on public.achievements;
drop policy if exists "user achievements are public" on public.user_achievements;
drop policy if exists "admins manage achievements" on public.achievements;
drop policy if exists "admins award achievements" on public.user_achievements;

create policy "profiles are public" on public.profiles for select using (
  (not public.is_blocked_between(id) and (not profile_hidden or auth.uid() = id or public.is_moderator()))
  or exists (select 1 from public.profile_blocks where blocker_id = auth.uid() and blocked_id = id)
);
-- Keep the login lookup in get_login_email(), but never expose the account
-- email as a selectable column through the public Data API.
revoke select (account_email) on public.profiles from anon, authenticated;
create policy "publisher settings are public" on public.publisher_settings for select using (true);
create policy "moderators manage publisher settings" on public.publisher_settings for all using (public.is_moderator()) with check (public.is_moderator());
create policy "homepage settings are public" on public.homepage_settings for select using (true);
create policy "homepage banners are public" on public.homepage_banners for select using (is_active = true or public.is_admin());
create policy "admins manage homepage banners" on public.homepage_banners for all using (public.is_admin()) with check (public.is_admin());
create policy "published blogs are public" on public.blog_posts for select using (status = 'published' or auth.uid() = author_id or public.is_moderator());
create policy "authors manage own blogs" on public.blog_posts for all using (auth.uid() = author_id) with check (auth.uid() = author_id and is_featured = false);
create policy "moderators manage blogs" on public.blog_posts for all using (public.is_moderator()) with check (public.is_moderator());
create policy "blog likes are public" on public.blog_likes for select using (auth.uid() = user_id or not public.is_blocked_between(user_id));
create policy "users manage own blog likes" on public.blog_likes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "blog comments are public" on public.blog_comments for select using (auth.uid() = user_id or not public.is_blocked_between(user_id));
create policy "users create blog comments" on public.blog_comments for insert with check (auth.uid() = user_id and public.can_post_content('comment', body));
create policy "users delete own blog comments" on public.blog_comments for delete using (auth.uid() = user_id or public.is_moderator());
create policy "blog comment likes are public" on public.blog_comment_likes for select using (true);
create policy "users manage blog comment likes" on public.blog_comment_likes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "blog saves are visible" on public.blog_saves for select using (auth.uid() = user_id or (not public.is_blocked_between(user_id) and exists (select 1 from public.profiles where id = user_id and shelf_blogs_public)));
create policy "users manage own blog saves" on public.blog_saves for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "profile follows are public" on public.profile_follows for select using (not public.is_blocked_between(follower_id) and not public.is_blocked_between(following_id));
create policy "users manage own follows" on public.profile_follows for all using (auth.uid() = follower_id) with check (auth.uid() = follower_id and follower_id <> following_id);
create policy "users read own profile blocks" on public.profile_blocks for select using (auth.uid() = blocker_id or auth.uid() = blocked_id or public.is_moderator());
create policy "users create profile blocks" on public.profile_blocks for insert with check (auth.uid() = blocker_id and blocker_id <> blocked_id);
create policy "users delete profile blocks" on public.profile_blocks for delete using (auth.uid() = blocker_id);
create policy "users read own notifications" on public.notifications for select using (auth.uid() = user_id);
create policy "users update own notifications" on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "admins insert notifications" on public.notifications for insert with check (public.is_admin());
create policy "chat rooms are visible to members" on public.chat_rooms for select using (public.can_access_chat_room(id));
create policy "participants read chat messages" on public.chat_messages for select using (
  expires_at > now() and (
    (room_id is null and (auth.uid() = sender_id or auth.uid() = recipient_id))
    or (room_id is not null and public.can_access_chat_room(room_id))
  )
);
create policy "users send chat messages" on public.chat_messages for insert with check (
  auth.uid() = sender_id
  and public.can_post_content('chat', body)
  and expires_at <= now() + interval '24 hours'
  and expires_at > now()
  and (
    (room_id is null and recipient_id is not null and auth.uid() <> recipient_id and not public.is_blocked_between(recipient_id) and exists (select 1 from public.profiles where id = recipient_id and allow_messages))
    or (room_id is not null and recipient_id is null and public.can_access_chat_room(room_id))
  )
);

create policy "participants delete chat messages" on public.chat_messages for delete using (auth.uid() = sender_id or auth.uid() = recipient_id or public.is_moderator() or public.is_chat_room_sheriff(room_id));
create policy "active chat pins are visible to members" on public.chat_pins for select using (
  (expires_at is null or expires_at > now()) and public.can_access_chat_room(room_id)
);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "admins update user plans" on public.profiles;
create policy "admins update user plans" on public.profiles for update using (public.is_admin()) with check (public.is_admin());
create policy "favorites are public" on public.favorites for select using (
  auth.uid() = user_id or (not public.is_blocked_between(user_id) and exists (select 1 from public.profiles where id = user_id and likes_public))
);
create policy "users manage own favorites" on public.favorites for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "publisher saves are public" on public.publisher_saves for select using (auth.uid() = user_id or not public.is_blocked_between(user_id));
create policy "users manage own publisher saves" on public.publisher_saves for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "imprint settings are public" on public.imprint_settings for select using (true);
create policy "moderators manage imprint settings" on public.imprint_settings for all using (public.is_moderator()) with check (public.is_moderator());
create policy "imprint saves are public" on public.imprint_saves for select using (auth.uid() = user_id or not public.is_blocked_between(user_id));
create policy "users manage own imprint saves" on public.imprint_saves for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "character settings are public" on public.character_settings for select using (true);
create policy "moderators manage character settings" on public.character_settings for all using (public.is_moderator()) with check (public.is_moderator());
create policy "character saves are public" on public.character_saves for select using (auth.uid() = user_id or not public.is_blocked_between(user_id));
create policy "users manage own character saves" on public.character_saves for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select on public.character_settings to anon, authenticated;
grant select, insert, update, delete on public.character_settings to authenticated;
grant select, insert, update, delete on public.character_saves to authenticated;
create policy "cover variants are public" on public.comic_cover_variants for select using (true);
create policy "admins manage cover variants" on public.comic_cover_variants for all using (public.is_admin()) with check (public.is_admin());
create policy "cover choices are public" on public.user_cover_choices for select using (auth.uid() = user_id or not public.is_blocked_between(user_id));
create policy "premium users manage own cover choices" on public.user_cover_choices for all using (auth.uid() = user_id and public.can_customize_covers()) with check (auth.uid() = user_id and public.can_customize_covers());
create policy "cover styles are public" on public.user_cover_styles for select using (auth.uid() = user_id or not public.is_blocked_between(user_id));
create policy "users manage own cover styles" on public.user_cover_styles for all using (auth.uid() = user_id) with check (auth.uid() = user_id and public.can_apply_cover_style(style));
create policy "series cover choices are public" on public.user_series_cover_choices for select using (auth.uid() = user_id or not public.is_blocked_between(user_id));
create policy "users manage own series cover choices" on public.user_series_cover_choices for all using (auth.uid() = user_id) with check (auth.uid() = user_id and (not is_variant or public.can_customize_covers()));
create policy "comic likes are public" on public.comic_likes for select using (
  auth.uid() = user_id or (not public.is_blocked_between(user_id) and exists (select 1 from public.profiles where id = user_id and likes_public))
);
create policy "users manage own comic likes" on public.comic_likes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "reading progress is public" on public.reading_progress for select using (auth.uid() = user_id or not public.is_blocked_between(user_id));
create policy "users manage own reading progress" on public.reading_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "comic read counts are public" on public.comic_read_counts for select using (true);
create policy "comic monthly read counts are public" on public.comic_monthly_read_counts for select using (true);
create policy "comic download counts are public" on public.comic_download_counts for select using (true);

create or replace function public.increment_comic_read(p_item_id text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clicks bigint;
  v_month_start date := date_trunc('month', now())::date;
begin
  if p_item_id is null or length(trim(p_item_id)) = 0 or length(p_item_id) > 200 then
    raise exception 'Invalid comic item id';
  end if;

  insert into public.comic_read_counts (item_id, clicks, updated_at)
  values (p_item_id, 1, now())
  on conflict (item_id) do update
    set clicks = public.comic_read_counts.clicks + 1,
        updated_at = now()
  returning clicks into v_clicks;

  insert into public.comic_monthly_read_counts (item_id, month_start, clicks, updated_at)
  values (p_item_id, v_month_start, 1, now())
  on conflict (item_id, month_start) do update
    set clicks = public.comic_monthly_read_counts.clicks + 1,
        updated_at = now();

  return v_clicks;
end;
$$;
grant execute on function public.increment_comic_read(text) to anon, authenticated;

create or replace function public.increment_comic_download(p_item_id text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_downloads bigint;
begin
  if p_item_id is null or length(trim(p_item_id)) = 0 or length(p_item_id) > 200 then
    raise exception 'Invalid comic item id';
  end if;

  insert into public.comic_download_counts (item_id, downloads, updated_at)
  values (p_item_id, 1, now())
  on conflict (item_id) do update
    set downloads = public.comic_download_counts.downloads + 1,
        updated_at = now()
  returning downloads into v_downloads;

  return v_downloads;
end;
$$;
grant execute on function public.increment_comic_download(text) to anon, authenticated;
create policy "public collections are visible" on public.shelf_collections for select using ((is_public and not public.is_blocked_between(owner_id)) or auth.uid() = owner_id);
create policy "owners manage collections" on public.shelf_collections for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "moderators feature collections" on public.shelf_collections for update using (public.is_moderator()) with check (public.is_moderator());
create policy "staff delete public collections" on public.shelf_collections for delete using (public.is_moderator() and is_public);
create policy "collection likes are public" on public.shelf_collection_likes for select using (
  not public.is_blocked_between(owner_id) and
  exists (
    select 1 from public.shelf_collections collection
    where collection.id = shelf_collection_likes.collection_id
      and collection.owner_id = shelf_collection_likes.owner_id
      and collection.is_public
  )
);
create policy "users manage collection likes" on public.shelf_collection_likes for all
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id and exists (
    select 1 from public.shelf_collections collection
    where collection.id = shelf_collection_likes.collection_id
      and collection.owner_id = shelf_collection_likes.owner_id
      and collection.is_public
  )
);
create policy "comments are public" on public.comments for select using (auth.uid() = user_id or not public.is_blocked_between(user_id));
create policy "users create own comments" on public.comments for insert with check (auth.uid() = user_id and public.can_post_content('comment', body));
create policy "users delete own comments" on public.comments for delete using (auth.uid() = user_id or public.is_moderator());
create policy "comment likes are public" on public.comment_likes for select using (true);
create policy "users manage comment likes" on public.comment_likes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "moderation history visible to moderators" on public.moderation_actions for select using (public.is_moderator());
create policy "moderators create moderation history" on public.moderation_actions for insert with check (public.is_moderator() and auth.uid() = actor_id);
create policy "staff read bot actions" on public.bot_actions for select using (public.is_moderator());
create policy "moderators review bot actions" on public.bot_actions for update using (public.is_moderator()) with check (public.is_moderator());
create policy "users create file reports" on public.file_reports for insert to authenticated with check (auth.uid() = reporter_id and source = 'user' and bot_name is null);
create policy "reporters read own file reports" on public.file_reports for select using (auth.uid() = reporter_id);
create policy "reporters reopen own file reports" on public.file_reports for update using (auth.uid() = reporter_id and status in ('resolved', 'ignored')) with check (auth.uid() = reporter_id and status = 'pending' and reviewed_by is null and reviewed_at is null);
create policy "staff read file reports" on public.file_reports for select using (public.is_moderator());
create policy "staff review file reports" on public.file_reports for update using (public.is_moderator()) with check (public.is_moderator());
create policy "achievements are public" on public.achievements for select using (true);
create policy "user achievements are public" on public.user_achievements for select using (auth.uid() = user_id or not public.is_blocked_between(user_id));
create policy "admins manage achievements" on public.achievements for all using (public.is_admin()) with check (public.is_admin());
create policy "admins award achievements" on public.user_achievements for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.send_notification_to_all(p_title text, p_body text, p_type text default 'announcement')
returns integer language plpgsql security definer set search_path = public
as $$
declare v_count integer;
begin
  if not public.is_admin() then raise exception 'Apenas administradores podem enviar notificações globais'; end if;
  insert into public.notifications(user_id, type, title, body, metadata)
  select id, p_type, left(trim(p_title), 120), left(trim(p_body), 500), jsonb_build_object('broadcast', true)
  from public.profiles
  where trim(p_title) <> '' and trim(p_body) <> '';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
grant execute on function public.send_notification_to_all(text, text, text) to authenticated;

-- Atualiza a atividade; a exclusão definitiva da conta auth deve ser feita por Edge Function com secret key.
create or replace function public.profile_level_for_xp(p_xp integer)
returns integer language sql immutable as $$
  select greatest(1, floor(sqrt(greatest(coalesce(p_xp, 0), 0)::numeric / 100))::integer + 1)
$$;

create or replace function public.grant_profile_xp(p_event_type text, p_event_key text default null)
returns integer language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_xp integer;
  v_key text;
  v_total integer;
begin
  if v_user_id is null or not exists (select 1 from public.profiles where id = v_user_id) then return 0; end if;
  v_xp := case p_event_type
    when 'read' then 10
    when 'curated_read' then 25
    when 'comment' then 5
    when 'like' then 2
    when 'chat' then 3
    when 'blog' then 8
    when 'follow' then 2
    else 0
  end;
  if v_xp <= 0 then return 0; end if;
  v_key := coalesce(nullif(trim(p_event_key), ''), p_event_type || ':' || clock_timestamp()::text);
  insert into public.profile_xp_events(user_id, event_type, event_key, xp)
  values (v_user_id, p_event_type, v_key, v_xp)
  on conflict (user_id, event_key) do nothing;
  if not found then
    select xp into v_total from public.profiles where id = v_user_id;
    return coalesce(v_total, 0);
  end if;
  update public.profiles
  set xp = xp + v_xp,
      level = public.profile_level_for_xp(xp + v_xp)
  where id = v_user_id
  returning xp into v_total;
  return coalesce(v_total, 0);
end;
$$;
grant execute on function public.grant_profile_xp(text, text) to authenticated;

create or replace function public.daily_profile_checkin()
returns table(awarded_xp integer, streak integer, total_xp integer, current_level integer)
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_streak integer;
  v_award integer;
  v_inserted boolean := false;
begin
  if v_user_id is null then return; end if;
  select * into v_profile from public.profiles where id = v_user_id;
  if not found then return; end if;
  if v_profile.last_checkin_at is not null and v_profile.last_checkin_at::date = current_date then
    awarded_xp := 0; streak := coalesce(v_profile.daily_streak, 0); total_xp := v_profile.xp; current_level := v_profile.level; return next; return;
  end if;
  v_streak := case
    when v_profile.last_checkin_at is not null and v_profile.last_checkin_at::date = current_date - 1 then coalesce(v_profile.daily_streak, 0) + 1
    else 1
  end;
  v_award := 20 + least(v_streak * 5, 30);
  insert into public.profile_xp_events(user_id, event_type, event_key, xp)
  values (v_user_id, 'checkin', 'checkin:' || current_date::text, v_award)
  on conflict (user_id, event_key) do nothing;
  v_inserted := found;
  if v_inserted then
    update public.profiles
    set xp = xp + v_award,
        level = public.profile_level_for_xp(xp + v_award),
        daily_streak = v_streak,
        last_checkin_at = now()
    where id = v_user_id
    returning xp, level into total_xp, current_level;
  else
    select xp, level into total_xp, current_level from public.profiles where id = v_user_id;
  end if;
  awarded_xp := case when v_inserted then v_award else 0 end;
  streak := v_streak;
  return next;
end;
$$;
grant execute on function public.daily_profile_checkin() to authenticated;

create or replace function public.protect_profile_progress()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if current_user not in ('postgres', 'service_role') then
    new.xp := old.xp;
    new.level := old.level;
    new.daily_streak := old.daily_streak;
    new.last_checkin_at := old.last_checkin_at;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_progress_trigger on public.profiles;
create trigger protect_profile_progress_trigger
before update on public.profiles
for each row execute procedure public.protect_profile_progress();

create or replace function public.get_profile_ranking(p_period text default 'week', p_limit integer default 100)
returns table(
  user_id uuid,
  username text,
  avatar_url text,
  title text,
  title_color text,
  plan text,
  xp integer,
  level integer,
  last_seen_at timestamptz,
  period_xp bigint,
  ranking bigint,
  is_online boolean
)
language sql stable security definer set search_path = public
as $$
  with bounds as (
    select case lower(coalesce(p_period, 'week'))
      when 'day' then now() - interval '24 hours'
      when 'all' then '-infinity'::timestamptz
      else now() - interval '7 days'
    end as since_at
  ),
  activity as (
    select events.user_id, sum(events.xp)::bigint as period_xp
    from public.profile_xp_events events, bounds
    where events.created_at >= bounds.since_at
    group by events.user_id
  ),
  members as (
    select profile.id as user_id, profile.username, profile.avatar_url, profile.title, profile.title_color,
      profile.plan, profile.xp, profile.level, profile.last_seen_at,
      coalesce(activity.period_xp, 0)::bigint as period_xp
    from public.profiles profile
    left join activity on activity.user_id = profile.id
    where not profile.profile_hidden
  )
  select members.user_id, members.username, members.avatar_url, members.title, members.title_color,
    members.plan, members.xp, members.level, members.last_seen_at, members.period_xp,
    case when members.plan in ('free', 'premium') then rank() over (
      order by case when members.plan in ('free', 'premium') then members.period_xp end desc nulls last,
        case when members.plan in ('free', 'premium') then members.xp end desc nulls last,
        case when members.plan in ('free', 'premium') then members.username end asc
    ) end as ranking,
    members.last_seen_at >= now() - interval '5 minutes' as is_online
  from members
  order by members.period_xp desc, members.xp desc, members.username asc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;
grant execute on function public.get_profile_ranking(text, integer) to anon, authenticated;

create or replace function public.touch_profile()
returns void language sql security invoker as $$ update public.profiles set last_seen_at = now() where id = auth.uid(); $$;

insert into public.achievements (achievement_key, name, description, icon) values
  ('first_read', 'Primeira leitura', 'Abriu seu primeiro quadrinho.', '📖'),
  ('first_completed', 'Primeira conclusão', 'Concluiu todas as edições de uma série.', '🏁'),
  ('first_favorite', 'Primeiro favorito', 'Salvou sua primeira edição na estante.', '★'),
  ('first_comment', 'Voz da banca', 'Publicou seu primeiro comentário.', '💬'),
  ('five_completed', 'Maratona', 'Concluiu cinco séries.', '🏆')
on conflict (achievement_key) do update set name = excluded.name, description = excluded.description, icon = excluded.icon;

create or replace function public.award_achievement(p_key text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_achievement_id bigint;
  v_inserted_achievement bigint;
  v_allowed boolean := false;
begin
  select id into v_achievement_id from public.achievements where achievement_key = p_key;
  if v_achievement_id is null or auth.uid() is null then return; end if;
  v_allowed := case p_key
    when 'first_read' then exists (select 1 from public.reading_progress where user_id = auth.uid())
    when 'first_completed' then exists (select 1 from public.reading_progress where user_id = auth.uid() and completed)
    when 'first_favorite' then exists (select 1 from public.favorites where user_id = auth.uid())
    when 'first_comment' then exists (select 1 from public.comments where user_id = auth.uid())
    when 'five_completed' then (select count(*) >= 5 from public.reading_progress where user_id = auth.uid() and completed)
    else false
  end;
  if v_allowed then
    insert into public.user_achievements (user_id, achievement_id) values (auth.uid(), v_achievement_id) on conflict do nothing returning achievement_id into v_inserted_achievement;
    if v_inserted_achievement is not null then
      perform public.create_notification(auth.uid(), 'achievement', 'Nova conquista', 'Você desbloqueou uma nova conquista.', null, null, jsonb_build_object('achievement_id', v_achievement_id, 'achievement_key', p_key));
    end if;
  end if;
end;
$$;
grant execute on function public.award_achievement(text) to authenticated;

create or replace function public.set_user_plan(p_username text, p_plan text)
returns void language plpgsql security definer set search_path = public as $$
declare v_target public.profiles%rowtype;
begin
  if not public.is_moderator() then raise exception 'Apenas moderadores e administradores podem alterar planos'; end if;
  if p_plan not in ('free', 'premium', 'moderator', 'banca') then raise exception 'Plano inválido'; end if;
  if p_plan = 'banca' and not public.is_admin() then raise exception 'Apenas administradores podem promover integrantes da Banca'; end if;
  if p_plan = 'moderator' and not (public.is_admin() or exists (select 1 from public.profiles where id = auth.uid() and plan = 'banca')) then raise exception 'Apenas a Banca e administradores podem promover moderadores'; end if;
  select * into v_target from public.profiles where lower(username) = lower(trim(p_username));
  if not found then raise exception 'Usuário não encontrado'; end if;
  if v_target.plan = 'admin' and not public.is_admin() then raise exception 'Apenas administradores podem alterar administradores'; end if;
  if v_target.plan = 'banca' and not public.is_admin() then raise exception 'Apenas administradores podem alterar integrantes da Banca'; end if;
  if v_target.plan = 'moderator' and not (public.is_admin() or exists (select 1 from public.profiles where id = auth.uid() and plan = 'banca')) then raise exception 'Apenas a Banca e administradores podem alterar moderadores'; end if;
  -- Moderadores e administradores nÃ£o participam de facÃ§Ãµes. Ao promover
  -- um membro, remova tambÃ©m a associaÃ§Ã£o e qualquer cargo que ele possua.
  if p_plan in ('moderator', 'banca') and v_target.faction_id is not null then
    delete from public.faction_roles where user_id = v_target.id;
    delete from public.faction_memberships where user_id = v_target.id;
    update public.profiles
    set plan = p_plan,
        faction_id = null,
        faction_joined_at = null,
        faction_changed_at = null
    where id = v_target.id;
    perform public.ensure_faction_leadership(v_target.faction_id);
  else
    update public.profiles set plan = p_plan where id = v_target.id;
  end if;
  if v_target.plan is distinct from p_plan then
    perform public.create_notification(v_target.id, 'plan', 'Plano da conta atualizado', 'Seu plano mudou de ' || case v_target.plan when 'premium' then 'Lenda' when 'free' then 'Comum' when 'moderator' then 'Moderador' when 'admin' then 'Administrador' else v_target.plan end || ' para ' || case p_plan when 'premium' then 'Lenda' when 'free' then 'Comum' when 'moderator' then 'Moderador' when 'admin' then 'Administrador' else p_plan end || '.', auth.uid(), null, jsonb_build_object('old_plan', v_target.plan, 'new_plan', p_plan));
  end if;
end;
$$;
grant execute on function public.set_user_plan(text, text) to authenticated;

create or replace function public.moderate_user(p_username text, p_action text, p_duration text default null, p_title text default null, p_title_color text default null, p_reason text default null, p_internal_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_target public.profiles%rowtype;
  v_until timestamptz := null;
  v_reason text := nullif(left(trim(coalesce(p_reason, '')), 500), '');
  v_internal_note text := nullif(left(trim(coalesce(p_internal_note, '')), 1000), '');
begin
  if not public.is_moderator() then raise exception 'Apenas moderadores e administradores podem moderar'; end if;
  select * into v_target from public.profiles where lower(username) = lower(trim(p_username));
  if not found then raise exception 'Usuário não encontrado'; end if;
  if v_target.plan = 'admin' and not public.is_admin() then raise exception 'Apenas administradores podem moderar administradores'; end if;
  if v_target.plan = 'banca' and not public.is_admin() then raise exception 'Apenas administradores podem moderar integrantes da Banca'; end if;
  if v_target.plan = 'moderator' and not (public.is_admin() or exists (select 1 from public.profiles where id = auth.uid() and plan = 'banca')) then raise exception 'Apenas a Banca e administradores podem moderar moderadores'; end if;
  if p_action in ('ban', 'hide', 'silence') and not public.is_admin() and v_reason is null then raise exception 'Informe o motivo da ação'; end if;
  if p_action = 'silence' then
    v_until := case p_duration when '24h' then now() + interval '24 hours' when '3d' then now() + interval '3 days' when '1m' then now() + interval '1 month' else now() + interval '24 hours' end;
    update public.profiles set silenced_until = v_until where id = v_target.id;
  elsif p_action = 'unsilence' then update public.profiles set silenced_until = null where id = v_target.id;
  elsif p_action = 'ban' then update public.profiles set is_banned = true where id = v_target.id;
  elsif p_action = 'unban' then update public.profiles set is_banned = false where id = v_target.id;
  elsif p_action = 'hide' then update public.profiles set profile_hidden = true where id = v_target.id;
  elsif p_action = 'unhide' then update public.profiles set profile_hidden = false where id = v_target.id;
  elsif p_action = 'title' then update public.profiles set title = nullif(left(trim(p_title), 10), ''), title_color = coalesce(nullif(p_title_color, ''), title_color) where id = v_target.id;
  else raise exception 'Ação de moderação inválida';
  end if;
  insert into public.moderation_actions(actor_id, target_id, action, duration_until, reason, internal_note, details)
  values (auth.uid(), v_target.id, p_action, v_until, v_reason, v_internal_note, jsonb_build_object('duration', p_duration, 'title', p_title));
end;
$$;
grant execute on function public.moderate_user(text, text, text, text, text, text, text) to authenticated;

-- Facções da comunidade: temporadas, filiação, XP e troca semanal.
create table if not exists public.factions (
  id text primary key,
  page_key bigint,
  name text not null unique,
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  emblem text not null default '◆',
  description text not null default '',
  sort_order integer not null default 0,
  abafac_order jsonb not null default '["stats", "manifest", "mural", "missions", "achievements", "hall", "report", "leadership", "members"]'::jsonb,
  abafac_catalog_url text,
  publisher_name text
);

alter table public.factions add column if not exists page_key bigint;
alter table public.factions alter column page_key set default (100000000 + floor(random() * 900000000))::bigint;
do $$
declare
  v_faction record;
  v_page_key bigint;
begin
  for v_faction in select id from public.factions where page_key is null loop
    loop
      v_page_key := (100000000 + floor(random() * 900000000))::bigint;
      exit when not exists (select 1 from public.factions where page_key = v_page_key);
    end loop;
    update public.factions set page_key = v_page_key where id = v_faction.id;
  end loop;
end;
$$;
create unique index if not exists factions_page_key_unique on public.factions(page_key);
alter table public.factions alter column page_key set not null;

alter table public.factions add column if not exists abafac_order jsonb not null default '["stats", "manifest", "mural", "missions", "achievements", "hall", "report", "leadership", "members"]'::jsonb;
update public.factions
set abafac_order = coalesce((select jsonb_agg(item.value order by item.ordinality)
  from jsonb_array_elements(coalesce(abafac_order, '[]'::jsonb)) with ordinality item(value, ordinality)
  where item.value not in ('"agenda"'::jsonb, '"alliances"'::jsonb)), '[]'::jsonb)
where coalesce(abafac_order, '[]'::jsonb) ?| array['agenda', 'alliances'];
update public.factions
set abafac_order = coalesce((
  select jsonb_agg(item.value order by item.ordinality)
  from jsonb_array_elements(coalesce(public.factions.abafac_order, '[]'::jsonb)) with ordinality item(value, ordinality)
  where item.value <> '"showcase"'::jsonb
), '[]'::jsonb)
where coalesce(public.factions.abafac_order, '[]'::jsonb) ? 'showcase';
alter table public.factions add column if not exists abafac_catalog_url text;
alter table public.factions add column if not exists publisher_name text;
create unique index if not exists factions_publisher_name_unique on public.factions (lower(trim(publisher_name))) where nullif(trim(publisher_name), '') is not null;
alter table public.factions add column if not exists mural_notice text not null default '';
update public.factions
set abafac_order = jsonb_build_array('stats') || coalesce(abafac_order, '[]'::jsonb)
where not coalesce(abafac_order, '[]'::jsonb) ? 'stats';
alter table public.factions drop column if exists flag;

create table if not exists public.faction_catalogs (
  id bigint generated by default as identity primary key,
  faction_id text not null references public.factions(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  cover_url text,
  item_ids jsonb not null default '[]'::jsonb,
  is_featured boolean not null default false,
  sort_order text not null default 'added_desc' check (sort_order in ('added_desc', 'added_asc', 'title_asc', 'title_desc', 'likes_desc', 'likes_asc', 'reads_desc', 'reads_asc', 'year_desc', 'year_asc')),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.faction_catalogs add column if not exists sort_order text not null default 'added_desc';
alter table public.faction_catalogs add column if not exists is_featured boolean not null default false;
alter table public.faction_catalogs drop constraint if exists faction_catalogs_sort_order_check;
alter table public.faction_catalogs add constraint faction_catalogs_sort_order_check check (sort_order in ('added_desc', 'added_asc', 'title_asc', 'title_desc', 'likes_desc', 'likes_asc', 'reads_desc', 'reads_asc', 'year_desc', 'year_asc'));
create index if not exists faction_catalogs_faction_idx on public.faction_catalogs(faction_id, updated_at desc);

create table if not exists public.faction_catalog_likes (
  catalog_id bigint not null references public.faction_catalogs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (catalog_id, user_id)
);
create index if not exists faction_catalog_likes_catalog_idx on public.faction_catalog_likes(catalog_id);

create table if not exists public.faction_catalog_saves (
  catalog_id bigint not null references public.faction_catalogs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (catalog_id, user_id)
);
create index if not exists faction_catalog_saves_user_idx on public.faction_catalog_saves(user_id, created_at desc);

create or replace function public.save_faction_catalog(p_catalog_id bigint, p_faction_id text, p_name text, p_cover_url text, p_item_ids jsonb)
returns bigint language plpgsql security definer set search_path = public
as $$
declare v_id bigint;
begin
  if not exists (select 1 from public.faction_roles where user_id = auth.uid() and faction_id = p_faction_id and role in ('leader', 'curator')) then
    raise exception 'Apenas líderes e curadores podem editar o catálogo da facção';
  end if;
  if not exists (select 1 from public.factions where id = p_faction_id) then raise exception 'Facção não encontrada'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 1 then raise exception 'Informe o nome do catálogo'; end if;
  if jsonb_typeof(coalesce(p_item_ids, '[]'::jsonb)) <> 'array' then raise exception 'As edições do catálogo são inválidas'; end if;
  if p_catalog_id is not null then
    update public.faction_catalogs set name = left(trim(p_name), 60), cover_url = nullif(trim(coalesce(p_cover_url, '')), ''), item_ids = p_item_ids, updated_at = now()
    where id = p_catalog_id and faction_id = p_faction_id returning id into v_id;
    if v_id is null then raise exception 'Catálogo da facção não encontrado'; end if;
  else
    insert into public.faction_catalogs(faction_id, name, cover_url, item_ids, created_by)
    values (p_faction_id, left(trim(p_name), 60), nullif(trim(coalesce(p_cover_url, '')), ''), p_item_ids, auth.uid()) returning id into v_id;
  end if;
  return v_id;
end;
$$;
grant execute on function public.save_faction_catalog(bigint, text, text, text, jsonb) to authenticated;

create or replace function public.update_faction_catalog_sort(p_catalog_id bigint, p_sort_order text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if p_sort_order not in ('added_desc', 'added_asc', 'title_asc', 'title_desc', 'likes_desc', 'likes_asc', 'reads_desc', 'reads_asc', 'year_desc', 'year_asc') then raise exception 'Ordem inválida'; end if;
  if not exists (
    select 1 from public.faction_catalogs catalog
    join public.faction_roles role on role.faction_id = catalog.faction_id and role.user_id = auth.uid() and role.role in ('leader', 'curator')
    where catalog.id = p_catalog_id
  ) then raise exception 'Apenas líderes e curadores podem ordenar o catálogo'; end if;
  update public.faction_catalogs set sort_order = p_sort_order, updated_at = now() where id = p_catalog_id;
end;
$$;
grant execute on function public.update_faction_catalog_sort(bigint, text) to authenticated;

create or replace function public.delete_faction_catalog(p_catalog_id bigint)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_faction_id text;
begin
  if not public.is_moderator() and not exists (
    select 1 from public.faction_catalogs catalog
    join public.faction_roles role on role.faction_id = catalog.faction_id and role.user_id = auth.uid() and role.role in ('leader', 'curator')
    where catalog.id = p_catalog_id
  ) then raise exception 'Apenas líderes e curadores podem excluir o catálogo'; end if;
  select faction_id into v_faction_id from public.faction_catalogs where id = p_catalog_id;
  delete from public.faction_catalogs where id = p_catalog_id;
  if v_faction_id is not null then
    update public.factions
    set abafac_order = coalesce((select jsonb_agg(item.value order by item.ordinality)
      from jsonb_array_elements(coalesce(abafac_order, '[]'::jsonb)) with ordinality item(value, ordinality)
      where item.value <> to_jsonb('faction-catalog:' || p_catalog_id::text)), '[]'::jsonb)
    where id = v_faction_id;
  end if;
end;
$$;
grant execute on function public.delete_faction_catalog(bigint) to authenticated;

create or replace function public.set_faction_catalog_featured(p_catalog_id bigint, p_featured boolean)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_moderator() then raise exception 'Apenas moderadores e administradores podem destacar catálogos'; end if;
  update public.faction_catalogs set is_featured = coalesce(p_featured, false), updated_at = now() where id = p_catalog_id;
  if not found then raise exception 'Catálogo da facção não encontrado'; end if;
end;
$$;
grant execute on function public.set_faction_catalog_featured(bigint, boolean) to authenticated;

-- Cada catálogo é uma abafac independente. A coluna antiga continua para
-- compatibilidade e é migrada abaixo.
create table if not exists public.faction_abafac_catalogs (
  id bigint generated by default as identity primary key,
  faction_id text not null references public.factions(id) on delete cascade,
  catalog_url text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (faction_id, catalog_url),
  check (catalog_url !~* '^(https?:|//)')
);
alter table public.faction_abafac_catalogs alter column created_by drop not null;
create index if not exists faction_abafac_catalogs_faction_idx on public.faction_abafac_catalogs(faction_id, created_at);
insert into public.faction_abafac_catalogs (faction_id, catalog_url, created_by)
select factions.id, factions.abafac_catalog_url, null::uuid
from public.factions
where nullif(trim(factions.abafac_catalog_url), '') is not null
on conflict (faction_id, catalog_url) do nothing;

create table if not exists public.faction_abafac_images (
  id bigint generated by default as identity primary key,
  faction_id text not null references public.factions(id) on delete cascade,
  image_url text not null,
  link_url text,
  storage_path text not null unique,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
-- As imagens da abafac são referenciadas por URL; storage_path fica apenas
-- para compatibilidade com registros antigos que ainda apontem para um arquivo.
alter table public.faction_abafac_images alter column storage_path drop not null;
alter table public.faction_abafac_images drop constraint if exists faction_abafac_images_image_url_check;
alter table public.faction_abafac_images add constraint faction_abafac_images_image_url_check check (image_url ~ '^https://');
alter table public.faction_abafac_images add column if not exists link_url text;
alter table public.faction_abafac_images drop constraint if exists faction_abafac_images_link_internal_check;
update public.faction_abafac_images
set link_url = null
where link_url is not null
  and (link_url like '//%' or link_url like '\\%' or link_url ~* '^[a-z][a-z0-9+.-]*:');
alter table public.faction_abafac_images add constraint faction_abafac_images_link_internal_check check (
  link_url is null
  or (link_url not like '//%' and link_url not like '\\%' and link_url !~* '^[a-z][a-z0-9+.-]*:')
);
create index if not exists faction_abafac_images_faction_idx on public.faction_abafac_images(faction_id, created_at);

insert into public.factions (id, name, color, emblem, description, sort_order) values
  ('aurora-rubra', 'Maravilhas', '#e85b68', '✦', 'Coragem, paixão e espírito de liderança.', 1),
  ('vigilia-cobalto', 'Legado', '#5ca9e8', '◈', 'Estratégia, conhecimento e visão de futuro.', 2),
  ('forja-dourada', 'Ruptura', '#e7b94b', '✹', 'Constância, criatividade e dedicação.', 3),
  ('nevoa-violeta', 'Horizonte', '#ae79e8', '✧', 'Mistério, imaginação e pensamento independente.', 4)
on conflict (id) do update set name = excluded.name, color = excluded.color, emblem = excluded.emblem, description = excluded.description, sort_order = excluded.sort_order;
create unique index if not exists factions_color_unique on public.factions(lower(color));
create unique index if not exists factions_emblem_unique on public.factions(emblem);

alter table public.profiles add column if not exists faction_id text references public.factions(id) on delete set null;
alter table public.profiles add column if not exists faction_joined_at timestamptz;
alter table public.profiles add column if not exists faction_changed_at timestamptz;

create table if not exists public.faction_memberships (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  faction_id text not null references public.factions(id) on delete restrict,
  joined_at timestamptz not null default now(),
  changed_at timestamptz
);
create index if not exists faction_memberships_faction_idx on public.faction_memberships(faction_id);

create table if not exists public.faction_seasons (
  id bigint generated by default as identity primary key,
  season_key date not null unique,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.faction_xp_events (
  id bigint generated by default as identity primary key,
  season_id bigint not null references public.faction_seasons(id) on delete cascade,
  faction_id text not null references public.factions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  event_key text not null,
  xp integer not null check (xp > 0),
  created_at timestamptz not null default now(),
  unique (season_id, user_id, event_key)
);
alter table public.faction_xp_events drop constraint if exists faction_xp_events_xp_check;
alter table public.faction_xp_events add constraint faction_xp_events_xp_check check (xp <> 0);
create index if not exists faction_xp_events_rank_idx on public.faction_xp_events(season_id, faction_id, created_at desc);

create table if not exists public.faction_achievements (
  id bigint generated by default as identity primary key,
  achievement_key text not null unique,
  name text not null,
  description text not null,
  icon text not null default '★',
  metric text not null check (metric in ('xp', 'members', 'read', 'comment', 'like', 'chat', 'follow', 'mandatory_readers', 'sticker', 'sticker_donate', 'sticker_trade')),
  threshold integer not null check (threshold > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.faction_achievements add column if not exists created_at timestamptz not null default now();

create table if not exists public.faction_achievement_awards (
  faction_id text not null references public.factions(id) on delete cascade,
  season_id bigint not null references public.faction_seasons(id) on delete cascade,
  achievement_id bigint not null references public.faction_achievements(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (faction_id, season_id, achievement_id)
);
create index if not exists faction_achievement_awards_faction_idx on public.faction_achievement_awards(faction_id, season_id, unlocked_at desc);

create table if not exists public.faction_mandatory_reads (
  season_id bigint not null references public.faction_seasons(id) on delete cascade,
  faction_id text not null references public.factions(id) on delete cascade,
  item_id text not null,
  item_title text not null default 'Edição',
  cover_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (season_id, faction_id, item_id)
);
create index if not exists faction_mandatory_reads_faction_idx on public.faction_mandatory_reads(faction_id, season_id, sort_order);

insert into public.faction_achievements(achievement_key, name, description, icon, metric, threshold, sort_order) values
  ('faction_first_steps', 'Primeiros passos', 'A facção soma 1.000 XP nesta temporada. Leituras, comentários, curtidas e mensagens no chat dos membros contribuem.', '✦', 'xp', 1000, 1),
  ('faction_readers', 'Clube da leitura', 'Membros da facção precisam ler 100 edições nesta temporada. A leitura é registrada automaticamente ao chegar ao final da edição.', '📖', 'read', 100, 2),
  ('faction_voice', 'Voz ativa', 'Membros da facção precisam publicar 100 comentários nesta temporada.', '💬', 'comment', 100, 3),
  ('faction_chat', 'Ponto de encontro', 'Membros da facção precisam enviar 100 mensagens nos chats nesta temporada.', '⚡', 'chat', 100, 4),
  ('faction_unity', 'União', 'A facção precisa ter 100 membros atualmente.', '♛', 'members', 100, 5),
  ('faction_loved', 'Querida da banca', 'Membros da facção precisam dar 250 curtidas em quadrinhos nesta temporada.', '♥', 'like', 250, 6),
  ('faction_network', 'Rede formada', 'Membros da facção precisam seguir 100 perfis nesta temporada.', '✧', 'follow', 100, 7),
  ('faction_legend', 'Lenda da temporada', 'A facção soma 10.000 XP nesta temporada. As atividades dos membros contribuem.', '🏆', 'xp', 10000, 8)
  ,('faction_mandatory_readers', 'Clube da missÃ£o', 'Pelo menos 100 membros precisam comeÃ§ar uma das leituras obrigatÃ³rias da temporada.', 'ðŸ“š', 'mandatory_readers', 100, 9)
on conflict (achievement_key) do update set name = excluded.name, description = excluded.description, icon = excluded.icon, metric = excluded.metric, threshold = excluded.threshold, sort_order = excluded.sort_order;

create table if not exists public.faction_roles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  faction_id text not null references public.factions(id) on delete cascade,
  role text not null check (role in ('leader', 'curator')),
  slot integer not null default 1,
  assigned_at timestamptz not null default now()
);

alter table public.faction_roles add column if not exists slot integer not null default 1;
update public.faction_roles set role = 'curator' where role not in ('leader', 'curator');
alter table public.faction_roles drop constraint if exists faction_roles_role_check;
alter table public.faction_roles add constraint faction_roles_role_check check (role in ('leader', 'curator'));
with ranked_curators as (
  select user_id, row_number() over (partition by faction_id order by assigned_at, user_id) as curator_slot
  from public.faction_roles where role = 'curator'
)
update public.faction_roles roles set slot = ranked_curators.curator_slot
from ranked_curators where roles.user_id = ranked_curators.user_id;
delete from public.faction_roles where role = 'curator' and slot > 3;
with ranked_leaders as (
  select user_id, row_number() over (partition by faction_id order by assigned_at, user_id) as leader_slot
  from public.faction_roles where role = 'leader'
)
delete from public.faction_roles roles using ranked_leaders
where roles.user_id = ranked_leaders.user_id and ranked_leaders.leader_slot > 1;
create unique index if not exists faction_one_leader_idx on public.faction_roles(faction_id) where role = 'leader';
create unique index if not exists faction_three_curators_idx on public.faction_roles(faction_id, slot) where role = 'curator';

create or replace function public.is_chat_room_sheriff(p_room_id text)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.chat_room_sheriffs sheriff
    join public.chat_rooms room on room.id = sheriff.room_id
    where sheriff.room_id = p_room_id
      and room.id in ('geral', 'decenautas', 'marvetes', 'leitores-colecionadores')
      and sheriff.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.chat_rooms faction_room
    join public.profiles member on member.id = auth.uid() and member.faction_id = faction_room.faction_id
    join public.faction_roles role on role.user_id = member.id and role.faction_id = faction_room.faction_id and role.role in ('leader', 'curator')
    where faction_room.id = p_room_id and faction_room.access = 'faction'
  )
$$;

create table if not exists public.faction_bans (
  faction_id text not null references public.factions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  banned_by uuid not null references public.profiles(id),
  reason text not null check (char_length(trim(reason)) between 3 and 500),
  created_at timestamptz not null default now(),
  primary key (faction_id, user_id)
);

create table if not exists public.faction_moderation_actions (
  id bigint generated by default as identity primary key,
  faction_id text not null references public.factions(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  target_id uuid not null references public.profiles(id),
  action text not null,
  reason text not null check (char_length(trim(reason)) between 3 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.faction_xp_adjustments (
  id bigint generated by default as identity primary key,
  faction_id text not null references public.factions(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  amount integer not null,
  reason text not null check (char_length(trim(reason)) between 3 and 500),
  created_at timestamptz not null default now()
);

create or replace function public.manage_faction_role(p_target_id uuid, p_role text, p_slot integer default 1)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_actor public.profiles%rowtype;
  v_target public.profiles%rowtype;
  v_faction text;
begin
  select * into v_actor from public.profiles where id = auth.uid();
  select * into v_target from public.profiles where id = p_target_id;
  if v_actor.plan <> 'admin' and v_actor.faction_id is null then raise exception 'Apenas a liderança da facção pode gerenciar cargos'; end if;
  if v_target.id is null or v_target.faction_id is null then raise exception 'Membro sem facção'; end if;
  v_faction := v_target.faction_id;
  if v_actor.plan <> 'admin' and not exists (select 1 from public.faction_roles where user_id = v_actor.id and faction_id = v_faction and role = 'leader') then raise exception 'Apenas o líder pode gerenciar cargos'; end if;
  if p_role not in ('leader', 'curator') then raise exception 'Cargo inválido'; end if;
  if p_role = 'leader' and v_actor.plan <> 'admin' then raise exception 'Apenas administradores podem nomear um novo líder'; end if;
  if p_role = 'curator' and (p_slot < 1 or p_slot > 3) then raise exception 'A facção possui apenas três vagas de curador'; end if;
  if p_role = 'leader' then p_slot := 1; end if;
  delete from public.faction_roles where user_id = p_target_id;
  insert into public.faction_roles(user_id, faction_id, role, slot) values (p_target_id, v_faction, p_role, p_slot);
  if v_target.plan = 'free' then update public.profiles set plan = 'premium' where id = p_target_id; end if;
end;
$$;
grant execute on function public.manage_faction_role(uuid, text, integer) to authenticated;

create or replace function public.update_faction_abafac_order(p_faction_id text, p_order jsonb)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_actor public.profiles%rowtype;
  v_order jsonb;
begin
  select * into v_actor from public.profiles where id = auth.uid();
  if v_actor.id is null or not exists (
    select 1 from public.faction_roles
    where user_id = v_actor.id and faction_id = p_faction_id and role in ('leader', 'curator')
  ) then
    raise exception 'Apenas líderes e curadores podem reorganizar as abas da facção';
  end if;
  if jsonb_typeof(p_order) <> 'array' then raise exception 'Ordem de abas inválida'; end if;
  if not (p_order @> '["stats"]'::jsonb) then raise exception 'A aba de resumo da facção é obrigatória'; end if;
  if jsonb_array_length(p_order) > 13 + (select count(*) from public.faction_abafac_images where faction_id = p_faction_id) + (select count(*) from public.faction_abafac_catalogs where faction_id = p_faction_id) + (select count(*) from public.faction_catalogs where faction_id = p_faction_id) then raise exception 'A ordem possui abas inválidas'; end if;
  if exists (
    select 1 from jsonb_array_elements_text(p_order) item(value)
    where not (
      item.value in ('stats', 'manifest', 'mural', 'missions', 'mandatory-reads', 'faction-chat', 'continue-reading', 'recently-added', 'featured-character', 'new-series', 'most-read-month', 'best-series', 'tips', 'random', 'artist', 'recommendations', 'random-publisher', 'downloads', 'most-read', 'pinned-imprints', 'pinned-characters', 'pinned-collections', 'achievements', 'hall', 'report', 'leadership', 'members')
      or (item.value = 'catalog' and exists (select 1 from public.factions where id = p_faction_id and nullif(trim(abafac_catalog_url), '') is not null))
      or (item.value ~ '^image:[0-9]+$' and exists (
        select 1 from public.faction_abafac_images image
        where image.id = split_part(item.value, ':', 2)::bigint and image.faction_id = p_faction_id
      ))
      or (item.value ~ '^catalog:[0-9]+$' and exists (
        select 1 from public.faction_abafac_catalogs catalog
        where catalog.id = split_part(item.value, ':', 2)::bigint and catalog.faction_id = p_faction_id
      ))
      or (item.value ~ '^faction-catalog:[0-9]+$' and exists (
        select 1 from public.faction_catalogs catalog
        where catalog.id = split_part(item.value, ':', 2)::bigint and catalog.faction_id = p_faction_id
      ))
    )
  ) then raise exception 'A ordem possui abas inválidas'; end if;
  if p_order @> '["catalog"]'::jsonb and not exists (select 1 from public.factions where id = p_faction_id and nullif(trim(abafac_catalog_url), '') is not null) then
    raise exception 'O catálogo público ainda não foi configurado';
  end if;
  if (select count(*) from jsonb_array_elements_text(p_order)) <> (select count(distinct value) from jsonb_array_elements_text(p_order)) then
    raise exception 'A ordem possui abas repetidas';
  end if;
  v_order := p_order;
  update public.factions set abafac_order = v_order where id = p_faction_id;
end;
$$;
grant execute on function public.update_faction_abafac_order(text, jsonb) to authenticated;

create or replace function public.remove_faction_abafac_image(p_image_id bigint)
returns text language plpgsql security definer set search_path = public
as $$
declare
  v_image public.faction_abafac_images%rowtype;
  v_path text;
begin
  select * into v_image from public.faction_abafac_images where id = p_image_id;
  if not found then raise exception 'Imagem abafac não encontrada'; end if;
  if not exists (select 1 from public.faction_roles where user_id = auth.uid() and faction_id = v_image.faction_id and role in ('leader', 'curator')) then
    raise exception 'Apenas líderes e curadores podem remover imagens abafac';
  end if;
  v_path := v_image.storage_path;
  delete from public.faction_abafac_images where id = p_image_id;
  update public.factions
  set abafac_order = coalesce((select jsonb_agg(value) from jsonb_array_elements(coalesce(abafac_order, '[]'::jsonb)) item(value) where value <> to_jsonb('image:' || p_image_id::text)), '[]'::jsonb)
  where id = v_image.faction_id;
  return v_path;
end;
$$;
grant execute on function public.remove_faction_abafac_image(bigint) to authenticated;

create or replace function public.remove_faction_abafac_catalog(p_catalog_id bigint)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_catalog public.faction_abafac_catalogs%rowtype;
begin
  select * into v_catalog from public.faction_abafac_catalogs where id = p_catalog_id;
  if not found then raise exception 'Catalogo da abafac nao encontrado'; end if;
  if not exists (
    select 1 from public.faction_roles
    where user_id = auth.uid()
      and faction_id = v_catalog.faction_id
      and role in ('leader', 'curator')
  ) then
    raise exception 'Apenas lideres e curadores podem remover catalogos da abafac';
  end if;
  delete from public.faction_abafac_catalogs where id = p_catalog_id;
  update public.factions
  set abafac_order = coalesce((select jsonb_agg(item.value order by item.ordinality)
    from jsonb_array_elements(coalesce(abafac_order, '[]'::jsonb)) with ordinality item(value, ordinality)
    where item.value <> to_jsonb('catalog:' || p_catalog_id::text)), '[]'::jsonb)
  where id = v_catalog.faction_id;
end;
$$;
grant execute on function public.remove_faction_abafac_catalog(bigint) to authenticated;

create or replace function public.update_faction_abafac_link(p_image_id bigint, p_link_url text)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_image public.faction_abafac_images%rowtype;
  v_link text := nullif(trim(p_link_url), '');
begin
  select * into v_image from public.faction_abafac_images where id = p_image_id;
  if not found then raise exception 'Imagem abafac não encontrada'; end if;
  if not exists (select 1 from public.faction_roles where user_id = auth.uid() and faction_id = v_image.faction_id and role in ('leader', 'curator')) then
    raise exception 'Apenas líderes e curadores podem editar links de imagens abafac';
  end if;
  if v_link is not null and (v_link like '//%' or v_link like '\\%' or v_link ~* '^[a-z][a-z0-9+.-]*:') then
    raise exception 'O link da abafac precisa apontar para dentro deste site';
  end if;
  update public.faction_abafac_images set link_url = v_link where id = p_image_id;
end;
$$;
grant execute on function public.update_faction_abafac_link(bigint, text) to authenticated;

create or replace function public.resign_faction_curator()
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_faction text;
begin
  select faction_id into v_faction
  from public.faction_roles
  where user_id = auth.uid() and role = 'curator';
  if v_faction is null then raise exception 'Você não ocupa o cargo de curador'; end if;
  delete from public.faction_roles where user_id = auth.uid();
  perform public.ensure_faction_leadership(v_faction);
end;
$$;
grant execute on function public.resign_faction_curator() to authenticated;

create or replace function public.remove_faction_member(p_target_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public
as $$
declare v_actor public.profiles%rowtype; v_target public.profiles%rowtype;
begin
  select * into v_actor from public.profiles where id = auth.uid();
  select * into v_target from public.profiles where id = p_target_id;
  if v_actor.faction_id is null or not exists (select 1 from public.faction_roles where user_id = v_actor.id and faction_id = v_actor.faction_id and role = 'leader') then raise exception 'Apenas o líder pode remover membros'; end if;
  if v_target.faction_id <> v_actor.faction_id then raise exception 'O membro não pertence à sua facção'; end if;
  if exists (select 1 from public.faction_roles where user_id = p_target_id and role = 'leader') then raise exception 'O líder não pode ser removido pela própria facção'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Informe o motivo da remoção'; end if;
  insert into public.faction_bans(faction_id, user_id, banned_by, reason) values (v_actor.faction_id, p_target_id, v_actor.id, left(trim(p_reason), 500)) on conflict (faction_id, user_id) do update set reason = excluded.reason, banned_by = excluded.banned_by, created_at = now();
  insert into public.faction_moderation_actions(faction_id, actor_id, target_id, action, reason) values (v_actor.faction_id, v_actor.id, p_target_id, 'remove_member', left(trim(p_reason), 500));
  delete from public.faction_memberships where user_id = p_target_id;
  update public.profiles set faction_id = null, faction_changed_at = now() where id = p_target_id;
  perform public.ensure_faction_leadership(v_actor.faction_id);
end;
$$;
grant execute on function public.remove_faction_member(uuid, text) to authenticated;

create or replace function public.adjust_faction_xp(p_faction_id text, p_amount integer, p_reason text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_moderator() then raise exception 'Apenas moderadores e administradores podem ajustar XP'; end if;
  if not exists (select 1 from public.factions where id = p_faction_id) then raise exception 'Facção não encontrada'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Informe o motivo do ajuste'; end if;
  insert into public.faction_xp_adjustments(faction_id, actor_id, amount, reason) values (p_faction_id, auth.uid(), p_amount, left(trim(p_reason), 500));
end;
$$;
grant execute on function public.adjust_faction_xp(text, integer, text) to authenticated;

drop function if exists public.update_faction_identity(text, text, text, text);
create or replace function public.update_faction_identity(p_faction_id text, p_name text, p_color text, p_emblem text default '◆', p_description text default null)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if lower(coalesce(p_color, '')) not in ('#e85b68', '#a93345', '#5ca9e8', '#2d6295', '#e7b94b', '#9a6c12', '#ae79e8', '#6f3ca5', '#b8c2cc', '#59636f', '#ec8b55', '#a84c21', '#b8d957', '#6b821d', '#e17ab3', '#9b3f72') then raise exception 'Escolha uma cor da paleta'; end if;
  if coalesce(p_emblem, '') not in ('✦', '◈', '✹', '✧', '★', '◆', '⚡', '☾', '♛', '🛡️', '🔥', '🌀') then raise exception 'Escolha um emoji da lista'; end if;
  if exists (select 1 from public.factions where id <> p_faction_id and lower(color) = lower(p_color)) then raise exception 'Essa cor ja pertence a outra faccao'; end if;
  if exists (select 1 from public.factions where id <> p_faction_id and emblem = p_emblem) then raise exception 'Esse emoji ja pertence a outra faccao'; end if;
  if not public.is_admin() and not exists (select 1 from public.faction_roles where user_id = auth.uid() and faction_id = p_faction_id and role = 'leader') then raise exception 'Apenas o líder pode editar a identidade da facção'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 3 or p_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Nome ou cor inválidos'; end if;
  update public.factions set name = left(trim(p_name), 80), color = lower(p_color), emblem = p_emblem, description = nullif(left(trim(coalesce(p_description, '')), 500), '') where id = p_faction_id;
end;
$$;
grant execute on function public.update_faction_identity(text, text, text, text, text) to authenticated;

create or replace function public.ensure_faction_mandatory_reads(p_faction_id text, p_candidates jsonb)
returns table(item_id text, item_title text, cover_url text, sort_order integer)
language plpgsql security definer set search_path = public
as $$
declare v_season public.faction_seasons%rowtype;
begin
  if not exists (select 1 from public.factions where id = p_faction_id) then return; end if;
  v_season := public.current_faction_season();
  if not exists (select 1 from public.faction_mandatory_reads where season_id = v_season.id and faction_id = p_faction_id) then
    insert into public.faction_mandatory_reads(season_id, faction_id, item_id, item_title, cover_url, sort_order)
    select v_season.id, p_faction_id, candidate.value->>'id', left(coalesce(nullif(candidate.value->>'title', ''), 'Edição'), 200), nullif(candidate.value->>'cover_url', ''), row_number() over (order by random())::integer
    from jsonb_array_elements(coalesce(p_candidates, '[]'::jsonb)) candidate
    where jsonb_typeof(candidate.value) = 'object' and nullif(candidate.value->>'id', '') is not null
    order by random() limit 3 on conflict do nothing;
  end if;
  return query select reads.item_id, reads.item_title, reads.cover_url, reads.sort_order from public.faction_mandatory_reads reads where reads.season_id = v_season.id and reads.faction_id = p_faction_id order by reads.sort_order, reads.item_id;
end;
$$;
grant execute on function public.ensure_faction_mandatory_reads(text, jsonb) to authenticated;

create or replace function public.get_faction_mandatory_reads(p_faction_id text)
returns table(item_id text, item_title text, cover_url text, reader_count bigint, completed_count bigint)
language sql stable security definer set search_path = public
as $$
  select reads.item_id, reads.item_title, reads.cover_url, count(distinct case when progress.user_id is not null then progress.user_id end) filter (where member.id is not null), count(distinct case when progress.completed then progress.user_id end) filter (where member.id is not null)
  from public.faction_mandatory_reads reads join public.faction_seasons season on season.id = reads.season_id and season.season_key = date_trunc('month', current_date)::date left join public.reading_progress progress on progress.item_id = reads.item_id left join public.profiles member on member.id = progress.user_id and member.faction_id = p_faction_id
  where reads.faction_id = p_faction_id group by reads.item_id, reads.item_title, reads.cover_url, reads.sort_order order by reads.sort_order, reads.item_id
$$;
grant execute on function public.get_faction_mandatory_reads(text) to anon, authenticated;

create or replace function public.complete_faction_mandatory_read(p_item_id text)
returns boolean language plpgsql security definer set search_path = public
as $$
declare v_user_id uuid := auth.uid(); v_faction_id text; v_season public.faction_seasons%rowtype;
begin
  if v_user_id is null then return false; end if;
  select profile.faction_id into v_faction_id from public.profiles profile where profile.id = v_user_id;
  if v_faction_id is null then return false; end if;
  v_season := public.current_faction_season();
  if not exists (select 1 from public.faction_mandatory_reads reads where reads.season_id = v_season.id and reads.faction_id = v_faction_id and reads.item_id = p_item_id) then return false; end if;
  if not exists (select 1 from public.reading_progress progress where progress.user_id = v_user_id and progress.item_id = p_item_id and progress.completed) then return false; end if;
  insert into public.faction_xp_events(season_id, faction_id, user_id, event_type, event_key, xp) values (v_season.id, v_faction_id, v_user_id, 'mandatory_read', 'mandatory-read:' || v_season.id::text || ':' || p_item_id, 25) on conflict (season_id, user_id, event_key) do nothing;
  return found;
end;
$$;
grant execute on function public.complete_faction_mandatory_read(text) to authenticated;

alter table public.faction_mandatory_reads enable row level security;
drop policy if exists "faction mandatory reads are public" on public.faction_mandatory_reads;
create policy "faction mandatory reads are public" on public.faction_mandatory_reads for select using (true);

-- Líderes e curadores podem editar somente o texto do manifesto.
create or replace function public.update_faction_manifesto(p_faction_id text, p_manifesto text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() and not exists (
    select 1 from public.faction_roles
    where user_id = auth.uid()
      and faction_id = p_faction_id
      and role in ('leader', 'curator')
  ) then
    raise exception 'Apenas líderes e curadores podem editar o manifesto da facção';
  end if;
  if not exists (select 1 from public.factions where id = p_faction_id) then
    raise exception 'Facção não encontrada';
  end if;
  update public.factions
  set description = nullif(left(trim(coalesce(p_manifesto, '')), 500), '')
  where id = p_faction_id;
end;
$$;
grant execute on function public.update_faction_manifesto(text, text) to authenticated;

create or replace function public.update_faction_mural(p_faction_id text, p_notice text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() and not exists (
    select 1 from public.faction_roles
    where user_id = auth.uid()
      and faction_id = p_faction_id
      and role in ('leader', 'curator')
  ) then
    raise exception 'Apenas líderes e curadores podem editar o mural da facção';
  end if;
  if not exists (select 1 from public.factions where id = p_faction_id) then
    raise exception 'Facção não encontrada';
  end if;
  update public.factions
  set mural_notice = left(trim(coalesce(p_notice, '')), 1000)
  where id = p_faction_id;
end;
$$;
grant execute on function public.update_faction_mural(text, text) to authenticated;
notify pgrst, 'reload schema';

-- Mural de perfil e coleções públicas salvas.
alter table public.shelf_collection_saves enable row level security;
alter table public.shelf_collection_comments enable row level security;
alter table public.profile_wall_comments enable row level security;
drop policy if exists "public collection saves are visible" on public.shelf_collection_saves;
drop policy if exists "users save public collections" on public.shelf_collection_saves;
drop policy if exists "users unsave public collections" on public.shelf_collection_saves;
drop policy if exists "public collection comments are visible" on public.shelf_collection_comments;
drop policy if exists "users create collection comments" on public.shelf_collection_comments;
drop policy if exists "users delete collection comments" on public.shelf_collection_comments;
drop policy if exists "profile wall comments are public" on public.profile_wall_comments;
drop policy if exists "users create profile wall comments" on public.profile_wall_comments;
drop policy if exists "users delete profile wall comments" on public.profile_wall_comments;
create policy "public collection saves are visible" on public.shelf_collection_saves for select using (auth.uid() = user_id or not public.is_blocked_between(user_id));
create policy "users save public collections" on public.shelf_collection_saves for insert with check (
  auth.uid() = user_id and exists (
    select 1 from public.shelf_collections collection
    where collection.id = shelf_collection_saves.collection_id
      and collection.owner_id = shelf_collection_saves.owner_id
      and collection.is_public
      and collection.collection_type = 'comic'
  )
);

create policy "users unsave public collections" on public.shelf_collection_saves for delete using (auth.uid() = user_id);
create policy "public collection comments are visible" on public.shelf_collection_comments for select using (
  exists (
    select 1 from public.shelf_collections collection
    where collection.id = shelf_collection_comments.collection_id
      and collection.owner_id = shelf_collection_comments.owner_id
      and collection.is_public
      and collection.collection_type = 'comic'
  ) and not public.is_blocked_between(user_id)
);
create policy "users create collection comments" on public.shelf_collection_comments for insert with check (
  auth.uid() = user_id and public.can_post_content('comment', body) and exists (
    select 1 from public.shelf_collections collection
    where collection.id = shelf_collection_comments.collection_id
      and collection.owner_id = shelf_collection_comments.owner_id
      and collection.is_public
      and collection.collection_type = 'comic'
  ) and not public.is_blocked_between(owner_id)
);
create policy "users delete collection comments" on public.shelf_collection_comments for delete using (auth.uid() = user_id or auth.uid() = owner_id or public.is_moderator());
create policy "profile wall comments are public" on public.profile_wall_comments for select using (auth.uid() = profile_id or not public.is_blocked_between(profile_id));
create policy "users create profile wall comments" on public.profile_wall_comments for insert with check (auth.uid() = user_id and public.can_post_content('comment', body) and not public.is_blocked_between(profile_id));
create policy "users delete profile wall comments" on public.profile_wall_comments for delete using (auth.uid() = user_id or auth.uid() = profile_id or public.is_moderator());

-- Atualiza os emblemas iniciais para a nova lista visualmente distinta.
update public.factions set emblem = case id
  when 'aurora-rubra' then '🦁'
  when 'vigilia-cobalto' then '🐍'
  when 'forja-dourada' then '🦊'
  when 'nevoa-violeta' then '🐙'
  else emblem
end
where id in ('aurora-rubra', 'vigilia-cobalto', 'forja-dourada', 'nevoa-violeta');

drop function if exists public.update_faction_identity_v2(text, text, text, text, text, text, text);
drop function if exists public.update_faction_identity_v2(text, text, text, text, text, text);
drop function if exists public.update_faction_identity_v2(text, text, text, text, text);
create or replace function public.update_faction_identity_v2(p_faction_id text, p_name text, p_color text, p_emblem text default '🦁', p_description text default null, p_catalog_url text default null, p_publisher_name text default null)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if lower(coalesce(p_color, '')) not in ('#e85b68', '#a93345', '#5ca9e8', '#2d6295', '#e7b94b', '#9a6c12', '#ae79e8', '#6f3ca5', '#b8c2cc', '#59636f', '#ec8b55', '#a84c21', '#b8d957', '#6b821d', '#e17ab3', '#9b3f72') then raise exception 'Escolha uma cor da paleta'; end if;
  if coalesce(p_emblem, '') not in ('🦁', '🐍', '🦊', '🐙', '⚡', '🕷️', '🔥', '🌀', '🦋', '🌵', '🦈', '🎸', '☀️', '🦉', '🐉', '🦅', '🐺', '🌿', '⚔️', '🛸') then raise exception 'Escolha um emoji da lista'; end if;
  if exists (select 1 from public.factions where id <> p_faction_id and lower(color) = lower(p_color)) then raise exception 'Essa cor ja pertence a outra faccao'; end if;
  if exists (select 1 from public.factions where id <> p_faction_id and emblem = p_emblem) then raise exception 'Esse emoji ja pertence a outra faccao'; end if;
  if not public.is_admin() and not exists (select 1 from public.faction_roles where user_id = auth.uid() and faction_id = p_faction_id and role = 'leader') then raise exception 'Apenas o lider pode editar a identidade da faccao'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 3 then raise exception 'Nome invalido'; end if;
  if nullif(trim(p_publisher_name), '') is not null and exists (select 1 from public.factions where id <> p_faction_id and lower(trim(publisher_name)) = lower(trim(p_publisher_name))) then raise exception 'Essa editora ja foi definida por outra faccao'; end if;
  if nullif(trim(p_catalog_url), '') is not null and (trim(p_catalog_url) like '//%' or trim(p_catalog_url) ilike 'http:%' or trim(p_catalog_url) ilike 'https:%' or trim(p_catalog_url) !~ '(^|[?&])perfil=[A-Za-z0-9_]{3,24}(&|$)' or trim(p_catalog_url) !~ '(^|[?&])lista=[^&#]+') then
    raise exception 'O catálogo deve ser um link interno de uma coleção pública deste site';
  end if;
  if nullif(trim(p_catalog_url), '') is not null and not exists (
    select 1
    from public.profiles owner
    join public.shelf_collections collection on collection.owner_id = owner.id
    where lower(owner.username) = lower((regexp_match(trim(p_catalog_url), '(^|[?&])perfil=([A-Za-z0-9_]{3,24})(&|$)'))[2])
      and collection.id = (regexp_match(trim(p_catalog_url), '(^|[?&])lista=([^&#]+)'))[2]
      and collection.is_public
      and collection.collection_type = 'comic'
  ) then
    raise exception 'A coleção precisa ser pública e pertencer a este site';
  end if;
  update public.factions set name = left(trim(p_name), 80), color = lower(p_color), emblem = p_emblem, description = nullif(left(trim(coalesce(p_description, '')), 500), ''), abafac_catalog_url = nullif(trim(p_catalog_url), ''), publisher_name = nullif(left(trim(p_publisher_name), 160), '') where id = p_faction_id;
end;
$$;
grant execute on function public.update_faction_identity_v2(text, text, text, text, text, text, text) to authenticated;

create or replace function public.update_faction_catalog(p_faction_id text, p_catalog_url text default null)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_url text := nullif(trim(p_catalog_url), '');
  v_username text;
  v_collection_id text;
begin
  if not public.is_admin() and not exists (
    select 1 from public.faction_roles
    where user_id = auth.uid()
      and faction_id = p_faction_id
      and role in ('leader', 'curator')
  ) then
    raise exception 'Apenas líderes e curadores podem adicionar um catálogo';
  end if;
  if not exists (select 1 from public.factions where id = p_faction_id) then
    raise exception 'Facção não encontrada';
  end if;
  if v_url is null then
    update public.factions set abafac_catalog_url = null where id = p_faction_id;
    return;
  end if;
  if v_url like '//%' or v_url ilike 'http:%' or v_url ilike 'https:%'
    or v_url !~ '(^|[?&])perfil=[A-Za-z0-9_]{3,24}(&|$)'
    or v_url !~ '(^|[?&])lista=[^&#]+'
  then
    raise exception 'O catálogo deve ser um link interno de uma coleção pública deste site';
  end if;
  v_username := (regexp_match(v_url, '(^|[?&])perfil=([A-Za-z0-9_]{3,24})(&|$)'))[2];
  v_collection_id := (regexp_match(v_url, '(^|[?&])lista=([^&#]+)'))[2];
  if not exists (
    select 1
    from public.profiles owner
    join public.shelf_collections collection on collection.owner_id = owner.id
    where lower(owner.username) = lower(v_username)
      and collection.id = v_collection_id
      and collection.is_public
      and collection.collection_type = 'comic'
  ) then
    raise exception 'A coleção precisa ser pública e pertencer a este site';
  end if;
  update public.factions set abafac_catalog_url = v_url where id = p_faction_id;
end;
$$;
grant execute on function public.update_faction_catalog(text, text) to authenticated;

create or replace function public.add_faction_abafac_catalog(p_faction_id text, p_catalog_url text)
returns bigint language plpgsql security definer set search_path = public
as $$
declare
  v_url text := nullif(trim(p_catalog_url), '');
  v_username text;
  v_collection_id text;
  v_id bigint;
begin
  if not public.is_admin() and not exists (
    select 1 from public.faction_roles
    where user_id = auth.uid() and faction_id = p_faction_id and role in ('leader', 'curator')
  ) then raise exception 'Apenas líderes e curadores podem adicionar um catálogo'; end if;
  if not exists (select 1 from public.factions where id = p_faction_id) then raise exception 'Facção não encontrada'; end if;
  if v_url is null or v_url like '//%' or v_url ilike 'http:%' or v_url ilike 'https:%'
    or v_url !~ '(^|[?&])perfil=[A-Za-z0-9_]{3,24}(&|$)'
    or v_url !~ '(^|[?&])lista=[^&#]+' then
    raise exception 'O catálogo deve ser um link interno de uma coleção pública deste site';
  end if;
  v_username := (regexp_match(v_url, '(^|[?&])perfil=([A-Za-z0-9_]{3,24})(&|$)'))[2];
  v_collection_id := (regexp_match(v_url, '(^|[?&])lista=([^&#]+)'))[2];
  if not exists (
    select 1 from public.profiles owner
    join public.shelf_collections collection on collection.owner_id = owner.id
    where lower(owner.username) = lower(v_username) and collection.id = v_collection_id
      and collection.is_public and collection.collection_type = 'comic'
  ) then raise exception 'A coleção precisa ser pública e pertencer a este site'; end if;
  insert into public.faction_abafac_catalogs(faction_id, catalog_url, created_by)
  values (p_faction_id, v_url, auth.uid())
  on conflict (faction_id, catalog_url) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.faction_abafac_catalogs where faction_id = p_faction_id and catalog_url = v_url;
  end if;
  return v_id;
end;
$$;
grant execute on function public.add_faction_abafac_catalog(text, text) to authenticated;
notify pgrst, 'reload schema';

-- Preenche somente vagas vazias. Assim, não substitui uma eleição ou uma gestão existente.
create or replace function public.ensure_faction_leadership(p_faction_id text)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_season public.faction_seasons%rowtype;
  v_candidate uuid;
  v_slot integer;
begin
  if not exists (select 1 from public.factions where id = p_faction_id) then return; end if;
  if auth.uid() is not null and not public.is_moderator()
    and not exists (select 1 from public.profiles where id = auth.uid() and faction_id = p_faction_id)
    and not exists (select 1 from public.faction_memberships where user_id = auth.uid() and faction_id = p_faction_id)
  then raise exception 'Você só pode organizar a sua própria facção'; end if;
  v_season := public.current_faction_season();

  -- profiles.faction_id é a fonte de verdade. Recria associações antigas
  -- que possam ter ficado sem registro em faction_memberships.
  insert into public.faction_memberships (user_id, faction_id, joined_at, changed_at)
  select profile.id, profile.faction_id, coalesce(profile.faction_joined_at, now()), profile.faction_changed_at
  from public.profiles profile
  where profile.faction_id = p_faction_id
    and profile.plan not in ('moderator', 'banca', 'admin')
  on conflict (user_id) do update
    set faction_id = excluded.faction_id,
        changed_at = excluded.changed_at;

  -- Remove cargos órfãos deixados por uma troca de facção interrompida.
  delete from public.faction_roles roles
  where roles.faction_id = p_faction_id
    and not exists (
      select 1 from public.profiles profile
      where profile.id = roles.user_id
        and profile.faction_id = p_faction_id
    )
    and not exists (
      select 1 from public.faction_memberships membership
      where membership.user_id = roles.user_id
        and membership.faction_id = p_faction_id
    );

  if not exists (select 1 from public.faction_roles roles where roles.faction_id = p_faction_id and roles.role = 'leader') then
    select candidate.user_id into v_candidate
    from (
      select member_profile.id as user_id,
        coalesce(sum(case when xp.season_id = v_season.id then xp.xp else 0 end), 0) as faction_xp,
        coalesce(member_profile.last_seen_at, to_timestamp(0)) as last_seen
      from public.profiles member_profile
      left join public.faction_xp_events xp on xp.user_id = member_profile.id and xp.faction_id = p_faction_id
      where member_profile.plan not in ('moderator', 'banca', 'admin')
        and (
          member_profile.faction_id = p_faction_id
          or exists (
            select 1
            from public.faction_memberships membership
            where membership.user_id = member_profile.id
              and membership.faction_id = p_faction_id
          )
        )
      group by member_profile.id, member_profile.last_seen_at
      order by faction_xp desc, last_seen desc, member_profile.id
    ) candidate
    where not exists (select 1 from public.faction_roles role where role.user_id = candidate.user_id)
    limit 1;
    if v_candidate is not null then
      insert into public.faction_roles(user_id, faction_id, role, slot) values (v_candidate, p_faction_id, 'leader', 1);
      update public.profiles set plan = 'premium' where id = v_candidate and plan = 'free';
    end if;
  end if;

  for v_slot in 1..3 loop
    if not exists (select 1 from public.faction_roles roles where roles.faction_id = p_faction_id and roles.role = 'curator' and roles.slot = v_slot) then
      select candidate.user_id into v_candidate
      from (
        select member_profile.id as user_id,
          coalesce(sum(case when xp.season_id = v_season.id then xp.xp else 0 end), 0) as faction_xp,
          coalesce(member_profile.last_seen_at, to_timestamp(0)) as last_seen
        from public.profiles member_profile
        left join public.faction_xp_events xp on xp.user_id = member_profile.id and xp.faction_id = p_faction_id
        where member_profile.plan not in ('moderator', 'banca', 'admin')
          and (
            member_profile.faction_id = p_faction_id
            or exists (
              select 1
              from public.faction_memberships membership
              where membership.user_id = member_profile.id
                and membership.faction_id = p_faction_id
            )
          )
        group by member_profile.id, member_profile.last_seen_at
        order by faction_xp desc, last_seen desc, member_profile.id
      ) candidate
      where not exists (select 1 from public.faction_roles role where role.user_id = candidate.user_id)
      limit 1;
      if v_candidate is null then exit; end if;
      insert into public.faction_roles(user_id, faction_id, role, slot) values (v_candidate, p_faction_id, 'curator', v_slot);
      update public.profiles set plan = 'premium' where id = v_candidate and plan = 'free';
    end if;
  end loop;
end;
$$;
grant execute on function public.ensure_faction_leadership(text) to authenticated;

create or replace function public.ensure_faction_leadership_after_join()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  perform public.ensure_faction_leadership(new.faction_id);
  return new;
end;
$$;

drop trigger if exists ensure_faction_leadership_after_join_trigger on public.faction_memberships;
create trigger ensure_faction_leadership_after_join_trigger
after insert on public.faction_memberships
for each row execute procedure public.ensure_faction_leadership_after_join();

create or replace function public.resign_faction_leader()
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_actor public.profiles%rowtype;
  v_successor uuid;
  v_faction text;
begin
  select * into v_actor from public.profiles where id = auth.uid();
  if not exists (select 1 from public.faction_roles where user_id = v_actor.id and role = 'leader') then raise exception 'Você não ocupa o cargo de líder'; end if;
  v_faction := v_actor.faction_id;
  select role_user.user_id into v_successor
  from public.faction_roles role_user
  join public.profiles member on member.id = role_user.user_id
  where role_user.faction_id = v_faction and role_user.role = 'curator'
  order by coalesce((select sum(xp.xp) from public.faction_xp_events xp where xp.user_id = role_user.user_id and xp.faction_id = v_faction and xp.season_id = (select id from public.faction_seasons where season_key = date_trunc('month', current_date)::date)), 0) desc, member.last_seen_at desc, role_user.slot
  limit 1;
  if v_successor is null then
    select member.user_id into v_successor
    from public.faction_memberships member
    join public.profiles profile on profile.id = member.user_id
    where member.faction_id = v_faction and member.user_id <> v_actor.id and profile.plan not in ('moderator', 'banca', 'admin')
    order by profile.last_seen_at desc, member.user_id
    limit 1;
  end if;
  delete from public.faction_roles where user_id = v_actor.id;
  if v_successor is not null then
    delete from public.faction_roles where user_id = v_successor;
    insert into public.faction_roles(user_id, faction_id, role, slot) values (v_successor, v_faction, 'leader', 1);
    update public.profiles set plan = 'premium' where id = v_successor and plan = 'free';
  end if;
  perform public.ensure_faction_leadership(v_faction);
end;
$$;
grant execute on function public.resign_faction_leader() to authenticated;

create or replace function public.promote_faction_curator(p_target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_actor public.profiles%rowtype; v_target public.profiles%rowtype;
begin
  select * into v_actor from public.profiles where id = auth.uid();
  select * into v_target from public.profiles where id = p_target_id;
  if not exists (select 1 from public.faction_roles where user_id = v_actor.id and faction_id = v_actor.faction_id and role = 'leader') then raise exception 'Apenas o líder pode promover um curador'; end if;
  if not exists (select 1 from public.faction_roles where user_id = v_target.id and faction_id = v_actor.faction_id and role = 'curator') then raise exception 'O usuário precisa ser um curador da sua facção'; end if;
  delete from public.faction_roles where user_id in (v_actor.id, v_target.id);
  insert into public.faction_roles(user_id, faction_id, role, slot) values (v_target.id, v_actor.faction_id, 'leader', 1);
  update public.profiles set plan = 'premium' where id = v_target.id and plan = 'free';
  perform public.ensure_faction_leadership(v_actor.faction_id);
end;
$$;
grant execute on function public.promote_faction_curator(uuid) to authenticated;

create or replace function public.current_faction_season()
returns public.faction_seasons
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_season public.faction_seasons%rowtype;
  v_start date := date_trunc('month', current_date)::date;
begin
  select * into v_season from public.faction_seasons where season_key = v_start;
  if not found then
    insert into public.faction_seasons (season_key, starts_at, ends_at)
    values (v_start, v_start::timestamptz, (v_start + interval '1 month')::timestamptz)
    on conflict (season_key) do nothing;
    select * into v_season from public.faction_seasons where season_key = v_start;
  end if;
  return v_season;
end;
$$;

create or replace function public.get_faction_achievements(p_faction_id text)
returns table(
  achievement_id bigint,
  achievement_key text,
  name text,
  description text,
  icon text,
  metric text,
  threshold integer,
  progress integer,
  unlocked boolean,
  unlocked_at timestamptz
)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare
  v_season public.faction_seasons%rowtype;
begin
  if not exists (select 1 from public.factions where id = p_faction_id) then return; end if;
  v_season := public.current_faction_season();
  with metrics as (
    select a.id,
      case a.metric
        when 'xp' then coalesce((select sum(xp) from public.faction_xp_events where season_id = v_season.id and faction_id = p_faction_id), 0)
        when 'members' then (select count(*) from public.faction_memberships where faction_id = p_faction_id)
        when 'mandatory_readers' then (select count(distinct progress.user_id) from public.faction_mandatory_reads reads join public.reading_progress progress on progress.item_id = reads.item_id join public.profiles member on member.id = progress.user_id and member.faction_id = p_faction_id where reads.season_id = v_season.id and reads.faction_id = p_faction_id)
        else (select count(*) from public.faction_xp_events where season_id = v_season.id and faction_id = p_faction_id and event_type = a.metric)
      end::integer as progress
    from public.faction_achievements a
  )
  insert into public.faction_achievement_awards(faction_id, season_id, achievement_id)
  select p_faction_id, v_season.id, metrics.id
  from metrics join public.faction_achievements a on a.id = metrics.id
  where metrics.progress >= a.threshold
  on conflict (faction_id, season_id, achievement_id) do nothing;

  return query
  with metrics as (
    select a.id,
      case a.metric
        when 'xp' then coalesce((select sum(xp) from public.faction_xp_events where season_id = v_season.id and faction_id = p_faction_id), 0)
        when 'members' then (select count(*) from public.faction_memberships where faction_id = p_faction_id)
        when 'mandatory_readers' then (select count(distinct progress.user_id) from public.faction_mandatory_reads reads join public.reading_progress progress on progress.item_id = reads.item_id join public.profiles member on member.id = progress.user_id and member.faction_id = p_faction_id where reads.season_id = v_season.id and reads.faction_id = p_faction_id)
        else (select count(*) from public.faction_xp_events where season_id = v_season.id and faction_id = p_faction_id and event_type = a.metric)
      end::integer as progress
    from public.faction_achievements a
  )
  select a.id, a.achievement_key, a.name, a.description, a.icon, a.metric, a.threshold,
    least(metrics.progress, a.threshold), metrics.progress >= a.threshold, case when metrics.progress >= a.threshold then awards.unlocked_at else null end
  from metrics
  join public.faction_achievements a on a.id = metrics.id
  left join public.faction_achievement_awards awards on awards.faction_id = p_faction_id and awards.season_id = v_season.id and awards.achievement_id = a.id
  order by a.created_at desc, a.sort_order, a.id;
end;
$$;
grant execute on function public.get_faction_achievements(text) to anon, authenticated;

create or replace function public.choose_faction(p_faction_id text default null)
returns table(faction_id text, name text, color text, emblem text, description text, changed_at timestamptz)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_target text;
  v_changed timestamptz;
  v_season public.faction_seasons%rowtype;
  v_result_faction_id text;
  v_result_name text;
  v_result_color text;
  v_result_emblem text;
  v_result_description text;
  v_result_changed_at timestamptz;
begin
  if v_user_id is null then return; end if;
  select * into v_profile from public.profiles where id = v_user_id;
  if not found or v_profile.plan not in ('free', 'premium') then return; end if;
  if v_profile.faction_id is not null then
    if p_faction_id is null or p_faction_id = v_profile.faction_id then
      select f.id, f.name, f.color, f.emblem, f.description, v_profile.faction_changed_at into v_result_faction_id, v_result_name, v_result_color, v_result_emblem, v_result_description, v_result_changed_at from public.factions f where f.id = v_profile.faction_id;
      faction_id := v_result_faction_id; name := v_result_name; color := v_result_color; emblem := v_result_emblem; description := v_result_description; changed_at := v_result_changed_at;
      return next; return;
    end if;
    if v_profile.faction_changed_at is not null and v_profile.faction_changed_at > now() - interval '7 days' then
      raise exception 'Você só pode trocar de facção uma vez por semana';
    end if;
  end if;
  if p_faction_id is not null and exists (select 1 from public.factions where id = p_faction_id) then
    if exists (select 1 from public.faction_bans bans where bans.faction_id = p_faction_id and bans.user_id = v_user_id) then raise exception 'Você não pode entrar novamente nesta facção'; end if;
    v_target := p_faction_id;
  else
    with counts as (
      select f.id, count(m.user_id)::bigint as members,
        coalesce(sum(case when x.created_at >= now() - interval '7 days' then x.xp else 0 end), 0)::bigint as activity
      from public.factions f
      left join public.faction_memberships m on m.faction_id = f.id
      left join public.faction_xp_events x on x.faction_id = f.id
      group by f.id
    ) select id into v_target from counts where not exists (select 1 from public.faction_bans b where b.faction_id = counts.id and b.user_id = v_user_id) order by members asc, activity asc, random() limit 1;
  end if;
  if v_profile.faction_id is not null and v_profile.faction_id is distinct from v_target then
    v_season := public.current_faction_season();
    insert into public.faction_xp_events(season_id, faction_id, user_id, event_type, event_key, xp)
    values (v_season.id, v_profile.faction_id, v_user_id, 'desertion', 'desertion:' || v_user_id::text || ':' || clock_timestamp()::text, -25);
    insert into public.profile_xp_events(user_id, event_type, event_key, xp)
    values (v_user_id, 'desertion', 'faction-desertion:' || v_user_id::text || ':' || clock_timestamp()::text, -50);
    update public.profiles
    set xp = greatest(0, xp - 50),
        level = public.profile_level_for_xp(greatest(0, xp - 50))
    where id = v_user_id;
    delete from public.faction_roles where user_id = v_user_id;
  end if;
  delete from public.faction_memberships where user_id = v_user_id;
  insert into public.faction_memberships (user_id, faction_id, joined_at, changed_at)
  values (v_user_id, v_target, coalesce(v_profile.faction_joined_at, now()), case when v_profile.faction_id is null then null else now() end);
  update public.profiles as profile set faction_id = v_target, faction_joined_at = coalesce(profile.faction_joined_at, now()), faction_changed_at = case when profile.faction_id is null then null else now() end where profile.id = v_user_id;
  -- Só repara a facção anterior depois de remover definitivamente o desertor.
  -- Caso contrário, ele ainda era candidato e podia receber um cargo antigo.
  if v_profile.faction_id is not null and v_profile.faction_id is distinct from v_target then
    perform public.ensure_faction_leadership(v_profile.faction_id);
  end if;
  -- O perfil agora já aponta para a nova facção; preenche imediatamente
  -- qualquer vaga com o membro elegível mais ativo.
  perform public.ensure_faction_leadership(v_target);
  select f.id, f.name, f.color, f.emblem, f.description, p.faction_changed_at into v_result_faction_id, v_result_name, v_result_color, v_result_emblem, v_result_description, v_result_changed_at from public.factions f join public.profiles p on p.faction_id = f.id where f.id = v_target and p.id = v_user_id;
  faction_id := v_result_faction_id; name := v_result_name; color := v_result_color; emblem := v_result_emblem; description := v_result_description; changed_at := v_result_changed_at;
  return next;
end;
$$;
grant execute on function public.choose_faction(text) to authenticated;

create or replace function public.grant_faction_xp(p_event_type text, p_event_key text default null)
returns integer language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_faction text;
  v_season public.faction_seasons%rowtype;
  v_xp integer;
  v_key text;
  v_total integer;
begin
  select profile.faction_id into v_faction from public.profiles profile where profile.id = v_user_id and profile.plan not in ('moderator', 'banca', 'admin');
  if v_faction is null then return 0; end if;
  v_xp := case p_event_type when 'read' then 10 when 'curated_read' then 25 when 'comment' then 5 when 'like' then 2 when 'chat' then 3 when 'follow' then 2 else 0 end;
  if v_xp <= 0 then return 0; end if;
  v_season := public.current_faction_season();
  v_key := coalesce(nullif(trim(p_event_key), ''), p_event_type || ':' || clock_timestamp()::text);
  insert into public.faction_xp_events(season_id, faction_id, user_id, event_type, event_key, xp)
  values (v_season.id, v_faction, v_user_id, p_event_type, v_key, v_xp)
  on conflict (season_id, user_id, event_key) do nothing;
  if not found then return 0; end if;
  select coalesce(sum(events.xp), 0) into v_total from public.faction_xp_events events where events.season_id = v_season.id and events.faction_id = v_faction;
  perform public.ensure_faction_leadership(v_faction);
  return v_total;
end;
$$;
grant execute on function public.grant_faction_xp(text, text) to authenticated;

alter table public.factions enable row level security;
alter table public.faction_memberships enable row level security;
alter table public.faction_seasons enable row level security;
alter table public.faction_xp_events enable row level security;
alter table public.faction_roles enable row level security;
alter table public.faction_bans enable row level security;
alter table public.faction_moderation_actions enable row level security;
alter table public.faction_xp_adjustments enable row level security;
alter table public.faction_achievements enable row level security;
alter table public.faction_achievement_awards enable row level security;
alter table public.faction_catalogs enable row level security;
alter table public.faction_catalog_likes enable row level security;
alter table public.faction_catalog_saves enable row level security;
alter table public.faction_abafac_catalogs enable row level security;
alter table public.faction_abafac_images enable row level security;
drop policy if exists "factions are public" on public.factions;
drop policy if exists "faction memberships are public" on public.faction_memberships;
drop policy if exists "faction seasons are public" on public.faction_seasons;
drop policy if exists "faction xp is public" on public.faction_xp_events;
drop policy if exists "faction roles are public" on public.faction_roles;
drop policy if exists "faction bans are visible to staff" on public.faction_bans;
drop policy if exists "faction moderation is visible to staff" on public.faction_moderation_actions;
drop policy if exists "faction xp adjustments are visible to staff" on public.faction_xp_adjustments;
drop policy if exists "faction achievements are public" on public.faction_achievements;
drop policy if exists "faction achievement awards are public" on public.faction_achievement_awards;
drop policy if exists "faction abafac images are public" on public.faction_abafac_images;
drop policy if exists "faction catalogs are public" on public.faction_abafac_catalogs;
drop policy if exists "faction managers create catalogs" on public.faction_abafac_catalogs;
drop policy if exists "faction managers delete catalogs" on public.faction_abafac_catalogs;
drop policy if exists "faction catalogs are public" on public.faction_catalogs;
drop policy if exists "faction catalog likes are public" on public.faction_catalog_likes;
drop policy if exists "users manage faction catalog likes" on public.faction_catalog_likes;
drop policy if exists "faction catalog saves are public" on public.faction_catalog_saves;
drop policy if exists "users manage faction catalog saves" on public.faction_catalog_saves;
drop policy if exists "faction managers create abafac images" on public.faction_abafac_images;
drop policy if exists "faction managers delete abafac images" on public.faction_abafac_images;
create policy "factions are public" on public.factions for select using (true);
create policy "faction memberships are public" on public.faction_memberships for select using (true);
create policy "faction seasons are public" on public.faction_seasons for select using (true);
create policy "faction xp is public" on public.faction_xp_events for select using (true);
create policy "faction roles are public" on public.faction_roles for select using (true);
create policy "faction bans are visible to staff" on public.faction_bans for select using (public.is_moderator() or auth.uid() = user_id or auth.uid() = banned_by);
create policy "faction moderation is visible to staff" on public.faction_moderation_actions for select using (public.is_moderator() or auth.uid() = target_id or auth.uid() = actor_id);
create policy "faction xp adjustments are visible to staff" on public.faction_xp_adjustments for select using (public.is_moderator());
create policy "faction achievements are public" on public.faction_achievements for select using (true);
create policy "faction achievement awards are public" on public.faction_achievement_awards for select using (true);

-- Conquistas de figurinhas (a lógica dos eventos está na migration correspondente).
insert into public.faction_achievements (achievement_key, name, description, icon, metric, threshold, sort_order) values
  ('faction_sticker_collectors', 'Álbum compartilhado', 'A facção precisa conquistar 100 figurinhas na temporada. Vale obter por leitura, sorte, doação ou troca.', '🎴', 'sticker', 100, 10),
  ('faction_sticker_donors', 'Mãos generosas', 'Membros da facção precisam realizar 25 doações de figurinhas na temporada.', '🎁', 'sticker_donate', 25, 11),
  ('faction_sticker_traders', 'Mercadores da banca', 'Membros da facção precisam concluir 25 trocas de figurinhas na temporada.', '🔄', 'sticker_trade', 25, 12)
on conflict (achievement_key) do update set name = excluded.name, description = excluded.description, icon = excluded.icon, metric = excluded.metric, threshold = excluded.threshold, sort_order = excluded.sort_order;
create policy "faction catalogs are public" on public.faction_catalogs for select using (true);
create policy "faction catalog likes are public" on public.faction_catalog_likes for select using (true);
create policy "users manage faction catalog likes" on public.faction_catalog_likes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "faction catalog saves are public" on public.faction_catalog_saves for select using (auth.uid() = user_id);
create policy "users manage faction catalog saves" on public.faction_catalog_saves for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "faction catalogs are public" on public.faction_abafac_catalogs for select using (true);
create policy "faction managers create catalogs" on public.faction_abafac_catalogs for insert with check (
  auth.uid() = created_by and (public.is_admin() or exists (
    select 1 from public.faction_roles where user_id = auth.uid() and faction_id = faction_abafac_catalogs.faction_id and role in ('leader', 'curator')
  ))
);
create policy "faction managers delete catalogs" on public.faction_abafac_catalogs for delete using (
  public.is_admin() or exists (
    select 1 from public.faction_roles
    where user_id = auth.uid()
      and faction_id = faction_abafac_catalogs.faction_id
      and role in ('leader', 'curator')
  )
);
create policy "faction abafac images are public" on public.faction_abafac_images for select using (true);
create policy "faction managers create abafac images" on public.faction_abafac_images for insert with check (
  auth.uid() = created_by and exists (select 1 from public.faction_roles where user_id = auth.uid() and faction_id = faction_abafac_images.faction_id and role in ('leader', 'curator'))
);
create policy "faction managers delete abafac images" on public.faction_abafac_images for delete using (
  exists (select 1 from public.faction_roles where user_id = auth.uid() and faction_id = faction_abafac_images.faction_id and role in ('leader', 'curator'))
);

create or replace function public.protect_profile_progress()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if current_user not in ('postgres', 'service_role') then
    new.xp := old.xp;
    new.level := old.level;
    new.daily_streak := old.daily_streak;
    new.last_checkin_at := old.last_checkin_at;
    new.faction_id := old.faction_id;
    new.faction_joined_at := old.faction_joined_at;
    new.faction_changed_at := old.faction_changed_at;
  end if;
  return new;
end;
$$;

-- Salas de cada facção. A política de envio é adicionada abaixo.
insert into public.chat_rooms (id, name, access) values
  ('faccao-aurora-rubra', 'Maravilhas', 'faction'),
  ('faccao-vigilia-cobalto', 'Legado', 'faction'),
  ('faccao-forja-dourada', 'Ruptura', 'faction'),
  ('faccao-nevoa-violeta', 'Horizonte', 'faction')
on conflict (id) do update set name = excluded.name, access = excluded.access;

alter table public.chat_rooms add column if not exists faction_id text references public.factions(id) on delete cascade;
update public.chat_rooms set faction_id = replace(id, 'faccao-', '') where id like 'faccao-%';

create or replace function public.can_access_chat_room(p_room_id text)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.chat_rooms room
    left join public.profiles profile on profile.id = auth.uid()
    where room.id = p_room_id and (
      (room.access = 'public' and (room.faction_id is null or profile.plan in ('moderator', 'banca', 'admin') or profile.faction_id = room.faction_id))
      or (room.access = 'premium' and profile.plan in ('premium', 'admin'))
      or (room.access = 'staff' and profile.plan in ('moderator', 'banca', 'admin'))
    )
  )
$$;

create or replace function public.can_send_chat_room(p_room_id text)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.chat_rooms room
    left join public.profiles profile on profile.id = auth.uid()
    where room.id = p_room_id and profile.id = auth.uid() and (
      (room.access = 'public' and (room.faction_id is null or profile.plan in ('moderator', 'banca', 'admin') or profile.faction_id = room.faction_id))
      or (room.access = 'premium' and (profile.plan in ('premium', 'admin') or (profile.plan = 'free' and public.is_legendary_event_active())))
      or (room.access = 'staff' and profile.plan in ('moderator', 'banca', 'admin'))
    )
  )
$$;

create or replace function public.can_access_chat_room(p_room_id text)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.chat_rooms room
    left join public.profiles profile on profile.id = auth.uid()
    where room.id = p_room_id and (
      (room.access = 'public' and room.faction_id is null)
      or (room.access = 'faction' and (profile.plan in ('moderator', 'banca', 'admin') or profile.faction_id = room.faction_id))
      or (room.access = 'premium' and (profile.plan in ('premium', 'admin') or (profile.plan = 'free' and public.is_legendary_event_active())))
      or (room.access = 'staff' and profile.plan in ('moderator', 'banca', 'admin'))
    )
  )
$$;

create or replace function public.can_send_chat_room(p_room_id text)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.chat_rooms room
    left join public.profiles profile on profile.id = auth.uid()
    where room.id = p_room_id and profile.id = auth.uid() and (
      (room.access = 'public' and room.faction_id is null)
      or (room.access = 'faction' and (profile.plan in ('moderator', 'banca', 'admin') or profile.faction_id = room.faction_id))
      or (room.access = 'premium' and (profile.plan in ('premium', 'admin') or (profile.plan = 'free' and public.is_legendary_event_active())))
      or (room.access = 'staff' and profile.plan in ('moderator', 'banca', 'admin'))
    )
  )
$$;

drop policy if exists "users send chat messages" on public.chat_messages;
create policy "users send chat messages" on public.chat_messages for insert with check (
  auth.uid() = sender_id
  and public.can_post_content('chat', body)
  and expires_at <= now() + interval '24 hours'
  and expires_at > now()
  and (
    (room_id is null and recipient_id is not null and auth.uid() <> recipient_id and exists (select 1 from public.profiles where id = recipient_id and allow_messages))
    or (room_id is not null and recipient_id is null and public.can_send_chat_room(room_id))
  )
);

-- Repara gestões que já existiam antes da criação automática de cargos.
do $$
declare v_faction record;
begin
  for v_faction in select id from public.factions loop
    perform public.ensure_faction_leadership(v_faction.id);
  end loop;
end;
$$;

-- Versao final da identidade: inclui todos os emojis disponiveis e impede duplicidade.
drop function if exists public.update_faction_identity(text, text, text, text, text);
create or replace function public.update_faction_identity(p_faction_id text, p_name text, p_color text, p_emblem text default '◆', p_description text default null)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if lower(coalesce(p_color, '')) not in ('#e85b68', '#a93345', '#5ca9e8', '#2d6295', '#e7b94b', '#9a6c12', '#ae79e8', '#6f3ca5', '#b8c2cc', '#59636f', '#ec8b55', '#a84c21', '#b8d957', '#6b821d', '#e17ab3', '#9b3f72') then raise exception 'Escolha uma cor da paleta'; end if;
  if coalesce(p_emblem, '') not in ('✦', '◈', '✹', '✧', '★', '◆', '⚡', '☾', '♛', '🛡️', '🔥', '🌀', '☀️', '🦉', '🐉', '🦅', '🐺', '🌿', '⚔️', '🧭') then raise exception 'Escolha um emoji da lista'; end if;
  if exists (select 1 from public.factions where id <> p_faction_id and lower(color) = lower(p_color)) then raise exception 'Essa cor ja pertence a outra faccao'; end if;
  if exists (select 1 from public.factions where id <> p_faction_id and emblem = p_emblem) then raise exception 'Esse emoji ja pertence a outra faccao'; end if;
  if not public.is_admin() and not exists (select 1 from public.faction_roles where user_id = auth.uid() and faction_id = p_faction_id and role = 'leader') then raise exception 'Apenas o lider pode editar a identidade da faccao'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 3 then raise exception 'Nome invalido'; end if;
  update public.factions set name = left(trim(p_name), 80), color = lower(p_color), emblem = p_emblem, description = nullif(left(trim(coalesce(p_description, '')), 500), '') where id = p_faction_id;
end;
$$;
grant execute on function public.update_faction_identity(text, text, text, text, text) to authenticated;
