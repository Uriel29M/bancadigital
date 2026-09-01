-- Limites anti-spam aplicados no banco, inclusive para chamadas que nao usam a interface.
create schema if not exists private;

create table if not exists private.anti_spam_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null check (channel in ('comment', 'chat')),
  body_fingerprint text not null,
  created_at timestamptz not null default now()
);

create index if not exists anti_spam_events_user_channel_created_idx
  on private.anti_spam_events (user_id, channel, created_at desc);
create index if not exists anti_spam_events_user_fingerprint_created_idx
  on private.anti_spam_events (user_id, body_fingerprint, created_at desc);

revoke all on table private.anti_spam_events from anon, authenticated;
alter table private.anti_spam_events enable row level security;

create or replace function public.can_post_content(p_channel text, p_body text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan text;
  v_created_at timestamptz;
  v_now timestamptz := now();
  v_fingerprint text := md5(lower(regexp_replace(coalesce(trim(p_body), ''), '\s+', ' ', 'g')));
  v_limit integer := case when p_channel = 'chat' then 20 else 8 end;
  v_recent_count integer;
  v_duplicate_count integer;
  v_last_at timestamptz;
  v_violation_count integer;
  v_silence interval;
begin
  if v_user_id is null or p_channel not in ('comment', 'chat') or length(trim(coalesce(p_body, ''))) = 0 then
    return false;
  end if;

  select plan, created_at into v_plan, v_created_at
  from public.profiles where id = v_user_id;
  if not found or v_plan in ('moderator', 'banca', 'admin') then
    return found;
  end if;
  if exists (select 1 from public.profiles where id = v_user_id and (is_banned or (silenced_until is not null and silenced_until > v_now))) then
    return false;
  end if;

  select count(*), max(created_at) into v_recent_count, v_last_at
  from private.anti_spam_events
  where user_id = v_user_id and channel = p_channel and created_at > v_now - interval '1 minute';
  select count(*) into v_duplicate_count
  from private.anti_spam_events
  where user_id = v_user_id and channel = p_channel and body_fingerprint = v_fingerprint and created_at > v_now - interval '10 minutes';

  -- Contas novas precisam espaçar as primeiras interações.
  if v_created_at > v_now - interval '24 hours' and v_last_at is not null and v_last_at > v_now - interval '5 seconds' then
    return false;
  end if;

  if v_duplicate_count >= 1 then
    return false;
  end if;

  -- A terceira repetição na janela e o excesso da cota ativam silencio progressivo.
  if v_recent_count >= v_limit then
    select count(*) into v_violation_count
    from private.anti_spam_events
    where user_id = v_user_id and channel = p_channel and created_at > v_now - interval '24 hours'
      and (body_fingerprint = v_fingerprint or created_at > v_now - interval '1 minute');
    v_silence := case
      when v_violation_count >= 40 then interval '24 hours'
      when v_violation_count >= 20 then interval '2 hours'
      when v_violation_count >= 10 then interval '30 minutes'
      else interval '5 minutes'
    end;
    -- A ultima mensagem que dispara a reincidencia e registrada; as seguintes ficam bloqueadas.
    update public.profiles
      set silenced_until = greatest(coalesce(silenced_until, v_now), v_now + v_silence)
      where id = v_user_id;
  end if;

  insert into private.anti_spam_events(user_id, channel, body_fingerprint) values (v_user_id, p_channel, v_fingerprint);
  return true;
end;
$$;

revoke all on function public.can_post_content(text, text) from public, anon;
grant execute on function public.can_post_content(text, text) to authenticated;

create or replace function public.can_comment()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and not is_banned and (silenced_until is null or silenced_until <= now())) $$;

drop policy if exists "users create blog comments" on public.blog_comments;
create policy "users create blog comments" on public.blog_comments for insert
  with check (auth.uid() = user_id and public.can_post_content('comment', body));

drop policy if exists "users create own comments" on public.comments;
create policy "users create own comments" on public.comments for insert
  with check (auth.uid() = user_id and public.can_post_content('comment', body));

drop policy if exists "users create profile wall comments" on public.profile_wall_comments;
create policy "users create profile wall comments" on public.profile_wall_comments for insert
  with check (auth.uid() = user_id and public.can_post_content('comment', body) and not public.is_blocked_between(profile_id));

drop policy if exists "users send chat messages" on public.chat_messages;
create policy "users send chat messages" on public.chat_messages for insert with check (
  auth.uid() = sender_id
  and public.can_post_content('chat', body)
  and expires_at <= now() + interval '24 hours' and expires_at > now()
  and (
    (room_id is null and recipient_id is not null and auth.uid() <> recipient_id and not public.is_blocked_between(recipient_id) and exists (select 1 from public.profiles where id = recipient_id and allow_messages))
    or (room_id is not null and recipient_id is null and public.can_send_chat_room(room_id))
  )
);
