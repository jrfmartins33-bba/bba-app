import type { BudgetDocumentPageLocalNeutralStructuredEvidenceFormationResult } from "../page-local-neutral-structured-evidence-formation/budget-document-page-local-neutral-structured-evidence-formation.types";

/**
 * Portão de compatibilidade exata. Aprova apenas o contrato de origem
 * literalmente listado aqui — nunca comparação lexical de versões, nunca
 * aceitação de versão desconhecida, nunca melhor esforço com um contrato
 * futuro da g.2. Os valores foram lidos diretamente do contrato real da g.2.
 */
export const SUPPORTED_PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_SOURCE_CONTRACT = Object.freeze({
  schemaVersion: 1,
  formationEngineName: "budget-document-page-local-neutral-structured-evidence-formation-engine",
  formationEngineVersion: "budget-document-page-local-neutral-structured-evidence-formation-engine-v1",
  profileId: "budget-document-page-local-neutral-structured-evidence-formation-profile-v1",
  profileVersion: 1,
  identityFingerprintVersion: "budget-document-page-local-neutral-structured-evidence-formation-identity-fingerprint-v1",
  resultFingerprintVersion: "budget-document-page-local-neutral-structured-evidence-formation-result-fingerprint-v1",
});

export function isSupportedPageLocalNeutralStructuredEvidenceFormationContract(
  source: BudgetDocumentPageLocalNeutralStructuredEvidenceFormationResult,
): boolean {
  const expected = SUPPORTED_PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_SOURCE_CONTRACT;
  return source.schemaVersion === expected.schemaVersion
    && source.formationEngineName === expected.formationEngineName
    && source.formationEngineVersion === expected.formationEngineVersion
    && source.formationProfileId === expected.profileId
    && source.formationProfileVersion === expected.profileVersion
    && source.identityFingerprintVersion === expected.identityFingerprintVersion
    && source.resultFingerprintVersion === expected.resultFingerprintVersion;
}
