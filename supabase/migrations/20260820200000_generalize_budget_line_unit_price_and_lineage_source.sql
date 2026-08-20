-- Migration: 20260820200000_generalize_budget_line_unit_price_and_lineage_source.sql
-- Epic 21 — Generalizacao do Preco Unitario de BudgetLine e Rastreabilidade entre BudgetVersions.
-- 1. Generaliza official_unit_price_cents -> unit_price_cents (rename backward-compatible).
-- 2. Adiciona source_budget_version_id em budget_version_lineage_relations.
-- 3. Atualiza enforce_lineage_relation_version_consistency (usa procurement_lot_id real).
-- 4. Remove assinatura legada de 9 parametros de persist_budget_version_snapshot.
-- 5. Remove assinatura legada de 14 parametros de create_budget_version_draft.
-- 6. Cria assinatura canonica de 15 parametros para create_budget_version_draft.
--
-- PRE-VERIFICACAO (executar antes de aplicar):
--   SELECT count(*) FROM public.budget_lines;
--   SELECT count(official_unit_price_cents) FROM public.budget_lines;
--   SELECT count(*) FROM public.budget_version_lineage_relations;
--
-- POS-VERIFICACAO (executar depois de aplicar):
--   SELECT count(*) FROM public.budget_lines;
--   SELECT count(unit_price_cents) FROM public.budget_lines;
--   SELECT count(*), count(source_budget_version_id) FROM public.budget_version_lineage_relations;

-- ===========================================================================
-- BLOCO 1: official_unit_price_cents -> unit_price_cents (budget_lines)
-- ===========================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'budget_lines' AND column_name = 'official_unit_price_cents'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'budget_lines' AND column_name = 'unit_price_cents'
  ) THEN
    ALTER TABLE public.budget_lines RENAME COLUMN official_unit_price_cents TO unit_price_cents;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'budget_lines' AND column_name = 'unit_price_cents'
  ) THEN
    ALTER TABLE public.budget_lines ADD COLUMN unit_price_cents BIGINT;
  END IF;
END $$;

ALTER TABLE public.budget_lines
  DROP CONSTRAINT IF EXISTS budget_lines_official_unit_price_check,
  DROP CONSTRAINT IF EXISTS budget_lines_unit_price_check,
  DROP CONSTRAINT IF EXISTS budget_lines_service_item_economics_check;

ALTER TABLE public.budget_lines
  ADD CONSTRAINT budget_lines_unit_price_check
    CHECK (unit_price_cents IS NULL OR unit_price_cents >= 0),
  ADD CONSTRAINT budget_lines_service_item_economics_check
    CHECK (
      kind = 'ServiceItem'
      OR (quantity_decimal IS NULL AND unit IS NULL AND unit_price_cents IS NULL)
    );

COMMENT ON COLUMN public.budget_lines.unit_price_cents IS
  'Preco unitario canonico em centavos exatos (oficial, proposta vencedora ou outra versao economica); nao representa custo interno e pode ser nulo em versoes historicas.';

-- ===========================================================================
-- BLOCO 2: source_budget_version_id em budget_version_lineage_relations
-- ===========================================================================

ALTER TABLE public.budget_version_lineage_relations
  ADD COLUMN IF NOT EXISTS source_budget_version_id UUID REFERENCES public.budget_versions(id);

CREATE INDEX IF NOT EXISTS budget_version_lineage_relations_source_budget_version_idx
  ON public.budget_version_lineage_relations (source_budget_version_id)
  WHERE source_budget_version_id IS NOT NULL;

-- ===========================================================================
-- BLOCO 3: enforce_lineage_relation_version_consistency
-- Usa procurement_lot_id (nome real da coluna em budget_versions).
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.enforce_lineage_relation_version_consistency() RETURNS TRIGGER AS $$
DECLARE
  v_source RECORD;
  v_dest RECORD;
