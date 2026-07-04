export type FieldEvidenceMetadata = Readonly<Record<string, unknown>>;

export type FieldEvidenceId = string;

export type FieldEvidenceActor = string;

export type FieldEvidenceOccurredAt = string;

export type FieldEvidenceCorrelationId = string;

export type FieldEvidenceCreatedBy = string;

export type FieldEvidenceSourceSystem = string;

/**
 * Who or what originated this evidence. Deliberately about the
 * *originator role*, not a technical ingestion channel — there is no
 * "api"/"upload" value here because this sprint models the evidence
 * itself, never how it physically arrived.
 */
export enum EvidenceSource {
  FieldTeam = "field_team",
  MasterBuilder = "master_builder",
  MachineOperator = "machine_operator",
  Driver = "driver",
  Engineer = "engineer",
  Surveyor = "surveyor",
  Laboratory = "laboratory",
  DocumentUpload = "document_upload",
  SystemImport = "system_import",
}

/**
 * What kind of observation this evidence represents. Describes the
 * *nature* of the observation only — no file, image, or binary content
 * is modeled anywhere in this domain.
 */
export enum EvidenceType {
  Photo = "photo",
  Video = "video",
  Audio = "audio",
  HourMeter = "hour_meter",
  Odometer = "odometer",
  QuantityReport = "quantity_report",
  FieldNote = "field_note",
  DailyReport = "daily_report",
  Checklist = "checklist",
  GpsRecord = "gps_record",
  Document = "document",
  Spreadsheet = "spreadsheet",
  TopographyReport = "topography_report",
  LaboratoryTest = "laboratory_test",
}

/**
 * Lifecycle status of a single piece of field evidence.
 *
 * `Linked` and `UnderReview` are part of the Value Object's known
 * vocabulary but are intentionally NOT reachable through any transition
 * this sprint (see `allowedTransitions` in field-evidence.ts) — they are
 * reserved for the future Evidence Correlation / Evidence Review
 * capabilities explicitly out of scope for EPIC 12.1. Treating them the
 * same way keeps the enum forward-compatible without inventing behavior
 * this sprint does not own.
 */
export enum EvidenceStatus {
  Draft = "Draft",
  Submitted = "Submitted",
  Classified = "Classified",
  Linked = "Linked",
  UnderReview = "UnderReview",
  Approved = "Approved",
  Rejected = "Rejected",
  Archived = "Archived",
}

export enum EvidenceConfidence {
  Low = "Low",
  Medium = "Medium",
  High = "High",
  Verified = "Verified",
}

/**
 * What kind of assertion a claim makes. Purely descriptive of the
 * *nature* of the assertion — no calculation, no linkage to a budget
 * item, and no linkage to any other aggregate is implied by this type.
 */
export enum EvidenceClaimType {
  ExecutedQuantity = "executed_quantity",
  MachineUsage = "machine_usage",
  VehicleTrip = "vehicle_trip",
  MaterialDelivery = "material_delivery",
  PhotoObservation = "photo_observation",
  FieldObservation = "field_observation",
  DailyReportEntry = "daily_report_entry",
  TopographyMeasurement = "topography_measurement",
  LaboratoryResult = "laboratory_result",
  ScheduleProgress = "schedule_progress",
  SafetyOccurrence = "safety_occurrence",
  QualityOccurrence = "quality_occurrence",
}

export enum EvidenceUnit {
  Meter = "m",
  SquareMeter = "m2",
  CubicMeter = "m3",
  Kilogram = "kg",
  Ton = "ton",
  Hour = "hour",
  Trip = "trip",
  Unit = "unit",
  Percent = "percent",
  Day = "day",
  None = "none",
}

/**
 * A numeric assertion always travels with its unit — modeled as one
 * nested Value Object (rather than two separate flat fields on
 * `EvidenceClaim`) so that "a claim either has both a value and a unit,
 * or has neither" is a structural guarantee, not a rule to check.
 */
export interface EvidenceQuantity {
  readonly value: number;
  readonly unit: EvidenceUnit;
}

/**
 * A single structured assertion made by a piece of field evidence (e.g.
 * "escavação executada: 126 m³", "diário de obra registra ocorrência").
 * This is a Value Object of `FieldEvidence` — it does not calculate
 * measurement, does not link to a budget item, an
 * EngineeringProjectContext, a Measurement Workspace entry, or a
 * Document Reconstruction artifact. It only declares what the evidence
 * affirms.
 */
