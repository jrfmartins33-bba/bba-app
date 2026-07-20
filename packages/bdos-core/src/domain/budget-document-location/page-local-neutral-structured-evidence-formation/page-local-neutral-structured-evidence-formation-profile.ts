import type { PageLocalNeutralStructuredEvidenceFormationLimitationCode } from "./budget-document-page-local-neutral-structured-evidence-formation.types";

/**
 * Perfil concreto interno da g.2 — nunca exportado pelo barrel público (§33).
 * Todas as flags são declarações de invariante, não parâmetros ajustáveis:
 * a v1 é estritamente 1:1 e por referência.
 */
export const PROFILE = Object.freeze({
  profileId: "budget-document-page-local-neutral-structured-evidence-formation-profile-v1" as const,
  profileVersion: 1 as const,
  materializeUpstreamByReference: true as const,
  oneDocumentLinePerPhysicalLine: true as const,
  oneDocumentCellPerPhysicalCellHypothesis: true as const,
  onePositionPerGridIntersection: true as const,
  reuseUpstreamKeys: true as const,
  forbidSyntheticPosition: true as const,
  forbidArtificialEmptyCell: true as const,
  forbidTextConcatenation: true as const,
  strictlyLocalToPage: true as const,
});

export const LIMITATIONS: ReadonlyArray<PageLocalNeutralStructuredEvidenceFormationLimitationCode> = Object.freeze([
  "neutral_structure_is_local_to_the_page",
  "candidate_region_is_not_a_confirmed_table", "neutral_document_line_is_not_a_budget_line", "neutral_document_position_is_not_an_economic_field",
  "empty_position_is_not_missing_economic_data", "neutral_document_cell_is_not_a_confirmed_budget_cell", "textual_content_has_no_economic_role",
  "normalized_text_is_not_source_verbatim", "no_textual_concatenation_created",
  "no_cross_page_continuity_evaluated", "no_numeric_parsing_performed", "no_economic_characterization_performed",
  "no_import_proposal_created", "no_budget_version_created",
  "no_persistence", "no_api_or_route", "no_user_interface", "no_physical_audit_viewer",
  "no_ai_or_ocr_applied", "real_document_out_of_scope", "no_commercial_readiness_claim",
]);
