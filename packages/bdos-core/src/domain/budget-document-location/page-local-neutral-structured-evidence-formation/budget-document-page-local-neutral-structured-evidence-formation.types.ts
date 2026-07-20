import type { BudgetDocumentStructureReconstructionResult, ReconstructedHorizontalSegment, ReconstructedPhysicalLine, StructureReconstructionStatus } from "../structure-reconstruction/budget-document-structure-reconstruction.types";
import type { BudgetDocumentTabularRegionDetectionResult, TabularRegionCandidate, TabularRegionDetectionGroupStatus, TabularRegionDetectionPageStatus, TabularRegionDetectionStatus } from "../tabular-region-detection/budget-document-tabular-region-detection.types";
import type { BudgetDocumentPhysicalCellHypothesisFormationResult, PhysicalCellHypothesis, PhysicalCellHypothesisFormationGroupStatus, PhysicalCellHypothesisFormationPageStatus, PhysicalCellHypothesisFormationRegionStatus, PhysicalCellHypothesisFormationStatus, PhysicalGridIntersection } from "../physical-cell-hypothesis-formation/budget-document-physical-cell-hypothesis-formation.types";
import type { BudgetDocumentPhysicalCellTextEvidenceFormationResult, PhysicalCellTextEvidence, PhysicalCellTextEvidenceFormationGroupStatus, PhysicalCellTextEvidenceFormationPageStatus, PhysicalCellTextEvidenceFormationRegionStatus, PhysicalCellTextEvidenceFormationStatus } from "../physical-cell-text-evidence-formation/budget-document-physical-cell-text-evidence-formation.types";

/**
 * Contrato puro da Sprint 21.4A.2.g.2 — "Evidência Estruturada Neutra Local
 * à Página". Responde apenas "como os fatos físicos e textuais já produzidos
 * (linhas físicas, segmentos, malha, interseções, hipóteses físicas de
 * célula e evidências textuais das células) se organizam, de forma
 * determinística e auditável, em uma hierarquia documental neutra local à
 * página?" — nunca "qual é o significado econômico desses fatos?". Organiza,
 * nunca interpreta; materializa por referência os objetos upstream, nunca os
 * recalcula, renomeia ou renormaliza. A f.2c continua sendo a única fonte da
 * verdade para malha, interseções, vazios, ambiguidades, falhas físicas e
 * geometria de posição; a g.1, para fragmentos textuais e ocorrências; a
 * reconstrução estrutural, para geometria de linha/segmento; a detecção de
 * regiões, para a população normativa e a ordem física das regiões. Esta
 * capacidade amplia, nunca substitui, nenhum dos quatro contratos. Não
 * estabelece continuidade entre páginas (reservado para a g.3) e por isso
 * declara-se sempre "local à página".
 */

export const BUDGET_DOCUMENT_PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_SCHEMA_VERSION = 1 as const;
export const BUDGET_DOCUMENT_PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_ENGINE_NAME = "budget-document-page-local-neutral-structured-evidence-formation-engine" as const;
export const BUDGET_DOCUMENT_PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_ENGINE_VERSION = "budget-document-page-local-neutral-structured-evidence-formation-engine-v1" as const;
/** Fingerprint que resume apenas as identidades de origem e da g.2 — nunca o conteúdo produzido (§26). */
export const PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_IDENTITY_FINGERPRINT_VERSION = "budget-document-page-local-neutral-structured-evidence-formation-identity-fingerprint-v1" as const;
/** Fingerprint final — identidade + toda a hierarquia documental produzida (§26). */
export const PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_RESULT_FINGERPRINT_VERSION = "budget-document-page-local-neutral-structured-evidence-formation-result-fingerprint-v1" as const;
/** Identidade da regra de organização determinística linha→posição (ordena posições por columnOrder, nunca recalcula columnOrder). */
export const NEUTRAL_DOCUMENT_LINE_POSITION_ORGANIZATION_RULE_ID = "neutral-document-line-position-organization-v1" as const;
export const NEUTRAL_DOCUMENT_LINE_POSITION_ORGANIZATION_RULE_VERSION = 1 as const;
/** Identidade da regra de materialização por referência da evidência textual da g.1 dentro da célula documental (nunca renormaliza, nunca concatena). */
export const NEUTRAL_DOCUMENT_CELL_TEXT_EVIDENCE_MATERIALIZATION_RULE_ID = "neutral-document-cell-text-evidence-materialization-by-reference-v1" as const;
export const NEUTRAL_DOCUMENT_CELL_TEXT_EVIDENCE_MATERIALIZATION_RULE_VERSION = 1 as const;
/** Identidade da serialização canônica por valor usada em chaves e fingerprints (JSON canônico + SHA-256, reaproveitada das Sprints anteriores). */
export const PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_CANONICAL_SERIALIZATION_VERSION = "page-local-neutral-structured-evidence-canonical-serialization-v1" as const;

