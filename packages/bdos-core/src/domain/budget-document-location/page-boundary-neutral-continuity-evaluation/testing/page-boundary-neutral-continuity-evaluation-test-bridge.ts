export {
  evaluateBudgetDocumentPageBoundaryNeutralContinuityWithDependencies,
  getDefaultPageBoundaryNeutralContinuityEvaluationDependencies,
} from "../evaluate-budget-document-page-boundary-neutral-continuity";
export type { PageBoundaryNeutralContinuityEvaluationDependencies } from "../evaluate-budget-document-page-boundary-neutral-continuity";

import { formBudgetDocumentPageLocalNeutralStructuredEvidence } from "../../page-local-neutral-structured-evidence-formation";
import { buildPageLocalNeutralStructuredEvidenceFormationInput } from "../../page-local-neutral-structured-evidence-formation/testing/page-local-neutral-structured-evidence-formation-test-bridge";
import type { SyntheticGeometryPage, SyntheticGeometryTextItem } from "../../page-local-neutral-structured-evidence-formation/testing/page-local-neutral-structured-evidence-formation-test-bridge";
import type { BudgetDocumentPageBoundaryNeutralContinuityEvaluationInput } from "../budget-document-page-boundary-neutral-continuity-evaluation.types";

/**
 * Ponte exclusivamente de teste, local à Sprint 21.4A.2.g.3, que encadeia a
 * ponte real da g.2 (que por sua vez encadeia f.1→f.2a→f.2c→g.1) até o
 * resultado REAL da g.2, e o embrulha na entrada única da g.3. Nunca uma
 * simulação manual do resultado da g.2 — a mesma disciplina da própria g.2
 * ao encadear suas fontes. Não exportada pelo barrel público.
 */
export function buildPageBoundaryNeutralContinuityEvaluationInput(
  sourceLabel: string,
  syntheticPages: ReadonlyArray<SyntheticGeometryPage>,
): BudgetDocumentPageBoundaryNeutralContinuityEvaluationInput {
  const pageLocalInput = buildPageLocalNeutralStructuredEvidenceFormationInput(sourceLabel, syntheticPages);
  const pageLocalNeutralStructuredEvidence = formBudgetDocumentPageLocalNeutralStructuredEvidence(pageLocalInput);
  return { pageLocalNeutralStructuredEvidence };
}

export type { SyntheticGeometryPage, SyntheticGeometryTextItem };
