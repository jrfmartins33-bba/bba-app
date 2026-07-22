/**
 * Contratos do protocolo de avaliação de leitores locais (Sprint
 * 21.4B.3A.3, Momento 3A). Exclusivamente diagnóstico — fora da
 * produção, nunca importado por código produtivo. Agnóstico de
 * ferramenta: nenhum campo aqui presume o formato bruto específico do
 * Docling ou do PaddleOCR (essa tradução é escopo do Momento 3B, ver
 * `EPIC_21_SPRINT_4B3A3_MOMENTO3A_LOCAL_READER_EVALUATION_PROTOCOL.md`
 * §1). Não cria grupo, subgrupo ou item de serviço por interpretação
 * manual — apenas região/tabela/célula observadas literalmente.
 */

import type { ReferenceTruthColumnRole } from "../reference-truth/discovery-reference-truth.types";

export type LocalReaderTool = "docling" | "paddleocr";

// --- Página avaliada (§5 "Página avaliada") --------------------------------

export type LocalReaderFinalState = "completed" | "completed_with_warnings" | "failed";

export interface LocalReaderPageEvaluation {
  readonly tool: LocalReaderTool;
  readonly toolVersion: string;
  readonly configurationSummaryPt: string;
  readonly imageHashSha256: string;
  readonly realPageNumber: number;
  readonly loadTimeMs: number;
  readonly processingTimeMs: number;
  readonly peakMemoryMb: number;
  readonly finalState: LocalReaderFinalState;
  readonly errors: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
}

// --- Coordenadas (§7) -------------------------------------------------------

export type LocalReaderCoordinateOriginConvention = "top_left" | "bottom_left" | "unknown";
export type LocalReaderCoordinateUnit = "pixels" | "points" | "unknown";

export interface LocalReaderRawBoundingBox {
  readonly originConvention: LocalReaderCoordinateOriginConvention;
  readonly unit: LocalReaderCoordinateUnit;
  readonly xMin: number;
  readonly yMin: number;
  readonly xMax: number;
  readonly yMax: number;
}

export interface LocalReaderConvertedBoundingBox {
  readonly leftPoints: number;
  readonly topPoints: number;
  readonly rightPoints: number;
  readonly bottomPoints: number;
}

export interface LocalReaderPageGeometry {
  readonly pageWidthPoints: number;
  readonly pageHeightPoints: number;
  readonly renderingResolutionDpi: number;
}

export type LocalReaderBoundingBoxConversionResult =
  | { readonly box: LocalReaderConvertedBoundingBox; readonly interruptedPt: null }
  | { readonly box: null; readonly interruptedPt: string };

// --- Região observada pelo leitor (§5 "Região observada") ------------------

export interface LocalReaderObservedRegion {
  readonly id: string;
  readonly tool: LocalReaderTool;
  readonly realPageNumber: number;
  readonly literalText: string;
  readonly rawBoundingBox: LocalReaderRawBoundingBox;
  readonly convertedBoundingBox: LocalReaderConvertedBoundingBox | null;
  readonly conversionInterruptionReasonPt: string | null;
  readonly readerConfidence: number | null;
  readonly readerNativeType: string | null;
  readonly rawElementReferencePt: string;
}

// --- Tabela observada (§5 "Tabela observada") -------------------------------

export interface LocalReaderObservedTable {
  readonly id: string;
  readonly tool: LocalReaderTool;
  readonly realPageNumber: number;
  readonly boundingBox: LocalReaderConvertedBoundingBox | null;
  readonly rowCount: number;
  readonly columnCount: number;
  readonly cellIds: ReadonlyArray<string>;
}

// --- Célula observada (§5 "Célula observada") -------------------------------

