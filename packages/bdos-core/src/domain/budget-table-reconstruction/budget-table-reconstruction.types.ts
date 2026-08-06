import type {
  BudgetDocumentPageLocationResult,
  BudgetDocumentPhysicalCellHypothesisFormationResult,
  BudgetDocumentPhysicalCellTextEvidenceFormationResult,
  BudgetDocumentPhysicalColumnHypothesisReconstructionResult,
  BudgetDocumentStructureReconstructionResult,
  PhysicalDocumentReadResult,
} from "../budget-document-location";

export interface BudgetTableReconstructionInput {
  readonly physicalRead: PhysicalDocumentReadResult;
  readonly pageLocation: BudgetDocumentPageLocationResult;
  readonly structureReconstruction: BudgetDocumentStructureReconstructionResult;
  readonly pageSelection: ReadonlyArray<number> | "all";
  readonly columnEvidence:
    | {
        readonly availability: "available";
        readonly result: BudgetDocumentPhysicalColumnHypothesisReconstructionResult;
      }
    | {
        readonly availability: "unavailable";
        readonly reasonCode: string;
      };
  readonly physicalCellEvidence:
    | {
        readonly availability: "available";
        readonly cellHypothesisFormation: BudgetDocumentPhysicalCellHypothesisFormationResult;
        readonly cellTextEvidenceFormation: BudgetDocumentPhysicalCellTextEvidenceFormationResult;
      }
    | {
        readonly availability: "unavailable";
        readonly reasonCode: string;
      };
}

export interface ExactRational {
  readonly numerator: string;
  readonly denominator: string;
}

export interface RuntimeSourceReference {
  readonly lineKey: string | null;
  readonly segmentKey: string | null;
}

export interface StructuralLocator {
  readonly documentSha256: string;
  readonly pageNumber: number;
  readonly lineVerticalOrder: number | null;
  readonly segmentHorizontalOrder: number | null;
  readonly bounds: readonly [number, number, number, number] | null;
  readonly sourceTextItemIndices: ReadonlyArray<number>;
  readonly readerIdentity: string;
  readonly libraryIdentity: string | null;
  readonly reconstructorIdentity: string;
  readonly physicalFingerprint: string;
  readonly structuralFingerprint: string;
}

export interface CanonicalLocatorEntry {
  readonly locatorId: string;
  readonly locator: StructuralLocator;
}

export interface EvidenceTextItem {
  readonly evidenceId: string;
  readonly locatorId: string;
  readonly pageNumber: number;
  readonly sourceTextItemIndex: number;
  readonly rawText: string;
  readonly upstreamDisposition: string;
  readonly runtimeReference: RuntimeSourceReference;
}

export interface SourceFragment {
  readonly fragmentId: string;
  readonly textItemEvidenceId: string;
  readonly startOffset: number;
  readonly endOffset: number;
}

export interface EvidenceSegment {
  readonly segmentId: string;
  readonly locatorId: string;
  readonly pageNumber: number;
  readonly lineId: string;
  readonly textItemEvidenceIds: ReadonlyArray<string>;
  readonly fragmentIds: ReadonlyArray<string>;
  readonly rawText: string;
  readonly upstreamCellHypothesisIds: ReadonlyArray<string>;
  readonly runtimeReference: RuntimeSourceReference;
}

export interface EvidenceLine {
  readonly lineId: string;
  readonly locatorId: string;
  readonly pageNumber: number;
  readonly segmentIds: ReadonlyArray<string>;
  readonly textItemEvidenceIds: ReadonlyArray<string>;
  readonly runtimeReference: RuntimeSourceReference;
}

export type BudgetColumnRole =
  | "item_code"
  | "description"
  | "unit"
  | "quantity"
  | "unit_cost"
  | "bdi_rate"
  | "unit_price"
  | "total_price"
  | "unknown";

export type SemanticResolutionStatus =
  | "resolved"
  | "ambiguous"
  | "insufficient_evidence"
  | "not_applicable"
  | "failed";

