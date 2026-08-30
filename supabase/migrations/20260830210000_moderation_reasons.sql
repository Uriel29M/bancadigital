-- Motivo e observação interna passam a acompanhar as ações da equipe.
alter table public.moderation_actions
  add column if not exists reason text,
  add column if not exists internal_note text;

alter table public.chat_moderation_actions
  add column if not exists reason text,
  add column if not exists internal_note text;

drop function if exists public.moderate_user(text, text, text, text, text);
drop function if exists public.moderate_chat_user(text, text, text, text, text);

create or replace function public.validate_moderation_action_reason()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_plan text;
begin
  select plan into v_plan from public.profiles where id = NEW.actor_id;
  if v_plan <> 'admin' and NEW.action in ('ban', 'hide', 'silence', 'delete_comment', 'delete_blog', 'delete_message') and nullif(trim(coalesce(NEW.reason, '')), '') is null then
    raise exception 'Informe o motivo da ação';
  end if;
  return NEW;
end;
$$;
drop trigger if exists validate_moderation_action_reason_trigger on public.moderation_actions;
create trigger validate_moderation_action_reason_trigger before insert on public.moderation_actions for each row execute procedure public.validate_moderation_action_reason();

create or replace function public.moderate_user(
  p_username text, p_action text, p_duration text default null,
  p_title text default null, p_title_color text default null,
  p_reason text default null, p_internal_note text default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_target public.profiles%rowtype;
  v_until timestamptz := null;
  v_reason text := nullif(left(trim(coalesce(p_reason, '')), 500), '');
  v_internal_note text := nullif(left(trim(coalesce(p_internal_note, '')), 1000), '');
begin
  if not public.is_moderator() then raise exception 'Apenas moderadores e administradores podem moderar'; end if;
  select * into v_target from public.profiles where lower(username) = lower(trim(p_username));
  if not found then raise exception 'Usuário não encontrado'; end if;
  if v_target.plan = 'admin' and not public.is_admin() then raise exception 'Apenas administradores podem moderar administradores'; end if;
  if v_target.plan = 'banca' and not public.is_admin() then raise exception 'Apenas administradores podem moderar integrantes da Banca'; end if;
  if v_target.plan = 'moderator' and not (public.is_admin() or exists (select 1 from public.profiles where id = auth.uid() and plan = 'banca')) then raise exception 'Apenas a Banca e administradores podem moderar moderadores'; end if;
  if p_action in ('ban', 'hide', 'silence') and not public.is_admin() and v_reason is null then
    raise exception 'Informe o motivo da ação';
  end if;
  if p_action = 'silence' then
    v_until := case p_duration when '24h' then now() + interval '24 hours' when '3d' then now() + interval '3 days' when '1m' then now() + interval '1 month' else now() + interval '24 hours' end;
    update public.profiles set silenced_until = v_until where id = v_target.id;
  elsif p_action = 'unsilence' then update public.profiles set silenced_until = null where id = v_target.id;
  elsif p_action = 'ban' then update public.profiles set is_banned = true where id = v_target.id;
  elsif p_action = 'unban' then update public.profiles set is_banned = false where id = v_target.id;
  elsif p_action = 'hide' then update public.profiles set profile_hidden = true where id = v_target.id;
  elsif p_action = 'unhide' then update public.profiles set profile_hidden = false where id = v_target.id;
  elsif p_action = 'title' then update public.profiles set title = nullif(left(trim(p_title), 10), ''), title_color = coalesce(nullif(p_title_color, ''), title_color) where id = v_target.id;
  else raise exception 'Ação de moderação inválida';
  end if;
  insert into public.moderation_actions(actor_id, target_id, action, duration_until, reason, internal_note, details)
  values (auth.uid(), v_target.id, p_action, v_until, v_reason, v_internal_note, jsonb_build_object('duration', p_duration, 'title', p_title));
end;
$$;

-- Mantém exclusões feitas pelos autores, mas registra exclusões feitas pela equipe.
create or replace function public.delete_moderated_comment(p_comment_id bigint, p_reason text default null, p_internal_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_comment public.comments%rowtype; v_reason text := nullif(left(trim(coalesce(p_reason, '')), 500), '');
begin
  select * into v_comment from public.comments where id = p_comment_id;
  if not found then raise exception 'Comentário não encontrado'; end if;
  if auth.uid() <> v_comment.user_id and not public.is_moderator() then raise exception 'Você não pode excluir este comentário'; end if;
  if auth.uid() <> v_comment.user_id then
    if not public.is_admin() and v_reason is null then raise exception 'Informe o motivo da ação'; end if;
    insert into public.moderation_actions(actor_id, target_id, action, reason, internal_note, details)
    values (auth.uid(), v_comment.user_id, 'delete_comment', v_reason, nullif(left(trim(coalesce(p_internal_note, '')), 1000), ''), jsonb_build_object('comment_id', p_comment_id));
  end if;
  delete from public.comments where id = p_comment_id;
end;
$$;

create or replace function public.delete_moderated_blog(p_blog_id bigint, p_reason text default null, p_internal_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_blog public.blog_posts%rowtype; v_reason text := nullif(left(trim(coalesce(p_reason, '')), 500), '');
begin
  select * into v_blog from public.blog_posts where id = p_blog_id;
  if not found then raise exception 'Blog não encontrado'; end if;
  if auth.uid() <> v_blog.author_id and not public.is_moderator() then raise exception 'Você não pode excluir este blog'; end if;
  if auth.uid() <> v_blog.author_id then
    if not public.is_admin() and v_reason is null then raise exception 'Informe o motivo da ação'; end if;
    insert into public.moderation_actions(actor_id, target_id, action, reason, internal_note, details)
    values (auth.uid(), v_blog.author_id, 'delete_blog', v_reason, nullif(left(trim(coalesce(p_internal_note, '')), 1000), ''), jsonb_build_object('blog_id', p_blog_id));
  end if;
  delete from public.blog_posts where id = p_blog_id;
end;
$$;

create or replace function public.delete_moderated_blog_comment(p_comment_id bigint, p_reason text default null, p_internal_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_comment public.blog_comments%rowtype; v_reason text := nullif(left(trim(coalesce(p_reason, '')), 500), '');
begin
  select * into v_comment from public.blog_comments where id = p_comment_id;
  if not found then raise exception 'Comentário não encontrado'; end if;
  if auth.uid() <> v_comment.user_id and not public.is_moderator() then raise exception 'Você não pode excluir este comentário'; end if;
  if auth.uid() <> v_comment.user_id then
    if not public.is_admin() and v_reason is null then raise exception 'Informe o motivo da ação'; end if;
    insert into public.moderation_actions(actor_id, target_id, action, reason, internal_note, details)
    values (auth.uid(), v_comment.user_id, 'delete_comment', v_reason, nullif(left(trim(coalesce(p_internal_note, '')), 1000), ''), jsonb_build_object('blog_comment_id', p_comment_id, 'blog_id', v_comment.blog_id));
  end if;
  delete from public.blog_comments where id = p_comment_id;
end;
$$;

create or replace function public.delete_moderated_wall_comment(p_comment_id bigint, p_reason text default null, p_internal_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_comment public.profile_wall_comments%rowtype; v_reason text := nullif(left(trim(coalesce(p_reason, '')), 500), '');
begin
  select * into v_comment from public.profile_wall_comments where id = p_comment_id;
  if not found then raise exception 'Comentário não encontrado'; end if;
  if auth.uid() <> v_comment.user_id and auth.uid() <> v_comment.profile_id and not public.is_moderator() then raise exception 'Você não pode excluir este comentário'; end if;
  if auth.uid() <> v_comment.user_id and auth.uid() <> v_comment.profile_id then
    if not public.is_admin() and v_reason is null then raise exception 'Informe o motivo da ação'; end if;
    insert into public.moderation_actions(actor_id, target_id, action, reason, internal_note, details)
    values (auth.uid(), v_comment.user_id, 'delete_comment', v_reason, nullif(left(trim(coalesce(p_internal_note, '')), 1000), ''), jsonb_build_object('wall_comment_id', p_comment_id, 'profile_id', v_comment.profile_id));
  end if;
  delete from public.profile_wall_comments where id = p_comment_id;
end;
$$;

grant execute on function public.moderate_user(text, text, text, text, text, text, text), public.delete_moderated_comment(bigint, text, text), public.delete_moderated_blog(bigint, text, text), public.delete_moderated_blog_comment(bigint, text, text), public.delete_moderated_wall_comment(bigint, text, text) to authenticated;

create or replace function public.log_chat_message_deletion()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_reason text := nullif(current_setting('app.moderation_reason', true), '');
  v_internal_note text := nullif(current_setting('app.moderation_internal_note', true), '');
begin
  if auth.uid() is not null then
    insert into public.chat_moderation_actions(room_id, actor_id, target_id, message_id, action, reason, internal_note, details)
    values (old.room_id, auth.uid(), old.sender_id, old.id, 'delete_message', v_reason, v_internal_note, jsonb_build_object('body', left(old.body, 200)));
  end if;
  return old;
end;
$$;

create or replace function public.delete_moderated_chat_message(p_message_id bigint, p_reason text default null, p_internal_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_message public.chat_messages%rowtype; v_reason text := nullif(left(trim(coalesce(p_reason, '')), 500), '');
begin
  select * into v_message from public.chat_messages where id = p_message_id;
  if not found then raise exception 'Mensagem não encontrada'; end if;
  if not (public.is_moderator() or public.is_chat_room_sheriff(v_message.room_id)) then raise exception 'Você não pode excluir esta mensagem'; end if;
  if not public.is_admin() and v_reason is null then raise exception 'Informe o motivo da ação'; end if;
  perform set_config('app.moderation_reason', coalesce(v_reason, ''), true);
  perform set_config('app.moderation_internal_note', left(trim(coalesce(p_internal_note, '')), 1000), true);
  delete from public.chat_messages where id = p_message_id;
end;
$$;

grant execute on function public.delete_moderated_chat_message(bigint, text, text) to authenticated;

-- A função de chat já recebe motivo; esta versão também persiste a nota interna
-- e bloqueia ações sensíveis sem justificativa para quem não é administrador.
create or replace function public.moderate_chat_user(p_room_id text, p_username text, p_action text, p_duration text default '1h', p_reason text default '', p_internal_note text default '')
returns void language plpgsql security definer set search_path = public as $$
declare v_target public.profiles%rowtype; v_until timestamptz; v_deleted integer := 0; v_reason text := nullif(left(trim(coalesce(p_reason, '')), 500), '');
begin
  if not (public.is_moderator() or public.is_chat_room_sheriff(p_room_id)) then raise exception 'Apenas moderadores ou o xerife podem moderar esta sala'; end if;
  if p_action in ('mute', 'clear_recent') and not public.is_admin() and v_reason is null then raise exception 'Informe o motivo da ação'; end if;
  select * into v_target from public.profiles where lower(username) = lower(trim(p_username));
  if not found then raise exception 'Usuário não encontrado'; end if;
  if p_action = 'mute' then
    v_until := case p_duration when '10m' then now()+interval '10 minutes' when '1h' then now()+interval '1 hour' when '24h' then now()+interval '24 hours' when '7d' then now()+interval '7 days' else null end;
    insert into public.chat_room_mutes(room_id, user_id, muted_by, muted_until, reason) values (p_room_id, v_target.id, auth.uid(), v_until, coalesce(v_reason, ''))
    on conflict (room_id, user_id) do update set muted_by=excluded.muted_by, muted_until=excluded.muted_until, reason=excluded.reason, created_at=now();
  elsif p_action = 'unmute' then
    delete from public.chat_room_mutes where room_id = p_room_id and user_id = v_target.id;
  elsif p_action = 'clear_recent' then
    delete from public.chat_messages where room_id = p_room_id and sender_id = v_target.id and created_at > now() - interval '24 hours';
    get diagnostics v_deleted = row_count;
  else raise exception 'Ação de moderação inválida'; end if;
  insert into public.chat_moderation_actions(room_id, actor_id, target_id, action, duration_until, reason, internal_note, details)
  values (p_room_id, auth.uid(), v_target.id, p_action, v_until, v_reason, nullif(left(trim(coalesce(p_internal_note, '')), 1000), ''), jsonb_build_object('username', v_target.username, 'deleted_count', v_deleted));
end;
$$;
grant execute on function public.moderate_chat_user(text, text, text, text, text, text) to authenticated;
