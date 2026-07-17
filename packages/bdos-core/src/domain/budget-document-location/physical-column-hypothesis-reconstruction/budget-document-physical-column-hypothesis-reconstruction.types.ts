import type { BudgetDocumentStructureReconstructionResult } from "../structure-reconstruction/budget-document-structure-reconstruction.types";
import type { BudgetDocumentTabularRegionDetectionResult, RecurrentVerticalAlignmentType } from "../tabular-region-detection/budget-document-tabular-region-detection.types";

/**
 * Contrato puro da reconstrução auditável de hipóteses de colunas físicas
 * (Sprint 21.4A.2.f.2b). Responde apenas "dentro de cada região candidata a
 * estrutura tabular, quais conjuntos recorrentes de segmentos físicos podem
 * ser registrados como hipóteses auditáveis de colunas físicas?" — nunca
 * "qual coluna é código, descrição, unidade, quantidade, preço, total ou
 * BDI?". Consome exclusivamente `BudgetDocumentStructureReconstructionResult`
 * (schema v1, Sprint 21.4A.2.f.1) e `BudgetDocumentTabularRegionDetectionResult`
 * (schema v1, Sprint 21.4A.2.f.2a) — nunca bytes, PDF, objetos de biblioteca,
 * texto para interpretação semântica ou outros domínios econômicos.
 */

export const BUDGET_DOCUMENT_PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTION_SCHEMA_VERSION = 1 as const;

export const BUDGET_DOCUMENT_PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTOR_NAME =
  "budget-document-physical-column-hypothesis-reconstructor" as const;

export const BUDGET_DOCUMENT_PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTOR_VERSION =
  "budget-document-physical-column-hypothesis-reconstructor-v1" as const;

export const PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTION_CONTEXT_FINGERPRINT_VERSION =
  "budget-document-physical-column-hypothesis-reconstruction-context-fingerprint-v1" as const;

/** Porta de entrada: os dois contratos já produzidos pelas Sprints anteriores, nunca reconstruídos ou recalculados aqui (Alternativa B). */
export interface BudgetDocumentPhysicalColumnHypothesisReconstructionInput {
  readonly structureReconstruction: BudgetDocumentStructureReconstructionResult;
  readonly tabularRegionDetection: BudgetDocumentTabularRegionDetectionResult;
}

// --- hipótese de coluna física (§7) ------------------------------------------

/**
 * Consolidação de um ou mais alinhamentos verticais recorrentes da Sprint
 * 21.4A.2.f.2a cuja assinatura física — a sequência ordenada exata de pares
 * `(lineKey, segmentKey)` — é idêntica. Nunca uma coluna econômica
 * confirmada; nunca recebe significado textual.
 */
export interface PhysicalColumnHypothesis {
  readonly hypothesisKey: string;
  readonly pageNumber: number;
  /** Ordem horizontal determinística entre hipóteses da mesma região, 1-based. */
  readonly order: number;
  /** Alinhamentos recorrentes da f.2a cuja assinatura é idêntica e que, por isso, foram consolidados nesta hipótese — nunca copiados, apenas referenciados. */
  readonly contributingAlignmentKeys: ReadonlyArray<string>;
  /** Linhas participantes, em ordem vertical, alinhadas posicionalmente a `segmentKeys`. */
  readonly lineKeys: ReadonlyArray<string>;
  /** Segmentos participantes, um por linha, formando a assinatura física exata desta hipótese. */
  readonly segmentKeys: ReadonlyArray<string>;
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

// --- disposição auditável de cada segmento físico (§10) ----------------------

export type PhysicalColumnHypothesisSegmentDisposition =
  | {
      readonly status: "included_in_physical_column_hypothesis";
      readonly segmentKey: string;
      readonly lineKey: string;
      readonly hypothesisKey: string;
    }
  | {
      /** Segmento pertence à região, mas não participa de nenhum alinhamento recorrente suficiente — nunca célula vazia, nunca erro. */
      readonly status: "not_in_physical_column_hypothesis";
      readonly segmentKey: string;
      readonly lineKey: string;
    }
  | {
      /** Duas ou mais candidatas concorreram pelo mesmo segmento, ou suas assinaturas diferem mas seus envelopes se sobrepõem — nenhuma é declarada hipótese válida. */
      readonly status: "unresolved_physical_column_hypothesis_ambiguity";
      readonly segmentKey: string;
      readonly lineKey: string;
      /** Chaves determinísticas das candidatas conflitantes (nunca hipóteses confirmadas — nenhuma aparece em `hypotheses[]`). */
      readonly conflictingCandidateHypothesisKeys: ReadonlyArray<string>;
    }
  | {
      /** Falha técnica na própria reconstrução (construção de faixa ou formação de hipótese) — nunca confundida com `not_in_physical_column_hypothesis`, que descreve uma observação real. */
      readonly status: "unresolved_physical_column_hypothesis_detection_failed";
      readonly segmentKey: string;
      readonly lineKey: string;
      readonly failedPhase: "band_construction" | "hypothesis_formation";
    };

// --- perfil versionado (§6-8) -------------------------------------------------

/**
 * Nenhuma tolerância numérica de fusão foi aprovada para esta versão (§6-8
 * do enunciado da Sprint): consolidação exige assinatura física
 * exatamente idêntica; conflito exige segmento compartilhado ou
 * sobreposição horizontal estritamente positiva. Por isso o perfil desta
 * Sprint não declara nenhuma razão numérica de tolerância — apenas
 * identidades e invariantes fixas.
 */
export interface BudgetDocumentPhysicalColumnHypothesisReconstructionProfile {
  readonly profileId: string;
  readonly profileVersion: number;

