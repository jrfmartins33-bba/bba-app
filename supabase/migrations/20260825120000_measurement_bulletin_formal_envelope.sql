-- ============================================================================
-- ETAPA 3C.1C: Persistência Integral do Envelope Formal do Boletim de Medição
-- Migration: 20260825120000_measurement_bulletin_formal_envelope.sql
--
-- Motivação:
-- O domínio rico de boletins de medição (packages/bdos-core/src/domain/bulletin-generator)
-- produz um documento formal completo contendo referência canônica, cabeçalho
-- contratual (incluindo responsável técnico e data de emissão formal), contexto decimal /
-- política monetária comprovada, histórico de transições (trace) e metadados.
--
-- Esta migration adiciona suporte estrutural na tabela public.measurement_bulletins
-- para persistir e reconstruir deterministicamente todo o envelope do domínio,
-- garantindo conformidade documental, auditoria estrita e impedindo divergências
-- entre os dados relacionais e o snapshot canônico persistido.
-- ============================================================================

-- 1. Colunas aditivas para preservação do envelope formal completo
ALTER TABLE public.measurement_bulletins
  ADD COLUMN IF NOT EXISTS reference JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(reference) = 'object'),
  ADD COLUMN IF NOT EXISTS header JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(header) = 'object'),
  ADD COLUMN IF NOT EXISTS decimal_context JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(decimal_context) = 'object'),
  ADD COLUMN IF NOT EXISTS trace JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(trace) = 'array'),
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object');

-- 2. Comentários explicativos para fins de auditoria e conformidade técnica
COMMENT ON COLUMN public.measurement_bulletins.reference IS
  'Envelope da referência de origem do domínio (ex: workspace de medição, tipo, identificador, código e nome). Preservado verbatim para reconstrução determinística.';

COMMENT ON COLUMN public.measurement_bulletins.header IS
  'Cabeçalho formal aprovado pelo domínio (contrato, obra, período, datas de início/fim, data de emissão canônica e responsável técnico formal da contratada).';

COMMENT ON COLUMN public.measurement_bulletins.decimal_context IS
  'Contexto decimal e política monetária comprovada (escalas de quantidade/valor unitário, chave e modo de quantização monetária). Permite auditar deterministicamente qualquer cálculo.';

COMMENT ON COLUMN public.measurement_bulletins.trace IS
  'Trilha imutável de eventos de ciclo de vida do domínio do boletim (criação, validação, finalização, etc.), com carimbo de tempo, ator e descrição.';

COMMENT ON COLUMN public.measurement_bulletins.metadata IS
  'Metadados extensíveis do envelope formal (correlationId, sistema de origem, criador, etc.).';

-- 3. Função e Trigger de Consistência entre Snapshot Formal e Colunas Relacionais
--
-- Correção (revisão pós-3C.1C): a versão anterior desta função só
-- validava um campo do envelope "se presente" (`IF NEW.header <>
-- '{}'::jsonb THEN ...`) -- um header/reference literalmente vazio
-- (`{}`) contornava toda a obrigatoriedade, inclusive a do
-- responsável técnico formal. O domínio (bulletin-generator) já exige
-- reference.id, header.projectId/periodNumber/issueDate/
-- technicalResponsibleId/technicalResponsibleName e decimalContext
-- completos desde a criação do boletim (createMeasurementBulletin,
-- ainda em status Draft) -- portanto esta função agora EXIGE e
-- CONFRONTA cada campo material incondicionalmente, em qualquer
-- status, sem nenhum gate de "se não estiver vazio". Ausência nunca é
-- tratada como "não há nada para comparar": é sempre rejeição.
CREATE OR REPLACE FUNCTION public.enforce_measurement_bulletin_envelope_consistency()
RETURNS trigger
SECURITY INVOKER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_header_project_id TEXT;
  v_header_period_number TEXT;
  v_header_issue_date TEXT;
  v_header_tech_id TEXT;
  v_header_tech_name TEXT;
  v_ref_id TEXT;
  v_meta_org_id TEXT;
