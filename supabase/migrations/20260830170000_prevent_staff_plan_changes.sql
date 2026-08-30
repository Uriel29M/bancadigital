-- Integrantes da equipe podem abrir os perfis uns dos outros, mas apenas
-- administradores podem alterar o tipo de conta de outro integrante.
create or replace function public.set_user_plan(p_username text, p_plan text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_target public.profiles%rowtype;
begin
  if not public.is_moderator() then
    raise exception 'Apenas moderadores e administradores podem alterar planos';
  end if;
  if p_plan not in ('free', 'premium', 'moderator', 'banca') then
    raise exception 'Plano inválido';
  end if;
  if p_plan = 'banca' and not public.is_admin() then
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

  if p_plan in ('moderator', 'banca') and v_target.faction_id is not null then
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
