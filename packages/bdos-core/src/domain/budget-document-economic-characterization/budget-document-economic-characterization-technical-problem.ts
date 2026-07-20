import type {
  EconomicCharacterizationTechnicalProblem,
  EconomicCharacterizationTechnicalProblemCode,
  EconomicCharacterizationTechnicalProblemPhase,
} from "./budget-document-economic-characterization.types";

const messages: Record<EconomicCharacterizationTechnicalProblemCode, string> = {
  source_contract_version_unsupported: "Uma versão de contrato de origem (g.2/g.3) não é suportada.",
  source_status_invalid: "O status de uma fonte consumida (g.2/g.3) é inválido para caracterização.",
  source_fingerprint_invalid: "Um fingerprint de uma fonte consumida (g.2/g.3) não confere.",
  source_lineage_mismatch: "A g.3 consumida não deriva do mesmo resultado de g.2 consumido.",
  column_role_conflict_unresolved: "Duas ou mais colunas da mesma região reivindicam o mesmo papel econômico, sem desempate estrutural.",
  hierarchical_code_cycle_detected: "Um código hierárquico produziria um ciclo na hierarquia proposta.",
  hierarchical_code_orphan: "Um código hierárquico não encontrou um Grupo ou Subgrupo aberto compatível.",
  line_classification_failed: "A classificação de uma linha falhou de forma inesperada.",
  reconciliation_failed: "A reconciliação de uma linha falhou de forma inesperada.",
  economic_characterization_unexpected_failure: "A caracterização econômica falhou inesperadamente.",
};

export function problem(
  code: EconomicCharacterizationTechnicalProblemCode,
  phase: EconomicCharacterizationTechnicalProblemPhase,
  fields: Partial<Omit<EconomicCharacterizationTechnicalProblem, "code" | "phase" | "message">> = {},
): EconomicCharacterizationTechnicalProblem {
  return {
    code, phase,
    sourceCandidateGroupKey: null, pageNumber: null, sourceRegionKey: null, sourceLineKey: null, proposedLineId: null,
    ...fields,
    message: messages[code],
  };
}
