update public.guria_quick_replies
set patterns = array[
  'super[- ]?her[oó]i preferido',
  'hero[ií]na preferida',
  'personagem favorito',
  'qual.*her[oó]i.*prefer',
  'qual.*her[oó]i.*gost'
], updated_at = now()
where trigger_key = 'favorite_hero';

insert into public.guria_quick_replies (trigger_key, patterns, response, priority) values
('comic_knowledge', array['o que você sabe sobre quadrinhos', 'o que vc sabe sobre quadrinhos', 'o que voce sabe sobre quadrinhos', 'fale sobre quadrinhos'], 'Sei bastante coisa sobre quadrinhos, de super-heróis a histórias independentes, passando por mangás quando eles finalmente derem as caras por aqui. Posso falar de personagens, editoras, fases, autores e estilos. [Abrir o catálogo](/?pagina=quadrinhos).', 85),
('greeting', array['^\s*(?:oi|olá|ola|bom dia|boa tarde|boa noite)\s*[!?.]*\s*$'], 'Oi. Chegou para ler ou só veio fiscalizar a minha estante? Seja bem-vindo à Banca. [Abrir o catálogo](/?pagina=quadrinhos).', 60)
on conflict (trigger_key) do update set patterns = excluded.patterns, response = excluded.response, priority = excluded.priority, enabled = true, updated_at = now();