  readonly requireExactSignatureEquality: true;
  readonly forbidPhysicalColumnHypothesisOverlap: true;

  /**
   * Sustentação mínima, em pares `(lineKey, segmentKey)`, que a projeção
   * regional de um alinhamento precisa conservar para formar uma faixa
   * (auditoria pós-revisão da Sprint 21.4A.2.f.2b, §1). `RecurrentVerticalAlignment`
   * é observado no nível da página inteira pela f.2a; ao projetar um
   * alinhamento para dentro de uma região (mantendo apenas os pares cuja
   * linha pertence à região), a sustentação pode cair abaixo do mínimo já
   * exigido pela f.2a para o alinhamento como um todo. Este valor nunca é
   * uma nova tolerância calibrada — é herdado, em tempo de execução, do
   * mesmo mínimo já aprovado no perfil v1 da f.2a
   * (`minimumLinesSustainingAlignment`), garantindo que a projeção nunca
   * transforme um alinhamento recorrente em evidência de apenas uma ou
   * duas linhas.
   */
  readonly minimumLinesSustainingProjectedAlignment: number;

  /** Ordem canônica fixa entre tipos de alinhamento — apenas para ordenação/serialização determinística, nunca para escolher hipótese vencedora ou atribuir maior valor probatório (§12). */
  readonly alignmentTypePriorityOrder: ReadonlyArray<RecurrentVerticalAlignmentType>;

