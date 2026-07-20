import { createHash } from "node:crypto";
import type { BudgetDocumentEconomicCharacterizationInput } from "./budget-document-economic-characterization.types";
import {
  BUDGET_DOCUMENT_ECONOMIC_CHARACTERIZATION_ENGINE_NAME,
  BUDGET_DOCUMENT_ECONOMIC_CHARACTERIZATION_ENGINE_VERSION,
  COLUMN_ROLE_RECOGNITION_RULE_ID,
  COLUMN_ROLE_RECOGNITION_RULE_VERSION,
  BRAZILIAN_NUMBER_PARSING_RULE_ID,
  BRAZILIAN_NUMBER_PARSING_RULE_VERSION,
  ECONOMIC_CHARACTERIZATION_CANONICAL_SERIALIZATION_VERSION,
  ECONOMIC_CHARACTERIZATION_IDENTITY_FINGERPRINT_VERSION,
  ECONOMIC_CHARACTERIZATION_RESULT_FINGERPRINT_VERSION,
  RECONCILIATION_RULE_ID,
  RECONCILIATION_RULE_VERSION,
  ROW_CLASSIFICATION_RULE_ID,
  ROW_CLASSIFICATION_RULE_VERSION,
} from "./budget-document-economic-characterization.types";
import { PROFILE } from "./budget-document-economic-characterization-profile";

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/**
 * Fingerprint de identidade: resume a identidade completa de g.2 e g.3
 * consumidas (incluindo os fingerprints que elas mesmas publicam, que já
 * comprometem transitivamente toda a linhagem f.0→g.3) mais a identidade e
 * as regras próprias desta capacidade. Nunca o conteúdo produzido.
 */
export function computeIdentityFingerprint(input: BudgetDocumentEconomicCharacterizationInput): string {
  const g2 = input.pageLocalNeutralStructuredEvidence;
  const g3 = input.pageBoundaryNeutralContinuity;
  return hash([
    ECONOMIC_CHARACTERIZATION_IDENTITY_FINGERPRINT_VERSION,
    g2.sourceByteHash,
    g2.identityFingerprintVersion, g2.identityFingerprint, g2.resultFingerprintVersion, g2.resultFingerprint, g2.status,
    g3.identityFingerprintVersion, g3.identityFingerprint, g3.resultFingerprintVersion, g3.resultFingerprint, g3.status,
    BUDGET_DOCUMENT_ECONOMIC_CHARACTERIZATION_ENGINE_NAME, BUDGET_DOCUMENT_ECONOMIC_CHARACTERIZATION_ENGINE_VERSION,
    PROFILE.profileId, PROFILE.profileVersion,
    COLUMN_ROLE_RECOGNITION_RULE_ID, COLUMN_ROLE_RECOGNITION_RULE_VERSION,
    ROW_CLASSIFICATION_RULE_ID, ROW_CLASSIFICATION_RULE_VERSION,
    BRAZILIAN_NUMBER_PARSING_RULE_ID, BRAZILIAN_NUMBER_PARSING_RULE_VERSION,
    RECONCILIATION_RULE_ID, RECONCILIATION_RULE_VERSION,
    ECONOMIC_CHARACTERIZATION_CANONICAL_SERIALIZATION_VERSION,
  ]);
}

export function computeResultFingerprint(identityFingerprint: string, content: unknown): string {
  return hash([ECONOMIC_CHARACTERIZATION_RESULT_FINGERPRINT_VERSION, identityFingerprint, content]);
}
