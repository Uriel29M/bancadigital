# Auditoria curta de RPCs SECURITY DEFINER — 2026-09-17

Escopo: 133 funções de aplicação no schema `public`, incluindo 33 funções de trigger. Revisão de permissões efetivas, identidade/autorização no corpo, parâmetros que escolhem o ator/alvo e chamadas no frontend. Funções de plataforma/extensões não foram alteradas. O schema `private` não permite USAGE para anon/authenticated; nenhum deles pode criar objetos em `public`.

## Correções

- `create_notification`, `record_community_activity` e `submit_bot_action`: execução direta restrita a serviço/owner. Notificações e atividades continuam sendo produzidas por triggers de ações legítimas.
- `ensure_faction_mandatory_reads`: candidatos fornecidos pelo cliente só são aceitos de administrador autenticado; banco/serviço também podem inicializar. O frontend só tenta inicializar quando o usuário é admin. Sem admin/serviço, uma nova temporada pode ficar sem leituras até sua inicialização.
- `manage_faction_role`: rejeita identidade ausente, perfil inexistente ou banido antes de comparar papéis. Comparações com NULL não concedem mais autoridade.
- `ensure_faction_leadership` e `ensure_faction_election`: rejeitam chamadas de roles de navegador sem identidade; mantêm a autorização de facção/equipe já existente.
- `remove_faction_member`: rejeita alvo inexistente ou sem a mesma facção, inclusive NULL.
- Todas as funções de trigger e helpers internos deixam de ser executáveis diretamente pelo navegador.
- Removida a herança de EXECUTE via PUBLIC nas 133 funções. Anon mantém somente 14 funções explicitamente selecionadas. As permissões de authenticated das demais APIs são preservadas, junto com suas verificações internas.

`moderate_user`, `set_user_plan`, `send_notification_to_all` e as demais operações de equipe continuam acessíveis por authenticated e dependem da autorização no corpo. Ter EXECUTE, isoladamente, não constitui uma falha.

## Achados que exigem trabalho adicional

1. **XP autodeclarado:** `grant_profile_xp` e `grant_faction_xp` vinculam o ator a auth.uid(), mas aceitam tipo/chave de evento do navegador sem comprovar a ação. Chaves novas permitem repetir pontuação. A correção exige derivar eventos de registros/triggers confiáveis e migrar os pontos de chamada; restringir apenas a anon não resolve.
2. **Conquista de figurinhas:** `claim_character_sticker` verifica as leituras do próprio usuário, mas recebe do cliente a lista de edições, personagem e fingerprint. Não comprova que a lista corresponde ao catálogo completo do personagem.
3. **Contadores públicos:** `increment_comic_read` e `increment_comic_download` aceitam incrementos anônimos por design do site e não deduplicam tentativas. São métricas manipuláveis, não evidência de leitura.
4. **Visibilidade no ranking:** `get_profile_ranking` exclui perfis ocultos, mas não aplica `is_blocked_between` como a leitura normal de perfis.

Esta revisão não é certificação integral das regras de negócio ou RLS de todas as tabelas. Os achados acima permanecem explicitamente abertos. Novas funções e reaplicações de scripts precisam de grants explícitos; esta migration não muda os default privileges globais do projeto.

## Verificação

Aplicado no Supabase. Advisors após aplicação: 14 funções executáveis por anon (antes: 106) e 88 por authenticated (antes: 123). As três suítes SQL passaram com rollback; sintaxe JavaScript e diff também passaram. O ajuste do frontend permanece no workspace, sem publicação.

`supabase/tests/security_definer_access.sql` roda em transação revertida: chamadas forjadas de anon/authenticated negadas, ausência de identidade negada, inicialização por admin permitida, execução pelo serviço preservada, notificações e atividade via triggers funcionando. Reexecutar também os testes de escrita/privacidade de profiles.

