import type { BudgetDocumentPageLocationResult, BudgetPageCandidateType, BudgetPageLocationReasonCode } from "../page-location/budget-page-location.types";
import type { PhysicalDocumentReadResult } from "../physical-document-read.types";

/**
 * Contrato puro da reconstrução estrutural física dos grupos candidatos
 * (Sprint 21.4A.2.f.1). Responde apenas "como os itens textuais
 * geometricamente posicionados das páginas candidatas se organizam
 * fisicamente em linhas, segmentos e blocos?" — nunca "quais são as
 * linhas orçamentárias, colunas econômicas, valores, quantidades,
 * unidades ou itens de serviço?". Consome exclusivamente os contratos já
 * produzidos por `PhysicalDocumentReadResult` (leitura física, schema v2)
 * e `BudgetDocumentPageLocationResult` (localização, schema v1) — nunca
 * bytes, PDF, objetos de biblioteca ou infraestrutura.
 */

export const BUDGET_DOCUMENT_STRUCTURE_RECONSTRUCTION_SCHEMA_VERSION = 1 as const;

export const BUDGET_DOCUMENT_STRUCTURE_RECONSTRUCTOR_NAME = "budget-document-structure-reconstructor" as const;

export const BUDGET_DOCUMENT_STRUCTURE_RECONSTRUCTOR_VERSION = "budget-document-structure-reconstructor-v1" as const;

export const STRUCTURE_RECONSTRUCTION_CONTEXT_FINGERPRINT_VERSION =
  "budget-document-structure-reconstruction-context-fingerprint-v1" as const;

/** Porta de entrada: os dois contratos já produzidos pelas Sprints anteriores, nunca reconstruídos ou recalculados aqui. */
export interface BudgetDocumentStructureReconstructionInput {
  readonly physicalRead: PhysicalDocumentReadResult;
  readonly pageLocation: BudgetDocumentPageLocationResult;
}

// --- disposição auditável de cada item textual (§20-22) ---------------------

export type SourceTextItemReconstructionOutcome =
  | {
      readonly status: "placed";
      readonly sourceTextItemIndex: number;
      readonly lineKey: string;
      readonly segmentKey: string;
    }
  | {
      readonly status: "ignored_whitespace_only";
      readonly sourceTextItemIndex: number;
    }
  | {
      readonly status: "excluded_outside_page";
      readonly sourceTextItemIndex: number;
    }
  | {
      readonly status: "unresolved_source_geometry_missing";
      readonly sourceTextItemIndex: number;
    }
  | {
      readonly status: "unresolved_source_geometry_invalid";
      readonly sourceTextItemIndex: number;
    }
  | {
      readonly status: "unresolved_source_orientation_unsupported";
      readonly sourceTextItemIndex: number;
    }
  | {
      readonly status: "unresolved_source_geometry_normalization_failed";
      readonly sourceTextItemIndex: number;
    }
  | {
      /**
       * Falha técnica na própria reconstrução estrutural (linha ou
       * segmento) — nunca confundida com `excluded_outside_page`, que
       * descreve uma observação geométrica real, não uma falha de
       * processamento (auditoria pós-PR #69, §3). Um item que estava
       * dentro (ou parcialmente dentro) da página nunca é declarado "fora
       * da página" apenas porque uma função estrutural falhou.
       */
      readonly status: "unresolved_structure_reconstruction_failed";
      readonly sourceTextItemIndex: number;
      readonly failedPhase: "line_reconstruction" | "segment_reconstruction";
    };

// --- perfil de reconstrução versionado (§18) --------------------------------

export interface BudgetDocumentStructureReconstructionProfile {
  readonly profileId: string;
  readonly profileVersion: number;

  /** Razão mínima de sobreposição vertical (em pontos, adimensional) exigida entre dois itens para serem compatíveis de linha. */
  readonly minimumPairVerticalOverlapRatio: number;
  /** Razão máxima entre a distância dos centros verticais (em pontos) e a menor altura do par, exigida para compatibilidade de linha. */
  readonly maximumPairCenterDistanceToMinimumHeightRatio: number;

  /** Razão máxima entre a lacuna horizontal (em pontos) e a altura mediana dos itens da linha, para permanecer no mesmo segmento. */
  readonly maximumSegmentGapToMedianItemHeightRatio: number;