/** Porta de entrada: exatamente os quatro contratos já produzidos. Nenhuma releitura do PDF; nenhum consumo de PhysicalDocumentReadResult ou physical-column-hypothesis-reconstruction. */
export interface BudgetDocumentPageLocalNeutralStructuredEvidenceFormationInput {
  readonly structureReconstruction: BudgetDocumentStructureReconstructionResult;
  readonly tabularRegionDetection: BudgetDocumentTabularRegionDetectionResult;
  readonly physicalCellHypothesisFormation: BudgetDocumentPhysicalCellHypothesisFormationResult;
  readonly physicalCellTextEvidenceFormation: BudgetDocumentPhysicalCellTextEvidenceFormationResult;
}

// --- célula documental neutra (§15) -----------------------------------------

/** Estado próprio da g.2, derivado do estado textual da g.1 — nunca apaga o estado da g.1, que permanece dentro de sourceTextEvidence. */
export type NeutralDocumentCellStatus =
  | "structured"
  | "structured_with_text_problems"
  | "structured_without_resolved_text"
  | "failed";

/**
 * Reúne, numa única posição documental, a hipótese física de célula (f.2c) e
 * a evidência textual (g.1) — ambas materializadas por referência, imutáveis.
 * Reutiliza `cellHypothesisKey` como identidade 1:1; nunca cria chave nova,
 * texto concatenado, texto corrigido ou interpretação de conteúdo.
 *
 * Quando `status` é `"failed"` (falha localizada de montagem da própria
 * célula, isolada pela g.2 — nunca um estado herdado da f.2c/g.1), os três
 * campos `source*` são preservados quando disponíveis e `null` quando não —
 * a célula falha nunca é descartada, apenas registrada com o que puder ser
 * comprovado (correção B1, §18/§22 da especificação aprovada).
 */
export interface NeutralDocumentCell {
  readonly cellHypothesisKey: string;
  readonly gridIntersectionKey: string;
  readonly rowOrder: number;
  readonly columnOrder: number;
  readonly status: NeutralDocumentCellStatus;
  /** Estado textual da g.1 preservado explicitamente (§21) — separado do estado próprio da g.2. `null` apenas quando a própria evidência textual não pôde ser localizada/preservada (célula em `failed`). */
  readonly sourceTextEvidenceStatus: PhysicalCellTextEvidence["status"] | null;
  /** Hipótese física de célula da f.2c, materializada por referência (emenda 1). `null` apenas quando indisponível numa célula `failed`. */
  readonly sourceCellHypothesis: PhysicalCellHypothesis | null;
  /** Evidência textual da g.1 (segmentos, fragmentos, disposições, falhas), materializada por referência (emenda 1). `null` apenas quando indisponível ou estruturalmente inválida numa célula `failed`. */
  readonly sourceTextEvidence: PhysicalCellTextEvidence | null;
}

// --- posição documental (§14, união discriminada §21) -----------------------

export type NeutralDocumentPositionStatus =
  | "empty"
  | "cell_structured"
  | "ambiguous_partial_intersection"
  | "ambiguous_multiple_intersections"
  | "ambiguous_content_outside_grid_bounds"
  | "technical_failure";

