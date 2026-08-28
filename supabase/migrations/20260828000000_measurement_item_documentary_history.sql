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
-- #  Fatos comprovados (arquivo real BM_08, universo = 300           #
-- #  managed_service_items):                                         #
-- #   - 177 abas de memória; 175 resolvem contra os 300 itens; 2     #
-- #     (01.07.09, 02.07.49) são códigos transpostos de 07.01.09 /   #
-- #     07.02.49 e ficam FORA até confirmação humana.                #
-- #   - cortes de medição heterogêneos (MED-01, 02, 04, 05, 06, 07,  #
-- #     08); NÃO há acumulado item a item comum para meses <         #
-- #     junho/2026 -> reconciliação anterior = insufficient_basis.   #
-- #   - 193 / 300 itens sem histórico documental recuperável.        #
-- #   - "executada" ≠ "medida" em 101 itens.                         #
-- #   - 29 itens com QUANTIDADE DOCUMENTAL acima da quantidade       #
-- #     contratada (observação factual — NÃO uma conclusão           #
-- #     operacional; gravados com flag, sem ajuste).                 #
-- ####################################################################
--
-- Quantidades em NUMERIC (exatas no PostgreSQL), canonicalizadas à
-- escala do item ANTES da gravação -- nunca um float bruto da planilha.
-- SÓ observações documentalmente INEQUÍVOCAS entram (CHECK abaixo);
-- as ambíguas continuam no parser/preview/relatório de exceções, nunca
-- nesta tabela.

CREATE TABLE IF NOT EXISTS public.measurement_item_documentary_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  engineering_project_id UUID NOT NULL REFERENCES public.engineering_projects(id) ON DELETE CASCADE,
  -- Identidade: SEMPRE o id operacional autoritativo. Vínculo por
  -- descrição/similaridade nunca é aceito; abas que não resolvem por
  -- código não viram linha. Por isso não há coluna `identity_basis` --
  -- a FK NOT NULL abaixo É a base de identidade.
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
  -- da grade "PERÍODO | QUANTIDADE" da aba (rara: 2/177). NULL para
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

  -- --- QUANTIDADE DOCUMENTAL ------------------------------------------
  -- O que a memória realmente traz. NOT NULL: só linhas com quantidade
  -- inequívoca entram (ausência documental fica FORA da tabela, no
  -- relatório de exceções).
  quantity_decimal NUMERIC(20, 6) NOT NULL,

  -- --- VALOR DERIVADO DE REFERÊNCIA ---------------------------------
  -- quantidade × preço unitário do contrato. NÃO é "valor documental" e
  -- NÃO é evidência de reconciliação financeira histórica -- as memórias
  -- não trazem R$. Só é preenchido quando há uma política monetária
  -- COMPROVADA; sem política, fica NULL.
  unit_price_decimal NUMERIC(20, 6),
  derived_reference_value_decimal NUMERIC(20, 2),
  -- Chave da política monetária usada no valor derivado -- rastreável.
  -- Para o BM08/Lagoa: 'source-document-truncation-to-cents'
  -- (scale 2, truncate toward zero). NÃO é default universal da tabela.
  derived_reference_monetary_policy_key TEXT,
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
  numeric_format_hint TEXT NOT NULL DEFAULT 'dot_decimal'
    CHECK (numeric_format_hint IN ('comma_decimal', 'dot_decimal', 'ambiguous')),
  -- SEMPRE true nesta tabela (ver CHECK abaixo). Mantida explícita para
  -- deixar a garantia visível a qualquer consumidor.
  is_unambiguous BOOLEAN NOT NULL DEFAULT true,
  reason_if_ambiguous TEXT,

  source_sheet_name TEXT NOT NULL,
  source_file_name TEXT NOT NULL,
  -- Endereços de célula da evidência (ex.: '01.02.01!RESUMO/Quantidade a medir no período').
  source_cells TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- SÓ OBSERVAÇÃO INEQUÍVOCA É PERSISTÍVEL. semantic_field = 'ambiguous'
  -- e is_unambiguous = false NUNCA geram linha (as 205 observações
  -- ambíguas da caracterização ficam de fora, reportadas à parte).
  CONSTRAINT measurement_item_documentary_history_unambiguous_only
    CHECK (is_unambiguous = true AND semantic_field <> 'ambiguous' AND numeric_format_hint <> 'ambiguous'),
  -- Se há valor derivado de referência, a política monetária tem de ser
  -- rastreável. Sem política comprovada, valor derivado = NULL.
  CONSTRAINT measurement_item_documentary_history_derived_needs_policy
    CHECK (derived_reference_value_decimal IS NULL OR derived_reference_monetary_policy_key IS NOT NULL)
);

-- Idempotência: uma observação por (item, boletim de origem, campo
-- semântico, Nº de medição de referência). Reimportar o mesmo boletim
-- faz ON CONFLICT DO UPDATE no processo de ingestão futuro, nunca
-- duplica. Dois índices parciais porque measurement_ref é NULL para
-- observações da grade PERÍODO|QUANTIDADE (NULL não é comparável em
-- UNIQUE comum).
CREATE UNIQUE INDEX IF NOT EXISTS measurement_item_documentary_history_grain_uniq
  ON public.measurement_item_documentary_history
     (managed_service_item_id, measurement_bulletin_import_id, semantic_field, measurement_ref)
  WHERE measurement_ref IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS measurement_item_documentary_history_grain_noref_uniq
  ON public.measurement_item_documentary_history
     (managed_service_item_id, measurement_bulletin_import_id, semantic_field, source_sheet_name, period_date)
  WHERE measurement_ref IS NULL;