export interface EvidenceClaim {
  readonly id: string;
  readonly type: EvidenceClaimType;
  readonly subject: string;
  readonly quantity: EvidenceQuantity | null;
  readonly observedAt: string | null;
  readonly notes: string | null;
  readonly metadata: FieldEvidenceMetadata;
}

export interface EvidenceClaimInput {
  readonly id: string;
  readonly type: EvidenceClaimType;
  readonly subject: string;
  readonly quantity?: EvidenceQuantity | null;
  readonly observedAt?: string | null;
  readonly notes?: string | null;
  readonly metadata?: FieldEvidenceMetadata;
}

export interface EvidenceClaimSummary {
  readonly totalClaims: number;
  readonly claimsWithQuantity: number;
  readonly distinctClaimTypes: number;
}

/**
 * Curated, business-readable narrative of this evidence's own lifecycle
 * (creation, status transitions) — distinct from `trace`, which is the
 * full technical audit record of every mutation on the aggregate. In
 * this sprint every mutation is a status transition, so `timeline` and
 * `trace` grow together, but they remain conceptually separate records
 * for consistency with the rest of the BDOS domain layer.
 */
export interface FieldEvidenceTimelineEvent {
  readonly type: string;
  readonly occurredAt: FieldEvidenceOccurredAt;
  readonly description: string;
  readonly metadata: FieldEvidenceMetadata;
}

export interface FieldEvidenceTrace {
  readonly action: string;
  readonly actor: FieldEvidenceActor;
  readonly occurredAt: FieldEvidenceOccurredAt;
  readonly description: string;
  readonly metadata: FieldEvidenceMetadata;
}

export interface FieldEvidenceSummary {
  readonly status: EvidenceStatus;
  readonly confidence: EvidenceConfidence;
  readonly totalTraceEntries: number;
  readonly totalTimelineEntries: number;
  readonly isTerminal: boolean;
}

/**
 * Aggregate root representing a single piece of field evidence — the
 * inaugural aggregate of the Field Evidence Intelligence bounded
 * context. Represents one observation only: no bundles, no claims, no
 * review workflow, no correlation to measurement, and no document
 * reconstruction. Those are separate future aggregates this domain must
 * never import.
 */
export interface FieldEvidence {
  readonly id: FieldEvidenceId;
  readonly source: EvidenceSource;
  readonly type: EvidenceType;
  readonly status: EvidenceStatus;
  readonly confidence: EvidenceConfidence;
  readonly description: string;
  readonly captureDate: string | null;
  readonly captureReference: string;
  readonly claims: ReadonlyArray<EvidenceClaim>;
  readonly trace: ReadonlyArray<FieldEvidenceTrace>;
  readonly timeline: ReadonlyArray<FieldEvidenceTimelineEvent>;
  readonly metadata: FieldEvidenceMetadata;
}

export interface CreateFieldEvidenceInput {
  readonly id: FieldEvidenceId;
  readonly source: EvidenceSource;
  readonly type: EvidenceType;
  readonly description: string;
  readonly captureReference: string;
  readonly captureDate?: string | null;
  readonly confidence?: EvidenceConfidence;
  readonly actor: FieldEvidenceActor;
  readonly occurredAt: FieldEvidenceOccurredAt;
  readonly correlationId: FieldEvidenceCorrelationId;
  readonly createdBy: FieldEvidenceCreatedBy;
  readonly sourceSystem: FieldEvidenceSourceSystem;
  readonly metadata?: FieldEvidenceMetadata;
}

export interface SubmitFieldEvidenceInput {
  readonly evidence: FieldEvidence;
  readonly actor: FieldEvidenceActor;
  readonly occurredAt: FieldEvidenceOccurredAt;
  readonly metadata?: FieldEvidenceMetadata;
}

export interface ClassifyFieldEvidenceInput {
  readonly evidence: FieldEvidence;
  readonly actor: FieldEvidenceActor;
  readonly occurredAt: FieldEvidenceOccurredAt;
  readonly metadata?: FieldEvidenceMetadata;
}

export interface ApproveFieldEvidenceInput {
  readonly evidence: FieldEvidence;
  readonly actor: FieldEvidenceActor;
  readonly occurredAt: FieldEvidenceOccurredAt;
  readonly metadata?: FieldEvidenceMetadata;
}

export interface RejectFieldEvidenceInput {
  readonly evidence: FieldEvidence;
  readonly actor: FieldEvidenceActor;
  readonly occurredAt: FieldEvidenceOccurredAt;
  readonly metadata?: FieldEvidenceMetadata;
}

export interface ArchiveFieldEvidenceInput {
  readonly evidence: FieldEvidence;
  readonly actor: FieldEvidenceActor;
  readonly occurredAt: FieldEvidenceOccurredAt;
  readonly metadata?: FieldEvidenceMetadata;
}

