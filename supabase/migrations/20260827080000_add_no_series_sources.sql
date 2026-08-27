-- Fontes do monitoramento das séries N-O obtidas no catálogo Só Quadrinhos.
insert into public.series_link_sources (series_id, source_url, provider, enabled)
values
  ('series-we-are-yesterday-2025', 'https://hqs-soquadrinhos.blogspot.com/2025/04/nos-somos-o-passado-2025.html', 'blogspot', true),
  ('series-nubia-amazons-2021', 'https://hqs-soquadrinhos.blogspot.com/2022/04/nubia-e-as-amazonas-2021.html', 'blogspot', true),
  ('series-new-gods-2025', 'https://hqs-soquadrinhos.blogspot.com/2025/01/novos-deuses-2025.html', 'blogspot', true),
  ('series-trial-amazons-2022', 'https://hqs-soquadrinhos.blogspot.com/2022/10/o-julgamento-das-amazonas-2022.html', 'blogspot', true),
  ('series-swamp-thing-2021', 'https://hqs-soquadrinhos.blogspot.com/2022/10/o-monstro-do-pantano-2021.html', 'blogspot', true),
  ('series-next-batman-second-son-2021', 'https://hqs-soquadrinhos.blogspot.com/2022/04/o-novo-batman-segundo-filho-2021.html', 'blogspot', true)
on conflict (series_id, source_url) do update
  set provider = excluded.provider, enabled = true, updated_at = now();
