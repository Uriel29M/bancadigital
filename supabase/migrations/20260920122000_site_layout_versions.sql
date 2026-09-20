create table if not exists public.site_layout_settings (
  id boolean primary key default true check (id = true),
  active_version text not null default 'principal' check (active_version in ('principal','atual','minimalista')),
  presets jsonb not null default '{}'::jsonb,
  overrides jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.site_layout_settings enable row level security;

drop policy if exists "site layout settings are public" on public.site_layout_settings;
create policy "site layout settings are public"
  on public.site_layout_settings for select
  to anon, authenticated
  using (true);

drop policy if exists "admins insert site layout settings" on public.site_layout_settings;
create policy "admins insert site layout settings"
  on public.site_layout_settings for insert
  to authenticated
  with check (is_admin());

drop policy if exists "admins update site layout settings" on public.site_layout_settings;
create policy "admins update site layout settings"
  on public.site_layout_settings for update
  to authenticated
  using (is_admin())
  with check (is_admin());

drop policy if exists "admins delete site layout settings" on public.site_layout_settings;
create policy "admins delete site layout settings"
  on public.site_layout_settings for delete
  to authenticated
  using (is_admin());

insert into public.site_layout_settings (id, active_version, presets)
values (
  true,
  'principal',
  jsonb_build_object(
    'principal', jsonb_build_object('description','Versão definitiva: melhor hierarquia visual, descoberta, leitura, identidade e menor densidade; permite ajustes por página e seção.'),
    'atual', jsonb_build_object('description','Versão atual: preserva a apresentação existente e serve como retorno seguro.'),
    'minimalista', jsonb_build_object('description','Minimalismo extremo: prioriza conteúdo, leitura e ações principais, ocultando apenas conteúdo secundário.')
  )
)
on conflict (id) do update set presets = excluded.presets, updated_at = now();