interface NeutralDocumentPositionIdentity {
  /** Reutiliza gridIntersectionKey — nunca cria chave nova (§14/§25). */
  readonly gridIntersectionKey: string;
  readonly sourceLineKey: string;
  readonly rowOrder: number;
  readonly columnOrder: number;
  /** Interseção física completa da f.2c (gridBounds, ambiguidade, falha, etc.), materializada por referência (emenda 1). */
  readonly sourceGridIntersection: PhysicalGridIntersection;
}
export interface EmptyNeutralDocumentPosition extends NeutralDocumentPositionIdentity { readonly status: "empty"; readonly cell: null; }
export interface CellStructuredNeutralDocumentPosition extends NeutralDocumentPositionIdentity { readonly status: "cell_structured"; readonly cell: NeutralDocumentCell; }
export interface AmbiguousPartialIntersectionNeutralDocumentPosition extends NeutralDocumentPositionIdentity { readonly status: "ambiguous_partial_intersection"; readonly cell: null; }
export interface AmbiguousMultipleIntersectionsNeutralDocumentPosition extends NeutralDocumentPositionIdentity { readonly status: "ambiguous_multiple_intersections"; readonly cell: null; }
export interface AmbiguousContentOutsideGridBoundsNeutralDocumentPosition extends NeutralDocumentPositionIdentity { readonly status: "ambiguous_content_outside_grid_bounds"; readonly cell: null; }
export interface TechnicalFailureNeutralDocumentPosition extends NeutralDocumentPositionIdentity { readonly status: "technical_failure"; readonly cell: null; }
export type NeutralDocumentPosition =
  | EmptyNeutralDocumentPosition
  | CellStructuredNeutralDocumentPosition
  | AmbiguousPartialIntersectionNeutralDocumentPosition
  | AmbiguousMultipleIntersectionsNeutralDocumentPosition
  | AmbiguousContentOutsideGridBoundsNeutralDocumentPosition
  | TechnicalFailureNeutralDocumentPosition;

// --- linha documental neutra (§13, Alternativa B) ---------------------------

export type NeutralDocumentLineStatus =
  | "structured"
  | "structured_with_problems"
  | "without_positions"
  | "upstream_not_processable"
  | "failed";

/**
 * Referencia exatamente UMA linha física (cardinalidade 1:1 na v1), pertence
 * a exatamente uma região, reúne as posições daquela linha e preserva
 * integralmente os segmentos físicos — inclusive segmentos que nunca chegaram
 * a uma célula. Reutiliza `lineKey` como identidade.
 */
export interface NeutralDocumentLine {
  readonly sourceLineKey: string;
  readonly pageNumber: number;
  readonly verticalOrder: number;
  readonly status: NeutralDocumentLineStatus;
  /** Linha física da reconstrução estrutural, materializada por referência (emenda 1). */
  readonly sourceLine: ReconstructedPhysicalLine;
  /** Todos os segmentos físicos da linha, em ordem horizontal, materializados por referência (§20.3 preserva inclusive segmentos fora de células). */
  readonly physicalSegments: ReadonlyArray<ReconstructedHorizontalSegment>;
  /** Posições da linha (uma por interseção cujo sourceLineKey corresponda), ordenadas por columnOrder depois gridIntersectionKey. `[]` quando a linha não produziu interseções. */
  readonly positions: ReadonlyArray<NeutralDocumentPosition>;
  readonly technicalProblems: ReadonlyArray<PageLocalNeutralStructuredEvidenceFormationTechnicalProblem>;
  readonly metrics: NeutralDocumentLineMetrics;
}

// --- região documental neutra (§7, §20.1) -----------------------------------

export type NeutralDocumentRegionStatus =
  | "structured"
  | "structured_with_ambiguities"
  | "structured_with_problems"
  | "grid_without_cells"
  | "without_physical_grid"
  | "upstream_not_processable"
  | "failed";

