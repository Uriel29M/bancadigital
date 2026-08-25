-- Leituras obrigatórias sorteadas por facção a cada temporada mensal.
create table if not exists public.faction_mandatory_reads (
  season_id bigint not null references public.faction_seasons(id) on delete cascade,
  faction_id text not null references public.factions(id) on delete cascade,
  item_id text not null,
  item_title text not null default 'Edição',
  cover_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (season_id, faction_id, item_id)
);
create index if not exists faction_mandatory_reads_faction_idx on public.faction_mandatory_reads(faction_id, season_id, sort_order);

alter table public.faction_achievements drop constraint if exists faction_achievements_metric_check;
alter table public.faction_achievements add constraint faction_achievements_metric_check check (metric in ('xp', 'members', 'read', 'comment', 'like', 'chat', 'follow', 'mandatory_readers'));
insert into public.faction_achievements(achievement_key, name, description, icon, metric, threshold, sort_order)
values ('faction_mandatory_readers', 'Clube da missão', 'Pelo menos 100 membros precisam começar uma das leituras obrigatórias da temporada.', '📚', 'mandatory_readers', 100, 9)
on conflict (achievement_key) do update set name = excluded.name, description = excluded.description, icon = excluded.icon, metric = excluded.metric, threshold = excluded.threshold, sort_order = excluded.sort_order;

create or replace function public.ensure_faction_mandatory_reads(p_faction_id text, p_candidates jsonb)
returns table(item_id text, item_title text, cover_url text, sort_order integer)
language plpgsql security definer set search_path = public
as $$
declare
  v_season public.faction_seasons%rowtype;
begin
  if not exists (select 1 from public.factions where id = p_faction_id) then return; end if;
  v_season := public.current_faction_season();
  if not exists (select 1 from public.faction_mandatory_reads where season_id = v_season.id and faction_id = p_faction_id) then
    insert into public.faction_mandatory_reads(season_id, faction_id, item_id, item_title, cover_url, sort_order)
    select v_season.id, p_faction_id,
      candidate.value->>'id', left(coalesce(nullif(candidate.value->>'title', ''), 'Edição'), 200),
      nullif(candidate.value->>'cover_url', ''), row_number() over (order by random())::integer
    from jsonb_array_elements(coalesce(p_candidates, '[]'::jsonb)) candidate
    where jsonb_typeof(candidate.value) = 'object'
      and nullif(candidate.value->>'id', '') is not null
    order by random()
    limit 3
    on conflict do nothing;
  end if;
  return query select reads.item_id, reads.item_title, reads.cover_url, reads.sort_order
    from public.faction_mandatory_reads reads
    where reads.season_id = v_season.id and reads.faction_id = p_faction_id
    order by reads.sort_order, reads.item_id;
end;
$$;
grant execute on function public.ensure_faction_mandatory_reads(text, jsonb) to authenticated;

create or replace function public.get_faction_mandatory_reads(p_faction_id text)
returns table(item_id text, item_title text, cover_url text, reader_count bigint, completed_count bigint)
language sql stable security definer set search_path = public
as $$
  select reads.item_id, reads.item_title, reads.cover_url,
    count(distinct case when progress.user_id is not null then progress.user_id end) filter (where member.id is not null),
    count(distinct case when progress.completed then progress.user_id end) filter (where member.id is not null)
  from public.faction_mandatory_reads reads
  join public.faction_seasons season on season.id = reads.season_id and season.season_key = date_trunc('month', current_date)::date
  left join public.reading_progress progress on progress.item_id = reads.item_id
  left join public.profiles member on member.id = progress.user_id and member.faction_id = p_faction_id
  where reads.faction_id = p_faction_id
  group by reads.item_id, reads.item_title, reads.cover_url, reads.sort_order
  order by reads.sort_order, reads.item_id
$$;
grant execute on function public.get_faction_mandatory_reads(text) to anon, authenticated;

create or replace function public.complete_faction_mandatory_read(p_item_id text)
returns boolean language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_faction_id text;
  v_season public.faction_seasons%rowtype;
begin
  if v_user_id is null then return false; end if;
  select profile.faction_id into v_faction_id from public.profiles profile where profile.id = v_user_id;
  if v_faction_id is null then return false; end if;
  v_season := public.current_faction_season();
  if not exists (select 1 from public.faction_mandatory_reads reads where reads.season_id = v_season.id and reads.faction_id = v_faction_id and reads.item_id = p_item_id) then return false; end if;
  if not exists (select 1 from public.reading_progress progress where progress.user_id = v_user_id and progress.item_id = p_item_id and progress.completed) then return false; end if;
  insert into public.faction_xp_events(season_id, faction_id, user_id, event_type, event_key, xp)
  values (v_season.id, v_faction_id, v_user_id, 'mandatory_read', 'mandatory-read:' || v_season.id::text || ':' || p_item_id, 25)
  on conflict (season_id, user_id, event_key) do nothing;
  return found;
end;
$$;
grant execute on function public.complete_faction_mandatory_read(text) to authenticated;

