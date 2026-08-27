-- Identifica relatos criados automaticamente pelo verificador diário de links.
alter table public.file_reports add column if not exists source text not null default 'user';
alter table public.file_reports add column if not exists bot_name text;

alter table public.file_reports drop constraint if exists file_reports_source_check;
alter table public.file_reports add constraint file_reports_source_check
  check (source in ('user', 'bot'));
alter table public.file_reports drop constraint if exists file_reports_bot_name_check;
alter table public.file_reports add constraint file_reports_bot_name_check
  check (source = 'user' or nullif(trim(bot_name), '') is not null);

-- Um bot não possui conta de usuário. Por isso reporter_id pode ser nulo apenas
-- para relatos automáticos, que continuam protegidos pela política da equipe.
alter table public.file_reports alter column reporter_id drop not null;
create unique index if not exists file_reports_pending_bot_item_idx
  on public.file_reports(item_id, bot_name)
  where status = 'pending' and source = 'bot';

drop policy if exists "users create file reports" on public.file_reports;
create policy "users create file reports" on public.file_reports
  for insert to authenticated
  with check ((select auth.uid()) = reporter_id and source = 'user' and bot_name is null);

create or replace function public.notify_resolved_file_report_once()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if old.status is distinct from 'resolved' and new.status = 'resolved' and new.notified_at is null and new.reporter_id is not null then
    perform public.create_notification(
      new.reporter_id, 'file_report_resolved', 'Relato de arquivo resolvido',
      'Seu relato foi verificado pela equipe. Obrigado por ajudar a Banca Digital.',
      auth.uid(), null, jsonb_build_object('item_id', new.item_id, 'report_id', new.id)
    );
    new.notified_at := now();
  end if;
  return new;
end;
$$;
