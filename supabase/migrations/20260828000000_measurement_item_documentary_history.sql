-- CAMADA B — Histórico documental item a item das MEMÓRIAS DE CÁLCULO
-- do Boletim de Medição. GRÃO DE OBSERVAÇÃO item × período/medição ×
-- campo semântico (v2), com proveniência de célula e classificação de
-- ambiguidade — NÃO é o "acumulado certificado no BDOS" (esse vive em
-- measurement_certified_item_balances) nem o cronograma
-- físico-financeiro (grupo a grupo, physical_financial_schedule_periods).
-- Ver packages/bdos-core/docs/MEASUREMENT_ITEM_DOCUMENTARY_HISTORY_SPEC.md
-- e packages/bdos-core/src/domain/measurement-item-documentary-history/.
--
-- ####################################################################
-- #  NÃO APLICAR NO SUPABASE SEM AUTORIZAÇÃO SEPARADA.               #
-- #  Aditiva: cria UMA tabela nova, não altera nenhuma linha         #
-- #  existente, não é populada por nenhum writer nesta rodada.       #
-- #  A ingestão exige verificação humana: as 177 abas do arquivo     #
-- #  real estão em CORTES DE MEDIÇÃO HETEROGÊNEOS (MED-01, 02, 04,   #
-- #  05, 06, 07, 08 — não há um acumulado item a item comum para     #
-- #  meses < junho/2026); "executada" ≠ "medida"; ~229 itens sem     #
-- #  histórico recuperável; 29 itens acima do contrato pendentes de  #
-- #  replanilhamento.                                                #
-- ####################################################################
--
-- Quantidades em NUMERIC (exatas no PostgreSQL), canonicalizadas à
-- escala do item ANTES da gravação -- nunca um float bruto da planilha.
-- Ausência documental = NULL, nunca 0.

CREATE TABLE IF NOT EXISTS public.measurement_item_documentary_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  engineering_project_id UUID NOT NULL REFERENCES public.engineering_projects(id) ON DELETE CASCADE,
  managed_service_item_id UUID NOT NULL REFERENCES public.managed_service_items(id) ON DELETE CASCADE,
  measurement_bulletin_import_id UUID NOT NULL REFERENCES public.measurement_bulletin_imports(id) ON DELETE CASCADE,

  item_code TEXT NOT NULL,
  unit TEXT,

  -- --- Eixo período/medição -----------------------------------------
  -- Nº da medição a que a observação se refere. Para
  -- 'quantity_to_measure_in_period' é o Nº da própria aba; para
  -- 'measured_accumulated_quantity_prior' é (Nº da aba − 1). NULL
  -- quando a aba não traz cabeçalho de medição legível.
  measurement_ref SMALLINT,
  -- Rótulo do mês/ano verbatim do cabeçalho da aba ("JUNHO / 2026").
  -- NUNCA usar o texto do mês para inferir o Nº da medição.
  measurement_period_label TEXT,
  -- Data ISO do período quando (e SOMENTE quando) resolvida a partir
  -- da grade "PERÍODO | QUANTIDADE" da aba (rara: ~2/177). NULL para
  -- observações do bloco RESUMO.
  period_date DATE,

  -- --- Campo semântico (taxonomia obrigatória) ---------------------
  semantic_field TEXT NOT NULL CHECK (semantic_field IN (
    'contract_quantity',
    'executed_accumulated_quantity',          -- execução física declarada; ≠ medida; pode superar o contrato
    'measured_accumulated_quantity_prior',    -- medida acumulada "em medições anteriores"
    'quantity_to_measure_in_period',          -- do período da PRÓPRIA aba
    'contract_balance_quantity',
    'monthly_series_quantity',                -- grade PERÍODO|QUANTIDADE
    'ambiguous'
  )),
  scope TEXT NOT NULL CHECK (scope IN ('period', 'accumulated_prior', 'contract', 'balance', 'unknown')),

  -- --- Valor documental -------------------------------------------------
  quantity_decimal NUMERIC(20, 6),
  -- Preço unitário do contrato usado para DERIVAR o valor (as memórias
  -- não trazem R$). NULL quando o item não foi resolvido.
  unit_price_decimal NUMERIC(20, 6),
  -- quantity_decimal × unit_price_decimal. SEMPRE derivado -> a flag
  -- value_is_derived é sempre true quando este campo não é NULL.
  value_decimal NUMERIC(20, 2),
  value_is_derived BOOLEAN NOT NULL DEFAULT true,
  -- true quando quantity_decimal veio de uma DIFERENÇA de acumulados
  -- (nunca lida direto). Hoje sempre false; reservado para quando os
  -- BMs anteriores forem importados.
  derived_from_cumulative BOOLEAN NOT NULL DEFAULT false,

  -- --- Confiabilidade / proveniência ---------------------------------
  layout TEXT NOT NULL CHECK (layout IN (
    'resumo_value_after_unit',
    'resumo_value_before_unit',
    'resumo_label_bleed',
    'resumo_with_ref_errors',
    'no_resumo_block',
    'not_item_memoria'
  )),
  numeric_format_hint TEXT NOT NULL DEFAULT 'ambiguous'
    CHECK (numeric_format_hint IN ('comma_decimal', 'dot_decimal', 'ambiguous')),
  -- true só quando a aba (layout + formato) e o campo são legíveis sem
  -- ambiguidade. Linhas com false NUNCA alimentam decisão automática
  -- nem saldo gerencial -- exigem revisão humana.
  is_unambiguous BOOLEAN NOT NULL DEFAULT false,
  reason_if_ambiguous TEXT,
  identity_basis TEXT NOT NULL DEFAULT 'documentary_code_only'
    CHECK (identity_basis IN ('operational_item_id', 'documentary_code_only', 'unresolved')),

  source_sheet_name TEXT NOT NULL,
  source_file_name TEXT NOT NULL,
  -- Endereços de célula da evidência (ex.: '01.02.01!RESUMO/Quantidade a medir no período').
  source_cells TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotência: uma observação por (item, boletim de origem, campo
-- semântico, Nº de medição de referência). Reimportar o mesmo boletim
-- faz ON CONFLICT DO UPDATE no writer futuro, nunca duplica. Dois
-- índices parciais porque measurement_ref é NULL para abas sem
-- cabeçalho legível (NULL não é comparável em UNIQUE comum).
CREATE UNIQUE INDEX IF NOT EXISTS measurement_item_documentary_history_grain_uniq
  ON public.measurement_item_documentary_history
     (managed_service_item_id, measurement_bulletin_import_id, semantic_field, measurement_ref)
  WHERE measurement_ref IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS measurement_item_documentary_history_grain_noref_uniq
  ON public.measurement_item_documentary_history
     (managed_service_item_id, measurement_bulletin_import_id, semantic_field, source_sheet_name)
  WHERE measurement_ref IS NULL;

