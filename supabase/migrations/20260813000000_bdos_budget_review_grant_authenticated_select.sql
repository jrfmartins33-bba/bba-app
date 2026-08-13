-- ============================================================================
-- SPRINT 21.5C.2B — MIGRATION ADITIVA: GRANT SELECT PARA ROLE AUTHENTICATED
-- ============================================================================
-- Concede o privilégio de tabela SELECT para a role `authenticated` em
-- `budget_review_sessions` e `budget_review_rows`, ativando as políticas de
-- RLS (budget_review_sessions_select_company_or_admin /
-- budget_review_rows_select_admin_only) já existentes no banco.
-- ============================================================================

GRANT SELECT ON public.budget_review_sessions TO authenticated;
GRANT SELECT ON public.budget_review_rows TO authenticated;
