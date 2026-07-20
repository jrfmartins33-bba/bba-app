import type {
  BudgetDocumentPageLocalNeutralStructuredEvidenceFormationResult,
  NeutralDocumentLine,
  NeutralDocumentRegion,
} from "../budget-document-location/page-local-neutral-structured-evidence-formation/budget-document-page-local-neutral-structured-evidence-formation.types";
import type { BudgetDocumentPageBoundaryNeutralContinuityEvaluationResult } from "../budget-document-location/page-boundary-neutral-continuity-evaluation/budget-document-page-boundary-neutral-continuity-evaluation.types";
import type { MoneyCents } from "../budget-version";

/**
 * Contrato puro da Sprint 21.4B — "Caracterização Econômica Mínima e
 * Proposta de Importação do Orçamento". Primeira capacidade da cadeia que
 * reconhece papel econômico (Grupo/Subgrupo/Item de Serviço, código,
 * descrição, unidade, quantidade, preço, total) — nunca a g.2 ou a g.3, que
 * permanecem estritamente neutras. Consome exclusivamente os resultados já
 * publicados pela g.2 (`BudgetDocumentPageLocalNeutralStructuredEvidenceFormationResult`)
 * e pela g.3 (`BudgetDocumentPageBoundaryNeutralContinuityEvaluationResult`)
 * — nunca relê o PDF, nunca reconstrói texto, nunca funde linhas/regiões
 * físicas. Produz uma Proposta de Importação do Orçamento: derivada,
 * auditável, revisável, nunca consolidada, nunca definitiva — cada linha
 * proposta preserva o texto original ao lado do valor analisado, e uma
 * ambiguidade nunca é resolvida silenciosamente.
 */

export const BUDGET_DOCUMENT_ECONOMIC_CHARACTERIZATION_SCHEMA_VERSION = 1 as const;
export const BUDGET_DOCUMENT_ECONOMIC_CHARACTERIZATION_ENGINE_NAME = "budget-document-economic-characterization-engine" as const;
export const BUDGET_DOCUMENT_ECONOMIC_CHARACTERIZATION_ENGINE_VERSION = "budget-document-economic-characterization-engine-v1" as const;
export const ECONOMIC_CHARACTERIZATION_IDENTITY_FINGERPRINT_VERSION = "budget-document-economic-characterization-identity-fingerprint-v1" as const;
export const ECONOMIC_CHARACTERIZATION_RESULT_FINGERPRINT_VERSION = "budget-document-economic-characterization-result-fingerprint-v1" as const;
export const ECONOMIC_CHARACTERIZATION_CANONICAL_SERIALIZATION_VERSION = "budget-document-economic-characterization-canonical-serialization-v1" as const;

/** Identidade da regra de reconhecimento de papel de coluna (catálogo de rótulos versionado, nunca específico de um caso real). */
export const COLUMN_ROLE_RECOGNITION_RULE_ID = "budget-document-column-role-label-catalog-v1" as const;
export const COLUMN_ROLE_RECOGNITION_RULE_VERSION = 1 as const;
/** Identidade da regra de classificação de linha (código hierárquico XX.YY.ZZ + herança posicional de seção). */
export const ROW_CLASSIFICATION_RULE_ID = "budget-document-hierarchical-code-and-position-row-classification-v1" as const;
export const ROW_CLASSIFICATION_RULE_VERSION = 1 as const;
/** Identidade da regra de parsing monetário/quantidade brasileiro (`1.234,56` → centavos; nunca `number` de ponto flutuante). */
export const BRAZILIAN_NUMBER_PARSING_RULE_ID = "budget-document-brazilian-decimal-parsing-v1" as const;
export const BRAZILIAN_NUMBER_PARSING_RULE_VERSION = 1 as const;
/** Identidade da regra de reconciliação quantidade × preço × total. */
export const RECONCILIATION_RULE_ID = "budget-document-quantity-price-total-reconciliation-v1" as const;
export const RECONCILIATION_RULE_VERSION = 1 as const;