CREATE INDEX IF NOT EXISTS measurement_item_documentary_history_project_idx
  ON public.measurement_item_documentary_history (engineering_project_id);
CREATE INDEX IF NOT EXISTS measurement_item_documentary_history_import_idx
  ON public.measurement_item_documentary_history (measurement_bulletin_import_id);

COMMENT ON TABLE public.measurement_item_documentary_history IS
  'Observações item × período/medição × campo semântico das memórias de cálculo (histórico documental item a item, grão v2). NÃO é o certificado BDOS nem o cronograma físico-financeiro. Quantidades canonicalizadas; valor sempre derivado (qtd × preço unitário do contrato). NÃO APLICADA.';
COMMENT ON COLUMN public.measurement_item_documentary_history.semantic_field IS
  'Taxonomia obrigatória: "executada" ≠ "medida", "no período" ≠ "acumulada". Campo ilegível -> ambiguous, e a linha não entra em saldo.';
COMMENT ON COLUMN public.measurement_item_documentary_history.is_unambiguous IS
  'false = extração incerta (label bleed / #REF! / formato numérico indecidível / campo ausente / layout atípico). Nunca alimenta decisão automática.';
COMMENT ON COLUMN public.measurement_item_documentary_history.derived_from_cumulative IS
  'true quando a quantidade veio de diferença de acumulados, nunca lida direto. Deve ser explícito para qualquer consumidor.';

-- RLS: mesma disciplina de measurement_certified_item_balances / planning_datasets.
ALTER TABLE public.measurement_item_documentary_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS measurement_item_documentary_history_select_company_or_admin ON public.measurement_item_documentary_history;
CREATE POLICY measurement_item_documentary_history_select_company_or_admin
ON public.measurement_item_documentary_history
FOR SELECT
TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS measurement_item_documentary_history_insert_company_or_admin ON public.measurement_item_documentary_history;
CREATE POLICY measurement_item_documentary_history_insert_company_or_admin
ON public.measurement_item_documentary_history
FOR INSERT
TO authenticated
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS measurement_item_documentary_history_update_company_or_admin ON public.measurement_item_documentary_history;
CREATE POLICY measurement_item_documentary_history_update_company_or_admin
ON public.measurement_item_documentary_history
FOR UPDATE
TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin())
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS measurement_item_documentary_history_delete_blocked ON public.measurement_item_documentary_history;
CREATE POLICY measurement_item_documentary_history_delete_blocked
ON public.measurement_item_documentary_history
FOR DELETE
TO authenticated
USING (false);
