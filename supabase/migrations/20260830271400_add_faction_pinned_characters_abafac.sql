create table if not exists public.faction_pinned_characters (
  faction_id text not null references public.factions(id) on delete cascade,
  character_key text not null,
  character_name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (faction_id, character_key)
);

alter table public.faction_pinned_characters enable row level security;
drop policy if exists "faction pinned characters are public" on public.faction_pinned_characters;
create policy "faction pinned characters are public" on public.faction_pinned_characters for select using (true);

create or replace function public.toggle_faction_character_pin(p_faction_id text, p_character_key text, p_character_name text, p_pinned boolean)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.faction_roles where faction_id = p_faction_id and user_id = auth.uid() and role in ('leader', 'curator')) then
    raise exception 'Apenas lideres e curadores podem destacar personagens';
  end if;
  if p_pinned then
    insert into public.faction_pinned_characters (faction_id, character_key, character_name, created_by)
    values (p_faction_id, lower(trim(p_character_key)), left(trim(p_character_name), 160), auth.uid())
    on conflict (faction_id, character_key) do update set character_name = excluded.character_name, created_by = excluded.created_by;
  else
    delete from public.faction_pinned_characters where faction_id = p_faction_id and character_key = lower(trim(p_character_key));
  end if;
end;
$$;
grant execute on function public.toggle_faction_character_pin(text, text, text, boolean) to authenticated;

drop function if exists public.update_faction_abafac_order(text, jsonb);
create or replace function public.update_faction_abafac_order(p_faction_id text, p_order jsonb)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not (public.is_admin() or exists (select 1 from public.faction_roles where faction_id = p_faction_id and user_id = auth.uid() and role in ('leader', 'curator'))) then
    raise exception 'Apenas lideres e curadores podem organizar as abafacs';
  end if;
  if jsonb_typeof(p_order) <> 'array' then raise exception 'A ordem das abafacs deve ser uma lista'; end if;
  if exists (select 1 from jsonb_array_elements_text(p_order) item(value) where not (item.value in ('stats', 'manifest', 'mural', 'missions', 'mandatory-reads', 'continue-reading', 'recently-added', 'featured-character', 'new-series', 'most-read-month', 'best-series', 'tips', 'random', 'artist', 'recommendations', 'random-publisher', 'downloads', 'most-read', 'pinned-imprints', 'pinned-characters', 'achievements', 'hall', 'report', 'leadership', 'members') or (item.value = 'catalog' and exists (select 1 from public.factions where id = p_faction_id and nullif(trim(abafac_catalog_url), '') is not null) or item.value ~ '^image:[0-9]+$' and exists (select 1 from public.faction_abafac_images image where image.id = split_part(item.value, ':', 2)::bigint and image.faction_id = p_faction_id) or item.value ~ '^catalog:[0-9]+$' and exists (select 1 from public.faction_abafac_catalogs catalog where catalog.id = split_part(item.value, ':', 2)::bigint and catalog.faction_id = p_faction_id) or item.value ~ '^faction-catalog:[0-9]+$' and exists (select 1 from public.faction_catalogs catalog where catalog.id = split_part(item.value, ':', 2)::bigint and catalog.faction_id = p_faction_id)))) then raise exception 'A ordem possui abas inválidas'; end if;
  update public.factions set abafac_order = p_order where id = p_faction_id;
end;
$$;
grant execute on function public.update_faction_abafac_order(text, jsonb) to authenticated;
