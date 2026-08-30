-- Avatares agora são links externos. O Storage não deve mais aceitar uploads.
-- A exclusão física dos arquivos existentes deve ser feita pela Storage API
-- (Dashboard > Storage > avatars ou .remove), pois apagar storage.objects via
-- SQL deixa os arquivos órfãos no backend de Storage.

alter table public.profiles drop constraint if exists profiles_avatar_url_check;
update public.profiles
set avatar_url = 'https://api.dicebear.com/9.x/thumbs/svg?seed=' || id::text || '&backgroundColor=f3f4f6&shapeColor=e85b68';
alter table public.profiles
  add constraint profiles_avatar_url_check check (avatar_url is null or avatar_url ~* '^https?://');

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, account_email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    new.email,
    'https://api.dicebear.com/9.x/thumbs/svg?seed=' || new.id::text || '&backgroundColor=f3f4f6&shapeColor=e85b68'
  );
  return new;
end;
$$;

drop policy if exists "avatars are public" on storage.objects;
drop policy if exists "users upload own avatar" on storage.objects;
drop policy if exists "users update own avatar" on storage.objects;
drop policy if exists "users delete own avatar" on storage.objects;
