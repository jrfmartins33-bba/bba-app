-- Epic 19, Sprint 4D.0 (Schema Alignment) — duas adições aditivas,
-- ambas exigidas pela revisão de arquitetura registrada em
-- packages/bdos-core/docs/EPIC_19_SPRINT_4D_APPLICATION_SERVICE_DESIGN.md
-- (Parte XII, R1 e R2; Parte XIII para o parecer completo). Migration
-- exclusiva desta mudança de schema — nenhum repository, Application
-- Service ou outra alteração aqui.

-- R1 — measurement_workspace_lines ganha a origem física da linha
-- dentro do arquivo importado. Sem isso, a Invariante #5 do desenho
-- ("toda linha mantém rastreabilidade até a célula de origem") era
-- uma promessa não cumprida no schema, apesar de o parser já expor
-- `ParsedMeasurementLine.sourceLocation` (sheetName/rowNumber/
-- physicalColumn/financialColumn) desde a Sprint 4C. Nulo quando a
-- linha nasce de lançamento nativo (Caminho A, sem fonte externa) --
-- mesmo padrão de nulidade já usado para declared_quantity/
-- declared_unit_value/declared_total_value.
ALTER TABLE measurement_workspace_lines
  ADD COLUMN IF NOT EXISTS source_sheet_name TEXT,
  ADD COLUMN IF NOT EXISTS source_row_number INT,
  ADD COLUMN IF NOT EXISTS source_physical_column TEXT,
  ADD COLUMN IF NOT EXISTS source_financial_column TEXT;

ALTER TABLE measurement_workspace_lines
  ADD CONSTRAINT measurement_workspace_lines_source_row_number_positive
    CHECK (source_row_number IS NULL OR source_row_number > 0);

COMMENT ON COLUMN measurement_workspace_lines.source_sheet_name IS
  'Nome da aba do arquivo importado de onde esta linha foi extraída (ex.: "BM_08"). Nulo no Caminho A (lançamento nativo, sem fonte externa) ou quando o parser que originou a linha não expõe granularidade de aba.';

COMMENT ON COLUMN measurement_workspace_lines.source_row_number IS
  'Número da linha física dentro da aba de origem. Junto de source_sheet_name, permite a uma UI futura mostrar "esta linha veio da célula I244 do arquivo original" -- rastreabilidade até a célula, não só até o boletim.';

COMMENT ON COLUMN measurement_workspace_lines.source_physical_column IS
  'Referência da coluna física na planilha de origem (A, B, ..., AA, AB, ...), conforme interpretada pelo parser -- não um nome de campo, não restrita a uma única letra (parsers futuros de outros órgãos podem usar colunas além de Z). Indica de onde a quantidade/medição física desta linha foi lida. Nulo quando não aplicável ou não capturado pelo parser.';

COMMENT ON COLUMN measurement_workspace_lines.source_financial_column IS
  'Referência da coluna financeira na planilha de origem (A, B, ..., AA, AB, ...), conforme interpretada pelo parser -- mesma ressalva de source_physical_column: é a referência da coluna, não um nome de campo. Indica de onde o valor financeiro desta linha foi lido. Nulo quando não aplicável ou não capturado pelo parser.';

-- R2 — measurement_bulletin_imports ganha o resultado da análise de
-- reconciliação, para que `MeasurementAnalysisResult` sobreviva além
-- da resposta HTTP que o devolveu. Sem shape/CHECK estrutural sobre o
-- JSON (mesmo padrão já adotado para as demais colunas JSONB deste
-- schema, ex.: decision_snapshots.context_snapshot) -- a validação de
-- forma é responsabilidade do tipo TypeScript, não do banco.
--
-- Semântica obrigatória, não só o formato: esta coluna é um SNAPSHOT
-- IMUTÁVEL do resultado produzido por uma execução específica de
-- processMeasurementBulletinImport -- nunca "o estado atual" de algo
-- recalculável sob demanda. Uma retomada que produz um novo resultado
-- SUBSTITUI o snapshot anterior nesta mesma coluna (não acumula
-- histórico de execuções nesta sprint -- mesma dívida já registrada
-- na Parte VIII do desenho para measurement_bulletin_imports.status).
-- schemaVersion/parserKey existem exatamente para que, se o parser ou
-- o formato do resultado mudar no futuro (parser v2, por exemplo), um
-- snapshot produzido pela versão anterior continue interpretável como
-- o que era quando foi gravado, nunca reinterpretado como se tivesse
-- sido produzido pela versão atual.
--
-- Contrato do conteúdo (não imposto pelo Postgres, só documentado
-- aqui -- ver o tipo `MeasurementAnalysisResult` em
-- measurement-bulletin-import.types.ts para a forma completa):
--   - sempre inclui schemaVersion/parserKey/generatedAt, para que um
--     resultado antigo nunca seja mal interpretado como produzido
--     pelo parser/schema atual;
--   - é uma união discriminada por `status` -- 'reconciled' | 'needs_review'
--     sempre carregam measurementWorkspaceId; 'failed' pode ter
--     measurementWorkspaceId nulo (o gate de reconciliação pode
--     recusar antes de o workspace existir, em MODO FRESCO);
--   - é gravado sempre na MESMA atualização de linha que o status
--     final do import (completed/failed) -- nunca em duas escritas
--     separadas (correção 5 do desenho). Esta migration só cria a
--     coluna; a atomicidade da escrita é responsabilidade do
--     repository (Sprint 4D.1), não do schema.
ALTER TABLE measurement_bulletin_imports
  ADD COLUMN IF NOT EXISTS analysis_result JSONB;

COMMENT ON COLUMN measurement_bulletin_imports.analysis_result IS
  'Snapshot imutável de MeasurementAnalysisResult (união discriminada por status, com schemaVersion/parserKey/generatedAt obrigatórios) -- representa o resultado produzido por uma execução específica, não um estado atual recalculável; uma retomada que gera novo resultado substitui o snapshot anterior nesta mesma coluna. Gravado sempre na mesma atualização de linha que o status final (completed/failed), nunca em escrita separada. Nulo enquanto o import não terminou (pending_upload/uploaded/processing).';
