import type { BudgetDocumentEconomicCharacterizationInput, EconomicCharacterizationTechnicalProblem } from "./budget-document-economic-characterization.types";
import { problem } from "./budget-document-economic-characterization-technical-problem";

export type EconomicCharacterizationInputValidationResult =
  | { readonly kind: "valid" }
  | { readonly kind: "invalid"; readonly problems: ReadonlyArray<EconomicCharacterizationTechnicalProblem> };

/**
 * Validação global da entrada (g.2 + g.3). Confirma que ambas têm status
 * utilizável e que a g.3 consumida deriva exatamente da mesma g.2 consumida
 * — nunca um par de execuções divergentes silenciosamente combinado.
 */
export function validateEconomicCharacterizationInput(input: BudgetDocumentEconomicCharacterizationInput): EconomicCharacterizationInputValidationResult {
  const g2 = input.pageLocalNeutralStructuredEvidence;
  const g3 = input.pageBoundaryNeutralContinuity;

  if (g2.status === "failed") return { kind: "invalid", problems: [problem("source_status_invalid", "source_validation")] };
  if (g3.status === "failed") return { kind: "invalid", problems: [problem("source_status_invalid", "source_validation")] };

  if (
    g3.sourcePageLocalNeutralStructuredEvidenceFormationIdentityFingerprint !== g2.identityFingerprint
    || g3.sourcePageLocalNeutralStructuredEvidenceFormationResultFingerprint !== g2.resultFingerprint
  ) {
    return { kind: "invalid", problems: [problem("source_lineage_mismatch", "source_validation")] };
  }

  return { kind: "valid" };
}
