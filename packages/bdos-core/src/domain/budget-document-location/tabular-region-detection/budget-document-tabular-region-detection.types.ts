import type { BudgetDocumentStructureReconstructionResult } from "../structure-reconstruction/budget-document-structure-reconstruction.types";

/**
 * Contrato puro da detecção auditável de regiões candidatas a estrutura
 * tabular (Sprint 21.4A.2.f.2a). Responde apenas "quais partes de uma
 * página reconstruída apresentam evidências físicas suficientes de
 * organização tabular para serem registradas como regiões candidatas?" —
 * nunca "quais são as colunas econômicas, células, cabeçalhos, códigos,
 * unidades, quantidades, preços, totais ou linhas orçamentárias?". Consome
 * exclusivamente `BudgetDocumentStructureReconstructionResult` (schema v1),
 * já produzido pela Sprint 21.4A.2.f.1 — nunca bytes, PDF, objetos de
 * biblioteca ou os contratos de leitura física/localização originais.
 */

export const BUDGET_DOCUMENT_TABULAR_REGION_DETECTION_SCHEMA_VERSION = 1 as const;

export const BUDGET_DOCUMENT_TABULAR_REGION_DETECTOR_NAME = "budget-document-tabular-region-detector" as const;

export const BUDGET_DOCUMENT_TABULAR_REGION_DETECTOR_VERSION = "budget-document-tabular-region-detector-v1" as const;

export const TABULAR_REGION_DETECTION_CONTEXT_FINGERPRINT_VERSION =
  "budget-document-tabular-region-detection-context-fingerprint-v1" as const;

/** Porta de entrada: exclusivamente o resultado já produzido pela Sprint anterior, nunca reconstruído ou recalculado aqui. */
export interface BudgetDocumentTabularRegionDetectionInput {
  readonly structureReconstruction: BudgetDocumentStructureReconstructionResult;
}

// --- alinhamento vertical recorrente (§8.1) ---------------------------------

export type RecurrentVerticalAlignmentType = "left_edge" | "right_edge" | "horizontal_center";

/**
 * Evidência física de que bordas ou centros de segmentos reaparecem em
 * posições horizontalmente compatíveis ao longo de linhas diferentes.
 * Nunca é uma coluna econômica; nunca recebe significado econômico.
 */
export interface RecurrentVerticalAlignment {
  readonly alignmentKey: string;
  readonly pageNumber: number;
  readonly alignmentType: RecurrentVerticalAlignmentType;
  /** Posição canônica (pontos), derivada das posições observadas — nunca a posição de um único membro escolhido arbitrariamente. */
  readonly canonicalPositionPoints: number;
  /** Linhas sustentando o alinhamento, em ordem vertical (`verticalOrder`) — nunca a ordem de descoberta. */
  readonly lineKeys: ReadonlyArray<string>;
  /** Segmento específico, um por linha, alinhado posicionalmente a `lineKeys`. */
  readonly segmentKeys: ReadonlyArray<string>;
  /** Posição observada (pontos) de cada segmento membro, alinhada posicionalmente a `segmentKeys`. */
  readonly observedPositionsPoints: ReadonlyArray<number>;
  readonly formationRuleId: string;
  readonly formationRuleVersion: number;
  readonly profileId: string;
  readonly profileVersion: number;
}

// --- região candidata a estrutura tabular (§8.2) ----------------------------

/**
 * Conjunto verticalmente contíguo de linhas físicas de uma única página,
 * sustentado por múltiplos alinhamentos verticais recorrentes. Nunca uma
 * tabela confirmada, nunca uma coluna ou célula econômica.
 */
