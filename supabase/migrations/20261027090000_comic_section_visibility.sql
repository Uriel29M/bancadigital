alter table public.homepage_settings
  add column if not exists comic_hidden_sections jsonb not null default '[]'::jsonb;

create or replace function public.replace_comic_hidden_sections(p_hidden_sections jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed jsonb := '["legendary","imprints","series","oneshots","publishers","characters","teams","collections","heroes","villains","antiheroes","support","uncategorized-characters"]'::jsonb;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and plan in ('banca', 'admin')
  ) then
    raise exception 'Apenas usuários banca ou administradores podem ocultar seções de Quadrinhos';
  end if;

  if jsonb_typeof(p_hidden_sections) is distinct from 'array' then
    raise exception 'A lista de seções ocultas é inválida';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(p_hidden_sections) as section_key(value)
    where not (v_allowed @> jsonb_build_array(value))
  ) then
    raise exception 'A lista contém uma seção de Quadrinhos inválida';
  end if;

  update public.homepage_settings
  set comic_hidden_sections = (
    select coalesce(jsonb_agg(value order by value), '[]'::jsonb)
    from (
      select distinct value
      from jsonb_array_elements_text(p_hidden_sections) as section_key(value)
    ) sections
  ),
  updated_at = now()
  where id = true;
end;
$$;

create or replace function public.update_comic_section_visibility(
  p_section_key text,
  p_hidden boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed jsonb := '["legendary","imprints","series","oneshots","publishers","characters","teams","collections","heroes","villains","antiheroes","support","uncategorized-characters"]'::jsonb;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and plan in ('banca', 'admin')
  ) then
    raise exception 'Apenas usuários banca ou administradores podem ocultar seções de Quadrinhos';
  end if;

  if p_section_key is null or not (v_allowed @> jsonb_build_array(p_section_key)) then
    raise exception 'Seção de Quadrinhos inválida';
  end if;

  update public.homepage_settings
  set comic_hidden_sections = case
    when coalesce(p_hidden, false) then (
      select coalesce(jsonb_agg(value order by value), '[]'::jsonb)
      from (
        select distinct value
        from jsonb_array_elements_text(coalesce(comic_hidden_sections, '[]'::jsonb))
        union
        select p_section_key
      ) sections
    )
    else (
      select coalesce(jsonb_agg(value order by value), '[]'::jsonb)
      from jsonb_array_elements_text(coalesce(comic_hidden_sections, '[]'::jsonb)) as section_key(value)
      where value <> p_section_key
    )
  end,
  updated_at = now()
  where id = true;
end;
$$;

revoke all on function public.replace_comic_hidden_sections(jsonb) from public, anon;
revoke all on function public.update_comic_section_visibility(text, boolean) from public, anon;
grant execute on function public.replace_comic_hidden_sections(jsonb) to authenticated;
grant execute on function public.update_comic_section_visibility(text, boolean) to authenticated;

notify pgrst, 'reload schema';
