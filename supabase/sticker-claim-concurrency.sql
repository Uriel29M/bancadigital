-- Corrige concessões simultâneas da mesma figurinha.
-- Execute depois de sticker-album.sql.
create or replace function public.claim_character_sticker(
  p_character_id text, p_character_name text, p_publisher_name text,
  p_edition_fingerprint text, p_edition_ids jsonb, p_cover_item_id text, p_cover_url text
)
returns public.sticker_awards
language plpgsql security definer set search_path = public
as $$
declare
  v_award public.sticker_awards;
  v_completed integer;
  v_total integer;
  v_roll integer;
  v_existing public.sticker_awards;
  v_previous public.sticker_awards;
  v_previous_2 public.sticker_awards;
  v_cover_item_id text;
  v_cover_url text;
begin
  if auth.uid() is null then raise exception 'É preciso estar autenticado'; end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text || ':' || p_character_id || ':' || p_edition_fingerprint));
  if nullif(trim(p_character_id), '') is null or nullif(trim(p_character_name), '') is null
    or nullif(trim(p_publisher_name), '') is null or nullif(trim(p_edition_fingerprint), '') is null
    or nullif(trim(p_cover_item_id), '') is null or nullif(trim(p_cover_url), '') is null
    or jsonb_typeof(p_edition_ids) <> 'array' or jsonb_array_length(p_edition_ids) = 0
  then raise exception 'Dados da figurinha inválidos'; end if;
  if p_cover_url !~ '^https://|^data:image/' then raise exception 'Capa da figurinha inválida'; end if;
  select count(*) into v_total from jsonb_array_elements_text(p_edition_ids);
  select count(*) into v_completed from public.reading_progress
  where user_id = auth.uid() and completed and item_id in (select value from jsonb_array_elements_text(p_edition_ids));
  if v_total <> v_completed then raise exception 'Todas as edições do personagem precisam estar lidas'; end if;
  if exists (select 1 from public.sticker_awards where user_id = auth.uid() and character_id = p_character_id and edition_fingerprint = p_edition_fingerprint) then
    select * into v_award from public.sticker_awards where user_id = auth.uid() and character_id = p_character_id and edition_fingerprint = p_edition_fingerprint limit 1;
    return v_award;
  end if;
  if exists (select 1 from public.sticker_claim_history where user_id = auth.uid() and character_id = p_character_id and edition_fingerprint = p_edition_fingerprint) then
    raise exception 'Esta versão da figurinha já foi conquistada; aguarde uma nova edição do personagem';
  end if;
  v_roll := floor(random() * 100)::integer;
  v_cover_item_id := p_cover_item_id;
  v_cover_url := p_cover_url;
  select * into v_existing from public.sticker_awards where user_id = auth.uid() and character_id = p_character_id order by awarded_at desc, id desc limit 1;
  select * into v_previous from public.sticker_awards where user_id = auth.uid() and character_id = p_character_id order by awarded_at desc, id desc offset 0 limit 1;
  select * into v_previous_2 from public.sticker_awards where user_id = auth.uid() and character_id = p_character_id order by awarded_at desc, id desc offset 1 limit 1;
  if v_existing.id is not null and not (v_previous.id is not null and v_previous_2.id is not null and v_previous.cover_url = v_previous_2.cover_url) and random() < 0.70 then
    v_cover_item_id := v_existing.cover_item_id; v_cover_url := v_existing.cover_url;
  end if;
  if v_previous.id is not null and v_previous_2.id is not null and v_previous.cover_url = v_previous_2.cover_url and v_cover_url = v_previous.cover_url then
    raise exception 'A mesma imagem não pode sair três vezes seguidas';
  end if;
  insert into public.sticker_claim_history(user_id, character_id, edition_fingerprint) values (auth.uid(), p_character_id, p_edition_fingerprint);
  insert into public.sticker_awards(user_id, character_id, character_name, publisher_name, edition_fingerprint, cover_item_id, cover_url, rarity, album_section)
  values (auth.uid(), p_character_id, left(trim(p_character_name),160), left(trim(p_publisher_name),160), left(trim(p_edition_fingerprint),500), left(trim(v_cover_item_id),200), left(trim(v_cover_url),2000), case when p_edition_fingerprint like 'read:%' then 'standard' when p_character_id like 'series::%' then 'silver' else 'gold' end, case when p_edition_fingerprint like 'read:%' then 'repeated' when exists (select 1 from public.sticker_awards where user_id = auth.uid() and character_id = p_character_id and album_section = 'pasted') then 'repeated' else 'pasted' end)
  returning * into v_award;
  return v_award;
end;
$$;
grant execute on function public.claim_character_sticker(text, text, text, text, jsonb, text, text) to authenticated;
