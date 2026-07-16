import { BudgetDocumentSignalId } from "../budget-document-signal-catalog.types";

export const SYNTHETIC_REFERENCE_SUITE_SCHEMA_VERSION = 1 as const;

export const SYNTHETIC_REFERENCE_SUITE_VERSION = "budget-document-location-synthetic-suite-v1" as const;

export enum SyntheticReferenceDocumentCategory {
  PositiveStructureA = "PositiveStructureA",
  PositiveStructureB = "PositiveStructureB",
  FalsePositiveIndexListing = "FalsePositiveIndexListing",
  FalsePositiveFinancialStatement = "FalsePositiveFinancialStatement",
  FalsePositivePhysicalFinancialSchedule = "FalsePositivePhysicalFinancialSchedule",
  FalsePositiveAdversarial = "FalsePositiveAdversarial",
  FalsePositiveGeometryWithoutBudget = "FalsePositiveGeometryWithoutBudget",
  DocumentaryConditionCases = "DocumentaryConditionCases",
}

export enum SyntheticPageDocumentaryRole {
  ReferenceIndex = "ReferenceIndex",
  CoverContext = "CoverContext",
  Summary = "Summary",
  DetailedStructure = "DetailedStructure",
  Continuity = "Continuity",
  Closure = "Closure",
  Unrelated = "Unrelated",
}

export enum SyntheticPageReferenceDecision {
  Candidate = "Candidate",
  Contextual = "Contextual",
  Ambiguous = "Ambiguous",
  Discarded = "Discarded",
}

export enum SyntheticPageExtractionAvailability {
  TextAvailable = "TextAvailable",
  NoExtractableText = "NoExtractableText",
  ExtractionError = "ExtractionError",
}

export enum SyntheticPageExtractionQuality {
  Acceptable = "Acceptable",
  Degraded = "Degraded",
  Indeterminate = "Indeterminate",
}

export enum SyntheticPageComposition {
  PredominantlyTextual = "PredominantlyTextual",
  Mixed = "Mixed",
  GraphicOrImage = "GraphicOrImage",
  NotDeterminable = "NotDeterminable",
}

export type SyntheticPageOrientation = "Portrait" | "Landscape";

export interface SyntheticPageGeometry {
  readonly widthPoints: number;
  readonly heightPoints: number;
  readonly orientation: SyntheticPageOrientation;
}

export interface SyntheticSignalOccurrence {
  readonly signalId: BudgetDocumentSignalId;
  readonly observedForm: string;
}

/**
 * The expected truth for one synthetic page, authored by hand. The future
 * decision mechanism (Sprint 21.4A.2.e) is measured against it, never
 * computes it.
 */
export interface SyntheticPageReference {
  readonly pageId: string;
  readonly syntheticPhysicalPageNumber: number;
  readonly documentaryRoles: ReadonlyArray<SyntheticPageDocumentaryRole>;
  readonly expectedSignals: ReadonlyArray<SyntheticSignalOccurrence>;
  readonly explicitlyAbsentSignalIds: ReadonlyArray<BudgetDocumentSignalId>;
  readonly referenceDecision: SyntheticPageReferenceDecision;
  readonly continuityGroupId: string | null;
  readonly expectedGaps: ReadonlyArray<string>;
  readonly humanRationale: string;
  readonly geometry: SyntheticPageGeometry;
  readonly extractionAvailability: SyntheticPageExtractionAvailability;
  readonly extractionQuality: SyntheticPageExtractionQuality;
  readonly composition: SyntheticPageComposition;
  readonly fixtureVersion: number;
}

export interface SyntheticReferenceDocument {
  readonly documentId: string;
  readonly category: SyntheticReferenceDocumentCategory;
  readonly humanName: string;
  readonly description: string;
  readonly pages: ReadonlyArray<SyntheticPageReference>;
  readonly fixtureVersion: number;
}

export interface SyntheticReferenceSuite {
  readonly schemaVersion: typeof SYNTHETIC_REFERENCE_SUITE_SCHEMA_VERSION;
  readonly suiteVersion: typeof SYNTHETIC_REFERENCE_SUITE_VERSION;
  readonly documents: ReadonlyArray<SyntheticReferenceDocument>;
}

export type SyntheticReferenceSuiteIssueCode =
  | "insufficient_positive_documents"
  | "positive_documents_not_materially_distinct"
  | "insufficient_false_positive_documents"
  | "missing_adversarial_document"
  | "missing_referential_only_case"
  | "missing_structural_without_exact_phrase_case"
  | "missing_geometry_only_false_positive"
  | "missing_documentary_condition_case"
  | "missing_closure_case"
  | "missing_multiple_role_page"
  | "duplicate_document_id"
  | "duplicate_page_id"
  | "missing_fixture_version"
  | "missing_rationale"
  | "inconsistent_page_numbering"
  | "dangling_continuity_reference"
  | "dangling_signal_reference"
  | "contradictory_signal_expectation"
  | "schema_version_mismatch"
  | "suite_version_mismatch";

export interface SyntheticReferenceSuiteIssue {
  readonly code: SyntheticReferenceSuiteIssueCode;
  readonly documentId: string | null;
  readonly pageId: string | null;
  readonly message: string;
}
