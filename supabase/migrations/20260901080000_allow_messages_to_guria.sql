-- A Guria faz a própria triagem de conteúdo e precisa receber mensagens
-- mesmo quando a política geral de chat bloquear o texto antes do processamento.
drop policy if exists "users send chat messages" on public.chat_messages;
create policy "users send chat messages" on public.chat_messages for insert with check (
  auth.uid() = sender_id
  and (can_post_content('chat', body) or exists (
    select 1 from public.profiles target
    where target.id = recipient_id and target.username = 'guria' and target.is_bot and target.is_official
  ))
  and expires_at <= (now() + interval '24 hours')
  and expires_at > now()
  and (
    (room_id is null and recipient_id is not null and auth.uid() <> recipient_id
      and not is_blocked_between(recipient_id)
      and exists (select 1 from public.profiles where id = recipient_id and allow_messages))
    or (room_id is not null and recipient_id is null and can_send_chat_room(room_id))
  )
);
