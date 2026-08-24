-- ETAPA 2B — rastreabilidade imutável entre a Proposta Vencedora e os
-- itens contratados já existentes na execução.
--
-- Este arquivo é apenas preparação. Não foi aplicado a nenhum ambiente.
-- A tabela registra relações; não copia itens e não altera proposta,
-- baseline, execução, medições ou valores econômicos.

CREATE TABLE public.contract_execution_item_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  engineering_project_id UUID NOT NULL REFERENCES public.engineering_projects(id) ON DELETE RESTRICT,
  contract_baseline_id UUID NOT NULL REFERENCES public.contract_baselines(id) ON DELETE RESTRICT,
  proposal_budget_version_id UUID NOT NULL REFERENCES public.budget_versions(id) ON DELETE RESTRICT,
  proposal_budget_line_id UUID NOT NULL REFERENCES public.budget_lines(id) ON DELETE RESTRICT,
  managed_service_item_id UUID NOT NULL REFERENCES public.managed_service_items(id) ON DELETE RESTRICT,
  match_method TEXT NOT NULL CHECK (
    match_method IN (
      'StructuralCodeAndExactMaterialFields',
      'UniqueExactDocumentaryRemainder'
    )
  ),
  evidence JSONB NOT NULL CHECK (jsonb_typeof(evidence) = 'object'),
  validation_set_integrity_id TEXT NOT NULL CHECK (
    validation_set_integrity_id ~ '^[0-9a-f]{32}$'
  ),
  baseline_updated_at_snapshot TIMESTAMPTZ NOT NULL,
  proposal_version_updated_at_snapshot TIMESTAMPTZ NOT NULL,
  proposal_line_created_at_snapshot TIMESTAMPTZ NOT NULL,
  operational_item_updated_at_snapshot TIMESTAMPTZ NOT NULL,
  approval_reference TEXT NOT NULL CHECK (length(trim(approval_reference)) > 0),
  source_system TEXT NOT NULL CHECK (length(trim(source_system)) > 0),
  correlation_id TEXT NOT NULL CHECK (length(trim(correlation_id)) > 0),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contract_execution_item_links_proposal_once
    UNIQUE (contract_baseline_id, proposal_budget_line_id),
  CONSTRAINT contract_execution_item_links_operational_once
    UNIQUE (contract_baseline_id, managed_service_item_id)
);

CREATE INDEX contract_execution_item_links_company_id_idx
  ON public.contract_execution_item_links (company_id);
CREATE INDEX contract_execution_item_links_project_id_idx
  ON public.contract_execution_item_links (engineering_project_id);
CREATE INDEX contract_execution_item_links_baseline_id_idx
  ON public.contract_execution_item_links (contract_baseline_id);
CREATE INDEX contract_execution_item_links_version_id_idx
  ON public.contract_execution_item_links (proposal_budget_version_id);
CREATE INDEX contract_execution_item_links_proposal_line_id_idx
  ON public.contract_execution_item_links (proposal_budget_line_id);
CREATE INDEX contract_execution_item_links_operational_item_id_idx
  ON public.contract_execution_item_links (managed_service_item_id);
CREATE INDEX contract_execution_item_links_created_by_idx
  ON public.contract_execution_item_links (created_by);

