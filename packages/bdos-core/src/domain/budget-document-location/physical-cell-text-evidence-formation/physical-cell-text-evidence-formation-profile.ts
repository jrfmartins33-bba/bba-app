import type { PhysicalCellTextEvidenceFormationLimitationCode } from "./budget-document-physical-cell-text-evidence-formation.types";

export const PROFILE = Object.freeze({
  profileId: "budget-document-physical-cell-text-evidence-formation-profile-v1" as const,
  profileVersion: 1 as const,
  geometryReferencedNotCopied: true as const,
  occurrenceBasedConservation: true as const,
  preserveSourceReferenceOrder: true as const,
  rejectRegionWideDuplicateTextItemReferences: true as const,
  createDerivedDisplayText: false as const,
});

export const LIMITATIONS: ReadonlyArray<PhysicalCellTextEvidenceFormationLimitationCode> = Object.freeze([
  "physical_cell_text_evidence_augments_but_does_not_replace_physical_cell_hypothesis_formation",
  "physical_cell_text_evidence_is_not_a_confirmed_document_cell", "physical_cell_text_evidence_is_not_an_economic_field",
  "original_text_is_preserved_separately", "normalized_text_is_not_source_verbatim", "no_derived_display_text_created",
  "no_structured_neutral_evidence_produced", "no_document_row_created", "no_header_identified", "no_footer_identified",
  "no_service_code_read", "no_description_interpreted", "no_unit_read", "no_quantity_read", "no_price_read", "no_total_read",
  "no_economic_bdi_interpreted", "no_budget_line_created", "no_budget_version_created", "no_import_proposal_created",
  "no_cross_page_continuity_evaluated", "unresolved_ambiguities_remain_explicit", "no_ai_or_ocr_applied",
  "no_persistence", "no_api_or_route", "no_user_interface", "no_physical_audit_viewer",
  "real_document_out_of_scope", "no_commercial_readiness_claim",
]);
