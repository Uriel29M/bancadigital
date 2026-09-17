-- Client writes are opt-in by column. RLS still limits updates to the owner.
-- Revoke both table and pre-existing column grants; either can grant access.
revoke insert, update, delete, truncate, references, trigger on public.profiles
  from public, anon, authenticated;
do $$
declare v_columns text; v_editable text;
begin
  select string_agg(quote_ident(attname), ', ' order by attnum) into v_columns
  from pg_attribute where attrelid = 'public.profiles'::regclass
    and attnum > 0 and not attisdropped;
  execute format('revoke insert (%s), update (%s), references (%s) on public.profiles from public, anon, authenticated', v_columns, v_columns, v_columns);
  -- Some installations do not yet have every optional shelf preference.
  select string_agg(quote_ident(attname), ', ' order by attnum) into v_editable
  from pg_attribute where attrelid = 'public.profiles'::regclass
    and attnum > 0 and not attisdropped and attname = any(array[
      'username', 'avatar_url', 'wall_description', 'profile_banner_url',
      'profile_color', 'profile_background_theme', 'profile_accent_theme',
      'shelf_saved_public', 'shelf_series_public', 'shelf_read_public',
      'shelf_completed_public', 'shelf_liked_public', 'shelf_blogs_public',
      'likes_public', 'profile_wall_public', 'shelf_saved_public_collections',
      'profile_activity_public', 'shelf_categories', 'shelf_sort_orders',
      'shelf_section_order', 'shelf_collection_order', 'shelf_style', 'shelf_styles',
      'allow_mentions', 'allow_messages', 'notifications_enabled',
      'allow_sticker_requests', 'guria_proactive_enabled', 'last_seen_at'
    ]);
  execute format('grant update (%s) on public.profiles to authenticated', v_editable);
end $$;

-- Administrative changes go through authorized RPCs, including titles.
drop policy if exists "admins update user plans" on public.profiles;
drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles for update
  to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- current_user must be the caller, not the trigger function's owner.
-- Trusted SECURITY DEFINER RPCs still execute this trigger as their owner.
alter function public.protect_profile_progress() security invoker;

-- Email follows the confirmed Auth identity, never a browser-supplied value.
create or replace function public.sync_profile_account_email()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles set account_email = new.email where id = new.id;
  return new;
end;
$$;
revoke all on function public.sync_profile_account_email() from public, anon, authenticated;
drop trigger if exists sync_profile_account_email on auth.users;
create trigger sync_profile_account_email after update of email on auth.users
for each row when (old.email is distinct from new.email)
execute function public.sync_profile_account_email();

create or replace function public.set_user_plan(p_username text, p_plan text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_target public.profiles%rowtype;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id = auth.uid() and plan in ('moderator', 'banca', 'admin') and not is_banned) then
    raise exception 'Apenas moderadores e administradores podem alterar planos';
  end if;
  if p_plan is null or p_plan not in ('free', 'premium', 'moderator', 'banca', 'admin') then
    raise exception 'Plano inválido';
  end if;
  if p_plan in ('banca', 'admin') and not public.is_admin() then
    raise exception 'Apenas administradores podem promover integrantes da Banca';
  end if;
  if p_plan = 'moderator' and not (public.is_admin() or exists (select 1 from public.profiles where id = auth.uid() and plan = 'banca')) then
    raise exception 'Apenas a Banca e administradores podem promover moderadores';
  end if;

  select * into v_target
  from public.profiles
  where lower(username) = lower(trim(p_username));
  if not found then raise exception 'Usuário não encontrado'; end if;
  if v_target.plan = 'admin' and not public.is_admin() then
    raise exception 'Apenas administradores podem alterar administradores';
  end if;
  if v_target.plan = 'banca' and not public.is_admin() then
    raise exception 'Apenas administradores podem alterar integrantes da Banca';
  end if;
  if v_target.plan = 'moderator' and not (public.is_admin() or exists (select 1 from public.profiles where id = auth.uid() and plan = 'banca')) then
    raise exception 'Apenas a Banca e administradores podem alterar moderadores';
  end if;

  if p_plan in ('moderator', 'banca', 'admin') and v_target.faction_id is not null then
    delete from public.faction_roles where user_id = v_target.id;
    delete from public.faction_memberships where user_id = v_target.id;
    update public.profiles
    set plan = p_plan,
        faction_id = null,
        faction_joined_at = null,
        faction_changed_at = null
    where id = v_target.id;
    perform public.ensure_faction_leadership(v_target.faction_id);
  else
    update public.profiles set plan = p_plan where id = v_target.id;
  end if;
  if v_target.plan is distinct from p_plan then
    perform public.create_notification(v_target.id, 'plan', 'Plano da conta atualizado', 'Seu plano mudou de ' || case v_target.plan when 'premium' then 'Lenda' when 'free' then 'Comum' when 'moderator' then 'Moderador' when 'admin' then 'Administrador' else v_target.plan end || ' para ' || case p_plan when 'premium' then 'Lenda' when 'free' then 'Comum' when 'moderator' then 'Moderador' when 'admin' then 'Administrador' else p_plan end || '.', auth.uid(), null, jsonb_build_object('old_plan', v_target.plan, 'new_plan', p_plan));
  end if;
end;
$$;

grant execute on function public.set_user_plan(text, text) to authenticated;

revoke all on function public.set_user_plan(text, text) from public, anon;
-- Cover all installed overloads of the moderation RPC.
do $$
declare v_function regprocedure;
begin
  for v_function in select oid::regprocedure from pg_proc
    where pronamespace = 'public'::regnamespace and proname = 'moderate_user'
  loop
    execute format('revoke all on function %s from public, anon', v_function);
    execute format('grant execute on function %s to authenticated', v_function);
  end loop;
end $$;
notify pgrst, 'reload schema';
