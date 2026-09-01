-- Allow normal profile creation while protecting official bot identity fields.
create or replace function public.protect_guria_profile_fields()
returns trigger language plpgsql set search_path = public
as $$
begin
  -- Browser-authenticated users have auth.uid(); server-side service operations do not.
  -- Only reject bot-field writes made from an authenticated non-admin session.
  if auth.uid() is not null and not public.is_admin() and (
    (tg_op = 'INSERT' and (coalesce(new.is_bot, false) or coalesce(new.is_official, false) or new.bot_type is not null))
    or (tg_op = 'UPDATE' and (
      new.is_bot is distinct from old.is_bot
      or new.is_official is distinct from old.is_official
      or new.bot_type is distinct from old.bot_type
    ))
  ) then
    raise exception 'Somente administradores podem alterar a identidade de um perfil oficial';
  end if;
  return new;
end;
$$;

revoke execute on function public.protect_guria_profile_fields() from public, anon, authenticated;