  /** Identidade versionada da política de canonicalização aplicada à fronteira de saída — reaproveitada das Sprints anteriores, nunca às comparações internas. */
  readonly geometryCanonicalizationVersion: string;
}

// --- problemas técnicos controlados (§11) -------------------------------------

export type PhysicalColumnHypothesisReconstructionTechnicalProblemCode =
  | "source_contract_version_unsupported"
  | "source_lineage_mismatch"
  | "source_fingerprint_invalid"
  | "source_structure_reconstruction_contract_invalid"
  | "source_tabular_region_detection_contract_invalid"
  | "source_reference_invalid"
  | "source_candidate_page_not_detectable"
  | "physical_vertical_band_construction_failed"
  | "physical_column_hypothesis_formation_failed"
  | "physical_column_hypothesis_conservation_failed"
  | "physical_column_hypothesis_reconstruction_failed";

export type PhysicalColumnHypothesisReconstructionTechnicalProblemPhase =
  | "source_validation"
  | "candidate_group_processing"
  | "candidate_page_processing"
  | "candidate_region_processing"
  | "band_construction"
  | "hypothesis_formation"
  | "conservation_validation";

export interface PhysicalColumnHypothesisReconstructionTechnicalProblem {
  readonly code: PhysicalColumnHypothesisReconstructionTechnicalProblemCode;
  readonly phase: PhysicalColumnHypothesisReconstructionTechnicalProblemPhase;
  readonly groupKey: string | null;
  readonly pageNumber: number | null;
  readonly regionKey: string | null;
  readonly lineKey: string | null;
  readonly segmentKey: string | null;
  /** Mensagem técnica controlada pelo domínio — nunca stack trace, caminho absoluto ou erro bruto. */
  readonly message: string;
}

// --- limitações estáveis (§16 doc) --------------------------------------------

export type PhysicalColumnHypothesisReconstructionLimitationCode =
  | "physical_column_hypothesis_is_not_a_confirmed_column"
  | "physical_column_hypothesis_is_not_a_cell"
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
  | "no_numeric_fusion_tolerance_applied"
  | "orphan_segments_never_absorbed_by_containment_or_proximity"
  | "unresolved_structures_remain_explicit"
  | "real_document_out_of_scope"
  | "no_commercial_readiness_claim";

// --- estados (§14) -------------------------------------------------------------

export type PhysicalColumnHypothesisReconstructionStatus = "completed" | "completed_with_problems" | "failed";

export type PhysicalColumnHypothesisReconstructionRegionStatus =
  | "hypotheses_reconstructed"
  | "hypotheses_reconstructed_with_ambiguity"
  | "no_physical_column_hypothesis"
  | "region_not_processable";

export type PhysicalColumnHypothesisReconstructionPageStatus =
  | "hypotheses_reconstructed"
  | "hypotheses_reconstructed_with_problems"
  | "no_physical_column_hypothesis"
  | "page_not_processable";

export type PhysicalColumnHypothesisReconstructionGroupStatus =
  | "hypotheses_reconstructed"
  | "hypotheses_reconstructed_with_problems"
  | "no_physical_column_hypothesis"
  | "group_not_processable";

// --- métricas objetivas --------------------------------------------------------

export interface RegionPhysicalColumnHypothesisReconstructionMetrics {
  readonly totalSegmentCount: number;
  readonly includedSegmentCount: number;
  readonly notIncludedSegmentCount: number;
  readonly ambiguousSegmentCount: number;
  readonly detectionFailedSegmentCount: number;
  readonly hypothesisCount: number;
}

export interface PagePhysicalColumnHypothesisReconstructionMetrics {
  readonly totalRegionCount: number;
  readonly hypothesesReconstructedRegionCount: number;
  readonly hypothesesReconstructedWithAmbiguityRegionCount: number;
  readonly noPhysicalColumnHypothesisRegionCount: number;
  readonly regionNotProcessableRegionCount: number;
  readonly segmentCount: number;
  readonly hypothesisCount: number;
}

export interface GroupPhysicalColumnHypothesisReconstructionMetrics {
  readonly totalPageCount: number;
  readonly hypothesesReconstructedPageCount: number;
  readonly hypothesesReconstructedWithProblemsPageCount: number;
  readonly noPhysicalColumnHypothesisPageCount: number;
  readonly pageNotProcessablePageCount: number;
  readonly segmentCount: number;
  readonly hypothesisCount: number;
}

export interface GlobalPhysicalColumnHypothesisReconstructionMetrics {
  readonly receivedGroupCount: number;
  readonly hypothesesReconstructedGroupCount: number;
  readonly hypothesesReconstructedWithProblemsGroupCount: number;
  readonly noPhysicalColumnHypothesisGroupCount: number;
  readonly groupNotProcessableGroupCount: number;
  readonly candidateRegionCount: number;
  readonly segmentCount: number;
  readonly hypothesisCount: number;
}

// --- região processada (§7) -----------------------------------------------------

export interface PhysicalColumnHypothesisReconstructionRegion {
  /** Chave própria desta etapa (namespace para hipóteses) — nunca a chave da região de origem. */
  readonly regionProcessedKey: string;
  /** Referência literal, nunca copiada, à região candidata de origem (`TabularRegionCandidate.regionKey`, Sprint 21.4A.2.f.2a). */
  readonly sourceRegionKey: string;
  readonly pageNumber: number;
  readonly status: PhysicalColumnHypothesisReconstructionRegionStatus;
  readonly hypotheses: ReadonlyArray<PhysicalColumnHypothesis>;
  readonly segmentDispositions: ReadonlyArray<PhysicalColumnHypothesisSegmentDisposition>;
  readonly technicalProblems: ReadonlyArray<PhysicalColumnHypothesisReconstructionTechnicalProblem>;
  readonly metrics: RegionPhysicalColumnHypothesisReconstructionMetrics;
  readonly profileId: string;
  readonly profileVersion: number;
}

// --- página processada -----------------------------------------------------------

export interface PhysicalColumnHypothesisReconstructionPage {
  /** Chave própria desta etapa — nunca a `pageReconstructionKey` da f.2a (que também não é a chave física de origem; ver auditoria da Sprint 21.4A.2.f.2b). */
  readonly pageProcessedKey: string;
  readonly pageNumber: number;
  readonly status: PhysicalColumnHypothesisReconstructionPageStatus;
  readonly regions: ReadonlyArray<PhysicalColumnHypothesisReconstructionRegion>;
  readonly technicalProblems: ReadonlyArray<PhysicalColumnHypothesisReconstructionTechnicalProblem>;
  readonly metrics: PagePhysicalColumnHypothesisReconstructionMetrics;
}

// --- grupo processado --------------------------------------------------------------

export interface PhysicalColumnHypothesisReconstructionGroup {
  /** Chave própria desta etapa — nunca a `groupReconstructionKey` da f.2a. */
  readonly groupProcessedKey: string;
  /** Referência literal, estável desde a localização de páginas, através da f.2a.1 e da f.2a.2. */
  readonly sourceCandidateGroupKey: string;
  readonly status: PhysicalColumnHypothesisReconstructionGroupStatus;
  readonly pageKeys: ReadonlyArray<string>;
  readonly pages: ReadonlyArray<PhysicalColumnHypothesisReconstructionPage>;
  readonly technicalProblems: ReadonlyArray<PhysicalColumnHypothesisReconstructionTechnicalProblem>;
  readonly metrics: GroupPhysicalColumnHypothesisReconstructionMetrics;
}

// --- resultado global ------------------------------------------------------------------

export interface BudgetDocumentPhysicalColumnHypothesisReconstructionResult {
  readonly schemaVersion: typeof BUDGET_DOCUMENT_PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTION_SCHEMA_VERSION;
  readonly reconstructorName: typeof BUDGET_DOCUMENT_PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTOR_NAME;
  readonly reconstructorVersion: typeof BUDGET_DOCUMENT_PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTOR_VERSION;
  readonly reconstructionProfileId: string;
  readonly reconstructionProfileVersion: number;
  readonly reconstructionContextFingerprintVersion: typeof PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTION_CONTEXT_FINGERPRINT_VERSION;
  /** Fingerprint final — incorpora identidades de origem (das duas etapas consumidas) *e* o conteúdo canônico das hipóteses e disposições produzidas. */
  readonly reconstructionContextFingerprint: string;
  readonly sourceByteHash: string;
  /** Identidades individuais da reconstrução estrutural (f.2a.1) consumida — preservadas isoladamente, nunca substituídas pelo fingerprint que as resume. */
  readonly sourceStructureReconstructionSchemaVersion: BudgetDocumentStructureReconstructionResult["schemaVersion"];
  readonly sourceStructureReconstructorName: BudgetDocumentStructureReconstructionResult["reconstructorName"];
  readonly sourceStructureReconstructorVersion: BudgetDocumentStructureReconstructionResult["reconstructorVersion"];
  readonly sourceStructureReconstructionProfileId: BudgetDocumentStructureReconstructionResult["reconstructionProfileId"];
  readonly sourceStructureReconstructionProfileVersion: BudgetDocumentStructureReconstructionResult["reconstructionProfileVersion"];
  readonly sourceStructureReconstructionContextFingerprintVersion: BudgetDocumentStructureReconstructionResult["reconstructionContextFingerprintVersion"];
  readonly sourceStructureReconstructionContextFingerprint: BudgetDocumentStructureReconstructionResult["reconstructionContextFingerprint"];
  /** Identidades individuais da detecção de regiões (f.2a.2) consumida — preservadas isoladamente. */
  readonly sourceTabularRegionDetectionSchemaVersion: BudgetDocumentTabularRegionDetectionResult["schemaVersion"];
  readonly sourceTabularRegionDetectorName: BudgetDocumentTabularRegionDetectionResult["detectorName"];
  readonly sourceTabularRegionDetectorVersion: BudgetDocumentTabularRegionDetectionResult["detectorVersion"];
  readonly sourceTabularRegionDetectionProfileId: BudgetDocumentTabularRegionDetectionResult["detectionProfileId"];
  readonly sourceTabularRegionDetectionProfileVersion: BudgetDocumentTabularRegionDetectionResult["detectionProfileVersion"];
  readonly sourceTabularRegionDetectionContextFingerprintVersion: BudgetDocumentTabularRegionDetectionResult["detectionContextFingerprintVersion"];
  readonly sourceTabularRegionDetectionContextFingerprint: BudgetDocumentTabularRegionDetectionResult["detectionContextFingerprint"];
  readonly status: PhysicalColumnHypothesisReconstructionStatus;
  readonly groups: ReadonlyArray<PhysicalColumnHypothesisReconstructionGroup>;
  readonly technicalProblems: ReadonlyArray<PhysicalColumnHypothesisReconstructionTechnicalProblem>;
  readonly metrics: GlobalPhysicalColumnHypothesisReconstructionMetrics;
  readonly limitations: ReadonlyArray<PhysicalColumnHypothesisReconstructionLimitationCode>;
}
