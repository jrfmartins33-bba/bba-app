-- ETAPA 3B — infraestrutura genérica de formalização e certificação de
-- medições. Esta migration é aditiva e foi preparada para revisão humana;
-- não altera linhas existentes, não gera boletins e não certifica medições.

-- 1. Proveniência decimal futura. quantity/unit_value/total_value continuam
-- NUMERIC (exatos no PostgreSQL); os novos campos registram a entrada bruta e
-- a política que produziu a representação canônica, sem reescrever histórico.
ALTER TABLE public.measurement_workspace_lines
  ADD COLUMN IF NOT EXISTS source_quantity_raw TEXT,
  ADD COLUMN IF NOT EXISTS canonical_quantity_scale SMALLINT,
  ADD COLUMN IF NOT EXISTS monetary_policy_key TEXT,
  ADD COLUMN IF NOT EXISTS monetary_scale SMALLINT;

ALTER TABLE public.measurement_workspace_lines
  ADD CONSTRAINT measurement_workspace_lines_canonical_quantity_scale_valid
    CHECK (canonical_quantity_scale IS NULL OR canonical_quantity_scale BETWEEN 0 AND 18),
  ADD CONSTRAINT measurement_workspace_lines_monetary_scale_valid
    CHECK (monetary_scale IS NULL OR monetary_scale BETWEEN 0 AND 18),
  ADD CONSTRAINT measurement_workspace_lines_monetary_policy_consistent
    CHECK (
      (monetary_policy_key IS NULL AND monetary_scale IS NULL)
      OR
      (length(trim(monetary_policy_key)) > 0 AND monetary_scale IS NOT NULL)
    );

COMMENT ON COLUMN public.measurement_workspace_lines.source_quantity_raw IS
  'Representação bruta recebida da origem antes da canonização decimal. Evidência apenas; quantity NUMERIC permanece o valor operacional canônico.';
COMMENT ON COLUMN public.measurement_workspace_lines.monetary_policy_key IS
  'Identificador genérico e explícito da política documental usada para quantizar total_value; nunca inferido por IA.';

-- A migration falha antes de instalar a nova infraestrutura se o conjunto já
-- persistido contiver alguma relação linha -> item fora do escopo relacional.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.measurement_workspace_lines mwl
    JOIN public.measurement_workspaces mw
      ON mw.id = mwl.measurement_workspace_id
    JOIN public.managed_service_items msi
      ON msi.id = mwl.managed_service_item_id
    WHERE mw.company_id IS DISTINCT FROM msi.company_id
       OR mw.engineering_project_id IS DISTINCT FROM msi.engineering_project_id
  ) THEN
    RAISE EXCEPTION 'Existing measurement workspace line crosses organization or project scope.'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_measurement_workspace_line_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.measurement_workspaces mw
    JOIN public.managed_service_items msi
      ON msi.id = NEW.managed_service_item_id
    WHERE mw.id = NEW.measurement_workspace_id
      AND mw.company_id = msi.company_id
      AND mw.engineering_project_id = msi.engineering_project_id
  ) THEN
    RAISE EXCEPTION 'Measurement line, workspace and operational item must belong to the same organization and project.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_measurement_workspace_line_scope_before_write
  ON public.measurement_workspace_lines;
CREATE TRIGGER enforce_measurement_workspace_line_scope_before_write
BEFORE INSERT OR UPDATE OF measurement_workspace_id, managed_service_item_id
ON public.measurement_workspace_lines
FOR EACH ROW
EXECUTE FUNCTION public.enforce_measurement_workspace_line_scope();