export interface AddEvidenceClaimInput {
  readonly evidence: FieldEvidence;
  readonly claim: EvidenceClaimInput;
  readonly actor: FieldEvidenceActor;
  readonly occurredAt: FieldEvidenceOccurredAt;
  readonly metadata?: FieldEvidenceMetadata;
}

export type FieldEvidenceErrorCode =
  | "missing_id"
  | "missing_description"
  | "missing_source"
  | "missing_type"
  | "missing_capture_reference"
  | "evidence_terminal"
  | "invalid_evidence_status_transition"
  | "missing_claim_id"
  | "duplicate_claim_id"
  | "missing_claim_type"
  | "missing_claim_subject"
  | "missing_claim_unit"
  | "negative_claim_quantity"
  | "invalid_claim_percent"
  | "evidence_locked_for_claims";

export interface FieldEvidenceError {
  readonly code: FieldEvidenceErrorCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: FieldEvidenceMetadata;
}

export type FieldEvidenceWarningCode = "none";

export interface FieldEvidenceWarning {
  readonly code: FieldEvidenceWarningCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: FieldEvidenceMetadata;
}

export interface FieldEvidenceSuccess {
  readonly success: true;
  readonly evidence: FieldEvidence;
  readonly errors: ReadonlyArray<FieldEvidenceError>;
  readonly warnings: ReadonlyArray<FieldEvidenceWarning>;
  readonly metadata: FieldEvidenceMetadata;
}

export interface FieldEvidenceFailure {
  readonly success: false;
  readonly evidence: null;
  readonly errors: ReadonlyArray<FieldEvidenceError>;
  readonly warnings: ReadonlyArray<FieldEvidenceWarning>;
  readonly metadata: FieldEvidenceMetadata;
}

export type FieldEvidenceResult = FieldEvidenceSuccess | FieldEvidenceFailure;

export type EvidenceBundleId = string;

/**
 * `Validated` and `Rejected` are operationally terminal — no further
 * curation of the evidence set is possible — but both can still move
 * forward to `Archived`, which is the only absolute terminal status.
 */
export enum EvidenceBundleStatus {
  Draft = "Draft",
  Open = "Open",
  UnderReview = "UnderReview",
  Validated = "Validated",
  Rejected = "Rejected",
  Archived = "Archived",
}

/**
 * Curated, business-readable narrative of this bundle's own lifecycle
 * (creation, status transitions) — distinct from `trace`, which is the
 * full technical audit record of every mutation, including membership
 * changes (adding/removing an evidenceId, changing the primary) that do
 * NOT touch `timeline`.
 */
export interface EvidenceBundleTimelineEvent {
  readonly type: string;
  readonly occurredAt: FieldEvidenceOccurredAt;
  readonly description: string;
  readonly metadata: FieldEvidenceMetadata;
}

export interface EvidenceBundleTrace {
  readonly action: string;
  readonly actor: FieldEvidenceActor;
  readonly occurredAt: FieldEvidenceOccurredAt;
  readonly description: string;
  readonly metadata: FieldEvidenceMetadata;
}

export interface EvidenceBundleSummary {
  readonly status: EvidenceBundleStatus;
  readonly totalEvidenceIds: number;
  readonly hasPrimaryEvidence: boolean;
  readonly totalTraceEntries: number;
  readonly totalTimelineEntries: number;
  readonly isTerminal: boolean;
}

/**
 * Aggregate root representing a group of field evidences relating to
 * the same technical context (e.g. "Escavação — Frente 03 — Dia
 * 10/07/2026"). Deliberately does NOT embed `FieldEvidence` objects —
 * it references them only by `evidenceId: string`, preserving the
 * boundary between the two aggregates. Does not know about contracts,
 * measurement, EngineeringProjectContext, Approval Workflow, or Document
 * Reconstruction — it only groups related evidence references.
 */
export interface EvidenceBundle {
  readonly id: EvidenceBundleId;
  readonly title: string;
  readonly description: string;
  readonly status: EvidenceBundleStatus;
  readonly evidenceIds: ReadonlyArray<FieldEvidenceId>;
  readonly primaryEvidenceId: FieldEvidenceId | null;
  readonly tags: ReadonlyArray<string>;
  readonly trace: ReadonlyArray<EvidenceBundleTrace>;
  readonly timeline: ReadonlyArray<EvidenceBundleTimelineEvent>;
  readonly metadata: FieldEvidenceMetadata;
}