CREATE OR REPLACE FUNCTION public.enforce_contract_execution_item_link_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.contract_baselines cb
    WHERE cb.id = NEW.contract_baseline_id
      AND cb.company_id = NEW.company_id
      AND cb.engineering_project_id = NEW.engineering_project_id
      AND cb.source_budget_version_id = NEW.proposal_budget_version_id
      AND cb.updated_at = NEW.baseline_updated_at_snapshot
  ) THEN
    RAISE EXCEPTION 'Contract baseline scope or source proposal changed.'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.budget_versions bv
    WHERE bv.id = NEW.proposal_budget_version_id
      AND bv.company_id = NEW.company_id
      AND bv.status = 'Consolidated'
      AND bv.updated_at = NEW.proposal_version_updated_at_snapshot
  ) THEN
    RAISE EXCEPTION 'Proposal version is not the unchanged consolidated contracted proposal.'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.budget_lines bl
    WHERE bl.id = NEW.proposal_budget_line_id
      AND bl.company_id = NEW.company_id
      AND bl.budget_version_id = NEW.proposal_budget_version_id
      AND bl.kind = 'ServiceItem'
      AND bl.created_at = NEW.proposal_line_created_at_snapshot
  ) THEN
    RAISE EXCEPTION 'Proposal service item scope or snapshot changed.'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.managed_service_items msi
    WHERE msi.id = NEW.managed_service_item_id
      AND msi.company_id = NEW.company_id
      AND msi.engineering_project_id = NEW.engineering_project_id
      AND msi.updated_at = NEW.operational_item_updated_at_snapshot
  ) THEN
    RAISE EXCEPTION 'Operational service item scope or snapshot changed.'
      USING ERRCODE = '23514';
  END IF;

  IF COALESCE((NEW.evidence->>'externalCodesAreEvidenceOnly')::BOOLEAN, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'External codes may be stored only as audit evidence.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_contract_execution_item_link_scope_before_insert
BEFORE INSERT ON public.contract_execution_item_links
FOR EACH ROW
EXECUTE FUNCTION public.enforce_contract_execution_item_link_scope();

CREATE OR REPLACE FUNCTION public.block_contract_execution_item_link_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Contract execution item traceability is append-only.'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER block_contract_execution_item_link_update_or_delete
BEFORE UPDATE OR DELETE ON public.contract_execution_item_links
FOR EACH ROW
EXECUTE FUNCTION public.block_contract_execution_item_link_mutation();

ALTER TABLE public.contract_execution_item_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY contract_execution_item_links_select_same_company
ON public.contract_execution_item_links
FOR SELECT
TO authenticated
USING (
  company_id = public.get_my_company_id()
  OR public.is_bba_admin()
);

REVOKE ALL ON TABLE public.contract_execution_item_links FROM PUBLIC;
REVOKE ALL ON TABLE public.contract_execution_item_links FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.contract_execution_item_links FROM authenticated;
GRANT SELECT ON TABLE public.contract_execution_item_links TO authenticated;
GRANT SELECT, INSERT ON TABLE public.contract_execution_item_links TO service_role;

-- Revalidação autoritativa. A função é somente leitura e compara o
-- manifesto inteiro com o estado atual imediatamente antes da escrita.
CREATE OR REPLACE FUNCTION public.revalidate_contract_execution_item_link_manifest(
  p_manifest JSONB
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id UUID := (p_manifest->'scope'->>'organizationId')::UUID;
  v_project_id UUID := (p_manifest->'scope'->>'engineeringProjectId')::UUID;
  v_baseline_id UUID := (p_manifest->'scope'->>'contractBaselineId')::UUID;
  v_version_id UUID := (p_manifest->'scope'->>'proposalBudgetVersionId')::UUID;
  v_expected_integrity_id TEXT := p_manifest->'integrity'->>'validationSetIntegrityId';
  v_proposal_count INTEGER;
  v_operational_count INTEGER;
  v_manifest_count INTEGER;
  v_distinct_proposal_count INTEGER;
  v_distinct_operational_count INTEGER;
  v_valid_pair_count INTEGER;
  v_current_integrity_id TEXT;
  v_baseline_ok BOOLEAN;
  v_snapshots_ok BOOLEAN;
  v_economics_ok BOOLEAN;
  v_ready BOOLEAN;
BEGIN
  SELECT count(*) INTO v_proposal_count
  FROM public.budget_lines
  WHERE company_id = v_company_id
    AND budget_version_id = v_version_id
    AND kind = 'ServiceItem';

  SELECT count(*) INTO v_operational_count
  FROM public.managed_service_items
  WHERE company_id = v_company_id
    AND engineering_project_id = v_project_id;

  SELECT
    count(*),
    count(DISTINCT link->'proposalLine'->>'id'),
    count(DISTINCT link->'operationalItem'->>'id')
  INTO v_manifest_count, v_distinct_proposal_count, v_distinct_operational_count
  FROM jsonb_array_elements(COALESCE(p_manifest->'links', '[]'::JSONB)) AS link;

  SELECT count(*) INTO v_valid_pair_count
  FROM jsonb_array_elements(COALESCE(p_manifest->'links', '[]'::JSONB)) AS link
  JOIN public.budget_lines bl
    ON bl.id = (link->'proposalLine'->>'id')::UUID
   AND bl.company_id = v_company_id
   AND bl.budget_version_id = v_version_id
   AND bl.kind = 'ServiceItem'
   AND bl.position = (link->'proposalLine'->>'position')::INTEGER
   AND bl.external_code IS NOT DISTINCT FROM link->'proposalLine'->>'documentCode'
   AND bl.metadata->>'hierarchicalCode' IS NOT DISTINCT FROM link->'proposalLine'->>'structuralCode'
   AND bl.description_text = link->'proposalLine'->>'description'
   AND bl.parent_line_id IS NOT DISTINCT FROM NULLIF(link->'proposalLine'->>'parentLineId', '')::UUID
   AND bl.unit = link->'proposalLine'->>'unit'
   AND bl.quantity_decimal::NUMERIC = (link->'proposalLine'->>'quantityDecimal')::NUMERIC
   AND bl.unit_price_cents = (link->'proposalLine'->>'unitPriceCents')::BIGINT
   AND bl.total_cents = (link->'proposalLine'->>'totalCents')::BIGINT
   AND bl.created_at = (link->'proposalLine'->>'createdAtSnapshot')::TIMESTAMPTZ
  JOIN public.managed_service_items msi
    ON msi.id = (link->'operationalItem'->>'id')::UUID
   AND msi.company_id = v_company_id
   AND msi.engineering_project_id = v_project_id
   AND msi.code = link->'operationalItem'->>'code'
   AND msi.description = link->'operationalItem'->>'description'
   AND msi.unit = link->'operationalItem'->>'unit'
   AND msi.contract_quantity = (link->'operationalItem'->>'contractQuantityDecimal')::NUMERIC
   AND msi.unit_price = (link->'operationalItem'->>'unitPriceDecimal')::NUMERIC
   AND msi.work_package_id = (link->'operationalItem'->>'workPackageId')::UUID
   AND msi.updated_at = (link->'operationalItem'->>'updatedAtSnapshot')::TIMESTAMPTZ
  WHERE link->'validation'->>'status' = 'Validated'
    AND COALESCE((link->'validation'->>'ambiguous')::BOOLEAN, true) IS FALSE
    AND COALESCE((link->'validation'->>'materialDivergence')::BOOLEAN, true) IS FALSE
    AND COALESCE((link->'evidence'->>'candidateUniqueInApplicableSet')::BOOLEAN, false) IS TRUE
    AND COALESCE((link->'evidence'->>'descriptionExact')::BOOLEAN, false) IS TRUE
    AND COALESCE((link->'evidence'->>'unitExact')::BOOLEAN, false) IS TRUE
    AND COALESCE((link->'evidence'->>'quantityExact')::BOOLEAN, false) IS TRUE
    AND COALESCE((link->'evidence'->>'unitPriceExact')::BOOLEAN, false) IS TRUE
    AND COALESCE((link->'evidence'->>'externalCodesAreEvidenceOnly')::BOOLEAN, false) IS TRUE;

  SELECT md5(string_agg(
    (link->'proposalLine'->>'id') || '->' || (link->'operationalItem'->>'id'),
    '|' ORDER BY bl.position, bl.id DESC
  )) INTO v_current_integrity_id
  FROM jsonb_array_elements(COALESCE(p_manifest->'links', '[]'::JSONB)) AS link
  JOIN public.budget_lines bl
    ON bl.id = (link->'proposalLine'->>'id')::UUID
   AND bl.budget_version_id = v_version_id;

  SELECT EXISTS (
    SELECT 1
    FROM public.contract_baselines cb
    JOIN public.budget_versions bv ON bv.id = cb.source_budget_version_id
    WHERE cb.id = v_baseline_id
      AND cb.company_id = v_company_id
      AND cb.engineering_project_id = v_project_id
      AND cb.source_budget_version_id = v_version_id
      AND bv.company_id = v_company_id
      AND bv.status = 'Consolidated'
  ) INTO v_baseline_ok;

  SELECT EXISTS (
    SELECT 1
    FROM public.contract_baselines cb
    JOIN public.budget_versions bv ON bv.id = v_version_id
    WHERE cb.id = v_baseline_id
      AND cb.updated_at = (p_manifest->'sourceSnapshots'->>'contractBaselineUpdatedAt')::TIMESTAMPTZ
      AND bv.updated_at = (p_manifest->'sourceSnapshots'->>'proposalBudgetVersionUpdatedAt')::TIMESTAMPTZ
  ) INTO v_snapshots_ok;

  SELECT EXISTS (
    SELECT 1
    FROM public.contract_baselines cb
    WHERE cb.id = v_baseline_id
      AND cb.contracted_value_cents = (p_manifest->'economics'->>'contractedProposalValueCents')::BIGINT
      AND cb.derived_items_total_decimal = (p_manifest->'economics'->>'operationalItemsGrossTotalDecimal')::NUMERIC
      AND cb.contractual_rounding_adjustment_decimal = (p_manifest->'economics'->>'contractualRoundingAdjustmentDecimal')::NUMERIC
      AND COALESCE((p_manifest->'economics'->>'mutationPlanned')::BOOLEAN, true) IS FALSE
  ) INTO v_economics_ok;

  v_ready :=
    v_proposal_count = 300
    AND v_operational_count = 300
    AND v_manifest_count = 300
    AND v_distinct_proposal_count = 300
    AND v_distinct_operational_count = 300
    AND v_valid_pair_count = 300
    AND v_current_integrity_id = v_expected_integrity_id
    AND v_baseline_ok
    AND v_snapshots_ok
    AND v_economics_ok;

  RETURN jsonb_build_object(
    'ready', v_ready,
    'violations', to_jsonb(array_remove(ARRAY[
      CASE WHEN v_proposal_count <> 300 THEN 'Proposal service-item count drifted.' END,
      CASE WHEN v_operational_count <> 300 THEN 'Operational service-item count drifted.' END,
      CASE WHEN v_manifest_count <> 300 THEN 'Manifest does not contain exactly 300 links.' END,
      CASE WHEN v_distinct_proposal_count <> 300 THEN 'Proposal identities are not unique.' END,
      CASE WHEN v_distinct_operational_count <> 300 THEN 'Operational identities are not unique.' END,
      CASE WHEN v_valid_pair_count <> 300 THEN 'At least one source item or deterministic evidence changed.' END,
      CASE WHEN v_current_integrity_id IS DISTINCT FROM v_expected_integrity_id THEN 'Validation-set integrity changed.' END,
      CASE WHEN NOT v_baseline_ok THEN 'Contract baseline no longer points to the same consolidated proposal.' END,
      CASE WHEN NOT v_snapshots_ok THEN 'Baseline or proposal version snapshot changed.' END,
      CASE WHEN NOT v_economics_ok THEN 'Contract economics changed.' END
    ], NULL)),
    'currentIntegrityId', v_current_integrity_id,
    'proposalItemCount', v_proposal_count,
    'operationalItemCount', v_operational_count,
    'validPairCount', v_valid_pair_count,
    'distinctProposalLineCount', v_distinct_proposal_count,
    'distinctOperationalItemCount', v_distinct_operational_count,
    'sourceSnapshotsMatch', v_snapshots_ok AND v_valid_pair_count = v_manifest_count,
    'baselineStillPointsToProposal', v_baseline_ok,
    'economicsUnchanged', v_economics_ok
  );
END;
$$;

REVOKE ALL ON FUNCTION public.revalidate_contract_execution_item_link_manifest(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revalidate_contract_execution_item_link_manifest(JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.revalidate_contract_execution_item_link_manifest(JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.revalidate_contract_execution_item_link_manifest(JSONB) TO service_role;

-- Única fronteira prevista para a futura escrita. A revalidação e os
-- 300 INSERTs acontecem na mesma transação; qualquer falha reverte tudo.
CREATE OR REPLACE FUNCTION public.persist_contract_execution_item_links_manifest(
  p_actor_id UUID,
  p_approval_reference TEXT,
  p_manifest JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id UUID := (p_manifest->'scope'->>'organizationId')::UUID;
  v_project_id UUID := (p_manifest->'scope'->>'engineeringProjectId')::UUID;
  v_baseline_id UUID := (p_manifest->'scope'->>'contractBaselineId')::UUID;
  v_version_id UUID := (p_manifest->'scope'->>'proposalBudgetVersionId')::UUID;
  v_preflight JSONB;
  v_inserted_count INTEGER;
BEGIN
  IF p_actor_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_actor_id) THEN
    RAISE EXCEPTION 'A valid actor is required.' USING ERRCODE = '28000';
  END IF;
  IF length(trim(COALESCE(p_approval_reference, ''))) = 0 THEN
    RAISE EXCEPTION 'An explicit human approval reference is required.' USING ERRCODE = '22023';
  END IF;
  IF v_company_id IS DISTINCT FROM public.get_company_id_for_actor(p_actor_id)
     AND NOT public.is_bba_admin_actor(p_actor_id) THEN
    RAISE EXCEPTION 'Actor is not authorized for this organization.' USING ERRCODE = '42501';
  END IF;

  -- Bloqueios compartilhados evitam TOCTOU entre a validação e o INSERT.
  PERFORM 1 FROM public.contract_baselines WHERE id = v_baseline_id FOR SHARE;
  PERFORM 1 FROM public.budget_versions WHERE id = v_version_id FOR SHARE;
  PERFORM 1 FROM public.budget_lines
    WHERE budget_version_id = v_version_id AND kind = 'ServiceItem' FOR SHARE;
  PERFORM 1 FROM public.managed_service_items
    WHERE company_id = v_company_id AND engineering_project_id = v_project_id FOR SHARE;

  v_preflight := public.revalidate_contract_execution_item_link_manifest(p_manifest);
  IF COALESCE((v_preflight->>'ready')::BOOLEAN, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Persistence blocked by authoritative revalidation: %',
      v_preflight->'violations' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.contract_execution_item_links (
    company_id,
    engineering_project_id,
    contract_baseline_id,
    proposal_budget_version_id,
    proposal_budget_line_id,
    managed_service_item_id,
    match_method,
    evidence,
    validation_set_integrity_id,
    baseline_updated_at_snapshot,
    proposal_version_updated_at_snapshot,
    proposal_line_created_at_snapshot,
    operational_item_updated_at_snapshot,
    approval_reference,
    source_system,
    correlation_id,
    created_by
  )
  SELECT
    v_company_id,
    v_project_id,
    v_baseline_id,
    v_version_id,
    (link->'proposalLine'->>'id')::UUID,
    (link->'operationalItem'->>'id')::UUID,
    link->>'matchMethod',
    jsonb_build_object(
      'proposalLine', link->'proposalLine',
      'operationalItem', link->'operationalItem',
      'matchEvidence', link->'evidence',
      'validation', link->'validation',
      'externalCodesAreEvidenceOnly', true
    ),
    p_manifest->'integrity'->>'validationSetIntegrityId',
    (p_manifest->'sourceSnapshots'->>'contractBaselineUpdatedAt')::TIMESTAMPTZ,
    (p_manifest->'sourceSnapshots'->>'proposalBudgetVersionUpdatedAt')::TIMESTAMPTZ,
    (link->'proposalLine'->>'createdAtSnapshot')::TIMESTAMPTZ,
    (link->'operationalItem'->>'updatedAtSnapshot')::TIMESTAMPTZ,
    p_approval_reference,
    'lagoa-do-arroz-traceability-manifest-v1',
    p_manifest->>'manifestId',
    p_actor_id
  FROM jsonb_array_elements(p_manifest->'links') AS link;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  IF v_inserted_count <> 300 THEN
    RAISE EXCEPTION 'Atomic persistence expected 300 links but inserted %.', v_inserted_count
      USING ERRCODE = '23514';
  END IF;

  RETURN jsonb_build_object(
    'insertedCount', v_inserted_count,
    'integrityId', p_manifest->'integrity'->>'validationSetIntegrityId'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.persist_contract_execution_item_links_manifest(UUID, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.persist_contract_execution_item_links_manifest(UUID, TEXT, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.persist_contract_execution_item_links_manifest(UUID, TEXT, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.persist_contract_execution_item_links_manifest(UUID, TEXT, JSONB) TO service_role;

COMMENT ON TABLE public.contract_execution_item_links IS
  'Immutable internal-ID traceability from a contracted proposal service item to its existing operational service item. Codes and descriptions are audit evidence only.';
COMMENT ON FUNCTION public.revalidate_contract_execution_item_link_manifest(JSONB) IS
  'Read-only authoritative preflight. Blocks persistence on any cardinality, scope, snapshot, evidence, integrity or economic drift.';
COMMENT ON FUNCTION public.persist_contract_execution_item_links_manifest(UUID, TEXT, JSONB) IS
  'Service-role-only atomic persistence boundary. Requires explicit actor and human approval reference; performs full in-transaction revalidation before inserting exactly 300 links.';
