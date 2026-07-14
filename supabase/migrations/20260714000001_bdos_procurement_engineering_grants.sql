-- Epic 21, Sprint 21.3C — GRANTs faltantes das 5 tabelas criadas em
-- 20260714000000_bdos_procurement_engineering_schema.sql.
--
-- Mesmo achado documentado em 20260707200000_bdos_core_schema_grants.sql:
-- tabelas criadas pelo role `postgres` (o role que `supabase db push` usa)
-- não herdam GRANT de base para `authenticated`, só as RLS policies — e
-- RLS nunca é avaliada se o GRANT de base não existir primeiro (sintoma:
-- "permission denied for table X", SQLSTATE 42501, não um erro de
-- policy). Confirmado ao testar persistência real com sessão autenticada
-- de verdade nesta Sprint.
--
-- Cada GRANT abaixo espelha exatamente os verbos com política
-- não-bloqueada (`USING (false)`) já criados na migração anterior — nada
-- de UPDATE em budget_lines (sempre substituída inteira via RPC) nem
-- DELETE nas tabelas que nascem imutáveis por design (procurement_cases,
-- procurement_lots, budget_versions, budget_version_lineage_relations).

GRANT SELECT, INSERT ON public.procurement_cases TO authenticated;
GRANT SELECT, INSERT ON public.procurement_lots TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.budget_versions TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.budget_lines TO authenticated;
GRANT SELECT, INSERT ON public.budget_version_lineage_relations TO authenticated;
