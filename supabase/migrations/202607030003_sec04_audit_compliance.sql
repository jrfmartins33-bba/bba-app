-- ============================================================
-- SEC-04 — Audit & Compliance
-- ============================================================
-- Evolui a tabela public.audit_log já existente (criada em
-- 202506290008_modules_financeiro_tarefas_chat.sql). Não cria
-- estrutura paralela. Não altera nenhuma policy de RLS existente
-- (audit_sel/audit_ins permanecem como estão). Não altera BDOS,
-- Decision Engine, nem LGPD/retenção (reservado para SEC-05).
--
-- Reaproveita explicitamente:
--   - is_bba_admin() (202506280001)
--   - audit_no_update / audit_no_delete RULEs (202506290008),
--     já garantem imutabilidade — não recriadas aqui.
--   - padrão de trigger em auth.users já usado por handle_new_user()
--     (202506280001) como precedente para o novo trigger de auth.users.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Evolução aditiva de public.audit_log
-- ------------------------------------------------------------
-- Mapeamento conceitual (arquitetura Fase 2) -> colunas físicas:
--   AuditEvent          -> a linha inteira de audit_log
--   AuditActor           -> user_id (existente) + ator_tipo (novo)
--   AuditEntity           -> entidade + entidade_id (existentes)
--   AuditAction           -> acao (existente, enum já cobre todos os
--                            eventos obrigatórios da Fase 3 via
--                            INSERT/UPDATE/DELETE/LOGIN/LOGOUT/...)
--   AuditSource / origin  -> origem (existente) — os dois conceitos da
--                            Fase 2/4 colapsam nesta única coluna já
--                            existente, para não duplicar semântica.
--   AuditSeverity         -> severidade (novo)
--   AuditContext/Metadata -> metadata (novo, mesmo padrão JSONB usado
--                            em profiles/companies/... deste projeto)
--   AuditCorrelationId    -> correlacao_id (novo)
--   AuditRetention        -> ver função audit_log_retention_status()
--                            abaixo (definição, sem enforcement —
--                            enforcement é escopo do SEC-05/LGPD)

ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS correlacao_id UUID,
  ADD COLUMN IF NOT EXISTS severidade VARCHAR(10),
  ADD COLUMN IF NOT EXISTS ator_tipo VARCHAR(20),
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'audit_log_severidade_check'
  ) THEN
    ALTER TABLE public.audit_log
      ADD CONSTRAINT audit_log_severidade_check
      CHECK (severidade IS NULL OR severidade IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'audit_log_ator_tipo_check'
  ) THEN
    ALTER TABLE public.audit_log
      ADD CONSTRAINT audit_log_ator_tipo_check
      CHECK (ator_tipo IS NULL OR ator_tipo IN ('client', 'bba_admin', 'sistema', 'automacao'));
  END IF;
END $$;

COMMENT ON COLUMN public.audit_log.correlacao_id IS
  'Agrupa múltiplas linhas de audit_log pertencentes à mesma operação lógica (AuditCorrelationId).';
COMMENT ON COLUMN public.audit_log.severidade IS
  'Classificação de criticidade do evento: LOW, MEDIUM, HIGH, CRITICAL (AuditSeverity).';
COMMENT ON COLUMN public.audit_log.ator_tipo IS
  'Tipo do ator no momento do evento (client, bba_admin, sistema, automacao) — não depende de join futuro com profiles.role, que pode mudar.';
COMMENT ON COLUMN public.audit_log.metadata IS
  'Contexto/metadata livre adicional do evento (AuditContext/AuditMetadata).';

CREATE INDEX IF NOT EXISTS idx_audit_correlacao ON public.audit_log(correlacao_id);
CREATE INDEX IF NOT EXISTS idx_audit_severidade ON public.audit_log(severidade);
CREATE INDEX IF NOT EXISTS idx_audit_company_created ON public.audit_log(company_id, created_at DESC);

-- ------------------------------------------------------------
-- 2) Classificação de criticidade (Fase 2)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bba_audit_severity_for(
  p_entidade TEXT,
  p_acao TEXT
)
RETURNS VARCHAR
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_entidade IN (
      'rh_folha_pagamentos', 'financial_lancamentos', 'financial_contas',
      'fiscal_notas_fiscais', 'fiscal_guias', 'societario_capital_social',
      'societario_alteracoes'
    ) AND p_acao IN ('UPDATE', 'DELETE') THEN 'CRITICAL'
    WHEN p_entidade IN (
      'rh_funcionarios', 'client_socios', 'societario_socios',
      'companies', 'profiles', 'service_contracts', 'auth.users'
    ) AND p_acao IN ('UPDATE', 'DELETE') THEN 'HIGH'
    WHEN p_acao = 'DELETE' THEN 'HIGH'
    WHEN p_acao = 'LOGIN' THEN 'MEDIUM'
    WHEN p_acao = 'INSERT' THEN 'LOW'
    ELSE 'MEDIUM'
  END;