-- 2. Persistência do agregado MeasurementCycle já existente no domínio.
-- Os estados são exatamente os estados atuais; nenhum estado novo é criado.
CREATE TABLE public.measurement_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  engineering_project_id UUID NOT NULL REFERENCES public.engineering_projects(id) ON DELETE RESTRICT,
  contract_baseline_id UUID NOT NULL REFERENCES public.contract_baselines(id) ON DELETE RESTRICT,
  measurement_workspace_id UUID NOT NULL REFERENCES public.measurement_workspaces(id) ON DELETE RESTRICT,
  measurement_bulletin_id UUID REFERENCES public.measurement_bulletins(id) ON DELETE RESTRICT,
  period_number INTEGER NOT NULL CHECK (period_number > 0),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL CHECK (period_end >= period_start),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'measured', 'bulletin_generated', 'certified', 'closed')),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  evidence JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(evidence) = 'object'),
  CONSTRAINT measurement_cycles_workspace_once UNIQUE (measurement_workspace_id),
  CONSTRAINT measurement_cycles_bulletin_by_status CHECK (
    (status IN ('draft', 'measured') AND measurement_bulletin_id IS NULL)
    OR
    (status IN ('bulletin_generated', 'certified', 'closed') AND measurement_bulletin_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX measurement_cycles_bulletin_once_idx
  ON public.measurement_cycles (measurement_bulletin_id)
  WHERE measurement_bulletin_id IS NOT NULL;
CREATE INDEX measurement_cycles_company_id_idx
  ON public.measurement_cycles (company_id);
CREATE INDEX measurement_cycles_project_id_idx
  ON public.measurement_cycles (engineering_project_id);
CREATE INDEX measurement_cycles_baseline_id_idx
  ON public.measurement_cycles (contract_baseline_id);
CREATE INDEX measurement_cycles_status_idx
  ON public.measurement_cycles (status);

CREATE TABLE public.measurement_cycle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_cycle_id UUID NOT NULL REFERENCES public.measurement_cycles(id) ON DELETE RESTRICT,
  from_status TEXT CHECK (from_status IS NULL OR from_status IN ('draft', 'measured', 'bulletin_generated', 'certified', 'closed')),
  to_status TEXT NOT NULL CHECK (to_status IN ('draft', 'measured', 'bulletin_generated', 'certified', 'closed')),
  event_type TEXT NOT NULL CHECK (length(trim(event_type)) > 0),
  actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  occurred_at TIMESTAMPTZ NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(evidence) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX measurement_cycle_events_cycle_id_idx
  ON public.measurement_cycle_events (measurement_cycle_id, occurred_at);
CREATE INDEX measurement_cycle_events_actor_id_idx
  ON public.measurement_cycle_events (actor_id);

CREATE TABLE public.measurement_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_cycle_id UUID NOT NULL UNIQUE REFERENCES public.measurement_cycles(id) ON DELETE RESTRICT,
  measurement_bulletin_id UUID NOT NULL UNIQUE REFERENCES public.measurement_bulletins(id) ON DELETE RESTRICT,
  certified_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  certified_at TIMESTAMPTZ NOT NULL,
  evidence JSONB NOT NULL CHECK (jsonb_typeof(evidence) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX measurement_certifications_certified_by_idx
  ON public.measurement_certifications (certified_by);

-- 3. Relação mínima por linha formalizada. O item operacional continua vindo
-- da FK da linha do workspace; não há uma segunda correspondência paralela.
CREATE TABLE public.measurement_bulletin_line_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_bulletin_id UUID NOT NULL REFERENCES public.measurement_bulletins(id) ON DELETE RESTRICT,
  bulletin_line_id TEXT NOT NULL CHECK (length(trim(bulletin_line_id)) > 0),
  measurement_workspace_line_id UUID NOT NULL REFERENCES public.measurement_workspace_lines(id) ON DELETE RESTRICT,
  document_evidence JSONB NOT NULL CHECK (jsonb_typeof(document_evidence) = 'object'),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT measurement_bulletin_line_sources_line_once
    UNIQUE (measurement_bulletin_id, bulletin_line_id),
  CONSTRAINT measurement_bulletin_line_sources_source_once
    UNIQUE (measurement_bulletin_id, measurement_workspace_line_id)
);

CREATE INDEX measurement_bulletin_line_sources_workspace_line_idx
  ON public.measurement_bulletin_line_sources (measurement_workspace_line_id);
CREATE INDEX measurement_bulletin_line_sources_created_by_idx
  ON public.measurement_bulletin_line_sources (created_by);

CREATE OR REPLACE FUNCTION public.enforce_measurement_cycle_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status <> 'draft' THEN
    RAISE EXCEPTION 'A measurement cycle must be created in draft state.'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND NOT (
       (OLD.status = 'draft' AND NEW.status = 'measured')
       OR (OLD.status = 'measured' AND NEW.status = 'bulletin_generated')
       OR (OLD.status = 'bulletin_generated' AND NEW.status = 'certified')
       OR (OLD.status = 'certified' AND NEW.status = 'closed')
     ) THEN
    RAISE EXCEPTION 'Invalid persisted measurement cycle transition from % to %.', OLD.status, NEW.status
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.measurement_workspaces mw
    JOIN public.contract_baselines cb
      ON cb.id = NEW.contract_baseline_id
     AND cb.company_id = mw.company_id
     AND cb.engineering_project_id = mw.engineering_project_id
    WHERE mw.id = NEW.measurement_workspace_id
      AND mw.company_id = NEW.company_id
      AND mw.engineering_project_id = NEW.engineering_project_id
      AND mw.period_number = NEW.period_number
      AND mw.start_date = NEW.period_start
      AND mw.end_date = NEW.period_end
  ) THEN
    RAISE EXCEPTION 'Measurement cycle, baseline and source workspace must share organization, project and period.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.measurement_bulletin_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.measurement_bulletins mb
    WHERE mb.id = NEW.measurement_bulletin_id
      AND mb.company_id = NEW.company_id
      AND mb.engineering_project_id = NEW.engineering_project_id
      AND mb.measurement_workspace_id = NEW.measurement_workspace_id
      AND mb.status = 'Finalized'
  ) THEN
    RAISE EXCEPTION 'Measurement cycle bulletin must be the finalized bulletin for the same organization, project and workspace.'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.status IN ('certified', 'closed')
     AND NOT EXISTS (
       SELECT 1
       FROM public.measurement_certifications certification
       WHERE certification.measurement_cycle_id = NEW.id
         AND certification.measurement_bulletin_id = NEW.measurement_bulletin_id
     ) THEN
    RAISE EXCEPTION 'Certified and closed cycles require an immutable certification record.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_measurement_cycle_scope_before_write
