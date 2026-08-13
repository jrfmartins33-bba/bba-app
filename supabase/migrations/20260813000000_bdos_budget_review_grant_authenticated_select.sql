-- ============================================================================
-- SPRINT 21.5C.2B — MIGRATION ADITIVA: GRANT SELECT E PERMISSÕES DE SERVIDOR
-- ============================================================================
-- 1. Concede o privilégio de tabela SELECT para a role `authenticated` em
--    `budget_review_sessions` e `budget_review_rows`, ativando as políticas de
--    RLS de SELECT (budget_review_sessions_select_company_or_admin /
--    budget_review_rows_select_admin_only) já existentes no banco.
-- 2. Concede privilégios de tabela a `service_role` para permitir que as
--    RPCs exclusivas de servidor (create_budget_review_session, bulk_import_budget_review_rows)
--    executem as operações de INSERT/SELECT/UPDATE necessárias em nome do servidor.
-- ============================================================================

GRANT SELECT ON public.budget_review_sessions TO authenticated;
GRANT SELECT ON public.budget_review_rows TO authenticated;

GRANT ALL ON public.budget_review_sessions TO service_role;
GRANT ALL ON public.budget_review_rows TO service_role;
GRANT ALL ON public.budget_review_audit_events TO service_role;
