-- Execute no SQL Editor do Supabase para habilitar a persistência global
-- da posição de "Escolhas da banca".

alter table public.homepage_settings
  alter column section_order set default '["recommendations", "character-banner", "continue", "recent", "new-series", "monthly", "pinned-publishers", "best-series", "featured-collections", "random", "tips", "artist", "random-publisher", "downloads", "most-read-covers"]'::jsonb;

create or replace function public.update_homepage_section_order(p_order jsonb)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_required jsonb := '["recommendations", "character-banner", "continue", "recent", "new-series", "monthly", "pinned-publishers", "best-series", "featured-collections", "random", "tips", "artist", "random-publisher", "downloads", "most-read-covers"]'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem reorganizar a página inicial';
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
