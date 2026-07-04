export type DocumentReconstructionMetadata = Readonly<Record<string, unknown>>;

export type DocumentReconstructionId = string;

export type DocumentReconstructionActor = string;

export type DocumentReconstructionOccurredAt = string;

export type DocumentReconstructionCorrelationId = string;

export type DocumentReconstructionCreatedBy = string;

export type DocumentReconstructionSourceSystem = string;

export type ReconstructionSectionId = string;

export type ReconstructionSourceId = string;

export type ReconstructionFieldId = string;

export type DocumentReconstructionIssueId = string;

export type ReconstructionSourceConfidence = number;

export type ReconstructionFieldConfidence = number;

export enum DocumentReconstructionStatus {
  Draft = "Draft",
  Reconstructing = "Reconstructing",
  Reconstructed = "Reconstructed",
  Incomplete = "Incomplete",
  ReadyForReview = "ReadyForReview",
  Approved = "Approved",
  Rejected = "Rejected",
  Archived = "Archived",
}

/**
 * Generic catalog of technical document kinds this Aggregate can model
 * a reconstruction for. This chapter does not render, parse, or produce
 * any of these formats — it only names the intent.
 */
export enum DocumentReconstructionDocumentType {
  MeasurementBulletin = "MeasurementBulletin",
  MeasurementMemory = "MeasurementMemory",
  PhotoReport = "PhotoReport",
  TechnicalReport = "TechnicalReport",
  InspectionReport = "InspectionReport",
  FieldReport = "FieldReport",
  Checklist = "Checklist",
  GeneralDocument = "GeneralDocument",
}

export enum ReconstructionSectionStatus {
  Draft = "Draft",
  Building = "Building",
  Completed = "Completed",
  Incomplete = "Incomplete",
  Archived = "Archived",
}

/**
 * The hierarchical structure of a reconstructed document, one section
 * at a time. `fields` is deliberately `ReadonlyArray<string>` — opaque
 * future `ReconstructionField` ids — no `ReconstructionField` object
 * exists yet (out of scope for this Epic). `sourceIds` references only
 * `ReconstructionSource.id` values already recorded on this same
 * `DocumentReconstruction` (Epic 14.2); it never references
 * `FieldEvidence`, `CalculationMemory` or a workspace id directly.
 * `issues` mirrors `fields`: opaque string ids, no issue object modeled
 * here. This Epic does not create fields, does not fill data, and does
 * not reconstruct anything — it only structures the section shell.
 */
export interface ReconstructionSection {
  readonly id: ReconstructionSectionId;
  readonly title: string;
  readonly description: string | null;
  readonly order: number;
  readonly status: ReconstructionSectionStatus;
  readonly fields: ReadonlyArray<string>;
  readonly sourceIds: ReadonlyArray<ReconstructionSourceId>;
  readonly issues: ReadonlyArray<string>;
  readonly metadata: DocumentReconstructionMetadata;
}

export interface ReconstructionSectionInput {
  readonly id: ReconstructionSectionId;
  readonly title: string;
  readonly description?: string | null;
  readonly order: number;
  readonly metadata?: DocumentReconstructionMetadata;
}

export interface ReconstructionSectionSummary {
  readonly totalSections: number;
  readonly completedSections: number;
  readonly incompleteSections: number;
  readonly draftSections: number;
  readonly buildingSections: number;
  readonly archivedSections: number;
}

export enum ReconstructionFieldStatus {
  Draft = "Draft",
  Building = "Building",
  Completed = "Completed",
  Incomplete = "Incomplete",
  Archived = "Archived",
}

export enum ReconstructionFieldValueType {
  Text = "Text",
  Number = "Number",
  Boolean = "Boolean",
  Date = "Date",
  Currency = "Currency",
  Percentage = "Percentage",
  Measurement = "Measurement",
  Reference = "Reference",
}

/**
 * A reconstructed field's stored value. Deliberately a plain,
 * already-serializable primitive — never a `Date` object, never
 * something that requires computing or parsing against `valueType`.
 * This domain never validates `value` against `valueType`; it only
 * stores whatever value a caller sets via `updateReconstructionFieldValue`.
 */
export type ReconstructionFieldValue = string | number | boolean | null;

/**
 * The smallest unit of information of a reconstructed document — one
 * logical, reconstructed datum. `sectionId` must reference an existing
 * `ReconstructionSection.id` on the same `DocumentReconstruction`
 * (Epic 14.3); `sourceIds` references only `ReconstructionSource.id`
 * values (Epic 14.2) — never `FieldEvidence`, `CalculationMemory`, or a
 * workspace id directly. `value` always starts `null`; this Epic does
 * not execute any automatic reconstruction, does not consult any other
 * domain, and does not render anything — it only creates and manages
 * the field shell.
 */
