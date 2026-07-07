-- Epic 13.11 — Hardening (fecha o Epic 13 antes do próximo Epic)
--
-- Dois débitos técnicos descobertos durante o Epic 13, registrados
-- para auditoria separada e resolvidos agora:
--
-- 1) GRANTs faltando (mesma causa raiz do Sprint 13.6): tabelas
--    criadas via `supabase db push` (role postgres) herdam um default
--    ACL sem SELECT/INSERT/UPDATE/DELETE para authenticated/anon,
--    diferente de tabelas criadas via dashboard (role supabase_admin).
--    Auditoria completa (información_schema.role_table_grants) + grep
--    em packages/lib e apps/web confirmou: as 32 tabelas abaixo têm
--    RLS policies reais já desenhadas para authenticated, mas nenhuma
--    é usada por código de aplicação ainda — não é uma feature quebrada
--    hoje, é uma mina para a próxima feature que as usar. Cada GRANT
--    abaixo espelha exatamente os verbos que já têm uma policy real
--    (não bloqueada por USING (false)) — mesmo padrão do Sprint 13.6.
--
-- 2) user_consents: FK com ON DELETE CASCADE/SET NULL colide com as
--    RULEs de imutabilidade (user_consents_no_update/no_delete,
--    migration 202607030004) — descoberto ao limpar dados de teste no
--    Sprint 13.9/13.10 (apagar qualquer companies está quebrado hoje).
--    Causa raiz: a tabela é um registro imutável de consentimento LGPD
--    por design ("SEC-05: registro imutável de aceite de termos"), mas
--    a FK foi criada com o padrão CASCADE/SET NULL genérico do resto
--    do schema, sem considerar essa interação. A RULE está correta (é
--    o propósito da tabela); a FK que está errada. RESTRICT é a ação
--    coerente com uma tabela imutável: não apaga nem anula
--    silenciosamente o histórico — bloqueia a exclusão do
--    profile/company até uma decisão explícita (ex.: anonimização via
--    data_subject_requests, já prevista em data_retention_policy).
--    Zero linhas existem hoje (confirmado) — sem impacto de dado.

-- BLOCO 1: GRANTs — tabelas de governança/chat/task (SEC-04/SEC-05)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_data_governance TO authenticated;
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT SELECT, INSERT ON public.chat_attachments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_catalog TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_classification TO authenticated;
GRANT SELECT ON public.data_governance_overview TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_retention_policy TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.data_subject_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.reports_snapshots TO authenticated;
GRANT SELECT, INSERT ON public.task_attachments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.task_templates TO authenticated;
GRANT SELECT, INSERT ON public.user_consents TO authenticated;

-- BLOCO 2: GRANTs — tabelas de referência (ref_*), só SELECT, mesmo
-- padrão das ref_* que já funcionavam (ref_bancos, ref_cbo, etc.)
GRANT SELECT ON public.ref_aliquotas_irpj_csll TO authenticated;
GRANT SELECT ON public.ref_cst_icms TO authenticated;
GRANT SELECT ON public.ref_cst_ipi TO authenticated;
GRANT SELECT ON public.ref_cst_pis_cofins TO authenticated;
GRANT SELECT ON public.ref_icms_aliquotas_interestaduais TO authenticated;
GRANT SELECT ON public.ref_icms_aliquotas_internas TO authenticated;
GRANT SELECT ON public.ref_indicadores_economia TO authenticated;
GRANT SELECT ON public.ref_iss_aliquotas TO authenticated;
GRANT SELECT ON public.ref_lucro_presumido_percentuais TO authenticated;
GRANT SELECT ON public.ref_mei_das TO authenticated;
GRANT SELECT ON public.ref_modalidades_frete TO authenticated;
GRANT SELECT ON public.ref_origem_mercadoria TO authenticated;
GRANT SELECT ON public.ref_pis_cofins TO authenticated;
GRANT SELECT ON public.ref_retencoes_fonte TO authenticated;
GRANT SELECT ON public.ref_simples_nacional_anexos TO authenticated;
GRANT SELECT ON public.ref_simples_nacional_faixas TO authenticated;
GRANT SELECT ON public.ref_simples_nacional_parametros TO authenticated;
GRANT SELECT ON public.ref_simples_nacional_partilha TO authenticated;
GRANT SELECT ON public.ref_simples_nacional_vedacoes TO authenticated;

-- BLOCO 3: user_consents — FK de CASCADE/SET NULL para RESTRICT,
-- preservando a imutabilidade (RULEs inalteradas) sem quebrar a
-- exclusão de companies/profiles em geral.
ALTER TABLE public.user_consents
  DROP CONSTRAINT IF EXISTS user_consents_user_id_fkey,
  ADD CONSTRAINT user_consents_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.user_consents
  DROP CONSTRAINT IF EXISTS user_consents_company_id_fkey,
  ADD CONSTRAINT user_consents_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;

COMMENT ON CONSTRAINT user_consents_user_id_fkey ON public.user_consents IS
  'ON DELETE RESTRICT (não CASCADE): user_consents é imutável por design (RULEs de no_update/no_delete) — apagar um profile com histórico de consentimento exige decisão explícita, nunca apagamento silencioso do registro de conformidade.';
