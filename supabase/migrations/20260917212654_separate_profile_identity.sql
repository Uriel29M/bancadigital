-- Auth owns the private email. Do not duplicate it in a public API relation.
drop function if exists public.get_login_email(text);
drop trigger if exists sync_profile_account_email on auth.users;
drop function if exists public.sync_profile_account_email();
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, username)
  values(new.id, coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)));
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
alter table public.profiles drop column if exists account_email;

-- Column grants also protect legacy embedded relationships (comments -> profiles).
-- No table-wide SELECT: newly added internal columns stay private by default.
revoke select on public.profiles from public, anon, authenticated;
do $$
declare v_all text; v_public text;
begin
  select string_agg(quote_ident(attname), ', ' order by attnum) into v_all
  from pg_attribute where attrelid='public.profiles'::regclass and attnum>0 and not attisdropped;
  execute format('revoke select (%s) on public.profiles from public, anon, authenticated', v_all);
  select string_agg(quote_ident(attname), ', ' order by attnum) into v_public
  from pg_attribute where attrelid='public.profiles'::regclass and attnum>0 and not attisdropped
    and attname=any(array[
      'id','username','avatar_url','title','title_color','plan','xp','level','daily_streak',
      'last_seen_at','faction_id','profile_color','wall_description','profile_banner_url',
      'profile_sticker_award_id','profile_background_theme','profile_accent_theme',
      'profile_hidden','is_banned','is_bot','is_official','bot_type',
      'shelf_saved_public','shelf_series_public','shelf_read_public','shelf_completed_public',
      'shelf_liked_public','shelf_blogs_public','likes_public','profile_wall_public',
      'shelf_saved_public_collections','profile_activity_public','shelf_categories',
      'shelf_sort_orders','shelf_section_order','shelf_collection_order','shelf_style','shelf_styles',
      'allow_mentions','allow_messages','allow_sticker_requests'
    ]);
  execute format('grant select (%s) on public.profiles to anon, authenticated', v_public);
  execute format('create or replace view public.profiles_public with (security_invoker=true, security_barrier=true) as select %s from public.profiles', v_public);
end $$;
revoke all on public.profiles_public from public, anon, authenticated;
grant select on public.profiles_public to anon, authenticated;

-- Only the signed-in owner receives internal account preferences/status.
create or replace function public.get_my_profile()
returns jsonb language sql stable security definer set search_path = '' as $$
  select to_jsonb(p) from public.profiles p where p.id=(select auth.uid());
$$;
revoke all on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated;

-- Staff can inspect moderation status without exposing it on public profiles.
create or replace function public.get_profile_moderation_status(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_moderator() then
    raise exception 'Acesso restrito à moderação' using errcode='42501';
  end if;
  return (select jsonb_build_object('silenced_until', p.silenced_until)
    from public.profiles p where p.id=p_user_id);
end $$;
revoke all on function public.get_profile_moderation_status(uuid) from public, anon;
grant execute on function public.get_profile_moderation_status(uuid) to authenticated;

-- Server-only identity lookup and persistent per-username attempt limit.
-- No username/password is logged; rate keys are hashes of normalized usernames.
create table if not exists private.username_login_attempts (
  key_hash text primary key,
  window_started_at timestamptz not null,
  attempts integer not null
);
alter table private.username_login_attempts enable row level security;
revoke all on private.username_login_attempts from public, anon, authenticated;
create or replace function public.resolve_username_login(p_username text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_email text; v_attempts integer; v_username text := lower(trim(p_username));
begin
  if v_username is null or v_username !~ '^[a-z0-9_]{3,24}$' then return null; end if;
  -- Only retain keys for actual accounts, avoiding unbounded anonymous inserts.
  select u.email into v_email from public.profiles p join auth.users u on u.id=p.id
    where lower(p.username)=v_username and not p.is_banned;
  if v_email is null then return null; end if;
  insert into private.username_login_attempts as a(key_hash,window_started_at,attempts)
    values(md5(v_username),now(),1)
  on conflict(key_hash) do update set
    window_started_at=case when a.window_started_at < now()-interval '15 minutes' then now() else a.window_started_at end,
    attempts=case when a.window_started_at < now()-interval '15 minutes' then 1 else a.attempts+1 end
  returning attempts into v_attempts;
  if v_attempts > 10 then return null; end if;
  return v_email;
end $$;
revoke all on function public.resolve_username_login(text) from public, anon, authenticated;
grant execute on function public.resolve_username_login(text) to service_role;
notify pgrst, 'reload schema';
