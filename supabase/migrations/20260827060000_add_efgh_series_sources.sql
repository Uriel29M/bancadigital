-- Fontes do monitoramento das séries E-H obtidas no catálogo Só Quadrinhos.
insert into public.series_link_sources (series_id, source_url, provider, enabled)
values
  ('series-one-star-squadron-2022', 'https://hqs-soquadrinhos.blogspot.com/2022/01/esquadrao-uma-estrela-2022.html', 'blogspot', true),
  ('series-fire-ice-smallville-2023', 'https://hqs-soquadrinhos.blogspot.com/2023/09/fogo-e-gelo-bem-vindos-smallville-2023.html', 'blogspot', true),
  ('series-infinite-frontier-2021', 'https://hqs-soquadrinhos.blogspot.com/2021/03/fronteira-infinita-2021.html', 'blogspot', true),
  ('series-shadow-war-2022', 'https://hqs-soquadrinhos.blogspot.com/2023/04/guerra-das-sombras-2022.html', 'blogspot', true),
  ('series-war-earth-3-2022', 'https://hqs-soquadrinhos.blogspot.com/2022/06/guerra-pela-terra-3-2022.html', 'blogspot', true),
  ('series-poison-ivy-2022', 'https://hqs-soquadrinhos.blogspot.com/2023/01/hera-venenosa-2022.html', 'blogspot', true)
on conflict (series_id, source_url) do update
  set provider = excluded.provider, enabled = true, updated_at = now();
