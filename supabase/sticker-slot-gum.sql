-- Proteção por slot do álbum. Execute depois de sticker-album.sql.
create table if not exists public.sticker_slot_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id text not null,
  blocked boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, character_id)
);
alter table public.sticker_slot_preferences enable row level security;
do $$
begin
  alter publication supabase_realtime add table public.sticker_slot_preferences;
exception when duplicate_object then
  null;
end;
$$;
drop policy if exists "sticker slot preferences are public" on public.sticker_slot_preferences;
drop policy if exists "users manage own sticker slot preferences" on public.sticker_slot_preferences;
create policy "sticker slot preferences are public" on public.sticker_slot_preferences for select using (true);
create policy "users manage own sticker slot preferences"
  on public.sticker_slot_preferences
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_sticker_slot_gum(p_character_id text, p_award_id bigint default null, p_blocked boolean default true)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or nullif(trim(p_character_id), '') is null then raise exception 'Slot inválido'; end if;
  if p_award_id is not null then
    update public.sticker_awards set requests_blocked = coalesce(p_blocked, false)
    where id = p_award_id and user_id = auth.uid() and character_id = p_character_id;
    if not found then raise exception 'Figurinha não encontrada'; end if;
    delete from public.sticker_slot_preferences where user_id = auth.uid() and character_id = p_character_id;
  elsif coalesce(p_blocked, false) then
    insert into public.sticker_slot_preferences(user_id, character_id, blocked, updated_at)
    values (auth.uid(), left(trim(p_character_id), 160), true, now())
    on conflict (user_id, character_id) do update set blocked = true, updated_at = now();
  else
    delete from public.sticker_slot_preferences where user_id = auth.uid() and character_id = p_character_id;
  end if;
end;
$$;
grant execute on function public.set_sticker_slot_gum(text, bigint, boolean) to authenticated;

-- Visitantes autenticados podem colar um chiclete no álbum de outra pessoa.
-- A remoção continua restrita ao dono e usa a função de três argumentos acima.
create or replace function public.set_sticker_slot_gum(p_owner_id uuid, p_character_id text, p_award_id bigint default null)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or p_owner_id is null or nullif(trim(p_character_id), '') is null then
    raise exception 'Slot inválido';
  end if;
  if p_owner_id = auth.uid() then
    raise exception 'Use o controle do próprio álbum para remover o chiclete';
  end if;
  if not exists (select 1 from public.profiles where id = p_owner_id) then
    raise exception 'Álbum não encontrado';
  end if;
  if p_award_id is not null then
    update public.sticker_awards
    set requests_blocked = true
    where id = p_award_id and user_id = p_owner_id and character_id = p_character_id;
    if not found then raise exception 'Figurinha não encontrada'; end if;
    delete from public.sticker_slot_preferences where user_id = p_owner_id and character_id = p_character_id;
  else
    insert into public.sticker_slot_preferences(user_id, character_id, blocked, updated_at)
    values (p_owner_id, left(trim(p_character_id), 160), true, now())
    on conflict (user_id, character_id) do update set blocked = true, updated_at = now();
  end if;
end;
$$;
grant execute on function public.set_sticker_slot_gum(uuid, text, bigint) to authenticated;

-- A versão publicada no banco também envia uma notificação ao dono do álbum.
-- Execute a versão atualizada desta função após este arquivo ser editado.
create or replace function public.set_sticker_slot_gum(p_owner_id uuid, p_character_id text, p_award_id bigint default null)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_was_blocked boolean := false;
  v_username text;
