create table if not exists public.catalog_item_visibility (
  item_id text primary key,
  is_hidden boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists catalog_item_visibility_hidden_idx
  on public.catalog_item_visibility(is_hidden);

alter table public.catalog_item_visibility enable row level security;

drop policy if exists "catalog item visibility is public" on public.catalog_item_visibility;
drop policy if exists "admins manage catalog item visibility" on public.catalog_item_visibility;

create policy "catalog item visibility is public"
  on public.catalog_item_visibility for select using (true);

create policy "admins manage catalog item visibility"
  on public.catalog_item_visibility for all
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.catalog_item_visibility to anon, authenticated;
grant insert, update, delete on public.catalog_item_visibility to authenticated;
