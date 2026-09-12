-- Older clients send Date.now() + 24h. A fast device clock exceeds the
-- server's RLS upper bound, even for an otherwise authorized message.
-- Clamp only excessive expiry values before WITH CHECK runs; shorter/null/
-- expired values and every authorization policy retain their existing behavior.
create or replace function private.normalize_chat_message_expiry()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if new.expires_at > now() + interval '24 hours' then
    new.expires_at := now() + interval '24 hours';
  end if;
  return new;
end;
$$;

revoke all on function private.normalize_chat_message_expiry() from public, anon, authenticated;

drop trigger if exists normalize_chat_message_expiry_trigger on public.chat_messages;
create trigger normalize_chat_message_expiry_trigger
before insert on public.chat_messages
for each row execute function private.normalize_chat_message_expiry();
