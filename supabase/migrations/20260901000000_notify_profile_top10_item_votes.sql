create or replace function public.notify_profile_top10_item_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_actor_username text;
  v_vote_label text;
begin
  if tg_op = 'update' and new.vote = old.vote then
    return new;
  end if;

  select i.character_name, l.id as list_id, l.name as list_name, l.owner_id, p.username as owner_username
    into v_item
    from public.profile_top10_items i
    join public.profile_top10_lists l on l.id = i.list_id
    join public.profiles p on p.id = l.owner_id
   where i.id = new.item_id;

  if v_item.owner_id is null or v_item.owner_id = new.user_id then
    return new;
  end if;

  select username into v_actor_username from public.profiles where id = new.user_id;
  v_vote_label := case when new.vote = 1 then 'curtiu' else 'não curtiu' end;

  perform public.create_notification(
    v_item.owner_id,
    case when new.vote = 1 then 'top10_item_like' else 'top10_item_dislike' end,
    case when new.vote = 1 then 'Nova curtida na sua lista' else 'Novo dislike na sua lista' end,
    '@' || coalesce(v_actor_username, 'alguém') || ' ' || v_vote_label || ' "' || coalesce(v_item.character_name, 'um item') || '" na lista "' || v_item.list_name || '".',
    new.user_id,
    '?perfil=' || v_item.owner_username || '&lista_top10=' || v_item.list_id,
    jsonb_build_object('list_id', v_item.list_id, 'list_name', v_item.list_name, 'item_id', new.item_id, 'item_name', v_item.character_name, 'profile_username', v_item.owner_username, 'vote', new.vote)
  );
  return new;
end;
$$;

drop trigger if exists profile_top10_item_vote_notification on public.profile_top10_item_votes;
create trigger profile_top10_item_vote_notification
after insert or update of vote on public.profile_top10_item_votes
for each row execute function public.notify_profile_top10_item_vote();
