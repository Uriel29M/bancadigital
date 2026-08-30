alter table public.character_settings
  add column if not exists wikipedia_url text;

create or replace function public.prevent_non_admin_character_wiki_url()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT' and new.wikipedia_url is not null)
    or (tg_op = 'UPDATE' and new.wikipedia_url is distinct from old.wikipedia_url) then
    if not public.is_admin() then
      raise exception 'Apenas administradores podem alterar o link da Wikipédia do personagem';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_non_admin_character_wiki_url_trigger on public.character_settings;
create trigger prevent_non_admin_character_wiki_url_trigger
before insert or update on public.character_settings
for each row execute function public.prevent_non_admin_character_wiki_url();
