create or replace function public.choose_faction(p_faction_id text default null)
returns table(faction_id text, name text, color text, emblem text, description text, changed_at timestamptz)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_target text;
  v_season public.faction_seasons%rowtype;
  v_result_faction_id text;
  v_result_name text;
  v_result_color text;
  v_result_emblem text;
  v_result_description text;
  v_result_changed_at timestamptz;
begin
  if v_user_id is null then return; end if;
  select * into v_profile from public.profiles where id = v_user_id;
  if not found or v_profile.plan not in ('free', 'premium') then return; end if;
  if v_profile.faction_id is not null then
    if p_faction_id is null or p_faction_id = v_profile.faction_id then
      select f.id, f.name, f.color, f.emblem, f.description, v_profile.faction_changed_at into v_result_faction_id, v_result_name, v_result_color, v_result_emblem, v_result_description, v_result_changed_at from public.factions f where f.id = v_profile.faction_id;
      faction_id := v_result_faction_id; name := v_result_name; color := v_result_color; emblem := v_result_emblem; description := v_result_description; changed_at := v_result_changed_at;
      return next; return;
    end if;
    if v_profile.faction_changed_at is not null and v_profile.faction_changed_at > now() - interval '7 days' then
      raise exception 'You can only change faction once per week';
    end if;
  end if;
  if p_faction_id is not null and exists (select 1 from public.factions where id = p_faction_id) then
    if exists (select 1 from public.faction_bans bans where bans.faction_id = p_faction_id and bans.user_id = v_user_id) then raise exception 'You cannot join this faction again'; end if;
    v_target := p_faction_id;
  else
    with counts as (
      select f.id, count(m.user_id)::bigint as members,
        coalesce(sum(case when x.created_at >= now() - interval '7 days' then x.xp else 0 end), 0)::bigint as activity
      from public.factions f
      left join public.faction_memberships m on m.faction_id = f.id
      left join public.faction_xp_events x on x.faction_id = f.id
      group by f.id
    ) select id into v_target from counts where not exists (select 1 from public.faction_bans b where b.faction_id = counts.id and b.user_id = v_user_id) order by members asc, activity asc, random() limit 1;
  end if;
  if v_profile.faction_id is not null and v_profile.faction_id is distinct from v_target then
    v_season := public.current_faction_season();
    insert into public.faction_xp_events(season_id, faction_id, user_id, event_type, event_key, xp)
    values (v_season.id, v_profile.faction_id, v_user_id, 'desertion', 'desertion:' || v_user_id::text || ':' || clock_timestamp()::text, -25);
    insert into public.profile_xp_events(user_id, event_type, event_key, xp)
    values (v_user_id, 'desertion', 'faction-desertion:' || v_user_id::text || ':' || clock_timestamp()::text, -50);
    update public.profiles
    set xp = greatest(0, xp - 50), level = public.profile_level_for_xp(greatest(0, xp - 50))
    where id = v_user_id;
    delete from public.faction_roles where user_id = v_user_id;
  end if;
  delete from public.faction_memberships where user_id = v_user_id;
  insert into public.faction_memberships (user_id, faction_id, joined_at, changed_at)
  values (v_user_id, v_target, coalesce(v_profile.faction_joined_at, now()), case when v_profile.faction_id is null then null else now() end);
  update public.profiles as profile set faction_id = v_target, faction_joined_at = coalesce(profile.faction_joined_at, now()), faction_changed_at = case when profile.faction_id is null then null else now() end where profile.id = v_user_id;
  if v_profile.faction_id is not null and v_profile.faction_id is distinct from v_target then
    perform public.ensure_faction_leadership(v_profile.faction_id);
  end if;
  perform public.ensure_faction_leadership(v_target);
  select f.id, f.name, f.color, f.emblem, f.description, p.faction_changed_at into v_result_faction_id, v_result_name, v_result_color, v_result_emblem, v_result_description, v_result_changed_at from public.factions f join public.profiles p on p.faction_id = f.id where f.id = v_target and p.id = v_user_id;
  faction_id := v_result_faction_id; name := v_result_name; color := v_result_color; emblem := v_result_emblem; description := v_result_description; changed_at := v_result_changed_at;
  return next;
end;
$$;
grant execute on function public.choose_faction(text) to authenticated;