begin
  if auth.uid() is null or p_owner_id is null or nullif(trim(p_character_id), '') is null then raise exception 'Slot invalido'; end if;
  if p_owner_id = auth.uid() then raise exception 'Use o controle do proprio album para remover o chiclete'; end if;
  select username into v_username from public.profiles where id = p_owner_id;
  if v_username is null then raise exception 'Album nao encontrado'; end if;
  if p_award_id is not null then
    select coalesce(requests_blocked, false) into v_was_blocked from public.sticker_awards where id = p_award_id and user_id = p_owner_id and character_id = p_character_id;
    update public.sticker_awards set requests_blocked = true where id = p_award_id and user_id = p_owner_id and character_id = p_character_id;
    if not found then raise exception 'Figurinha nao encontrada'; end if;
    delete from public.sticker_slot_preferences where user_id = p_owner_id and character_id = p_character_id;
  else
    select coalesce(blocked, false) into v_was_blocked from public.sticker_slot_preferences where user_id = p_owner_id and character_id = p_character_id;
    insert into public.sticker_slot_preferences(user_id, character_id, blocked, updated_at) values (p_owner_id, left(trim(p_character_id), 160), true, now()) on conflict (user_id, character_id) do update set blocked = true, updated_at = now();
  end if;
  if not coalesce(v_was_blocked, false) then
    perform public.create_notification(p_owner_id, 'sticker_gum', 'Chiclete colado no seu album', 'Alguem colocou um chiclete em um slot do seu album.', auth.uid(), '?perfil=' || v_username || '&album=1', jsonb_build_object('character_id', p_character_id, 'award_id', p_award_id));
  end if;
end;
$$;
grant execute on function public.set_sticker_slot_gum(uuid, text, bigint) to authenticated;

notify pgrst, 'reload schema';

create or replace function public.prevent_blocked_sticker_requests()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if exists (select 1 from public.sticker_slot_preferences where user_id = new.owner_id and character_id = new.character_id and blocked) then
    raise exception 'Este slot não aceita pedidos ou trocas';
  end if;
  return new;
end;
$$;
drop trigger if exists prevent_blocked_sticker_requests_trigger on public.sticker_requests;
create trigger prevent_blocked_sticker_requests_trigger before insert on public.sticker_requests
for each row execute function public.prevent_blocked_sticker_requests();

create or replace function public.transfer_sticker_award(p_recipient_id uuid, p_award_id bigint)
returns public.sticker_awards language plpgsql security definer set search_path = public
as $$
declare v_character_id text;
begin
  select character_id into v_character_id from public.sticker_awards where id = p_award_id and user_id = auth.uid();
  if v_character_id is null then raise exception 'Figurinha não encontrada'; end if;
  if exists (select 1 from public.sticker_slot_preferences where user_id = p_recipient_id and character_id = v_character_id and blocked) then
    raise exception 'Este slot não aceita doações';
  end if;
  return public.donate_sticker_award(p_recipient_id, p_award_id);
end;
$$;
grant execute on function public.transfer_sticker_award(uuid, bigint) to authenticated;

create or replace function public.admin_donate_sticker(
  p_recipient_id uuid, p_character_id text, p_character_name text, p_publisher_name text,
  p_edition_fingerprint text, p_edition_ids jsonb, p_cover_item_id text, p_cover_url text, p_rarity text
)
returns public.sticker_awards language plpgsql security definer set search_path = public
as $$
declare v_result public.sticker_awards; v_existing public.sticker_awards; v_username text;
begin
  if not public.is_admin() then raise exception 'Apenas administradores podem conceder figurinhas diretamente'; end if;
  if p_recipient_id is null or p_recipient_id = auth.uid() then raise exception 'Destinatário inválido'; end if;
  if exists (select 1 from public.sticker_slot_preferences where user_id = p_recipient_id and character_id = p_character_id and blocked) then raise exception 'Este slot não aceita doações'; end if;
  if p_rarity not in ('standard', 'torn', 'creased', 'silver', 'gold') then raise exception 'Raridade inválida'; end if;
  if nullif(trim(p_character_id), '') is null or nullif(trim(p_character_name), '') is null or nullif(trim(p_publisher_name), '') is null or nullif(trim(p_edition_fingerprint), '') is null or nullif(trim(p_cover_item_id), '') is null or nullif(trim(p_cover_url), '') is null or jsonb_typeof(p_edition_ids) <> 'array' or jsonb_array_length(p_edition_ids) = 0 or p_cover_url !~ '^https://|^data:image/' then raise exception 'Dados da figurinha inválidos'; end if;
  select username into v_username from public.profiles where id = p_recipient_id;
  if v_username is null then raise exception 'Usuário não encontrado'; end if;
  if exists (select 1 from public.sticker_awards where user_id = p_recipient_id and character_id = p_character_id and album_section = 'pasted') then raise exception 'Essa pessoa já possui uma figurinha colada deste personagem'; end if;
  select * into v_existing from public.sticker_awards where user_id = p_recipient_id and character_id = p_character_id and edition_fingerprint = p_edition_fingerprint for update;
  insert into public.sticker_claim_history(user_id, character_id, edition_fingerprint) values (p_recipient_id, p_character_id, p_edition_fingerprint) on conflict do nothing;
  if v_existing.id is not null then
    update public.sticker_awards set character_name = left(trim(p_character_name),160), publisher_name = left(trim(p_publisher_name),160), cover_item_id = left(trim(p_cover_item_id),200), cover_url = left(trim(p_cover_url),2000), rarity = p_rarity, album_section = 'pasted' where id = v_existing.id returning * into v_result;
  else
    insert into public.sticker_awards(user_id, character_id, character_name, publisher_name, edition_fingerprint, cover_item_id, cover_url, rarity, album_section) values (p_recipient_id, p_character_id, left(trim(p_character_name),160), left(trim(p_publisher_name),160), left(trim(p_edition_fingerprint),500), left(trim(p_cover_item_id),200), left(trim(p_cover_url),2000), p_rarity, 'pasted') returning * into v_result;
  end if;
  perform public.create_notification(p_recipient_id, 'sticker_admin_donation', 'Você recebeu uma figurinha', 'Um administrador adicionou uma figurinha de ' || v_result.character_name || ' ao seu álbum.', auth.uid(), '?perfil=' || v_username || '&album=1', jsonb_build_object('character_id', v_result.character_id, 'rarity', v_result.rarity));
  return v_result;