export interface NeutralDocumentRegion {
  /** Reutiliza regionKey/sourceRegionKey — nunca cria chave nova (§25). */
  readonly sourceRegionKey: string;
  readonly pageNumber: number;
  /** Ordem física da região dentro da página, preservada da f.2a (§27). */
  readonly order: number;
  readonly status: NeutralDocumentRegionStatus;
  /** Região candidata da f.2a (ordem, bounds, lineKeys, alinhamentos), materializada por referência (emenda 1). */
  readonly sourceRegionCandidate: TabularRegionCandidate;
  /** Estado físico da região na f.2c, preservado explicitamente (§21) — `null` quando a página/grupo upstream não foi processável e não há região f.2c correspondente. */
  readonly sourcePhysicalCellHypothesisFormationRegionStatus: PhysicalCellHypothesisFormationRegionStatus | null;
  /** Estado textual da região na g.1, preservado explicitamente (§21) — `null` quando não há região g.1 correspondente. */
  readonly sourcePhysicalCellTextEvidenceFormationRegionStatus: PhysicalCellTextEvidenceFormationRegionStatus | null;
  readonly documentLines: ReadonlyArray<NeutralDocumentLine>;
  readonly technicalProblems: ReadonlyArray<PageLocalNeutralStructuredEvidenceFormationTechnicalProblem>;
  readonly metrics: NeutralDocumentRegionMetrics;
}

// --- página e grupo documental (§12, contêiner de proveniência) -------------

export type NeutralDocumentPageStatus =
  | "structured"
  | "structured_with_problems"
  | "partially_structured"
  | "without_neutral_structure"
  | "upstream_not_processable"
  | "failed";

export interface NeutralDocumentPage {
  readonly pageNumber: number;
  readonly status: NeutralDocumentPageStatus;
  readonly sourceTabularRegionDetectionPageStatus: TabularRegionDetectionPageStatus;
  readonly sourcePhysicalCellHypothesisFormationPageStatus: PhysicalCellHypothesisFormationPageStatus | null;
  readonly sourcePhysicalCellTextEvidenceFormationPageStatus: PhysicalCellTextEvidenceFormationPageStatus | null;
  readonly regions: ReadonlyArray<NeutralDocumentRegion>;
  readonly technicalProblems: ReadonlyArray<PageLocalNeutralStructuredEvidenceFormationTechnicalProblem>;
  readonly metrics: NeutralDocumentPageMetrics;
}

export type NeutralDocumentGroupStatus =
  | "structured"
  | "structured_with_problems"
  | "partially_structured"
  | "without_neutral_structure"
  | "upstream_not_processable"
  | "failed";

export interface NeutralDocumentGroup {
  /** Reutiliza sourceCandidateGroupKey (§25). O grupo é contêiner de proveniência/linhagem, nunca estrutura documental semântica (§12). */
  readonly sourceCandidateGroupKey: string;
  readonly status: NeutralDocumentGroupStatus;
  readonly sourceTabularRegionDetectionGroupStatus: TabularRegionDetectionGroupStatus;
  readonly sourcePhysicalCellHypothesisFormationGroupStatus: PhysicalCellHypothesisFormationGroupStatus | null;
  readonly sourcePhysicalCellTextEvidenceFormationGroupStatus: PhysicalCellTextEvidenceFormationGroupStatus | null;
  readonly pages: ReadonlyArray<NeutralDocumentPage>;
  readonly technicalProblems: ReadonlyArray<PageLocalNeutralStructuredEvidenceFormationTechnicalProblem>;
  readonly metrics: NeutralDocumentGroupMetrics;
}

// --- problemas técnicos (§22) -----------------------------------------------

export type PageLocalNeutralStructuredEvidenceFormationTechnicalProblemCode =
  | "source_contract_version_unsupported" | "source_lineage_mismatch" | "source_fingerprint_invalid"
  | "source_structure_reconstruction_contract_invalid" | "source_tabular_region_detection_contract_invalid" | "source_physical_cell_hypothesis_formation_contract_invalid" | "source_physical_cell_text_evidence_contract_invalid"
  | "source_group_reference_invalid" | "source_page_reference_invalid" | "source_region_reference_invalid" | "source_line_reference_invalid" | "source_segment_reference_invalid" | "source_grid_intersection_reference_invalid" | "source_cell_hypothesis_reference_invalid" | "source_cell_text_evidence_reference_invalid"
  | "source_order_incoherent" | "source_geometry_incoherent" | "source_population_incoherent" | "source_upstream_state_incoherent"
  | "neutral_region_formation_failed" | "neutral_line_formation_failed" | "neutral_position_formation_failed" | "neutral_cell_formation_failed"
  | "region_conservation_failed" | "line_conservation_failed" | "segment_conservation_failed" | "position_conservation_failed" | "cell_conservation_failed" | "text_evidence_conservation_failed" | "fragment_conservation_failed" | "metric_conservation_failed"
  | "page_local_neutral_structure_unexpected_failure";