export interface LocalReaderObservedCell {
  readonly id: string;
  readonly tool: LocalReaderTool;
  readonly realPageNumber: number;
  readonly tableId: string;
  readonly proposedRowIndex: number;
  readonly proposedColumnIndex: number;
  readonly literalText: string;
  readonly boundingBox: LocalReaderConvertedBoundingBox | null;
  readonly relatedRegionIds: ReadonlyArray<string>;
  readonly nativeMergeIndicationPt: string | null;
}

// --- Região esperada/observada mínima usada pela comparação de §9.2 --------

export interface LocalReaderExpectedRegionRef {
  readonly id: string;
  readonly realPageNumber: number;
  readonly normalizedText: string;
  readonly boundingBox: LocalReaderConvertedBoundingBox | null;
}

export interface LocalReaderObservedRegionRef {
  readonly id: string;
  readonly realPageNumber: number;
  readonly normalizedText: string;
  readonly boundingBox: LocalReaderConvertedBoundingBox | null;
}

export type LocalReaderRegionComparisonOutcome = "recovered" | "omitted" | "additional" | "text_divergent";

export interface LocalReaderRegionComparisonResult {
  readonly id: string;
  readonly referenceRegionIds: ReadonlyArray<string>;
  readonly observedRegionIds: ReadonlyArray<string>;
  readonly outcome: LocalReaderRegionComparisonOutcome;
  readonly hasUsableCoordinateOnBothSides: boolean;
}

// --- Célula esperada mínima usada pela comparação (derivada da verdade de
// referência, nunca redefinida aqui) ----------------------------------------

export interface LocalReaderExpectedCellRef {
  readonly id: string;
  readonly realPageNumber: number;
  readonly columnId: string;
  readonly normalizedText: string;
  readonly boundingBox: LocalReaderConvertedBoundingBox | null;
}

export interface LocalReaderObservedCellRef {
  readonly id: string;
  readonly realPageNumber: number;
  readonly columnId: string | null;
  readonly normalizedText: string;
  readonly boundingBox: LocalReaderConvertedBoundingBox | null;
}

// --- Comparação estrutural (§8) ---------------------------------------------

export type LocalReaderCellComparisonOutcome =
  | "direct_match"
  | "expected_cell_split_into_multiple_observed"
  | "multiple_expected_cells_merged"
  | "expected_cell_omitted"
  | "invented_cell"
  | "correct_text_wrong_column"
  | "correct_text_no_usable_coordinate"
  | "correct_coordinate_wrong_text";

export interface LocalReaderCellComparisonResult {
  readonly id: string;
  readonly referenceCellIds: ReadonlyArray<string>;
  readonly observedCellIds: ReadonlyArray<string>;
  readonly outcome: LocalReaderCellComparisonOutcome;
  readonly normalizedExpectedText: string | null;
  readonly normalizedObservedText: string | null;
  readonly textualDistance: number | null;
  readonly associationBasisPt: string;
}

// --- Métricas (§9) -----------------------------------------------------------

export interface LocalReaderExecutionMetrics {
  readonly pagesCompleted: number;
  readonly pagesFailed: number;
  readonly coldStartTimeMs: number;
  readonly perPageTimeMs: ReadonlyArray<{ readonly realPageNumber: number; readonly timeMs: number }>;
  readonly peakMemoryMb: number;
  readonly warnings: ReadonlyArray<string>;
  readonly partialFailures: ReadonlyArray<string>;
}

export interface LocalReaderRegionTextMetrics {
  readonly expectedRegionsRecovered: number;
  readonly regionsOmitted: number;
  readonly regionsAdditional: number;
  readonly exactTextMatches: number;
  readonly divergentText: number;
  readonly textWithoutCoordinate: number;
  readonly coordinateWithoutText: number;
}

export type LocalReaderCellOutcomeCounts = Record<LocalReaderCellComparisonOutcome, number>;

export interface LocalReaderTableStructureMetrics {
  readonly tablesDetected: number;
  readonly expectedColumnsRecovered: number;
  readonly expectedColumnsTotal: number;
  readonly columnsSplit: number;
  readonly columnsMerged: number;
  readonly rowsDetected: number;
  readonly cellOutcomeCounts: LocalReaderCellOutcomeCounts;
  readonly cellsTotal: number;
}

