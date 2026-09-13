create table public.link_checker_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default true
);
insert into public.link_checker_settings (id, enabled) values (true, true);
alter table public.link_checker_settings enable row level security;
revoke all on public.link_checker_settings from anon, authenticated;
grant select, update on public.link_checker_settings to authenticated;
grant all on public.link_checker_settings to service_role;
create policy "admins read link checker settings" on public.link_checker_settings
  for select to authenticated using ((select public.is_admin()));
create policy "admins update link checker settings" on public.link_checker_settings
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Only the service role can apply a checked result. The setting and catalog
-- version are checked again in the same transaction as the resulting action.
create function public.apply_link_checker_result(
  p_item jsonb, p_override_updated_at timestamptz, p_action text,
  p_fallback_url text default null, p_reason text default '', p_fallback_format text default null
) returns text
language plpgsql security invoker set search_path = '' as $$
declare
  v_enabled boolean;
  v_current public.catalog_edition_overrides%rowtype;
  v_exists boolean;
  v_id text := p_item->>'id';
  v_edition jsonb;
  v_backups jsonb;
  v_count integer;
begin
  select enabled into v_enabled from public.link_checker_settings where id for share;
  if v_enabled is distinct from true then return 'disabled'; end if;
  if nullif(v_id, '') is null or p_action not in ('hide', 'swap') then
    raise exception 'Invalid link checker result';
  end if;
  select * into v_current from public.catalog_edition_overrides where item_id = v_id for update;
  v_exists := found;
  if (v_exists and v_current.updated_at is distinct from p_override_updated_at)
    or (not v_exists and p_override_updated_at is not null) then return 'stale'; end if;
  v_edition := p_item;
  if v_edition->>'catalogDeleted' = 'true' then return 'stale'; end if;
  if exists (select 1 from public.catalog_item_visibility where item_id = v_id and is_hidden) then return 'hidden'; end if;

  if p_action = 'hide' then
    insert into public.catalog_item_visibility(item_id, is_hidden, updated_by)
      values(v_id, true, null) on conflict (item_id) do nothing;
    get diagnostics v_count = row_count;
    return case when v_count = 1 then 'hidden' else 'skipped' end;
  end if;

  if nullif(p_fallback_url, '') is null or p_fallback_url !~ '^https?://' then
    raise exception 'Invalid fallback URL';
  end if;
  -- Preserve the failed primary as a backup for the administrator to review.
  select coalesce(jsonb_agg(url order by position), '[]'::jsonb) into v_backups
  from (
    select url, min(position) as position from jsonb_array_elements_text(
      jsonb_build_array(coalesce(v_edition->>'fileUrl', ''), coalesce(v_edition->>'telegramUrl', ''))
      || coalesce(v_edition->'backupUrls', '[]'::jsonb)
    ) with ordinality as entries(url, position)
    where url <> '' and url <> p_fallback_url group by url
  ) backups;
  v_edition := (v_edition - 'telegramUrl' - 'telegramFileId' - 'telegramFileName' - 'telegramFileSize')
    || jsonb_build_object('fileUrl', p_fallback_url, 'backupUrls', v_backups);
  if p_fallback_format in ('pdf', 'cbz', 'cbr', 'jpg', 'png') then
    v_edition := v_edition || jsonb_build_object('format', p_fallback_format);
  end if;
  if v_exists then
    update public.catalog_edition_overrides set edition = v_edition, updated_by = null where item_id = v_id;
  else
    insert into public.catalog_edition_overrides(item_id, edition, updated_by)
      values(v_id, v_edition, null) on conflict (item_id) do nothing;
    get diagnostics v_count = row_count;
    if v_count = 0 then return 'stale'; end if;
  end if;
  insert into public.file_reports(item_id, reporter_id, source, bot_name, item_snapshot, reason, status)
    values(v_id, null, 'bot', 'link-checker-bot',
      p_item || jsonb_build_object('failedUrl', case when nullif(p_item->>'telegramFileId', '') is not null then p_item->>'telegramUrl' else coalesce(nullif(p_item->>'fileUrl', ''), p_item->>'telegramUrl') end, 'fallbackUrl', p_fallback_url),
      left('Bot: link principal substituido pelo alternativo funcional. ' || coalesce(p_reason, ''), 500), 'pending')
    on conflict (item_id, bot_name) where status = 'pending' and source = 'bot'
    do update set item_snapshot = excluded.item_snapshot, reason = excluded.reason;
  return 'swapped';
end;
$$;
revoke all on function public.apply_link_checker_result(jsonb, timestamptz, text, text, text, text) from public, anon, authenticated;
grant execute on function public.apply_link_checker_result(jsonb, timestamptz, text, text, text, text) to service_role;

create extension if not exists pg_net with schema extensions;
create schema if not exists private;
create table private.link_checker_runtime (
  id boolean primary key default true check (id),
  secret uuid not null default gen_random_uuid(),
  next_offset integer not null default 0,
  next_run_at timestamptz not null default (date_trunc('day', now()) + interval '1 day 3 hours 17 minutes'),
  lease uuid,
  lease_until timestamptz
);
insert into private.link_checker_runtime(id) values (true);
revoke all on private.link_checker_runtime from public, anon, authenticated, service_role;

-- These two RPCs are exclusively for the service role, with no user session.
create function public.claim_link_checker_batch(p_secret text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_runtime private.link_checker_runtime%rowtype;
  v_lease uuid := gen_random_uuid();
begin
  select * into v_runtime from private.link_checker_runtime where id for update;
  if p_secret is distinct from v_runtime.secret::text then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  if not (select enabled from public.link_checker_settings where id) then return jsonb_build_object('disabled', true); end if;
  if v_runtime.next_run_at > now() or v_runtime.lease_until > now() then return jsonb_build_object('busy', true); end if;
  update private.link_checker_runtime set lease = v_lease, lease_until = now() + interval '3 minutes' where id;
  return jsonb_build_object('offset', v_runtime.next_offset, 'lease', v_lease);
end;
$$;
revoke all on function public.claim_link_checker_batch(text) from public, anon, authenticated;
grant execute on function public.claim_link_checker_batch(text) to service_role;

create function public.finish_link_checker_batch(p_lease uuid, p_next_offset integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update private.link_checker_runtime set
    next_offset = coalesce(p_next_offset, 0),
    next_run_at = case when p_next_offset is null then date_trunc('day', now()) + interval '1 day 3 hours 17 minutes' else now() end,
    lease = null, lease_until = null
  where id and lease = p_lease;
  if not found then raise exception 'Expired batch'; end if;
end;
$$;
revoke all on function public.finish_link_checker_batch(uuid, integer) from public, anon, authenticated;
grant execute on function public.finish_link_checker_batch(uuid, integer) to service_role;

create function private.schedule_link_checker_batch() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (select enabled from public.link_checker_settings where id) then return; end if;
  perform net.http_post(
    url := 'https://vqfmbpqurapcsuixgvql.supabase.co/functions/v1/link-checker-bot',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-link-checker-secret', runtime.secret::text),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) from private.link_checker_runtime runtime
  where runtime.id and runtime.next_run_at <= now() and (runtime.lease_until is null or runtime.lease_until <= now());
end;
$$;
revoke all on function private.schedule_link_checker_batch() from public, anon, authenticated, service_role;
select cron.schedule('link-checker-bot', '* * * * *', 'select private.schedule_link_checker_batch();');