create or replace function public.get_faction_achievements(p_faction_id text)
returns table(achievement_id bigint, achievement_key text, name text, description text, icon text, metric text, threshold integer, progress integer, unlocked boolean, unlocked_at timestamptz)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare v_season public.faction_seasons%rowtype;
begin
  if not exists (select 1 from public.factions where id = p_faction_id) then return; end if;
  v_season := public.current_faction_season();
  with metrics as (
    select a.id, case a.metric
      when 'xp' then coalesce((select sum(xp) from public.faction_xp_events where season_id = v_season.id and faction_id = p_faction_id), 0)
      when 'members' then (select count(*) from public.faction_memberships where faction_id = p_faction_id)
      when 'mandatory_readers' then (select count(distinct progress.user_id) from public.faction_mandatory_reads reads join public.reading_progress progress on progress.item_id = reads.item_id join public.profiles member on member.id = progress.user_id and member.faction_id = p_faction_id where reads.season_id = v_season.id and reads.faction_id = p_faction_id)
      else (select count(*) from public.faction_xp_events where season_id = v_season.id and faction_id = p_faction_id and event_type = a.metric)
    end::integer as progress
    from public.faction_achievements a
  )
  insert into public.faction_achievement_awards(faction_id, season_id, achievement_id)
  select p_faction_id, v_season.id, metrics.id from metrics join public.faction_achievements a on a.id = metrics.id where metrics.progress >= a.threshold
  on conflict (faction_id, season_id, achievement_id) do nothing;
  return query
  with metrics as (
    select a.id, case a.metric
      when 'xp' then coalesce((select sum(xp) from public.faction_xp_events where season_id = v_season.id and faction_id = p_faction_id), 0)
      when 'members' then (select count(*) from public.faction_memberships where faction_id = p_faction_id)
      when 'mandatory_readers' then (select count(distinct progress.user_id) from public.faction_mandatory_reads reads join public.reading_progress progress on progress.item_id = reads.item_id join public.profiles member on member.id = progress.user_id and member.faction_id = p_faction_id where reads.season_id = v_season.id and reads.faction_id = p_faction_id)
      else (select count(*) from public.faction_xp_events where season_id = v_season.id and faction_id = p_faction_id and event_type = a.metric)
    end::integer as progress
    from public.faction_achievements a
  )
  select a.id, a.achievement_key, a.name, a.description, a.icon, a.metric, a.threshold, least(metrics.progress, a.threshold), metrics.progress >= a.threshold, case when metrics.progress >= a.threshold then awards.unlocked_at else null end
  from metrics join public.faction_achievements a on a.id = metrics.id
  left join public.faction_achievement_awards awards on awards.faction_id = p_faction_id and awards.season_id = v_season.id and awards.achievement_id = a.id
  order by a.created_at desc, a.sort_order, a.id;
end;
$$;
grant execute on function public.get_faction_achievements(text) to anon, authenticated;

alter table public.faction_mandatory_reads enable row level security;
drop policy if exists "faction mandatory reads are public" on public.faction_mandatory_reads;
create policy "faction mandatory reads are public" on public.faction_mandatory_reads for select using (true);
notify pgrst, 'reload schema';

-- Permite que a nova abafac seja reorganizada pelos gestores da facção.
create or replace function public.update_faction_abafac_order(p_faction_id text, p_order jsonb)
returns void language plpgsql security definer set search_path = public
as $$
declare v_actor public.profiles%rowtype;
begin
  select * into v_actor from public.profiles where id = auth.uid();
  if v_actor.id is null or not exists (select 1 from public.faction_roles where user_id = v_actor.id and faction_id = p_faction_id and role in ('leader', 'curator')) then raise exception 'Apenas líderes e curadores podem reorganizar as abas da facção'; end if;
  if jsonb_typeof(p_order) <> 'array' or not (p_order @> '["stats"]'::jsonb) then raise exception 'Ordem de abas inválida'; end if;
  if exists (select 1 from jsonb_array_elements_text(p_order) item(value) where item.value not in ('stats', 'manifest', 'mural', 'missions', 'mandatory-reads', 'achievements', 'hall', 'report', 'leadership', 'members') and not (item.value ~ '^image:[0-9]+$' and exists (select 1 from public.faction_abafac_images image where image.id = split_part(item.value, ':', 2)::bigint and image.faction_id = p_faction_id)) and not (item.value ~ '^catalog:[0-9]+$' and exists (select 1 from public.faction_abafac_catalogs catalog where catalog.id = split_part(item.value, ':', 2)::bigint and catalog.faction_id = p_faction_id)) and not (item.value ~ '^faction-catalog:[0-9]+$' and exists (select 1 from public.faction_catalogs catalog where catalog.id = split_part(item.value, ':', 2)::bigint and catalog.faction_id = p_faction_id))) then raise exception 'A ordem possui abas inválidas'; end if;
  if (select count(*) from jsonb_array_elements_text(p_order)) <> (select count(distinct value) from jsonb_array_elements_text(p_order)) then raise exception 'A ordem possui abas repetidas'; end if;
  update public.factions set abafac_order = p_order where id = p_faction_id;
end;
$$;
grant execute on function public.update_faction_abafac_order(text, jsonb) to authenticated;
