import type { BudgetDocumentStructureReconstructionResult } from "../structure-reconstruction/budget-document-structure-reconstruction.types";
import type { BudgetDocumentTabularRegionDetectionResult } from "../tabular-region-detection/budget-document-tabular-region-detection.types";
import type { BudgetDocumentPhysicalColumnHypothesisReconstructionResult } from "../physical-column-hypothesis-reconstruction/budget-document-physical-column-hypothesis-reconstruction.types";

export const BUDGET_DOCUMENT_PHYSICAL_CELL_HYPOTHESIS_FORMATION_SCHEMA_VERSION = 1 as const;
export const BUDGET_DOCUMENT_PHYSICAL_CELL_HYPOTHESIS_FORMATION_ENGINE_NAME = "budget-document-physical-cell-hypothesis-formation-engine" as const;
export const BUDGET_DOCUMENT_PHYSICAL_CELL_HYPOTHESIS_FORMATION_ENGINE_VERSION = "budget-document-physical-cell-hypothesis-formation-engine-v1" as const;
export const PHYSICAL_CELL_HYPOTHESIS_FORMATION_CONTEXT_FINGERPRINT_VERSION = "budget-document-physical-cell-hypothesis-formation-context-fingerprint-v1" as const;

export interface BudgetDocumentPhysicalCellHypothesisFormationInput {
  readonly structureReconstruction: BudgetDocumentStructureReconstructionResult;
  readonly tabularRegionDetection: BudgetDocumentTabularRegionDetectionResult;
  readonly physicalColumnHypothesisReconstruction: BudgetDocumentPhysicalColumnHypothesisReconstructionResult;
}

export interface PhysicalGeometryBounds {
  readonly leftPoints: number; readonly topPoints: number; readonly rightPoints: number; readonly bottomPoints: number;
  readonly widthPoints: number; readonly heightPoints: number; readonly centerXPoints: number; readonly centerYPoints: number;
}

export interface PhysicalGridIntersectionIdentity {
  readonly gridIntersectionKey: string;
  readonly sourceLineKey: string;
  readonly sourcePhysicalColumnHypothesisKey: string;
  readonly sourceRegionKey: string;
  readonly pageNumber: number;
  readonly rowOrder: number;
  readonly columnOrder: number;
  readonly gridBounds: PhysicalGeometryBounds;
  readonly gridFormationRuleId: string;
  readonly gridFormationRuleVersion: number;
  readonly profileId: string;
  readonly profileVersion: number;
}
export interface PhysicalGridIntersectionWithCell extends PhysicalGridIntersectionIdentity { readonly status: "cell_hypothesis_formed"; readonly cellHypothesisKey: string; }
export interface EmptyPhysicalGridIntersection extends PhysicalGridIntersectionIdentity { readonly status: "empty"; }
export interface PartialSegmentIntersectionGridIntersection extends PhysicalGridIntersectionIdentity { readonly status: "unresolved_segment_association_ambiguity"; readonly ambiguityReason: "partial_segment_intersection"; readonly partiallyIntersectingSegmentKeys: ReadonlyArray<string>; }
export interface MultipleIntersectionClaimGridIntersection extends PhysicalGridIntersectionIdentity { readonly status: "unresolved_segment_association_ambiguity"; readonly ambiguityReason: "segment_claimed_by_multiple_intersections"; readonly disputedSegmentKeys: ReadonlyArray<string>; readonly conflictingGridIntersectionKeys: ReadonlyArray<string>; }
export interface ObservedContentOutsideGridBoundsIntersection extends PhysicalGridIntersectionIdentity { readonly status: "unresolved_segment_association_ambiguity"; readonly ambiguityReason: "observed_content_outside_grid_bounds"; readonly evidenceSegmentKeys: ReadonlyArray<string>; readonly observedContentBounds: PhysicalGeometryBounds; }
export type AmbiguousPhysicalGridIntersection = PartialSegmentIntersectionGridIntersection | MultipleIntersectionClaimGridIntersection | ObservedContentOutsideGridBoundsIntersection;
export interface FailedPhysicalGridIntersection extends PhysicalGridIntersectionIdentity { readonly status: "unresolved_technical_failure"; readonly failedPhase: "segment_association" | "cell_hypothesis_formation" | "containment_validation"; readonly affectedSegmentKeys: ReadonlyArray<string>; }
export type PhysicalGridIntersection = PhysicalGridIntersectionWithCell | EmptyPhysicalGridIntersection | AmbiguousPhysicalGridIntersection | FailedPhysicalGridIntersection;