export interface CreateEvidenceBundleInput {
  readonly id: EvidenceBundleId;
  readonly title: string;
  readonly description: string;
  readonly evidenceIds?: ReadonlyArray<FieldEvidenceId> | null;
  readonly primaryEvidenceId?: FieldEvidenceId | null;
  readonly tags?: ReadonlyArray<string> | null;
  readonly actor: FieldEvidenceActor;
  readonly occurredAt: FieldEvidenceOccurredAt;
  readonly correlationId: FieldEvidenceCorrelationId;
  readonly createdBy: FieldEvidenceCreatedBy;
  readonly sourceSystem: FieldEvidenceSourceSystem;
  readonly metadata?: FieldEvidenceMetadata;
}

export interface OpenEvidenceBundleInput {
  readonly bundle: EvidenceBundle;
  readonly actor: FieldEvidenceActor;
  readonly occurredAt: FieldEvidenceOccurredAt;
  readonly metadata?: FieldEvidenceMetadata;
}

export interface AddEvidenceToBundleInput {
  readonly bundle: EvidenceBundle;
  readonly evidenceId: FieldEvidenceId;
  readonly actor: FieldEvidenceActor;
  readonly occurredAt: FieldEvidenceOccurredAt;
  readonly metadata?: FieldEvidenceMetadata;
}

export interface RemoveEvidenceFromBundleInput {
  readonly bundle: EvidenceBundle;
  readonly evidenceId: FieldEvidenceId;
  readonly actor: FieldEvidenceActor;
  readonly occurredAt: FieldEvidenceOccurredAt;
  readonly metadata?: FieldEvidenceMetadata;
}

/**
 * `evidenceId: null` clears the current primary — the only way to make
 * a primary evidenceId removable via `removeEvidenceFromBundle`.
 */
export interface SetPrimaryEvidenceInput {
  readonly bundle: EvidenceBundle;
  readonly evidenceId: FieldEvidenceId | null;
  readonly actor: FieldEvidenceActor;
  readonly occurredAt: FieldEvidenceOccurredAt;
  readonly metadata?: FieldEvidenceMetadata;
}

export interface SubmitEvidenceBundleForReviewInput {
  readonly bundle: EvidenceBundle;
  readonly actor: FieldEvidenceActor;
  readonly occurredAt: FieldEvidenceOccurredAt;
  readonly metadata?: FieldEvidenceMetadata;
}

export interface ValidateEvidenceBundleInput {
  readonly bundle: EvidenceBundle;
  readonly actor: FieldEvidenceActor;
  readonly occurredAt: FieldEvidenceOccurredAt;
  readonly metadata?: FieldEvidenceMetadata;
}

export interface RejectEvidenceBundleInput {
  readonly bundle: EvidenceBundle;
  readonly actor: FieldEvidenceActor;
  readonly occurredAt: FieldEvidenceOccurredAt;
  readonly metadata?: FieldEvidenceMetadata;
}

export interface ArchiveEvidenceBundleInput {
  readonly bundle: EvidenceBundle;
  readonly actor: FieldEvidenceActor;
  readonly occurredAt: FieldEvidenceOccurredAt;
  readonly metadata?: FieldEvidenceMetadata;
}

export type EvidenceBundleErrorCode =
  | "missing_id"
  | "missing_title"
  | "missing_description"
  | "duplicate_evidence_id"
  | "missing_evidence_id"
  | "unknown_primary_evidence_reference"
  | "evidence_id_not_found"
  | "cannot_remove_primary_evidence"
  | "bundle_terminal"
  | "bundle_locked_for_evidence_changes"
  | "invalid_evidence_bundle_status_transition";

export interface EvidenceBundleError {
  readonly code: EvidenceBundleErrorCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: FieldEvidenceMetadata;
}

export type EvidenceBundleWarningCode = "none";

export interface EvidenceBundleWarning {
  readonly code: EvidenceBundleWarningCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: FieldEvidenceMetadata;
}

export interface EvidenceBundleSuccess {
  readonly success: true;
  readonly bundle: EvidenceBundle;
  readonly errors: ReadonlyArray<EvidenceBundleError>;
  readonly warnings: ReadonlyArray<EvidenceBundleWarning>;
  readonly metadata: FieldEvidenceMetadata;
}

export interface EvidenceBundleFailure {
  readonly success: false;
  readonly bundle: null;
  readonly errors: ReadonlyArray<EvidenceBundleError>;
  readonly warnings: ReadonlyArray<EvidenceBundleWarning>;
  readonly metadata: FieldEvidenceMetadata;
}

export type EvidenceBundleResult = EvidenceBundleSuccess | EvidenceBundleFailure;