$$;

COMMENT ON FUNCTION public.bba_audit_severity_for IS
  'Classifica a criticidade (LOW/MEDIUM/HIGH/CRITICAL) de um evento de auditoria com base na entidade e na ação. Determinístico, sem side effects.';

-- ------------------------------------------------------------
-- 3) Função canônica de escrita — único caminho sancionado para
--    inserir em audit_log a partir de triggers ou de chamadas RPC
--    autenticadas. SECURITY DEFINER: não exige alterar audit_ins.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_acao VARCHAR,
  p_entidade VARCHAR,
  p_entidade_id UUID DEFAULT NULL,
  p_descricao TEXT DEFAULT NULL,
  p_dados_antes JSONB DEFAULT NULL,
  p_dados_depois JSONB DEFAULT NULL,
  p_campos_alterados TEXT[] DEFAULT NULL,
  p_severidade VARCHAR DEFAULT NULL,
  p_correlacao_id UUID DEFAULT NULL,
  p_origem VARCHAR DEFAULT 'Sistema',
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_company_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_actor_role TEXT;
  v_actor_company_id UUID;
  v_company_id UUID;
  v_log_id UUID;
BEGIN
  IF v_user_id IS NOT NULL THEN
    SELECT role, company_id
      INTO v_actor_role, v_actor_company_id
      FROM public.profiles
      WHERE id = v_user_id;
  END IF;

  v_company_id := COALESCE(p_company_id, v_actor_company_id);

  INSERT INTO public.audit_log (
    company_id, user_id, acao, entidade, entidade_id, descricao,
    dados_antes, dados_depois, campos_alterados,
    origem, severidade, ator_tipo, correlacao_id, metadata
  ) VALUES (
    v_company_id,
    v_user_id,
    p_acao,
    p_entidade,
    p_entidade_id,
    p_descricao,
    p_dados_antes,
    p_dados_depois,
    p_campos_alterados,
    COALESCE(p_origem, 'Sistema'),
    COALESCE(p_severidade, public.bba_audit_severity_for(p_entidade, p_acao)),
    COALESCE(v_actor_role, 'sistema'),
    p_correlacao_id,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

COMMENT ON FUNCTION public.log_audit_event IS
  'Único caminho sancionado para gravar em audit_log. SECURITY DEFINER: não depende da policy audit_ins. Deriva user_id de auth.uid() (não confia em valor informado pelo chamador), portanto não permite impersonação.';

REVOKE ALL ON FUNCTION public.log_audit_event FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_audit_event TO authenticated;

-- ------------------------------------------------------------
-- 4) Trigger genérico de captura de INSERT/UPDATE/DELETE
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bba_audit_row_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row_company_id UUID;
  v_entidade_id UUID;
  v_dados_antes JSONB;
  v_dados_depois JSONB;
  v_campos TEXT[];
  v_acao VARCHAR(20);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_acao := 'DELETE';
    v_dados_antes := to_jsonb(OLD);
    v_entidade_id := OLD.id;
    v_row_company_id := CASE
      WHEN TG_TABLE_NAME = 'companies' THEN OLD.id
      ELSE NULLIF(to_jsonb(OLD) ->> 'company_id', '')::UUID
    END;
  ELSIF TG_OP = 'UPDATE' THEN
    v_dados_antes := to_jsonb(OLD);
    v_dados_depois := to_jsonb(NEW);
    v_entidade_id := NEW.id;
    v_row_company_id := CASE
      WHEN TG_TABLE_NAME = 'companies' THEN NEW.id
      ELSE NULLIF(to_jsonb(NEW) ->> 'company_id', '')::UUID
    END;

    SELECT array_agg(n.key ORDER BY n.key)
      INTO v_campos
      FROM jsonb_each(to_jsonb(NEW)) AS n(key, value)
      JOIN jsonb_each(to_jsonb(OLD)) AS o(key, value) USING (key)
      WHERE n.value IS DISTINCT FROM o.value
        AND n.key NOT IN ('updated_at');

    IF v_campos IS NULL OR array_length(v_campos, 1) IS NULL THEN
      RETURN NEW;
    END IF;

    v_acao := 'UPDATE';
  ELSE
    v_acao := 'INSERT';
    v_dados_depois := to_jsonb(NEW);
    v_entidade_id := NEW.id;
    v_row_company_id := CASE
      WHEN TG_TABLE_NAME = 'companies' THEN NEW.id
      ELSE NULLIF(to_jsonb(NEW) ->> 'company_id', '')::UUID
    END;
  END IF;

  BEGIN
    PERFORM public.log_audit_event(
      p_acao              := v_acao,
      p_entidade          := TG_TABLE_NAME,
      p_entidade_id       := v_entidade_id,
      p_dados_antes       := v_dados_antes,
      p_dados_depois      := v_dados_depois,
      p_campos_alterados  := v_campos,
      p_origem            := 'Sistema',
      p_company_id        := v_row_company_id
    );
  EXCEPTION WHEN OTHERS THEN
    -- Uma falha ao registrar auditoria nunca pode bloquear a operação
    -- de negócio real (INSERT/UPDATE/DELETE na tabela de origem).
    RAISE WARNING 'bba_audit_row_change: failed to log audit event for %.% (%): %',
      TG_TABLE_NAME, v_entidade_id, v_acao, SQLERRM;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.bba_audit_row_change IS
  'Trigger genérico reusável: captura INSERT/UPDATE/DELETE de qualquer tabela e grava em audit_log via log_audit_event(). Em UPDATE, ignora no-ops (nenhum campo alterado além de updated_at). Falha de auditoria nunca bloqueia a operação de negócio (EXCEPTION WHEN OTHERS isolado).';

