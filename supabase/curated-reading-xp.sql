-- Bônus de curadoria: recompensa somente a conclusão normal no leitor.
alter table public.reading_progress add column if not exists completion_source text;
update public.reading_progress
set completion_source = 'manual'
where completed and completion_source is null;

alter table public.reading_progress drop constraint if exists reading_progress_completion_source_check;
alter table public.reading_progress
  add constraint reading_progress_completion_source_check
  check (completion_source is null or completion_source in ('manual', 'normal'));

create or replace function public.grant_profile_xp(p_event_type text, p_event_key text default null)
returns integer language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_xp integer;
  v_key text;
  v_total integer;
begin
  if v_user_id is null or not exists (select 1 from public.profiles where id = v_user_id) then return 0; end if;
  v_xp := case p_event_type
    when 'read' then 10
    when 'curated_read' then 25
    when 'comment' then 5
    when 'like' then 2
    when 'chat' then 3
    when 'blog' then 8
    when 'follow' then 2
    else 0
  end;
  if v_xp <= 0 then return 0; end if;
  v_key := coalesce(nullif(trim(p_event_key), ''), p_event_type || ':' || clock_timestamp()::text);
  insert into public.profile_xp_events(user_id, event_type, event_key, xp)
  values (v_user_id, p_event_type, v_key, v_xp)
  on conflict (user_id, event_key) do nothing;
  if not found then
    select xp into v_total from public.profiles where id = v_user_id;
    return coalesce(v_total, 0);
  end if;
  update public.profiles
  set xp = xp + v_xp, level = public.profile_level_for_xp(xp + v_xp)
  where id = v_user_id
  returning xp into v_total;
  return coalesce(v_total, 0);
end;
$$;
grant execute on function public.grant_profile_xp(text, text) to authenticated;

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
  select profile.faction_id into v_faction from public.profiles profile
  where profile.id = v_user_id and profile.plan not in ('moderator', 'admin');
  if v_faction is null then return 0; end if;
  v_xp := case p_event_type when 'read' then 10 when 'curated_read' then 25 when 'comment' then 5 when 'like' then 2 when 'chat' then 3 when 'follow' then 2 else 0 end;
  if v_xp <= 0 then return 0; end if;
  v_season := public.current_faction_season();
  v_key := coalesce(nullif(trim(p_event_key), ''), p_event_type || ':' || clock_timestamp()::text);
  insert into public.faction_xp_events(season_id, faction_id, user_id, event_type, event_key, xp)
  values (v_season.id, v_faction, v_user_id, p_event_type, v_key, v_xp)
  on conflict (season_id, user_id, event_key) do nothing;
  if not found then return 0; end if;
  select coalesce(sum(events.xp), 0) into v_total from public.faction_xp_events events
  where events.season_id = v_season.id and events.faction_id = v_faction;
  perform public.ensure_faction_leadership(v_faction);
  return v_total;
end;
$$;
grant execute on function public.grant_faction_xp(text, text) to authenticated;
