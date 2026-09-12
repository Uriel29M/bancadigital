-- Run as postgres. All rows are synthetic and temporary; no chat/profile data
-- or production notification triggers are used. The deployed expiry function
-- is exercised under the authenticated role, including INSERT ... RETURNING.
begin;

create temporary table chat_expiry_test (
  id integer,
  sender_id integer not null,
  expires_at timestamptz not null default now() + interval '24 hours'
);
alter table chat_expiry_test enable row level security;
grant select, insert on chat_expiry_test to authenticated;
create policy test_sender_insert on chat_expiry_test for insert to authenticated
with check (sender_id = 1 and expires_at <= now() + interval '24 hours' and expires_at > now());
create policy test_sender_select on chat_expiry_test for select to authenticated
using (sender_id = 1 and expires_at > now());
create trigger test_expiry before insert on chat_expiry_test
for each row execute function private.normalize_chat_message_expiry();

set local role authenticated;
insert into chat_expiry_test values
  (1, 1, now() + interval '24 hours 1 minute'),
  (2, 1, default),
  (3, 1, now() + interval '1 hour')
returning id, expires_at - now() as ttl;

do $$
begin
  if (select count(*) from chat_expiry_test) <> 3
    or exists (select 1 from chat_expiry_test where id in (1, 2) and expires_at <> now() + interval '24 hours')
    or exists (select 1 from chat_expiry_test where id = 3 and expires_at <> now() + interval '1 hour') then
    raise exception 'Valid expiry normalization failed';
  end if;

  begin
    insert into chat_expiry_test values (4, 2, now() + interval '25 hours');
    raise exception 'RLS accepted a different sender';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into chat_expiry_test values (5, 1, now() - interval '1 hour');
    raise exception 'RLS accepted an expired message';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into chat_expiry_test values (6, 1, null);
    raise exception 'A null expiry was accepted';
  exception when not_null_violation or insufficient_privilege then null;
  end;
end;
$$;
reset role;
select 'PASS: default, fast clock, shorter TTL, wrong sender, expired and null expiry' as result;
rollback;