-- ------------------------------------------------------------
-- 5) Anexação do trigger às tabelas no escopo da Fase 1/3
--    (não substitui nenhum trigger existente — coexiste com
--    bba_set_updated_at()/set_updated_at()/handle_new_user()/
--    profiles_enforce_tenant_boundaries()/
--    companies_validate_owner_and_account_owner(), que não são
--    tocados por esta migration).
-- ------------------------------------------------------------
DO $$
DECLARE
  v_table TEXT;
  v_tables TEXT[] := ARRAY[
    'profiles', 'companies',
    'financial_contas', 'financial_categorias', 'financial_lancamentos', 'financial_cobrancas',
    'fiscal_obrigacoes', 'fiscal_guias', 'fiscal_notas_fiscais', 'fiscal_parcelamentos',
    'rh_funcionarios', 'rh_folha_pagamentos',
    'societario_socios', 'societario_capital_social', 'societario_alteracoes', 'societario_assembleias',
    'client_companies', 'client_socios', 'client_documents', 'service_contracts',
    'onboarding_checklist'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS %1$I ON public.%2$I;
         CREATE TRIGGER %1$I
         AFTER INSERT OR UPDATE OR DELETE ON public.%2$I
         FOR EACH ROW EXECUTE FUNCTION public.bba_audit_row_change();',
        'trg_audit_' || v_table,
        v_table
      );
    ELSE
      RAISE NOTICE 'Skipping audit trigger for %, table not found', v_table;
    END IF;
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 6) Eventos de auth.users: LOGIN (last_sign_in_at), troca de
--    e-mail e redefinição de senha. Segue o mesmo precedente já
--    usado por handle_new_user() (trigger em auth.users criado
--    em 202506280001). Não altera handle_new_user().
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bba_audit_auth_user_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Toda a captura de auditoria roda isolada em um bloco próprio de
  -- exceção. Isto é crítico: este trigger roda em AFTER UPDATE ON
  -- auth.users, que é acionado no login de todo usuário. Uma exceção
  -- não tratada aqui abortaria a própria autenticação — exatamente a
  -- classe de bug já investigada anteriormente neste projeto (login
  -- quebrado). Falha de auditoria nunca pode derrubar login.
  BEGIN
    IF NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at THEN
      PERFORM public.log_audit_event(
        p_acao        := 'LOGIN',
        p_entidade    := 'auth.users',
        p_entidade_id := NEW.id,
        p_descricao   := 'Login realizado.',
        p_origem      := 'Sistema'
      );
    END IF;

    IF NEW.email IS DISTINCT FROM OLD.email THEN
      PERFORM public.log_audit_event(
        p_acao              := 'UPDATE',
        p_entidade          := 'auth.users',
        p_entidade_id       := NEW.id,
        p_descricao         := 'Alteração de e-mail.',
        p_dados_antes       := jsonb_build_object('email', OLD.email),
        p_dados_depois      := jsonb_build_object('email', NEW.email),
        p_campos_alterados  := ARRAY['email'],
        p_origem            := 'Sistema'
      );
    END IF;

    IF NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password THEN
      PERFORM public.log_audit_event(
        p_acao              := 'UPDATE',
        p_entidade          := 'auth.users',
        p_entidade_id       := NEW.id,
        p_descricao         := 'Redefinição de senha.',
        p_campos_alterados  := ARRAY['encrypted_password'],
        p_origem            := 'Sistema'
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bba_audit_auth_user_change: failed to log audit event for auth.users %: %',
      NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.bba_audit_auth_user_change IS
  'Captura LOGIN (last_sign_in_at), alteração de e-mail e redefinição de senha diretamente de auth.users — funciona independente do caminho de app usado (inclusive fluxo de recovery por e-mail do Supabase, que não passa pelo código deste repositório). LOGOUT não é observável em auth.users e não é coberto aqui. Qualquer falha de auditoria é isolada (EXCEPTION WHEN OTHERS) para nunca bloquear login/alteração de e-mail/senha reais.';

DROP TRIGGER IF EXISTS trg_audit_auth_users ON auth.users;
CREATE TRIGGER trg_audit_auth_users
AFTER UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.bba_audit_auth_user_change();

-- ------------------------------------------------------------
-- 7) Consulta administrativa cross-tenant, sem alterar audit_sel.
--    audit_sel hoje restringe SELECT a company_id/user_id próprios;
--    esta função dá visão cross-tenant a bba_admin sem tocar em RLS.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_audit_log_for_admin(
  p_company_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 100
)
RETURNS SETOF public.audit_log
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_bba_admin() THEN
    RAISE EXCEPTION 'Only bba_admin can query cross-tenant audit logs';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.audit_log
  WHERE p_company_id IS NULL OR company_id = p_company_id
  ORDER BY created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 1000);
