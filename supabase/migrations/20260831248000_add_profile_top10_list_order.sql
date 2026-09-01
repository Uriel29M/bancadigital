alter table public.profile_top10_lists
  add column if not exists sort_order integer not null default 0;

with ordered as (
  select id, row_number() over (partition by owner_id order by created_at, id) - 1 as position
  from public.profile_top10_lists
)
update public.profile_top10_lists lists
set sort_order = ordered.position
from ordered
where lists.id = ordered.id;

create index if not exists profile_top10_lists_owner_order_idx on public.profile_top10_lists(owner_id, sort_order, created_at);