export interface ResolvedColumn {
  readonly columnId: string;
  readonly pageNumber: number;
  readonly horizontalOrder: number;
  readonly leftPoints: number;
  readonly rightPoints: number;
  readonly candidateRoles: ReadonlyArray<BudgetColumnRole>;
  readonly role: BudgetColumnRole;
  readonly status: SemanticResolutionStatus;
  readonly headerLineIds: ReadonlyArray<string>;
  readonly evidenceLocatorIds: ReadonlyArray<string>;
}

export type CellState = "present" | "missing" | "divergent" | "ambiguous" | "not_applicable";

export interface ReconstructedCell {
  readonly cellId: string;
  readonly pageNumber: number;
  readonly rowLocatorId: string;
  readonly lineId: string;
  readonly columnId: string | null;
  readonly role: BudgetColumnRole;
  readonly geometryUse: "exclusive" | "shared" | "absent";
  readonly state: CellState;
  readonly sourceSegmentIds: ReadonlyArray<string>;
  readonly fragmentIds: ReadonlyArray<string>;
  readonly upstreamCellHypothesisIds: ReadonlyArray<string>;
  readonly reasonCode: string;
}

export interface ParsedNumericEvidence {
  readonly rawText: string;
  readonly normalizedText: string;
  readonly displayedScale: number;
  readonly grammarId: string;
  readonly exactValue: ExactRational | null;
  readonly alternativeValues: ReadonlyArray<ExactRational>;
  readonly status: "resolved" | "ambiguous" | "invalid" | "not_applicable" | "failed";
  readonly sourceCellIds: ReadonlyArray<string>;
  readonly sourceFragmentIds: ReadonlyArray<string>;
}

export type ReconstructedRowKind =
  | "header"
  | "group"
  | "subgroup"
  | "service_item"
  | "subtotal"
  | "total"
  | "description_continuation"
  | "unclassified";

export interface ReconstructedLogicalRow {
  readonly rowId: string;
  readonly pageNumber: number;
  readonly locatorId: string;
  readonly kind: ReconstructedRowKind;
  readonly status: SemanticResolutionStatus;
  readonly cellIds: ReadonlyArray<string>;
  readonly description: string | null;
  readonly descriptionSourceRowIds: ReadonlyArray<string>;
  readonly continuationCandidateRowIds: ReadonlyArray<string>;
}

export type ReconstructedRecordKind =
  | "group"
  | "subgroup"
  | "service_item"
  | "subtotal"
  | "total"
  | "unclassified";

export interface ReconstructedBudgetRecord {
  readonly recordId: string;
  readonly pageNumber: number;
  readonly documentOrder: number;
  readonly kind: ReconstructedRecordKind;
  readonly status: SemanticResolutionStatus;
  readonly rowIds: ReadonlyArray<string>;
  readonly parentRecordId: string | null;
  readonly itemCode: string | null;
  readonly description: string | null;
  readonly unit: string | null;
  readonly quantity: ParsedNumericEvidence | null;
  readonly unitCost: ParsedNumericEvidence | null;
  readonly bdiRate: ParsedNumericEvidence | null;
  readonly unitPrice: ParsedNumericEvidence | null;
  readonly totalPrice: ParsedNumericEvidence | null;
}

export type ArithmeticEvaluationOutcome =
  | "direct_correspondence"
  | "undisplayed_precision"
  | "source_arithmetic_inconsistency"
  | "insufficient_evidence"
  | "missing_cell"
  | "divergent_cell"
  | "invented_evidence"
  | "not_applicable";

export interface ArithmeticEvaluation {
  readonly evaluationId: string;
  readonly relation: "quantity_times_unit_price" | "unit_cost_with_bdi" | "descendant_sum";
  readonly recordId: string;
  readonly outcome: ArithmeticEvaluationOutcome;
  readonly operandCellIds: ReadonlyArray<string>;
  readonly operandFragmentIds: ReadonlyArray<string>;
  readonly exactComputedValue: ExactRational | null;
  readonly displayedValue: ExactRational | null;
  readonly summandRecordIds: ReadonlyArray<string>;
}