BEGIN
  SELECT id, company_id, procurement_case_id, scope_kind, procurement_lot_id
  INTO v_dest
  FROM public.budget_versions
  WHERE id = NEW.budget_version_id AND company_id = NEW.company_id;

  IF v_dest.id IS NULL THEN
    RAISE EXCEPTION 'budget_version_lineage_relations.company_id must match the company_id of its budget_version_id';
  END IF;

  IF NEW.source_budget_version_id IS NOT NULL THEN
    IF NEW.source_budget_version_id = NEW.budget_version_id THEN
      RAISE EXCEPTION 'budget_version_lineage_relations: source_budget_version_id cannot be destination budget_version_id';
    END IF;

    SELECT id, company_id, procurement_case_id, scope_kind, procurement_lot_id
    INTO v_source
    FROM public.budget_versions
    WHERE id = NEW.source_budget_version_id;

    IF v_source.id IS NULL THEN
      RAISE EXCEPTION 'budget_version_lineage_relations: source_budget_version_id does not exist';
    END IF;

    IF v_source.company_id <> NEW.company_id THEN
      RAISE EXCEPTION 'budget_version_lineage_relations: cross-tenant lineage is not permitted';
    END IF;

    IF v_source.procurement_case_id <> v_dest.procurement_case_id THEN
      RAISE EXCEPTION 'budget_version_lineage_relations: source and destination must share the same procurement_case_id';
    END IF;

    IF v_source.scope_kind <> v_dest.scope_kind OR v_source.procurement_lot_id IS DISTINCT FROM v_dest.procurement_lot_id THEN
      RAISE EXCEPTION 'budget_version_lineage_relations: source and destination scopes are incompatible';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_lineage_relations_version_consistency ON public.budget_version_lineage_relations;
CREATE TRIGGER enforce_lineage_relations_version_consistency
BEFORE INSERT OR UPDATE ON public.budget_version_lineage_relations
FOR EACH ROW EXECUTE FUNCTION public.enforce_lineage_relation_version_consistency();

-- ===========================================================================
-- BLOCO 4: persist_budget_version_snapshot
-- Remove assinatura legada de 9 parametros. Mantem apenas a assinatura
-- canonica de 10 parametros (+ p_lineage_source_budget_version_id DEFAULT NULL).
-- ===========================================================================

