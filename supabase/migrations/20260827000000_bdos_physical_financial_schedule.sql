-- Cronograma Físico-Financeiro oficial (DNOCS): Obra + Grupo, grão de
-- PERÍODO. Read model normalizado, derivado da Camada 2
-- (planning_datasets, detected_type = 'fisico-financeiro', schema v2),
-- para que a comparação "medição × planejamento" na tela Revisar
-- medição não dependa de reinterpretar JSON não canônico (artefatos de
-- ponto flutuante) a cada leitura.
--
-- PREPARADA PARA REVISÃO HUMANA. Esta migration é ADITIVA: cria uma
-- tabela nova, não altera nenhuma linha existente, não popula nada e
-- não é acionada por nenhum writer nesta rodada -- a ingestão a partir
-- do importador v2 é um passo seguinte, com autorização própria.
-- NÃO APLICAR NO SUPABASE SEM AUTORIZAÇÃO SEPARADA.
--
-- Valores monetários em NUMERIC (exatos no PostgreSQL), já
-- canonicalizados a centavos pela camada de decimal do domínio antes
-- da gravação -- nunca um float bruto da planilha. Percentuais
-- acumulados em pontos percentuais (0..100), duas casas.

CREATE TABLE IF NOT EXISTS public.physical_financial_schedule_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  engineering_project_id UUID NOT NULL REFERENCES public.engineering_projects(id) ON DELETE CASCADE,
  planning_dataset_id UUID NOT NULL REFERENCES public.planning_datasets(id) ON DELETE CASCADE,

  -- 'obra' = série agregada (pontos ACUMULADOS, verbatim das linhas
  -- "...ACUMULADO..." da planilha). 'group' = um grupo do cronograma
  -- (1.0 … 11.0), pontos MENSAIS; o acumulado é soma decimal exata.
  scope TEXT NOT NULL CHECK (scope IN ('obra', 'group')),
  group_code TEXT,
  group_name TEXT,

  period_index INT NOT NULL CHECK (period_index >= 0),
  period_label TEXT NOT NULL,
  period_date DATE,

  -- Valores NO PERÍODO (mensais). Só fazem sentido para scope='group';
  -- para scope='obra' a planilha traz o acumulado diretamente.
  planned_period_value NUMERIC(18, 2),
  actual_period_value NUMERIC(18, 2),

  -- Valores ACUMULADOS até o período (inclusive).
  planned_accumulated_value NUMERIC(18, 2),
  actual_accumulated_value NUMERIC(18, 2),

  -- Percentuais ACUMULADOS até o período, em pontos percentuais (0..100).
  planned_accumulated_percent NUMERIC(7, 2),
  actual_accumulated_percent NUMERIC(7, 2),

  -- Rastreabilidade documental.
  source_file_name TEXT,
  source_sheet_name TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT physical_financial_schedule_periods_group_shape CHECK (
    (scope = 'obra' AND group_code IS NULL)
    OR
    (scope = 'group' AND group_code IS NOT NULL AND group_code ~ '^[0-9]+\.0$')
  ),
  CONSTRAINT physical_financial_schedule_periods_percent_range CHECK (
    (planned_accumulated_percent IS NULL OR planned_accumulated_percent BETWEEN -1000 AND 1000)
    AND
    (actual_accumulated_percent IS NULL OR actual_accumulated_percent BETWEEN -1000 AND 1000)
  ),
  UNIQUE (planning_dataset_id, scope, group_code, period_index)
);

CREATE INDEX IF NOT EXISTS physical_financial_schedule_periods_project_idx
  ON public.physical_financial_schedule_periods (engineering_project_id, scope);

CREATE INDEX IF NOT EXISTS physical_financial_schedule_periods_dataset_idx
  ON public.physical_financial_schedule_periods (planning_dataset_id);

COMMENT ON TABLE public.physical_financial_schedule_periods IS
  'Read model normalizado do Cronograma Físico-Financeiro oficial (DNOCS): Obra + Grupo, grão de período. Derivado de planning_datasets (fisico-financeiro, schema v2). Imutável (só SELECT/INSERT). Valores monetários já canonicalizados a centavos -- nunca float bruto da planilha.';
COMMENT ON COLUMN public.physical_financial_schedule_periods.scope IS
  '''obra'' = série agregada da Curva S (pontos acumulados verbatim da planilha); ''group'' = grupo N.0 do cronograma (pontos mensais, acumulado somado a jusante).';
COMMENT ON COLUMN public.physical_financial_schedule_periods.planned_accumulated_value IS
  'Planejado acumulado até o período, em R$ exatos. Para scope=''group'' é a soma decimal das parcelas mensais PREVISTO -- nunca inferido do valor total do grupo (BAC) nem do percentual físico final.';

-- RLS: mesma disciplina de planning_datasets (Camada 2 imutável).
ALTER TABLE public.physical_financial_schedule_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS physical_financial_schedule_periods_select_company_or_admin ON public.physical_financial_schedule_periods;
CREATE POLICY physical_financial_schedule_periods_select_company_or_admin
ON public.physical_financial_schedule_periods
FOR SELECT
TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS physical_financial_schedule_periods_insert_company_or_admin ON public.physical_financial_schedule_periods;
CREATE POLICY physical_financial_schedule_periods_insert_company_or_admin
ON public.physical_financial_schedule_periods
FOR INSERT
TO authenticated
WITH CHECK (company_id = get_my_company_id() OR is_bba_admin());

DROP POLICY IF EXISTS physical_financial_schedule_periods_update_blocked ON public.physical_financial_schedule_periods;
CREATE POLICY physical_financial_schedule_periods_update_blocked
ON public.physical_financial_schedule_periods
FOR UPDATE
TO authenticated
USING (false);

DROP POLICY IF EXISTS physical_financial_schedule_periods_delete_blocked ON public.physical_financial_schedule_periods;
CREATE POLICY physical_financial_schedule_periods_delete_blocked
ON public.physical_financial_schedule_periods
FOR DELETE
TO authenticated
USING (false);
