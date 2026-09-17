-- Remove PUBLIC inheritance before considering per-role grants.
-- Preserve effective authenticated access only for actual client RPCs.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as signature, p.proname,
      p.prorettype='trigger'::regtype as is_trigger,
      has_function_privilege('authenticated',p.oid,'EXECUTE') as client_access
    from pg_proc p where p.pronamespace='public'::regnamespace and p.prosecdef
  loop
    execute format('revoke execute on function %s from public, anon', f.signature);
    if f.is_trigger or f.proname = any(array['create_notification','record_community_activity','submit_bot_action','process_expired_sticker_gums','current_faction_season','faction_election_eligible_member']) then
      execute format('revoke execute on function %s from authenticated', f.signature);
      execute format('grant execute on function %s to service_role', f.signature);
    elsif f.client_access then
      execute format('grant execute on function %s to authenticated', f.signature);
    end if;
    if f.proname = any(array['can_access_chat_room','can_apply_cover_style','can_comment','can_customize_covers','can_send_chat_room','is_admin','is_blocked_between','is_legendary_event_active','is_moderator','get_profile_ranking','get_faction_achievements','get_faction_mandatory_reads','increment_comic_download','increment_comic_read']) then
      execute format('grant execute on function %s to anon', f.signature);
    end if;
  end loop;
end $$;

