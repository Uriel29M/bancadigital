alter table public.character_settings
  add column if not exists is_hidden boolean not null default false;

create or replace function public.prevent_non_admin_character_visibility()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT' and new.is_hidden = true)
    or (tg_op = 'UPDATE' and new.is_hidden is distinct from old.is_hidden) then
    if not public.is_admin() then
      raise exception 'Apenas administradores podem alterar a visibilidade do personagem';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_non_admin_character_visibility_trigger on public.character_settings;
create trigger prevent_non_admin_character_visibility_trigger
before insert or update on public.character_settings
for each row execute function public.prevent_non_admin_character_visibility();
