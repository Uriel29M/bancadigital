create table if not exists public.faction_pinned_public_collections (
  faction_id text not null references public.factions(id) on delete cascade,
  collection_id text not null references public.shelf_collections(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (faction_id, collection_id)
);

alter table public.faction_pinned_public_collections enable row level security;
drop policy if exists "faction pinned public collections are public" on public.faction_pinned_public_collections;
create policy "faction pinned public collections are public" on public.faction_pinned_public_collections for select using (true);

create or replace function public.toggle_faction_public_collection_pin(p_faction_id text, p_collection_id text, p_pinned boolean)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.faction_roles where faction_id = p_faction_id and user_id = auth.uid() and role in ('leader', 'curator')) then
    raise exception 'Apenas lideres e curadores podem destacar colecoes publicas';
  end if;
  if not exists (select 1 from public.shelf_collections where id = p_collection_id and is_public = true and collection_type = 'comic') then
    raise exception 'Colecao publica invalida';
  end if;
  if not exists (select 1 from public.faction_abafac_catalogs where faction_id = p_faction_id and catalog_url ilike '%' || p_collection_id || '%') then
    raise exception 'Esta colecao publica nao esta vinculada a esta faccao';
  end if;
  if p_pinned then
    insert into public.faction_pinned_public_collections (faction_id, collection_id, created_by)
    values (p_faction_id, p_collection_id, auth.uid())
    on conflict (faction_id, collection_id) do update set created_by = excluded.created_by;
  else
    delete from public.faction_pinned_public_collections where faction_id = p_faction_id and collection_id = p_collection_id;
  end if;
end;
$$;
grant execute on function public.toggle_faction_public_collection_pin(text, text, boolean) to authenticated;