export interface PhysicalCellHypothesis {
  readonly cellHypothesisKey: string;
  readonly gridIntersectionKey: string;
  readonly observedContentBounds: PhysicalGeometryBounds;
  readonly segmentKeys: ReadonlyArray<string>;
  readonly cellFormationRuleId: string;
  readonly cellFormationRuleVersion: number;
  readonly profileId: string;
  readonly profileVersion: number;
}

export type PhysicalCellHypothesisSegmentDisposition =
  | { readonly status: "included_in_physical_cell_hypothesis"; readonly segmentKey: string; readonly lineKey: string; readonly gridIntersectionKey: string; readonly cellHypothesisKey: string }
  | { readonly status: "outside_all_physical_cell_hypotheses"; readonly segmentKey: string; readonly lineKey: string }
  | { readonly status: "unresolved_inherited_column_ambiguity"; readonly segmentKey: string; readonly lineKey: string; readonly conflictingCandidateHypothesisKeys: ReadonlyArray<string> }
  | { readonly status: "unresolved_partial_grid_intersection"; readonly segmentKey: string; readonly lineKey: string; readonly partiallyIntersectedGridIntersectionKeys: ReadonlyArray<string> }
  | { readonly status: "unresolved_multiple_grid_intersection_claim"; readonly segmentKey: string; readonly lineKey: string; readonly claimingGridIntersectionKeys: ReadonlyArray<string> }
  | { readonly status: "unresolved_source_contract_inconsistency"; readonly segmentKey: string; readonly lineKey: string; readonly claimingPhysicalColumnHypothesisKeys: ReadonlyArray<string> }
  | { readonly status: "unresolved_cell_hypothesis_formation_failed"; readonly segmentKey: string; readonly lineKey: string; readonly failedPhase: "segment_association" | "cell_hypothesis_formation" };

export type PhysicalCellHypothesisFormationStatus = "completed" | "completed_with_ambiguities" | "completed_with_problems" | "failed";
export type PhysicalCellHypothesisFormationRegionStatus = "formed" | "formed_with_ambiguities" | "formed_with_problems" | "grid_without_cell_hypotheses" | "no_physical_grid" | "region_not_processable";
export type PhysicalCellHypothesisFormationPageStatus = "formed" | "formed_with_ambiguities" | "formed_with_problems" | "no_physical_grid" | "page_not_processable";
export type PhysicalCellHypothesisFormationGroupStatus = "formed" | "formed_with_ambiguities" | "formed_with_problems" | "no_physical_grid" | "group_not_processable";

export type PhysicalCellHypothesisFormationTechnicalProblemCode =
  | "source_contract_version_unsupported" | "source_lineage_mismatch" | "source_fingerprint_invalid"
  | "source_structure_reconstruction_contract_invalid" | "source_tabular_region_detection_contract_invalid" | "source_physical_column_hypothesis_contract_invalid"
  | "source_group_reference_invalid" | "source_page_reference_invalid" | "source_region_reference_invalid" | "source_line_reference_invalid" | "source_segment_reference_invalid" | "source_column_hypothesis_reference_invalid"
  | "source_line_geometry_degenerate" | "source_physical_column_hypothesis_geometry_degenerate" | "source_geometry_incoherent"
  | "source_valid_column_hypotheses_overlap" | "source_segment_claimed_by_multiple_valid_column_hypotheses"
  | "physical_grid_formation_failed" | "physical_segment_association_failed" | "physical_cell_hypothesis_formation_failed"
  | "physical_grid_intersection_conservation_failed" | "physical_segment_conservation_failed" | "physical_cell_hypothesis_containment_failed"
  | "physical_cell_hypothesis_formation_unexpected_failure";
export type PhysicalCellHypothesisFormationTechnicalProblemPhase = "source_validation" | "candidate_group_processing" | "candidate_page_processing" | "candidate_region_processing" | "grid_formation" | "segment_association" | "cell_hypothesis_formation" | "containment_validation" | "conservation_validation";
export interface PhysicalCellHypothesisFormationTechnicalProblem { readonly code: PhysicalCellHypothesisFormationTechnicalProblemCode; readonly phase: PhysicalCellHypothesisFormationTechnicalProblemPhase; readonly groupKey: string | null; readonly pageNumber: number | null; readonly regionKey: string | null; readonly lineKey: string | null; readonly physicalColumnHypothesisKey: string | null; readonly gridIntersectionKey: string | null; readonly segmentKey: string | null; readonly message: string; }