export interface BudgetDocumentEconomicCharacterizationInput {
  readonly pageLocalNeutralStructuredEvidence: BudgetDocumentPageLocalNeutralStructuredEvidenceFormationResult;
  readonly pageBoundaryNeutralContinuity: BudgetDocumentPageBoundaryNeutralContinuityEvaluationResult;
}

// --- papel de coluna (§15) -----------------------------------------------------

export type BudgetColumnRole =
  | "external_code" | "description" | "unit" | "quantity"
  | "unit_price" | "total" | "source_reference" | "bdi_percent" | "type_marker";

export interface ColumnRoleAssignment {
  readonly columnOrder: number;
  readonly role: BudgetColumnRole;
  /** Rótulo de cabeçalho observado (texto original, nunca normalizado além de trim/uppercase para a comparação). */
  readonly observedHeaderLabel: string;
}

export type ColumnRoleRecognitionOutcome =
  | { readonly status: "recognized"; readonly assignments: ReadonlyArray<ColumnRoleAssignment> }
  | { readonly status: "no_header_found" }
  | { readonly status: "ambiguous_role_conflict"; readonly conflictingColumnOrders: ReadonlyArray<number>; readonly role: BudgetColumnRole };

// --- tipos de linha proposta (§11.1) --------------------------------------------

export type ProposedLineType =
  | "group" | "subgroup" | "service_item"
  | "header" | "repeated_header"
  | "subtotal_or_total" | "note" | "empty" | "ambiguous" | "not_processable";

export type ProposedLineExtractionStatus =
  | "extracted" | "extracted_with_warnings" | "requires_review" | "incomplete" | "not_importable" | "technical_failure";

export type ParentResolutionMethod = "HierarchicalCode" | "DocumentPositionSection" | "TopLevelNoParent" | "NotApplicable";

// --- parsing determinístico (§14) -----------------------------------------------

export type MoneyParseStatus = "parsed" | "unparseable" | "absent";
export interface ParsedMoneyValue {
  readonly originalText: string | null;
  readonly cents: MoneyCents | null;
  readonly status: MoneyParseStatus;
}

export type QuantityParseStatus = "parsed" | "unparseable" | "absent";
export interface ParsedQuantityValue {
  readonly originalText: string | null;
  /** Texto decimal exato preservado (nunca convertido para `number`), ex.: "1234.5678". `null` quando não analisável. */
  readonly exactDecimalText: string | null;
  readonly decimalPlaces: number | null;
  readonly status: QuantityParseStatus;
}

// --- problemas técnicos ----------------------------------------------------------

export type EconomicCharacterizationTechnicalProblemCode =
  | "source_contract_version_unsupported" | "source_status_invalid" | "source_fingerprint_invalid" | "source_lineage_mismatch"
  | "column_role_conflict_unresolved" | "hierarchical_code_cycle_detected" | "hierarchical_code_orphan"
  | "line_classification_failed" | "reconciliation_failed"
  | "economic_characterization_unexpected_failure";

export type EconomicCharacterizationTechnicalProblemPhase =
  | "source_validation" | "column_recognition" | "row_classification" | "hierarchy_construction" | "parsing" | "reconciliation";

export interface EconomicCharacterizationTechnicalProblem {
  readonly code: EconomicCharacterizationTechnicalProblemCode;
  readonly phase: EconomicCharacterizationTechnicalProblemPhase;
  readonly sourceCandidateGroupKey: string | null;
  readonly pageNumber: number | null;
  readonly sourceRegionKey: string | null;
  readonly sourceLineKey: string | null;
  readonly proposedLineId: string | null;
  readonly message: string;
}

// --- linha proposta (§13) -------------------------------------------------------

export interface ProposedLineProvenance {
  readonly sourceCandidateGroupKey: string;
  readonly pageNumber: number;
  readonly sourceRegionKey: string;
  readonly sourceLineKey: string;
  /** A linha documental neutra completa da g.2, materializada por referência — nunca duplicada campo a campo. */
  readonly sourceLine: NeutralDocumentLine;
}

