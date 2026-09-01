-- Garante que todo perfil novo siga as contas oficiais da Banca.
-- A regra fica no insert de profiles para continuar funcionando mesmo que o
-- perfil seja criado por outro fluxo além do trigger de auth.users.

create or replace function public.follow_banca_accounts_for_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profile_follows (follower_id, following_id)
  select new.id, profile.id
  from public.profiles profile
  where profile.plan = 'banca'
    and profile.id <> new.id
  on conflict (follower_id, following_id) do nothing;

  return new;
end;
$$;

drop trigger if exists follow_banca_accounts_after_profile_insert on public.profiles;
create trigger follow_banca_accounts_after_profile_insert
after insert on public.profiles
for each row execute procedure public.follow_banca_accounts_for_profile();

-- Corrige usuários criados enquanto a regra não estava ativa.
insert into public.profile_follows (follower_id, following_id)
select profile.id, banca.id
from public.profiles profile
cross join public.profiles banca
where profile.id <> banca.id
  and banca.plan = 'banca'
on conflict (follower_id, following_id) do nothing;

revoke execute on function public.follow_banca_accounts_for_profile() from public;
