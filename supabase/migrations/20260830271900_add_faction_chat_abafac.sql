create or replace function public.update_faction_abafac_order(p_faction_id text, p_order jsonb)
returns void language plpgsql security definer set search_path = public
as $$
declare v_actor public.profiles%rowtype;
begin
  select * into v_actor from public.profiles where id = auth.uid();
  if v_actor.id is null or not exists (select 1 from public.faction_roles where user_id = auth.uid() and faction_id = p_faction_id and role in ('leader', 'curator')) then raise exception 'Apenas lideres e curadores podem reorganizar as abas da faccao'; end if;
  if jsonb_typeof(p_order) <> 'array' then raise exception 'Ordem de abas invalida'; end if;
  if not (p_order @> '["stats"]'::jsonb) then raise exception 'A aba de resumo da faccao e obrigatoria'; end if;
  if exists (select 1 from jsonb_array_elements_text(p_order) item(value) where not (item.value in ('stats', 'manifest', 'mural', 'missions', 'mandatory-reads', 'faction-chat', 'continue-reading', 'recently-added', 'featured-character', 'new-series', 'most-read-month', 'best-series', 'tips', 'random', 'artist', 'recommendations', 'random-publisher', 'downloads', 'most-read', 'pinned-imprints', 'pinned-characters', 'pinned-collections', 'achievements', 'hall', 'report', 'leadership', 'members') or (item.value = 'catalog' and exists (select 1 from public.factions where id = p_faction_id and nullif(trim(abafac_catalog_url), '') is not null)) or (item.value ~ '^image:[0-9]+$' and exists (select 1 from public.faction_abafac_images image where image.id = split_part(item.value, ':', 2)::bigint and image.faction_id = p_faction_id)) or (item.value ~ '^catalog:[0-9]+$' and exists (select 1 from public.faction_abafac_catalogs catalog where catalog.id = split_part(item.value, ':', 2)::bigint and catalog.faction_id = p_faction_id)) or (item.value ~ '^faction-catalog:[0-9]+$' and exists (select 1 from public.faction_catalogs catalog where catalog.id = split_part(item.value, ':', 2)::bigint and catalog.faction_id = p_faction_id)))) then raise exception 'A ordem possui abas invalidas'; end if;
  if (select count(*) from jsonb_array_elements_text(p_order)) <> (select count(distinct value) from jsonb_array_elements_text(p_order)) then raise exception 'A ordem possui abas repetidas'; end if;
  update public.factions set abafac_order = p_order where id = p_faction_id;
end;
$$;
grant execute on function public.update_faction_abafac_order(text, jsonb) to authenticated;

update public.factions
set abafac_order = coalesce(abafac_order, '[]'::jsonb) || '["faction-chat"]'::jsonb
where not coalesce(abafac_order, '[]'::jsonb) ? 'faction-chat';
