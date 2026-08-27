-- Fontes do monitoramento das séries DC adicionais obtidas no catálogo Só Quadrinhos.
insert into public.series_link_sources (series_id, source_url, provider, enabled)
values
  ('series-joker-2021', 'https://hqs-soquadrinhos.blogspot.com/2024/03/coringa-2021.html', 'blogspot', true),
  ('series-deathstroke-inc-2021', 'https://hqs-soquadrinhos.blogspot.com/2022/12/corporacao-exterminador-2021.html', 'blogspot', true),
  ('series-dark-crisis-2022', 'https://hqs-soquadrinhos.blogspot.com/2022/09/crise-sombria-nas-infinitas-terras-2022.html', 'blogspot', true),
  ('series-cyborg-2023', 'https://hqs-soquadrinhos.blogspot.com/2023/05/cyborg-2023.html', 'blogspot', true)
on conflict (series_id, source_url) do update
  set provider = excluded.provider, enabled = true, updated_at = now();
