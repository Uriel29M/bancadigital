alter table public.homepage_settings
  add column if not exists section_pages jsonb not null default '{}'::jsonb;

create or replace function public.update_homepage_section_page(
  p_section_key text,
  p_page text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed jsonb := '["recommendations", "character-banner", "continue", "recent", "new-series", "monthly", "pinned-publishers", "best-series", "featured-collections", "random", "tips", "artist", "random-publisher", "downloads", "most-read-covers", "editorial-banner"]'::jsonb;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and plan in ('banca', 'admin')
  ) then
    raise exception 'Apenas usuários banca ou administradores podem mover seções entre páginas';
  end if;

  if p_section_key is null or not (v_allowed @> jsonb_build_array(p_section_key)) then
    raise exception 'Seção da página inicial inválida';
  end if;

  if p_page is null or p_page not in ('home', 'comic') then
    raise exception 'Página de destino inválida';
  end if;

  update public.homepage_settings
  set section_pages = case
    when p_page = 'home' then coalesce(section_pages, '{}'::jsonb) - p_section_key
    else jsonb_set(coalesce(section_pages, '{}'::jsonb), array[p_section_key], to_jsonb(p_page), true)
  end,
  updated_at = now()
  where id = true;
end;
$$;

revoke all on function public.update_homepage_section_page(text, text) from public, anon;
grant execute on function public.update_homepage_section_page(text, text) to authenticated;

notify pgrst, 'reload schema';
