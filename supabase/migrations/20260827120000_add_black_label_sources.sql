-- Fontes do monitoramento das séries Black Label obtidas no catálogo Só Quadrinhos.
insert into public.series_link_sources (series_id, source_url, provider, enabled)
values
  ('series-batman-three-jokers-2020', 'https://hqs-soquadrinhos.blogspot.com/2020/09/batman-tres-coringas-2020.html', 'blogspot', true),
  ('series-batman-damned-2018', 'https://hqs-soquadrinhos.blogspot.com/2018/10/batman-amaldicoado-2018.html', 'blogspot', true),
  ('series-batman-white-knight-2017', 'https://hqs-soquadrinhos.blogspot.com/2018/07/batman-cavaleiro-branco-2017.html', 'blogspot', true),
  ('series-batman-last-knight-on-earth-2019', 'https://hqs-soquadrinhos.blogspot.com/2019/06/batman-o-ultimo-cavaleiro-da-terra-2019.html', 'blogspot', true),
  ('series-joker-killer-smile-2019', 'https://hqs-soquadrinhos.blogspot.com/2019/11/coringa-sorriso-assassino-2019.html', 'blogspot', true),
  ('series-harleen-2019', 'https://hqs-soquadrinhos.blogspot.com/2019/10/harleen-2019.html', 'blogspot', true),
  ('series-question-deaths-vic-sage-2019', 'https://hqs-soquadrinhos.blogspot.com/2020/06/o-questao-as-mortes-de-vic-sage-2019.html', 'blogspot', true),
  ('series-danger-street-2023', 'https://hqs-soquadrinhos.blogspot.com/2023/09/rua-perigo-2023.html', 'blogspot', true),
  ('series-superman-year-one-2019', 'https://hqs-soquadrinhos.blogspot.com/2019/08/superman-ano-um-2019.html', 'blogspot', true)
on conflict (series_id, source_url) do update
  set provider = excluded.provider, enabled = true, updated_at = now();
