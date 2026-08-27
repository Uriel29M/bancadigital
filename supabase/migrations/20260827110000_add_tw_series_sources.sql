-- Fontes do monitoramento das séries T-W obtidas no catálogo Só Quadrinhos.
insert into public.series_link_sources (series_id, source_url, provider, enabled)
values
  ('series-titans-2023', 'https://hqs-soquadrinhos.blogspot.com/2023/05/titas-2023.html', 'blogspot', true),
  ('series-wildcats-2023', 'https://hqs-soquadrinhos.blogspot.com/2023/03/wildcats-2023.html', 'blogspot', true)
on conflict (series_id, source_url) do update
  set provider = excluded.provider, enabled = true, updated_at = now();