END;
$$;

COMMENT ON FUNCTION public.get_audit_log_for_admin IS
  'Leitura cross-tenant de audit_log restrita a bba_admin. Não altera a policy audit_sel (que permanece restrita ao próprio tenant/usuário) — este é o caminho sancionado para supervisão administrativa.';

REVOKE ALL ON FUNCTION public.get_audit_log_for_admin FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_audit_log_for_admin TO authenticated;

-- ------------------------------------------------------------
-- 8) Definição (não enforcement) de retenção — AuditRetention.
--    Enforcement de expurgo/anonimização é escopo do SEC-05/LGPD.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_log_retention_status()
RETURNS TABLE (
  entidade TEXT,
  categoria TEXT,
  retencao_minima_anos INT,
  total_registros BIGINT,
  registros_alem_da_retencao BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_bba_admin() THEN
    RAISE EXCEPTION 'Only bba_admin can read audit retention status';
  END IF;

  RETURN QUERY
  WITH politica AS (
    SELECT unnest(ARRAY[
      'financial_lancamentos', 'financial_contas', 'financial_cobrancas',
      'fiscal_notas_fiscais', 'fiscal_guias', 'fiscal_parcelamentos',
      'rh_funcionarios', 'rh_folha_pagamentos',
      'societario_socios', 'societario_capital_social', 'societario_alteracoes'
    ]) AS entidade,
    'fiscal_trabalhista_societario'::TEXT AS categoria,
    5 AS retencao_minima_anos
    UNION ALL
    SELECT unnest(ARRAY[
      'profiles', 'companies', 'client_companies', 'client_socios',
      'client_documents', 'service_contracts', 'onboarding_checklist', 'auth.users'
    ]),
    'operacional'::TEXT,
    2
  )
  SELECT
    p.entidade,
    p.categoria,
    p.retencao_minima_anos,
    COUNT(a.id) AS total_registros,
    COUNT(a.id) FILTER (
      WHERE a.created_at < NOW() - (p.retencao_minima_anos || ' years')::INTERVAL
    ) AS registros_alem_da_retencao
  FROM politica p
  LEFT JOIN public.audit_log a ON a.entidade = p.entidade
  GROUP BY p.entidade, p.categoria, p.retencao_minima_anos
  ORDER BY p.entidade;
END;
$$;

COMMENT ON FUNCTION public.audit_log_retention_status IS
  'Define (sem executar) o status de retenção por categoria de entidade — 5 anos para fiscal/trabalhista/societário, 2 anos para operacional. Enforcement de expurgo/anonimização fica fora do escopo do SEC-04 (reservado ao SEC-05/LGPD). Restrito a bba_admin.';

REVOKE ALL ON FUNCTION public.audit_log_retention_status FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_log_retention_status TO authenticated;
