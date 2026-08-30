-- Permite que o dono do mural exclua comentários publicados por outros usuários.
drop policy if exists "users delete profile wall comments" on public.profile_wall_comments;
create policy "users delete profile wall comments"
  on public.profile_wall_comments
  for delete
  using (
    auth.uid() = user_id
    or auth.uid() = profile_id
    or public.is_moderator()
  );
