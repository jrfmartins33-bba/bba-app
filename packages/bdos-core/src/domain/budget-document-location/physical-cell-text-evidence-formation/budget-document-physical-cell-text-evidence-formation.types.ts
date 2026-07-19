import type { PhysicalDocumentReadResult, PhysicalDocumentReadStatus } from "../physical-document-read.types";
import type { BudgetDocumentStructureReconstructionResult, StructureReconstructionStatus } from "../structure-reconstruction/budget-document-structure-reconstruction.types";
import type { BudgetDocumentPhysicalCellHypothesisFormationResult, PhysicalCellHypothesisFormationGroupStatus, PhysicalCellHypothesisFormationPageStatus, PhysicalCellHypothesisFormationRegionStatus, PhysicalCellHypothesisFormationStatus } from "../physical-cell-hypothesis-formation/budget-document-physical-cell-hypothesis-formation.types";

/**
 * Contrato puro da Sprint 21.4A.2.g.1. Responde apenas "quais itens textuais
 * físicos sustentam cada hipótese física de célula produzida pela f.2c, e qual
 * foi o resultado auditável da resolução de cada segmento e de cada ocorrência
 * textual?" — nunca "qual é o significado econômico desse texto?". A f.2c
 * continua sendo a única fonte da verdade para interseções, interseções
 * vazias, gridBounds, observedContentBounds, ambiguidades da malha, falhas
 * físicas, disposições de segmento e segmentos fora de célula: esta
 * capacidade amplia, nunca substitui, o resultado da f.2c.
 */

export const BUDGET_DOCUMENT_PHYSICAL_CELL_TEXT_EVIDENCE_FORMATION_SCHEMA_VERSION = 1 as const;
export const BUDGET_DOCUMENT_PHYSICAL_CELL_TEXT_EVIDENCE_FORMATION_ENGINE_NAME = "budget-document-physical-cell-text-evidence-formation-engine" as const;
export const BUDGET_DOCUMENT_PHYSICAL_CELL_TEXT_EVIDENCE_FORMATION_ENGINE_VERSION = "budget-document-physical-cell-text-evidence-formation-engine-v1" as const;
export const PHYSICAL_CELL_TEXT_EVIDENCE_FORMATION_CONTEXT_FINGERPRINT_VERSION = "budget-document-physical-cell-text-evidence-formation-context-fingerprint-v1" as const;
/** Identidade explícita da regra de normalização por item. Participa do fingerprint e das validações de compatibilidade — nunca localização de código ou conteúdo do arquivo. */
export const PHYSICAL_CELL_TEXT_EVIDENCE_NORMALIZATION_VERSION = "physical-cell-text-evidence-normalization-v1" as const;
/** Identidade da regra de montagem/ordenação de fragmentos: preserva sourceReferenceOrder de segment.sourceTextItemIndices, nunca recalcula. */
export const PHYSICAL_CELL_TEXT_FRAGMENT_ASSEMBLY_RULE_ID = "physical-cell-text-fragment-assembly-source-order-v1" as const;
export const PHYSICAL_CELL_TEXT_FRAGMENT_ASSEMBLY_RULE_VERSION = 1 as const;

/** Porta de entrada: os três contratos já produzidos pelas Sprints anteriores. Nenhuma releitura do PDF; nenhum outro contrato é consumido. */
export interface BudgetDocumentPhysicalCellTextEvidenceFormationInput {
  readonly physicalRead: PhysicalDocumentReadResult;
  readonly structureReconstruction: BudgetDocumentStructureReconstructionResult;
  readonly physicalCellHypothesisFormation: BudgetDocumentPhysicalCellHypothesisFormationResult;
}

// --- fragmento e ocorrência --------------------------------------------------

export interface PhysicalCellTextFragment {
  /** Posição 1-based da referência dentro de ReconstructedHorizontalSegment.sourceTextItemIndices — nunca recalculada. */
  readonly sourceReferenceOrder: number;
  readonly textItemIndex: number;
  /** Verbatim, exatamente PhysicalDocumentTextItem.text do item de origem. Nunca normalizado, concatenado ou corrigido. */
  readonly originalText: string;
  /** normalizePageText([originalText]) — sempre string, nunca null. */
  readonly normalizedText: string;
}

