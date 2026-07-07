-- BDOS core schema — GRANTs faltantes (Sprint 13.6)
--
-- Achado ao testar persistência real com sessão autenticada de verdade:
-- as 6 tabelas criadas em 20260707180000_bdos_core_schema.sql têm RLS
-- policies corretas para `authenticated`, mas nunca receberam o GRANT
-- de tabela correspondente. Causa raiz confirmada via
-- pg_default_acl: tabelas criadas pelo role `postgres` (o role que
-- `supabase db push` usa) herdam um default ACL diferente do usado
-- por tabelas criadas via dashboard (role `supabase_admin`) — o
-- primeiro NÃO inclui SELECT/INSERT/UPDATE/DELETE para
-- `authenticated`/`anon`, só REFERENCES/TRIGGER/TRUNCATE. RLS nunca é
-- avaliada se o GRANT de base não existir primeiro, então o sintoma
-- real é "permission denied for table X" (SQLSTATE 42501), não um
-- erro de policy.
--
-- Cada GRANT abaixo espelha exatamente as políticas já criadas em
-- 20260707180000 — só os verbos que têm uma policy não-bloqueada
-- (`USING (false)`) recebem GRANT; nada de UPDATE/DELETE onde a
-- própria tabela já nasceu imutável por design.

GRANT SELECT, INSERT, UPDATE ON public.workspaces TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.engineering_projects TO authenticated;
GRANT SELECT, INSERT ON public.planning_imports TO authenticated;
GRANT SELECT, INSERT ON public.planning_datasets TO authenticated;
GRANT SELECT, INSERT ON public.decision_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.recommendations TO authenticated;
