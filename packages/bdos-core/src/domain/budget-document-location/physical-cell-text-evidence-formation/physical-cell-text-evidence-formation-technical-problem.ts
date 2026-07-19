import type { PhysicalCellTextEvidenceFormationTechnicalProblem, PhysicalCellTextEvidenceFormationTechnicalProblemCode, PhysicalCellTextEvidenceFormationTechnicalProblemPhase } from "./budget-document-physical-cell-text-evidence-formation.types";

const messages: Record<PhysicalCellTextEvidenceFormationTechnicalProblemCode, string> = {
  source_contract_version_unsupported: "Uma versão de contrato de origem não é suportada.",
  source_lineage_mismatch: "A linhagem dos contratos de origem é divergente.",
  source_fingerprint_invalid: "Um fingerprint de origem não confere.",
  source_physical_read_contract_invalid: "O contrato de leitura física é inválido.",
  source_structure_reconstruction_contract_invalid: "O contrato de reconstrução estrutural é inválido.",
  source_physical_cell_hypothesis_formation_contract_invalid: "O contrato de hipóteses físicas de célula é inválido.",
  source_group_reference_invalid: "Uma referência de grupo não existe entre os contratos de origem.",
  source_page_reference_invalid: "Uma referência de página não existe entre os contratos de origem.",
  source_region_reference_invalid: "Uma referência de região não é confiável.",
  source_grid_intersection_reference_invalid: "Uma hipótese física de célula não possui interseção correspondente.",
  source_cell_hypothesis_segment_order_invalid: "A ordem declarada dos segmentos de uma célula diverge da ordem horizontal esperada.",
  source_line_reference_invalid: "A linha referenciada por um segmento não existe na reconstrução estrutural.",
  source_segment_reference_invalid: "Um segmento referenciado por uma célula não existe.",
  source_segment_incompatible: "Um segmento é incompatível com a célula que o referencia.",
  source_text_item_reference_invalid: "Um item textual referenciado por um segmento não existe.",
  source_text_item_duplicate_reference: "Um item textual é referenciado por mais de uma ocorrência na região.",
  source_text_item_segment_mismatch: "Um item textual pertence a um segmento diferente do que o referencia.",
  cell_text_evidence_formation_failed: "A formação da evidência textual de uma célula falhou.",
  text_item_conservation_failed: "A conservação entre fragmentos e disposições de item textual falhou.",
  segment_outcome_conservation_failed: "A conservação dos resultados de segmento falhou.",
  cell_text_evidence_conservation_failed: "A conservação das evidências textuais de célula falhou.",
  physical_cell_text_evidence_formation_unexpected_failure: "A formação da evidência textual de célula falhou inesperadamente.",
};

export function problem(
  code: PhysicalCellTextEvidenceFormationTechnicalProblemCode,
  phase: PhysicalCellTextEvidenceFormationTechnicalProblemPhase,
  fields: Partial<Omit<PhysicalCellTextEvidenceFormationTechnicalProblem, "code" | "phase" | "message">> = {},
): PhysicalCellTextEvidenceFormationTechnicalProblem {
  return {
    code, phase,
    groupKey: null, pageNumber: null, regionKey: null,
    cellHypothesisKey: null, gridIntersectionKey: null,
    lineKey: null, segmentKey: null,
    sourceReferenceOrder: null, textItemIndex: null,
    ...fields,
    message: messages[code],
  };
}
