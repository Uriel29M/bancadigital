create or replace function public.update_homepage_section_page(
  p_section_key text,
  p_page text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.profiles
    where id = auth.uid() and plan in ('banca', 'admin')
  ) then
    raise exception 'Apenas usuários banca ou administradores podem mover seções entre páginas';
  end if;

  if p_section_key is null
     or length(p_section_key) > 100
     or p_section_key !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Identificador de seção inválido';
  end if;

  if p_page is null or p_page not in ('home', 'comic') then
    raise exception 'Página de destino inválida';
  end if;

  update public.homepage_settings
  set section_pages = jsonb_set(
    coalesce(section_pages, '{}'::jsonb),
    array[p_section_key],
    to_jsonb(p_page),
    true
  ),
  updated_at = now()
  where id = true;
end;
$$;

revoke all on function public.update_homepage_section_page(text, text) from public, anon;
grant execute on function public.update_homepage_section_page(text, text) to authenticated;

notify pgrst, 'reload schema';
