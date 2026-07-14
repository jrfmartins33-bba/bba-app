-- Epic 21, Sprint 21.3C — correção de segurança pós-revisão.
--
-- Achado da revisão: as tabelas de 20260714000000/...000001 concediam
-- INSERT/UPDATE/DELETE diretos a `authenticated`, permitindo contornar os
-- Serviços de Aplicação, o domínio e a concorrência otimista escrevendo
-- diretamente nas tabelas. Esta migração fecha essa fronteira:
--
-- 1. Toda mutação passa a exigir uma função `SECURITY DEFINER` própria,
--    que verifica explicitamente `auth.uid()` e `company_id =
--    get_my_company_id() OR is_bba_admin()` antes de qualquer escrita —
--    RLS não é avaliada dentro de uma função SECURITY DEFINER (ela roda
--    com os privilégios do dono da função), por isso a verificação
--    precisa ser explícita aqui, não delegada à RLS.
-- 2. `authenticated` perde INSERT/UPDATE/DELETE diretos nas 5 tabelas —
--    mantém apenas SELECT, protegido por RLS como antes.
-- 3. Integridade de `parent_line_id` (existe, mesma company_id, mesma
--    budget_version_id, nunca a própria linha) via gatilho.
-- 4. `persist_budget_version_snapshot` para de usar `ON CONFLICT (id) DO
--    NOTHING` genérico para a Relação de Rastreabilidade — agora
--    confirma explicitamente identidade/natureza/origem/referência antes
--    de tratar um reenvio como operação sem efeito, e lança erro de
--    integridade em qualquer divergência.
--
-- Nenhuma regra econômica do domínio é incorporada aqui — apenas
-- autorização, integridade estrutural, e a mesma persistência do retrato
-- já validado pelo domínio (Sprint 21.3B) que as funções anteriores já
-- faziam.

-- BLOCO 1: create_procurement_case — antes, o adaptador fazia INSERT
-- direto; agora passa por aqui.
CREATE OR REPLACE FUNCTION create_procurement_case(
  p_company_id UUID,
  p_id UUID,
  p_title TEXT,
  p_external_reference TEXT,
  p_metadata JSONB,
  p_correlation_id TEXT,
  p_created_by UUID,
  p_source_system TEXT
) RETURNS JSONB
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;

  IF p_company_id IS DISTINCT FROM get_my_company_id() AND NOT is_bba_admin() THEN
    RAISE EXCEPTION 'Not authorized to create a Processo for this organização usuária.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO procurement_cases (id, company_id, title, external_reference, metadata, correlation_id, created_by, source_system)
  VALUES (p_id, p_company_id, p_title, p_external_reference, COALESCE(p_metadata, '{}'::JSONB), p_correlation_id, p_created_by, p_source_system);

  RETURN jsonb_build_object('id', p_id);
END;
$$;

