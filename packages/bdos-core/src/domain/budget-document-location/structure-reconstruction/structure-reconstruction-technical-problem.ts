import type {
  StructureReconstructionTechnicalProblem,
  StructureReconstructionTechnicalProblemCode,
  StructureReconstructionTechnicalProblemPhase,
} from "./budget-document-structure-reconstruction.types";

/**
 * Mensagem técnica controlada, em português, por código estável (auditoria
 * pós-PR #69, seguindo o padrão de `physical-document-technical-problem.ts`).
 * Central e única fonte de redação — os módulos de reconstrução nunca
 * escrevem sua própria mensagem inline. A especificidade de cada ocorrência
 * vive nos campos estruturados (`phase`/`groupKey`/`pageNumber`/
 * `sourceTextItemIndex`), nunca em texto interpolado na mensagem.
 */
const STRUCTURE_RECONSTRUCTION_PROBLEM_MESSAGE_BY_CODE: Readonly<Record<StructureReconstructionTechnicalProblemCode, string>> = {
  source_contract_version_unsupported: "O contrato de origem não corresponde a nenhuma versão explicitamente suportada por este reconstrutor.",
  source_lineage_mismatch: "A leitura física e a localização recebidas não descrevem, de forma coerente, o mesmo documento de origem.",
  physical_read_contract_invalid: "O contrato da leitura física recebida é estruturalmente inválido.",
  geometry_context_fingerprint_invalid: "O fingerprint de contexto geométrico da leitura física não confere com o valor recalculado.",
  page_location_contract_invalid: "O contrato de localização recebido é estruturalmente inválido ou reflete uma falha ocorrida antes desta reconstrução.",
  candidate_group_contract_invalid: "Um grupo candidato recebido é estruturalmente inválido ou inconsistente com as decisões de página de origem.",
  candidate_page_not_found: "Um grupo candidato referencia uma página física que não existe na leitura recebida.",
  candidate_page_text_unavailable: "A página candidata não possui texto extraído disponível para reconstrução.",
  candidate_page_has_no_eligible_items: "A página candidata não possui nenhum item textual geometricamente elegível para reconstrução.",
  candidate_page_contains_unresolved_items: "A página candidata contém itens textuais com geometria não resolvida.",
  candidate_page_contains_outside_items: "A página candidata contém itens textuais totalmente fora dos limites da página.",
  candidate_page_contains_partially_outside_items: "A página candidata contém itens textuais parcialmente fora dos limites da página.",
  physical_line_reconstruction_failed: "Falha técnica inesperada ao reconstruir as faixas físicas de linha desta página.",
  horizontal_segment_reconstruction_failed: "Falha técnica inesperada ao reconstruir os segmentos horizontais desta página.",
  physical_block_reconstruction_failed: "Falha técnica inesperada ao reconstruir os blocos físicos bidimensionais desta página.",
  structure_reconstruction_failed: "Falha técnica inesperada e não classificada durante a reconstrução estrutural.",
};

/** Único ponto de criação de um problema técnico controlado da reconstrução estrutural. */
export function createStructureReconstructionTechnicalProblem(
  code: StructureReconstructionTechnicalProblemCode,
  phase: StructureReconstructionTechnicalProblemPhase,
  groupKey: string | null = null,
  pageNumber: number | null = null,
  sourceTextItemIndex: number | null = null,
): StructureReconstructionTechnicalProblem {
  return {
    code,
    phase,
    groupKey,
    pageNumber,
    sourceTextItemIndex,
    message: STRUCTURE_RECONSTRUCTION_PROBLEM_MESSAGE_BY_CODE[code],
  };
}

/** Todos os códigos válidos, derivados do mapa de mensagens — única fonte de verdade (mesmo padrão de `getKnownTechnicalProblemCodes`). */
export function getKnownStructureReconstructionProblemCodes(): ReadonlyArray<StructureReconstructionTechnicalProblemCode> {
  return Object.keys(STRUCTURE_RECONSTRUCTION_PROBLEM_MESSAGE_BY_CODE) as StructureReconstructionTechnicalProblemCode[];
}
