create schema if not exists private;

create table if not exists private.catalog_item_registry (
  item_id text primary key,
  first_seen_at timestamptz not null default now()
);

insert into private.catalog_item_registry(item_id)
select distinct item_id
from (
  select item_id from public.catalog_edition_overrides
  union all select item_id from public.comic_read_counts
  union all select item_id from public.comic_download_counts
  union all select item_id from public.comic_monthly_read_counts
  union all select item_id from public.reading_progress
  union all select item_id from public.comic_likes
  union all select item_id from public.comments
) known
where nullif(trim(item_id), '') is not null
on conflict (item_id) do nothing;

create or replace function private.register_catalog_item()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if new.item_id is not null and length(trim(new.item_id)) between 1 and 200 then
    insert into private.catalog_item_registry(item_id)
    values (new.item_id)
    on conflict (item_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function private.register_catalog_item() from public, anon, authenticated;

drop trigger if exists register_catalog_override_item on public.catalog_edition_overrides;
create trigger register_catalog_override_item
after insert or update of item_id on public.catalog_edition_overrides
for each row execute function private.register_catalog_item();

alter table public.reading_progress add column if not exists started_at timestamptz;
update public.reading_progress set started_at = coalesce(started_at, updated_at, now()) where started_at is null;
alter table public.reading_progress alter column started_at set default now();
alter table public.reading_progress alter column started_at set not null;

create or replace function public.preserve_reading_started_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.started_at := now();
  else
    new.started_at := old.started_at;
  end if;
  return new;
end;
$$;

drop trigger if exists preserve_reading_started_at_trigger on public.reading_progress;
create trigger preserve_reading_started_at_trigger
before insert or update on public.reading_progress
for each row execute function public.preserve_reading_started_at();

create table if not exists private.comic_metric_events (
  id bigint generated always as identity primary key,
  metric_type text not null check (metric_type in ('read','download')),
  item_id text not null,
  actor_key text not null,
  window_bucket timestamptz not null,
  created_at timestamptz not null default now(),
  unique(metric_type, item_id, actor_key, window_bucket)
);
create index if not exists comic_metric_events_actor_recent_idx
  on private.comic_metric_events(actor_key, metric_type, created_at desc);
alter table private.comic_metric_events enable row level security;

create or replace function private.metric_actor_key()
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_headers jsonb;
  v_ip text;
  v_agent text;
begin
  if v_uid is not null then return 'user:' || v_uid::text; end if;
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    v_headers := '{}'::jsonb;
  end;
  v_ip := nullif(split_part(coalesce(v_headers->>'x-forwarded-for', v_headers->>'x-real-ip', v_headers->>'cf-connecting-ip', ''), ',', 1), '');
  v_agent := coalesce(v_headers->>'user-agent', '');
  if v_ip is null then return null; end if;
  return 'anon:' || md5(v_ip || '|' || left(v_agent, 256));
end;
$$;
revoke all on function private.metric_actor_key() from public, anon, authenticated;

create or replace function private.award_verified_xp(
  p_user_id uuid, p_event_type text, p_event_key text, p_xp integer,
  p_daily_limit integer default null, p_award_faction boolean default true
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_inserted boolean := false;
  v_faction text;
  v_plan text;
  v_season public.faction_seasons%rowtype;
begin
  if p_user_id is null or p_xp <= 0 or nullif(trim(p_event_type), '') is null or nullif(trim(p_event_key), '') is null then return false; end if;
  select profile.faction_id, profile.plan into v_faction, v_plan
  from public.profiles profile
  where profile.id = p_user_id and not coalesce(profile.is_bot, false);
  if not found then return false; end if;

  if p_daily_limit is not null and p_daily_limit > 0 and (
    select count(*) from public.profile_xp_events events
    where events.user_id = p_user_id and events.event_type = p_event_type
      and events.created_at >= now() - interval '24 hours'
  ) >= p_daily_limit then return false; end if;

  insert into public.profile_xp_events(user_id, event_type, event_key, xp)
  values (p_user_id, p_event_type, p_event_key, p_xp)
  on conflict (user_id, event_key) do nothing;
  v_inserted := found;
  if not v_inserted then return false; end if;

  update public.profiles
  set xp = xp + p_xp, level = public.profile_level_for_xp(xp + p_xp)
  where id = p_user_id;

  if p_award_faction and v_faction is not null
     and v_plan not in ('moderator','banca','admin')
     and p_event_type in ('read','comment','like','chat','follow') then
    v_season := public.current_faction_season();
    insert into public.faction_xp_events(season_id, faction_id, user_id, event_type, event_key, xp)
    values (v_season.id, v_faction, p_user_id, p_event_type, p_event_key, p_xp)
    on conflict (season_id, user_id, event_key) do nothing;
    if found then perform public.ensure_faction_leadership(v_faction); end if;
  end if;
  return true;
end;
$$;
revoke all on function private.award_verified_xp(uuid,text,text,integer,integer,boolean) from public, anon, authenticated;

create or replace function public.award_xp_on_read_completion()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, private as $$
begin
  if new.completed and (tg_op = 'INSERT' or not coalesce(old.completed, false))
     and new.completion_source = 'normal'
     and new.total_pages >= 3
     and new.page >= greatest(1, new.total_pages - 2)
     and new.started_at <= now() - interval '90 seconds'
     and exists (select 1 from private.catalog_item_registry r where r.item_id = new.item_id) then
    perform private.award_verified_xp(new.user_id,'read','read:' || new.item_id,10,10,true);
  end if;
  return new;
end;
$$;
drop trigger if exists award_xp_on_read_completion_trigger on public.reading_progress;
create trigger award_xp_on_read_completion_trigger after insert or update of completed on public.reading_progress
for each row execute function public.award_xp_on_read_completion();

create or replace function public.award_xp_on_comic_like()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, private as $$
begin
  if exists (select 1 from private.catalog_item_registry r where r.item_id = new.item_id) then
    perform private.award_verified_xp(new.user_id,'like','like:' || new.item_id,2,20,true);
  end if;
  return new;
end;
$$;
drop trigger if exists award_xp_on_comic_like_trigger on public.comic_likes;
create trigger award_xp_on_comic_like_trigger after insert on public.comic_likes
for each row execute function public.award_xp_on_comic_like();

create or replace function public.award_xp_on_comic_comment()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, private as $$
begin
  if exists (select 1 from private.catalog_item_registry r where r.item_id = new.item_id) then
    perform private.award_verified_xp(new.user_id,'comment','comic-comment:' || new.id::text,5,10,true);
  end if;
  return new;
end;
$$;
drop trigger if exists award_xp_on_comic_comment_trigger on public.comments;
create trigger award_xp_on_comic_comment_trigger after insert on public.comments
for each row execute function public.award_xp_on_comic_comment();

create or replace function public.award_xp_on_collection_comment()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, private as $$
begin
  perform private.award_verified_xp(new.user_id,'comment','collection-comment:' || new.id::text,5,10,true);
  return new;
end;
$$;
drop trigger if exists award_xp_on_collection_comment_trigger on public.shelf_collection_comments;
create trigger award_xp_on_collection_comment_trigger after insert on public.shelf_collection_comments
for each row execute function public.award_xp_on_collection_comment();

create or replace function public.award_xp_on_chat_message()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, private as $$
begin
  perform private.award_verified_xp(new.sender_id,'chat','chat:' || new.id::text,3,20,true);
  return new;
end;
$$;
drop trigger if exists award_xp_on_chat_message_trigger on public.chat_messages;
create trigger award_xp_on_chat_message_trigger after insert on public.chat_messages
for each row execute function public.award_xp_on_chat_message();

create or replace function public.award_xp_on_follow()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, private as $$
begin
  perform private.award_verified_xp(new.follower_id,'follow','follow:' || new.following_id::text,2,10,true);
  return new;
end;
$$;
drop trigger if exists award_xp_on_follow_trigger on public.profile_follows;
create trigger award_xp_on_follow_trigger after insert on public.profile_follows
for each row execute function public.award_xp_on_follow();

create or replace function public.increment_comic_read(p_item_id text)
returns bigint language plpgsql security definer
set search_path = pg_catalog, public, private as $$
declare
  v_clicks bigint := 0;
  v_actor text;
  v_bucket timestamptz;
  v_month_start date := date_trunc('month', now())::date;
  v_inserted boolean := false;
begin
  if p_item_id is null or length(trim(p_item_id)) = 0 or length(p_item_id) > 200 then raise exception 'Invalid comic item id'; end if;
  select coalesce(clicks,0) into v_clicks from public.comic_read_counts where item_id=p_item_id;
  if not exists (select 1 from private.catalog_item_registry r where r.item_id=p_item_id) then return coalesce(v_clicks,0); end if;
  v_actor := private.metric_actor_key();
  if v_actor is null then return coalesce(v_clicks,0); end if;
  if (select count(*) from private.comic_metric_events e where e.actor_key=v_actor and e.metric_type='read' and e.created_at>=now()-interval '1 hour') >= 120 then return coalesce(v_clicks,0); end if;
  v_bucket := to_timestamp(floor(extract(epoch from now())/1800)*1800);
  insert into private.comic_metric_events(metric_type,item_id,actor_key,window_bucket)
  values ('read',p_item_id,v_actor,v_bucket) on conflict do nothing;
  v_inserted := found;
  if not v_inserted then return coalesce(v_clicks,0); end if;
  insert into public.comic_read_counts(item_id,clicks,updated_at) values (p_item_id,1,now())
  on conflict (item_id) do update set clicks=public.comic_read_counts.clicks+1, updated_at=now()
  returning clicks into v_clicks;
  insert into public.comic_monthly_read_counts(item_id,month_start,clicks,updated_at) values (p_item_id,v_month_start,1,now())
  on conflict (item_id,month_start) do update set clicks=public.comic_monthly_read_counts.clicks+1, updated_at=now();
  return v_clicks;
end;
$$;

create or replace function public.increment_comic_download(p_item_id text)
returns bigint language plpgsql security definer
set search_path = pg_catalog, public, private as $$
declare
  v_downloads bigint := 0;
  v_actor text;
  v_bucket timestamptz;
  v_inserted boolean := false;
begin
  if p_item_id is null or length(trim(p_item_id)) = 0 or length(p_item_id) > 200 then raise exception 'Invalid comic item id'; end if;
  select coalesce(downloads,0) into v_downloads from public.comic_download_counts where item_id=p_item_id;
  if not exists (select 1 from private.catalog_item_registry r where r.item_id=p_item_id) then return coalesce(v_downloads,0); end if;
  v_actor := private.metric_actor_key();
  if v_actor is null then return coalesce(v_downloads,0); end if;
  if (select count(*) from private.comic_metric_events e where e.actor_key=v_actor and e.metric_type='download' and e.created_at>=now()-interval '1 hour') >= 30 then return coalesce(v_downloads,0); end if;
  v_bucket := date_trunc('day',now());
  insert into private.comic_metric_events(metric_type,item_id,actor_key,window_bucket)
  values ('download',p_item_id,v_actor,v_bucket) on conflict do nothing;
  v_inserted := found;
  if not v_inserted then return coalesce(v_downloads,0); end if;
  insert into public.comic_download_counts(item_id,downloads,updated_at) values (p_item_id,1,now())
  on conflict (item_id) do update set downloads=public.comic_download_counts.downloads+1, updated_at=now()
  returning downloads into v_downloads;
  return v_downloads;
end;
$$;

revoke execute on function public.grant_profile_xp(text,text) from public, anon, authenticated;
revoke execute on function public.grant_faction_xp(text,text) from public, anon, authenticated;

revoke insert, update, delete, truncate, references, trigger
on public.profile_xp_events, public.faction_xp_events,
   public.comic_read_counts, public.comic_download_counts, public.comic_monthly_read_counts
from anon, authenticated;

grant select on public.faction_xp_events,
  public.comic_read_counts, public.comic_download_counts, public.comic_monthly_read_counts
to anon, authenticated;

revoke all on private.catalog_item_registry, private.comic_metric_events from anon, authenticated;
