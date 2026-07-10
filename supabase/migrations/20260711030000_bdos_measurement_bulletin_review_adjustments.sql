-- Epic 19, Sprint 3 (Measurement Bulletin Import) — quatro ajustes da
-- revisão sobre 20260711000000_bdos_measurement_bulletin_import.sql
-- (já aplicada; não editada retroativamente). Ver
-- packages/bdos-core/docs/EPIC_19_SPRINT_3_PERSISTENCE_ARCHITECTURE.md,
-- seção "Ajustes da revisão final", para o raciocínio completo de
-- cada um. Um quinto ponto da revisão (company_id ausente em
-- measurement_workspace_lines) é deliberadamente NÃO alterado aqui —
-- ver a mesma seção do documento para a justificativa de mantê-lo
-- como está, sem benchmark que justifique a mudança agora.

-- AJUSTE 1: managed_service_items.code é cedo demais para ser único
-- por projeto. Códigos reais de boletim de medição variam por órgão
-- contratante (DNIT, DER, DNOCS, Codevasf, Seinfra, ...) de formas
-- que uma constraint rígida não antecipa (variações como "01.01A",
-- "01.01-B", "01.01 REV", ou o mesmo código reaproveitado entre
-- contratos diferentes com descrições diferentes). Removo a unicidade
-- sem remover o índice de apoio à consulta — não há evidência
-- suficiente para congelar essa regra antes de testar contra boletins
-- reais de múltiplos órgãos.
ALTER TABLE managed_service_items
  DROP CONSTRAINT IF EXISTS managed_service_items_engineering_project_id_code_key;

CREATE INDEX IF NOT EXISTS idx_managed_service_items_code ON managed_service_items (engineering_project_id, code);

-- AJUSTE 2: measurement_workspace_lines só guardava declared_total_value
-- (o valor financeiro que a planilha de origem imprimia), mas o Excel
-- de origem pode divergir em quantidade ou preço unitário, não só no
-- total. Sem declared_quantity/declared_unit_value, uma divergência
-- de quantidade "some" dentro do total combinado, tornando a análise
-- de boletim (achado da 19.0/19.2A) incompleta. As duas colunas novas
-- seguem o mesmo padrão de declared_total_value: nulas quando não há
-- divergência a registrar (ou quando a linha nasceu de lançamento
-- nativo, Caminho A, sem fonte externa a comparar).
ALTER TABLE measurement_workspace_lines
  ADD COLUMN IF NOT EXISTS declared_quantity NUMERIC,
  ADD COLUMN IF NOT EXISTS declared_unit_value NUMERIC;

COMMENT ON COLUMN measurement_workspace_lines.declared_quantity IS
  'Quantidade que a planilha de origem imprimia para esta linha, só para comparação/auditoria -- nunca a fonte de verdade. Nulo se não houver divergência a registrar ou se a linha nasceu de lançamento nativo (Caminho A).';

COMMENT ON COLUMN measurement_workspace_lines.declared_unit_value IS
  'Preço unitário que a planilha de origem imprimia para esta linha, só para comparação/auditoria -- nunca a fonte de verdade. Nulo se não houver divergência a registrar ou se a linha nasceu de lançamento nativo (Caminho A).';

-- AJUSTE 3: documentação explícita (nenhuma mudança de comportamento)
-- -- a constraint já aplicada (measurement_bulletins_finalized_at_consistent)
-- já cobre Validated implicitamente (só Finalized exige finalized_at
-- NOT NULL; Draft/Validated/Cancelled exigem NULL), mas isso nunca
-- tinha sido registrado em texto.
COMMENT ON CONSTRAINT measurement_bulletins_finalized_at_consistent ON measurement_bulletins IS
  'finalized_at só existe junto de status = Finalized. Draft, Validated e Cancelled exigem finalized_at IS NULL -- Validated não exige nem implica finalized_at, continua sendo um estado pré-finalização.';

-- AJUSTE 4: measurement_workspaces não tinha nenhuma proteção
-- equivalente ao trigger de measurement_bulletins -- um workspace
-- Closed (ou Cancelled) podia, em teoria, ser reaberto e editado,
-- gerando um segundo boletim a partir de um workspace que não é mais
-- o que gerou o primeiro. Decisão: Closed e Cancelled são terminais
-- para measurement_workspaces, mesma disciplina do boletim (sem
-- exceção para is_bba_admin()). Uma remedição real usa um novo
-- workspace, nunca reabre um já fechado.
CREATE OR REPLACE FUNCTION prevent_measurement_workspace_update_after_close()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IN ('Closed', 'Cancelled') THEN
    RAISE EXCEPTION
      'measurement_workspaces.id=%: closed or cancelled workspaces are immutable -- open a new workspace for further edits, never edit in place',
      OLD.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS measurement_workspaces_prevent_update_after_close ON measurement_workspaces;
CREATE TRIGGER measurement_workspaces_prevent_update_after_close
BEFORE UPDATE ON measurement_workspaces
FOR EACH ROW
EXECUTE FUNCTION prevent_measurement_workspace_update_after_close();
