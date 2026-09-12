-- All temporary identities and scheduler changes are rolled back.
begin;
do $$
declare
  v_id uuid;
  v_plan text;
  v_original boolean := (select active from cron.job where jobname='purge-inactive-free-accounts');
begin
  foreach v_plan in array array['free','premium','moderator','banca','admin'] loop
    v_id := gen_random_uuid();
    insert into auth.users(id,email,created_at,raw_user_meta_data)
      values(v_id,v_id::text || '@retention-toggle-test.invalid',now(),jsonb_build_object('username','toggle_' || left(replace(v_id::text,'-',''),12)));
    update public.profiles set plan=v_plan where id=v_id;
    perform set_config('request.jwt.claim.sub',v_id::text,true);
    if v_plan='admin' then
      if public.get_inactive_account_cleanup_enabled() is distinct from v_original then raise exception 'Wrong initial status'; end if;
      if public.set_inactive_account_cleanup_enabled(false) is distinct from false then raise exception 'Disable failed'; end if;
      if (select active from cron.job where jobname='purge-inactive-free-accounts') then raise exception 'Scheduler still enabled'; end if;
      if public.get_inactive_account_cleanup_enabled() then raise exception 'Disabled state not persisted'; end if;
      if public.set_inactive_account_cleanup_enabled(true) is distinct from true then raise exception 'Enable failed'; end if;
      if not (select active from cron.job where jobname='purge-inactive-free-accounts') then raise exception 'Scheduler still disabled'; end if;
      begin
        perform public.set_inactive_account_cleanup_enabled(null);
        raise exception 'Null should fail';
      exception when null_value_not_allowed then null;
      end;
      perform public.set_inactive_account_cleanup_enabled(v_original);
    else
      begin
        perform public.get_inactive_account_cleanup_enabled();
        raise exception 'Read allowed for %',v_plan;
      exception when insufficient_privilege then null;
      end;
      begin
        perform public.set_inactive_account_cleanup_enabled(false);
        raise exception 'Write allowed for %',v_plan;
      exception when insufficient_privilege then null;
      end;
    end if;
  end loop;
  perform set_config('request.jwt.claim.sub','',true);
  begin
    perform public.set_inactive_account_cleanup_enabled(false);
    raise exception 'Anonymous change allowed';
  exception when insufficient_privilege then null;
  end;
  if has_function_privilege('anon','public.set_inactive_account_cleanup_enabled(boolean)','EXECUTE') then raise exception 'Anonymous function permission granted'; end if;
  if not has_function_privilege('authenticated','public.set_inactive_account_cleanup_enabled(boolean)','EXECUTE') then raise exception 'Authenticated role cannot call RPC'; end if;
  if (select active from cron.job where jobname='purge-inactive-free-accounts') is distinct from v_original then raise exception 'Original setting not restored'; end if;
end $$;
rollback;