export interface ProposedBudgetLine {
  /** Identidade interna determinística — hash canônico da proveniência (grupo+página+região+linha), nunca do código externo. */
  readonly proposedLineId: string;
  /** Ordem documental global, 0-based, através de todo o documento — nunca reordenada por classificação. */
  readonly documentaryOrder: number;
  readonly type: ProposedLineType;
  readonly parentProposedLineId: string | null;
  readonly parentResolutionMethod: ParentResolutionMethod;
  readonly externalCode: string | null;
  readonly descriptionOriginal: string | null;
  readonly unitOriginal: string | null;
  readonly quantity: ParsedQuantityValue;
  readonly unitPrice: ParsedMoneyValue;
  readonly total: ParsedMoneyValue;
  readonly extractionStatus: ProposedLineExtractionStatus;
  readonly technicalProblems: ReadonlyArray<EconomicCharacterizationTechnicalProblem>;
  readonly provenance: ProposedLineProvenance;
}

// --- reconciliação (§18) ---------------------------------------------------------

export type LineReconciliationStatus = "reconciled" | "reconciled_with_rounding" | "mismatch" | "insufficient_data" | "not_applicable" | "technical_failure";

export interface LineReconciliation {
  readonly proposedLineId: string;
  readonly status: LineReconciliationStatus;
  /** quantidade × preço unitário, quando ambos analisáveis — nunca calculado quando algum estiver ausente. */
  readonly recalculatedTotalCents: MoneyCents | null;
  readonly declaredTotalCents: MoneyCents | null;
  readonly differenceCents: MoneyCents | null;
}

export type IndependentReferenceAvailability = "available" | "unavailable";

/**
 * Diff linha a linha (§5 do mandato) — só produzido quando existir
 * referência independente confiável. Nunca compara a extração contra ela
 * mesma: `matched`/`missingFromExtraction`/`extraFromExtraction` exigem uma
 * fonte de comparação genuinamente distinta do resultado avaliado.
 */
export interface IndependentReferenceLineDiffEntry {
  readonly referenceExternalCode: string | null;
  readonly referenceHierarchicalCode: string | null;
  readonly matchedProposedLineId: string | null;
  readonly outcome: "matched" | "missing_from_extraction" | "extra_in_extraction" | "duplicate_code_in_extraction";
  readonly descriptionDivergence: boolean;
  readonly unitDivergence: boolean;
  readonly quantityDivergence: boolean;
  readonly totalDivergenceCents: MoneyCents | null;
}

export interface IndependentReferenceLineDiff {
  readonly availability: IndependentReferenceAvailability;
  readonly referenceSourceDescription: string | null;
  readonly entries: ReadonlyArray<IndependentReferenceLineDiffEntry>;
}

/** Diagnóstico produzido quando NÃO existe referência independente — nunca finge "faltante"/"excedente" contra o próprio resultado. */
export interface SelfConsistencyDiagnostic {
  readonly physicalLinesWithoutEconomicDisposition: number;
  readonly ambiguousLineCount: number;
  readonly possibleDuplicateExternalCodes: ReadonlyArray<string>;
  readonly hierarchyGapCount: number;
  readonly pageVsGlobalCountDivergence: boolean;
}

// --- métricas ----------------------------------------------------------------------

export interface EconomicCharacterizationMetrics {
  readonly totalLinesProcessed: number;
  readonly groupCount: number;
  readonly subgroupCount: number;
  readonly serviceItemCount: number;
  readonly headerCount: number;
  readonly repeatedHeaderCount: number;
  readonly subtotalOrTotalCount: number;
  readonly noteCount: number;
  readonly emptyCount: number;
  readonly ambiguousCount: number;
  readonly notProcessableCount: number;
  readonly extractedCount: number;
  readonly extractedWithWarningsCount: number;
  readonly requiresReviewCount: number;
  readonly incompleteCount: number;
  readonly notImportableCount: number;
  readonly technicalFailureCount: number;
  readonly declaredTotalCents: number | null;
  readonly recalculatedTotalCents: number | null;
  readonly technicalProblemCount: number;
}

// --- limitações --------------------------------------------------------------------

