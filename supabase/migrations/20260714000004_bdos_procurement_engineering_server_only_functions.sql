-- Epic 21, Sprint 21.3C — fechamento da fronteira de confiança.
--
-- Achado da revisão: as 4 funções de mutação (20260714000002) tinham
-- EXECUTE concedido a `authenticated` — qualquer usuário autenticado podia
-- chamar `persist_budget_version_snapshot` (ou as demais) diretamente,
-- contornando os Serviços de Aplicação e o domínio, enviando qualquer
-- retrato dentro da própria organização (revisão consolidada voltando a
-- rascunho, Subgrupo sem Grupo, posições duplicadas, etc. — nada disso é
-- validado em SQL, é responsabilidade do domínio puro, Sprint 21.3B).
--
-- Esta migração torna as 4 funções operações exclusivas de servidor:
--
-- 1. EXECUTE revogado de PUBLIC/anon/authenticated; concedido somente a
--    `service_role` — a credencial de infraestrutura confiável, nunca
--    exposta ao navegador (ver apps/web/lib/bdos/
--    procurement-engineering-server-repository.ts).
-- 2. As 4 funções trocam de SECURITY DEFINER para SECURITY INVOKER —
--    agora que só `service_role` pode chamá-las, e `service_role` já tem
--    os GRANTs de tabela necessários (20260714000003) e ignora RLS neste
--    projeto, não há mais motivo para rodar com os privilégios do dono da
--    função. SECURITY DEFINER só permanecia por inércia da versão
--    anterior.
-- 3. `auth.uid()` deixa de ser a fonte de identidade do ator — uma
--    chamada via `service_role` não carrega o JWT de um usuário final.
--    Cada função agora recebe `p_actor_id` explicitamente (resolvido e
--    validado pela camada de servidor antes da chamada) e valida sua
--    associação com `p_company_id` usando o mesmo mecanismo real já
--    existente (`profiles.company_id`, `profiles.role = 'bba_admin'`),
--    só que parametrizado por ator em vez de `auth.uid()`.
-- 4. `p_created_by` deixa de ser um parâmetro independente — a autoria
--    persistida é sempre `p_actor_id`, nunca uma identidade escolhida
--    livremente pelo chamador.
--
-- As assinaturas anteriores (20260714000002) são explicitamente
-- removidas (DROP FUNCTION com a assinatura exata) antes de criar as
-- novas — os tipos de parâmetro mudam de posição, então CREATE OR REPLACE
-- criaria uma sobrecarga nova em vez de substituir a antiga.

