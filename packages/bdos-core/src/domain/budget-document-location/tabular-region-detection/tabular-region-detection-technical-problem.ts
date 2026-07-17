import type {
  TabularRegionDetectionTechnicalProblem,
  TabularRegionDetectionTechnicalProblemCode,
  TabularRegionDetectionTechnicalProblemPhase,
} from "./budget-document-tabular-region-detection.types";

/**
 * Mensagem técnica controlada, em português, por código estável (mesmo
 * padrão de `structure-reconstruction-technical-problem.ts`). Central e
 * única fonte de redação — os módulos de detecção nunca escrevem sua
 * própria mensagem inline. A especificidade de cada ocorrência vive nos
 * campos estruturados (`phase`/`groupKey`/`pageNumber`/`lineKey`/
 * `segmentKey`), nunca em texto interpolado na mensagem.
 */
const TABULAR_REGION_DETECTION_PROBLEM_MESSAGE_BY_CODE: Readonly<Record<TabularRegionDetectionTechnicalProblemCode, string>> = {
  source_contract_version_unsupported: "O contrato de reconstrução estrutural recebido não corresponde a nenhuma versão explicitamente suportada por este detector.",
  source_lineage_mismatch: "A reconstrução estrutural recebida apresenta identidades internamente incoerentes.",
  source_reconstruction_contract_invalid: "O contrato de reconstrução estrutural recebido é estruturalmente inválido.",
  source_reconstruction_fingerprint_invalid: "O fingerprint de contexto da reconstrução estrutural não confere com o valor recalculado.",
  source_group_contract_invalid: "Um grupo reconstruído recebido é estruturalmente inválido ou inconsistente com suas páginas.",
  source_page_contract_invalid: "Uma página reconstruída recebida é estruturalmente inválida.",
  source_structure_reference_invalid: "Uma linha ou segmento referenciado não existe na estrutura reconstruída recebida.",
  candidate_page_not_reconstructable: "A página reconstruída de origem está marcada como não reconstruível — nenhuma detecção segura pôde ser realizada.",
  candidate_page_has_unresolved_structure: "A página reconstruída de origem contém itens estruturais não resolvidos.",
  vertical_alignment_detection_failed: "Falha técnica inesperada ao observar alinhamentos verticais recorrentes desta página.",
  tabular_region_formation_failed: "Falha técnica inesperada ao formar regiões candidatas a estrutura tabular desta página.",
  tabular_region_overlap_detected: "Duas ou mais formações de região candidata concorreram pela mesma linha física, sem desempate estrutural inequívoco.",
  tabular_region_conservation_failed: "A conservação de linhas físicas desta página não pôde ser confirmada após a formação de regiões.",
  tabular_region_detection_failed: "Falha técnica inesperada e não classificada durante a detecção de regiões candidatas a estrutura tabular.",
};

/** Único ponto de criação de um problema técnico controlado da detecção de regiões tabulares. */
export function createTabularRegionDetectionTechnicalProblem(
  code: TabularRegionDetectionTechnicalProblemCode,
  phase: TabularRegionDetectionTechnicalProblemPhase,
  groupKey: string | null = null,
  pageNumber: number | null = null,
  lineKey: string | null = null,
  segmentKey: string | null = null,
): TabularRegionDetectionTechnicalProblem {
  return {
    code,
    phase,
    groupKey,
    pageNumber,
    lineKey,
    segmentKey,
    message: TABULAR_REGION_DETECTION_PROBLEM_MESSAGE_BY_CODE[code],
  };
}

/** Todos os códigos válidos, derivados do mapa de mensagens — única fonte de verdade. */
export function getKnownTabularRegionDetectionProblemCodes(): ReadonlyArray<TabularRegionDetectionTechnicalProblemCode> {
  return Object.keys(TABULAR_REGION_DETECTION_PROBLEM_MESSAGE_BY_CODE) as TabularRegionDetectionTechnicalProblemCode[];
}
