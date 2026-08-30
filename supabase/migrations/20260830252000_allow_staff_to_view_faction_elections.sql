-- Gestores acompanham eleições já criadas sem ganhar direito de voto.
create or replace function public.get_faction_election(p_faction_id text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_election public.faction_elections%rowtype;
  v_plan text;
begin
  select plan into v_plan from public.profiles where id = auth.uid();
  if v_plan in ('moderator', 'banca', 'admin') then
    select * into v_election from public.faction_elections election
    where election.faction_id = p_faction_id
      and election.season_id = (select id from public.faction_seasons where season_key = date_trunc('month', current_date)::date);
  else
    v_election := public.ensure_faction_election(p_faction_id);
  end if;
  if v_election.id is null then return null; end if;
  return jsonb_build_object(
    'id', v_election.id,
    'season_id', v_election.season_id,
    'faction_id', v_election.faction_id,
    'phase', v_election.phase,
    'status', v_election.status,
    'candidacy_ends_at', v_election.candidacy_ends_at,
    'curator_vote_ends_at', v_election.curator_vote_ends_at,
    'ends_at', v_election.ends_at,
    'held_reason', v_election.held_reason,
    'candidates', coalesce((select jsonb_agg(jsonb_build_object('user_id', candidate.user_id, 'office', candidate.office, 'pitch', candidate.pitch) order by candidate.office, candidate.created_at) from public.faction_election_candidates candidate where candidate.election_id = v_election.id), '[]'::jsonb),
    'my_curator_vote', (select candidate_id from public.faction_election_votes where election_id = v_election.id and office = 'curator' and voter_id = auth.uid()),
    'my_leader_vote', (select candidate_id from public.faction_election_votes where election_id = v_election.id and office = 'leader' and voter_id = auth.uid())
  );
end;
$$;
revoke execute on function public.get_faction_election(text) from public, anon;
grant execute on function public.get_faction_election(text) to authenticated;
