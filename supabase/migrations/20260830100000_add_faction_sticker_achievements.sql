-- Conquistas de facção por figurinhas, doações e trocas.
-- As metas são coletivas e reiniciam a cada temporada.

alter table public.faction_achievements drop constraint if exists faction_achievements_metric_check;
alter table public.faction_achievements add constraint faction_achievements_metric_check check (
  metric in ('xp', 'members', 'read', 'comment', 'like', 'chat', 'follow', 'mandatory_readers', 'sticker', 'sticker_donate', 'sticker_trade')
);

insert into public.faction_achievements (achievement_key, name, description, icon, metric, threshold, sort_order) values
  ('faction_sticker_collectors', 'Álbum compartilhado', 'A facção precisa conquistar 100 figurinhas na temporada. Vale obter por leitura, sorte, doação ou troca.', '🎴', 'sticker', 100, 10),
  ('faction_sticker_donors', 'Mãos generosas', 'Membros da facção precisam realizar 25 doações de figurinhas na temporada.', '🎁', 'sticker_donate', 25, 11),
  ('faction_sticker_traders', 'Mercadores da banca', 'Membros da facção precisam concluir 25 trocas de figurinhas na temporada.', '🔄', 'sticker_trade', 25, 12)
on conflict (achievement_key) do update set name = excluded.name, description = excluded.description, icon = excluded.icon, metric = excluded.metric, threshold = excluded.threshold, sort_order = excluded.sort_order;

-- Usa códigos Unicode para preservar acentos e emojis mesmo quando o arquivo
-- for executado por clientes que não detectam UTF-8 corretamente.
update public.faction_achievements set
  name = case achievement_key
    when 'faction_sticker_collectors' then chr(193) || 'lbum compartilhado'
    when 'faction_sticker_donors' then 'M' || chr(227) || 'os generosas'
    else name
  end,
  description = case achievement_key
    when 'faction_sticker_collectors' then 'A fac' || chr(231) || chr(227) || 'o precisa conquistar 100 figurinhas na temporada. Vale obter por leitura, sorte, doa' || chr(231) || chr(227) || 'o ou troca.'
    when 'faction_sticker_donors' then 'Membros da fac' || chr(231) || chr(227) || 'o precisam realizar 25 doa' || chr(231) || chr(245) || 'es de figurinhas na temporada.'
    when 'faction_sticker_traders' then 'Membros da fac' || chr(231) || chr(227) || 'o precisam concluir 25 trocas de figurinhas na temporada.'
    else description
  end,
  icon = case achievement_key
    when 'faction_sticker_collectors' then chr(127924)
    when 'faction_sticker_donors' then chr(127873)
    when 'faction_sticker_traders' then chr(128260)
    else icon
  end
where achievement_key in ('faction_sticker_collectors', 'faction_sticker_donors', 'faction_sticker_traders');

create or replace function public.record_faction_sticker_event(p_user_id uuid, p_event_type text, p_event_key text)
returns void language plpgsql security definer set search_path = public
as $$
declare v_faction_id text; v_season public.faction_seasons%rowtype;
begin
  if p_event_type not in ('sticker', 'sticker_donate', 'sticker_trade') or p_user_id is null or nullif(trim(p_event_key), '') is null then return; end if;
  select faction_id into v_faction_id from public.profiles where id = p_user_id and plan not in ('moderator', 'admin');
  if v_faction_id is null then return; end if;
  v_season := public.current_faction_season();
  insert into public.faction_xp_events(season_id, faction_id, user_id, event_type, event_key, xp)
  values (v_season.id, v_faction_id, p_user_id, p_event_type, p_event_key, 1)
  on conflict (season_id, user_id, event_key) do nothing;
end;
$$;
revoke all on function public.record_faction_sticker_event(uuid, text, text) from public, anon, authenticated;

create or replace function public.record_sticker_award_for_faction()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  perform public.record_faction_sticker_event(new.user_id, 'sticker', 'sticker:' || new.id::text);
  return new;
end;
$$;
revoke all on function public.record_sticker_award_for_faction() from public, anon, authenticated;
drop trigger if exists record_sticker_award_for_faction_trigger on public.sticker_awards;
create trigger record_sticker_award_for_faction_trigger after insert on public.sticker_awards
for each row execute function public.record_sticker_award_for_faction();

create or replace function public.record_sticker_request_for_faction()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'accepted' and old.status is distinct from new.status then
    if new.request_type = 'gift' then
      perform public.record_faction_sticker_event(new.owner_id, 'sticker_donate', 'sticker-donate:' || new.id::text);
    elsif new.request_type = 'trade' then
      perform public.record_faction_sticker_event(new.owner_id, 'sticker_trade', 'sticker-trade-owner:' || new.id::text);
      perform public.record_faction_sticker_event(new.requester_id, 'sticker_trade', 'sticker-trade-requester:' || new.id::text);
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.record_sticker_request_for_faction() from public, anon, authenticated;
drop trigger if exists record_sticker_request_for_faction_trigger on public.sticker_requests;
create trigger record_sticker_request_for_faction_trigger after update of status on public.sticker_requests
for each row execute function public.record_sticker_request_for_faction();

-- A doação direta usa transfer_sticker_award, sem passar por um pedido aceito.
create or replace function public.transfer_sticker_award(p_recipient_id uuid, p_award_id bigint)
returns public.sticker_awards language plpgsql security definer set search_path = public
as $$
declare v_character_id text; v_result public.sticker_awards;
begin
  select character_id into v_character_id from public.sticker_awards where id = p_award_id and user_id = auth.uid();
  if v_character_id is null then raise exception 'Figurinha não encontrada'; end if;
  if exists (select 1 from public.sticker_slot_preferences where user_id = p_recipient_id and character_id = v_character_id and blocked) then
    raise exception 'Este slot não aceita doações';
  end if;
  v_result := public.donate_sticker_award(p_recipient_id, p_award_id);
  perform public.record_faction_sticker_event(auth.uid(), 'sticker_donate', 'sticker-donate-award:' || p_award_id::text);
  return v_result;
end;
$$;
revoke all on function public.transfer_sticker_award(uuid, bigint) from public;
grant execute on function public.transfer_sticker_award(uuid, bigint) to authenticated;

-- Migra as figurinhas já conquistadas nesta temporada para o progresso atual.
insert into public.faction_xp_events(season_id, faction_id, user_id, event_type, event_key, xp)
select season.id, profile.faction_id, award.user_id, 'sticker', 'sticker:backfill:' || award.id::text, 1
from public.sticker_awards award
join public.profiles profile on profile.id = award.user_id
cross join public.current_faction_season() season
where profile.faction_id is not null and profile.plan not in ('moderator', 'admin') and award.awarded_at >= season.starts_at
on conflict (season_id, user_id, event_key) do nothing;

notify pgrst, 'reload schema';
