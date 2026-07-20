import type { PhysicalCellHypothesis, PhysicalGridIntersection } from "../physical-cell-hypothesis-formation/budget-document-physical-cell-hypothesis-formation.types";
import type { PhysicalCellTextEvidence } from "../physical-cell-text-evidence-formation/budget-document-physical-cell-text-evidence-formation.types";
import type { NeutralDocumentPosition, PageLocalNeutralStructuredEvidenceFormationTechnicalProblem } from "./budget-document-page-local-neutral-structured-evidence-formation.types";
import { mapIntersectionToPositionStatus } from "./page-local-neutral-structured-evidence-formation-classifiers";
import { formFailedNeutralDocumentCellShell, formNeutralDocumentCell } from "./form-neutral-document-cell";
import { problem } from "./page-local-neutral-structured-evidence-formation-technical-problem";

export interface PositionFormationContext {
  readonly groupKey: string;
  readonly pageNumber: number;
  readonly regionKey: string;
  readonly lineKey: string;
}

export interface PositionFormationOutcome {
  readonly position: NeutralDocumentPosition;
  readonly problems: ReadonlyArray<PageLocalNeutralStructuredEvidenceFormationTechnicalProblem>;
}

/**
 * Posição documental (§14): cada interseção física origina EXATAMENTE UMA
 * posição, com a interseção completa materializada por referência (emenda 1).
 * Vazios, ambiguidades e falhas são preservados integralmente, sem célula.
 * Nenhuma posição sintética é criada quando não há interseção (isso é tratado
 * fora daqui, no nível da linha).
 *
 * Correção B1 (§18/§22): quando a interseção formou célula mas a hipótese
 * física e/ou a evidência textual correspondentes não puderem ser localizadas
 * ou montadas com segurança, a posição PERMANECE `cell_structured` (nunca
 * `empty` — a interseção legitimamente formou célula) e carrega uma célula em
 * estado `failed` (`formFailedNeutralDocumentCellShell`), registrando
 * `neutral_cell_formation_failed` com a granularidade completa (grupo,
 * página, região, linha, interseção, célula). A falha nunca escapa desta
 * função como exceção nesse caso — é sempre isolada aqui, no nível da célula.
 * Nunca propaga `Error.message` bruto: a mensagem é sempre a mensagem
 * controlada do catálogo (`problem()`).
 */
export function formNeutralDocumentPosition(
  intersection: PhysicalGridIntersection,
  cellHypothesisByKey: ReadonlyMap<string, PhysicalCellHypothesis>,
  textEvidenceByCellKey: ReadonlyMap<string, PhysicalCellTextEvidence>,
  context: PositionFormationContext,
): PositionFormationOutcome {
  const identity = {
    gridIntersectionKey: intersection.gridIntersectionKey,
    sourceLineKey: intersection.sourceLineKey,
    rowOrder: intersection.rowOrder,
    columnOrder: intersection.columnOrder,
    sourceGridIntersection: intersection,
  } as const;

  if (intersection.status === "cell_hypothesis_formed") {
    const cellHypothesis = cellHypothesisByKey.get(intersection.cellHypothesisKey) ?? null;
    const textEvidence = textEvidenceByCellKey.get(intersection.cellHypothesisKey) ?? null;
    const cellProblemFields = { groupKey: context.groupKey, pageNumber: context.pageNumber, regionKey: context.regionKey, lineKey: context.lineKey, gridIntersectionKey: intersection.gridIntersectionKey, cellHypothesisKey: intersection.cellHypothesisKey };
    if (cellHypothesis && textEvidence) {
      try {
        return { position: { ...identity, status: "cell_structured", cell: formNeutralDocumentCell(cellHypothesis, intersection, textEvidence) }, problems: [] };
      } catch {
        return { position: { ...identity, status: "cell_structured", cell: formFailedNeutralDocumentCellShell(intersection, cellHypothesis, textEvidence) }, problems: [problem("neutral_cell_formation_failed", "cell_formation", cellProblemFields)] };
      }
    }
    return { position: { ...identity, status: "cell_structured", cell: formFailedNeutralDocumentCellShell(intersection, cellHypothesis, textEvidence) }, problems: [problem("neutral_cell_formation_failed", "cell_formation", cellProblemFields)] };
  }

  const status = mapIntersectionToPositionStatus(intersection);
  // Todos os demais estados nunca carregam célula.
  switch (status) {
    case "empty": return { position: { ...identity, status: "empty", cell: null }, problems: [] };
    case "ambiguous_partial_intersection": return { position: { ...identity, status: "ambiguous_partial_intersection", cell: null }, problems: [] };
    case "ambiguous_multiple_intersections": return { position: { ...identity, status: "ambiguous_multiple_intersections", cell: null }, problems: [] };
    case "ambiguous_content_outside_grid_bounds": return { position: { ...identity, status: "ambiguous_content_outside_grid_bounds", cell: null }, problems: [] };
    case "technical_failure": return { position: { ...identity, status: "technical_failure", cell: null }, problems: [] };
    case "cell_structured": throw new Error("unreachable: cell_structured position status requires intersection.status === \"cell_hypothesis_formed\", handled above");
  }
}

/**
 * Shell auditável de posição `technical_failure` (correção B1, §18/§22):
 * produzido pelo nível da linha quando `formNeutralDocumentPosition` lança
 * uma exceção genuinamente inesperada (fora do caminho normal de falha de
 * célula, que já é isolado internamente e nunca lança). Preserva
 * `sourceGridIntersection` sempre; nunca cria célula vazia artificial.
 */
export function formFailedNeutralDocumentPositionShell(intersection: PhysicalGridIntersection): NeutralDocumentPosition {
  return {
    gridIntersectionKey: intersection.gridIntersectionKey,
    sourceLineKey: intersection.sourceLineKey,
    rowOrder: intersection.rowOrder,
    columnOrder: intersection.columnOrder,
    sourceGridIntersection: intersection,
    status: "technical_failure",
    cell: null,
  };
}
