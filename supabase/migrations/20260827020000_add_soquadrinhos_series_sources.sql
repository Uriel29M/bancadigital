-- Fontes do monitoramento de novas edições obtidas nas páginas do catálogo Só Quadrinhos.
insert into public.series_link_sources (series_id, source_url, provider, enabled)
values
  ('series-absolute-batman', 'https://hqs-soquadrinhos.blogspot.com/2024/12/absolute-batman-2024.html', 'blogspot', true),
  ('series-absolute-superman', 'https://hqs-soquadrinhos.blogspot.com/2024/12/absolute-superman-2024.html', 'blogspot', true),
  ('series-teen-titans-academy', 'https://hqs-soquadrinhos.blogspot.com/2022/04/academia-jovens-titas-2021.html', 'blogspot', true),
  ('series-black-adam-justice-society-files', 'https://hqs-soquadrinhos.blogspot.com/2022/07/adao-negro-os-arquivos-da-sociedade-da.html', 'blogspot', true),
  ('series-flashpoint-beyond', 'https://hqs-soquadrinhos.blogspot.com/2022/05/alem-do-flashpoint-2022.html', 'blogspot', true),
  ('series-aquaman-the-becoming', 'https://hqs-soquadrinhos.blogspot.com/2022/02/aquaman-o-emergir-2021.html', 'blogspot', true),
  ('series-harley-quinn-2021', 'https://hqs-soquadrinhos.blogspot.com/2023/08/arlequina-2021.html', 'blogspot', true),
  ('series-green-arrow-2023', 'https://hqs-soquadrinhos.blogspot.com/2023/05/arqueiro-verde-2023.html', 'blogspot', true),
  ('series-black-manta-2021', 'https://hqs-soquadrinhos.blogspot.com/2022/02/arraia-negra-2021.html', 'blogspot', true),
  ('series-adventures-superman-jon-kent', 'https://hqs-soquadrinhos.blogspot.com/2023/03/as-aventuras-do-superman-jon-kent-2023.html', 'blogspot', true),
  ('series-birds-of-prey-2023', 'https://hqs-soquadrinhos.blogspot.com/2023/09/aves-de-rapina-2023.html', 'blogspot', true),
  ('series-fury-of-firestorm-2026', 'https://hqs-soquadrinhos.blogspot.com/2026/04/a-furia-do-nuclear-2026.html', 'blogspot', true),
  ('series-unstoppable-doom-patrol-2023', 'https://hqs-soquadrinhos.blogspot.com/2023/07/a-imparavel-patrulha-do-destino-2023.html', 'blogspot', true),
  ('series-immortal-legend-batman-2025', 'https://hqs-soquadrinhos.blogspot.com/2025/09/a-lenda-imortal-batman-2025.html', 'blogspot', true),
  ('series-jurassic-league-2022', 'https://hqs-soquadrinhos.blogspot.com/2022/05/a-liga-jurassica-2022.html', 'blogspot', true),
  ('series-death-of-superman-30th-anniversary', 'https://hqs-soquadrinhos.blogspot.com/2023/05/a-morte-do-superman-especial-de-30.html', 'blogspot', true),
  ('series-new-champion-of-shazam', 'https://hqs-soquadrinhos.blogspot.com/2023/05/a-nova-campea-do-shazam-2022.html', 'blogspot', true),
  ('series-new-golden-age', 'https://hqs-soquadrinhos.blogspot.com/2022/11/a-nova-era-de-ouro-2022.html', 'blogspot', true)
on conflict (series_id, source_url) do update
  set provider = excluded.provider, enabled = true, updated_at = now();
