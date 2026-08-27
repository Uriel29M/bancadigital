-- Fontes do monitoramento das séries Batman obtidas no catálogo Só Quadrinhos.
insert into public.series_link_sources (series_id, source_url, provider, enabled)
values
  ('series-batgirls-2022', 'https://hqs-soquadrinhos.blogspot.com/2022/04/batgirls-2022.html', 'blogspot', true),
  ('series-batman-beyond-neo-year-2022', 'https://hqs-soquadrinhos.blogspot.com/2023/10/batman-do-futuro-neoano-2022.html', 'blogspot', true),
  ('series-batman-and-robin-2023', 'https://hqs-soquadrinhos.blogspot.com/2023/09/batman-e-robin-2023.html', 'blogspot', true),
  ('series-batman-vs-robin-2022', 'https://hqs-soquadrinhos.blogspot.com/2023/01/batman-vs-robin-2022.html', 'blogspot', true),
  ('series-batman-killing-time-2022', 'https://hqs-soquadrinhos.blogspot.com/2022/04/batman-tempo-de-matar-2022.html', 'blogspot', true),
  ('series-batman-one-bad-day-2022', 'https://hqs-soquadrinhos.blogspot.com/2022/10/batman-um-dia-ruim-2022.html', 'blogspot', true),
  ('series-batman-catwoman-gotham-war-2023', 'https://hqs-soquadrinhos.blogspot.com/2023/09/batmanmulher-gato-guerra-por-gotham-2023.html', 'blogspot', true),
  ('series-batman-superman-worlds-finest-2022', 'https://hqs-soquadrinhos.blogspot.com/2022/03/batmansuperman-melhores-do-mundo-2022.html', 'blogspot', true),
  ('series-batman-urban-legends-2021', 'https://hqs-soquadrinhos.blogspot.com/2021/09/batman-lendas-urbanas-2021.html', 'blogspot', true)
on conflict (series_id, source_url) do update
  set provider = excluded.provider, enabled = true, updated_at = now();