export interface ReconstructionField {
  readonly id: ReconstructionFieldId;
  readonly sectionId: ReconstructionSectionId;
  readonly key: string;
  readonly label: string;
  readonly value: ReconstructionFieldValue;
  readonly valueType: ReconstructionFieldValueType;
  readonly status: ReconstructionFieldStatus;
  readonly required: boolean;
  readonly confidence: ReconstructionFieldConfidence;
  readonly sourceIds: ReadonlyArray<ReconstructionSourceId>;
  readonly metadata: DocumentReconstructionMetadata;
}

export interface ReconstructionFieldInput {
  readonly id: ReconstructionFieldId;
  readonly sectionId: ReconstructionSectionId;
  readonly key: string;
  readonly label: string;
  readonly valueType: ReconstructionFieldValueType;
  readonly required: boolean;
  readonly confidence: ReconstructionFieldConfidence;
  readonly metadata?: DocumentReconstructionMetadata;
}

export interface ReconstructionFieldSummary {
  readonly totalFields: number;
  readonly completedFields: number;
  readonly incompleteFields: number;
  readonly draftFields: number;
  readonly buildingFields: number;
  readonly archivedFields: number;
  readonly requiredFields: number;
  readonly completedRequiredFields: number;
  readonly averageConfidence: number;
}

/**
 * Catalog of upstream artifact kinds a `ReconstructionSource` may point
 * to. This domain never imports or resolves any of these bounded
 * contexts — `sourceId` is always an opaque string reference, never a
 * typed foreign key.
 */
export enum ReconstructionSourceType {
  FieldEvidence = "FieldEvidence",
  EvidenceBundle = "EvidenceBundle",
  CalculationMemory = "CalculationMemory",
  CalculationWorkspace = "CalculationWorkspace",
  MeasurementMemory = "MeasurementMemory",
  ManualInput = "ManualInput",
  ExternalReference = "ExternalReference",
}

/**
 * A single traceable origin of information used to reconstruct a
 * document. This Aggregate never resolves, reads, or validates the
 * artifact `sourceId` points to — it only records that it was used.
 * `id` is this source record's own identity (unique within a single
 * `DocumentReconstruction`); `sourceId` is the opaque external
 * reference and may repeat across sources of different `sourceType`s,
 * since each pair (sourceType, sourceId) denotes a distinct real-world
 * artifact.
 */
export interface ReconstructionSource {
  readonly id: ReconstructionSourceId;
  readonly sourceType: ReconstructionSourceType;
  readonly sourceId: string;
  readonly description: string | null;
  readonly confidence: ReconstructionSourceConfidence;
  readonly metadata: DocumentReconstructionMetadata;
}

export interface ReconstructionSourceInput {
  readonly id: ReconstructionSourceId;
  readonly sourceType: ReconstructionSourceType;
  readonly sourceId: string;
  readonly description?: string | null;
  readonly confidence: ReconstructionSourceConfidence;
  readonly metadata?: DocumentReconstructionMetadata;
}

export interface ReconstructionSourceTypeCount {
  readonly sourceType: ReconstructionSourceType;
  readonly total: number;
}

/**
 * Richer, on-demand traceability report over `sources` — distinct from
 * `DocumentReconstructionSummary.totalSources`, which only ever reflects
 * the current count.
 */
export interface ReconstructionSourceSummary {
  readonly totalSources: number;
  readonly totalByType: ReadonlyArray<ReconstructionSourceTypeCount>;
  readonly distinctSourceTypes: number;
  readonly averageConfidence: number;
}

/**
 * A structural inconsistency noted against the reconstruction (e.g. a
 * missing section). This Aggregate only records the existence of an
 * issue — it never evaluates or resolves one.
 */
export interface DocumentReconstructionIssue {
  readonly id: DocumentReconstructionIssueId;
  readonly description: string;
  readonly metadata: DocumentReconstructionMetadata;
}

/**
 * Curated, business-readable narrative of the reconstruction's own
 * lifecycle (status transitions only) — distinct from `trace`, which is
 * the full technical audit record of every mutation.
 */
export interface DocumentReconstructionTimelineEvent {
  readonly type: string;
  readonly occurredAt: DocumentReconstructionOccurredAt;
  readonly description: string;
  readonly metadata: DocumentReconstructionMetadata;
}

