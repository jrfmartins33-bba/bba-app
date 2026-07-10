-- Epic 19, Sprint 3 (Measurement Bulletin Import) — correção sobre
-- 20260711000000_bdos_measurement_bulletin_import.sql (já aplicada;
-- não editada retroativamente).
--
-- Achado real, via teste com sessão autenticada de verdade
-- (supabase/tests/measurement/bulletin-finalization-guard.test.mjs):
-- as 6 tabelas novas nunca receberam GRANT explícito para o papel
-- `authenticated` -- só RLS foi habilitada. RLS filtra QUAIS linhas
-- um papel pode ver depois que o próprio papel já tem permissão de
-- tocar a tabela; sem o GRANT, toda operação falha com "permission
-- denied for table X" antes mesmo de qualquer policy ser avaliada,
-- para qualquer sessão, mesmo autenticada e dona da linha.
--
-- Todas as outras tabelas do schema (planning_imports,
-- planning_datasets, execution_tasks, execution_workflows, ...)
-- funcionam sem GRANT explícito na migration porque foram criadas sob
-- um default privilege de projeto que este ambiente de push não
-- herda -- confirmado comparando o comportamento real das duas
-- migrations anteriores contra essas tabelas já existentes (só as 6
-- tabelas novas falhavam). Cada tabela nova a partir de agora deve
-- receber GRANT explícito, não assumir um default implícito.
GRANT SELECT, INSERT, UPDATE ON public.work_packages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.managed_service_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.measurement_bulletin_imports TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.measurement_workspaces TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.measurement_workspace_lines TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.measurement_bulletins TO authenticated;