export type PhysicalCellTextItemDisposition =
  | { readonly status: "included_in_text_fragment"; readonly segmentKey: string; readonly sourceReferenceOrder: number; readonly textItemIndex: number }
  | { readonly status: "unresolved_source_text_item_reference_invalid"; readonly segmentKey: string; readonly sourceReferenceOrder: number; readonly textItemIndex: number }
  | { readonly status: "unresolved_source_text_item_duplicate_reference"; readonly segmentKey: string; readonly sourceReferenceOrder: number; readonly textItemIndex: number; readonly conflictingReferences: ReadonlyArray<{ readonly segmentKey: string; readonly sourceReferenceOrder: number }> }
  | { readonly status: "unresolved_source_text_item_segment_mismatch"; readonly segmentKey: string; readonly sourceReferenceOrder: number; readonly textItemIndex: number; readonly actualOwningSegmentKey: string | null }
  | { readonly status: "unresolved_cell_text_evidence_formation_failed"; readonly segmentKey: string; readonly sourceReferenceOrder: number; readonly textItemIndex: number; readonly failedPhase: "text_item_resolution" | "fragment_assembly" };

// --- resultado por segmento da célula ----------------------------------------

export interface ResolvedPhysicalCellTextSegmentOutcome {
  readonly status: "resolved";
  readonly segmentKey: string;
  readonly lineKey: string;
  readonly fragments: ReadonlyArray<PhysicalCellTextFragment>;
  readonly itemDispositions: ReadonlyArray<PhysicalCellTextItemDisposition>;
}
export interface InvalidPhysicalCellTextSegmentReference {
  readonly status: "unresolved_segment_reference_invalid";
  readonly segmentKey: string;
}
export interface InvalidPhysicalCellTextSegmentLineReference {
  readonly status: "unresolved_segment_incompatible";
  readonly reason: "line_reference_invalid";
  readonly segmentKey: string;
  readonly referencedLineKey: string;
}
export interface PhysicalCellTextSegmentLineMismatch {
  readonly status: "unresolved_segment_incompatible";
  readonly reason: "line_mismatch";
  readonly segmentKey: string;
  readonly expectedLineKey: string;
  readonly actualLineKey: string;
}
export interface PhysicalCellTextSegmentPageMismatch {
  readonly status: "unresolved_segment_incompatible";
  readonly reason: "page_mismatch";
  readonly segmentKey: string;
  readonly expectedPageNumber: number;
  readonly actualPageNumber: number;
}
export interface PhysicalCellTextSegmentMultipleCellReference {
  readonly status: "unresolved_segment_incompatible";
  readonly reason: "referenced_by_multiple_cell_hypotheses";
  readonly segmentKey: string;
  readonly conflictingCellHypothesisKeys: ReadonlyArray<string>;
}
export interface FailedPhysicalCellTextSegmentOutcome {
  readonly status: "unresolved_segment_formation_failed";
  readonly segmentKey: string;
  readonly failedPhase: "segment_resolution" | "text_item_resolution" | "fragment_assembly";
}
export type PhysicalCellTextSegmentOutcome =
  | ResolvedPhysicalCellTextSegmentOutcome
  | InvalidPhysicalCellTextSegmentReference
  | InvalidPhysicalCellTextSegmentLineReference
  | PhysicalCellTextSegmentLineMismatch
  | PhysicalCellTextSegmentPageMismatch
  | PhysicalCellTextSegmentMultipleCellReference
  | FailedPhysicalCellTextSegmentOutcome;

// --- evidência textual de célula, união discriminada -------------------------

interface PhysicalCellTextEvidenceIdentity {
  readonly cellHypothesisKey: string;
  readonly gridIntersectionKey: string;
  readonly segmentOutcomes: ReadonlyArray<PhysicalCellTextSegmentOutcome>;
}
/** Todo segmentOutcome é "resolved" e nenhuma itemDisposition falhou. */
export interface PhysicalCellTextEvidenceFormed extends PhysicalCellTextEvidenceIdentity { readonly status: "formed"; }
/** Existe ao menos um fragmento seguro, mas alguma referência (de segmento ou de item) falhou. */
export interface PhysicalCellTextEvidencePartiallyFormed extends PhysicalCellTextEvidenceIdentity { readonly status: "partially_formed"; }
/** Nenhum fragmento textual seguro pôde ser produzido para esta célula. */
export interface PhysicalCellTextEvidenceUnresolvedTechnicalFailure extends PhysicalCellTextEvidenceIdentity { readonly status: "unresolved_technical_failure"; }
export type PhysicalCellTextEvidence = PhysicalCellTextEvidenceFormed | PhysicalCellTextEvidencePartiallyFormed | PhysicalCellTextEvidenceUnresolvedTechnicalFailure;

// --- problemas técnicos --------------------------------------------------------