export interface DocumentReconstructionTrace {
  readonly action: string;
  readonly actor: DocumentReconstructionActor;
  readonly occurredAt: DocumentReconstructionOccurredAt;
  readonly description: string;
  readonly metadata: DocumentReconstructionMetadata;
}

export interface DocumentReconstructionSummary {
  readonly totalSections: number;
  readonly totalIssues: number;
  readonly totalSources: number;
  readonly totalFields: number;
  readonly status: DocumentReconstructionStatus;
  readonly documentType: DocumentReconstructionDocumentType;
  readonly isComplete: boolean;
}

/**
 * Aggregate Root inaugurating Chapter IV (Document Reconstruction
 * Intelligence). Represents the logical reconstruction model of a
 * technical document only. It does not represent a PDF, a Word
 * document, an HTML file, or any rendered document — it never renders, calculates,
 * or integrates with any other bounded context. `issues` starts empty
 * and remains a structural placeholder; `sources` is managed by
 * `addReconstructionSource`/`removeReconstructionSource` (Epic 14.2);
 * `sections` is managed by `addReconstructionSection`/
 * `removeReconstructionSection`/`advanceReconstructionSectionStatus`
 * (Epic 14.3); `fields` is managed by `addReconstructionField`/
 * `removeReconstructionField`/`updateReconstructionFieldValue`/
 * `advanceReconstructionFieldStatus` (Epic 14.4) — every field's own
 * `section.fields` array is kept in sync automatically.
 */
export interface DocumentReconstruction {
  readonly id: DocumentReconstructionId;
  readonly title: string;
  readonly documentType: DocumentReconstructionDocumentType;
  readonly status: DocumentReconstructionStatus;
  readonly description: string | null;
  readonly sections: ReadonlyArray<ReconstructionSection>;
  readonly sources: ReadonlyArray<ReconstructionSource>;
  readonly fields: ReadonlyArray<ReconstructionField>;
  readonly issues: ReadonlyArray<DocumentReconstructionIssue>;
  readonly timeline: ReadonlyArray<DocumentReconstructionTimelineEvent>;
  readonly trace: ReadonlyArray<DocumentReconstructionTrace>;
  readonly summary: DocumentReconstructionSummary;
  readonly metadata: DocumentReconstructionMetadata;
}

export interface CreateDocumentReconstructionInput {
  readonly id: DocumentReconstructionId;
  readonly title: string;
  readonly documentType: DocumentReconstructionDocumentType;
  readonly description?: string | null;
  readonly actor: DocumentReconstructionActor;
  readonly occurredAt: DocumentReconstructionOccurredAt;
  readonly correlationId: DocumentReconstructionCorrelationId;
  readonly createdBy: DocumentReconstructionCreatedBy;
  readonly sourceSystem: DocumentReconstructionSourceSystem;
  readonly metadata?: DocumentReconstructionMetadata;
}

export interface AdvanceDocumentReconstructionStatusInput {
  readonly documentReconstruction: DocumentReconstruction;
  readonly toStatus: DocumentReconstructionStatus;
  readonly actor: DocumentReconstructionActor;
  readonly occurredAt: DocumentReconstructionOccurredAt;
  readonly metadata?: DocumentReconstructionMetadata;
}

export interface AddReconstructionSourceInput {
  readonly documentReconstruction: DocumentReconstruction;
  readonly source: ReconstructionSourceInput;
  readonly actor: DocumentReconstructionActor;
  readonly occurredAt: DocumentReconstructionOccurredAt;
  readonly metadata?: DocumentReconstructionMetadata;
}

export interface RemoveReconstructionSourceInput {
  readonly documentReconstruction: DocumentReconstruction;
  readonly id: ReconstructionSourceId;
  readonly actor: DocumentReconstructionActor;
  readonly occurredAt: DocumentReconstructionOccurredAt;
  readonly metadata?: DocumentReconstructionMetadata;
}

export interface AddReconstructionSectionInput {
  readonly documentReconstruction: DocumentReconstruction;
  readonly section: ReconstructionSectionInput;
  readonly actor: DocumentReconstructionActor;
  readonly occurredAt: DocumentReconstructionOccurredAt;
  readonly metadata?: DocumentReconstructionMetadata;
}

export interface RemoveReconstructionSectionInput {
  readonly documentReconstruction: DocumentReconstruction;
  readonly id: ReconstructionSectionId;
  readonly actor: DocumentReconstructionActor;
  readonly occurredAt: DocumentReconstructionOccurredAt;
  readonly metadata?: DocumentReconstructionMetadata;
}