export interface LocalReaderCriticalFieldMetric {
  readonly role: ReferenceTruthColumnRole;
  readonly itemsTotal: number;
  readonly literalMatches: number;
  readonly exactDecimalValueMatches: number | null;
  readonly mismatches: number;
}

export type LocalReaderMultilineDescriptionOutcome =
  | "fully_preserved"
  | "partially_preserved"
  | "lines_out_of_order"
  | "split_into_incompatible_cells"
  | "merged_with_neighbor_item"
  | "omitted";

export interface LocalReaderMultilineDescriptionMetric {
  readonly logicalRowId: string;
  readonly outcome: LocalReaderMultilineDescriptionOutcome;
}

export type LocalReaderExternalContentOutcome =
  | "detected_as_external_or_out_of_table"
  | "incorporated_into_table"
  | "incorporated_into_item_description"
  | "omitted"
  | "split";

export interface LocalReaderExternalContentMetric {
  readonly regionId: string;
  readonly outcome: LocalReaderExternalContentOutcome;
  readonly isCriticalRisk: boolean;
}

export type LocalReaderMathEvidenceAvailability =
  | "evidencia_completa"
  | "evidencia_parcial"
  | "evidencia_ausente"
  | "evidencia_divergente_da_fonte";

export interface LocalReaderMathEvidenceMetric {
  readonly mathRelationId: string;
  readonly availability: LocalReaderMathEvidenceAvailability;
  readonly missingFieldsPt: ReadonlyArray<string>;
  readonly divergenceDescriptionPt: string | null;
}

// --- Classificação de viabilidade (§10) -------------------------------------

export type LocalReaderViabilityClassification = "candidato_principal" | "candidato_complementar" | "nao_viavel_nesta_configuracao";

export interface LocalReaderViabilityGateInputs {
  readonly processedAllThreePages: boolean;
  readonly inventedMonetaryValue: boolean;
  readonly providedPhysicalOriginForCriticalFields: boolean;
  readonly recoveredRequiredFieldsOf80Items: boolean;
  readonly incorporatedTcuNoteAsItemOrValue: boolean;
  readonly producedUsableTableCellStructure: boolean;
  readonly ranOffline: boolean;
  readonly reproducibleConfiguration: boolean;
  readonly failedOnAnyPage: boolean;
  readonly requiredNetworkOrExternalService: boolean;
  readonly impedingInstability: boolean;
  readonly providedRelevantTraceableComplementaryEvidence: boolean;
}

export interface LocalReaderViabilityResult {
  readonly classification: LocalReaderViabilityClassification;
  readonly reasonsPt: ReadonlyArray<string>;
}

// --- Diferenças de repetição (§11) ------------------------------------------

export type LocalReaderRepetitionDifferenceCategory =
  | "known_noise_timestamp"
  | "known_noise_temp_directory"
  | "known_noise_random_identifier"
  | "known_noise_nonsemantic_property_order"
  | "semantic_difference";

export interface LocalReaderRepetitionRawDifference {
  readonly path: string;
  readonly valueRun1: string;
  readonly valueRun2: string;
}

export interface LocalReaderRepetitionDifference {
  readonly path: string;
  readonly category: LocalReaderRepetitionDifferenceCategory;
}

export interface LocalReaderRepetitionComparison {
  readonly rawOutputHashMatch: boolean;
  readonly canonicalOutputHashMatch: boolean;
  readonly differences: ReadonlyArray<LocalReaderRepetitionDifference>;
  readonly timeMsRun1: number;
  readonly timeMsRun2: number;
  readonly peakMemoryMbRun1: number;
  readonly peakMemoryMbRun2: number;
}

export const LOCAL_READER_EVALUATION_PROTOCOL_SCHEMA_VERSION = 1 as const;