export type PhysicalCellTextEvidenceFormationTechnicalProblemCode =
  | "source_contract_version_unsupported" | "source_lineage_mismatch" | "source_fingerprint_invalid"
  | "source_physical_read_contract_invalid" | "source_structure_reconstruction_contract_invalid" | "source_physical_cell_hypothesis_formation_contract_invalid"
  | "source_group_reference_invalid" | "source_page_reference_invalid" | "source_region_reference_invalid" | "source_grid_intersection_reference_invalid"
  | "source_cell_hypothesis_segment_order_invalid"
  | "source_line_reference_invalid" | "source_segment_reference_invalid" | "source_segment_incompatible"
  | "source_text_item_reference_invalid" | "source_text_item_duplicate_reference" | "source_text_item_segment_mismatch"
  | "cell_text_evidence_formation_failed"
  | "text_item_conservation_failed" | "segment_outcome_conservation_failed" | "cell_text_evidence_conservation_failed"
  | "physical_cell_text_evidence_formation_unexpected_failure";
export type PhysicalCellTextEvidenceFormationTechnicalProblemPhase =
  | "source_validation" | "candidate_group_processing" | "candidate_page_processing" | "candidate_region_processing"
  | "segment_resolution" | "text_item_resolution" | "fragment_assembly" | "conservation_validation";
export interface PhysicalCellTextEvidenceFormationTechnicalProblem {
  readonly code: PhysicalCellTextEvidenceFormationTechnicalProblemCode;
  readonly phase: PhysicalCellTextEvidenceFormationTechnicalProblemPhase;
  readonly groupKey: string | null; readonly pageNumber: number | null; readonly regionKey: string | null;
  readonly cellHypothesisKey: string | null; readonly gridIntersectionKey: string | null;
  readonly lineKey: string | null; readonly segmentKey: string | null;
  readonly sourceReferenceOrder: number | null; readonly textItemIndex: number | null;
  readonly message: string;
}

// --- estados hierárquicos ------------------------------------------------------

export type PhysicalCellTextEvidenceFormationRegionStatus = "formed" | "formed_with_problems" | "no_cell_hypotheses" | "region_not_processable";
export type PhysicalCellTextEvidenceFormationPageStatus = "formed" | "formed_with_problems" | "no_cell_hypotheses" | "page_not_processable";
export type PhysicalCellTextEvidenceFormationGroupStatus = "formed" | "formed_with_problems" | "no_cell_hypotheses" | "group_not_processable";
export type PhysicalCellTextEvidenceFormationStatus = "completed" | "completed_with_problems" | "failed";

// --- métricas ------------------------------------------------------------------

export interface RegionPhysicalCellTextEvidenceFormationMetrics {
  readonly sourceCellHypothesisCount: number;
  readonly cellTextEvidenceFormedCount: number; readonly cellTextEvidencePartiallyFormedCount: number; readonly cellTextEvidenceFailedCount: number;
  readonly sourceSegmentReferenceCount: number;
  readonly segmentResolvedCount: number; readonly segmentReferenceInvalidCount: number; readonly segmentIncompatibleCount: number; readonly segmentFormationFailedCount: number;
  readonly totalEligibleTextItemReferenceCount: number;
  readonly includedTextItemReferenceCount: number; readonly invalidReferenceTextItemCount: number; readonly duplicateReferenceTextItemCount: number;
  readonly segmentMismatchTextItemCount: number; readonly formationFailedTextItemCount: number;
  readonly technicalProblemCount: number;
}
export interface PagePhysicalCellTextEvidenceFormationMetrics {
  readonly totalRegionCount: number; readonly formedRegionCount: number; readonly formedWithProblemsRegionCount: number;
  readonly noCellHypothesesRegionCount: number; readonly regionNotProcessableCount: number;
  readonly sourceCellHypothesisCount: number; readonly cellTextEvidenceFormedCount: number; readonly cellTextEvidencePartiallyFormedCount: number; readonly cellTextEvidenceFailedCount: number;
  readonly sourceSegmentReferenceCount: number; readonly segmentResolvedCount: number; readonly segmentReferenceInvalidCount: number; readonly segmentIncompatibleCount: number; readonly segmentFormationFailedCount: number;
  readonly totalEligibleTextItemReferenceCount: number; readonly includedTextItemReferenceCount: number;
  readonly invalidReferenceTextItemCount: number; readonly duplicateReferenceTextItemCount: number; readonly segmentMismatchTextItemCount: number; readonly formationFailedTextItemCount: number;
  readonly technicalProblemCount: number;
}
export interface GroupPhysicalCellTextEvidenceFormationMetrics {
  readonly totalPageCount: number; readonly formedPageCount: number; readonly formedWithProblemsPageCount: number;
  readonly noCellHypothesesPageCount: number; readonly pageNotProcessableCount: number;
  readonly sourceCellHypothesisCount: number; readonly cellTextEvidenceFormedCount: number; readonly cellTextEvidencePartiallyFormedCount: number; readonly cellTextEvidenceFailedCount: number;
  readonly sourceSegmentReferenceCount: number; readonly segmentResolvedCount: number; readonly segmentReferenceInvalidCount: number; readonly segmentIncompatibleCount: number; readonly segmentFormationFailedCount: number;
  readonly totalEligibleTextItemReferenceCount: number; readonly includedTextItemReferenceCount: number;
  readonly invalidReferenceTextItemCount: number; readonly duplicateReferenceTextItemCount: number; readonly segmentMismatchTextItemCount: number; readonly formationFailedTextItemCount: number;
  readonly technicalProblemCount: number;
}
export interface GlobalPhysicalCellTextEvidenceFormationMetrics {
  readonly receivedGroupCount: number; readonly formedGroupCount: number; readonly formedWithProblemsGroupCount: number;
  readonly noCellHypothesesGroupCount: number; readonly groupNotProcessableCount: number;
  readonly candidatePageCount: number; readonly candidateRegionCount: number;
  readonly sourceCellHypothesisCount: number; readonly cellTextEvidenceFormedCount: number; readonly cellTextEvidencePartiallyFormedCount: number; readonly cellTextEvidenceFailedCount: number;
  readonly sourceSegmentReferenceCount: number; readonly segmentResolvedCount: number; readonly segmentReferenceInvalidCount: number; readonly segmentIncompatibleCount: number; readonly segmentFormationFailedCount: number;
  readonly totalEligibleTextItemReferenceCount: number; readonly includedTextItemReferenceCount: number;
  readonly invalidReferenceTextItemCount: number; readonly duplicateReferenceTextItemCount: number; readonly segmentMismatchTextItemCount: number; readonly formationFailedTextItemCount: number;
  readonly technicalProblemCount: number;
}

