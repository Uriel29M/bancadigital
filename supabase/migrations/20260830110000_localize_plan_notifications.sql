create or replace function public.set_user_plan(p_username text, p_plan text)
returns void language plpgsql security definer set search_path = public as $$
declare v_target public.profiles%rowtype;
begin
  if not public.is_moderator() then raise exception 'Apenas moderadores e administradores podem alterar planos'; end if;
  if p_plan not in ('free', 'premium', 'moderator') then raise exception 'Plano invalido'; end if;
  if p_plan = 'moderator' and not public.is_admin() then raise exception 'Apenas administradores podem promover moderadores'; end if;
  select * into v_target from public.profiles where lower(username) = lower(trim(p_username));
  if not found then raise exception 'Usuario nao encontrado'; end if;
  update public.profiles set plan = p_plan where id = v_target.id;
  if v_target.plan is distinct from p_plan then
    perform public.create_notification(
      v_target.id,
      'plan',
      'Plano da conta atualizado',
      'Seu plano mudou de ' || case v_target.plan
        when 'premium' then 'Lenda'
        when 'free' then 'Comum'
        when 'moderator' then 'Moderador'
        when 'admin' then 'Administrador'
        else v_target.plan
      end || ' para ' || case p_plan
        when 'premium' then 'Lenda'
        when 'free' then 'Comum'
        when 'moderator' then 'Moderador'
        when 'admin' then 'Administrador'
        else p_plan
      end || '.',
      auth.uid(),
      null,
      jsonb_build_object('old_plan', v_target.plan, 'new_plan', p_plan)
    );
  end if;
end;
$$;

grant execute on function public.set_user_plan(text, text) to authenticated;
