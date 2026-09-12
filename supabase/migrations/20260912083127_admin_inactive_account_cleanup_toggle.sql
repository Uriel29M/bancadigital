-- Expose only the on/off state of this job, never arbitrary scheduler commands.
create or replace function public.get_inactive_account_cleanup_enabled()
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_enabled boolean;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id=auth.uid() and plan='admin'
  ) then raise exception 'Apenas administradores podem gerenciar a limpeza de contas.' using errcode='42501'; end if;
  select active into v_enabled from cron.job where jobname='purge-inactive-free-accounts' and username='postgres';
  if not found then raise exception 'Agendamento da limpeza de contas não encontrado.'; end if;
  return v_enabled;
end;
$$;
revoke all on function public.get_inactive_account_cleanup_enabled() from public, anon, authenticated, service_role;
grant execute on function public.get_inactive_account_cleanup_enabled() to authenticated;

create or replace function public.set_inactive_account_cleanup_enabled(p_enabled boolean)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_job_id bigint;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id=auth.uid() and plan='admin'
  ) then raise exception 'Apenas administradores podem gerenciar a limpeza de contas.' using errcode='42501'; end if;
  if p_enabled is null then raise exception 'Informe se a exclusão automática deve ficar ativada ou desativada.' using errcode='22004'; end if;
  select jobid into v_job_id from cron.job where jobname='purge-inactive-free-accounts' and username='postgres' for update;
  if not found then raise exception 'Agendamento da limpeza de contas não encontrado.'; end if;
  perform cron.alter_job(v_job_id, active := p_enabled);
  return public.get_inactive_account_cleanup_enabled();
end;
$$;
revoke all on function public.set_inactive_account_cleanup_enabled(boolean) from public, anon, authenticated, service_role;
grant execute on function public.set_inactive_account_cleanup_enabled(boolean) to authenticated;
