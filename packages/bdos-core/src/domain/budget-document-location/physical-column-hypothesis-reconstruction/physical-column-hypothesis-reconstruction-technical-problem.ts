import type {
  PhysicalColumnHypothesisReconstructionTechnicalProblem,
  PhysicalColumnHypothesisReconstructionTechnicalProblemCode,
  PhysicalColumnHypothesisReconstructionTechnicalProblemPhase,
} from "./budget-document-physical-column-hypothesis-reconstruction.types";

/**
 * Mensagem técnica controlada, em português, por código estável (mesmo
 * padrão das duas Sprints anteriores). Central e única fonte de redação.
 * A especificidade de cada ocorrência vive nos campos estruturados
 * (`phase`/`groupKey`/`pageNumber`/`regionKey`/`lineKey`/`segmentKey`),
 * nunca em texto interpolado na mensagem.
 */
const PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTION_PROBLEM_MESSAGE_BY_CODE: Readonly<
  Record<PhysicalColumnHypothesisReconstructionTechnicalProblemCode, string>
> = {
  source_contract_version_unsupported: "Um dos contratos de origem recebidos não corresponde a nenhuma versão explicitamente suportada por esta reconstrução.",
  source_lineage_mismatch: "A reconstrução estrutural e a detecção de regiões recebidas não descrevem, de forma coerente, a mesma origem.",
  source_fingerprint_invalid: "O fingerprint de contexto de uma das etapas de origem não confere com o valor correspondente na outra etapa recebida.",
  source_structure_reconstruction_contract_invalid: "O contrato de reconstrução estrutural recebido é estruturalmente inválido.",
  source_tabular_region_detection_contract_invalid: "O contrato de detecção de regiões recebido é estruturalmente inválido ou inconsistente com a reconstrução estrutural recebida.",
  source_reference_invalid: "Uma região, linha ou segmento referenciado pela detecção de regiões não existe na reconstrução estrutural recebida.",
  source_candidate_page_not_detectable: "A página de origem não produziu estrutura regional processável para esta etapa.",
  physical_vertical_band_construction_failed: "Falha técnica inesperada ao construir faixas verticais físicas desta região.",
  physical_column_hypothesis_formation_failed: "Falha técnica inesperada ao formar hipóteses de coluna física desta região.",
  physical_column_hypothesis_conservation_failed: "A conservação de segmentos físicos desta região não pôde ser confirmada após a formação de hipóteses.",
  physical_column_hypothesis_reconstruction_failed: "Falha técnica inesperada e não classificada durante a reconstrução de hipóteses de coluna física.",
};

/** Único ponto de criação de um problema técnico controlado da reconstrução de hipóteses de coluna física. */
export function createPhysicalColumnHypothesisReconstructionTechnicalProblem(
  code: PhysicalColumnHypothesisReconstructionTechnicalProblemCode,
  phase: PhysicalColumnHypothesisReconstructionTechnicalProblemPhase,
  groupKey: string | null = null,
  pageNumber: number | null = null,
  regionKey: string | null = null,
  lineKey: string | null = null,
  segmentKey: string | null = null,
): PhysicalColumnHypothesisReconstructionTechnicalProblem {
  return {
    code,
    phase,
    groupKey,
    pageNumber,
    regionKey,
    lineKey,
    segmentKey,
    message: PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTION_PROBLEM_MESSAGE_BY_CODE[code],
  };
}

/** Todos os códigos válidos, derivados do mapa de mensagens — única fonte de verdade. */
export function getKnownPhysicalColumnHypothesisReconstructionProblemCodes(): ReadonlyArray<PhysicalColumnHypothesisReconstructionTechnicalProblemCode> {
  return Object.keys(PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTION_PROBLEM_MESSAGE_BY_CODE) as PhysicalColumnHypothesisReconstructionTechnicalProblemCode[];
}
