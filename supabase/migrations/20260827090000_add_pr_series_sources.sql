-- Fontes do monitoramento das séries P-R obtidas no catálogo Só Quadrinhos.
insert into public.series_link_sources (series_id, source_url, provider, enabled)
values
  ('series-penguin-2023', 'https://hqs-soquadrinhos.blogspot.com/2023/08/pinguim-2023.html', 'blogspot', true),
  ('series-lazarus-planet-2023', 'https://hqs-soquadrinhos.blogspot.com/2023/06/planeta-lazaro-2023.html', 'blogspot', true),
  ('series-power-girl-special-2023', 'https://hqs-soquadrinhos.blogspot.com/2023/08/poderosa-especial.html', 'blogspot', true),
  ('series-absolute-power-2024', 'https://hqs-soquadrinhos.blogspot.com/2024/07/poder-absoluto-2024.html', 'blogspot', true),
  ('series-monkey-prince-2022', 'https://hqs-soquadrinhos.blogspot.com/2023/01/principe-macaco-2022.html', 'blogspot', true),
  ('series-question-watchtower-2024', 'https://hqs-soquadrinhos.blogspot.com/2024/11/questao-ao-longo-da-torre-de-vigilancia.html', 'blogspot', true),
  ('series-robin-2021', 'https://hqs-soquadrinhos.blogspot.com/2023/01/robin-2021.html', 'blogspot', true)
on conflict (series_id, source_url) do update
  set provider = excluded.provider, enabled = true, updated_at = now();
