-- Personaliza a identidade visual e o título da Guria.
update public.profiles
set title = 'Guia', title_color = '#ffffff'
where username = 'guria' and is_bot and is_official;

create or replace function public.guria_welcome_new_profile()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_guria uuid; v_message text;
begin
  select id into v_guria from public.profiles where username = 'guria' and is_bot and is_official limit 1;
  if v_guria is null or new.id = v_guria or new.is_banned then return new; end if;
  insert into public.profile_follows(follower_id, following_id) values (v_guria, new.id) on conflict do nothing;
  v_message := format('Oi, %s! Eu sou a Guria, guia da Banca. Posso explicar como o site funciona, indicar uma leitura ou conversar sobre quadrinhos. Por onde você quer começar?', coalesce(nullif(new.username,''),'leitor'));
  insert into public.chat_messages(sender_id, recipient_id, body, metadata, guria_event_key)
  values (v_guria, new.id, v_message, jsonb_build_object('guria_type','welcome', 'official_ai', true), 'welcome:' || new.id::text)
  on conflict do nothing;
  return new;
end;
$$;
