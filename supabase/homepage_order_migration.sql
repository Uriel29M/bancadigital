-- Execute no SQL Editor do Supabase para habilitar a persistência global
-- da posição de "Escolhas da banca".

alter table public.homepage_settings
  alter column section_order set default '["recommendations", "character-banner", "continue", "recent", "new-series", "monthly", "pinned-publishers", "best-series", "featured-collections", "random", "tips", "artist", "random-publisher", "downloads", "most-read-covers"]'::jsonb;
alter table public.homepage_settings add column if not exists hidden_sections jsonb not null default '[]'::jsonb;

create or replace function public.update_homepage_section_order(p_order jsonb)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_required jsonb := '["recommendations", "character-banner", "continue", "recent", "new-series", "monthly", "pinned-publishers", "best-series", "featured-collections", "random", "tips", "artist", "random-publisher", "downloads", "most-read-covers", "editorial-banner"]'::jsonb;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and plan in ('banca', 'admin')
  ) then
    raise exception 'Apenas usuários banca ou administradores podem reorganizar a página inicial';
  end if;
  if jsonb_typeof(p_order) <> 'array'
     or jsonb_array_length(p_order) <> jsonb_array_length(v_required)
     or not (p_order @> v_required)
     or (select count(*) from jsonb_array_elements_text(p_order))
        <> (select count(distinct value) from jsonb_array_elements_text(p_order)) then
    raise exception 'A ordem da página inicial é inválida';
  end if;
  update public.homepage_settings
    set section_order = p_order, updated_at = now()
    where id = true;
end;
$$;

grant execute on function public.update_homepage_section_order(jsonb) to authenticated;

create or replace function public.update_homepage_section_visibility(p_section_key text, p_hidden boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_required jsonb := '["recommendations", "character-banner", "continue", "recent", "new-series", "monthly", "pinned-publishers", "best-series", "featured-collections", "random", "tips", "artist", "random-publisher", "downloads", "most-read-covers", "editorial-banner"]'::jsonb;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and plan in ('banca', 'admin')
  ) then
    raise exception 'Apenas usuários banca ou administradores podem ocultar seções da página inicial';
  end if;
  if p_section_key is null or not (v_required @> jsonb_build_array(p_section_key)) then
    raise exception 'Seção da página inicial inválida';
  end if;
  update public.homepage_settings
  set hidden_sections = case
    when coalesce(p_hidden, false) then (
      select jsonb_agg(value order by value)
      from (
        select distinct value
        from jsonb_array_elements_text(coalesce(hidden_sections, '[]'::jsonb))
        union
        select p_section_key
      ) entries
    )
    else (
      select coalesce(jsonb_agg(value order by value), '[]'::jsonb)
      from jsonb_array_elements_text(coalesce(hidden_sections, '[]'::jsonb))
      where value <> p_section_key
    )
  end,
  updated_at = now()
  where id = true;
end;
$$;
grant execute on function public.update_homepage_section_visibility(text, boolean) to authenticated;
