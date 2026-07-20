import { createHash } from "node:crypto";
import type { BudgetDocumentPageLocalNeutralStructuredEvidenceFormationResult } from "../page-local-neutral-structured-evidence-formation/budget-document-page-local-neutral-structured-evidence-formation.types";
import {
  BUDGET_DOCUMENT_PAGE_BOUNDARY_NEUTRAL_CONTINUITY_EVALUATION_ENGINE_NAME,
  BUDGET_DOCUMENT_PAGE_BOUNDARY_NEUTRAL_CONTINUITY_EVALUATION_ENGINE_VERSION,
  PAGE_BOUNDARY_CONSECUTIVE_PAIR_POPULATION_RULE_ID,
  PAGE_BOUNDARY_CONSECUTIVE_PAIR_POPULATION_RULE_VERSION,
  PAGE_BOUNDARY_CONTINUITY_CLASSIFICATION_RULE_ID,
  PAGE_BOUNDARY_CONTINUITY_CLASSIFICATION_RULE_VERSION,
  PAGE_BOUNDARY_CONTINUITY_SIGNAL_EVALUATION_RULE_ID,
  PAGE_BOUNDARY_CONTINUITY_SIGNAL_EVALUATION_RULE_VERSION,
  PAGE_BOUNDARY_EXTREMAL_SELECTION_RULE_ID,
  PAGE_BOUNDARY_EXTREMAL_SELECTION_RULE_VERSION,
  PAGE_BOUNDARY_NEUTRAL_CONTINUITY_CANONICAL_SERIALIZATION_VERSION,
  PAGE_BOUNDARY_NEUTRAL_CONTINUITY_EVALUATION_IDENTITY_FINGERPRINT_VERSION,
} from "./budget-document-page-boundary-neutral-continuity-evaluation.types";
import { PROFILE } from "./page-boundary-neutral-continuity-evaluation-profile";

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/**
 * Fingerprint de identidade da g.3: resume a identidade completa da g.2
 * consumida (incluindo os dois fingerprints que ela mesma publica, que já
 * comprometem transitivamente toda a linhagem anterior — f.0 a g.1), o
 * `sourceByteHash`, e a identidade/perfil/regras da própria g.3. NUNCA
 * incorpora o conteúdo produzido (avaliações) — isso entra apenas no
 * fingerprint final. Ordem fixa, SHA-256 sobre JSON canônico por valor.
 */
export function computeIdentityFingerprint(source: BudgetDocumentPageLocalNeutralStructuredEvidenceFormationResult): string {
  return hash([
    PAGE_BOUNDARY_NEUTRAL_CONTINUITY_EVALUATION_IDENTITY_FINGERPRINT_VERSION,
    source.sourceByteHash,
    source.schemaVersion, source.formationEngineName, source.formationEngineVersion,
    source.formationProfileId, source.formationProfileVersion,
    source.identityFingerprintVersion, source.identityFingerprint,
    source.resultFingerprintVersion, source.resultFingerprint,
    source.status,
    BUDGET_DOCUMENT_PAGE_BOUNDARY_NEUTRAL_CONTINUITY_EVALUATION_ENGINE_NAME, BUDGET_DOCUMENT_PAGE_BOUNDARY_NEUTRAL_CONTINUITY_EVALUATION_ENGINE_VERSION,
    PROFILE.profileId, PROFILE.profileVersion,
    PAGE_BOUNDARY_CONSECUTIVE_PAIR_POPULATION_RULE_ID, PAGE_BOUNDARY_CONSECUTIVE_PAIR_POPULATION_RULE_VERSION,
    PAGE_BOUNDARY_EXTREMAL_SELECTION_RULE_ID, PAGE_BOUNDARY_EXTREMAL_SELECTION_RULE_VERSION,
    PAGE_BOUNDARY_CONTINUITY_SIGNAL_EVALUATION_RULE_ID, PAGE_BOUNDARY_CONTINUITY_SIGNAL_EVALUATION_RULE_VERSION,
    PAGE_BOUNDARY_CONTINUITY_CLASSIFICATION_RULE_ID, PAGE_BOUNDARY_CONTINUITY_CLASSIFICATION_RULE_VERSION,
    PAGE_BOUNDARY_NEUTRAL_CONTINUITY_CANONICAL_SERIALIZATION_VERSION,
  ]);
}
