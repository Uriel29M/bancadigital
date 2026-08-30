-- Novos usuários começam seguindo todas as contas Banca.
-- O usuário ainda pode deixar de seguir normalmente pela tabela profile_follows.

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

  insert into public.profile_follows (follower_id, following_id)
  select new.id, profile.id
  from public.profiles profile
  where profile.plan = 'banca' and profile.id <> new.id
  on conflict (follower_id, following_id) do nothing;

  return new;
end;
$$;

