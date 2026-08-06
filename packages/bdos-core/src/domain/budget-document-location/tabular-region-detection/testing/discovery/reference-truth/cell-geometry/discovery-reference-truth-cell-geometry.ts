/**
 * Barril desta subpasta diagnóstica (geometria esperada estruturada das
 * células da verdade de referência). Nunca reexportado pelo barril
 * público do domínio (guarda arquitetural genérico já existente,
 * reforçado por `expected-cell-geometry-boundaries.test.ts`).
 */
export * from "./discovery-reference-truth-cell-geometry.types";
export { parseReferenceTruthCellPhysicalOrigin } from "./discovery-reference-truth-cell-geometry-origin-parser";
export type { ReferenceTruthCellOriginParseResult } from "./discovery-reference-truth-cell-geometry-origin-parser";
export * from "./discovery-reference-truth-cell-geometry-geometry-helpers";
export { projectReferenceTruthCellGeometry } from "./discovery-reference-truth-cell-geometry-projection";
export { validateReferenceTruthCellGeometries } from "./discovery-reference-truth-cell-geometry-validation";
export type { ReferenceTruthCellGeometryValidationIssue } from "./discovery-reference-truth-cell-geometry-validation";
export { projectReferenceTruthCellsWithGeometry } from "./discovery-reference-truth-cell-geometry-evaluator-projection";
export type { ReferenceTruthExpectedCellForEvaluator } from "./discovery-reference-truth-cell-geometry-evaluator-projection";

import { projectReferenceTruthCellGeometry } from "./discovery-reference-truth-cell-geometry-projection";
import { validateReferenceTruthCellGeometries, type ReferenceTruthCellGeometryValidationIssue } from "./discovery-reference-truth-cell-geometry-validation";
import type {
  ReferenceTruthCellGeometryIntegrityIssue,
  ReferenceTruthCellGeometryPageBounds,
  ReferenceTruthCellGeometryProjectionInput,
  ReferenceTruthCellGeometry,
} from "./discovery-reference-truth-cell-geometry.types";

export interface ReferenceTruthCellGeometryBuildResult {
  readonly geometries: ReadonlyArray<ReferenceTruthCellGeometry>;
  readonly integrityIssues: ReadonlyArray<ReferenceTruthCellGeometryIntegrityIssue>;
  readonly validationIssues: ReadonlyArray<ReferenceTruthCellGeometryValidationIssue>;
}

/** Encadeia projeção + validação — a única função que um gerador de dados reais precisa chamar. */
export function buildReferenceTruthCellGeometry(
  input: ReferenceTruthCellGeometryProjectionInput,
  pageBounds: ReadonlyArray<ReferenceTruthCellGeometryPageBounds>,
): ReferenceTruthCellGeometryBuildResult {
  const { geometries, integrityIssues } = projectReferenceTruthCellGeometry(input);
  const validationIssues = validateReferenceTruthCellGeometries(geometries, pageBounds);
  return { geometries, integrityIssues, validationIssues };
}
