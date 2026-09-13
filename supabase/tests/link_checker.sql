begin;
do $$
declare
  v_item jsonb := '{"id":"link-checker-test-only","title":"Test","fileUrl":"https://example.invalid/dead.cbz","backupUrls":["https://example.invalid/good.cbz"]}';
  v_stamp timestamptz;
  v_claim jsonb;
  v_secret text;
  v_id uuid;
  v_plan text;
  v_count integer;
begin
  if has_function_privilege('authenticated', 'public.apply_link_checker_result(jsonb,timestamptz,text,text,text,text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.claim_link_checker_batch(text)', 'EXECUTE')
    or has_table_privilege('authenticated', 'private.link_checker_runtime', 'SELECT') then raise exception 'Bot permissions leaked'; end if;

  execute 'set local role service_role';
  update public.link_checker_settings set enabled = false where id;
  if public.apply_link_checker_result(v_item, null, 'hide') <> 'disabled' then raise exception 'Disabled bot changed catalog'; end if;
  update public.link_checker_settings set enabled = true where id;
  if public.apply_link_checker_result(v_item, null, 'hide') <> 'hidden' then raise exception 'Hide failed'; end if;
  if not exists(select 1 from public.catalog_item_visibility where item_id = v_item->>'id' and is_hidden and updated_by is null) then raise exception 'Wrong hidden state'; end if;
  if exists(select 1 from public.file_reports where item_id = v_item->>'id') then raise exception 'Hide created a report'; end if;
  delete from public.catalog_item_visibility where item_id = v_item->>'id';

  if public.apply_link_checker_result(v_item, null, 'swap', 'https://example.invalid/good.cbz', 'HTTP 404') <> 'swapped' then raise exception 'Swap failed'; end if;
  if not exists(select 1 from public.catalog_edition_overrides where item_id = v_item->>'id' and edition->>'fileUrl' = 'https://example.invalid/good.cbz' and edition->'backupUrls' = '["https://example.invalid/dead.cbz"]') then raise exception 'Wrong source swap'; end if;
  if not exists(select 1 from public.file_reports where item_id = v_item->>'id' and source = 'bot' and item_snapshot->>'fallbackUrl' = 'https://example.invalid/good.cbz') then raise exception 'Missing swap report'; end if;
  if public.apply_link_checker_result(v_item, null, 'hide') <> 'stale' then raise exception 'Stale probe changed catalog'; end if;
  select updated_at into v_stamp from public.catalog_edition_overrides where item_id = v_item->>'id';
  if public.apply_link_checker_result(v_item, v_stamp - interval '1 second', 'hide') <> 'stale' then raise exception 'Old version accepted'; end if;

  execute 'reset role';
  update private.link_checker_runtime set next_run_at = now() - interval '1 minute', lease_until = null where id;
  select secret::text into v_secret from private.link_checker_runtime where id;
  begin
    perform public.claim_link_checker_batch('wrong');
    raise exception 'Wrong secret accepted';
  exception when insufficient_privilege then null; end;
  v_claim := public.claim_link_checker_batch(v_secret);
  if v_claim->>'lease' is null then raise exception 'Batch not claimed'; end if;
  if not (public.claim_link_checker_batch(v_secret)->>'busy')::boolean then raise exception 'Overlapping batch accepted'; end if;
  perform public.finish_link_checker_batch((v_claim->>'lease')::uuid, 20);
  if (select next_offset from private.link_checker_runtime where id) <> 20 then raise exception 'Cursor not persisted'; end if;

  foreach v_plan in array array['free','premium','moderator','banca','admin'] loop
    v_id := gen_random_uuid();
    insert into auth.users(id,email,created_at,raw_user_meta_data)
      values(v_id,v_id::text || '@link-checker-test.invalid',now(),jsonb_build_object('username','links_' || left(replace(v_id::text,'-',''),12)));
    update public.profiles set plan=v_plan where id=v_id;
    perform set_config('request.jwt.claim.sub',v_id::text,true);
    execute 'set local role authenticated';
    select count(*) into v_count from public.link_checker_settings;
    if v_count <> (case when v_plan='admin' then 1 else 0 end) then raise exception 'Wrong read permission for %', v_plan; end if;
    update public.link_checker_settings set enabled = false where id;
    get diagnostics v_count = row_count;
    if v_count <> (case when v_plan='admin' then 1 else 0 end) then raise exception 'Wrong write permission for %', v_plan; end if;
    execute 'reset role';
  end loop;
end;
$$;
rollback;
