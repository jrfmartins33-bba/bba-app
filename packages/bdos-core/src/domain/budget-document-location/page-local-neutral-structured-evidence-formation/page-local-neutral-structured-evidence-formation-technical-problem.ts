import type { PageLocalNeutralStructuredEvidenceFormationTechnicalProblem, PageLocalNeutralStructuredEvidenceFormationTechnicalProblemCode, PageLocalNeutralStructuredEvidenceFormationTechnicalProblemPhase } from "./budget-document-page-local-neutral-structured-evidence-formation.types";

/** Mensagens controladas em português — nunca texto integral da fonte, erro bruto, stack trace ou caminho local (§22). */
const messages: Record<PageLocalNeutralStructuredEvidenceFormationTechnicalProblemCode, string> = {
  source_contract_version_unsupported: "Uma versão de contrato de origem não é suportada.",
  source_lineage_mismatch: "A linhagem dos contratos de origem é divergente.",
  source_fingerprint_invalid: "Um fingerprint de origem não confere.",
  source_structure_reconstruction_contract_invalid: "O contrato de reconstrução estrutural é inválido.",
  source_tabular_region_detection_contract_invalid: "O contrato de detecção de regiões tabulares é inválido.",
  source_physical_cell_hypothesis_formation_contract_invalid: "O contrato de hipóteses físicas de célula é inválido.",
  source_physical_cell_text_evidence_contract_invalid: "O contrato de evidência textual de célula é inválido.",
  source_group_reference_invalid: "Uma referência de grupo não existe entre os contratos de origem.",
  source_page_reference_invalid: "Uma referência de página não existe entre os contratos de origem.",
  source_region_reference_invalid: "Uma referência de região não é confiável entre os contratos de origem.",
  source_line_reference_invalid: "A linha referenciada por uma região não existe na reconstrução estrutural.",
  source_segment_reference_invalid: "Um segmento referenciado por uma linha não existe na reconstrução estrutural.",
  source_grid_intersection_reference_invalid: "Uma interseção da malha não é confiável entre os contratos de origem.",
  source_cell_hypothesis_reference_invalid: "Uma hipótese física de célula não possui interseção correspondente.",
  source_cell_text_evidence_reference_invalid: "Uma hipótese física de célula não possui evidência textual correspondente.",
  source_order_incoherent: "Uma ordem física de origem é incoerente.",
  source_geometry_incoherent: "Uma geometria de origem é incoerente.",
  source_population_incoherent: "A população de objetos entre os contratos de origem é incoerente.",
  source_upstream_state_incoherent: "Um estado upstream é incompatível com sua coleção de objetos.",
  neutral_region_formation_failed: "A organização documental de uma região falhou.",
  neutral_line_formation_failed: "A organização documental de uma linha falhou.",
  neutral_position_formation_failed: "A organização documental de uma posição falhou.",
  neutral_cell_formation_failed: "A organização documental de uma célula falhou.",
  region_conservation_failed: "A conservação de regiões falhou.",
  line_conservation_failed: "A conservação de linhas falhou.",
  segment_conservation_failed: "A conservação de segmentos físicos falhou.",
  position_conservation_failed: "A conservação de posições falhou.",
  cell_conservation_failed: "A conservação de células documentais falhou.",
  text_evidence_conservation_failed: "A conservação de evidências textuais falhou.",
  fragment_conservation_failed: "A conservação de fragmentos textuais falhou.",
  metric_conservation_failed: "A conservação das métricas por universo falhou.",
  page_local_neutral_structure_unexpected_failure: "A organização documental neutra falhou inesperadamente.",
};

export function problem(
  code: PageLocalNeutralStructuredEvidenceFormationTechnicalProblemCode,
  phase: PageLocalNeutralStructuredEvidenceFormationTechnicalProblemPhase,
  fields: Partial<Omit<PageLocalNeutralStructuredEvidenceFormationTechnicalProblem, "code" | "phase" | "message">> = {},
): PageLocalNeutralStructuredEvidenceFormationTechnicalProblem {
  return {
    code, phase,
    groupKey: null, pageNumber: null, regionKey: null,
    lineKey: null, segmentKey: null,
    gridIntersectionKey: null, cellHypothesisKey: null,
    sourceReferenceOrder: null, textItemIndex: null,
    ...fields,
    message: messages[code],
  };
}
