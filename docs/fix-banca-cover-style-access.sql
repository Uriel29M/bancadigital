-- Inclui Banca no acesso à capa dourada, conforme a interface.
-- A política user_cover_styles continua exigindo auth.uid() = user_id.
create or replace function public.can_apply_cover_style(p_style text)
returns boolean language sql stable security definer set search_path = public
as $$
  select auth.uid() is not null
    and (
      p_style = 'grayscale'
      or exists (select 1 from public.profiles where id = auth.uid() and (plan in ('premium', 'moderator', 'banca', 'admin') or (plan = 'free' and public.is_legendary_event_active())))
    )
$$;
