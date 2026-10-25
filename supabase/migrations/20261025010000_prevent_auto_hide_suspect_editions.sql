-- The automated link checker must never hide catalog editions. All suspicious sources need human review.
create or replace function public.apply_link_checker_result(
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
  if nullif(v_id, '') is null or p_action not in ('hide', 'review', 'swap') then
    raise exception 'Invalid link checker result';
  end if;
  select * into v_current from public.catalog_edition_overrides where item_id = v_id for update;
  v_exists := found;
  if (v_exists and v_current.updated_at is distinct from p_override_updated_at)
    or (not v_exists and p_override_updated_at is not null) then return 'stale'; end if;
  v_edition := p_item;
  if v_edition->>'catalogDeleted' = 'true' then return 'stale'; end if;
  if exists (select 1 from public.catalog_item_visibility where item_id = v_id and is_hidden) then return 'hidden'; end if;

  -- Backward compatible with an older worker that still sends "hide":
  -- suspicious sources must create an admin-review report, never hide an edition.
  if p_action in ('hide', 'review') then
    insert into public.file_reports(item_id, reporter_id, source, bot_name, item_snapshot, reason, status)
      values(
        v_id,
        null,
        'bot',
        'link-checker-bot',
        p_item || jsonb_build_object(
          'suspectedUnavailableSources',
          jsonb_build_array(
            nullif(btrim(coalesce(p_item->>'fileUrl', '')), ''),
            nullif(btrim(coalesce(p_item->>'telegramUrl', '')), '')
          ) || case
            when jsonb_typeof(p_item->'backupUrls') = 'array' then p_item->'backupUrls'
            else '[]'::jsonb
          end,
          'linkCheckerReason', coalesce(p_reason, '')
        ),
        left(
          'Revisão manual necessária. A edição foi mantida visível; nenhuma fonte foi removida. ' ||
          coalesce(p_reason, 'O verificador não confirmou uma fonte funcional.'),
          500
        ),
        'pending'
      )
      on conflict (item_id, bot_name) where status = 'pending' and source = 'bot'
      do update set item_snapshot = excluded.item_snapshot, reason = excluded.reason;
    return 'review';
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