-- BLOCO 1: get_company_id_for_actor / is_bba_admin_actor — mesma forma de
-- get_my_company_id()/is_bba_admin() (202506280001), parametrizadas por
-- ator em vez de auth.uid(), para uso a partir de uma função SECURITY
-- INVOKER chamada por service_role (sem JWT de usuário final).
CREATE OR REPLACE FUNCTION get_company_id_for_actor(p_actor_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id
  FROM profiles
  WHERE id = p_actor_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION is_bba_admin_actor(p_actor_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = p_actor_id
      AND role = 'bba_admin'
  );
$$;

COMMENT ON FUNCTION get_company_id_for_actor IS
  'Epic 21.3C — equivalente parametrizado de get_my_company_id(), para uso dentro das funções de mutação de Engenharia de Custos e Licitações, chamadas exclusivamente por service_role (sem auth.uid() de usuário final disponível).';
COMMENT ON FUNCTION is_bba_admin_actor IS
  'Epic 21.3C — equivalente parametrizado de is_bba_admin().';

-- BLOCO 2: remove as assinaturas anteriores (SECURITY DEFINER, sem
-- p_actor_id, com p_created_by independente) e todos os privilégios que
-- ainda apontassem para elas.
DROP FUNCTION IF EXISTS create_procurement_case(UUID, UUID, TEXT, TEXT, JSONB, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS register_procurement_lot(UUID, UUID, UUID, TEXT, TEXT, JSONB, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS create_budget_version_draft(UUID, UUID, UUID, TEXT, UUID, TEXT, TEXT, JSONB, TEXT, UUID, TEXT, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS persist_budget_version_snapshot(UUID, UUID, INTEGER, TEXT, JSONB, UUID, TEXT, TEXT);

-- BLOCO 3: create_procurement_case — nova assinatura, SECURITY INVOKER,
-- exclusiva de service_role.
CREATE FUNCTION create_procurement_case(
  p_actor_id UUID,
  p_company_id UUID,
  p_id UUID,
  p_title TEXT,
  p_external_reference TEXT,
  p_metadata JSONB,
  p_correlation_id TEXT,
  p_source_system TEXT
) RETURNS JSONB
SECURITY INVOKER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'Actor is required.' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_actor_id) THEN
    RAISE EXCEPTION 'Actor % does not exist.', p_actor_id USING ERRCODE = '28000';
  END IF;

  IF p_company_id IS DISTINCT FROM get_company_id_for_actor(p_actor_id) AND NOT is_bba_admin_actor(p_actor_id) THEN
    RAISE EXCEPTION 'Actor % is not authorized to create a Processo for this organização usuária.', p_actor_id USING ERRCODE = '42501';
  END IF;

  INSERT INTO procurement_cases (id, company_id, title, external_reference, metadata, correlation_id, created_by, source_system)
  VALUES (p_id, p_company_id, p_title, p_external_reference, COALESCE(p_metadata, '{}'::JSONB), p_correlation_id, p_actor_id, p_source_system);

  RETURN jsonb_build_object('id', p_id);
END;
$$;

REVOKE ALL ON FUNCTION create_procurement_case(UUID, UUID, UUID, TEXT, TEXT, JSONB, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_procurement_case(UUID, UUID, UUID, TEXT, TEXT, JSONB, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION create_procurement_case(UUID, UUID, UUID, TEXT, TEXT, JSONB, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION create_procurement_case(UUID, UUID, UUID, TEXT, TEXT, JSONB, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION create_procurement_case IS
  'Epic 21.3C — operação exclusiva de servidor (EXECUTE só para service_role). SECURITY INVOKER: só service_role pode chamar, já tem os GRANTs de tabela necessários. p_actor_id é validado contra profiles.company_id/role antes de qualquer escrita; created_by é sempre p_actor_id, nunca um valor independente.';

-- BLOCO 4: register_procurement_lot.
CREATE FUNCTION register_procurement_lot(
  p_actor_id UUID,
  p_company_id UUID,
  p_id UUID,
  p_procurement_case_id UUID,
  p_title TEXT,
  p_external_reference TEXT,
  p_metadata JSONB,
  p_correlation_id TEXT,
  p_source_system TEXT
) RETURNS JSONB
SECURITY INVOKER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'Actor is required.' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_actor_id) THEN
    RAISE EXCEPTION 'Actor % does not exist.', p_actor_id USING ERRCODE = '28000';
  END IF;

  IF p_company_id IS DISTINCT FROM get_company_id_for_actor(p_actor_id) AND NOT is_bba_admin_actor(p_actor_id) THEN
    RAISE EXCEPTION 'Actor % is not authorized to register a Lote for this organização usuária.', p_actor_id USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM procurement_cases WHERE id = p_procurement_case_id AND company_id = p_company_id) THEN
    RAISE EXCEPTION 'Processo de Licitação e Contratação % not found for this organização usuária.', p_procurement_case_id USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO procurement_lots (id, company_id, procurement_case_id, title, external_reference, metadata, correlation_id, created_by, source_system)
  VALUES (p_id, p_company_id, p_procurement_case_id, p_title, p_external_reference, COALESCE(p_metadata, '{}'::JSONB), p_correlation_id, p_actor_id, p_source_system);

  RETURN jsonb_build_object('id', p_id);
END;
$$;

REVOKE ALL ON FUNCTION register_procurement_lot(UUID, UUID, UUID, UUID, TEXT, TEXT, JSONB, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION register_procurement_lot(UUID, UUID, UUID, UUID, TEXT, TEXT, JSONB, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION register_procurement_lot(UUID, UUID, UUID, UUID, TEXT, TEXT, JSONB, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION register_procurement_lot(UUID, UUID, UUID, UUID, TEXT, TEXT, JSONB, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION register_procurement_lot IS
  'Epic 21.3C — operação exclusiva de servidor. Mesma disciplina de create_procurement_case.';

-- BLOCO 5: create_budget_version_draft.
CREATE FUNCTION create_budget_version_draft(
  p_actor_id UUID,
  p_company_id UUID,
  p_id UUID,
  p_procurement_case_id UUID,
  p_scope_kind TEXT,
  p_procurement_lot_id UUID,
  p_origin_kind TEXT,
  p_origin_reference TEXT,
  p_metadata JSONB,
  p_correlation_id TEXT,
  p_source_system TEXT,
  p_lineage_id UUID,
  p_lineage_origin_kind TEXT,
  p_lineage_origin_reference TEXT
) RETURNS JSONB
SECURITY INVOKER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_revision INTEGER;
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'Actor is required.' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_actor_id) THEN
    RAISE EXCEPTION 'Actor % does not exist.', p_actor_id USING ERRCODE = '28000';
  END IF;

  IF p_company_id IS DISTINCT FROM get_company_id_for_actor(p_actor_id) AND NOT is_bba_admin_actor(p_actor_id) THEN
    RAISE EXCEPTION 'Actor % is not authorized to create a Versão do Orçamento for this organização usuária.', p_actor_id USING ERRCODE = '42501';
  END IF;

  INSERT INTO budget_versions (
    id, company_id, procurement_case_id, scope_kind, procurement_lot_id,
    origin_kind, origin_reference, status, metadata, correlation_id, created_by, source_system
  ) VALUES (
    p_id, p_company_id, p_procurement_case_id, p_scope_kind, p_procurement_lot_id,
    p_origin_kind, p_origin_reference, 'Draft', COALESCE(p_metadata, '{}'::JSONB), p_correlation_id, p_actor_id, p_source_system
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
  UUID, UUID, UUID, UUID, TEXT, UUID, TEXT, TEXT, JSONB, TEXT, TEXT, UUID, TEXT, TEXT
) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_budget_version_draft(
  UUID, UUID, UUID, UUID, TEXT, UUID, TEXT, TEXT, JSONB, TEXT, TEXT, UUID, TEXT, TEXT
) FROM anon;
REVOKE ALL ON FUNCTION create_budget_version_draft(
  UUID, UUID, UUID, UUID, TEXT, UUID, TEXT, TEXT, JSONB, TEXT, TEXT, UUID, TEXT, TEXT
) FROM authenticated;
GRANT EXECUTE ON FUNCTION create_budget_version_draft(
  UUID, UUID, UUID, UUID, TEXT, UUID, TEXT, TEXT, JSONB, TEXT, TEXT, UUID, TEXT, TEXT
) TO service_role;

COMMENT ON FUNCTION create_budget_version_draft IS
  'Epic 21.3C — operação exclusiva de servidor. Mesma disciplina de create_procurement_case; persiste também a Relação de Rastreabilidade de origem declarada na criação, quando fornecida.';

-- BLOCO 6: persist_budget_version_snapshot — não grava created_by (a
-- Versão já foi criada), mas ainda exige p_actor_id para autorização: sem
-- ele, qualquer chamador de servidor poderia informar apenas p_company_id
-- sem provar que o ator tem relação real com aquela organização.
CREATE FUNCTION persist_budget_version_snapshot(
  p_actor_id UUID,
  p_company_id UUID,
  p_budget_version_id UUID,
  p_expected_revision INTEGER,
  p_status TEXT,
  p_lines JSONB,
  p_lineage_id UUID,
  p_lineage_origin_kind TEXT,
  p_lineage_origin_reference TEXT
) RETURNS JSONB
SECURITY INVOKER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_revision INTEGER;
  v_existing_lineage RECORD;
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'Actor is required.' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_actor_id) THEN
    RAISE EXCEPTION 'Actor % does not exist.', p_actor_id USING ERRCODE = '28000';
  END IF;

  IF p_company_id IS DISTINCT FROM get_company_id_for_actor(p_actor_id) AND NOT is_bba_admin_actor(p_actor_id) THEN
    RAISE EXCEPTION 'Actor % is not authorized to alter a Versão do Orçamento for this organização usuária.', p_actor_id USING ERRCODE = '42501';
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
  UUID, UUID, UUID, INTEGER, TEXT, JSONB, UUID, TEXT, TEXT
) FROM PUBLIC;
REVOKE ALL ON FUNCTION persist_budget_version_snapshot(
  UUID, UUID, UUID, INTEGER, TEXT, JSONB, UUID, TEXT, TEXT
) FROM anon;
REVOKE ALL ON FUNCTION persist_budget_version_snapshot(
  UUID, UUID, UUID, INTEGER, TEXT, JSONB, UUID, TEXT, TEXT
) FROM authenticated;
GRANT EXECUTE ON FUNCTION persist_budget_version_snapshot(
  UUID, UUID, UUID, INTEGER, TEXT, JSONB, UUID, TEXT, TEXT
) TO service_role;

COMMENT ON FUNCTION persist_budget_version_snapshot IS
  'Epic 21.3C — operação exclusiva de servidor. p_actor_id autoriza a operação (nunca grava created_by — a Versão já existe); sem ele, o chamador de servidor não prova associação real entre o ator e p_company_id.';
