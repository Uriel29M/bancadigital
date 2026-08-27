-- Atualização incremental para bancos que já possuem a tabela notifications.
-- Execute no SQL Editor do Supabase.

alter table public.notifications add column if not exists expires_at timestamptz;

update public.notifications
set expires_at = created_at + interval '24 hours'
where expires_at is null;

alter table public.notifications
  alter column expires_at set default (now() + interval '24 hours'),
  alter column expires_at set not null;

create index if not exists notifications_expires_idx on public.notifications(expires_at);

create or replace function public.purge_expired_notifications()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  delete from public.notifications where expires_at <= now();
  return new;
end;
$$;

drop trigger if exists purge_expired_notifications_trigger on public.notifications;
create trigger purge_expired_notifications_trigger
before insert on public.notifications
for each statement execute procedure public.purge_expired_notifications();

create or replace function public.purge_my_expired_notifications()
returns integer language plpgsql security definer set search_path = public
as $$
declare v_count integer;
begin
  if auth.uid() is null then return 0; end if;
  delete from public.notifications where user_id = auth.uid() and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.purge_my_expired_notifications() from anon;
grant execute on function public.purge_my_expired_notifications() to authenticated;
