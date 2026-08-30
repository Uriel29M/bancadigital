create or replace function public.log_chat_message_deletion()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null then
    insert into public.chat_moderation_actions(room_id, actor_id, target_id, message_id, action, details)
    values (old.room_id, auth.uid(), old.sender_id, old.id, 'delete_message', jsonb_build_object('body', left(old.body, 200)));
  end if;
  return old;
end;
$$;
drop trigger if exists chat_message_deletion_audit on public.chat_messages;
create trigger chat_message_deletion_audit after delete on public.chat_messages for each row execute procedure public.log_chat_message_deletion();

create or replace function public.log_chat_pin_change()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null then
    insert into public.chat_moderation_actions(room_id, actor_id, target_id, message_id, action, duration_until, details)
    values (coalesce(new.room_id, old.room_id), auth.uid(), coalesce(new.sender_id, old.sender_id), coalesce(new.message_id, old.message_id), case when tg_op = 'INSERT' then 'pin_message' else 'unpin_message' end, coalesce(new.expires_at, old.expires_at), '{}'::jsonb);
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists chat_pin_change_audit on public.chat_pins;
create trigger chat_pin_change_audit after insert or delete on public.chat_pins for each row execute procedure public.log_chat_pin_change();