// --- contêineres hierárquicos, preservando estado upstream --------------------

export interface PhysicalCellTextEvidenceFormationRegion {
  readonly regionProcessedKey: string; readonly sourceRegionKey: string; readonly pageNumber: number;
  readonly sourcePhysicalCellHypothesisFormationRegionStatus: PhysicalCellHypothesisFormationRegionStatus;
  readonly status: PhysicalCellTextEvidenceFormationRegionStatus;
  readonly cellTextEvidences: ReadonlyArray<PhysicalCellTextEvidence>;
  readonly technicalProblems: ReadonlyArray<PhysicalCellTextEvidenceFormationTechnicalProblem>;
  readonly metrics: RegionPhysicalCellTextEvidenceFormationMetrics;
}
export interface PhysicalCellTextEvidenceFormationPage {
  readonly pageProcessedKey: string; readonly pageNumber: number;
  readonly sourcePhysicalCellHypothesisFormationPageStatus: PhysicalCellHypothesisFormationPageStatus;
  readonly status: PhysicalCellTextEvidenceFormationPageStatus;
  readonly regions: ReadonlyArray<PhysicalCellTextEvidenceFormationRegion>;
  readonly technicalProblems: ReadonlyArray<PhysicalCellTextEvidenceFormationTechnicalProblem>;
  readonly metrics: PagePhysicalCellTextEvidenceFormationMetrics;
}
export interface PhysicalCellTextEvidenceFormationGroup {
  readonly groupProcessedKey: string; readonly sourceCandidateGroupKey: string;
  readonly sourcePhysicalCellHypothesisFormationGroupStatus: PhysicalCellHypothesisFormationGroupStatus;
  readonly status: PhysicalCellTextEvidenceFormationGroupStatus;
  readonly pageKeys: ReadonlyArray<string>; readonly pages: ReadonlyArray<PhysicalCellTextEvidenceFormationPage>;
  readonly technicalProblems: ReadonlyArray<PhysicalCellTextEvidenceFormationTechnicalProblem>;
  readonly metrics: GroupPhysicalCellTextEvidenceFormationMetrics;
}

// --- limitações -----------------------------------------------------------------

