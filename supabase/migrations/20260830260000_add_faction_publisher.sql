-- Editora de identidade da facção, com vínculo exclusivo.
alter table public.factions add column if not exists publisher_name text;

create unique index if not exists factions_publisher_name_unique
  on public.factions (lower(trim(publisher_name)))
  where nullif(trim(publisher_name), '') is not null;

drop function if exists public.update_faction_identity_v2(text, text, text, text, text, text, text);

create or replace function public.update_faction_identity_v2(
  p_faction_id text,
  p_name text,
  p_color text,
  p_emblem text default '🦁',
  p_description text default null,
  p_catalog_url text default null,
  p_publisher_name text default null
)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() and not exists (
    select 1 from public.faction_roles
    where user_id = auth.uid() and faction_id = p_faction_id and role = 'leader'
  ) then
    raise exception 'Apenas o lider pode editar a identidade da faccao';
  end if;

  if nullif(trim(p_publisher_name), '') is not null and exists (
    select 1 from public.factions
    where id <> p_faction_id
      and lower(trim(publisher_name)) = lower(trim(p_publisher_name))
  ) then
    raise exception 'Essa editora ja foi definida por outra faccao';
  end if;

  perform public.update_faction_identity_v2(
    p_faction_id, p_name, p_color, p_emblem, p_description, p_catalog_url
  );

  update public.factions
    set publisher_name = nullif(left(trim(p_publisher_name), 160), '')
    where id = p_faction_id;
end;
$$;

grant execute on function public.update_faction_identity_v2(text, text, text, text, text, text, text) to authenticated;