CREATE OR REPLACE FUNCTION public.manage_faction_role(p_target_id uuid, p_role text, p_slot integer DEFAULT 1)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor public.profiles%rowtype;
  v_target public.profiles%rowtype;
  v_faction text;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id=auth.uid() and not is_banned) then
    raise exception 'Autenticação obrigatória' using errcode='42501';
  end if;
  select * into v_actor from public.profiles where id = auth.uid();
  select * into v_target from public.profiles where id = p_target_id;
  if v_actor.plan <> 'admin' and v_actor.faction_id is null then raise exception 'Apenas a liderança da facção pode gerenciar cargos'; end if;
  if v_target.id is null or v_target.faction_id is null then raise exception 'Membro sem facção'; end if;
  v_faction := v_target.faction_id;
  if v_actor.plan <> 'admin' and not exists (select 1 from public.faction_roles where user_id = v_actor.id and faction_id = v_faction and role = 'leader') then raise exception 'Apenas o líder pode gerenciar cargos'; end if;
  if p_role not in ('leader', 'curator') then raise exception 'Cargo inválido'; end if;
  if p_role = 'leader' and v_actor.plan <> 'admin' then raise exception 'Apenas administradores podem nomear um novo líder'; end if;
  if p_role = 'curator' and (p_slot < 1 or p_slot > 3) then raise exception 'A facção possui apenas três vagas de curador'; end if;
  if p_role = 'leader' then p_slot := 1; end if;
  delete from public.faction_roles where user_id = p_target_id;
  insert into public.faction_roles(user_id, faction_id, role, slot) values (p_target_id, v_faction, p_role, p_slot);
  if v_target.plan = 'free' then update public.profiles set plan = 'premium' where id = p_target_id; end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.ensure_faction_leadership(p_faction_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_season public.faction_seasons%rowtype;
  v_candidate uuid;
  v_slot integer;
begin
  if auth.uid() is null and coalesce(current_setting('role', true), 'none') not in ('none','postgres','service_role') then
    raise exception 'Autenticação obrigatória' using errcode='42501';
  end if;
  if not exists (select 1 from public.factions where id = p_faction_id) then return; end if;
  if auth.uid() is not null and not public.is_moderator()
    and not exists (select 1 from public.profiles where id = auth.uid() and faction_id = p_faction_id)
    and not exists (select 1 from public.faction_memberships where user_id = auth.uid() and faction_id = p_faction_id)
  then raise exception 'Você só pode organizar a sua própria facção'; end if;
  v_season := public.current_faction_season();

  -- profiles.faction_id é a fonte de verdade. Recria associações antigas
  -- que possam ter ficado sem registro em faction_memberships.
  insert into public.faction_memberships (user_id, faction_id, joined_at, changed_at)
  select profile.id, profile.faction_id, coalesce(profile.faction_joined_at, now()), profile.faction_changed_at
  from public.profiles profile
  where profile.faction_id = p_faction_id
    and profile.plan not in ('moderator', 'admin')
  on conflict (user_id) do update
    set faction_id = excluded.faction_id,
        changed_at = excluded.changed_at;

  -- Remove cargos órfãos deixados por uma troca de facção interrompida.
  delete from public.faction_roles roles
  where roles.faction_id = p_faction_id
    and not exists (
      select 1 from public.profiles profile
      where profile.id = roles.user_id
        and profile.faction_id = p_faction_id
    )
    and not exists (
      select 1 from public.faction_memberships membership
      where membership.user_id = roles.user_id
        and membership.faction_id = p_faction_id
    );

  if not exists (select 1 from public.faction_roles roles where roles.faction_id = p_faction_id and roles.role = 'leader') then
    select candidate.user_id into v_candidate
    from (
      select member_profile.id as user_id,
        coalesce(sum(case when xp.season_id = v_season.id then xp.xp else 0 end), 0) as faction_xp,
        coalesce(member_profile.last_seen_at, to_timestamp(0)) as last_seen
      from public.profiles member_profile
      left join public.faction_xp_events xp on xp.user_id = member_profile.id and xp.faction_id = p_faction_id
      where member_profile.plan not in ('moderator', 'admin')
        and (
          member_profile.faction_id = p_faction_id
          or exists (
            select 1
            from public.faction_memberships membership
            where membership.user_id = member_profile.id
              and membership.faction_id = p_faction_id
          )
        )
      group by member_profile.id, member_profile.last_seen_at
      order by faction_xp desc, last_seen desc, member_profile.id
    ) candidate
    where not exists (select 1 from public.faction_roles role where role.user_id = candidate.user_id)
    limit 1;
    if v_candidate is not null then
      insert into public.faction_roles(user_id, faction_id, role, slot) values (v_candidate, p_faction_id, 'leader', 1);
      update public.profiles set plan = 'premium' where id = v_candidate and plan = 'free';
    end if;
  end if;

  for v_slot in 1..3 loop
    if not exists (select 1 from public.faction_roles roles where roles.faction_id = p_faction_id and roles.role = 'curator' and roles.slot = v_slot) then
      select candidate.user_id into v_candidate
      from (
        select member_profile.id as user_id,
          coalesce(sum(case when xp.season_id = v_season.id then xp.xp else 0 end), 0) as faction_xp,
          coalesce(member_profile.last_seen_at, to_timestamp(0)) as last_seen
        from public.profiles member_profile
        left join public.faction_xp_events xp on xp.user_id = member_profile.id and xp.faction_id = p_faction_id
        where member_profile.plan not in ('moderator', 'admin')
          and (
            member_profile.faction_id = p_faction_id
            or exists (
              select 1
              from public.faction_memberships membership
              where membership.user_id = member_profile.id
                and membership.faction_id = p_faction_id
            )
          )
        group by member_profile.id, member_profile.last_seen_at
        order by faction_xp desc, last_seen desc, member_profile.id
      ) candidate
      where not exists (select 1 from public.faction_roles role where role.user_id = candidate.user_id)
      limit 1;
      if v_candidate is null then exit; end if;
      insert into public.faction_roles(user_id, faction_id, role, slot) values (v_candidate, p_faction_id, 'curator', v_slot);
      update public.profiles set plan = 'premium' where id = v_candidate and plan = 'free';
    end if;
  end loop;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.ensure_faction_election(p_faction_id text)
 RETURNS faction_elections
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_season public.faction_seasons%rowtype;
  v_election public.faction_elections%rowtype;
  v_candidacy_end timestamptz;
  v_curator_end timestamptz;
  v_member_count integer;
  v_vote_count integer;
  v_required integer;
  v_winner record;
  v_slot integer;
begin
  if auth.uid() is null and coalesce(current_setting('role', true), 'none') not in ('none','postgres','service_role') then
    raise exception 'Autenticação obrigatória' using errcode='42501';
  end if;
  if auth.uid() is not null and not exists (select 1 from public.profiles where id = auth.uid() and faction_id = p_faction_id) and not public.is_moderator() then
    raise exception 'VocÃª sÃ³ pode consultar a eleiÃ§Ã£o da sua facÃ§Ã£o';
  end if;
  v_season := public.current_faction_season();
  -- O calendÃ¡rio Ã© proporcional Ã  temporada real, em vez de assumir 30 dias.
  -- 65% candidatura, 20% curadores e 15% lÃ­der.
  v_candidacy_end := v_season.starts_at + ((v_season.ends_at - v_season.starts_at) * 0.65);
  v_curator_end := v_season.starts_at + ((v_season.ends_at - v_season.starts_at) * 0.85);
  insert into public.faction_elections(season_id, faction_id, candidacy_ends_at, curator_vote_ends_at, ends_at)
  values (v_season.id, p_faction_id, v_candidacy_end, v_curator_end, v_season.ends_at)
  on conflict (season_id, faction_id) do nothing;
  select * into v_election from public.faction_elections where season_id = v_season.id and faction_id = p_faction_id for update;

  if v_election.status = 'active' and v_election.phase = 'candidacy' and now() >= v_election.candidacy_ends_at then
    select count(*) into v_member_count from public.profiles where faction_id = p_faction_id and plan not in ('moderator', 'banca', 'admin');
    select count(*) into v_vote_count from public.faction_election_candidates where election_id = v_election.id and office = 'curator';
    if v_member_count < 2 or v_vote_count = 0 then
      update public.faction_elections set phase = 'held', status = 'held', held_reason = case when v_member_count < 2 then 'Poucos membros elegÃ­veis para votar' else 'Nenhum candidato a curador' end, updated_at = now() where id = v_election.id;
      perform public.ensure_faction_leadership(p_faction_id);
    else
      update public.faction_elections set phase = 'curator_vote', updated_at = now() where id = v_election.id;
    end if;
    select * into v_election from public.faction_elections where id = v_election.id;
  end if;

  if v_election.status = 'active' and v_election.phase = 'curator_vote' and now() >= v_election.curator_vote_ends_at then
    select count(*) into v_member_count from public.profiles where faction_id = p_faction_id and plan not in ('moderator', 'banca', 'admin');
    v_required := greatest(2, ceil(v_member_count * 0.25)::integer);
    select count(distinct voter_id) into v_vote_count from public.faction_election_votes where election_id = v_election.id and office = 'curator';
    if v_vote_count < v_required then
      update public.faction_elections set phase = 'held', status = 'held', held_reason = 'O quÃ³rum da votaÃ§Ã£o nÃ£o foi atingido', updated_at = now() where id = v_election.id;
      perform public.ensure_faction_leadership(p_faction_id);
    else
      delete from public.faction_roles where faction_id = p_faction_id and role = 'curator';
      for v_winner in
        select candidate.user_id, row_number() over (order by count(vote.voter_id) desc, coalesce(sum(xp.xp) filter (where xp.season_id = v_election.season_id), 0) desc, profile.last_seen_at desc, candidate.user_id) as winner_slot
        from public.faction_election_candidates candidate
        join public.profiles profile on profile.id = candidate.user_id and profile.faction_id = p_faction_id and profile.plan not in ('moderator', 'banca', 'admin')
        left join public.faction_election_votes vote on vote.election_id = v_election.id and vote.office = 'curator' and vote.candidate_id = candidate.user_id
        left join public.faction_xp_events xp on xp.user_id = candidate.user_id and xp.faction_id = p_faction_id
        where candidate.election_id = v_election.id and candidate.office = 'curator'
        group by candidate.user_id, profile.last_seen_at
        order by count(vote.voter_id) desc, coalesce(sum(xp.xp) filter (where xp.season_id = v_election.season_id), 0) desc, profile.last_seen_at desc, candidate.user_id
        limit 3
      loop
        insert into public.faction_roles(user_id, faction_id, role, slot) values (v_winner.user_id, p_faction_id, 'curator', v_winner.winner_slot::integer);
        update public.profiles set plan = 'premium' where id = v_winner.user_id and plan = 'free';
      end loop;
      if (select count(*) from public.faction_roles where faction_id = p_faction_id and role = 'curator') < 2 then
        update public.faction_elections set phase = 'held', status = 'held', held_reason = 'Poucos curadores eleitos para formar o colÃ©gio', updated_at = now() where id = v_election.id;
        perform public.ensure_faction_leadership(p_faction_id);
      else
        delete from public.faction_election_candidates where election_id = v_election.id and office = 'leader';
        insert into public.faction_election_candidates(election_id, user_id, office, pitch)
        select v_election.id, user_id, 'leader', '' from public.faction_roles where faction_id = p_faction_id and role = 'curator';
        update public.faction_elections set phase = 'leader_vote', updated_at = now() where id = v_election.id;
      end if;
    end if;
    select * into v_election from public.faction_elections where id = v_election.id;
  end if;

  if v_election.status = 'active' and v_election.phase = 'leader_vote' and now() >= v_election.ends_at then
    select count(*) into v_member_count from public.faction_roles where faction_id = p_faction_id and role = 'curator';
    select count(distinct voter_id) into v_vote_count from public.faction_election_votes where election_id = v_election.id and office = 'leader';
    if v_member_count < 2 or v_vote_count < 2 then
      update public.faction_elections set phase = 'held', status = 'held', held_reason = 'O colÃ©gio de curadores nÃ£o atingiu o quÃ³rum', updated_at = now() where id = v_election.id;
      perform public.ensure_faction_leadership(p_faction_id);
    else
      select candidate_id into v_winner from public.faction_election_votes where election_id = v_election.id and office = 'leader' group by candidate_id order by count(*) desc, candidate_id limit 1;
      if v_winner.candidate_id is not null then
        delete from public.faction_roles where faction_id = p_faction_id;
        insert into public.faction_roles(user_id, faction_id, role, slot) values (v_winner.candidate_id, p_faction_id, 'leader', 1);
        update public.profiles set plan = 'premium' where id = v_winner.candidate_id and plan = 'free';
        update public.faction_elections set phase = 'completed', status = 'completed', updated_at = now() where id = v_election.id;
        perform public.ensure_faction_leadership(p_faction_id);
      end if;
    end if;
    select * into v_election from public.faction_elections where id = v_election.id;
  end if;
  return v_election;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.ensure_faction_mandatory_reads(p_faction_id text, p_candidates jsonb)
 RETURNS TABLE(item_id text, item_title text, cover_url text, sort_order integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_season public.faction_seasons%rowtype;
begin
  if coalesce(current_setting('role', true), 'none') not in ('none','postgres','service_role')
    and (auth.uid() is null or not public.is_admin()) then
    raise exception 'Apenas administradores podem definir as leituras obrigatórias' using errcode='42501';
  end if;
  if p_candidates is null or jsonb_typeof(p_candidates) <> 'array' then
    raise exception 'Lista de candidatos inválida' using errcode='22023';
  end if;
  if not exists (select 1 from public.factions where id = p_faction_id) then return; end if;
  v_season := public.current_faction_season();
  if not exists (select 1 from public.faction_mandatory_reads where season_id = v_season.id and faction_id = p_faction_id) then
    insert into public.faction_mandatory_reads(season_id, faction_id, item_id, item_title, cover_url, sort_order)
    select v_season.id, p_faction_id, candidate.value->>'id', left(coalesce(nullif(candidate.value->>'title', ''), 'Edição'), 200), nullif(candidate.value->>'cover_url', ''), row_number() over (order by random())::integer
    from jsonb_array_elements(coalesce(p_candidates, '[]'::jsonb)) candidate
    where jsonb_typeof(candidate.value) = 'object' and nullif(candidate.value->>'id', '') is not null
    order by random() limit 3 on conflict do nothing;
  end if;
  return query select reads.item_id, reads.item_title, reads.cover_url, reads.sort_order from public.faction_mandatory_reads reads where reads.season_id = v_season.id and reads.faction_id = p_faction_id order by reads.sort_order, reads.item_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.remove_faction_member(p_target_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_actor public.profiles%rowtype; v_target public.profiles%rowtype;
begin
  select * into v_actor from public.profiles where id = auth.uid();
  select * into v_target from public.profiles where id = p_target_id;
  if v_actor.faction_id is null or not exists (select 1 from public.faction_roles where user_id = v_actor.id and faction_id = v_actor.faction_id and role = 'leader') then raise exception 'Apenas o líder pode remover membros'; end if;
  if v_target.id is null or v_target.faction_id is distinct from v_actor.faction_id then raise exception 'O membro não pertence à sua facção'; end if;
  if exists (select 1 from public.faction_roles where user_id = p_target_id and role = 'leader') then raise exception 'O líder não pode ser removido pela própria facção'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Informe o motivo da remoção'; end if;
  insert into public.faction_bans(faction_id, user_id, banned_by, reason) values (v_actor.faction_id, p_target_id, v_actor.id, left(trim(p_reason), 500)) on conflict (faction_id, user_id) do update set reason = excluded.reason, banned_by = excluded.banned_by, created_at = now();
  insert into public.faction_moderation_actions(faction_id, actor_id, target_id, action, reason) values (v_actor.faction_id, v_actor.id, p_target_id, 'remove_member', left(trim(p_reason), 500));
  delete from public.faction_memberships where user_id = p_target_id;
  update public.profiles set faction_id = null, faction_changed_at = now() where id = p_target_id;
  perform public.ensure_faction_leadership(v_actor.faction_id);
end;
$function$
;

notify pgrst, 'reload schema';