Referência: [permissões e segurança de funções no Supabase](https://supabase.com/docs/guides/database/functions#function-privileges).

## Inventário

| Assinatura | Acesso após correção |
| --- | --- |
| `add_faction_abafac_catalog(text,text)` | authenticated with body authorization |
| `adjust_faction_xp(text,integer,text)` | authenticated with body authorization |
| `admin_discard_sticker_award(bigint)` | authenticated with body authorization |
| `admin_donate_sticker(uuid,text,text,text,text,jsonb,text,text,text)` | authenticated with body authorization |
| `award_achievement(text)` | authenticated with body authorization |
| `banca_mtproto_session(text,uuid,text)` | service/internal |
| `can_access_chat_room(text)` | public |
| `can_apply_cover_style(text)` | public |
| `can_comment()` | public |
| `can_customize_covers()` | public |
| `can_post_content(text,text)` | authenticated with body authorization |
| `can_send_chat_room(text)` | public |
| `cast_faction_election_vote(bigint,text,uuid)` | authenticated with body authorization |
| `choose_faction(text)` | authenticated with body authorization |
| `claim_character_sticker(text,text,text,text,jsonb,text,text)` | authenticated with body authorization |
| `claim_guria_ai_quota(uuid,integer,integer)` | service/internal |
| `claim_link_checker_batch(text)` | service/internal |
| `complete_faction_mandatory_read(text)` | authenticated with body authorization |
| `create_notification(uuid,text,text,text,uuid,text,jsonb)` | service/internal |
| `create_sticker_request(uuid,text,text,text,text,bigint,bigint)` | authenticated with body authorization |
| `current_faction_season()` | service/internal |
| `daily_profile_checkin()` | authenticated with body authorization |
| `delete_faction_catalog(bigint)` | authenticated with body authorization |
| `discard_repeated_sticker(bigint)` | authenticated with body authorization |
| `donate_sticker_award(uuid,bigint)` | authenticated with body authorization |
| `ensure_faction_election(text)` | authenticated with body authorization |
| `ensure_faction_leadership(text)` | authenticated with body authorization |
| `ensure_faction_leadership_after_join()` | internal trigger |
| `ensure_faction_mandatory_reads(text,jsonb)` | authenticated with body authorization |
| `faction_election_eligible_member(uuid,text)` | service/internal |
| `finish_link_checker_batch(uuid,integer)` | service/internal |
| `follow_banca_accounts_for_profile()` | internal trigger |
| `get_chat_moderation_history(text,integer)` | authenticated with body authorization |
| `get_chat_room_sheriff(text)` | authenticated with body authorization |
| `get_faction_achievements(text)` | public |
| `get_faction_election(text)` | authenticated with body authorization |
| `get_faction_mandatory_reads(text)` | public |
| `get_inactive_account_cleanup_enabled()` | authenticated with body authorization |
| `get_inactive_account_cleanup_settings()` | authenticated with body authorization |
| `get_my_profile()` | authenticated with body authorization |
| `get_profile_moderation_status(uuid)` | authenticated with body authorization |
| `get_profile_ranking(text,integer)` | public |
| `grant_faction_xp(text,text)` | authenticated with body authorization |
| `grant_profile_xp(text,text)` | authenticated with body authorization |
| `guria_welcome_new_profile()` | internal trigger |
| `handle_new_user()` | internal trigger |
| `increment_comic_download(text)` | public |
| `increment_comic_read(text)` | public |
| `is_admin()` | public |
| `is_blocked_between(uuid)` | public |
| `is_chat_room_sheriff(text)` | authenticated with body authorization |
| `is_legendary_event_active()` | public |
| `is_moderator()` | public |
| `log_chat_message_deletion()` | internal trigger |
| `log_chat_pin_change()` | internal trigger |
| `manage_faction_role(uuid,text,integer)` | authenticated with body authorization |
| `moderate_chat_user(text,text,text,text,text)` | authenticated with body authorization |
| `moderate_user(text,text,text,text,text,text,text)` | authenticated with body authorization |
| `notify_and_remove_resolved_file_report()` | internal trigger |
| `notify_blog_comment_activity()` | internal trigger |
| `notify_blog_comment_like()` | internal trigger |
| `notify_chat_mentions()` | internal trigger |
| `notify_collection_like()` | internal trigger |
| `notify_comment_activity()` | internal trigger |
| `notify_comment_like()` | internal trigger |
| `notify_moderation_action()` | internal trigger |
| `notify_new_chat_message()` | internal trigger |
| `notify_new_follow()` | internal trigger |
| `notify_profile_top10_item_vote()` | internal trigger |
| `notify_profile_wall_comment()` | internal trigger |
| `notify_resolved_file_report_once()` | internal trigger |
| `pin_chat_message(text,bigint,text)` | authenticated with body authorization |
| `prevent_blocked_sticker_requests()` | internal trigger |
| `process_expired_sticker_gums()` | service/internal |
| `promote_faction_curator(uuid)` | authenticated with body authorization |
| `purge_expired_chat_messages()` | internal trigger |
| `purge_expired_community_activity()` | internal trigger |
| `purge_expired_notifications()` | internal trigger |
| `purge_my_expired_notifications()` | authenticated with body authorization |
| `record_blog_comment_activity()` | internal trigger |
| `record_collection_comment_activity()` | internal trigger |
| `record_comic_comment_activity()` | internal trigger |
| `record_comic_like_activity()` | internal trigger |
| `record_community_activity(uuid,text,text,text,jsonb)` | service/internal |
| `record_completion_activity()` | internal trigger |
| `record_faction_sticker_event(uuid,text,text)` | service/internal |
| `record_sticker_award_for_faction()` | internal trigger |
| `record_sticker_request_for_faction()` | internal trigger |
| `record_top10_comment_activity()` | internal trigger |
| `record_wall_comment_activity()` | internal trigger |
| `register_faction_curator_candidate(text)` | authenticated with body authorization |
| `remove_faction_abafac_catalog(bigint)` | authenticated with body authorization |
| `remove_faction_abafac_image(bigint)` | authenticated with body authorization |
| `remove_faction_member(uuid,text)` | authenticated with body authorization |
| `resign_faction_curator()` | authenticated with body authorization |
| `resign_faction_leader()` | authenticated with body authorization |
| `resolve_username_login(text)` | service/internal |
| `respond_sticker_request(bigint,text)` | authenticated with body authorization |
| `review_bot_action(bigint,text)` | authenticated with body authorization |
| `save_faction_catalog(bigint,text,text,text,jsonb)` | authenticated with body authorization |
| `send_notification_to_all(text,text,text)` | authenticated with body authorization |
| `set_chat_room_sheriff(text,text)` | authenticated with body authorization |
| `set_chat_room_slow_mode(text,integer)` | authenticated with body authorization |
| `set_faction_catalog_featured(bigint,boolean)` | authenticated with body authorization |
| `set_inactive_account_cleanup_enabled(boolean)` | authenticated with body authorization |
| `set_inactive_account_cleanup_settings(boolean,text)` | authenticated with body authorization |
| `set_legendary_event_override(boolean)` | authenticated with body authorization |
| `set_legendary_sunday_enabled(boolean)` | authenticated with body authorization |
| `set_profile_sticker(bigint)` | authenticated with body authorization |
| `set_sticker_album_section(bigint,text)` | authenticated with body authorization |
| `set_sticker_award_lock(bigint,boolean)` | authenticated with body authorization |
| `set_sticker_request_preference(boolean)` | authenticated with body authorization |
| `set_sticker_slot_gum(uuid,text,bigint)` | authenticated with body authorization |
| `set_sticker_slot_gum(text,bigint,boolean)` | authenticated with body authorization |
| `set_user_plan(text,text)` | authenticated with body authorization |
| `submit_bot_action(text,text,text,text,jsonb)` | service/internal |
| `toggle_faction_character_pin(text,text,text,boolean)` | authenticated with body authorization |
| `toggle_faction_collection_pin(text,bigint,boolean)` | authenticated with body authorization |
| `toggle_faction_imprint_pin(text,text,text,boolean)` | authenticated with body authorization |
| `toggle_faction_public_collection_pin(text,text,boolean)` | authenticated with body authorization |
| `transfer_sticker_award(uuid,bigint)` | authenticated with body authorization |
| `unpin_chat_message(text,bigint)` | authenticated with body authorization |
| `update_faction_abafac_link(bigint,text)` | authenticated with body authorization |
| `update_faction_abafac_order(text,jsonb)` | authenticated with body authorization |
| `update_faction_catalog(text,text)` | authenticated with body authorization |
| `update_faction_catalog_sort(bigint,text)` | authenticated with body authorization |
| `update_faction_identity(text,text,text,text,text)` | authenticated with body authorization |
| `update_faction_identity_v2(text,text,text,text,text,text,text)` | authenticated with body authorization |
| `update_faction_manifesto(text,text)` | authenticated with body authorization |
| `update_faction_mural(text,text)` | authenticated with body authorization |
| `update_homepage_section_order(jsonb)` | authenticated with body authorization |
| `update_homepage_section_visibility(text,boolean)` | authenticated with body authorization |
| `validate_user_cover_choice()` | internal trigger |