  /** Razão máxima entre a lacuna vertical (em pontos) e a altura mediana das duas linhas, para candidatura de bloco. */
  readonly maximumBlockVerticalGapToMedianLineHeightRatio: number;
  /** Razão mínima de sobreposição horizontal (em pontos, adimensional) para candidatura de bloco por sobreposição. */
  readonly minimumBlockHorizontalOverlapRatio: number;
  /** Razão máxima entre a lacuna horizontal (em pontos) e a altura mediana dos dois segmentos, para candidatura de bloco por proximidade. */
  readonly maximumBlockHorizontalGapToMedianSegmentHeightRatio: number;

  readonly requireCompleteLineCompatibility: true;
  readonly requireMutualBlockAdjacency: true;

  /** Identidade versionada da política de canonicalização aplicada à fronteira de saída (auditoria pós-PR #69, §7) — nunca às comparações internas. */
  readonly geometryCanonicalizationVersion: string;
}

// --- faixa física de linha (§24-29) -----------------------------------------

export interface ReconstructedPhysicalLine {
  readonly lineKey: string;
  readonly pageNumber: number;
  /** Ordem vertical determinística dentro da página, 1-based. */
  readonly verticalOrder: number;
  readonly leftPoints: number;
  readonly topPoints: number;
  readonly rightPoints: number;
  readonly bottomPoints: number;
  readonly widthPoints: number;
  readonly heightPoints: number;
  readonly centerXPoints: number;
  readonly centerYPoints: number;
  readonly seedSourceTextItemIndex: number;
  /** Índices dos itens de origem, em ordem canônica (§23). */
  readonly sourceTextItemIndices: ReadonlyArray<number>;
  /** Chaves dos segmentos desta linha, em ordem horizontal. */
  readonly segmentKeys: ReadonlyArray<string>;
  readonly formationRuleId: string;
  readonly formationRuleVersion: number;
  readonly profileId: string;
  readonly profileVersion: number;
}

// --- segmento horizontal (§30-33) -------------------------------------------

export interface ReconstructedHorizontalSegment {
  readonly segmentKey: string;
  readonly lineKey: string;
  readonly pageNumber: number;
  /** Ordem horizontal determinística dentro da linha, 1-based. */
  readonly horizontalOrder: number;
  readonly leftPoints: number;
  readonly topPoints: number;
  readonly rightPoints: number;
  readonly bottomPoints: number;
  readonly widthPoints: number;
  readonly heightPoints: number;
  readonly centerXPoints: number;
  readonly centerYPoints: number;
  /** Índices dos itens de origem, em ordem esquerda-direita. */
  readonly sourceTextItemIndices: ReadonlyArray<number>;
  /** Lacuna normalizada observada entre cada par consecutivo de itens deste segmento (comprimento = itens - 1). */
  readonly observedInternalGaps: ReadonlyArray<number>;
  readonly formationRuleId: string;
  readonly formationRuleVersion: number;
  readonly profileId: string;
  readonly profileVersion: number;
}

// --- bloco físico bidimensional (§35-40) ------------------------------------