BEFORE INSERT OR UPDATE ON public.measurement_cycles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_measurement_cycle_scope();

CREATE OR REPLACE FUNCTION public.enforce_measurement_certification_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.measurement_cycles mc
    WHERE mc.id = NEW.measurement_cycle_id
      AND mc.measurement_bulletin_id = NEW.measurement_bulletin_id
      AND mc.status = 'bulletin_generated'
      AND (
        mc.company_id = public.get_company_id_for_actor(NEW.certified_by)
        OR public.is_bba_admin_actor(NEW.certified_by)
      )
  ) THEN
    RAISE EXCEPTION 'Certification actor, cycle and finalized bulletin must share the authorized organization and project.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_measurement_certification_scope_before_insert
BEFORE INSERT ON public.measurement_certifications
FOR EACH ROW
EXECUTE FUNCTION public.enforce_measurement_certification_scope();

CREATE OR REPLACE FUNCTION public.enforce_measurement_bulletin_line_source_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.measurement_bulletins mb
    JOIN public.measurement_workspace_lines mwl
      ON mwl.id = NEW.measurement_workspace_line_id
     AND mwl.measurement_workspace_id = mb.measurement_workspace_id
    JOIN public.measurement_workspaces mw
      ON mw.id = mwl.measurement_workspace_id
    JOIN public.managed_service_items msi
      ON msi.id = mwl.managed_service_item_id
    WHERE mb.id = NEW.measurement_bulletin_id
      AND mb.status IN ('Draft', 'Validated')
      AND mw.status = 'Closed'
      AND mb.company_id = mw.company_id
      AND mb.company_id = msi.company_id
      AND mb.engineering_project_id = mw.engineering_project_id
      AND mb.engineering_project_id = msi.engineering_project_id
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(mb.lines) = 'array' THEN mb.lines ELSE '[]'::JSONB END
        ) AS formal_line
        WHERE formal_line->>'id' = NEW.bulletin_line_id
          AND formal_line->>'serviceItemId' = mwl.managed_service_item_id::TEXT
      )
  ) THEN
    RAISE EXCEPTION 'Formal bulletin line must reference its immutable source line and operational item in the same organization and project.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_measurement_bulletin_line_source_scope_before_insert
