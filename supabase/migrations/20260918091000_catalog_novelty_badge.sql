alter table public.catalog_edition_overrides
  add column if not exists created_at timestamptz;

update public.catalog_edition_overrides
set created_at = to_timestamp(((substring(item_id from '^item-([0-9]{13})$'))::bigint) / 1000.0)
where created_at is null
  and item_id ~ '^item-[0-9]{13}$';

update public.catalog_edition_overrides
set created_at = '2000-01-01 00:00:00+00'::timestamptz
where created_at is null;

alter table public.catalog_edition_overrides
  alter column created_at set default now(),
  alter column created_at set not null;

alter table public.homepage_settings
  add column if not exists novelty_badge_hours numeric not null default 36;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.homepage_settings'::regclass
      and conname = 'homepage_settings_novelty_badge_hours_check'
  ) then
    alter table public.homepage_settings
      add constraint homepage_settings_novelty_badge_hours_check
      check (novelty_badge_hours >= 0);
  end if;
end
$$;

create or replace function public.set_novelty_badge_hours(p_hours numeric)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem alterar a duração da etiqueta NOVIDADE';
  end if;

  if p_hours is null or p_hours < 0 then
    raise exception 'A duração deve ser zero ou um número positivo de horas';
  end if;

  update public.homepage_settings
  set novelty_badge_hours = p_hours,
      updated_at = now()
  where id = true;

  return p_hours;
end;
$$;

revoke all on function public.set_novelty_badge_hours(numeric) from public;
grant execute on function public.set_novelty_badge_hours(numeric) to authenticated;