export interface ReconstructedPhysicalTextBlock {
  readonly blockKey: string;
  readonly pageNumber: number;
  /** Ordem determinística do bloco dentro da página, 1-based. */
  readonly order: number;
  /** Chaves das linhas participantes, em ordem vertical. */
  readonly lineKeys: ReadonlyArray<string>;
  /** Chaves dos segmentos participantes, em ordem (linha, depois horizontal). */
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

// --- problemas técnicos controlados (§52) -----------------------------------

export type StructureReconstructionTechnicalProblemCode =
  | "source_contract_version_unsupported"
  | "source_lineage_mismatch"
  | "physical_read_contract_invalid"
  | "geometry_context_fingerprint_invalid"
  | "page_location_contract_invalid"
  | "candidate_group_contract_invalid"
  | "candidate_page_not_found"
  | "candidate_page_text_unavailable"
  | "candidate_page_has_no_eligible_items"
  | "candidate_page_contains_unresolved_items"
  | "candidate_page_contains_outside_items"
  | "candidate_page_contains_partially_outside_items"
  | "physical_line_reconstruction_failed"
  | "horizontal_segment_reconstruction_failed"
  | "physical_block_reconstruction_failed"
  | "structure_reconstruction_failed";

export type StructureReconstructionTechnicalProblemPhase =
  | "source_validation"
  | "candidate_group_processing"
  | "candidate_page_processing"
  | "line_reconstruction"
  | "segment_reconstruction"
  | "block_reconstruction";

export interface StructureReconstructionTechnicalProblem {
  readonly code: StructureReconstructionTechnicalProblemCode;
  readonly phase: StructureReconstructionTechnicalProblemPhase;
  readonly groupKey: string | null;
  readonly pageNumber: number | null;
  readonly sourceTextItemIndex: number | null;
  /** Mensagem técnica controlada pelo domínio — nunca stack trace, caminho absoluto ou erro bruto. */
  readonly message: string;
}

// --- limitações estáveis (§63) ----------------------------------------------

export type StructureReconstructionLimitationCode =
  | "physical_line_is_not_a_budget_line"
  | "horizontal_segment_is_not_a_column"
  | "physical_block_is_not_a_table"
  | "no_textual_semantics_applied"
  | "no_header_identified"
  | "no_footer_identified"
  | "no_cell_created"
  | "no_service_code_read"
  | "no_unit_read"
  | "no_quantity_read"
  | "no_price_read"
  | "no_total_read"
  | "no_economic_bdi_interpreted"
  | "no_economic_group_created"
  | "no_budget_version_created"
  | "cross_page_continuity_is_future_work"
  | "unresolved_items_remain_explicit"
  | "outside_page_items_excluded_but_audited"
  | "rtl_ttb_skew_shear_are_source_limitations"
  | "no_commercial_readiness_claim"
  | "real_document_out_of_scope";

// --- status técnicos (§50) --------------------------------------------------

export type StructureReconstructionStatus = "completed" | "completed_with_problems" | "failed";
export type ReconstructedGroupStatus = "reconstructed" | "reconstructed_with_problems" | "not_reconstructable";
export type ReconstructedPageStatus = "reconstructed" | "reconstructed_with_problems" | "not_reconstructable";

// --- métricas objetivas (§49) -----------------------------------------------

export interface PageStructureReconstructionMetrics {
  readonly totalSourceTextItemCount: number;
  readonly placedTextItemCount: number;
  readonly ignoredWhitespaceOnlyCount: number;
  readonly excludedOutsidePageCount: number;
  readonly unresolvedMissingGeometryCount: number;
  readonly unresolvedInvalidGeometryCount: number;
  readonly unresolvedUnsupportedOrientationCount: number;
  readonly unresolvedNormalizationFailedCount: number;
  /** Itens elegíveis não colocados por falha técnica de reconstrução de linha ou segmento (nunca por observação geométrica real). */
  readonly unresolvedStructureReconstructionFailedCount: number;
  readonly lineCount: number;
  readonly segmentCount: number;
  readonly blockCount: number;
}

export interface GroupStructureReconstructionMetrics {
  readonly totalPageCount: number;
  readonly reconstructedPageCount: number;
  readonly reconstructedWithProblemsPageCount: number;
  readonly notReconstructablePageCount: number;
  readonly lineCount: number;
  readonly segmentCount: number;
  readonly blockCount: number;
}

export interface GlobalStructureReconstructionMetrics {
  readonly receivedGroupCount: number;
  readonly reconstructedGroupCount: number;
  readonly reconstructedWithProblemsGroupCount: number;
  readonly notReconstructableGroupCount: number;
  readonly candidatePageCount: number;
  readonly sourceTextItemCount: number;
  readonly lineCount: number;
  readonly segmentCount: number;
  readonly blockCount: number;
}

// --- página reconstruída (§48) ----------------------------------------------

export interface ReconstructedBudgetDocumentPage {
  readonly pageReconstructionKey: string;
  readonly pageNumber: number;
  readonly candidateType: BudgetPageCandidateType;
  readonly sourceDecisionReasonCode: BudgetPageLocationReasonCode;
  readonly status: ReconstructedPageStatus;
  readonly sourceItemOutcomes: ReadonlyArray<SourceTextItemReconstructionOutcome>;
  readonly lines: ReadonlyArray<ReconstructedPhysicalLine>;
  readonly segments: ReadonlyArray<ReconstructedHorizontalSegment>;
  readonly blocks: ReadonlyArray<ReconstructedPhysicalTextBlock>;
  readonly technicalProblems: ReadonlyArray<StructureReconstructionTechnicalProblem>;
  readonly metrics: PageStructureReconstructionMetrics;
  readonly profileId: string;
  readonly profileVersion: number;
}

// --- grupo reconstruído (§47) ------------------------------------------------

export interface ReconstructedBudgetDocumentGroup {
  readonly sourceCandidateGroupKey: string;
  readonly groupReconstructionKey: string;
  readonly startPageNumber: number;
  readonly endPageNumber: number;
  readonly candidateTypesPresent: ReadonlyArray<BudgetPageCandidateType>;
  readonly hasClosingPage: boolean;
  readonly status: ReconstructedGroupStatus;
  readonly pageKeys: ReadonlyArray<string>;
  readonly pages: ReadonlyArray<ReconstructedBudgetDocumentPage>;
  readonly technicalProblems: ReadonlyArray<StructureReconstructionTechnicalProblem>;
  readonly metrics: GroupStructureReconstructionMetrics;
}

// --- resultado global (§43) --------------------------------------------------

export interface BudgetDocumentStructureReconstructionResult {
  readonly schemaVersion: typeof BUDGET_DOCUMENT_STRUCTURE_RECONSTRUCTION_SCHEMA_VERSION;
  readonly reconstructorName: typeof BUDGET_DOCUMENT_STRUCTURE_RECONSTRUCTOR_NAME;
  readonly reconstructorVersion: typeof BUDGET_DOCUMENT_STRUCTURE_RECONSTRUCTOR_VERSION;
  readonly reconstructionProfileId: string;
  readonly reconstructionProfileVersion: number;
  readonly reconstructionContextFingerprintVersion: typeof STRUCTURE_RECONSTRUCTION_CONTEXT_FINGERPRINT_VERSION;
  readonly reconstructionContextFingerprint: string;
  readonly sourceByteHash: string;
  readonly physicalReadSchemaVersion: number;
  readonly physicalReaderName: string;
  readonly physicalReaderVersion: string;
  /**
   * Identidades individuais da leitura física e da localização, além do
   * fingerprint que as resume (auditoria pós-PR #69, §6). O fingerprint
   * nunca substitui estes campos — cada um permanece auditável
   * isoladamente, inclusive quando `status` é `failed`.
   */
  readonly physicalAdapterVersion: PhysicalDocumentReadResult["adapterVersion"];
  readonly physicalUnderlyingLibraryVersion: PhysicalDocumentReadResult["underlyingLibraryVersion"];
  readonly physicalTextItemCoordinateSpaceVersion: PhysicalDocumentReadResult["textItemCoordinateSpaceVersion"];
  readonly physicalTextItemGeometryProfileVersion: PhysicalDocumentReadResult["textItemGeometryProfileVersion"];
  readonly physicalGeometryContextFingerprintVersion: PhysicalDocumentReadResult["geometryContextFingerprintVersion"];
  readonly physicalGeometryContextFingerprint: PhysicalDocumentReadResult["geometryContextFingerprint"];
  readonly pageLocationSchemaVersion: number;
  readonly pageLocatorName: string;
  readonly pageLocatorVersion: string;
  readonly pageLocationDecisionRuleSetVersion: BudgetDocumentPageLocationResult["decisionRuleSetVersion"];
  readonly sourceObservationSchemaVersion: BudgetDocumentPageLocationResult["sourceObservationSchemaVersion"];
  readonly sourceObserverName: BudgetDocumentPageLocationResult["sourceObserverName"];
  readonly sourceObserverVersion: BudgetDocumentPageLocationResult["sourceObserverVersion"];
  readonly sourceObservationRuleSetVersion: BudgetDocumentPageLocationResult["sourceObservationRuleSetVersion"];
  readonly sourceCatalogVersion: BudgetDocumentPageLocationResult["sourceCatalogVersion"];
  readonly status: StructureReconstructionStatus;
  readonly groups: ReadonlyArray<ReconstructedBudgetDocumentGroup>;
  readonly technicalProblems: ReadonlyArray<StructureReconstructionTechnicalProblem>;
  readonly metrics: GlobalStructureReconstructionMetrics;
  readonly limitations: ReadonlyArray<StructureReconstructionLimitationCode>;
}
