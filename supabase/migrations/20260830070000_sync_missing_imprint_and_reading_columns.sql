-- Sincroniza colunas consumidas pelo frontend e atualiza o schema cache do PostgREST.
alter table public.imprint_settings
  add column if not exists wikipedia_url text;

create or replace function public.prevent_non_admin_imprint_wiki_url()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT' and new.wikipedia_url is not null)
    or (tg_op = 'UPDATE' and new.wikipedia_url is distinct from old.wikipedia_url) then
    if not public.is_admin() then
      raise exception 'Apenas administradores podem alterar o link da Wikipédia do selo';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_non_admin_imprint_wiki_url_trigger on public.imprint_settings;
create trigger prevent_non_admin_imprint_wiki_url_trigger
before insert or update on public.imprint_settings
for each row execute function public.prevent_non_admin_imprint_wiki_url();

alter table public.reading_progress
  add column if not exists completion_source text;

update public.reading_progress
set completion_source = 'manual'
where completed and completion_source is null;

alter table public.reading_progress
  drop constraint if exists reading_progress_completion_source_check;

alter table public.reading_progress
  add constraint reading_progress_completion_source_check
  check (completion_source is null or completion_source in ('manual', 'normal'));

notify pgrst, 'reload schema';
