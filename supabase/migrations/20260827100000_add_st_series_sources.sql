-- Fontes do monitoramento das séries S-T obtidas no catálogo Só Quadrinhos.
insert into public.series_link_sources (series_id, source_url, provider, enabled)
values
  ('series-shazam-2023', 'https://hqs-soquadrinhos.blogspot.com/2023/05/shazam-2023.html', 'blogspot', true),
  ('series-shazam-2021', 'https://hqs-soquadrinhos.blogspot.com/2022/04/shazam-2021.html', 'blogspot', true),
  ('series-justice-society-2023', 'https://hqs-soquadrinhos.blogspot.com/2022/12/sociedade-da-justica-da-america-2023.html', 'blogspot', true),
  ('series-stargirl-lost-children-2022', 'https://hqs-soquadrinhos.blogspot.com/2022/11/stargirl-2022.html', 'blogspot', true),
  ('series-superboy-tomorrow-2023', 'https://hqs-soquadrinhos.blogspot.com/2023/05/superboy-o-homem-do-amanha-2023.html', 'blogspot', true),
  ('series-superman-lost-2023', 'https://hqs-soquadrinhos.blogspot.com/2023/03/superman-perdido.html', 'blogspot', true),
  ('series-superman-2023', 'https://hqs-soquadrinhos.blogspot.com/2023/03/superman-2023.html', 'blogspot', true),
  ('series-superman-son-kal-el-2021', 'https://hqs-soquadrinhos.blogspot.com/2023/03/superman-filho-de-kal-el2021.html', 'blogspot', true),
  ('series-superman-kal-el-returns-2022', 'https://hqs-soquadrinhos.blogspot.com/2023/06/superman-o-retorno-de-kal-el-2022.html', 'blogspot', true),
  ('series-knight-terrors-2023', 'https://hqs-soquadrinhos.blogspot.com/2023/07/terrores-noturnos-2023.html', 'blogspot', true),
  ('series-flash-fastest-2022', 'https://hqs-soquadrinhos.blogspot.com/2023/03/the-flash-o-homem-mais-rapido-vivo-2022.html', 'blogspot', true)
on conflict (series_id, source_url) do update
  set provider = excluded.provider, enabled = true, updated_at = now();
