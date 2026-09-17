begin;
do $$
declare
  v_user uuid := gen_random_uuid();
  v_hidden uuid := gen_random_uuid();
  v_username text := 'privacy_' || left(replace(v_user::text,'-',''),12);
  v_email text := v_user::text || '@privacy.invalid';
  v_json jsonb;
  v_role text;
  v_column text;
  v_attempt integer;
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (v_user,v_email,jsonb_build_object('username',v_username)),
    (v_hidden,v_hidden::text || '@privacy.invalid',jsonb_build_object('username','hidden_' || left(replace(v_hidden::text,'-',''),12)));
  update public.profiles set profile_hidden=true where id=v_hidden;
  if exists(select 1 from pg_attribute where attrelid='public.profiles'::regclass and attname='account_email' and not attisdropped) then
    raise exception 'Email remains in public relation';
  end if;
  if to_regprocedure('public.get_login_email(text)') is not null then raise exception 'Legacy email RPC remains'; end if;
  foreach v_role in array array['anon','authenticated'] loop
    perform set_config('request.jwt.claim.sub',case when v_role='authenticated' then v_user::text else '' end,true);
    execute format('set local role %I',v_role);
    select to_jsonb(p) into v_json from public.profiles_public p where id=v_user;
    if v_json->>'username' is distinct from v_username then raise exception 'Public profile inaccessible'; end if;
    if v_json ?| array['account_email','email','notifications_enabled','guria_proactive_enabled','silenced_until','last_checkin_at'] then
      raise exception 'Private column exposed';
    end if;
    if exists(select 1 from public.profiles_public where id=v_hidden) then raise exception 'Hidden profile leaked'; end if;
    foreach v_column in array array['notifications_enabled','guria_proactive_enabled','silenced_until','last_checkin_at','created_at','faction_changed_at'] loop
      begin
        execute format('select %I from public.profiles where id=$1',v_column) using v_user;
        raise exception 'Private column selectable: %',v_column using errcode='ZX001';
      exception when insufficient_privilege then null;
      end;
    end loop;
    begin
      perform public.resolve_username_login(v_username);
      raise exception 'Client resolved email' using errcode='ZX001';
    exception when insufficient_privilege then null;
    end;
    begin
      perform email from auth.users where id=v_user;
      raise exception 'Auth email exposed' using errcode='ZX001';
    exception when insufficient_privilege then null;
    end;
    if v_role='authenticated' then
      v_json:=public.get_my_profile();
      if v_json->>'id' is distinct from v_user::text or not v_json ? 'notifications_enabled' then raise exception 'Owner RPC failed'; end if;
      if v_json ? 'account_email' then raise exception 'Owner RPC retained email copy'; end if;
      update public.profiles set notifications_enabled=false where id=v_user;
      if (public.get_my_profile()->>'notifications_enabled')::boolean then raise exception 'Preference write failed'; end if;
      begin
        perform public.get_profile_moderation_status(v_hidden);
        raise exception 'Nonstaff read moderation status' using errcode='ZX001';
      exception when insufficient_privilege then null;
      end;
    end if;
    reset role;
  end loop;
  set local role service_role;
  if public.resolve_username_login(upper(v_username)) is distinct from v_email then raise exception 'Server lookup failed'; end if;
  reset role;
  update auth.users set email=v_user::text || '@confirmed.invalid' where id=v_user;
  set local role service_role;
  if public.resolve_username_login(v_username) is distinct from v_user::text || '@confirmed.invalid' then raise exception 'Server used stale email'; end if;
  for v_attempt in 3..10 loop
    if public.resolve_username_login(v_username) is null then raise exception 'Premature rate limit'; end if;
  end loop;
  if public.resolve_username_login(v_username) is not null then raise exception 'Rate limit missing'; end if;
  if public.resolve_username_login('missing_' || left(v_user::text,8)) is not null then raise exception 'Unknown identity resolved'; end if;
  reset role;
end $$;
rollback;
