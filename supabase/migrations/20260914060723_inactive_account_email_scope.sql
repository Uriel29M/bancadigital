create table private.inactive_account_cleanup_settings (
  id boolean primary key default true check (id),
  email_scope text not null default 'all' check (email_scope in ('all', 'with_email', 'without_email'))
);
insert into private.inactive_account_cleanup_settings(id) values (true);
alter table private.inactive_account_cleanup_settings enable row level security;
revoke all on private.inactive_account_cleanup_settings from public, anon, authenticated, service_role;

create function private.inactive_cleanup_email_matches(p_email text, p_scope text)
returns boolean language sql immutable security invoker set search_path = '' as $$
  select case p_scope
    when 'all' then true
    when 'with_email' then nullif(btrim(p_email), '') is not null
      and lower(btrim(p_email)) not like '%@login.banca-digital.local'
    when 'without_email' then nullif(btrim(p_email), '') is null
      or lower(btrim(p_email)) like '%@login.banca-digital.local'
    else false end
$$;
revoke all on function private.inactive_cleanup_email_matches(text, text) from public, anon, authenticated, service_role;

create function public.get_inactive_account_cleanup_settings()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_enabled boolean;
  v_scope text;
begin
  -- The existing getter verifies the signed-in administrator and scheduler.
  v_enabled := public.get_inactive_account_cleanup_enabled();
  select email_scope into strict v_scope from private.inactive_account_cleanup_settings where id;
  return jsonb_build_object('enabled', v_enabled, 'email_scope', v_scope);
end;
$$;
revoke all on function public.get_inactive_account_cleanup_settings() from public, anon, authenticated, service_role;
grant execute on function public.get_inactive_account_cleanup_settings() to authenticated;

create function public.set_inactive_account_cleanup_settings(p_enabled boolean, p_email_scope text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.get_inactive_account_cleanup_enabled();
  if p_email_scope is null or p_email_scope not in ('all', 'with_email', 'without_email') then
    raise exception 'Selecione contas com e-mail, sem e-mail ou todas.' using errcode = '22023';
  end if;
  update private.inactive_account_cleanup_settings set email_scope = p_email_scope where id;
  perform public.set_inactive_account_cleanup_enabled(p_enabled);
  return public.get_inactive_account_cleanup_settings();
end;
$$;
revoke all on function public.set_inactive_account_cleanup_settings(boolean, text) from public, anon, authenticated, service_role;
grant execute on function public.set_inactive_account_cleanup_settings(boolean, text) to authenticated;

create or replace function private.inactive_free_account_candidates()
returns table (user_id uuid)
language sql stable security invoker set search_path = '' as $$
  select p.id
  from public.profiles p
  join auth.users u on u.id = p.id
  cross join private.inactive_account_cleanup_settings settings
  where settings.id and private.inactive_cleanup_email_matches(u.email, settings.email_scope)
    and p.plan = 'free'
    and p.last_seen_at < now() - interval '30 days'
    and greatest(p.last_seen_at, p.created_at, u.created_at, u.last_sign_in_at) < now() - interval '30 days'
    and not exists (
      select 1 from auth.sessions s where s.user_id = u.id
        and greatest(s.created_at, s.updated_at, s.refreshed_at at time zone 'UTC') >= now() - interval '30 days'
    )
  order by p.last_seen_at, p.id
$$;
revoke all on function private.inactive_free_account_candidates() from public, anon, authenticated, service_role;

create or replace function private.delete_inactive_free_account(p_user_id uuid)
returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  v_user auth.users%rowtype;
  v_profile public.profiles%rowtype;
  v_scope text;
  v_deleted integer;
begin
  select email_scope into v_scope from private.inactive_account_cleanup_settings where id for share;
  if not found then return false; end if;
  select * into v_user from auth.users where id = p_user_id for update skip locked;
  if not found then return false; end if;
  select * into v_profile from public.profiles where id = p_user_id for update skip locked;
  if not found then return false; end if;
  if not private.inactive_cleanup_email_matches(v_user.email, v_scope)
    or v_profile.plan is distinct from 'free'
    or v_profile.last_seen_at is null
    or greatest(v_profile.last_seen_at, v_profile.created_at, v_user.created_at, v_user.last_sign_in_at) >= now() - interval '30 days'
    or exists (
      select 1 from auth.sessions s where s.user_id = p_user_id
        and greatest(s.created_at, s.updated_at, s.refreshed_at at time zone 'UTC') >= now() - interval '30 days'
    ) then return false;
  end if;
  delete from auth.users where id = p_user_id;
  get diagnostics v_deleted = row_count;
  return v_deleted = 1;
end;
$$;
revoke all on function private.delete_inactive_free_account(uuid) from public, anon, authenticated, service_role;
