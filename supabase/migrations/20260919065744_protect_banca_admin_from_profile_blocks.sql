delete from public.profile_blocks pb
using public.profiles p
where p.id = pb.blocked_id
  and lower(coalesce(p.plan, '')) in ('banca', 'admin');

drop policy if exists "users create profile blocks" on public.profile_blocks;

create policy "users create profile blocks"
on public.profile_blocks
for insert
to authenticated
with check (
  (select auth.uid()) = blocker_id
  and blocker_id <> blocked_id
  and exists (
    select 1
    from public.profiles target
    where target.id = blocked_id
      and lower(coalesce(target.plan, '')) not in ('banca', 'admin')
  )
);
