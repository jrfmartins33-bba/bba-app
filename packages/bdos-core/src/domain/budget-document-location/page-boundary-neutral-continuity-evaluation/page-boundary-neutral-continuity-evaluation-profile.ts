import type { PageBoundaryNeutralContinuityLimitationCode } from "./budget-document-page-boundary-neutral-continuity-evaluation.types";

/**
 * Perfil concreto interno da g.3 — nunca exportado pelo barrel público.
 * Os quatro limites geométricos são política determinística v1 (§8 da
 * especificação aprovada), não medição validada contra documento real —
 * revisáveis por incremento de `profileVersion`, sem qualquer impacto na
 * forma do contrato público.
 */
export const PROFILE = Object.freeze({
  profileId: "budget-document-page-boundary-neutral-continuity-evaluation-profile-v1" as const,
  profileVersion: 1 as const,
  consecutivePagesOnly: true as const,
  singleBoundaryRegionPairPerPageBoundary: true as const,
  reuseUpstreamKeys: true as const,
  forbidRegionOrLineMerge: true as const,
  forbidTextualContentSignal: true as const,
  minimumHorizontalOverlapRatio: 0.85 as const,
  minimumWidthSimilarityRatio: 0.9 as const,
  maximumLeftBoundaryDeviationToMinimumWidthRatio: 0.05 as const,
  maximumRightBoundaryDeviationToMinimumWidthRatio: 0.05 as const,
});

export const LIMITATIONS: ReadonlyArray<PageBoundaryNeutralContinuityLimitationCode> = Object.freeze([
  "page_boundary_evaluation_is_not_confirmed_continuity",
  "candidate_region_is_not_a_confirmed_table", "neutral_document_line_is_not_a_budget_line",
  "structural_thresholds_not_validated_against_real_budget_documents",
  "textual_repetition_not_evaluated_in_v1", "page_skip_continuity_not_evaluated_in_v1",
  "no_page_or_line_merge_performed", "no_region_merge_performed", "no_multi_page_line_created",
  "no_economic_characterization_performed", "no_numeric_parsing_performed",
  "no_budget_line_created", "no_budget_version_created", "no_import_proposal_created",
  "no_persistence", "no_api_or_route", "no_user_interface", "no_physical_audit_viewer",
  "no_ai_or_ocr_applied", "real_document_out_of_scope", "no_commercial_readiness_claim",
]);
