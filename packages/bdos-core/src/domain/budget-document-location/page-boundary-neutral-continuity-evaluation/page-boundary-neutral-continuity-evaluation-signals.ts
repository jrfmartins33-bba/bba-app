import type { NeutralDocumentLine, NeutralDocumentPage, NeutralDocumentRegion } from "../page-local-neutral-structured-evidence-formation/budget-document-page-local-neutral-structured-evidence-formation.types";
import { PROCESSABLE_PAGE_STATES } from "./budget-document-page-boundary-neutral-continuity-evaluation.types";
import type { PageBoundaryNeutralContinuitySignal } from "./budget-document-page-boundary-neutral-continuity-evaluation.types";
import { PROFILE } from "./page-boundary-neutral-continuity-evaluation-profile";

/** Sinal A (§7): processabilidade das duas páginas da fronteira — gate. */
export function evaluatePageProcessability(originPage: NeutralDocumentPage, targetPage: NeutralDocumentPage): PageBoundaryNeutralContinuitySignal & { signal: "page_processability" } {
  const originOk = PROCESSABLE_PAGE_STATES.includes(originPage.status);
  const targetOk = PROCESSABLE_PAGE_STATES.includes(targetPage.status);
  const outcome = originOk && targetOk ? "both_pages_processable" : !originOk && !targetOk ? "both_pages_not_processable" : !originOk ? "origin_page_not_processable" : "target_page_not_processable";
  return { signal: "page_processability", outcome };
}

/** Sinal B (§7): existência das regiões de fronteira — gate. */
export function evaluateBoundaryRegionExistence(originMissing: boolean, targetMissing: boolean): PageBoundaryNeutralContinuitySignal & { signal: "boundary_region_existence" } {
  const outcome = !originMissing && !targetMissing ? "both_boundary_regions_available" : originMissing && targetMissing ? "both_boundary_regions_missing" : originMissing ? "origin_boundary_region_missing" : "target_boundary_region_missing";
  return { signal: "boundary_region_existence", outcome };
}

/** Sinal C (§7): existência das linhas de fronteira — gate. */
export function evaluateBoundaryLineExistence(originMissing: boolean, targetMissing: boolean): PageBoundaryNeutralContinuitySignal & { signal: "boundary_line_existence" } {
  const outcome = !originMissing && !targetMissing ? "both_boundary_lines_available" : originMissing && targetMissing ? "both_boundary_lines_missing" : originMissing ? "origin_boundary_line_missing" : "target_boundary_line_missing";
  return { signal: "boundary_line_existence", outcome };
}

/**
 * Sinal D (§7): igualdade exata da sequência ordenada de `columnOrder` entre
 * a linha de fronteira de origem e a de destino — comparação estrutural
 * exata, sem threshold. `positionCategory` (vazio/célula/ambiguidade) nunca
 * participa: só a existência e a ordem das colunas, que são estruturais, não
 * econômicas. Posições já chegam ordenadas por `columnOrder` pelo próprio
 * contrato da g.2 — nunca reordenadas aqui.
 */
export function evaluateColumnSignatureCompatibility(originLine: NeutralDocumentLine, targetLine: NeutralDocumentLine): PageBoundaryNeutralContinuitySignal & { signal: "column_signature_compatibility" } {
  const originSequence = originLine.positions.map((position) => position.columnOrder);
  const targetSequence = targetLine.positions.map((position) => position.columnOrder);
  const originPositionCount = originSequence.length;
  const targetPositionCount = targetSequence.length;
  const outcome = originPositionCount === 0 || targetPositionCount === 0
    ? "column_signature_inconclusive"
    : originSequence.length === targetSequence.length && originSequence.every((value, index) => value === targetSequence[index])
      ? "column_signature_match"
      : "column_signature_mismatch";
  return { signal: "column_signature_compatibility", outcome, originPositionCount, targetPositionCount };
}

/**
 * Sinal E (§7/§8): compatibilidade geométrica horizontal entre a região de
 * origem e a de destino, contra os quatro limites do perfil versionado v1 —
 * política determinística, não medição validada contra documento real.
 */
/** O tipo da geometria de região é derivado do próprio campo já exposto por `NeutralDocumentRegion.sourceRegionCandidate` da g.2 — nunca nomeado diretamente a partir do contrato da f.2a, que a g.3 nunca importa (§2). */
export function evaluateHorizontalGeometryCompatibility(
  originRegionCandidate: NeutralDocumentRegion["sourceRegionCandidate"],
  targetRegionCandidate: NeutralDocumentRegion["sourceRegionCandidate"],
): PageBoundaryNeutralContinuitySignal & { signal: "horizontal_geometry_compatibility" } {
  const inconclusive = {
    signal: "horizontal_geometry_compatibility" as const,
    outcome: "geometry_inconclusive" as const,
    horizontalOverlapRatio: null, widthSimilarityRatio: null, leftBoundaryDeviationRatio: null, rightBoundaryDeviationRatio: null,
  };

  // Geometria não finita (NaN/Infinity) nunca é publicada nem classificada como incompatível —
  // só inconclusiva. Verificada antes de qualquer cálculo, e de novo sobre as razões derivadas
  // (uma divisão entre dois valores finitos ainda pode transbordar para Infinity).
  const rawInputsFinite = [originRegionCandidate.leftPoints, originRegionCandidate.rightPoints, originRegionCandidate.widthPoints, targetRegionCandidate.leftPoints, targetRegionCandidate.rightPoints, targetRegionCandidate.widthPoints].every(Number.isFinite);
  if (!rawInputsFinite) return inconclusive;

  const minWidth = Math.min(originRegionCandidate.widthPoints, targetRegionCandidate.widthPoints);
  if (minWidth <= 0) return inconclusive;

  const overlapLeft = Math.max(originRegionCandidate.leftPoints, targetRegionCandidate.leftPoints);
  const overlapRight = Math.min(originRegionCandidate.rightPoints, targetRegionCandidate.rightPoints);
  const overlapWidth = Math.max(0, overlapRight - overlapLeft);
  const maxWidth = Math.max(originRegionCandidate.widthPoints, targetRegionCandidate.widthPoints);

  const horizontalOverlapRatio = overlapWidth / minWidth;
  const widthSimilarityRatio = minWidth / maxWidth;
  const leftBoundaryDeviationRatio = Math.abs(originRegionCandidate.leftPoints - targetRegionCandidate.leftPoints) / minWidth;
  const rightBoundaryDeviationRatio = Math.abs(originRegionCandidate.rightPoints - targetRegionCandidate.rightPoints) / minWidth;

  const derivedRatiosFinite = [horizontalOverlapRatio, widthSimilarityRatio, leftBoundaryDeviationRatio, rightBoundaryDeviationRatio].every(Number.isFinite);
  if (!derivedRatiosFinite) return inconclusive;

  const compatible = horizontalOverlapRatio >= PROFILE.minimumHorizontalOverlapRatio
    && widthSimilarityRatio >= PROFILE.minimumWidthSimilarityRatio
    && leftBoundaryDeviationRatio <= PROFILE.maximumLeftBoundaryDeviationToMinimumWidthRatio
    && rightBoundaryDeviationRatio <= PROFILE.maximumRightBoundaryDeviationToMinimumWidthRatio;
  return {
    signal: "horizontal_geometry_compatibility",
    outcome: compatible ? "geometry_compatible" : "geometry_incompatible",
    horizontalOverlapRatio, widthSimilarityRatio, leftBoundaryDeviationRatio, rightBoundaryDeviationRatio,
  };
}
