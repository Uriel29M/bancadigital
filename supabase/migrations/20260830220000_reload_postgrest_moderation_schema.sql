-- O PostgREST mantém cache das assinaturas RPC. Recarrega-o depois da nova
-- assinatura de moderate_user e das funções de auditoria.
notify pgrst, 'reload schema';
