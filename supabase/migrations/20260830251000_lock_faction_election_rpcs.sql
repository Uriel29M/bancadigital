-- As RPCs eleitorais só podem ser chamadas por usuários autenticados.
revoke execute on function public.faction_election_eligible_member(uuid, text) from public, anon;
revoke execute on function public.ensure_faction_election(text) from public, anon;
revoke execute on function public.register_faction_curator_candidate(text) from public, anon;
revoke execute on function public.cast_faction_election_vote(bigint, text, uuid) from public, anon;
revoke execute on function public.get_faction_election(text) from public, anon;
grant execute on function public.faction_election_eligible_member(uuid, text) to authenticated;
grant execute on function public.ensure_faction_election(text) to authenticated;
grant execute on function public.register_faction_curator_candidate(text) to authenticated;
grant execute on function public.cast_faction_election_vote(bigint, text, uuid) to authenticated;
grant execute on function public.get_faction_election(text) to authenticated;