export interface TabularRegionCandidate {
  readonly regionKey: string;
  readonly pageNumber: number;
  /** Ordem vertical determinística entre regiões da mesma página, 1-based. */
  readonly order: number;
  /** Linhas participantes, em ordem vertical, sem duplicação. */
  readonly lineKeys: ReadonlyArray<string>;
  /** Alinhamentos que sustentam esta região (interseção de todas as assinaturas das linhas membro) — sempre ao menos `minimumRecurrentAlignmentCount`. */
  readonly supportingAlignmentKeys: ReadonlyArray<string>;
  readonly leftPoints: number;
  readonly topPoints: number;
  readonly rightPoints: number;
  readonly bottomPoints: number;
  readonly widthPoints: number;
  readonly heightPoints: number;
  readonly centerXPoints: number;
  readonly centerYPoints: number;
  readonly formationRuleId: string;
  readonly formationRuleVersion: number;
  readonly profileId: string;
  readonly profileVersion: number;
}

// --- disposição auditável de cada linha física (§12) ------------------------

export type TabularRegionLineDisposition =
  | {
      readonly status: "included_in_candidate_region";
      readonly lineKey: string;
      readonly regionKey: string;
    }
  | {
      readonly status: "not_in_tabular_region";
      readonly lineKey: string;
    }
  | {
      /**
       * Duas ou mais janelas maximais de formação concorreram pela mesma
       * linha, sem desempate estrutural inequívoco (§12). Nenhuma das
       * formações conflitantes é declarada região válida — a ambiguidade
       * fica explícita, nunca escolhida silenciosamente.
       */
      readonly status: "unresolved_tabular_region_ambiguity";
      readonly lineKey: string;
      /** Chaves determinísticas das janelas candidatas conflitantes (nunca regiões confirmadas — nenhuma aparece em `regions[]`). */
      readonly conflictingCandidateRegionKeys: ReadonlyArray<string>;
    }
  | {
      /** Falha técnica na própria detecção (alinhamento ou formação) — nunca confundida com `not_in_tabular_region`, que descreve uma observação real. */
      readonly status: "unresolved_tabular_region_detection_failed";
      readonly lineKey: string;
      readonly failedPhase: "alignment_detection" | "region_formation";
    };

// --- perfil de detecção versionado (§9-10) ----------------------------------

export interface BudgetDocumentTabularRegionDetectionProfile {
  readonly profileId: string;
  readonly profileVersion: number;

  /** Mínimo de linhas físicas para uma região (§9). */
  readonly minimumRegionLineCount: number;
  /** Mínimo de alinhamentos verticais recorrentes distintos sustentando uma região (§9). */
  readonly minimumRecurrentAlignmentCount: number;
  /** Mínimo de linhas sustentando cada alinhamento recorrente (§9). */
  readonly minimumLinesSustainingAlignment: number;

  readonly requireFullPairwiseAlignmentCompatibility: true;
  readonly forbidRegionOverlap: true;

  /** Razão máxima entre o desvio de posição (em pontos) e a menor altura das duas linhas envolvidas, para duas posições serem consideradas o mesmo alinhamento. */
  readonly maximumAlignmentPositionDeviationToMinimumLineHeightRatio: number;

  /** Ordem canônica fixa entre tipos de alinhamento — apenas para desempate determinístico, nunca prioridade de significado. */
  readonly alignmentTypePriorityOrder: ReadonlyArray<RecurrentVerticalAlignmentType>;

  /** Identidade versionada da política de canonicalização aplicada à fronteira de saída — reaproveitada da Sprint anterior, nunca às comparações internas. */
  readonly geometryCanonicalizationVersion: string;
}

// --- problemas técnicos controlados (§16) -----------------------------------

export type TabularRegionDetectionTechnicalProblemCode =
  | "source_contract_version_unsupported"
  | "source_lineage_mismatch"
  | "source_reconstruction_contract_invalid"
  | "source_reconstruction_fingerprint_invalid"
  | "source_group_contract_invalid"
  | "source_page_contract_invalid"
  | "source_structure_reference_invalid"
  | "candidate_page_not_reconstructable"
  | "candidate_page_has_unresolved_structure"
  | "vertical_alignment_detection_failed"
  | "tabular_region_formation_failed"
  | "tabular_region_overlap_detected"
  | "tabular_region_conservation_failed"
  | "tabular_region_detection_failed";

