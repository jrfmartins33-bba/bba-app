import type {
  PageBoundaryNeutralContinuityTechnicalProblem,
  PageBoundaryNeutralContinuityTechnicalProblemCode,
  PageBoundaryNeutralContinuityTechnicalProblemPhase,
} from "./budget-document-page-boundary-neutral-continuity-evaluation.types";

/** Mensagens controladas em português — nunca texto integral da fonte, erro bruto, stack trace ou caminho local. */
const messages: Record<PageBoundaryNeutralContinuityTechnicalProblemCode, string> = {
  source_contract_version_unsupported: "Uma versão de contrato de origem não é suportada.",
  source_status_invalid: "O status da g.2 consumida é inválido para avaliação.",
  source_fingerprint_invalid: "Um fingerprint da g.2 consumida não confere.",
  source_group_reference_invalid: "Duas ou mais chaves de grupo (sourceCandidateGroupKey) publicadas pela g.2 são idênticas.",
  source_group_page_population_incoherent: "A população de páginas de um grupo é incoerente (lacuna, duplicidade ou chave de região/linha inconsistente).",
  source_region_reference_invalid: "Uma referência de região da g.2 é internamente inconsistente.",
  source_line_reference_invalid: "Uma referência de linha da g.2 é internamente inconsistente.",
  boundary_region_selection_ambiguous: "A seleção da região de fronteira é ambígua (empate estrutural de order).",
  boundary_line_selection_ambiguous: "A seleção da linha de fronteira é ambígua (empate estrutural de verticalOrder).",
  signal_evaluation_failed: "A avaliação de um sinal estrutural falhou.",
  evaluation_population_conservation_failed: "A população de avaliações publicada diverge da população normativa recalculada.",
  evaluation_reference_conservation_failed: "Uma avaliação referencia uma região ou linha que não existe na g.2 consumida.",
  evaluation_direction_conservation_failed: "Uma avaliação viola o invariante de direção ou de fronteira de grupo.",
  evaluation_selection_conservation_failed: "A seleção de região ou linha de fronteira publicada diverge da seleção recalculada.",
  evaluation_signal_conservation_failed: "Os sinais observados publicados divergem dos sinais recalculados.",
  evaluation_evidence_conservation_failed: "Uma evidência publicada não é derivável dos sinais observados.",
  evaluation_status_conservation_failed: "O estado publicado diverge da matriz de classificação aplicada aos sinais recalculados.",
  evaluation_partition_conservation_failed: "A partição categórica das avaliações não fecha exatamente com a contagem produzida.",
  metric_conservation_failed: "A conservação das métricas falhou.",
  page_boundary_continuity_unexpected_failure: "A avaliação de continuidade de fronteira falhou inesperadamente.",
};

export function problem(
  code: PageBoundaryNeutralContinuityTechnicalProblemCode,
  phase: PageBoundaryNeutralContinuityTechnicalProblemPhase,
  fields: Partial<Omit<PageBoundaryNeutralContinuityTechnicalProblem, "code" | "phase" | "message">> = {},
): PageBoundaryNeutralContinuityTechnicalProblem {
  return {
    code, phase,
    sourceCandidateGroupKey: null, originPageNumber: null, targetPageNumber: null,
    originRegionKey: null, targetRegionKey: null, originBoundaryLineKey: null, targetBoundaryLineKey: null,
    ...fields,
    message: messages[code],
  };
}
