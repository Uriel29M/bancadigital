-- Figurinha escolhida para aparecer ao lado da foto de perfil.
alter table public.profiles
  add column if not exists profile_sticker_award_id bigint references public.sticker_awards(id) on delete set null;

create or replace function public.set_profile_sticker(p_award_id bigint default null)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Você precisa estar autenticado'; end if;
  if p_award_id is not null and not exists (
    select 1 from public.sticker_awards
    where id = p_award_id and user_id = auth.uid() and album_section = 'pasted'
  ) then raise exception 'Escolha uma figurinha colada no álbum'; end if;
  update public.profiles set profile_sticker_award_id = p_award_id where id = auth.uid();
end;
$$;
grant execute on function public.set_profile_sticker(bigint) to authenticated;
notify pgrst, 'reload schema';
