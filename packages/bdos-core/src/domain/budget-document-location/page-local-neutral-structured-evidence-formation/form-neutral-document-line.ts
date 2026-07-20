import type { ReconstructedHorizontalSegment, ReconstructedPhysicalLine } from "../structure-reconstruction/budget-document-structure-reconstruction.types";
import type { PhysicalCellHypothesis, PhysicalGridIntersection } from "../physical-cell-hypothesis-formation/budget-document-physical-cell-hypothesis-formation.types";
import type { PhysicalCellTextEvidence } from "../physical-cell-text-evidence-formation/budget-document-physical-cell-text-evidence-formation.types";
import type { NeutralDocumentLine, NeutralDocumentPosition, PageLocalNeutralStructuredEvidenceFormationTechnicalProblem } from "./budget-document-page-local-neutral-structured-evidence-formation.types";
import { deriveLineStatus } from "./page-local-neutral-structured-evidence-formation-classifiers";
import { computeLineMetrics } from "./page-local-neutral-structured-evidence-formation-metrics";
import { formFailedNeutralDocumentPositionShell, formNeutralDocumentPosition } from "./form-neutral-document-position";
import { problem } from "./page-local-neutral-structured-evidence-formation-technical-problem";

export interface LineFormationContext {
  readonly groupKey: string;
  readonly pageNumber: number;
  readonly regionKey: string;
}

export interface LineFormationDependencies {
  readonly formNeutralDocumentPosition: typeof formNeutralDocumentPosition;
}

const DEFAULT_LINE_FORMATION_DEPENDENCIES: LineFormationDependencies = { formNeutralDocumentPosition };

/**
 * Linha documental neutra 1:1 com uma linha física (Alternativa B, §13).
 * Preserva a linha física e todos os seus segmentos por referência (§20.3,
 * inclusive segmentos fora de células) e reúne as posições da linha (uma por
 * interseção cujo `sourceLineKey` corresponda), ordenadas por `columnOrder`
 * depois `gridIntersectionKey` (§27). Uma linha sem interseções recebe
 * `positions: []` e estado explícito, nunca uma posição sintética (§14/§13).
 *
 * Correção B1 (§18/§22): uma falha ao formar UMA posição (exceção
 * genuinamente inesperada de `formNeutralDocumentPosition`, distinta da falha
 * de célula já isolada internamente por ela) é isolada aqui como um shell de
 * posição `technical_failure` com `neutral_position_formation_failed` — as
 * demais posições da linha, e a linha em si, permanecem intactas. Os
 * problemas técnicos de posição/célula produzidos pelas posições da linha são
 * agregados em `technicalProblems`, o que já degrada o `status` da linha para
 * `structured_with_problems` (nunca `failed`) via o classificador único
 * (`deriveLineStatus`) — uma falha localizada de posição/célula nunca deriva
 * a própria linha para `failed`.
 */
export function formNeutralDocumentLine(
  structureLine: ReconstructedPhysicalLine,
  physicalSegments: ReadonlyArray<ReconstructedHorizontalSegment>,
  intersectionsForLine: ReadonlyArray<PhysicalGridIntersection>,
  cellHypothesisByKey: ReadonlyMap<string, PhysicalCellHypothesis>,
  textEvidenceByCellKey: ReadonlyMap<string, PhysicalCellTextEvidence>,
  regionUpstreamNotProcessable: boolean,
  context: LineFormationContext,
  dependencies: LineFormationDependencies = DEFAULT_LINE_FORMATION_DEPENDENCIES,
): NeutralDocumentLine {
  const orderedIntersections = [...intersectionsForLine].sort((a, b) => a.columnOrder - b.columnOrder || a.gridIntersectionKey.localeCompare(b.gridIntersectionKey));
  const positionContext = { groupKey: context.groupKey, pageNumber: context.pageNumber, regionKey: context.regionKey, lineKey: structureLine.lineKey };

  const positions: NeutralDocumentPosition[] = [];
  const technicalProblems: PageLocalNeutralStructuredEvidenceFormationTechnicalProblem[] = [];
  for (const intersection of orderedIntersections) {
    try {
      const outcome = dependencies.formNeutralDocumentPosition(intersection, cellHypothesisByKey, textEvidenceByCellKey, positionContext);
      positions.push(outcome.position);
      technicalProblems.push(...outcome.problems);
    } catch {
      positions.push(formFailedNeutralDocumentPositionShell(intersection));
      technicalProblems.push(problem("neutral_position_formation_failed", "position_formation", { groupKey: context.groupKey, pageNumber: context.pageNumber, regionKey: context.regionKey, lineKey: structureLine.lineKey, gridIntersectionKey: intersection.gridIntersectionKey }));
    }
  }

  const metrics = computeLineMetrics(positions, technicalProblems, physicalSegments.length);
  const status = deriveLineStatus({ positionCount: positions.length, technicalProblemCount: technicalProblems.length, regionUpstreamNotProcessable, formationFailed: false });
  return {
    sourceLineKey: structureLine.lineKey,
    pageNumber: structureLine.pageNumber,
    verticalOrder: structureLine.verticalOrder,
    status,
    sourceLine: structureLine,
    physicalSegments,
    positions,
    technicalProblems,
    metrics,
  };
}

/**
 * Shell auditável de linha `failed` (correção B1, §18/§22): produzido pela
 * região quando `formNeutralDocumentLine` lança uma exceção genuinamente
 * inesperada (falha de montagem da própria linha, distinta de qualquer falha
 * de posição/célula, que já são isoladas internamente e nunca escapam como
 * exceção). Preserva `sourceLine` sempre e os segmentos físicos que puderem
 * ser relacionados com segurança a partir da própria linha estrutural
 * (`sourceLine.segmentKeys` resolvidos contra `structureSegmentByKey`,
 * ignorando silenciosamente apenas o que não resolver — nunca lança de novo
 * dentro do próprio shell). Nunca carrega posições (a própria montagem da
 * linha falhou) e nunca deriva a região para `failed`.
 */
export function formFailedNeutralDocumentLineShell(
  structureLine: ReconstructedPhysicalLine,
  structureSegmentByKey: ReadonlyMap<string, ReconstructedHorizontalSegment>,
  context: LineFormationContext,
): NeutralDocumentLine {
  const physicalSegments = structureLine.segmentKeys
    .map((segmentKey) => structureSegmentByKey.get(segmentKey))
    .filter((segment): segment is ReconstructedHorizontalSegment => segment !== undefined);
  const technicalProblems = [problem("neutral_line_formation_failed", "line_formation", { groupKey: context.groupKey, pageNumber: context.pageNumber, regionKey: context.regionKey, lineKey: structureLine.lineKey })];
  return {
    sourceLineKey: structureLine.lineKey,
    pageNumber: structureLine.pageNumber,
    verticalOrder: structureLine.verticalOrder,
    status: "failed",
    sourceLine: structureLine,
    physicalSegments,
    positions: [],
    technicalProblems,
    metrics: computeLineMetrics([], technicalProblems, physicalSegments.length),
  };
}
