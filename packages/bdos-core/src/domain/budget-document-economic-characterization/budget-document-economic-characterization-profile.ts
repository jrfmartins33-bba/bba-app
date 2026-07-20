import type { EconomicCharacterizationLimitationCode } from "./budget-document-economic-characterization.types";

export const PROFILE = Object.freeze({
  profileId: "budget-document-economic-characterization-profile-v1" as const,
  profileVersion: 1 as const,
  minimumRecognizedRolesForHeader: 3 as const,
  reconciliationRoundingToleranceCents: 1 as const,
});

export const LIMITATIONS: ReadonlyArray<EconomicCharacterizationLimitationCode> = Object.freeze([
  "proposed_line_is_not_a_confirmed_budget_line", "no_consolidation_performed", "no_budget_version_created",
  "no_automatic_field_invention", "external_code_is_never_identity",
  "column_recognition_limited_to_observed_label_catalog", "generalization_to_other_document_layouts_out_of_scope",
  "no_ai_or_ocr_applied", "no_llm_applied", "real_document_out_of_scope", "no_commercial_readiness_claim",
  "official_reference_values_used_only_for_acceptance_reporting",
]);
