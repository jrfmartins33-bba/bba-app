-- Epic 21.5A — Cenários de Proposta.
-- Aditiva: preserva versões históricas e fecha apenas a ponte econômica
-- canônica necessária para novas consolidações.

ALTER TABLE public.budget_lines
  ADD COLUMN IF NOT EXISTS quantity_decimal TEXT,
  ADD COLUMN IF NOT EXISTS unit TEXT,
  ADD COLUMN IF NOT EXISTS official_unit_price_cents BIGINT;

ALTER TABLE public.budget_lines
  DROP CONSTRAINT IF EXISTS budget_lines_quantity_decimal_check,
  DROP CONSTRAINT IF EXISTS budget_lines_unit_check,
  DROP CONSTRAINT IF EXISTS budget_lines_official_unit_price_check,
  DROP CONSTRAINT IF EXISTS budget_lines_service_item_economics_check;

ALTER TABLE public.budget_lines
  ADD CONSTRAINT budget_lines_quantity_decimal_check
    CHECK (quantity_decimal IS NULL OR quantity_decimal ~ '^\d+(\.\d{1,6})?$'),
  ADD CONSTRAINT budget_lines_unit_check
    CHECK (unit IS NULL OR length(trim(unit)) > 0),
  ADD CONSTRAINT budget_lines_official_unit_price_check
    CHECK (official_unit_price_cents IS NULL OR official_unit_price_cents >= 0),
  ADD CONSTRAINT budget_lines_service_item_economics_check
    CHECK (
      kind = 'ServiceItem'
      OR (quantity_decimal IS NULL AND unit IS NULL AND official_unit_price_cents IS NULL)
    );

COMMENT ON COLUMN public.budget_lines.quantity_decimal IS
  'Quantidade oficial exata em texto decimal canônico (até 6 casas), preservada sem float; nula em versões históricas sem esta ponte.';
COMMENT ON COLUMN public.budget_lines.unit IS
  'Unidade oficial do Item de Serviço; nula quando ausente na fonte ou em versões históricas.';
COMMENT ON COLUMN public.budget_lines.official_unit_price_cents IS
  'Preço unitário oficial em centavos exatos; não representa custo interno e pode ser nulo em versões históricas.';

