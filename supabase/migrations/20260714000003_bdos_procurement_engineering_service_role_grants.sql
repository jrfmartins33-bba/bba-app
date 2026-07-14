-- Epic 21, Sprint 21.3C — GRANT faltante para `service_role`.
--
-- Mesmo achado documentado em 20260714000001_..._grants.sql, desta vez
-- descoberto ao rodar a limpeza automática dos testes reais (seção 9 da
-- correção de segurança): tabelas criadas pelo role `postgres` via
-- `supabase db push` não herdam GRANT de base nem para `authenticated`
-- nem para `service_role` — só a RLS policy (que, para `service_role`,
-- é irrelevante, já que esse role tem o atributo BYPASSRLS; mas
-- BYPASSRLS nunca dispensa o GRANT de base do Postgres, são mecanismos
-- independentes). Sintoma idêntico ao já documentado: "permission denied
-- for table X" (SQLSTATE 42501).
--
-- `service_role` é usado nesta Sprint estritamente para preparação e
-- limpeza dos dados dos testes reais (supabase/tests/procurement-
-- engineering/*.test.mjs) — nunca como sujeito de um teste de negócio ou
-- de isolamento, e nunca por código de produto.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.procurement_cases TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.procurement_lots TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_versions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_lines TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_version_lineage_relations TO service_role;
