-- Run as postgres. All test identities and changes are rolled back.
begin;
do $$
declare
  v_user uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
  v_name text := 'secure_' || left(replace(v_user::text, '-', ''), 12);
  v_other_name text := 'secure_' || left(replace(v_other::text, '-', ''), 12);
  v_admin_name text := 'secure_' || left(replace(v_admin::text, '-', ''), 12);
  v_column text;
  v_count integer;
begin
  insert into auth.users(id, email, raw_user_meta_data) values
    (v_user, v_user::text || '@security.invalid', jsonb_build_object('username', v_name)),
    (v_other, v_other::text || '@security.invalid', jsonb_build_object('username', v_other_name)),
    (v_admin, v_admin::text || '@security.invalid', jsonb_build_object('username', v_admin_name));
  update public.profiles set plan = 'admin' where id = v_admin;
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  set local role authenticated;
  foreach v_column in array array['plan','is_banned','silenced_until',
    'profile_hidden','title','title_color','xp','level','daily_streak','last_checkin_at',
    'faction_id','faction_joined_at','faction_changed_at','id','created_at',
    'is_bot','is_official','bot_type','profile_sticker_award_id'] loop
    if has_column_privilege('authenticated', 'public.profiles', v_column, 'UPDATE') then
      raise exception 'Unexpected UPDATE privilege: %', v_column;
    end if;
    begin
      execute format('update public.profiles set %I = %I where id = $1', v_column, v_column) using v_user;
      raise exception 'Protected update succeeded: %', v_column;
    exception when insufficient_privilege then null;
    end;
  end loop;
  begin
    update public.profiles set plan = 'admin' where id = v_user;
    raise exception 'Escalation succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.profiles(id, username, plan) values(gen_random_uuid(), 'illegal_admin', 'admin');
    raise exception 'Direct insert succeeded';
  exception when insufficient_privilege then null;
  end;
  update public.profiles set wall_description = 'security test', avatar_url = 'https://example.com/avatar.png',
    allow_mentions = false, profile_accent_theme = 'blue' where id = v_user;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Own profile edit failed'; end if;
  update public.profiles set wall_description = 'illegal' where id = v_other;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'Other profile edited'; end if;
  begin
    perform public.set_user_plan(v_name, 'admin');
    raise exception 'Unprivileged plan RPC succeeded' using errcode = 'ZX001';
  exception when raise_exception then null;
  end;
  begin
    perform public.moderate_user(v_name, 'unban');
    raise exception 'Unprivileged moderation succeeded' using errcode = 'ZX001';
  exception when raise_exception then null;
  end;
  perform public.touch_profile();
  perform public.daily_profile_checkin();
  reset role;
  if not exists(select 1 from public.profiles where id=v_user and xp>0 and daily_streak>0) then
    raise exception 'Trusted progression RPC broken';
  end if;
  perform set_config('request.jwt.claim.sub', '', true);
  set local role authenticated;
  begin
    perform public.set_user_plan(v_name, 'admin');
    raise exception 'Missing identity passed RPC authorization' using errcode = 'ZX001';
  exception when raise_exception then null;
  end;
  reset role;
  if has_function_privilege('anon','public.set_user_plan(text,text)','EXECUTE') then raise exception 'Anonymous plan RPC granted'; end if;
  if has_function_privilege('anon','public.moderate_user(text,text,text,text,text,text,text)','EXECUTE') then raise exception 'Anonymous moderation RPC granted'; end if;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  perform public.set_user_plan(v_name, 'premium');
  perform public.moderate_user(v_name, 'ban');
  perform public.moderate_user(v_name, 'title', null, 'Test', '#ffffff');
  reset role;
  if not exists(select 1 from public.profiles where id=v_user and plan='premium' and is_banned and title='Test') then
    raise exception 'Authorized administrative RPCs failed';
  end if;
end $$;
rollback;