CREATE INDEX IF NOT EXISTS measurement_item_documentary_history_project_idx
  ON public.measurement_item_documentary_history (engineering_project_id);
CREATE INDEX IF NOT EXISTS measurement_item_documentary_history_import_idx
  ON public.measurement_item_documentary_history (measurement_bulletin_import_id);

COMMENT ON TABLE public.measurement_item_documentary_history IS
  'Observações item × período/medição × campo semântico das memórias de cálculo (histórico documental item a item, grão v2). NÃO é o certificado BDOS nem o cronograma físico-financeiro. Só observações INEQUÍVOCAS. NÃO APLICADA.';
COMMENT ON COLUMN public.measurement_item_documentary_history.managed_service_item_id IS
  'Identidade autoritativa (id operacional). Nunca vínculo por descrição/similaridade. Abas que não resolvem por código não geram linha.';
COMMENT ON COLUMN public.measurement_item_documentary_history.quantity_decimal IS
  'QUANTIDADE DOCUMENTAL -- o que a memória traz, canonicalizada. NOT NULL: ausência documental fica fora da tabela.';
COMMENT ON COLUMN public.measurement_item_documentary_history.derived_reference_value_decimal IS
  'VALOR DERIVADO DE REFERÊNCIA = quantidade × preço unitário do contrato, sob a política de derived_reference_monetary_policy_key. NÃO é valor documental, NÃO reconcilia com a Curva S.';
COMMENT ON COLUMN public.measurement_item_documentary_history.derived_reference_monetary_policy_key IS
  'Chave da política monetária do valor derivado (rastreabilidade obrigatória). Sem política comprovada -> valor derivado NULL. Não é default da tabela.';
COMMENT ON COLUMN public.measurement_item_documentary_history.semantic_field IS
  'Taxonomia obrigatória: "executada" ≠ "medida", "no período" ≠ "acumulada". Linhas com semantic_field = ambiguous são proibidas pelo CHECK.';
COMMENT ON COLUMN public.measurement_item_documentary_history.is_unambiguous IS
  'Sempre true (CHECK). As observações incertas -- label bleed / #REF! / formato indecidível / campo ausente -- não entram nesta tabela.';
COMMENT ON COLUMN public.measurement_item_documentary_history.derived_from_cumulative IS
  'true quando a quantidade veio de diferença de acumulados, nunca lida direto. Explícito para qualquer consumidor.';

-- ============================================================
-- SEGURANÇA — privilégios explícitos de aplicação.
--   anon / PUBLIC .......... nenhum acesso.
--   authenticated .......... SELECT apenas, e ainda filtrado por RLS
--                            (própria empresa ou admin BBA). Nenhuma
--                            escrita.
--   service_role ........... SELECT + INSERT + UPDATE (processo de
--                            ingestão server-side, controlado). NÃO
--                            recebe DELETE -- o writer da aplicação
--                            nunca apaga evidência histórica.
-- RLS não se aplica a service_role; por isso o controle de escrita é
-- feito por GRANT/REVOKE, não só por policy. Nenhum writer é criado
-- nesta rodada.
-- ============================================================
ALTER TABLE public.measurement_item_documentary_history ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.measurement_item_documentary_history FROM PUBLIC;
REVOKE ALL ON public.measurement_item_documentary_history FROM anon;
REVOKE ALL ON public.measurement_item_documentary_history FROM authenticated;
REVOKE ALL ON public.measurement_item_documentary_history FROM service_role;

GRANT SELECT ON public.measurement_item_documentary_history TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.measurement_item_documentary_history TO service_role;
-- DELETE deliberadamente NÃO concedido a nenhum papel de aplicação.

-- RLS: leitura pela própria empresa ou admin BBA.
DROP POLICY IF EXISTS measurement_item_documentary_history_select_company_or_admin ON public.measurement_item_documentary_history;
CREATE POLICY measurement_item_documentary_history_select_company_or_admin
ON public.measurement_item_documentary_history
FOR SELECT
TO authenticated
USING (company_id = get_my_company_id() OR is_bba_admin());

-- Escrita pelo cliente: bloqueada também no nível de RLS (defesa em
-- profundidade, além do REVOKE acima).
DROP POLICY IF EXISTS measurement_item_documentary_history_insert_company_or_admin ON public.measurement_item_documentary_history;
DROP POLICY IF EXISTS measurement_item_documentary_history_update_company_or_admin ON public.measurement_item_documentary_history;

DROP POLICY IF EXISTS measurement_item_documentary_history_client_insert_blocked ON public.measurement_item_documentary_history;
CREATE POLICY measurement_item_documentary_history_client_insert_blocked
ON public.measurement_item_documentary_history
FOR INSERT
TO authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS measurement_item_documentary_history_client_update_blocked ON public.measurement_item_documentary_history;
CREATE POLICY measurement_item_documentary_history_client_update_blocked
ON public.measurement_item_documentary_history
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS measurement_item_documentary_history_delete_blocked ON public.measurement_item_documentary_history;
CREATE POLICY measurement_item_documentary_history_delete_blocked
ON public.measurement_item_documentary_history
FOR DELETE
TO authenticated
USING (false);
