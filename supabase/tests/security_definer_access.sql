-- Audit regression: all fixtures and side effects roll back.
begin;
do $$
declare
  v_actor uuid := gen_random_uuid();
  v_target uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
  v_role text;
  v_call text;
  v_faction text := 'rpc-audit-' || left(v_actor::text,8);
  v_signature regprocedure;
  v_count integer;
begin
  insert into auth.users(id,email,raw_user_meta_data)
    select id,id::text || '@rpc-audit.invalid',jsonb_build_object('username','rpc_' || left(replace(id::text,'-',''),12))
    from unnest(array[v_actor,v_target,v_admin]) id;
  update public.profiles set plan='admin' where id=v_admin;
  insert into public.factions(id,name,color,emblem,description)
    values(v_faction,v_faction,'#' || left(replace(v_actor::text,'-',''),6),v_faction,'Audit fixture');
  foreach v_role in array array['anon','authenticated'] loop
    perform set_config('request.jwt.claim.sub',case when v_role='authenticated' then v_actor::text else '' end,true);
    execute format('set local role %I',v_role);
    foreach v_call in array array[
      format('select public.create_notification(%L,''test'',''Forged'',''Forged'',%L)',v_target,v_admin),
      format('select public.record_community_activity(%L,''like'',''Forged'',''Forged'')',v_target),
      'select public.submit_bot_action(''fake'',''fake'',''Fake'',''Fake'')',
      'select public.process_expired_sticker_gums()',
      format('select public.ensure_faction_mandatory_reads(%L,''[{"id":"forged"}]''::jsonb)',v_faction)
    ] loop
      begin
        execute v_call;
        raise exception 'Unauthorized RPC succeeded: %',v_call using errcode='ZX001';
      exception when insufficient_privilege then null;
      end;
    end loop;
    -- Public rendering helpers still work after PUBLIC is revoked.
    perform public.is_admin();
    perform public.is_moderator();
    perform public.get_profile_ranking('week',1);
    perform public.get_faction_mandatory_reads(v_faction);
    reset role;
  end loop;
  -- Trigger functions are not public RPCs, but real user actions still invoke them.
  for v_signature in select oid::regprocedure from pg_proc
    where pronamespace='public'::regnamespace and prosecdef and prorettype='trigger'::regtype loop
    if has_function_privilege('anon',v_signature,'EXECUTE') or has_function_privilege('authenticated',v_signature,'EXECUTE') then
      raise exception 'Trigger exposed: %',v_signature;
    end if;
  end loop;
  perform set_config('request.jwt.claim.sub',v_actor::text,true);
  set local role authenticated;
  insert into public.profile_follows(follower_id,following_id) values(v_actor,v_target);
  insert into public.comic_likes(user_id,item_id) values(v_actor,'rpc-audit-item');
  reset role;
  if not exists(select 1 from public.notifications where user_id=v_target and actor_id=v_actor and type='follow') then
    raise exception 'Legitimate notification trigger failed';
  end if;
  if not exists(select 1 from public.community_activity where actor_id=v_actor and event_type='like') then
    raise exception 'Legitimate activity trigger failed';
  end if;
  -- No-profile/null comparisons must not grant faction-management authority.
  perform set_config('request.jwt.claim.sub','',true);
  set local role authenticated;
  foreach v_call in array array[
    format('select public.manage_faction_role(%L,''leader'',1)',v_target),
    format('select public.ensure_faction_leadership(%L)',v_faction),
    format('select public.ensure_faction_election(%L)',v_faction)
  ] loop
    begin
      execute v_call;
      raise exception 'Missing-identity bypass: %',v_call using errcode='ZX001';
    exception when insufficient_privilege then null;
    end;
  end loop;
  reset role;
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  set local role authenticated;
  perform public.ensure_faction_mandatory_reads(v_faction,'[{"id":"trusted","title":"Trusted"}]');
  reset role;
  if not exists(select 1 from public.faction_mandatory_reads where faction_id=v_faction and item_id='trusted') then
    raise exception 'Admin initialization failed';
  end if;
  set local role service_role;
  perform public.create_notification(v_target,'test','Service test','Service test',v_admin);
  perform public.record_community_activity(v_actor,'like','Service test','Service test');
  reset role;
end $$;
rollback;