export type EvidenceFinalDisposition =
  | "used_exclusively"
  | "used_shared"
  | "rejected_non_tabular"
  | "unresolved_ambiguous"
  | "unresolved_missing_geometry"
  | "not_applicable"
  | "failed";

export interface EvidenceDisposition {
  readonly evidenceId: string;
  readonly evidenceKind: "text_item" | "fragment" | "segment" | "line" | "cell" | "value";
  readonly locatorId: string | null;
  readonly disposition: EvidenceFinalDisposition;
  readonly reasonCode: string;
  readonly consumerIds: ReadonlyArray<string>;
}

export interface ReconstructionIssue {
  readonly code: string;
  readonly severity: "information" | "ambiguity" | "failure";
  readonly pageNumber: number | null;
  readonly evidenceIds: ReadonlyArray<string>;
}

export interface ReconstructionCompleteness {
  readonly applicableFieldCount: number;
  readonly presentFieldCount: number;
  readonly missingFieldCount: number;
  readonly divergentFieldCount: number;
  readonly ambiguousFieldCount: number;
  readonly exactFraction: ExactRational | null;
  readonly status: "complete" | "partial" | "insufficient" | "failed";
}

export interface ReconstructionSourceIdentity {
  readonly sourceByteHash: string;
  readonly physicalReaderName: string;
  readonly physicalReaderVersion: string;
  readonly physicalAdapterVersion: string;
  readonly underlyingLibraryVersion: string | null;
  readonly physicalGeometryContextFingerprint: string;
  readonly pageLocatorName: string;
  readonly pageLocatorVersion: string;
  readonly structureReconstructorName: string;
  readonly structureReconstructorVersion: string;
  readonly structureFingerprint: string;
  readonly columnFingerprint: string | null;
  readonly physicalCellFingerprint: string | null;
  readonly physicalCellTextFingerprint: string | null;
}

export interface ReconstructedBudgetTablePage {
  readonly pageNumber: number;
  readonly sourceStatus: string;
  readonly lineIds: ReadonlyArray<string>;
  readonly segmentIds: ReadonlyArray<string>;
  readonly textItemEvidenceIds: ReadonlyArray<string>;
  readonly columnIds: ReadonlyArray<string>;
  readonly cellIds: ReadonlyArray<string>;
  readonly logicalRowIds: ReadonlyArray<string>;
}

export interface BudgetTableReconstructionResult {
  readonly schemaVersion: 2;
  readonly engineName: "budget-table-reconstruction-engine";
  readonly engineVersion: string;
  readonly profileId: string;
  readonly profileVersion: number;
  readonly pageSelection: ReadonlyArray<number> | "all";
  readonly sourceIdentity: ReconstructionSourceIdentity;
  readonly status: "completed" | "completed_with_ambiguities" | "insufficient_evidence" | "failed";
  readonly locators: ReadonlyArray<CanonicalLocatorEntry>;
  readonly textItems: ReadonlyArray<EvidenceTextItem>;
  readonly fragments: ReadonlyArray<SourceFragment>;
  readonly lines: ReadonlyArray<EvidenceLine>;
  readonly segments: ReadonlyArray<EvidenceSegment>;
  readonly columns: ReadonlyArray<ResolvedColumn>;
  readonly cells: ReadonlyArray<ReconstructedCell>;
  readonly logicalRows: ReadonlyArray<ReconstructedLogicalRow>;
  readonly pages: ReadonlyArray<ReconstructedBudgetTablePage>;
  readonly records: ReadonlyArray<ReconstructedBudgetRecord>;
  readonly arithmeticEvaluations: ReadonlyArray<ArithmeticEvaluation>;
  readonly evidenceDispositions: ReadonlyArray<EvidenceDisposition>;
  readonly structuralIssues: ReadonlyArray<ReconstructionIssue>;
  readonly completeness: ReconstructionCompleteness;
  readonly canonicalFingerprint: string;
}