export interface UpdateReconstructionSectionStatusInput {
  readonly documentReconstruction: DocumentReconstruction;
  readonly id: ReconstructionSectionId;
  readonly toStatus: ReconstructionSectionStatus;
  readonly actor: DocumentReconstructionActor;
  readonly occurredAt: DocumentReconstructionOccurredAt;
  readonly metadata?: DocumentReconstructionMetadata;
}

export interface AddReconstructionFieldInput {
  readonly documentReconstruction: DocumentReconstruction;
  readonly field: ReconstructionFieldInput;
  readonly actor: DocumentReconstructionActor;
  readonly occurredAt: DocumentReconstructionOccurredAt;
  readonly metadata?: DocumentReconstructionMetadata;
}

export interface RemoveReconstructionFieldInput {
  readonly documentReconstruction: DocumentReconstruction;
  readonly id: ReconstructionFieldId;
  readonly actor: DocumentReconstructionActor;
  readonly occurredAt: DocumentReconstructionOccurredAt;
  readonly metadata?: DocumentReconstructionMetadata;
}

export interface UpdateReconstructionFieldStatusInput {
  readonly documentReconstruction: DocumentReconstruction;
  readonly id: ReconstructionFieldId;
  readonly toStatus: ReconstructionFieldStatus;
  readonly actor: DocumentReconstructionActor;
  readonly occurredAt: DocumentReconstructionOccurredAt;
  readonly metadata?: DocumentReconstructionMetadata;
}

export interface UpdateReconstructionFieldValueInput {
  readonly documentReconstruction: DocumentReconstruction;
  readonly id: ReconstructionFieldId;
  readonly value: ReconstructionFieldValue;
  readonly actor: DocumentReconstructionActor;
  readonly occurredAt: DocumentReconstructionOccurredAt;
  readonly metadata?: DocumentReconstructionMetadata;
}

export type DocumentReconstructionErrorCode =
  | "missing_id"
  | "missing_title"
  | "missing_document_type"
  | "document_reconstruction_terminal"
  | "invalid_document_reconstruction_status_transition"
  | "missing_reconstruction_source_id"
  | "duplicate_reconstruction_source_id"
  | "missing_reconstruction_source_type"
  | "missing_reconstruction_source_reference_id"
  | "invalid_reconstruction_source_confidence"
  | "reconstruction_source_not_found"
  | "document_reconstruction_locked_for_source_changes"
  | "missing_reconstruction_section_id"
  | "missing_reconstruction_section_title"
  | "invalid_reconstruction_section_order"
  | "duplicate_reconstruction_section_id"
  | "duplicate_reconstruction_section_order"
  | "reconstruction_section_not_found"
  | "reconstruction_section_terminal"
  | "invalid_reconstruction_section_status_transition"
  | "document_reconstruction_locked_for_section_changes"
  | "missing_reconstruction_field_id"
  | "missing_reconstruction_field_section_id"
  | "reconstruction_field_section_not_found"
  | "missing_reconstruction_field_key"
  | "missing_reconstruction_field_label"
  | "missing_reconstruction_field_value_type"
  | "invalid_reconstruction_field_confidence"
  | "duplicate_reconstruction_field_id"
  | "duplicate_reconstruction_field_key"
  | "reconstruction_field_not_found"
  | "reconstruction_field_terminal"
  | "invalid_reconstruction_field_status_transition"
  | "document_reconstruction_locked_for_field_changes";

export interface DocumentReconstructionError {
  readonly code: DocumentReconstructionErrorCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: DocumentReconstructionMetadata;
}

export type DocumentReconstructionWarningCode = "none";

export interface DocumentReconstructionWarning {
  readonly code: DocumentReconstructionWarningCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: DocumentReconstructionMetadata;
}

export interface DocumentReconstructionSuccess {
  readonly success: true;
  readonly documentReconstruction: DocumentReconstruction;
  readonly errors: ReadonlyArray<DocumentReconstructionError>;
  readonly warnings: ReadonlyArray<DocumentReconstructionWarning>;
  readonly metadata: DocumentReconstructionMetadata;
}

export interface DocumentReconstructionFailure {
  readonly success: false;
  readonly documentReconstruction: null;
  readonly errors: ReadonlyArray<DocumentReconstructionError>;
  readonly warnings: ReadonlyArray<DocumentReconstructionWarning>;
  readonly metadata: DocumentReconstructionMetadata;
}

export type DocumentReconstructionResult = DocumentReconstructionSuccess | DocumentReconstructionFailure;