BEFORE INSERT ON public.measurement_bulletin_line_sources
FOR EACH ROW
EXECUTE FUNCTION public.enforce_measurement_bulletin_line_source_scope();

CREATE OR REPLACE FUNCTION public.block_measurement_formal_trace_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Formal measurement traceability and certification history are append-only.'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER block_measurement_bulletin_line_source_mutation
BEFORE UPDATE OR DELETE ON public.measurement_bulletin_line_sources
FOR EACH ROW EXECUTE FUNCTION public.block_measurement_formal_trace_mutation();
CREATE TRIGGER block_measurement_cycle_event_mutation
BEFORE UPDATE OR DELETE ON public.measurement_cycle_events
FOR EACH ROW EXECUTE FUNCTION public.block_measurement_formal_trace_mutation();
CREATE TRIGGER block_measurement_certification_mutation
BEFORE UPDATE OR DELETE ON public.measurement_certifications
FOR EACH ROW EXECUTE FUNCTION public.block_measurement_formal_trace_mutation();

CREATE OR REPLACE FUNCTION public.enforce_measurement_bulletin_traceability_before_finalization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_json_line_count INTEGER;
  v_source_count INTEGER;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.lines IS DISTINCT FROM OLD.lines
       AND EXISTS (
         SELECT 1 FROM public.measurement_bulletin_line_sources s
         WHERE s.measurement_bulletin_id = OLD.id
       ) THEN
      RAISE EXCEPTION 'Bulletin lines cannot change after relational sources are registered.'
        USING ERRCODE = '55000';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.status = 'Finalized' THEN
    RAISE EXCEPTION 'A bulletin must be created, linked to source lines, validated and only then finalized.'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.status = 'Finalized'
     AND OLD.status IS DISTINCT FROM 'Finalized' THEN
    IF jsonb_typeof(NEW.lines) <> 'array' THEN
      RAISE EXCEPTION 'Finalized bulletin lines must be a JSON array.'
        USING ERRCODE = '23514';
    END IF;

    v_json_line_count := jsonb_array_length(NEW.lines);
    SELECT count(*) INTO v_source_count
    FROM public.measurement_bulletin_line_sources s
    WHERE s.measurement_bulletin_id = NEW.id;

    IF v_json_line_count = 0 OR v_source_count <> v_json_line_count THEN
      RAISE EXCEPTION 'Every finalized bulletin line must have exactly one immutable relational source.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_measurement_bulletin_traceability_before_finalization
BEFORE INSERT ON public.measurement_bulletins
FOR EACH ROW
EXECUTE FUNCTION public.enforce_measurement_bulletin_traceability_before_finalization();

CREATE TRIGGER enforce_measurement_bulletin_traceability_before_update
BEFORE UPDATE OF status, lines ON public.measurement_bulletins
FOR EACH ROW
EXECUTE FUNCTION public.enforce_measurement_bulletin_traceability_before_finalization();

-- 4. Fronteiras atômicas de escrita para origem formal e ciclo.
CREATE OR REPLACE FUNCTION public.register_measurement_bulletin_line_sources(
  p_actor_id UUID,
  p_company_id UUID,
  p_measurement_bulletin_id UUID,
  p_links JSONB
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_link JSONB;
  v_inserted INTEGER := 0;
BEGIN
  IF p_company_id IS DISTINCT FROM public.get_company_id_for_actor(p_actor_id)
     AND NOT public.is_bba_admin_actor(p_actor_id) THEN
    RAISE EXCEPTION 'Actor is not authorized for the requested organization.'
      USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_links) <> 'array' OR jsonb_array_length(p_links) = 0 THEN
    RAISE EXCEPTION 'At least one formal bulletin line source is required.'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.measurement_bulletins mb
    WHERE mb.id = p_measurement_bulletin_id
      AND mb.company_id = p_company_id
      AND mb.status IN ('Draft', 'Validated')
  ) THEN
    RAISE EXCEPTION 'Bulletin is not available for source registration in this organization.'
      USING ERRCODE = '23514';
  END IF;

  FOR v_link IN SELECT value FROM jsonb_array_elements(p_links)
  LOOP
    INSERT INTO public.measurement_bulletin_line_sources (
      measurement_bulletin_id,
      bulletin_line_id,
      measurement_workspace_line_id,
      document_evidence,
      created_by
    ) VALUES (
      p_measurement_bulletin_id,
      v_link->>'bulletinLineId',
      (v_link->>'measurementWorkspaceLineId')::UUID,
      COALESCE(v_link->'documentEvidence', '{}'::JSONB),
      p_actor_id
    );
    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN v_inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_measurement_cycle(
  p_actor_id UUID,
  p_company_id UUID,
  p_engineering_project_id UUID,
  p_contract_baseline_id UUID,
  p_measurement_workspace_id UUID,
  p_occurred_at TIMESTAMPTZ,
  p_evidence JSONB DEFAULT '{}'::JSONB
) RETURNS public.measurement_cycles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_workspace public.measurement_workspaces%ROWTYPE;
  v_cycle public.measurement_cycles%ROWTYPE;