export type EconomicCharacterizationLimitationCode =
  | "proposed_line_is_not_a_confirmed_budget_line" | "no_consolidation_performed" | "no_budget_version_created"
  | "no_automatic_field_invention" | "external_code_is_never_identity"
  | "column_recognition_limited_to_observed_label_catalog" | "generalization_to_other_document_layouts_out_of_scope"
  | "no_ai_or_ocr_applied" | "no_llm_applied" | "real_document_out_of_scope" | "no_commercial_readiness_claim"
  | "official_reference_values_used_only_for_acceptance_reporting";

// --- resultado global ----------------------------------------------------------------

export type EconomicCharacterizationGlobalStatus = "characterized" | "characterized_with_problems" | "failed";

export interface BudgetDocumentEconomicCharacterizationResult {
  readonly schemaVersion: typeof BUDGET_DOCUMENT_ECONOMIC_CHARACTERIZATION_SCHEMA_VERSION;
  readonly engineName: typeof BUDGET_DOCUMENT_ECONOMIC_CHARACTERIZATION_ENGINE_NAME;
  readonly engineVersion: typeof BUDGET_DOCUMENT_ECONOMIC_CHARACTERIZATION_ENGINE_VERSION;
  readonly columnRoleRecognitionRuleId: typeof COLUMN_ROLE_RECOGNITION_RULE_ID;
  readonly columnRoleRecognitionRuleVersion: typeof COLUMN_ROLE_RECOGNITION_RULE_VERSION;
  readonly rowClassificationRuleId: typeof ROW_CLASSIFICATION_RULE_ID;
  readonly rowClassificationRuleVersion: typeof ROW_CLASSIFICATION_RULE_VERSION;
  readonly numberParsingRuleId: typeof BRAZILIAN_NUMBER_PARSING_RULE_ID;
  readonly numberParsingRuleVersion: typeof BRAZILIAN_NUMBER_PARSING_RULE_VERSION;
  readonly reconciliationRuleId: typeof RECONCILIATION_RULE_ID;
  readonly reconciliationRuleVersion: typeof RECONCILIATION_RULE_VERSION;
  readonly canonicalSerializationVersion: typeof ECONOMIC_CHARACTERIZATION_CANONICAL_SERIALIZATION_VERSION;
  readonly identityFingerprintVersion: typeof ECONOMIC_CHARACTERIZATION_IDENTITY_FINGERPRINT_VERSION;
  readonly identityFingerprint: string;
  readonly resultFingerprintVersion: typeof ECONOMIC_CHARACTERIZATION_RESULT_FINGERPRINT_VERSION;
  readonly resultFingerprint: string;
  readonly sourceByteHash: string;

  readonly sourcePageLocalNeutralStructuredEvidenceIdentityFingerprint: string;
  readonly sourcePageLocalNeutralStructuredEvidenceResultFingerprint: string;
  readonly sourcePageLocalNeutralStructuredEvidenceStatus: string;
  readonly sourcePageBoundaryNeutralContinuityIdentityFingerprint: string;
  readonly sourcePageBoundaryNeutralContinuityResultFingerprint: string;
  readonly sourcePageBoundaryNeutralContinuityStatus: string;

  readonly status: EconomicCharacterizationGlobalStatus;
  readonly proposedLines: ReadonlyArray<ProposedBudgetLine>;
  readonly lineReconciliations: ReadonlyArray<LineReconciliation>;
  readonly independentReferenceDiff: IndependentReferenceLineDiff;
  readonly selfConsistencyDiagnostic: SelfConsistencyDiagnostic;
  readonly technicalProblems: ReadonlyArray<EconomicCharacterizationTechnicalProblem>;
  readonly metrics: EconomicCharacterizationMetrics;
  readonly limitations: ReadonlyArray<EconomicCharacterizationLimitationCode>;
}

/** Referência independente para reconciliação linha a linha — nunca o próprio resultado avaliado (§5). */
export interface IndependentBudgetReferenceLine {
  readonly externalCode: string | null;
  readonly hierarchicalCode: string | null;
  readonly classification: "group" | "subgroup" | "service_item";
  readonly description: string | null;
  readonly unit: string | null;
  readonly quantityDecimalText: string | null;
  readonly totalCents: MoneyCents | null;
}

export type { NeutralDocumentRegion };
