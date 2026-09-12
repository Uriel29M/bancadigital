-- Run as postgres. Test accounts and all side effects are rolled back.
begin;
do $$
declare
  v_id uuid;
  v_plan text;
  v_case text;
  v_before bigint := (select count(*) from auth.users);
  v_past timestamptz := now() - interval '31 days';
begin
  foreach v_plan in array array['admin','moderator','banca','premium'] loop
    v_id := gen_random_uuid();
    insert into auth.users(id, email, created_at, last_sign_in_at, raw_user_meta_data)
      values(v_id, v_id::text || '@retention-test.invalid', v_past, v_past,
        jsonb_build_object('username', 'retention_' || left(replace(v_id::text,'-',''),12)));
    update public.profiles set plan=v_plan, created_at=v_past,last_seen_at=v_past where id=v_id;
    if exists(select 1 from private.inactive_free_account_candidates() where user_id=v_id)
      or private.delete_inactive_free_account(v_id) then
      raise exception 'Protected plan deleted or selected: %',v_plan;
    end if;
  end loop;

  foreach v_case in array array['inactive','recent_seen','recent_login','recent_signup','boundary','upgraded','active_session'] loop
    v_id := gen_random_uuid();
    insert into auth.users(id,email,created_at,last_sign_in_at,raw_user_meta_data)
      values(v_id,v_id::text || '@retention-test.invalid',v_past,v_past,
        jsonb_build_object('username','retention_' || left(replace(v_id::text,'-',''),12)));
    update public.profiles set plan='free',created_at=v_past,last_seen_at=v_past where id=v_id;
    if v_case='recent_seen' then update public.profiles set last_seen_at=now() where id=v_id;
    elsif v_case='recent_login' then update auth.users set last_sign_in_at=now() where id=v_id;
    elsif v_case='recent_signup' then update auth.users set created_at=now() where id=v_id;
    elsif v_case='boundary' then update public.profiles set last_seen_at=now()-interval '30 days' where id=v_id;
    elsif v_case='upgraded' then
      if not exists(select 1 from private.inactive_free_account_candidates() where user_id=v_id) then raise exception 'Missing candidate'; end if;
      update public.profiles set plan='premium' where id=v_id;
    end if;
    insert into auth.sessions(id,user_id,created_at,updated_at,refreshed_at)
      values(gen_random_uuid(),v_id,v_past,case when v_case='active_session' then now() else v_past end,
        (case when v_case='active_session' then now() else v_past end) at time zone 'UTC');
    if v_case='inactive' then
      if not exists(select 1 from private.inactive_free_account_candidates() where user_id=v_id) then raise exception 'Inactive free account not selected'; end if;
      perform private.purge_inactive_free_accounts();
      if not exists(select 1 from auth.users where id=v_id) then raise exception 'Dry run deleted a user'; end if;
      if not private.delete_inactive_free_account(v_id) then raise exception 'Inactive free account not deleted'; end if;
      if exists(select 1 from public.profiles where id=v_id) or exists(select 1 from auth.sessions where user_id=v_id) then raise exception 'Profile/session not removed'; end if;
    else
      if exists(select 1 from private.inactive_free_account_candidates() where user_id=v_id)
        or private.delete_inactive_free_account(v_id) then raise exception 'Ineligible user selected/deleted: %',v_case; end if;
    end if;
  end loop;
  if (select count(*) from auth.users) <> v_before + 10 then raise exception 'Unexpected account count'; end if;
  if has_function_privilege('anon','private.purge_inactive_free_accounts(boolean)','EXECUTE')
    or has_function_privilege('authenticated','private.delete_inactive_free_account(uuid)','EXECUTE')
    or has_function_privilege('service_role','private.purge_inactive_free_accounts(boolean)','EXECUTE') then
    raise exception 'Purge must not be callable from the public API';
  end if;
end $$;
rollback;