export type PageLocalNeutralStructuredEvidenceFormationTechnicalProblemPhase =
  | "source_validation" | "candidate_group_processing" | "candidate_page_processing" | "candidate_region_processing"
  | "line_formation" | "position_formation" | "cell_formation" | "conservation_validation";

export interface PageLocalNeutralStructuredEvidenceFormationTechnicalProblem {
  readonly code: PageLocalNeutralStructuredEvidenceFormationTechnicalProblemCode;
  readonly phase: PageLocalNeutralStructuredEvidenceFormationTechnicalProblemPhase;
  readonly groupKey: string | null; readonly pageNumber: number | null; readonly regionKey: string | null;
  readonly lineKey: string | null; readonly segmentKey: string | null;
  readonly gridIntersectionKey: string | null; readonly cellHypothesisKey: string | null;
  readonly sourceReferenceOrder: number | null; readonly textItemIndex: number | null;
  readonly message: string;
}

// --- métricas (§23) ----------------------------------------------------------

export interface NeutralDocumentLineMetrics {
  readonly physicalSegmentCount: number;
  readonly positionCount: number;
  readonly emptyPositionCount: number; readonly cellStructuredPositionCount: number;
  readonly ambiguousPartialIntersectionPositionCount: number; readonly ambiguousMultipleIntersectionsPositionCount: number; readonly ambiguousContentOutsideGridBoundsPositionCount: number;
  readonly technicalFailurePositionCount: number;
  readonly documentCellCount: number;
  readonly cellStructuredCount: number; readonly cellStructuredWithTextProblemsCount: number; readonly cellStructuredWithoutResolvedTextCount: number; readonly cellFailedCount: number;
  readonly fragmentPreservedCount: number;
  readonly technicalProblemCount: number;
}

export interface NeutralDocumentRegionMetrics {
  readonly physicalLineReceivedCount: number;
  readonly documentLineProducedCount: number;
  readonly documentLineStructuredCount: number; readonly documentLineStructuredWithProblemsCount: number; readonly documentLineWithoutPositionsCount: number; readonly documentLineUpstreamNotProcessableCount: number; readonly documentLineFailedCount: number;
  readonly physicalSegmentPreservedCount: number;
  readonly gridIntersectionReceivedCount: number;
  readonly positionProducedCount: number;
  readonly emptyPositionCount: number; readonly cellStructuredPositionCount: number;
  readonly ambiguousPartialIntersectionPositionCount: number; readonly ambiguousMultipleIntersectionsPositionCount: number; readonly ambiguousContentOutsideGridBoundsPositionCount: number;
  readonly technicalFailurePositionCount: number;
  readonly physicalCellHypothesisCount: number;
  readonly documentCellCount: number;
  readonly cellStructuredCount: number; readonly cellStructuredWithTextProblemsCount: number; readonly cellStructuredWithoutResolvedTextCount: number; readonly cellFailedCount: number;
  readonly textEvidenceCount: number;
  readonly segmentOutcomeCount: number;
  readonly fragmentReceivedCount: number; readonly fragmentPreservedCount: number;
  readonly technicalProblemCount: number;
}

export interface NeutralDocumentPageMetrics {
  readonly totalRegionCount: number;
  readonly structuredRegionCount: number; readonly structuredWithAmbiguitiesRegionCount: number; readonly structuredWithProblemsRegionCount: number;
  readonly gridWithoutCellsRegionCount: number; readonly withoutPhysicalGridRegionCount: number; readonly upstreamNotProcessableRegionCount: number; readonly failedRegionCount: number;
  readonly documentLineCount: number; readonly physicalSegmentPreservedCount: number;
  readonly positionCount: number; readonly emptyPositionCount: number; readonly cellStructuredPositionCount: number;
  readonly ambiguousPositionCount: number; readonly technicalFailurePositionCount: number;
  readonly documentCellCount: number; readonly cellStructuredCount: number; readonly cellStructuredWithTextProblemsCount: number; readonly cellStructuredWithoutResolvedTextCount: number; readonly cellFailedCount: number;
  readonly fragmentPreservedCount: number;
  readonly technicalProblemCount: number;
}