end;
$$;
grant execute on function public.admin_donate_sticker(uuid, text, text, text, text, jsonb, text, text, text) to authenticated;

-- Identifica quem colou o chiclete, independentemente de quem visualiza o álbum.
alter table public.sticker_slot_preferences
  add column if not exists placed_by uuid references public.profiles(id) on delete set null;
alter table public.sticker_awards
  add column if not exists gum_placed_by uuid references public.profiles(id) on delete set null;

create or replace function public.set_sticker_slot_gum(p_character_id text, p_award_id bigint default null, p_blocked boolean default true)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or nullif(trim(p_character_id), '') is null then raise exception 'Slot inválido'; end if;
  if p_award_id is not null then
    update public.sticker_awards
    set requests_blocked = coalesce(p_blocked, false), gum_placed_by = case when coalesce(p_blocked, false) then auth.uid() else null end
    where id = p_award_id and user_id = auth.uid() and character_id = p_character_id;
    if not found then raise exception 'Figurinha não encontrada'; end if;
    delete from public.sticker_slot_preferences where user_id = auth.uid() and character_id = p_character_id;
  elsif coalesce(p_blocked, false) then
    insert into public.sticker_slot_preferences(user_id, character_id, blocked, placed_by, updated_at)
    values (auth.uid(), left(trim(p_character_id), 160), true, auth.uid(), now())
    on conflict (user_id, character_id) do update set blocked = true, placed_by = auth.uid(), updated_at = now();
  else
    delete from public.sticker_slot_preferences where user_id = auth.uid() and character_id = p_character_id;
  end if;
end;
$$;

create or replace function public.set_sticker_slot_gum(p_owner_id uuid, p_character_id text, p_award_id bigint default null)
returns void language plpgsql security definer set search_path = public
as $$
declare v_username text;
begin
  if auth.uid() is null or p_owner_id is null or nullif(trim(p_character_id), '') is null then raise exception 'Slot inválido'; end if;
  if p_owner_id = auth.uid() then raise exception 'Use o controle do próprio álbum para remover o chiclete'; end if;
  select username into v_username from public.profiles where id = p_owner_id;
  if v_username is null then raise exception 'Álbum não encontrado'; end if;
  perform pg_advisory_xact_lock(hashtext('sticker-gum-day:' || auth.uid()::text || ':' || p_owner_id::text || ':' || current_date::text));
  if p_award_id is not null then
    update public.sticker_awards set requests_blocked = true, gum_placed_by = auth.uid()
    where id = p_award_id and user_id = p_owner_id and character_id = p_character_id;
    if not found then raise exception 'Figurinha não encontrada'; end if;
    delete from public.sticker_slot_preferences where user_id = p_owner_id and character_id = p_character_id;
  else
    insert into public.sticker_slot_preferences(user_id, character_id, blocked, placed_by, updated_at)
    values (p_owner_id, left(trim(p_character_id), 160), true, auth.uid(), now())
    on conflict (user_id, character_id) do update set blocked = true, placed_by = auth.uid(), updated_at = now();
  end if;
  if exists (select 1 from public.sticker_gum_actions where actor_id = auth.uid() and owner_id = p_owner_id and action_date = current_date) then
    raise exception 'Você já colou um chiclete neste álbum hoje';
  end if;
  insert into public.sticker_gum_actions(actor_id, owner_id, character_id) values (auth.uid(), p_owner_id, p_character_id);
  perform public.create_notification(p_owner_id, 'sticker_gum', 'Chiclete colado no seu álbum', 'Alguém colocou um chiclete em um slot do seu álbum.', auth.uid(), '?perfil=' || v_username || '&album=1', jsonb_build_object('character_id', p_character_id, 'award_id', p_award_id));
