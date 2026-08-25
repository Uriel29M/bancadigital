-- Execute este bloco no SQL Editor do Supabase para atualizar bancos já existentes.
create or replace function public.remove_faction_abafac_catalog(p_catalog_id bigint)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_catalog public.faction_abafac_catalogs%rowtype;
begin
  select * into v_catalog
  from public.faction_abafac_catalogs
  where id = p_catalog_id;
  if not found then raise exception 'Catalogo da abafac nao encontrado'; end if;
  if not exists (
    select 1 from public.faction_roles
    where user_id = auth.uid()
      and faction_id = v_catalog.faction_id
      and role in ('leader', 'curator')
  ) then
    raise exception 'Apenas lideres e curadores podem remover catalogos da abafac';
  end if;
  delete from public.faction_abafac_catalogs where id = p_catalog_id;
  update public.factions
  set abafac_order = coalesce((select jsonb_agg(item.value order by item.ordinality)
    from jsonb_array_elements(coalesce(abafac_order, '[]'::jsonb)) with ordinality item(value, ordinality)
    where item.value <> to_jsonb('catalog:' || p_catalog_id::text)), '[]'::jsonb)
  where id = v_catalog.faction_id;
end;
$$;

grant execute on function public.remove_faction_abafac_catalog(bigint) to authenticated;

alter table public.faction_abafac_catalogs enable row level security;
drop policy if exists "faction managers delete catalogs" on public.faction_abafac_catalogs;
create policy "faction managers delete catalogs" on public.faction_abafac_catalogs
for delete using (
  public.is_admin() or exists (
    select 1 from public.faction_roles
    where user_id = auth.uid()
      and faction_id = faction_abafac_catalogs.faction_id
      and role in ('leader', 'curator')
  )
);

notify pgrst, 'reload schema';