export interface NeutralDocumentGroupMetrics {
  readonly totalPageCount: number;
  readonly structuredPageCount: number; readonly structuredWithProblemsPageCount: number; readonly partiallyStructuredPageCount: number;
  readonly withoutNeutralStructurePageCount: number; readonly upstreamNotProcessablePageCount: number; readonly failedPageCount: number;
  readonly totalRegionCount: number; readonly documentLineCount: number; readonly physicalSegmentPreservedCount: number;
  readonly positionCount: number; readonly emptyPositionCount: number; readonly cellStructuredPositionCount: number; readonly ambiguousPositionCount: number; readonly technicalFailurePositionCount: number;
  readonly documentCellCount: number; readonly cellStructuredCount: number; readonly cellStructuredWithTextProblemsCount: number; readonly cellStructuredWithoutResolvedTextCount: number; readonly cellFailedCount: number;
  readonly fragmentPreservedCount: number;
  readonly technicalProblemCount: number;
}

export interface GlobalNeutralDocumentFormationMetrics {
  readonly receivedGroupCount: number;
  readonly structuredGroupCount: number; readonly structuredWithProblemsGroupCount: number; readonly partiallyStructuredGroupCount: number;
  readonly withoutNeutralStructureGroupCount: number; readonly upstreamNotProcessableGroupCount: number; readonly failedGroupCount: number;
  readonly candidatePageCount: number; readonly candidateRegionCount: number;
  readonly documentLineCount: number; readonly physicalSegmentPreservedCount: number;
  readonly positionCount: number; readonly emptyPositionCount: number; readonly cellStructuredPositionCount: number; readonly ambiguousPositionCount: number; readonly technicalFailurePositionCount: number;
  readonly documentCellCount: number; readonly cellStructuredCount: number; readonly cellStructuredWithTextProblemsCount: number; readonly cellStructuredWithoutResolvedTextCount: number; readonly cellFailedCount: number;
  readonly fragmentPreservedCount: number;
  readonly technicalProblemCount: number;
}

// --- limitações (§35) --------------------------------------------------------

export type PageLocalNeutralStructuredEvidenceFormationLimitationCode =
  | "neutral_structure_is_local_to_the_page"
  | "candidate_region_is_not_a_confirmed_table" | "neutral_document_line_is_not_a_budget_line" | "neutral_document_position_is_not_an_economic_field"
  | "empty_position_is_not_missing_economic_data" | "neutral_document_cell_is_not_a_confirmed_budget_cell" | "textual_content_has_no_economic_role"
  | "normalized_text_is_not_source_verbatim" | "no_textual_concatenation_created"
  | "no_cross_page_continuity_evaluated" | "no_numeric_parsing_performed" | "no_economic_characterization_performed"
  | "no_import_proposal_created" | "no_budget_version_created"
  | "no_persistence" | "no_api_or_route" | "no_user_interface" | "no_physical_audit_viewer"
  | "no_ai_or_ocr_applied" | "real_document_out_of_scope" | "no_commercial_readiness_claim";

// --- estados globais e resultado (§21, §11) ---------------------------------

export type PageLocalNeutralStructuredEvidenceFormationStatus = "structured" | "structured_with_problems" | "partially_structured" | "failed";