DROP FUNCTION IF EXISTS public.persist_budget_version_snapshot(UUID, UUID, UUID, INTEGER, TEXT, JSONB, UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.persist_budget_version_snapshot(
  p_actor_id UUID,
  p_company_id UUID,
  p_budget_version_id UUID,
  p_expected_revision INTEGER,
  p_status TEXT,
  p_lines JSONB,
  p_lineage_id UUID,
  p_lineage_origin_kind TEXT,
  p_lineage_origin_reference TEXT,
  p_lineage_source_budget_version_id UUID DEFAULT NULL
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
    total_cents, quantity_decimal, unit, unit_price_cents, metadata
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
    COALESCE(NULLIF(line->>'unitPriceCents', ''), NULLIF(line->>'officialUnitPriceCents', ''))::BIGINT,
    COALESCE(line->'metadata', '{}'::JSONB)
  FROM jsonb_array_elements(p_lines) AS line;

  IF p_lineage_id IS NOT NULL THEN
    SELECT * INTO v_existing_lineage
    FROM public.budget_version_lineage_relations
    WHERE budget_version_id = p_budget_version_id;

    IF v_existing_lineage.id IS NULL THEN
      INSERT INTO public.budget_version_lineage_relations (
        id, company_id, budget_version_id, nature, origin_kind, origin_reference, source_budget_version_id
      ) VALUES (
        p_lineage_id, p_company_id, p_budget_version_id, 'Origin', p_lineage_origin_kind, p_lineage_origin_reference, p_lineage_source_budget_version_id
      );
    ELSIF v_existing_lineage.id = p_lineage_id
      AND v_existing_lineage.nature = 'Origin'
      AND v_existing_lineage.origin_kind = p_lineage_origin_kind
      AND v_existing_lineage.origin_reference IS NOT DISTINCT FROM p_lineage_origin_reference
      AND v_existing_lineage.source_budget_version_id IS NOT DISTINCT FROM p_lineage_source_budget_version_id
    THEN
      NULL;
    ELSE
      RAISE EXCEPTION 'Budget version already has a different origin lineage relation.' USING ERRCODE = '23505';
    END IF;
  END IF;

  RETURN jsonb_build_object('conflict', false, 'revision', v_new_revision);
END;
$$;

REVOKE ALL ON FUNCTION public.persist_budget_version_snapshot(UUID, UUID, UUID, INTEGER, TEXT, JSONB, UUID, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.persist_budget_version_snapshot(UUID, UUID, UUID, INTEGER, TEXT, JSONB, UUID, TEXT, TEXT, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.persist_budget_version_snapshot(UUID, UUID, UUID, INTEGER, TEXT, JSONB, UUID, TEXT, TEXT, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.persist_budget_version_snapshot(UUID, UUID, UUID, INTEGER, TEXT, JSONB, UUID, TEXT, TEXT, UUID) TO service_role;

-- ===========================================================================
-- BLOCO 5: create_budget_version_draft
-- Remove assinatura legada de 14 parametros. Cria assinatura canonica de 15
-- parametros com p_lineage_source_budget_version_id UUID DEFAULT NULL.
-- Preserva: verificacoes de actor, company, procurement case, scope, metadata,
-- revision, source_system e todos os invariantes existentes.
-- ===========================================================================

DROP FUNCTION IF EXISTS public.create_budget_version_draft(
  UUID, UUID, UUID, UUID, TEXT, UUID, TEXT, TEXT, JSONB, TEXT, TEXT, UUID, TEXT, TEXT
);

CREATE FUNCTION public.create_budget_version_draft(
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
  p_lineage_origin_reference TEXT,
  p_lineage_source_budget_version_id UUID DEFAULT NULL
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
    RAISE EXCEPTION 'Actor % is not authorized to create a Versao do Orcamento for this organizacao usuaria.', p_actor_id USING ERRCODE = '42501';
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
      id, company_id, budget_version_id, nature, origin_kind, origin_reference, source_budget_version_id
    ) VALUES (
      p_lineage_id, p_company_id, p_id, 'Origin', p_lineage_origin_kind, p_lineage_origin_reference, p_lineage_source_budget_version_id
    );
  END IF;

  RETURN jsonb_build_object('revision', v_revision);
END;
$$;

REVOKE ALL ON FUNCTION public.create_budget_version_draft(
  UUID, UUID, UUID, UUID, TEXT, UUID, TEXT, TEXT, JSONB, TEXT, TEXT, UUID, TEXT, TEXT, UUID
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_budget_version_draft(
  UUID, UUID, UUID, UUID, TEXT, UUID, TEXT, TEXT, JSONB, TEXT, TEXT, UUID, TEXT, TEXT, UUID
) FROM anon;
REVOKE ALL ON FUNCTION public.create_budget_version_draft(
  UUID, UUID, UUID, UUID, TEXT, UUID, TEXT, TEXT, JSONB, TEXT, TEXT, UUID, TEXT, TEXT, UUID
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_budget_version_draft(
  UUID, UUID, UUID, UUID, TEXT, UUID, TEXT, TEXT, JSONB, TEXT, TEXT, UUID, TEXT, TEXT, UUID
) TO service_role;

COMMENT ON FUNCTION public.create_budget_version_draft IS
  'Epic 21.3C (rev. 20260820200000) — operacao exclusiva de servidor. Persiste BudgetVersion em Draft e, quando fornecida, a Relacao de Rastreabilidade de origem incluindo source_budget_version_id para rastreabilidade de proposta -> oficial.';
