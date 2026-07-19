import type { PhysicalCellHypothesisFormationLimitationCode } from "./budget-document-physical-cell-hypothesis-formation.types";
import { PHYSICAL_CELL_HYPOTHESIS_FORMATION_OUTPUT_GEOMETRY_CANONICALIZATION_VERSION } from "./physical-cell-hypothesis-formation-output-geometry-canonicalization";

export const PHYSICAL_GRID_FORMATION_RULE_ID = "physical-grid-line-column-orthogonal-product-v1" as const;
export const PHYSICAL_GRID_FORMATION_RULE_VERSION = 1 as const;
export const PHYSICAL_CELL_HYPOTHESIS_FORMATION_RULE_ID = "physical-cell-hypothesis-full-segment-containment-v1" as const;
export const PHYSICAL_CELL_HYPOTHESIS_FORMATION_RULE_VERSION = 1 as const;

export const PROFILE = Object.freeze({
  profileId: "budget-document-physical-cell-hypothesis-formation-profile-v1" as const,
  profileVersion: 1 as const,
  requireCompleteSegmentContainment: true as const,
  rejectPartialSegmentIntersection: true as const,
  requireObservedContentWithinGridBounds: true as const,
  allowMultipleSegmentsPerCellHypothesis: true as const,
  maximumCellHypothesesPerSegment: 1 as const,
  includeEmptyGridIntersections: true as const,
  geometryCanonicalizationVersion: PHYSICAL_CELL_HYPOTHESIS_FORMATION_OUTPUT_GEOMETRY_CANONICALIZATION_VERSION,
});

export const LIMITATIONS: ReadonlyArray<PhysicalCellHypothesisFormationLimitationCode> = Object.freeze([
  "physical_grid_intersection_is_not_a_confirmed_cell", "physical_cell_hypothesis_is_not_a_confirmed_cell", "physical_cell_hypothesis_is_not_an_economic_field", "physical_line_is_not_a_budget_line", "physical_column_hypothesis_is_not_a_confirmed_column", "candidate_region_is_not_a_confirmed_table", "empty_grid_intersection_is_not_missing_economic_data", "no_textual_semantics_applied", "no_service_code_read", "no_description_interpreted", "no_unit_read", "no_quantity_read", "no_price_read", "no_total_read", "no_economic_bdi_interpreted", "no_header_identified", "no_footer_identified", "no_budget_line_created", "no_budget_version_created", "no_cross_page_continuity_evaluated", "no_segment_clipping_or_adjustment_applied", "no_orphan_segment_absorption_applied", "no_new_numeric_tolerance_applied", "unresolved_ambiguities_remain_explicit", "no_ai_or_ocr_applied", "no_persistence", "no_api_or_route", "no_user_interface", "no_physical_audit_viewer", "real_document_out_of_scope", "no_commercial_readiness_claim",
]);