export type TabularRegionDetectionTechnicalProblemPhase =
  | "source_validation"
  | "candidate_group_processing"
  | "candidate_page_processing"
  | "alignment_detection"
  | "region_formation"
  | "conservation_validation";

export interface TabularRegionDetectionTechnicalProblem {
  readonly code: TabularRegionDetectionTechnicalProblemCode;
  readonly phase: TabularRegionDetectionTechnicalProblemPhase;
  readonly groupKey: string | null;
  readonly pageNumber: number | null;
  readonly lineKey: string | null;
  readonly segmentKey: string | null;
  /** Mensagem técnica controlada pelo domínio — nunca stack trace, caminho absoluto ou erro bruto. */
  readonly message: string;
}

// --- limitações estáveis (§23) ----------------------------------------------

export type TabularRegionDetectionLimitationCode =
  | "candidate_region_is_not_a_confirmed_table"
  | "recurrent_alignment_is_not_a_column"
  | "no_physical_column_created"
  | "no_cell_created"
  | "no_header_identified"
  | "no_footer_identified"
  | "no_cross_page_continuity_evaluated"
  | "no_textual_semantics_applied"
  | "no_service_code_read"
  | "no_description_interpreted"
  | "no_unit_read"
  | "no_quantity_read"
  | "no_price_read"
  | "no_total_read"
  | "no_economic_bdi_interpreted"
  | "no_budget_line_created"
  | "no_budget_version_created"
  | "unresolved_structures_remain_explicit"
  | "real_document_out_of_scope"
  | "no_commercial_readiness_claim";

// --- estados (§15) -----------------------------------------------------------

export type TabularRegionDetectionStatus = "completed" | "completed_with_problems" | "failed";
export type TabularRegionDetectionGroupStatus = "detected" | "detected_with_problems" | "no_candidate_region" | "not_detectable";
export type TabularRegionDetectionPageStatus = "detected" | "detected_with_problems" | "no_candidate_region" | "not_detectable";

// --- métricas objetivas -------------------------------------------------------

export interface PageTabularRegionDetectionMetrics {
  readonly totalLineCount: number;
  readonly includedInCandidateRegionLineCount: number;
  readonly notInTabularRegionLineCount: number;
  readonly unresolvedAmbiguityLineCount: number;
  readonly unresolvedDetectionFailedLineCount: number;
  readonly alignmentCount: number;
  readonly regionCount: number;
}

export interface GroupTabularRegionDetectionMetrics {
  readonly totalPageCount: number;
  readonly detectedPageCount: number;
  readonly detectedWithProblemsPageCount: number;
  readonly noCandidateRegionPageCount: number;
  readonly notDetectablePageCount: number;
  readonly lineCount: number;
  readonly alignmentCount: number;
  readonly regionCount: number;
}

export interface GlobalTabularRegionDetectionMetrics {
  readonly receivedGroupCount: number;
  readonly detectedGroupCount: number;
  readonly detectedWithProblemsGroupCount: number;
  readonly noCandidateRegionGroupCount: number;
  readonly notDetectableGroupCount: number;
  readonly candidatePageCount: number;
  readonly lineCount: number;
  readonly alignmentCount: number;
  readonly regionCount: number;
}

// --- página processada (§14) --------------------------------------------------

export interface TabularRegionDetectionPage {
  /**
   * Chave própria desta etapa (semeada pela identidade de detecção da
   * f.2a, `computePageProcessedKey`) — **nunca** uma cópia ou referência
   * literal à `pageReconstructionKey` da página reconstruída de origem
   * (Sprint 21.4A.2.f.1), que é um valor diferente. O identificador
   * literalmente estável através de f.1 e f.2a para casar esta página com
   * a página reconstruída correspondente é `pageNumber` (auditoria
   * arquitetural da Sprint 21.4A.2.f.2b, §3).
   */
  readonly pageReconstructionKey: string;
  readonly pageNumber: number;
  readonly status: TabularRegionDetectionPageStatus;
  readonly alignments: ReadonlyArray<RecurrentVerticalAlignment>;
  readonly regions: ReadonlyArray<TabularRegionCandidate>;
  readonly lineDispositions: ReadonlyArray<TabularRegionLineDisposition>;
  readonly technicalProblems: ReadonlyArray<TabularRegionDetectionTechnicalProblem>;
  readonly metrics: PageTabularRegionDetectionMetrics;
  readonly profileId: string;
  readonly profileVersion: number;
}