end;
$$;
grant execute on function public.set_sticker_slot_gum(text, bigint, boolean) to authenticated;
grant execute on function public.set_sticker_slot_gum(uuid, text, bigint) to authenticated;
notify pgrst, 'reload schema';
+-- Limite diário para chicletes colocados por visitantes.
create table if not exists public.sticker_gum_actions (
  id bigint generated by default as identity primary key,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  character_id text not null,
  action_date date not null default current_date,
  created_at timestamptz not null default now()
);
drop index if exists public.sticker_gum_actions_actor_day_idx;
create unique index if not exists sticker_gum_actions_actor_owner_day_idx on public.sticker_gum_actions(actor_id, owner_id, action_date);
alter table public.sticker_gum_actions enable row level security;
drop policy if exists "sticker gum actions are private" on public.sticker_gum_actions;
create policy "sticker gum actions are private" on public.sticker_gum_actions for select using (auth.uid() = actor_id or auth.uid() = owner_id);

create or replace function public.set_sticker_slot_gum(p_owner_id uuid, p_character_id text, p_award_id bigint default null)
returns void language plpgsql security definer set search_path = public
as $$
declare v_was_blocked boolean := false; v_username text;
begin
  if auth.uid() is null or p_owner_id is null or nullif(trim(p_character_id), '') is null then raise exception 'Slot invalido'; end if;
  if p_owner_id = auth.uid() then raise exception 'Use o controle do proprio album para remover o chiclete'; end if;
  select username into v_username from public.profiles where id = p_owner_id;
  if v_username is null then raise exception 'Album nao encontrado'; end if;
  perform pg_advisory_xact_lock(hashtext('sticker-gum-day:' || auth.uid()::text || ':' || p_owner_id::text || ':' || current_date::text));
  if p_award_id is not null then
    select coalesce(requests_blocked, false) into v_was_blocked from public.sticker_awards where id = p_award_id and user_id = p_owner_id and character_id = p_character_id;
    update public.sticker_awards set requests_blocked = true where id = p_award_id and user_id = p_owner_id and character_id = p_character_id;
    if not found then raise exception 'Figurinha nao encontrada'; end if;
    delete from public.sticker_slot_preferences where user_id = p_owner_id and character_id = p_character_id;
  else
    select coalesce(blocked, false) into v_was_blocked from public.sticker_slot_preferences where user_id = p_owner_id and character_id = p_character_id;
    insert into public.sticker_slot_preferences(user_id, character_id, blocked, updated_at) values (p_owner_id, left(trim(p_character_id), 160), true, now()) on conflict (user_id, character_id) do update set blocked = true, updated_at = now();
    v_was_blocked := coalesce(v_was_blocked, false);
  end if;
  if not coalesce(v_was_blocked, false) then
    if exists (select 1 from public.sticker_gum_actions where actor_id = auth.uid() and owner_id = p_owner_id and action_date = current_date) then raise exception 'Voce ja colou um chiclete neste album hoje'; end if;
    insert into public.sticker_gum_actions(actor_id, owner_id, character_id) values (auth.uid(), p_owner_id, p_character_id);
    perform public.create_notification(p_owner_id, 'sticker_gum', 'Chiclete colado no seu album', 'Alguem colocou um chiclete em um slot do seu album.', auth.uid(), '?perfil=' || v_username || '&album=1', jsonb_build_object('character_id', p_character_id, 'award_id', p_award_id));
  end if;
end;
$$;
grant execute on function public.set_sticker_slot_gum(uuid, text, bigint) to authenticated;
notify pgrst, 'reload schema';
