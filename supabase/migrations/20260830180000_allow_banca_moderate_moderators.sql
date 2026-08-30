-- A Banca pode moderar moderadores. Usuários Banca e administradores só
-- podem ser moderados por administradores.
create or replace function public.moderate_user(p_username text, p_action text, p_duration text default null, p_title text default null, p_title_color text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_target public.profiles%rowtype;
  v_until timestamptz := null;
begin
  if not public.is_moderator() then raise exception 'Apenas moderadores e administradores podem moderar'; end if;
  select * into v_target from public.profiles where lower(username) = lower(trim(p_username));
  if not found then raise exception 'Usuário não encontrado'; end if;
  if v_target.plan = 'admin' and not public.is_admin() then raise exception 'Apenas administradores podem moderar administradores'; end if;
  if v_target.plan = 'banca' and not public.is_admin() then raise exception 'Apenas administradores podem moderar integrantes da Banca'; end if;
  if v_target.plan = 'moderator' and not (public.is_admin() or exists (select 1 from public.profiles where id = auth.uid() and plan = 'banca')) then raise exception 'Apenas a Banca e administradores podem moderar moderadores'; end if;
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
  insert into public.moderation_actions(actor_id, target_id, action, duration_until, details)
  values (auth.uid(), v_target.id, p_action, v_until, jsonb_build_object('duration', p_duration, 'title', p_title));
end;
$$;

grant execute on function public.moderate_user(text, text, text, text, text) to authenticated;
