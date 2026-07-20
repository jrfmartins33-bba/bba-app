import type { PhysicalCellHypothesis, PhysicalGridIntersectionWithCell } from "../physical-cell-hypothesis-formation/budget-document-physical-cell-hypothesis-formation.types";
import type { PhysicalCellTextEvidence } from "../physical-cell-text-evidence-formation/budget-document-physical-cell-text-evidence-formation.types";
import type { NeutralDocumentCell } from "./budget-document-page-local-neutral-structured-evidence-formation.types";
import { classifyCellStatus } from "./page-local-neutral-structured-evidence-formation-classifiers";

/**
 * Célula documental neutra (§15): reúne a hipótese física de célula (f.2c) e a
 * evidência textual (g.1) numa única posição, ambas materializadas por
 * referência (emenda 1). `rowOrder`/`columnOrder` vêm exclusivamente da
 * interseção física — nunca recalculados (a cadeia
 * `PhysicalColumnHypothesis.order → PhysicalGridIntersection.columnOrder →
 * NeutralDocumentCell.columnOrder` é preservada, nunca reinferida). Nenhum
 * texto concatenado, corrigido ou de apresentação é criado.
 *
 * Assume `cellHypothesis`/`textEvidence` já resolvidos e estruturalmente
 * consistentes com `intersection` — o chamador (`formNeutralDocumentPosition`)
 * é responsável por isolar qualquer ausência ou inconsistência como uma
 * célula `failed` via `formFailedNeutralDocumentCellShell`, nunca aqui.
 */
export function formNeutralDocumentCell(
  cellHypothesis: PhysicalCellHypothesis,
  intersection: PhysicalGridIntersectionWithCell,
  textEvidence: PhysicalCellTextEvidence,
): NeutralDocumentCell {
  return {
    cellHypothesisKey: cellHypothesis.cellHypothesisKey,
    gridIntersectionKey: cellHypothesis.gridIntersectionKey,
    rowOrder: intersection.rowOrder,
    columnOrder: intersection.columnOrder,
    status: classifyCellStatus(textEvidence.status, false),
    sourceTextEvidenceStatus: textEvidence.status,
    sourceCellHypothesis: cellHypothesis,
    sourceTextEvidence: textEvidence,
  };
}

/**
 * Shell auditável de célula `failed` (correção B1, §18/§22): produzido
 * quando a hipótese física de célula e/ou a evidência textual esperadas para
 * `intersection.cellHypothesisKey` não puderam ser localizadas ou
 * estruturalmente montadas. Preserva `cellHypothesisKey`/`gridIntersectionKey`/
 * `rowOrder`/`columnOrder` sempre a partir da própria interseção física (nunca
 * inventados) e preserva `sourceCellHypothesis`/`sourceTextEvidence`
 * individualmente sempre que cada um estiver disponível — nunca descarta o
 * que já se comprovou existente só porque o outro falhou. Isolada à célula:
 * nunca esvazia a posição, nunca deriva a linha ou a região para `failed`.
 */
export function formFailedNeutralDocumentCellShell(
  intersection: PhysicalGridIntersectionWithCell,
  cellHypothesis: PhysicalCellHypothesis | null,
  textEvidence: PhysicalCellTextEvidence | null,
): NeutralDocumentCell {
  return {
    cellHypothesisKey: intersection.cellHypothesisKey,
    gridIntersectionKey: intersection.gridIntersectionKey,
    rowOrder: intersection.rowOrder,
    columnOrder: intersection.columnOrder,
    status: "failed",
    sourceTextEvidenceStatus: textEvidence ? textEvidence.status : null,
    sourceCellHypothesis: cellHypothesis,
    sourceTextEvidence: textEvidence,
  };
}