export interface BudgetDocumentPageLocalNeutralStructuredEvidenceFormationResult {
  readonly schemaVersion: typeof BUDGET_DOCUMENT_PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_SCHEMA_VERSION;
  readonly formationEngineName: typeof BUDGET_DOCUMENT_PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_ENGINE_NAME;
  readonly formationEngineVersion: typeof BUDGET_DOCUMENT_PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_ENGINE_VERSION;
  readonly formationProfileId: string;
  readonly formationProfileVersion: number;
  readonly linePositionOrganizationRuleId: typeof NEUTRAL_DOCUMENT_LINE_POSITION_ORGANIZATION_RULE_ID;
  readonly linePositionOrganizationRuleVersion: typeof NEUTRAL_DOCUMENT_LINE_POSITION_ORGANIZATION_RULE_VERSION;
  readonly textEvidenceMaterializationRuleId: typeof NEUTRAL_DOCUMENT_CELL_TEXT_EVIDENCE_MATERIALIZATION_RULE_ID;
  readonly textEvidenceMaterializationRuleVersion: typeof NEUTRAL_DOCUMENT_CELL_TEXT_EVIDENCE_MATERIALIZATION_RULE_VERSION;
  readonly canonicalSerializationVersion: typeof PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_CANONICAL_SERIALIZATION_VERSION;
  readonly identityFingerprintVersion: typeof PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_IDENTITY_FINGERPRINT_VERSION;
  readonly identityFingerprint: string;
  readonly resultFingerprintVersion: typeof PAGE_LOCAL_NEUTRAL_STRUCTURED_EVIDENCE_FORMATION_RESULT_FINGERPRINT_VERSION;
  readonly resultFingerprint: string;
  readonly sourceByteHash: string;

  readonly sourceStructureReconstructionSchemaVersion: number;
  readonly sourceStructureReconstructorName: string;
  readonly sourceStructureReconstructorVersion: string;
  readonly sourceStructureReconstructionProfileId: string;
  readonly sourceStructureReconstructionProfileVersion: number;
  readonly sourceStructureReconstructionContextFingerprintVersion: string;
  readonly sourceStructureReconstructionContextFingerprint: string;
  readonly sourceStructureReconstructionStatus: StructureReconstructionStatus;

  readonly sourceTabularRegionDetectionSchemaVersion: number;
  readonly sourceTabularRegionDetectorName: string;
  readonly sourceTabularRegionDetectorVersion: string;
  readonly sourceTabularRegionDetectionProfileId: string;
  readonly sourceTabularRegionDetectionProfileVersion: number;
  readonly sourceTabularRegionDetectionContextFingerprintVersion: string;
  readonly sourceTabularRegionDetectionContextFingerprint: string;
  readonly sourceTabularRegionDetectionStatus: TabularRegionDetectionStatus;

  readonly sourcePhysicalCellHypothesisFormationSchemaVersion: number;
  readonly sourcePhysicalCellHypothesisFormationEngineName: string;
  readonly sourcePhysicalCellHypothesisFormationEngineVersion: string;
  readonly sourcePhysicalCellHypothesisFormationProfileId: string;
  readonly sourcePhysicalCellHypothesisFormationProfileVersion: number;
  readonly sourcePhysicalCellHypothesisFormationContextFingerprintVersion: string;
  readonly sourcePhysicalCellHypothesisFormationContextFingerprint: string;
  readonly sourcePhysicalCellHypothesisFormationStatus: PhysicalCellHypothesisFormationStatus;

  readonly sourcePhysicalCellTextEvidenceFormationSchemaVersion: number;
  readonly sourcePhysicalCellTextEvidenceFormationEngineName: string;
  readonly sourcePhysicalCellTextEvidenceFormationEngineVersion: string;
  readonly sourcePhysicalCellTextEvidenceFormationProfileId: string;
  readonly sourcePhysicalCellTextEvidenceFormationProfileVersion: number;
  readonly sourcePhysicalCellTextEvidenceFormationContextFingerprintVersion: string;
  readonly sourcePhysicalCellTextEvidenceFormationContextFingerprint: string;
  readonly sourcePhysicalCellTextEvidenceFormationStatus: PhysicalCellTextEvidenceFormationStatus;

  readonly status: PageLocalNeutralStructuredEvidenceFormationStatus;
  readonly groups: ReadonlyArray<NeutralDocumentGroup>;
  readonly technicalProblems: ReadonlyArray<PageLocalNeutralStructuredEvidenceFormationTechnicalProblem>;
  readonly metrics: GlobalNeutralDocumentFormationMetrics;
  readonly limitations: ReadonlyArray<PageLocalNeutralStructuredEvidenceFormationLimitationCode>;
}
