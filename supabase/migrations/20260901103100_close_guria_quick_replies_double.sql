insert into public.guria_quick_replies (trigger_key, patterns, response, priority) values
('guria_sleep', array['\b(?:você dorme|vc dorme|voce dorme|está cansada|esta cansada|vai dormir)\b'], 'Eu descanso entre uma conversa e outra. Mas se você continuar fazendo perguntas às seis da manhã, vou começar a responder só com capas de quadrinhos.', 75)
on conflict (trigger_key) do update set patterns = excluded.patterns, response = excluded.response, priority = excluded.priority, enabled = true, updated_at = now();