export type PhysicalCellTextEvidenceFormationLimitationCode =
  | "physical_cell_text_evidence_augments_but_does_not_replace_physical_cell_hypothesis_formation"
  | "physical_cell_text_evidence_is_not_a_confirmed_document_cell" | "physical_cell_text_evidence_is_not_an_economic_field"
  | "original_text_is_preserved_separately" | "normalized_text_is_not_source_verbatim" | "no_derived_display_text_created"
  | "no_structured_neutral_evidence_produced" | "no_document_row_created" | "no_header_identified" | "no_footer_identified"
  | "no_service_code_read" | "no_description_interpreted" | "no_unit_read" | "no_quantity_read" | "no_price_read" | "no_total_read"
  | "no_economic_bdi_interpreted" | "no_budget_line_created" | "no_budget_version_created" | "no_import_proposal_created"
  | "no_cross_page_continuity_evaluated" | "unresolved_ambiguities_remain_explicit" | "no_ai_or_ocr_applied"
  | "no_persistence" | "no_api_or_route" | "no_user_interface" | "no_physical_audit_viewer"
  | "real_document_out_of_scope" | "no_commercial_readiness_claim";

// --- resultado global -----------------------------------------------------------

export interface BudgetDocumentPhysicalCellTextEvidenceFormationResult {
  readonly schemaVersion: typeof BUDGET_DOCUMENT_PHYSICAL_CELL_TEXT_EVIDENCE_FORMATION_SCHEMA_VERSION;
  readonly formationEngineName: typeof BUDGET_DOCUMENT_PHYSICAL_CELL_TEXT_EVIDENCE_FORMATION_ENGINE_NAME;
  readonly formationEngineVersion: typeof BUDGET_DOCUMENT_PHYSICAL_CELL_TEXT_EVIDENCE_FORMATION_ENGINE_VERSION;
  readonly formationProfileId: string;
  readonly formationProfileVersion: number;
  readonly normalizationVersion: typeof PHYSICAL_CELL_TEXT_EVIDENCE_NORMALIZATION_VERSION;
  readonly fragmentAssemblyRuleId: typeof PHYSICAL_CELL_TEXT_FRAGMENT_ASSEMBLY_RULE_ID;
  readonly fragmentAssemblyRuleVersion: typeof PHYSICAL_CELL_TEXT_FRAGMENT_ASSEMBLY_RULE_VERSION;
  readonly formationContextFingerprintVersion: typeof PHYSICAL_CELL_TEXT_EVIDENCE_FORMATION_CONTEXT_FINGERPRINT_VERSION;
  readonly formationContextFingerprint: string;
  readonly sourceByteHash: string;

  readonly sourcePhysicalReadSchemaVersion: number;
  readonly sourcePhysicalReaderName: string;
  readonly sourcePhysicalReaderVersion: string;
  readonly sourcePhysicalAdapterVersion: string;
  readonly sourcePhysicalUnderlyingLibraryVersion: string | null;
  readonly sourcePhysicalTextItemCoordinateSpaceVersion: string;
  readonly sourcePhysicalTextItemGeometryProfileVersion: string;
  readonly sourcePhysicalGeometryContextFingerprintVersion: string;
  readonly sourcePhysicalGeometryContextFingerprint: string;
  readonly sourcePhysicalReadStatus: PhysicalDocumentReadStatus;

  readonly sourceStructureReconstructionSchemaVersion: number;
  readonly sourceStructureReconstructorName: string;
  readonly sourceStructureReconstructorVersion: string;
  readonly sourceStructureReconstructionProfileId: string;
  readonly sourceStructureReconstructionProfileVersion: number;
  readonly sourceStructureReconstructionContextFingerprintVersion: string;
  readonly sourceStructureReconstructionContextFingerprint: string;
  readonly sourceStructureReconstructionStatus: StructureReconstructionStatus;

  readonly sourcePhysicalCellHypothesisFormationSchemaVersion: number;
  readonly sourcePhysicalCellHypothesisFormationEngineName: string;
  readonly sourcePhysicalCellHypothesisFormationEngineVersion: string;
  readonly sourcePhysicalCellHypothesisFormationProfileId: string;
  readonly sourcePhysicalCellHypothesisFormationProfileVersion: number;
  readonly sourcePhysicalCellHypothesisFormationContextFingerprintVersion: string;
  readonly sourcePhysicalCellHypothesisFormationContextFingerprint: string;
  readonly sourcePhysicalCellHypothesisFormationStatus: PhysicalCellHypothesisFormationStatus;

  readonly status: PhysicalCellTextEvidenceFormationStatus;
  readonly groups: ReadonlyArray<PhysicalCellTextEvidenceFormationGroup>;
  readonly technicalProblems: ReadonlyArray<PhysicalCellTextEvidenceFormationTechnicalProblem>;
  readonly metrics: GlobalPhysicalCellTextEvidenceFormationMetrics;
  readonly limitations: ReadonlyArray<PhysicalCellTextEvidenceFormationLimitationCode>;
}
