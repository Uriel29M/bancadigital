-- Permite que administradores mantenham as páginas verificadas diariamente.
drop policy if exists "admins manage series link sources" on public.series_link_sources;
create policy "admins manage series link sources" on public.series_link_sources
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.series_link_sources to authenticated;
grant usage, select on sequence public.series_link_sources_id_seq to authenticated;