// --- grupo processado (§14) ---------------------------------------------------

export interface TabularRegionDetectionGroup {
  /**
   * Chave própria desta etapa (semeada pela identidade de detecção da
   * f.2a, `computeGroupProcessedKey`) — **nunca** uma cópia ou referência
   * literal à `groupReconstructionKey` do grupo reconstruído de origem
   * (Sprint 21.4A.2.f.1), que é um valor diferente. O identificador
   * literalmente estável desde a localização de páginas, através de f.1 e
   * f.2a, é `sourceCandidateGroupKey` (auditoria arquitetural da Sprint
   * 21.4A.2.f.2b, §3).
   */
  readonly groupReconstructionKey: string;
  readonly sourceCandidateGroupKey: string;
  readonly status: TabularRegionDetectionGroupStatus;
  readonly pageKeys: ReadonlyArray<string>;
  readonly pages: ReadonlyArray<TabularRegionDetectionPage>;
  readonly technicalProblems: ReadonlyArray<TabularRegionDetectionTechnicalProblem>;
  readonly metrics: GroupTabularRegionDetectionMetrics;
}

// --- resultado global (§14) ---------------------------------------------------

export interface BudgetDocumentTabularRegionDetectionResult {
  readonly schemaVersion: typeof BUDGET_DOCUMENT_TABULAR_REGION_DETECTION_SCHEMA_VERSION;
  readonly detectorName: typeof BUDGET_DOCUMENT_TABULAR_REGION_DETECTOR_NAME;
  readonly detectorVersion: typeof BUDGET_DOCUMENT_TABULAR_REGION_DETECTOR_VERSION;
  readonly detectionProfileId: string;
  readonly detectionProfileVersion: number;
  readonly detectionContextFingerprintVersion: typeof TABULAR_REGION_DETECTION_CONTEXT_FINGERPRINT_VERSION;
  /** Fingerprint final da detecção — incorpora identidades de origem *e* o conteúdo canônico das evidências e regiões produzidas (§17). */
  readonly detectionContextFingerprint: string;
  readonly sourceByteHash: string;
  /**
   * Identidades individuais da reconstrução de origem, preservadas
   * isoladamente — nunca substituídas pelo fingerprint que as resume.
   * Presentes inclusive quando `status` é `failed`, sempre que disponíveis
   * no contrato recebido.
   */
  readonly sourceReconstructionSchemaVersion: BudgetDocumentStructureReconstructionResult["schemaVersion"];
  readonly sourceReconstructorName: BudgetDocumentStructureReconstructionResult["reconstructorName"];
  readonly sourceReconstructorVersion: BudgetDocumentStructureReconstructionResult["reconstructorVersion"];
  readonly sourceReconstructionProfileId: BudgetDocumentStructureReconstructionResult["reconstructionProfileId"];
  readonly sourceReconstructionProfileVersion: BudgetDocumentStructureReconstructionResult["reconstructionProfileVersion"];
  readonly sourceReconstructionContextFingerprintVersion: BudgetDocumentStructureReconstructionResult["reconstructionContextFingerprintVersion"];
  readonly sourceReconstructionContextFingerprint: BudgetDocumentStructureReconstructionResult["reconstructionContextFingerprint"];
  readonly status: TabularRegionDetectionStatus;
  readonly groups: ReadonlyArray<TabularRegionDetectionGroup>;
  readonly technicalProblems: ReadonlyArray<TabularRegionDetectionTechnicalProblem>;
  readonly metrics: GlobalTabularRegionDetectionMetrics;
  readonly limitations: ReadonlyArray<TabularRegionDetectionLimitationCode>;
}