REVOKE ALL ON FUNCTION create_procurement_case(UUID, UUID, TEXT, TEXT, JSONB, TEXT, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_procurement_case(UUID, UUID, TEXT, TEXT, JSONB, TEXT, UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION create_procurement_case(UUID, UUID, TEXT, TEXT, JSONB, TEXT, UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION create_procurement_case IS
  'Epic 21.3C — única forma autorizada de criar um Processo de Licitação e Contratação. SECURITY DEFINER: verifica auth.uid() e company_id explicitamente, pois RLS não se aplica dentro da função.';

-- BLOCO 2: register_procurement_lot.
CREATE OR REPLACE FUNCTION register_procurement_lot(
  p_company_id UUID,
  p_id UUID,
  p_procurement_case_id UUID,
  p_title TEXT,
  p_external_reference TEXT,
  p_metadata JSONB,
  p_correlation_id TEXT,
  p_created_by UUID,
  p_source_system TEXT
) RETURNS JSONB
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;

  IF p_company_id IS DISTINCT FROM get_my_company_id() AND NOT is_bba_admin() THEN
    RAISE EXCEPTION 'Not authorized to register a Lote for this organização usuária.' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM procurement_cases WHERE id = p_procurement_case_id AND company_id = p_company_id) THEN
    RAISE EXCEPTION 'Processo de Licitação e Contratação % not found for this organização usuária.', p_procurement_case_id USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO procurement_lots (id, company_id, procurement_case_id, title, external_reference, metadata, correlation_id, created_by, source_system)
  VALUES (p_id, p_company_id, p_procurement_case_id, p_title, p_external_reference, COALESCE(p_metadata, '{}'::JSONB), p_correlation_id, p_created_by, p_source_system);

  RETURN jsonb_build_object('id', p_id);
END;
$$;

REVOKE ALL ON FUNCTION register_procurement_lot(UUID, UUID, UUID, TEXT, TEXT, JSONB, TEXT, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION register_procurement_lot(UUID, UUID, UUID, TEXT, TEXT, JSONB, TEXT, UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION register_procurement_lot(UUID, UUID, UUID, TEXT, TEXT, JSONB, TEXT, UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION register_procurement_lot IS
  'Epic 21.3C — única forma autorizada de registrar um Lote da Licitação. SECURITY DEFINER: verifica auth.uid(), company_id, e a existência do Processo na mesma organização usuária.';

-- BLOCO 3: create_budget_version_draft — convertida de SECURITY INVOKER
-- (confiava em RLS) para SECURITY DEFINER com verificação explícita,
-- agora que a escrita direta em budget_versions/budget_version_lineage_
-- relations será revogada de `authenticated` (Bloco 6).
CREATE OR REPLACE FUNCTION create_budget_version_draft(
  p_company_id UUID,
  p_id UUID,
  p_procurement_case_id UUID,
  p_scope_kind TEXT,
  p_procurement_lot_id UUID,
  p_origin_kind TEXT,
  p_origin_reference TEXT,
  p_metadata JSONB,
  p_correlation_id TEXT,
  p_created_by UUID,
  p_source_system TEXT,
  p_lineage_id UUID,
  p_lineage_origin_kind TEXT,
  p_lineage_origin_reference TEXT
) RETURNS JSONB
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_revision INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;

  IF p_company_id IS DISTINCT FROM get_my_company_id() AND NOT is_bba_admin() THEN
    RAISE EXCEPTION 'Not authorized to create a Versão do Orçamento for this organização usuária.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO budget_versions (
    id, company_id, procurement_case_id, scope_kind, procurement_lot_id,
    origin_kind, origin_reference, status, metadata, correlation_id, created_by, source_system
  ) VALUES (
    p_id, p_company_id, p_procurement_case_id, p_scope_kind, p_procurement_lot_id,
    p_origin_kind, p_origin_reference, 'Draft', COALESCE(p_metadata, '{}'::JSONB), p_correlation_id, p_created_by, p_source_system
  )
  RETURNING revision INTO v_revision;

  IF p_lineage_id IS NOT NULL THEN
    INSERT INTO budget_version_lineage_relations (
      id, company_id, budget_version_id, nature, origin_kind, origin_reference
    ) VALUES (
      p_lineage_id, p_company_id, p_id, 'Origin', p_lineage_origin_kind, p_lineage_origin_reference
    );
  END IF;

  RETURN jsonb_build_object('revision', v_revision);
END;
$$;

REVOKE ALL ON FUNCTION create_budget_version_draft(
  UUID, UUID, UUID, TEXT, UUID, TEXT, TEXT, JSONB, TEXT, UUID, TEXT, UUID, TEXT, TEXT
) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_budget_version_draft(
  UUID, UUID, UUID, TEXT, UUID, TEXT, TEXT, JSONB, TEXT, UUID, TEXT, UUID, TEXT, TEXT
) FROM anon;
GRANT EXECUTE ON FUNCTION create_budget_version_draft(
  UUID, UUID, UUID, TEXT, UUID, TEXT, TEXT, JSONB, TEXT, UUID, TEXT, UUID, TEXT, TEXT
) TO authenticated;

COMMENT ON FUNCTION create_budget_version_draft IS
  'Epic 21.3C — persiste o registro principal da Versão do Orçamento em rascunho e, quando fornecida, a Relação de Rastreabilidade de origem declarada na criação, numa única transação. SECURITY DEFINER com verificação explícita de auth.uid()/company_id — RLS não se aplica dentro da função.';

-- BLOCO 4: persist_budget_version_snapshot — convertida para SECURITY
-- DEFINER com verificação explícita; Relação de Rastreabilidade não usa
-- mais ON CONFLICT DO NOTHING genérico (ver Bloco 5 do relatório —
-- confirma identidade/natureza/origem/referência antes de tratar um
-- reenvio como sem efeito).
CREATE OR REPLACE FUNCTION persist_budget_version_snapshot(
  p_company_id UUID,
  p_budget_version_id UUID,
  p_expected_revision INTEGER,
  p_status TEXT,
  p_lines JSONB,
  p_lineage_id UUID,
  p_lineage_origin_kind TEXT,
  p_lineage_origin_reference TEXT
) RETURNS JSONB
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_revision INTEGER;
  v_existing_lineage RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;

  IF p_company_id IS DISTINCT FROM get_my_company_id() AND NOT is_bba_admin() THEN
    RAISE EXCEPTION 'Not authorized to alter this Versão do Orçamento organização usuária.' USING ERRCODE = '42501';
  END IF;

  UPDATE budget_versions
  SET status = p_status, revision = revision + 1
  WHERE id = p_budget_version_id
    AND company_id = p_company_id
    AND revision = p_expected_revision
  RETURNING revision INTO v_new_revision;

  IF v_new_revision IS NULL THEN
    RETURN jsonb_build_object('conflict', true);
  END IF;

  DELETE FROM budget_lines
  WHERE budget_version_id = p_budget_version_id AND company_id = p_company_id;

  -- A ordem de `p_lines` já vem topologicamente ordenada pelo mapeador
  -- (pai sempre antes do filho) — o gatilho de integridade de
  -- parent_line_id (enforce_budget_line_version_consistency, atualizado
  -- no Bloco 7) depende dessa ordem para aceitar uma linha cujo pai foi
  -- inserido no mesmo lote.
  INSERT INTO budget_lines (
    id, company_id, budget_version_id, kind, description_status, description_text,
    external_code, parent_line_id, position, scope_kind, scope_procurement_lot_id, total_cents, metadata
  )
  SELECT
    (line->>'id')::UUID,
    p_company_id,
    p_budget_version_id,
    line->>'kind',
    line->>'descriptionStatus',
    line->>'descriptionText',
    line->>'externalCode',
    NULLIF(line->>'parentLineId', '')::UUID,
    (line->>'position')::INTEGER,
    line->>'scopeKind',
    NULLIF(line->>'scopeProcurementLotId', '')::UUID,
    NULLIF(line->>'totalCents', '')::BIGINT,
    COALESCE(line->'metadata', '{}'::JSONB)
  FROM jsonb_array_elements(p_lines) AS line;

  IF p_lineage_id IS NOT NULL THEN
    SELECT * INTO v_existing_lineage FROM budget_version_lineage_relations WHERE budget_version_id = p_budget_version_id;

    IF v_existing_lineage.id IS NULL THEN
      INSERT INTO budget_version_lineage_relations (
        id, company_id, budget_version_id, nature, origin_kind, origin_reference
      ) VALUES (
        p_lineage_id, p_company_id, p_budget_version_id, 'Origin', p_lineage_origin_kind, p_lineage_origin_reference
      );
    ELSIF v_existing_lineage.id = p_lineage_id
      AND v_existing_lineage.nature = 'Origin'
      AND v_existing_lineage.origin_kind = p_lineage_origin_kind
      AND v_existing_lineage.origin_reference IS NOT DISTINCT FROM p_lineage_origin_reference
    THEN
      -- Reenvio idêntico ao já registrado (todo save subsequente reenvia
      -- a Relação já existente, junto do resto do agregado) — operação
      -- sem efeito, nunca um erro.
      NULL;
    ELSE
      RAISE EXCEPTION
        'budget_version_lineage_relations: Versão % already has a different origin Relação de Rastreabilidade (existing id=%, requested id=%).',
        p_budget_version_id, v_existing_lineage.id, p_lineage_id
        USING ERRCODE = '23505';
    END IF;
  END IF;

  RETURN jsonb_build_object('conflict', false, 'revision', v_new_revision);
END;
$$;

REVOKE ALL ON FUNCTION persist_budget_version_snapshot(
  UUID, UUID, INTEGER, TEXT, JSONB, UUID, TEXT, TEXT
) FROM PUBLIC;
REVOKE ALL ON FUNCTION persist_budget_version_snapshot(
  UUID, UUID, INTEGER, TEXT, JSONB, UUID, TEXT, TEXT
) FROM anon;
GRANT EXECUTE ON FUNCTION persist_budget_version_snapshot(
  UUID, UUID, INTEGER, TEXT, JSONB, UUID, TEXT, TEXT
) TO authenticated;

COMMENT ON FUNCTION persist_budget_version_snapshot IS
  'Epic 21.3C — única forma de alterar uma Versão do Orçamento já criada. SECURITY DEFINER com verificação explícita de auth.uid()/company_id. Relação de Rastreabilidade: confirma identidade/natureza/origem/referência antes de tratar um reenvio como sem efeito; qualquer divergência levanta erro de integridade — nunca ON CONFLICT DO NOTHING silencioso.';

-- BLOCO 5: revoga a escrita direta de `authenticated` nas 5 tabelas —
-- só leitura permanece, protegida por RLS como antes. As funções acima
-- (SECURITY DEFINER, dono = role que aplicou a migração) continuam
-- escrevendo normalmente — revogar de `authenticated` não afeta a própria
-- função.
REVOKE INSERT, UPDATE, DELETE ON public.procurement_cases FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.procurement_lots FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.budget_versions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.budget_lines FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.budget_version_lineage_relations FROM authenticated;

-- BLOCO 6: substitui as políticas de escrita direta por bloqueio
-- explícito — defesa em profundidade complementar à revogação acima
-- (nunca a única defesa, mesma filosofia já registrada no ADR-002 §B).
DROP POLICY IF EXISTS procurement_cases_insert_company_or_admin ON procurement_cases;
CREATE POLICY procurement_cases_insert_blocked ON procurement_cases FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS procurement_lots_insert_company_or_admin ON procurement_lots;
CREATE POLICY procurement_lots_insert_blocked ON procurement_lots FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS budget_versions_insert_company_or_admin ON budget_versions;
CREATE POLICY budget_versions_insert_blocked ON budget_versions FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS budget_versions_update_company_or_admin ON budget_versions;
CREATE POLICY budget_versions_update_blocked ON budget_versions FOR UPDATE TO authenticated USING (false);

DROP POLICY IF EXISTS budget_lines_insert_company_or_admin ON budget_lines;
CREATE POLICY budget_lines_insert_blocked ON budget_lines FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS budget_lines_delete_company_or_admin ON budget_lines;
CREATE POLICY budget_lines_delete_blocked ON budget_lines FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS budget_version_lineage_relations_insert_company_or_admin ON budget_version_lineage_relations;
CREATE POLICY budget_version_lineage_relations_insert_blocked ON budget_version_lineage_relations FOR INSERT TO authenticated WITH CHECK (false);

-- BLOCO 7: integridade de parent_line_id — quando preenchido, o pai
-- precisa existir, pertencer à mesma company_id e à mesma
-- budget_version_id, e nunca ser a própria linha. Depende da ordem
-- topológica de inserção (pai antes do filho) garantida pelo mapeador —
-- ver Bloco 4.
CREATE OR REPLACE FUNCTION enforce_budget_line_version_consistency() RETURNS TRIGGER AS $$
DECLARE
  v_version_company_id UUID;
  v_version_case_id UUID;
BEGIN
  SELECT company_id, procurement_case_id INTO v_version_company_id, v_version_case_id
  FROM budget_versions
  WHERE id = NEW.budget_version_id;

  IF v_version_company_id IS NULL THEN
    RAISE EXCEPTION 'budget_lines.budget_version_id does not reference an existing budget_versions row';
  END IF;

  IF v_version_company_id <> NEW.company_id THEN
    RAISE EXCEPTION 'budget_lines.company_id must match the company_id of its budget_version_id';
  END IF;

  IF NEW.scope_kind = 'Lot' AND NOT EXISTS (
    SELECT 1 FROM procurement_lots
    WHERE id = NEW.scope_procurement_lot_id AND company_id = NEW.company_id AND procurement_case_id = v_version_case_id
  ) THEN
    RAISE EXCEPTION 'budget_lines.scope_procurement_lot_id must belong to the same company_id and procurement_case_id as its Versão';
  END IF;

  IF NEW.parent_line_id IS NOT NULL THEN
    IF NEW.parent_line_id = NEW.id THEN
      RAISE EXCEPTION 'budget_lines: a line cannot be its own parent (id=%)', NEW.id;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM budget_lines
      WHERE id = NEW.parent_line_id AND company_id = NEW.company_id AND budget_version_id = NEW.budget_version_id
    ) THEN
      RAISE EXCEPTION 'budget_lines: parent_line_id % must already exist, belong to the same company_id, and belong to the same budget_version_id as line %', NEW.parent_line_id, NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION enforce_budget_line_version_consistency IS
  'Epic 21.3C — integridade estrutural de budget_lines: company_id/Escopo de lote consistentes com a Versão, e parent_line_id (quando preenchido) precisa existir, pertencer à mesma company_id e à mesma budget_version_id, e nunca ser a própria linha. Depende da ordem topológica de inserção garantida pelo mapeador (pai antes do filho, dentro do mesmo lote de persist_budget_version_snapshot).';