BEGIN
  IF p_company_id IS DISTINCT FROM public.get_company_id_for_actor(p_actor_id)
     AND NOT public.is_bba_admin_actor(p_actor_id) THEN
    RAISE EXCEPTION 'Actor is not authorized for the requested organization.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_workspace
  FROM public.measurement_workspaces mw
  WHERE mw.id = p_measurement_workspace_id
    AND mw.company_id = p_company_id
    AND mw.engineering_project_id = p_engineering_project_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source workspace does not belong to the requested organization and project.'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.measurement_cycles (
    company_id,
    engineering_project_id,
    contract_baseline_id,
    measurement_workspace_id,
    period_number,
    period_start,
    period_end,
    status,
    created_by,
    created_at,
    updated_at,
    evidence
  ) VALUES (
    p_company_id,
    p_engineering_project_id,
    p_contract_baseline_id,
    p_measurement_workspace_id,
    v_workspace.period_number,
    v_workspace.start_date,
    v_workspace.end_date,
    'draft',
    p_actor_id,
    p_occurred_at,
    p_occurred_at,
    p_evidence
  ) RETURNING * INTO v_cycle;

  INSERT INTO public.measurement_cycle_events (
    measurement_cycle_id, from_status, to_status, event_type,
    actor_id, occurred_at, evidence
  ) VALUES (
    v_cycle.id, NULL, 'draft', 'measurement_cycle_created',
    p_actor_id, p_occurred_at, p_evidence
  );

  RETURN v_cycle;
END;
$$;

CREATE OR REPLACE FUNCTION public.advance_measurement_cycle(
  p_actor_id UUID,
  p_company_id UUID,
  p_measurement_cycle_id UUID,
  p_to_status TEXT,
  p_occurred_at TIMESTAMPTZ,
  p_evidence JSONB DEFAULT '{}'::JSONB,
  p_measurement_bulletin_id UUID DEFAULT NULL
) RETURNS public.measurement_cycles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cycle public.measurement_cycles%ROWTYPE;
  v_expected_status TEXT;