-- Mantém a única fronteira de persistência de BudgetVersion, agora incluindo
-- os três campos econômicos aditivos no retrato atômico.
CREATE OR REPLACE FUNCTION public.persist_budget_version_snapshot(
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
  IF p_actor_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_actor_id) THEN
    RAISE EXCEPTION 'Valid actor is required.' USING ERRCODE = '28000';
  END IF;

  IF p_company_id IS DISTINCT FROM public.get_company_id_for_actor(p_actor_id)
     AND NOT public.is_bba_admin_actor(p_actor_id) THEN
    RAISE EXCEPTION 'Actor is not authorized for this organization.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.budget_versions
  SET status = p_status, revision = revision + 1
  WHERE id = p_budget_version_id
    AND company_id = p_company_id
    AND revision = p_expected_revision
  RETURNING revision INTO v_new_revision;

  IF v_new_revision IS NULL THEN
    RETURN jsonb_build_object('conflict', true);
  END IF;

  DELETE FROM public.budget_lines
  WHERE budget_version_id = p_budget_version_id AND company_id = p_company_id;

  INSERT INTO public.budget_lines (
    id, company_id, budget_version_id, kind, description_status, description_text,
    external_code, parent_line_id, position, scope_kind, scope_procurement_lot_id,
    total_cents, quantity_decimal, unit, official_unit_price_cents, metadata
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
    NULLIF(line->>'quantity', ''),
    NULLIF(line->>'unit', ''),
    NULLIF(line->>'officialUnitPriceCents', '')::BIGINT,
    COALESCE(line->'metadata', '{}'::JSONB)
  FROM jsonb_array_elements(p_lines) AS line;

  IF p_lineage_id IS NOT NULL THEN
    SELECT * INTO v_existing_lineage
    FROM public.budget_version_lineage_relations
    WHERE budget_version_id = p_budget_version_id;

    IF v_existing_lineage.id IS NULL THEN
      INSERT INTO public.budget_version_lineage_relations (
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
      RAISE EXCEPTION 'Budget version already has a different origin lineage relation.' USING ERRCODE = '23505';
    END IF;
  END IF;

  RETURN jsonb_build_object('conflict', false, 'revision', v_new_revision);
END;
$$;

REVOKE ALL ON FUNCTION public.persist_budget_version_snapshot(UUID, UUID, UUID, INTEGER, TEXT, JSONB, UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.persist_budget_version_snapshot(UUID, UUID, UUID, INTEGER, TEXT, JSONB, UUID, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.persist_budget_version_snapshot(UUID, UUID, UUID, INTEGER, TEXT, JSONB, UUID, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.persist_budget_version_snapshot(UUID, UUID, UUID, INTEGER, TEXT, JSONB, UUID, TEXT, TEXT) TO service_role;

CREATE TABLE public.proposal_scenarios (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_budget_version_id UUID NOT NULL REFERENCES public.budget_versions(id),
  source_budget_version_revision INTEGER NOT NULL CHECK (source_budget_version_revision >= 0),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  official_value_cents BIGINT NOT NULL CHECK (official_value_cents > 0),
  target_value_cents BIGINT NOT NULL CHECK (target_value_cents >= 0),
  difference_cents BIGINT NOT NULL CHECK (difference_cents >= 0),
  difference_basis_points NUMERIC(30, 0) NOT NULL CHECK (difference_basis_points >= 0),
  comparison_kind TEXT NOT NULL CHECK (comparison_kind IN ('Reduction', 'Increase', 'Equal')),
  calculation_method TEXT NOT NULL CHECK (calculation_method = 'target_value_v1'),
  parameters JSONB NOT NULL,
  result_snapshot JSONB NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL,
  CHECK (difference_cents = abs(official_value_cents - target_value_cents)),
  CHECK (
    (comparison_kind = 'Reduction' AND target_value_cents < official_value_cents)
    OR (comparison_kind = 'Increase' AND target_value_cents > official_value_cents)
    OR (comparison_kind = 'Equal' AND target_value_cents = official_value_cents)
  )
);

CREATE INDEX proposal_scenarios_company_created_idx
  ON public.proposal_scenarios (company_id, created_at DESC);
CREATE INDEX proposal_scenarios_source_created_idx
  ON public.proposal_scenarios (source_budget_version_id, created_at DESC);

ALTER TABLE public.proposal_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY proposal_scenarios_select_company_or_admin
ON public.proposal_scenarios FOR SELECT TO authenticated
USING (company_id = (SELECT public.get_my_company_id()) OR (SELECT public.is_bba_admin()));

REVOKE ALL ON TABLE public.proposal_scenarios FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.proposal_scenarios TO authenticated;
GRANT ALL ON TABLE public.proposal_scenarios TO service_role;

CREATE FUNCTION public.create_proposal_scenario(
  p_actor_id UUID,
  p_company_id UUID,
  p_id UUID,
  p_source_budget_version_id UUID,
  p_source_budget_version_revision INTEGER,
  p_name TEXT,
  p_official_value_cents BIGINT,
  p_target_value_cents BIGINT,
  p_difference_cents BIGINT,
  p_difference_basis_points TEXT,
  p_comparison_kind TEXT,
  p_calculation_method TEXT,
  p_created_at TIMESTAMPTZ
) RETURNS JSONB
SECURITY INVOKER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_source RECORD;
  v_actual_official NUMERIC;
  v_expected_basis_points NUMERIC;
  v_inserted public.proposal_scenarios;
BEGIN
  IF p_actor_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_actor_id) THEN
    RAISE EXCEPTION 'Valid actor is required.' USING ERRCODE = '28000';
  END IF;

  IF p_company_id IS DISTINCT FROM public.get_company_id_for_actor(p_actor_id)
     AND NOT public.is_bba_admin_actor(p_actor_id) THEN
    RAISE EXCEPTION 'Actor is not authorized for this organization.' USING ERRCODE = '42501';
  END IF;

  SELECT id, company_id, status, revision INTO v_source
  FROM public.budget_versions
  WHERE id = p_source_budget_version_id AND company_id = p_company_id;

  IF v_source.id IS NULL THEN
    RAISE EXCEPTION 'Source budget not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_source.status <> 'Consolidated' THEN
    RAISE EXCEPTION 'Source budget must be consolidated.' USING ERRCODE = '23514';
  END IF;
  IF v_source.revision <> p_source_budget_version_revision THEN
    RAISE EXCEPTION 'Source budget revision mismatch.' USING ERRCODE = '40001';
  END IF;

  SELECT COALESCE(sum(total_cents), 0) INTO v_actual_official
  FROM public.budget_lines
  WHERE budget_version_id = p_source_budget_version_id
    AND company_id = p_company_id
    AND kind = 'ServiceItem';

  IF v_actual_official <> p_official_value_cents OR p_official_value_cents <= 0 THEN
    RAISE EXCEPTION 'Official value does not match the consolidated source.' USING ERRCODE = '23514';
  END IF;

  v_expected_basis_points := round((p_difference_cents::NUMERIC * 10000) / p_official_value_cents);
  IF p_difference_cents <> abs(p_official_value_cents - p_target_value_cents)
     OR p_difference_basis_points::NUMERIC <> v_expected_basis_points THEN
    RAISE EXCEPTION 'Scenario calculation snapshot is inconsistent.' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.proposal_scenarios (
    id, company_id, source_budget_version_id, source_budget_version_revision,
    name, official_value_cents, target_value_cents, difference_cents,
    difference_basis_points, comparison_kind, calculation_method,
    parameters, result_snapshot, created_by, created_at
  ) VALUES (
    p_id, p_company_id, p_source_budget_version_id, p_source_budget_version_revision,
    trim(p_name), p_official_value_cents, p_target_value_cents, p_difference_cents,
    p_difference_basis_points::NUMERIC, p_comparison_kind, p_calculation_method,
    jsonb_build_object('authority', 'target_value_cents', 'targetValueCents', p_target_value_cents),
    jsonb_build_object(
      'officialValueCents', p_official_value_cents,
      'targetValueCents', p_target_value_cents,
      'differenceCents', p_difference_cents,
      'differenceBasisPoints', p_difference_basis_points,
      'comparisonKind', p_comparison_kind,
      'calculationMethod', p_calculation_method
    ),
    p_actor_id, p_created_at
  )
  RETURNING * INTO v_inserted;

  RETURN to_jsonb(v_inserted);
END;
$$;

REVOKE ALL ON FUNCTION public.create_proposal_scenario(UUID, UUID, UUID, UUID, INTEGER, TEXT, BIGINT, BIGINT, BIGINT, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_proposal_scenario(UUID, UUID, UUID, UUID, INTEGER, TEXT, BIGINT, BIGINT, BIGINT, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM anon;
REVOKE ALL ON FUNCTION public.create_proposal_scenario(UUID, UUID, UUID, UUID, INTEGER, TEXT, BIGINT, BIGINT, BIGINT, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_proposal_scenario(UUID, UUID, UUID, UUID, INTEGER, TEXT, BIGINT, BIGINT, BIGINT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO service_role;

COMMENT ON TABLE public.proposal_scenarios IS
  'Cenários de Proposta imutáveis, calculados deterministicamente a partir de uma BudgetVersion consolidada. Não são proposta submetida nem nova BudgetVersion.';

CREATE FUNCTION public.get_consolidated_budget_summary(p_company_id UUID)
RETURNS JSONB
SECURITY INVOKER
SET search_path = public, pg_temp
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_budget RECORD;
  v_total NUMERIC;
BEGIN
  IF p_company_id IS DISTINCT FROM public.get_my_company_id() AND NOT public.is_bba_admin() THEN
    RAISE EXCEPTION 'Not authorized for this organization.' USING ERRCODE = '42501';
  END IF;

  SELECT id, status, revision, updated_at INTO v_budget
  FROM public.budget_versions
  WHERE company_id = p_company_id AND status = 'Consolidated'
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_budget.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(sum(total_cents), 0) INTO v_total
  FROM public.budget_lines
  WHERE company_id = p_company_id
    AND budget_version_id = v_budget.id
    AND kind = 'ServiceItem';

  RETURN jsonb_build_object(
    'id', v_budget.id,
    'status', v_budget.status,
    'revision', v_budget.revision,
    'officialValueCents', v_total,
    'updatedAt', v_budget.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_consolidated_budget_summary(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_consolidated_budget_summary(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_consolidated_budget_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_consolidated_budget_summary(UUID) TO service_role;
