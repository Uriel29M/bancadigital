-- Fontes do monitoramento das séries DC All In obtidas no catálogo Só Quadrinhos.
insert into public.series_link_sources (series_id, source_url, provider, enabled)
values
  ('series-dc-all-in-2024', 'https://hqs-soquadrinhos.blogspot.com/2024/10/dc-all-in-2024.html', 'blogspot', true),
  ('series-dc-ko-2025', 'https://hqs-soquadrinhos.blogspot.com/2025/10/dc-ko-2025.html', 'blogspot', true),
  ('series-challengers-unknown-2025', 'https://hqs-soquadrinhos.blogspot.com/2024/12/desafiadores-do-desconhecido-2025.html', 'blogspot', true)
on conflict (series_id, source_url) do update
  set provider = excluded.provider, enabled = true, updated_at = now();
