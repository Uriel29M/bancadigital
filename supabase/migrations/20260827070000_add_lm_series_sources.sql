-- Fontes do monitoramento das séries L-M obtidas no catálogo Só Quadrinhos.
insert into public.series_link_sources (series_id, source_url, provider, enabled)
values
  ('series-green-lantern-2023', 'https://hqs-soquadrinhos.blogspot.com/2023/05/lanterna-verde-2023.html', 'blogspot', true),
  ('series-green-lantern-2021', 'https://hqs-soquadrinhos.blogspot.com/2023/05/lanterna-verde-2023.html', 'blogspot', true),
  ('series-green-lantern-war-journal-2023', 'https://hqs-soquadrinhos.blogspot.com/2023/10/lanterna-verde-diario-de-guerra-2023.html', 'blogspot', true),
  ('series-justice-league-unlimited-2025', 'https://hqs-soquadrinhos.blogspot.com/2024/11/liga-da-justica-sem-limites-2025.html', 'blogspot', true),
  ('series-justice-godzilla-kong-2023', 'https://hqs-soquadrinhos.blogspot.com/2023/10/liga-da-justica-vs-godzilla-vs-kong-2023.html', 'blogspot', true),
  ('series-atom-project-2025', 'https://hqs-soquadrinhos.blogspot.com/2025/01/liga-da-justica-o-projeto-atomo-2025.html', 'blogspot', true),
  ('series-wonder-girl-2021', 'https://hqs-soquadrinhos.blogspot.com/2022/04/moca-maravilha-2021.html', 'blogspot', true),
  ('series-wonder-woman-2023', 'https://hqs-soquadrinhos.blogspot.com/2023/12/mulher-maravilha-2023.html', 'blogspot', true)
on conflict (series_id, source_url) do update
  set provider = excluded.provider, enabled = true, updated_at = now();
