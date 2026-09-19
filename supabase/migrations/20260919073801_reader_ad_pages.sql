-- Reader ad pages. Production migration applied on 2026-09-19.
create table public.reader_ads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  image_url text not null check (image_url ~ '^https?://'),
  image_path text null check (image_path is null or char_length(image_path) <= 512),
  link_url text null check (link_url is null or link_url ~ '^https?://'),
  scope_type text not null default 'all' check (scope_type in ('all','publisher','imprint','series','edition')),
  scope_value text null check (scope_value is null or char_length(scope_value) <= 256),
  position_type text not null default 'between' check (position_type in ('first','last','between')),
  after_page integer null check (after_page is null or after_page >= 1),
  starts_at timestamptz not null default now(),
  ends_at timestamptz null,
  is_active boolean not null default true,
  view_count bigint not null default 0 check (view_count >= 0),
  click_count bigint not null default 0 check (click_count >= 0),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reader_ads_scope_target_check check ((scope_type='all' and scope_value is null) or (scope_type<>'all' and nullif(trim(scope_value),'') is not null)),
  constraint reader_ads_position_target_check check ((position_type='between' and after_page is not null) or (position_type<>'between' and after_page is null)),
  constraint reader_ads_period_check check (ends_at is null or ends_at > starts_at)
);
create index reader_ads_active_period_idx on public.reader_ads (is_active,starts_at,ends_at);
create index reader_ads_scope_idx on public.reader_ads (scope_type,scope_value);
alter table public.reader_ads enable row level security;
grant select on public.reader_ads to anon,authenticated;
grant insert,update,delete on public.reader_ads to authenticated;
create policy "active reader ads are public" on public.reader_ads for select to anon,authenticated using (public.is_admin() or (is_active and starts_at<=now() and (ends_at is null or ends_at>now())));
create policy "admins insert reader ads" on public.reader_ads for insert to authenticated with check (public.is_admin() and created_by=auth.uid());
create policy "admins update reader ads" on public.reader_ads for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete reader ads" on public.reader_ads for delete to authenticated using (public.is_admin());
create table public.reader_ad_events (
  ad_id uuid not null references public.reader_ads(id) on delete cascade,
  event_type text not null check (event_type in ('view','click')),
  viewer_key uuid not null,
  item_id text not null default '' check (char_length(item_id)<=256),
  created_at timestamptz not null default now(),
  primary key(ad_id,event_type,viewer_key)
);
alter table public.reader_ad_events enable row level security;
grant insert on public.reader_ad_events to anon,authenticated;
create policy "readers record reader ad events" on public.reader_ad_events for insert to anon,authenticated with check (
  event_type in ('view','click') and exists(select 1 from public.reader_ads ad where ad.id=ad_id and ad.is_active and ad.starts_at<=now() and (ad.ends_at is null or ad.ends_at>now()))
);
create or replace function private.reader_ad_event_increment() returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.reader_ads set view_count=view_count+case when new.event_type='view' then 1 else 0 end,click_count=click_count+case when new.event_type='click' then 1 else 0 end,updated_at=now() where id=new.ad_id;
  return new;
end; $$;
revoke all on function private.reader_ad_event_increment() from public,anon,authenticated;
create trigger reader_ad_event_increment after insert on public.reader_ad_events for each row execute function private.reader_ad_event_increment();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('reader-ads','reader-ads',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy "admins upload reader ad images" on storage.objects for insert to authenticated with check(bucket_id='reader-ads' and public.is_admin() and (storage.foldername(name))[1]=(auth.uid())::text);
create policy "admins delete reader ad images" on storage.objects for delete to authenticated using(bucket_id='reader-ads' and public.is_admin());
