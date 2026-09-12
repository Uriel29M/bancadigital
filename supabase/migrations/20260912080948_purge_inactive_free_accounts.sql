-- Account retention is owned by the database scheduler, not a public endpoint.
create schema if not exists private;

create table if not exists private.inactive_account_purge_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  candidates integer not null default 0,
  deleted integer not null default 0,
  skipped integer not null default 0,
  failures jsonb not null default '[]'::jsonb
);
alter table private.inactive_account_purge_runs enable row level security;
revoke all on private.inactive_account_purge_runs from public, anon, authenticated, service_role;

create index if not exists profiles_free_last_seen_idx
  on public.profiles (last_seen_at, id) where plan = 'free';

create or replace function private.inactive_free_account_candidates()
returns table (user_id uuid)
language sql stable security invoker set search_path = '' as $$
  select p.id
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.plan = 'free'
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
  v_deleted integer;
begin
  -- Lock Auth first, then the profile. A concurrent login, heartbeat or upgrade
  -- wins before these locks, or waits until this transaction completes.
  select * into v_user from auth.users where id = p_user_id for update skip locked;
  if not found then return false; end if;
  select * into v_profile from public.profiles where id = p_user_id for update skip locked;
  if not found then return false; end if;
  if v_profile.plan is distinct from 'free'
    or v_profile.last_seen_at is null
    or greatest(v_profile.last_seen_at, v_profile.created_at, v_user.created_at, v_user.last_sign_in_at) >= now() - interval '30 days'
    or exists (
      select 1 from auth.sessions s where s.user_id = p_user_id
        and greatest(s.created_at, s.updated_at, s.refreshed_at at time zone 'UTC') >= now() - interval '30 days'
    ) then return false;
  end if;
  -- Deleting Auth cascades to sessions/refresh tokens and the account profile.
  -- All predicates are checked again while both rows are locked.
  delete from auth.users where id = p_user_id;
  get diagnostics v_deleted = row_count;
  return v_deleted = 1;
end;
$$;
revoke all on function private.delete_inactive_free_account(uuid) from public, anon, authenticated, service_role;

create or replace function private.purge_inactive_free_accounts(p_dry_run boolean default true)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_run bigint;
  v_user_id uuid;
  v_candidates integer := 0;
  v_deleted integer := 0;
  v_skipped integer := 0;
  v_failures jsonb := '[]'::jsonb;
begin
  if p_dry_run is distinct from false then
    return jsonb_build_object('dry_run', true, 'eligible', (select count(*) from private.inactive_free_account_candidates()));
  end if;
  if not pg_try_advisory_xact_lock(73419, 30) then
    return jsonb_build_object('skipped', true, 'reason', 'already_running');
  end if;
  insert into private.inactive_account_purge_runs default values returning id into v_run;
  -- Bound each run to avoid a long transaction. Remaining accounts are picked
  -- up on the next run; failed accounts are logged and retried automatically.
  for v_user_id in select user_id from private.inactive_free_account_candidates() limit 500 loop
    v_candidates := v_candidates + 1;
    begin
      if private.delete_inactive_free_account(v_user_id) then
        v_deleted := v_deleted + 1;
      else
        v_skipped := v_skipped + 1;
      end if;
    exception when others then
      v_failures := v_failures || jsonb_build_array(jsonb_build_object('user_id', v_user_id, 'sqlstate', sqlstate, 'error', sqlerrm));
    end;
  end loop;
  update private.inactive_account_purge_runs set finished_at = clock_timestamp(), candidates = v_candidates,
    deleted = v_deleted, skipped = v_skipped, failures = v_failures where id = v_run;
  return jsonb_build_object('run_id', v_run, 'candidates', v_candidates, 'deleted', v_deleted, 'skipped', v_skipped, 'failures', v_failures);
end;
$$;
revoke all on function private.purge_inactive_free_accounts(boolean) from public, anon, authenticated, service_role;
