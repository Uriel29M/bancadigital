-- Synthetic accounts and setting changes never leave this transaction.
begin;
do $$
declare
  v_id uuid;
  v_kind text;
  v_scope text;
  v_plan text;
  v_email text;
  v_expected boolean;
  v_settings jsonb;
  v_enabled boolean := (select active from cron.job where jobname='purge-inactive-free-accounts' and username='postgres');
  v_past timestamptz := now() - interval '31 days';
begin
  if private.inactive_cleanup_email_matches('  ', 'with_email')
    or not private.inactive_cleanup_email_matches('  ', 'without_email')
    or not private.inactive_cleanup_email_matches(' USER@LOGIN.BANCA-DIGITAL.LOCAL ', 'without_email') then raise exception 'Incorrect email classification'; end if;
  foreach v_scope in array array['all','with_email','without_email'] loop
    update private.inactive_account_cleanup_settings set email_scope=v_scope where id;
    foreach v_kind in array array['real','internal','null'] loop
      v_id := gen_random_uuid();
      v_email := case v_kind when 'real' then v_id::text || '@email-scope-test.invalid' when 'internal' then v_id::text || '@login.banca-digital.local' else null end;
      insert into auth.users(id,email,created_at,last_sign_in_at,raw_user_meta_data)
        values(v_id,v_email,v_past,v_past,jsonb_build_object('username','scope_' || left(replace(v_id::text,'-',''),12)));
      update public.profiles set plan='free',created_at=v_past,last_seen_at=v_past where id=v_id;
      v_expected := v_scope='all' or (v_scope='with_email' and v_kind='real') or (v_scope='without_email' and v_kind<>'real');
      if exists(select 1 from private.inactive_free_account_candidates() where user_id=v_id) is distinct from v_expected then raise exception 'Incorrect candidate: %/%',v_scope,v_kind; end if;
      if private.delete_inactive_free_account(v_id) is distinct from v_expected then raise exception 'Incorrect delete: %/%',v_scope,v_kind; end if;
      if exists(select 1 from auth.users where id=v_id) is distinct from not v_expected then raise exception 'Unexpected account state'; end if;
    end loop;
  end loop;

  -- A real email added after candidate selection must protect the account.
  v_id := gen_random_uuid();
  insert into auth.users(id,email,created_at,last_sign_in_at,raw_user_meta_data)
    values(v_id,v_id::text || '@login.banca-digital.local',v_past,v_past,jsonb_build_object('username','scope_' || left(replace(v_id::text,'-',''),12)));
  update public.profiles set plan='free',created_at=v_past,last_seen_at=v_past where id=v_id;
  if not exists(select 1 from private.inactive_free_account_candidates() where user_id=v_id) then raise exception 'Missing no-email candidate'; end if;
  update auth.users set email=v_id::text || '@email-scope-test.invalid' where id=v_id;
  if private.delete_inactive_free_account(v_id) then raise exception 'Changed email ignored'; end if;
  update private.inactive_account_cleanup_settings set email_scope='with_email' where id;
  if not exists(select 1 from private.inactive_free_account_candidates() where user_id=v_id) then raise exception 'Missing real-email candidate'; end if;
  update private.inactive_account_cleanup_settings set email_scope='without_email' where id;
  if private.delete_inactive_free_account(v_id) then raise exception 'Changed scope ignored'; end if;

  foreach v_plan in array array['free','premium','moderator','banca','admin'] loop
    v_id := gen_random_uuid();
    insert into auth.users(id,email,created_at,raw_user_meta_data)
      values(v_id,v_id::text || '@email-scope-test.invalid',now(),jsonb_build_object('username','scope_' || left(replace(v_id::text,'-',''),12)));
    update public.profiles set plan=v_plan where id=v_id;
    perform set_config('request.jwt.claim.sub',v_id::text,true);
    execute 'set local role authenticated';
    if v_plan='admin' then
      foreach v_scope in array array['all','with_email','without_email'] loop
        v_settings := public.set_inactive_account_cleanup_settings(v_enabled,v_scope);
        if v_settings->>'email_scope' <> v_scope or (v_settings->>'enabled')::boolean is distinct from v_enabled then raise exception 'Setting not saved'; end if;
        if public.get_inactive_account_cleanup_settings() <> v_settings then raise exception 'Setting not persisted'; end if;
      end loop;
      begin
        perform public.set_inactive_account_cleanup_settings(v_enabled,'bad');
        raise exception 'Invalid scope accepted';
      exception when invalid_parameter_value then null; end;
      begin
        perform public.set_inactive_account_cleanup_settings(null,'all');
        raise exception 'Null enabled accepted';
      exception when null_value_not_allowed then null; end;
      if public.get_inactive_account_cleanup_settings()->>'email_scope' <> 'without_email' then raise exception 'Failed save changed scope'; end if;
    else
      begin
        perform public.get_inactive_account_cleanup_settings();
        raise exception 'Read allowed for %',v_plan;
      exception when insufficient_privilege then null; end;
      begin
        perform public.set_inactive_account_cleanup_settings(v_enabled,'all');
        raise exception 'Write allowed for %',v_plan;
      exception when insufficient_privilege then null; end;
    end if;
    execute 'reset role';
  end loop;
  if has_function_privilege('anon','public.get_inactive_account_cleanup_settings()','EXECUTE')
    or has_function_privilege('service_role','public.set_inactive_account_cleanup_settings(boolean,text)','EXECUTE')
    or has_table_privilege('authenticated','private.inactive_account_cleanup_settings','SELECT') then raise exception 'Setting privileges exposed'; end if;
  if (select active from cron.job where jobname='purge-inactive-free-accounts' and username='postgres') is distinct from v_enabled then raise exception 'Scheduler state changed'; end if;
end;
$$;
rollback;