export interface RegionPhysicalCellHypothesisFormationMetrics {
  readonly sourceLineCount: number; readonly sourcePhysicalColumnHypothesisCount: number; readonly totalGridIntersectionCount: number;
  readonly cellHypothesisFormedIntersectionCount: number; readonly emptyGridIntersectionCount: number; readonly ambiguousGridIntersectionCount: number; readonly formationFailedGridIntersectionCount: number;
  readonly totalRegionSegmentCount: number; readonly includedSegmentCount: number; readonly outsideSegmentCount: number; readonly inheritedAmbiguousSegmentCount: number; readonly partialIntersectionSegmentCount: number; readonly multipleClaimSegmentCount: number; readonly sourceContractInconsistentSegmentCount: number; readonly formationFailedSegmentCount: number;
  readonly cellHypothesisCount: number; readonly multiSegmentCellHypothesisCount: number; readonly technicalProblemCount: number;
}
export interface PagePhysicalCellHypothesisFormationMetrics { readonly totalRegionCount: number; readonly formedRegionCount: number; readonly formedWithAmbiguitiesRegionCount: number; readonly formedWithProblemsRegionCount: number; readonly gridWithoutCellHypothesesRegionCount: number; readonly noPhysicalGridRegionCount: number; readonly regionNotProcessableCount: number; readonly gridIntersectionCount: number; readonly emptyGridIntersectionCount: number; readonly cellHypothesisCount: number; readonly multiSegmentCellHypothesisCount: number; readonly segmentCount: number; readonly includedSegmentCount: number; readonly ambiguousSegmentCount: number; readonly formationFailedSegmentCount: number; readonly technicalProblemCount: number; }
export interface GroupPhysicalCellHypothesisFormationMetrics { readonly totalPageCount: number; readonly formedPageCount: number; readonly formedWithAmbiguitiesPageCount: number; readonly formedWithProblemsPageCount: number; readonly noPhysicalGridPageCount: number; readonly pageNotProcessableCount: number; readonly gridIntersectionCount: number; readonly emptyGridIntersectionCount: number; readonly cellHypothesisCount: number; readonly multiSegmentCellHypothesisCount: number; readonly segmentCount: number; readonly includedSegmentCount: number; readonly ambiguousSegmentCount: number; readonly formationFailedSegmentCount: number; readonly technicalProblemCount: number; }
export interface GlobalPhysicalCellHypothesisFormationMetrics { readonly receivedGroupCount: number; readonly formedGroupCount: number; readonly formedWithAmbiguitiesGroupCount: number; readonly formedWithProblemsGroupCount: number; readonly noPhysicalGridGroupCount: number; readonly groupNotProcessableCount: number; readonly candidatePageCount: number; readonly candidateRegionCount: number; readonly gridIntersectionCount: number; readonly emptyGridIntersectionCount: number; readonly cellHypothesisCount: number; readonly multiSegmentCellHypothesisCount: number; readonly segmentCount: number; readonly includedSegmentCount: number; readonly ambiguousSegmentCount: number; readonly formationFailedSegmentCount: number; readonly technicalProblemCount: number; }

export interface PhysicalCellHypothesisFormationRegion { readonly regionProcessedKey: string; readonly sourceRegionKey: string; readonly pageNumber: number; readonly status: PhysicalCellHypothesisFormationRegionStatus; readonly gridIntersections: ReadonlyArray<PhysicalGridIntersection>; readonly cellHypotheses: ReadonlyArray<PhysicalCellHypothesis>; readonly segmentDispositions: ReadonlyArray<PhysicalCellHypothesisSegmentDisposition>; readonly technicalProblems: ReadonlyArray<PhysicalCellHypothesisFormationTechnicalProblem>; readonly metrics: RegionPhysicalCellHypothesisFormationMetrics; readonly profileId: string; readonly profileVersion: number; }
export interface PhysicalCellHypothesisFormationPage { readonly pageProcessedKey: string; readonly pageNumber: number; readonly status: PhysicalCellHypothesisFormationPageStatus; readonly regions: ReadonlyArray<PhysicalCellHypothesisFormationRegion>; readonly technicalProblems: ReadonlyArray<PhysicalCellHypothesisFormationTechnicalProblem>; readonly metrics: PagePhysicalCellHypothesisFormationMetrics; }
export interface PhysicalCellHypothesisFormationGroup { readonly groupProcessedKey: string; readonly sourceCandidateGroupKey: string; readonly status: PhysicalCellHypothesisFormationGroupStatus; readonly pageKeys: ReadonlyArray<string>; readonly pages: ReadonlyArray<PhysicalCellHypothesisFormationPage>; readonly technicalProblems: ReadonlyArray<PhysicalCellHypothesisFormationTechnicalProblem>; readonly metrics: GroupPhysicalCellHypothesisFormationMetrics; }