BEGIN
  IF p_company_id IS DISTINCT FROM public.get_company_id_for_actor(p_actor_id)
     AND NOT public.is_bba_admin_actor(p_actor_id) THEN
    RAISE EXCEPTION 'Actor is not authorized for the requested organization.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_cycle
  FROM public.measurement_cycles mc
  WHERE mc.id = p_measurement_cycle_id
    AND mc.company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Measurement cycle was not found in the requested organization.'
      USING ERRCODE = '23514';
  END IF;

  v_expected_status := CASE v_cycle.status
    WHEN 'draft' THEN 'measured'
    WHEN 'measured' THEN 'bulletin_generated'
    WHEN 'bulletin_generated' THEN 'certified'
    WHEN 'certified' THEN 'closed'
    ELSE NULL
  END;

  IF p_to_status IS DISTINCT FROM v_expected_status THEN
    RAISE EXCEPTION 'Invalid measurement cycle transition from % to %.', v_cycle.status, p_to_status
      USING ERRCODE = '23514';
  END IF;

  IF p_to_status = 'bulletin_generated' THEN
    v_cycle.measurement_bulletin_id := p_measurement_bulletin_id;
  ELSIF p_measurement_bulletin_id IS NOT NULL
        AND p_measurement_bulletin_id IS DISTINCT FROM v_cycle.measurement_bulletin_id THEN
    RAISE EXCEPTION 'The formal bulletin identity cannot change after generation.'
      USING ERRCODE = '23514';
  END IF;

  IF p_to_status IN ('bulletin_generated', 'certified') AND NOT EXISTS (
    SELECT 1
    FROM public.measurement_bulletins mb
    WHERE mb.id = v_cycle.measurement_bulletin_id
      AND mb.company_id = v_cycle.company_id
      AND mb.engineering_project_id = v_cycle.engineering_project_id
      AND mb.measurement_workspace_id = v_cycle.measurement_workspace_id
      AND mb.status = 'Finalized'
  ) THEN
    RAISE EXCEPTION 'The cycle requires the finalized bulletin from its own workspace.'
      USING ERRCODE = '23514';
  END IF;

  IF p_to_status = 'certified' THEN
    INSERT INTO public.measurement_certifications (
      measurement_cycle_id,
      measurement_bulletin_id,
      certified_by,
      certified_at,
      evidence
    ) VALUES (
      v_cycle.id,
      v_cycle.measurement_bulletin_id,
      p_actor_id,
      p_occurred_at,
      p_evidence
    );
  END IF;

  UPDATE public.measurement_cycles
  SET status = p_to_status,
      measurement_bulletin_id = v_cycle.measurement_bulletin_id,
      updated_at = p_occurred_at
  WHERE id = v_cycle.id
  RETURNING * INTO v_cycle;

  INSERT INTO public.measurement_cycle_events (
    measurement_cycle_id, from_status, to_status, event_type,
    actor_id, occurred_at, evidence
  ) VALUES (
    v_cycle.id,
    CASE p_to_status
      WHEN 'measured' THEN 'draft'
      WHEN 'bulletin_generated' THEN 'measured'
      WHEN 'certified' THEN 'bulletin_generated'
      WHEN 'closed' THEN 'certified'
    END,
    p_to_status,
    'measurement_cycle_transition',
    p_actor_id,
    p_occurred_at,
    p_evidence
  );

  RETURN v_cycle;
END;
$$;

-- 5. Projeção oficial: somente ciclos Certified/Closed alimentam o
-- acumulado. Draft/Measured/BulletinGenerated e linhas só provisórias não
-- aparecem nesta projeção.
CREATE VIEW public.measurement_certified_item_period_totals
WITH (security_invoker = true)
AS
SELECT
  mc.company_id,
  mc.engineering_project_id,
  mc.contract_baseline_id,
  mc.id AS measurement_cycle_id,
  mc.period_number,
  mc.period_start,
  mc.period_end,
  mwl.managed_service_item_id,
  sum(mwl.quantity)::NUMERIC AS certified_period_quantity,
  sum(mwl.total_value)::NUMERIC AS certified_period_value
FROM public.measurement_cycles mc
JOIN public.measurement_certifications certification
  ON certification.measurement_cycle_id = mc.id
 AND certification.measurement_bulletin_id = mc.measurement_bulletin_id
JOIN public.measurement_bulletin_line_sources source_line
  ON source_line.measurement_bulletin_id = mc.measurement_bulletin_id
JOIN public.measurement_workspace_lines mwl
  ON mwl.id = source_line.measurement_workspace_line_id
 AND mwl.measurement_workspace_id = mc.measurement_workspace_id
WHERE mc.status IN ('certified', 'closed')
GROUP BY
  mc.company_id,
  mc.engineering_project_id,
  mc.contract_baseline_id,
  mc.id,
  mc.period_number,
  mc.period_start,
  mc.period_end,
  mwl.managed_service_item_id;

