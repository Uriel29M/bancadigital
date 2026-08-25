-- Remove a atribuição antiga de blogs das facções.
delete from public.faction_xp_events where event_type = 'blog';

create or replace function public.grant_faction_xp(p_event_type text, p_event_key text default null)
returns integer language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_faction text;
  v_season public.faction_seasons%rowtype;
  v_xp integer;
  v_key text;
  v_total integer;
begin
  select profile.faction_id into v_faction from public.profiles profile where profile.id = v_user_id and profile.plan not in ('moderator', 'admin');
  if v_faction is null then return 0; end if;
  v_xp := case p_event_type when 'read' then 10 when 'comment' then 5 when 'like' then 2 when 'chat' then 3 when 'follow' then 2 else 0 end;
  if v_xp <= 0 then return 0; end if;
  v_season := public.current_faction_season();
  v_key := coalesce(nullif(trim(p_event_key), ''), p_event_type || ':' || clock_timestamp()::text);
  insert into public.faction_xp_events(season_id, faction_id, user_id, event_type, event_key, xp)
  values (v_season.id, v_faction, v_user_id, p_event_type, v_key, v_xp)
  on conflict (season_id, user_id, event_key) do nothing;
  if not found then return 0; end if;
  select coalesce(sum(events.xp), 0) into v_total from public.faction_xp_events events where events.season_id = v_season.id and events.faction_id = v_faction;
  perform public.ensure_faction_leadership(v_faction);
  return v_total;
end;
$$;
grant execute on function public.grant_faction_xp(text, text) to authenticated;
