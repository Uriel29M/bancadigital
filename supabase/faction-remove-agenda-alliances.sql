-- Remove abas antigas que não fazem mais parte das facções.
update public.factions
set abafac_order = coalesce((select jsonb_agg(item.value order by item.ordinality)
  from jsonb_array_elements(coalesce(abafac_order, '[]'::jsonb)) with ordinality item(value, ordinality)
  where item.value not in ('"agenda"'::jsonb, '"alliances"'::jsonb)), '[]'::jsonb)
where coalesce(abafac_order, '[]'::jsonb) ?| array['agenda', 'alliances'];

notify pgrst, 'reload schema';