BEGIN
  -- Referência: obrigatória e materialmente completa sempre -- {} não
  -- é uma referência válida, nunca contorna a exigência de reference.id.
  v_ref_id := NEW.reference->>'id';
  IF v_ref_id IS NULL OR trim(v_ref_id) = '' THEN
    RAISE EXCEPTION 'Boletim %: reference.id é obrigatório e não pode estar ausente ou vazio (envelope formal incompleto)',
      NEW.id
      USING ERRCODE = '23514';
  END IF;
  IF v_ref_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
    RAISE EXCEPTION 'Boletim %: reference.id (%) não é um identificador válido (esperado o UUID do measurement_workspace)',
      NEW.id, v_ref_id
      USING ERRCODE = '23514';
  END IF;
  IF v_ref_id::uuid <> NEW.measurement_workspace_id THEN
    RAISE EXCEPTION 'Divergência no Boletim %: reference.id (%) não coincide com measurement_workspace_id (%)',
      NEW.id, v_ref_id, NEW.measurement_workspace_id
      USING ERRCODE = '23514';
  END IF;

  -- Cabeçalho: obrigatório e materialmente completo sempre -- {} não
  -- é um cabeçalho válido, nunca contorna projectId/periodNumber/
  -- issueDate/responsável técnico.
  v_header_project_id := NEW.header->>'projectId';
  v_header_period_number := NEW.header->>'periodNumber';
  v_header_issue_date := NEW.header->>'issueDate';
  v_header_tech_id := NEW.header->>'technicalResponsibleId';
  v_header_tech_name := NEW.header->>'technicalResponsibleName';

  -- Consistência da Obra / Projeto
  IF v_header_project_id IS NULL OR trim(v_header_project_id) = '' THEN
    RAISE EXCEPTION 'Boletim %: header.projectId é obrigatório e não pode estar ausente ou vazio (envelope formal incompleto)',
      NEW.id
      USING ERRCODE = '23514';
  END IF;
  IF v_header_project_id::uuid <> NEW.engineering_project_id THEN
    RAISE EXCEPTION 'Divergência no Boletim %: header.projectId (%) não coincide com engineering_project_id (%)',
      NEW.id, v_header_project_id, NEW.engineering_project_id
      USING ERRCODE = '23514';
  END IF;

  -- Consistência do Número do Período
  IF v_header_period_number IS NULL OR trim(v_header_period_number) = '' THEN
    RAISE EXCEPTION 'Boletim %: header.periodNumber é obrigatório e não pode estar ausente ou vazio (envelope formal incompleto)',
      NEW.id
      USING ERRCODE = '23514';
  END IF;
  IF (v_header_period_number::int) <> NEW.period_number THEN
    RAISE EXCEPTION 'Divergência no Boletim %: header.periodNumber (%) não coincide com period_number (%)',
      NEW.id, v_header_period_number, NEW.period_number
      USING ERRCODE = '23514';
  END IF;

  -- Consistência da Data de Emissão Canônica
  IF v_header_issue_date IS NULL OR trim(v_header_issue_date) = '' THEN
    RAISE EXCEPTION 'Boletim %: header.issueDate é obrigatório e não pode estar ausente ou vazio (envelope formal incompleto)',
      NEW.id
      USING ERRCODE = '23514';
  END IF;
  IF (v_header_issue_date::date) <> NEW.issue_date THEN
    RAISE EXCEPTION 'Divergência no Boletim %: header.issueDate (%) não coincide com issue_date (%)',
      NEW.id, v_header_issue_date, NEW.issue_date
      USING ERRCODE = '23514';
  END IF;

  -- Obrigatoriedade do Responsável Técnico Formal -- sempre, em
  -- qualquer status (não apenas Validated/Finalized): o domínio já
  -- exige os dois campos na criação do boletim, então um boletim novo
  -- sem eles nunca é um envelope legítimo, em nenhum status.
  IF v_header_tech_id IS NULL OR trim(v_header_tech_id) = '' THEN
    RAISE EXCEPTION 'Boletim %: header.technicalResponsibleId é obrigatório e não pode estar ausente ou vazio (envelope formal incompleto)',
      NEW.id
      USING ERRCODE = '23514';
  END IF;
  IF v_header_tech_name IS NULL OR trim(v_header_tech_name) = '' THEN
    RAISE EXCEPTION 'Boletim %: header.technicalResponsibleName é obrigatório e não pode estar ausente ou vazio (envelope formal incompleto)',
      NEW.id
      USING ERRCODE = '23514';
  END IF;

  -- Contexto decimal: obrigatório e materialmente completo sempre --
  -- {} não é um contexto decimal válido.
  IF NEW.decimal_context->>'quantityScale' IS NULL
     OR NEW.decimal_context->>'unitValueScale' IS NULL
     OR NEW.decimal_context->'monetaryPolicy' IS NULL THEN
    RAISE EXCEPTION 'Boletim %: decimal_context é obrigatório e materialmente incompleto (quantityScale, unitValueScale e monetaryPolicy são exigidos)',
      NEW.id
      USING ERRCODE = '23514';
  END IF;

  -- Se metadata tiver organizationId ou companyId, valida consistência com company_id
  v_meta_org_id := COALESCE(NEW.metadata->>'organizationId', NEW.metadata->>'companyId');
  IF v_meta_org_id IS NOT NULL AND v_meta_org_id <> '' THEN
    IF v_meta_org_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
      IF v_meta_org_id::uuid <> NEW.company_id THEN
        RAISE EXCEPTION 'Divergência no Boletim %: metadata.organizationId (%) não coincide com company_id (%)',
          NEW.id, v_meta_org_id, NEW.company_id
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_measurement_bulletin_envelope_consistency ON public.measurement_bulletins;
CREATE TRIGGER trg_enforce_measurement_bulletin_envelope_consistency
  BEFORE INSERT OR UPDATE ON public.measurement_bulletins
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_measurement_bulletin_envelope_consistency();
