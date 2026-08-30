create index if not exists chat_room_settings_updated_by_idx on public.chat_room_settings(updated_by);
create index if not exists chat_room_mutes_user_idx on public.chat_room_mutes(user_id);
create index if not exists chat_room_mutes_muted_by_idx on public.chat_room_mutes(muted_by);
create index if not exists chat_message_reports_room_idx on public.chat_message_reports(room_id, created_at desc);
create index if not exists chat_message_reports_reporter_idx on public.chat_message_reports(reporter_id, created_at desc);
create index if not exists chat_message_reports_target_idx on public.chat_message_reports(target_id, created_at desc);
create index if not exists chat_message_reports_reviewed_by_idx on public.chat_message_reports(reviewed_by);
create index if not exists chat_moderation_actions_actor_idx on public.chat_moderation_actions(actor_id, created_at desc);
create index if not exists chat_moderation_actions_target_idx on public.chat_moderation_actions(target_id, created_at desc);
