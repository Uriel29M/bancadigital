-- Correção isolada para ativar os xerifes dos chats.
-- Execute este arquivo no SQL Editor do Supabase depois que o schema principal
-- já tiver criado profiles e chat_rooms.

create table if not exists public.chat_room_sheriffs (
  room_id text primary key references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now()
);

alter table public.chat_room_sheriffs enable row level security;

create or replace function public.is_moderator()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and plan in ('moderator', 'admin')
  )
$$;

create or replace function public.is_chat_room_sheriff(p_room_id text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.chat_room_sheriffs sheriff
    join public.chat_rooms room on room.id = sheriff.room_id
    where sheriff.room_id = p_room_id
      and room.id in ('geral', 'decenautas', 'marvetes', 'leitores-colecionadores')
      and sheriff.user_id = auth.uid()
  )
$$;

create or replace function public.get_chat_room_sheriff(p_room_id text)
returns table(user_id uuid, username text, avatar_url text)
language sql stable security definer set search_path = public
as $$
  select sheriff.user_id, profile.username, profile.avatar_url
  from public.chat_room_sheriffs sheriff
  join public.profiles profile on profile.id = sheriff.user_id
  where sheriff.room_id = p_room_id
    and p_room_id in ('geral', 'decenautas', 'marvetes', 'leitores-colecionadores')
    and auth.uid() is not null
$$;

create or replace function public.set_chat_room_sheriff(p_room_id text, p_username text)
returns table(user_id uuid, username text, avatar_url text)
language plpgsql security definer set search_path = public
as $$
declare
  v_user public.profiles%rowtype;
  v_previous_user public.profiles%rowtype;
  v_room_name text;
begin
  if not public.is_moderator() then
    raise exception 'Apenas moderadores e administradores podem trocar o xerife';
  end if;

  if p_room_id not in ('geral', 'decenautas', 'marvetes', 'leitores-colecionadores') then
    raise exception 'Apenas as salas públicas principais podem ter xerife';
  end if;

  select room.name into v_room_name
  from public.chat_rooms room
  where room.id = p_room_id;

  if nullif(trim(p_username), '') is null then
    select profile.* into v_previous_user
    from public.chat_room_sheriffs sheriff
    join public.profiles profile on profile.id = sheriff.user_id
    where sheriff.room_id = p_room_id;
    delete from public.chat_room_sheriffs where room_id = p_room_id;
    if v_previous_user.id is not null then
      perform public.create_notification(
        v_previous_user.id,
        'chat_sheriff_removed',
        'Cargo de xerife removido',
        'Você não é mais o xerife de ' || coalesce(v_room_name, 'uma sala pública') || '.',
        auth.uid(),
        null,
        jsonb_build_object('room_id', p_room_id)
      );
    end if;
    return;
  end if;

  select profile.* into v_user
  from public.profiles profile
  where lower(profile.username) = lower(trim(p_username));

  if not found then
    raise exception 'Usuário não encontrado';
  end if;

  insert into public.chat_room_sheriffs(room_id, user_id, assigned_by)
  values (p_room_id, v_user.id, auth.uid())
  on conflict (room_id) do update
    set user_id = excluded.user_id,
        assigned_by = excluded.assigned_by,
        assigned_at = now();

  perform public.create_notification(
    v_user.id,
    'chat_sheriff',
    'Você foi nomeado xerife',
    'Você agora é o xerife de ' || coalesce(v_room_name, 'uma sala pública') || '. Você pode destacar e excluir mensagens nessa sala.',
    auth.uid(),
    null,
    jsonb_build_object('room_id', p_room_id)
  );

  return query select v_user.id as user_id, v_user.username as username, v_user.avatar_url as avatar_url;
end;
$$;

revoke execute on function public.is_chat_room_sheriff(text) from public, anon;
revoke execute on function public.get_chat_room_sheriff(text) from public, anon;
revoke execute on function public.set_chat_room_sheriff(text, text) from public, anon;
grant execute on function public.is_chat_room_sheriff(text) to authenticated;
grant execute on function public.get_chat_room_sheriff(text) to authenticated;
grant execute on function public.set_chat_room_sheriff(text, text) to authenticated;

notify pgrst, 'reload schema';