CREATE VIEW public.measurement_certified_item_balances
WITH (security_invoker = true)
AS
SELECT
  msi.company_id,
  msi.engineering_project_id,
  msi.id AS managed_service_item_id,
  msi.contract_quantity,
  msi.unit_price,
  (msi.contract_quantity * msi.unit_price)::NUMERIC AS contracted_value,
  COALESCE(sum(period_totals.certified_period_quantity), 0)::NUMERIC
    AS certified_accumulated_quantity,
  (msi.contract_quantity - COALESCE(sum(period_totals.certified_period_quantity), 0))::NUMERIC
    AS quantity_balance,
  COALESCE(sum(period_totals.certified_period_value), 0)::NUMERIC
    AS certified_accumulated_value,
  ((msi.contract_quantity * msi.unit_price) - COALESCE(sum(period_totals.certified_period_value), 0))::NUMERIC
    AS financial_balance
FROM public.managed_service_items msi
LEFT JOIN public.measurement_certified_item_period_totals period_totals
  ON period_totals.company_id = msi.company_id
 AND period_totals.engineering_project_id = msi.engineering_project_id
 AND period_totals.managed_service_item_id = msi.id
GROUP BY
  msi.company_id,
  msi.engineering_project_id,
  msi.id,
  msi.contract_quantity,
  msi.unit_price;

-- 6. Isolamento e privilégios mínimos. Leitura autenticada respeita RLS;
-- toda escrita nova ocorre somente pelas rotinas atômicas autorizadas.
ALTER TABLE public.measurement_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_cycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_bulletin_line_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY measurement_cycles_select_same_company
ON public.measurement_cycles FOR SELECT TO authenticated
USING (company_id = public.get_my_company_id() OR public.is_bba_admin());

CREATE POLICY measurement_cycle_events_select_same_company
ON public.measurement_cycle_events FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.measurement_cycles mc
  WHERE mc.id = measurement_cycle_events.measurement_cycle_id
    AND (mc.company_id = public.get_my_company_id() OR public.is_bba_admin())
));

CREATE POLICY measurement_certifications_select_same_company
ON public.measurement_certifications FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.measurement_cycles mc
  WHERE mc.id = measurement_certifications.measurement_cycle_id
    AND (mc.company_id = public.get_my_company_id() OR public.is_bba_admin())
));

CREATE POLICY measurement_bulletin_line_sources_select_same_company
ON public.measurement_bulletin_line_sources FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.measurement_bulletins mb
  WHERE mb.id = measurement_bulletin_line_sources.measurement_bulletin_id
    AND (mb.company_id = public.get_my_company_id() OR public.is_bba_admin())
));

REVOKE ALL ON TABLE public.measurement_cycles FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.measurement_cycle_events FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.measurement_certifications FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.measurement_bulletin_line_sources FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.measurement_cycles TO authenticated, service_role;
GRANT SELECT ON TABLE public.measurement_cycle_events TO authenticated, service_role;
GRANT SELECT ON TABLE public.measurement_certifications TO authenticated, service_role;
GRANT SELECT ON TABLE public.measurement_bulletin_line_sources TO authenticated, service_role;

REVOKE ALL ON TABLE public.measurement_certified_item_period_totals FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.measurement_certified_item_balances FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.measurement_certified_item_period_totals TO authenticated, service_role;
GRANT SELECT ON TABLE public.measurement_certified_item_balances TO authenticated, service_role;

ALTER FUNCTION public.register_measurement_bulletin_line_sources(UUID, UUID, UUID, JSONB) OWNER TO postgres;
ALTER FUNCTION public.create_measurement_cycle(UUID, UUID, UUID, UUID, UUID, TIMESTAMPTZ, JSONB) OWNER TO postgres;
ALTER FUNCTION public.advance_measurement_cycle(UUID, UUID, UUID, TEXT, TIMESTAMPTZ, JSONB, UUID) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.register_measurement_bulletin_line_sources(UUID, UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_measurement_cycle(UUID, UUID, UUID, UUID, UUID, TIMESTAMPTZ, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.advance_measurement_cycle(UUID, UUID, UUID, TEXT, TIMESTAMPTZ, JSONB, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_measurement_bulletin_line_sources(UUID, UUID, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_measurement_cycle(UUID, UUID, UUID, UUID, UUID, TIMESTAMPTZ, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.advance_measurement_cycle(UUID, UUID, UUID, TEXT, TIMESTAMPTZ, JSONB, UUID) TO service_role;