export type PhysicalCellHypothesisFormationLimitationCode =
  | "physical_grid_intersection_is_not_a_confirmed_cell" | "physical_cell_hypothesis_is_not_a_confirmed_cell" | "physical_cell_hypothesis_is_not_an_economic_field" | "physical_line_is_not_a_budget_line" | "physical_column_hypothesis_is_not_a_confirmed_column" | "candidate_region_is_not_a_confirmed_table" | "empty_grid_intersection_is_not_missing_economic_data"
  | "no_textual_semantics_applied" | "no_service_code_read" | "no_description_interpreted" | "no_unit_read" | "no_quantity_read" | "no_price_read" | "no_total_read" | "no_economic_bdi_interpreted" | "no_header_identified" | "no_footer_identified" | "no_budget_line_created" | "no_budget_version_created" | "no_cross_page_continuity_evaluated"
  | "no_segment_clipping_or_adjustment_applied" | "no_orphan_segment_absorption_applied" | "no_new_numeric_tolerance_applied" | "unresolved_ambiguities_remain_explicit" | "no_ai_or_ocr_applied" | "no_persistence" | "no_api_or_route" | "no_user_interface" | "no_physical_audit_viewer" | "real_document_out_of_scope" | "no_commercial_readiness_claim";

export interface BudgetDocumentPhysicalCellHypothesisFormationResult {
  readonly schemaVersion: typeof BUDGET_DOCUMENT_PHYSICAL_CELL_HYPOTHESIS_FORMATION_SCHEMA_VERSION;
  readonly formationEngineName: typeof BUDGET_DOCUMENT_PHYSICAL_CELL_HYPOTHESIS_FORMATION_ENGINE_NAME;
  readonly formationEngineVersion: typeof BUDGET_DOCUMENT_PHYSICAL_CELL_HYPOTHESIS_FORMATION_ENGINE_VERSION;
  readonly formationProfileId: string; readonly formationProfileVersion: number;
  readonly formationContextFingerprintVersion: typeof PHYSICAL_CELL_HYPOTHESIS_FORMATION_CONTEXT_FINGERPRINT_VERSION; readonly formationContextFingerprint: string; readonly sourceByteHash: string;
  readonly sourceStructureReconstructionSchemaVersion: number; readonly sourceStructureReconstructorName: string; readonly sourceStructureReconstructorVersion: string; readonly sourceStructureReconstructionProfileId: string; readonly sourceStructureReconstructionProfileVersion: number; readonly sourceStructureReconstructionContextFingerprintVersion: string; readonly sourceStructureReconstructionContextFingerprint: string;
  readonly sourceTabularRegionDetectionSchemaVersion: number; readonly sourceTabularRegionDetectorName: string; readonly sourceTabularRegionDetectorVersion: string; readonly sourceTabularRegionDetectionProfileId: string; readonly sourceTabularRegionDetectionProfileVersion: number; readonly sourceTabularRegionDetectionContextFingerprintVersion: string; readonly sourceTabularRegionDetectionContextFingerprint: string;
  readonly sourcePhysicalColumnHypothesisReconstructionSchemaVersion: number; readonly sourcePhysicalColumnHypothesisReconstructorName: string; readonly sourcePhysicalColumnHypothesisReconstructorVersion: string; readonly sourcePhysicalColumnHypothesisReconstructionProfileId: string; readonly sourcePhysicalColumnHypothesisReconstructionProfileVersion: number; readonly sourcePhysicalColumnHypothesisReconstructionContextFingerprintVersion: string; readonly sourcePhysicalColumnHypothesisReconstructionContextFingerprint: string;
  readonly status: PhysicalCellHypothesisFormationStatus; readonly groups: ReadonlyArray<PhysicalCellHypothesisFormationGroup>; readonly technicalProblems: ReadonlyArray<PhysicalCellHypothesisFormationTechnicalProblem>; readonly metrics: GlobalPhysicalCellHypothesisFormationMetrics; readonly limitations: ReadonlyArray<PhysicalCellHypothesisFormationLimitationCode>;
}
