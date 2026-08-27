-- CAMADA B — Histórico documental item a item (memórias de cálculo do
-- Boletim de Medição). Snapshot POR ITEM POR BOLETIM do bloco RESUMO
-- das abas "MEMÓRIA DE CÁLCULO", com proveniência e classificação de
-- confiabilidade. NÃO é o "acumulado certificado no BDOS" (esse vive
-- em measurement_certified_item_balances) nem o cronograma
-- físico-financeiro (grupo a grupo). Ver
-- packages/bdos-core/docs/MEASUREMENT_ITEM_DOCUMENTARY_HISTORY_SPEC.md.
--
-- PREPARADA PARA REVISÃO HUMANA. Aditiva: cria uma tabela nova, não
-- altera nenhuma linha existente, não é populada por nenhum writer
-- nesta rodada. A ingestão exige verificação humana (formatos numéricos
-- heterogêneos, ~123 itens sem memória, "executada" ≠ "medida", itens
-- acima do contrato pendentes de replanilhamento).
-- NÃO APLICAR NO SUPABASE SEM AUTORIZAÇÃO SEPARADA.
--
-- Quantidades em NUMERIC (exatas no PostgreSQL), canonicalizadas à
-- escala do item ANTES da gravação -- nunca um float bruto da planilha.

CREATE TABLE IF NOT EXISTS public.measurement_item_documentary_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  engineering_project_id UUID NOT NULL REFERENCES public.engineering_projects(id) ON DELETE CASCADE,
  managed_service_item_id UUID NOT NULL REFERENCES public.managed_service_items(id) ON DELETE CASCADE,
  measurement_bulletin_import_id UUID NOT NULL REFERENCES public.measurement_bulletin_imports(id) ON DELETE CASCADE,

  item_code TEXT NOT NULL,
  unit TEXT,

  -- Campos SEMANTICAMENTE DISTINTOS do bloco RESUMO -- nunca derivados
  -- um do outro; ausência documental = NULL, nunca 0.
  contract_quantity NUMERIC(20, 6),
  -- "Quantidade executada acumulada atual" -- execução física declarada;
  -- pode divergir da medida e pode superar o contrato.
  executed_accumulated_quantity NUMERIC(20, 6),
  -- "Quantidade medida acumulada em medições anteriores" -- o que entrou
  -- em BM; candidato a "acumulado documental" do Controle Gerencial.
  measured_accumulated_quantity NUMERIC(20, 6),
  quantity_to_measure_in_period NUMERIC(20, 6),
  contract_balance_quantity NUMERIC(20, 6),

  -- Classificação de confiabilidade da extração.
  layout TEXT NOT NULL CHECK (layout IN (
    'resumo_value_after_unit',
    'resumo_value_before_unit',
    'resumo_label_bleed',
    'resumo_with_ref_errors',
    'no_resumo_block',
    'not_item_memoria'
  )),
  -- true só quando contratada + medida acumulada + a medir foram lidas
  -- de forma inequívoca. Linhas com false NÃO devem alimentar decisão
  -- automática -- exigem revisão humana.
  unambiguous BOOLEAN NOT NULL DEFAULT false,

  source_sheet_name TEXT NOT NULL,
  source_file_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Uma linha por (item, boletim de origem). Reimportar o mesmo boletim
-- substitui a linha (estratégia de idempotência: ON CONFLICT DO UPDATE
-- no writer futuro), nunca duplica.
CREATE UNIQUE INDEX IF NOT EXISTS measurement_item_documentary_history_item_import_uniq
  ON public.measurement_item_documentary_history (managed_service_item_id, measurement_bulletin_import_id);

CREATE INDEX IF NOT EXISTS measurement_item_documentary_history_project_idx
  ON public.measurement_item_documentary_history (engineering_project_id);

COMMENT ON TABLE public.measurement_item_documentary_history IS
  'Snapshot por item por boletim do bloco RESUMO das memórias de cálculo (histórico documental item a item). NÃO é o certificado BDOS nem o cronograma físico-financeiro. Quantidades já canonicalizadas -- nunca float bruto.';
COMMENT ON COLUMN public.measurement_item_documentary_history.executed_accumulated_quantity IS
  '"Quantidade executada acumulada atual" -- distinta de measured_accumulated_quantity; nunca normalizar as duas como se fossem o mesmo campo.';
COMMENT ON COLUMN public.measurement_item_documentary_history.unambiguous IS
  'false = extração incerta (label bleed / #REF! / campos ausentes / layout atípico). Nunca alimenta decisão automática.';

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
