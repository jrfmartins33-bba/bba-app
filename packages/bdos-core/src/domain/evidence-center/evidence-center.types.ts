export type EvidenceCenterMetadata = Readonly<Record<string, unknown>>;

export type EvidenceRecordId = string;

export type EvidenceOrganizationId = string;

export type EvidenceClientId = string;

export type EvidenceContractId = string;

export type EvidenceProjectId = string;

export type EvidenceWorkPackageId = string;

export type EvidenceServiceItemId = string;

export type EvidenceMeasurementPeriodId = string;

export type EvidenceMeasurementEntryId = string;

export type EvidenceMeasurementCycleId = string;

export type EvidenceCapturedById = string;

export type EvidenceCapturedByName = string;

export type EvidenceCorrelationId = string;

export type EvidenceCreatedBy = string;

export type EvidenceSourceSystem = string;

export enum EvidenceType {
  Photo = "photo",
  Video = "video",
  Pdf = "pdf",
  Spreadsheet = "spreadsheet",
  Drawing = "drawing",
  FieldReport = "field_report",
  CalculationMemory = "calculation_memory",
  DroneImage = "drone_image",
  Other = "other",
}

export enum EvidenceStatus {
  Draft = "Draft",
  Attached = "Attached",
  Verified = "Verified",
  Rejected = "Rejected",
  Cancelled = "Cancelled",
}

export interface EvidenceLink {
  readonly id: string;
  readonly label: string;
  readonly uri: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly checksum: string;
  readonly metadata: EvidenceCenterMetadata;
}

export interface EvidenceRecord {
  readonly id: EvidenceRecordId;
  readonly organizationId: EvidenceOrganizationId;
  readonly clientId: EvidenceClientId | null;
  readonly contractId: EvidenceContractId;
  readonly projectId: EvidenceProjectId;
  readonly workPackageId: EvidenceWorkPackageId | null;
  readonly serviceItemId: EvidenceServiceItemId | null;
  readonly measurementPeriodId: EvidenceMeasurementPeriodId | null;
  readonly measurementEntryId: EvidenceMeasurementEntryId | null;
  readonly measurementCycleId: EvidenceMeasurementCycleId | null;
  readonly type: EvidenceType;
  readonly title: string;
  readonly description: string;
  readonly capturedAt: string;
  readonly capturedById: EvidenceCapturedById;
  readonly capturedByName: EvidenceCapturedByName;
  readonly location: string;
  readonly links: ReadonlyArray<EvidenceLink>;
  readonly status: EvidenceStatus;
  readonly metadata: EvidenceCenterMetadata;
}

export interface CreateEvidenceRecordInput {
  readonly id: EvidenceRecordId;
  readonly organizationId: EvidenceOrganizationId;
  readonly clientId?: EvidenceClientId | null;
  readonly contractId: EvidenceContractId;
  readonly projectId: EvidenceProjectId;
  readonly workPackageId?: EvidenceWorkPackageId | null;
  readonly serviceItemId?: EvidenceServiceItemId | null;
  readonly measurementPeriodId?: EvidenceMeasurementPeriodId | null;
  readonly measurementEntryId?: EvidenceMeasurementEntryId | null;
  readonly measurementCycleId?: EvidenceMeasurementCycleId | null;
  readonly type?: EvidenceType | null;
  readonly title: string;
  readonly description: string;
  readonly capturedAt: string;
  readonly capturedById: EvidenceCapturedById;
  readonly capturedByName: EvidenceCapturedByName;
  readonly location: string;
  readonly links?: ReadonlyArray<EvidenceLink> | null;
  readonly correlationId: EvidenceCorrelationId;
  readonly createdBy: EvidenceCreatedBy;
  readonly sourceSystem: EvidenceSourceSystem;
  readonly metadata?: EvidenceCenterMetadata;
}

export type EvidenceCenterErrorCode =
  | "missing_id"
  | "missing_organization_id"
  | "missing_contract_id"
  | "missing_project_id"
  | "missing_type"
  | "missing_title"
  | "missing_captured_at"
  | "missing_captured_by"
  | "missing_links"
  | "missing_link_id"
  | "missing_link_label"
  | "missing_link_uri"
  | "invalid_evidence_transition";

export interface EvidenceCenterError {
  readonly code: EvidenceCenterErrorCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: EvidenceCenterMetadata;
}

export type EvidenceCenterWarningCode = "none";

export interface EvidenceCenterWarning {
  readonly code: EvidenceCenterWarningCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: EvidenceCenterMetadata;
}

export interface EvidenceCenterSuccess {
  readonly success: true;
  readonly evidence: EvidenceRecord;
  readonly errors: ReadonlyArray<EvidenceCenterError>;
  readonly warnings: ReadonlyArray<EvidenceCenterWarning>;
  readonly metadata: EvidenceCenterMetadata;
}

export interface EvidenceCenterFailure {
  readonly success: false;
  readonly evidence: null;
  readonly errors: ReadonlyArray<EvidenceCenterError>;
  readonly warnings: ReadonlyArray<EvidenceCenterWarning>;
  readonly metadata: EvidenceCenterMetadata;
}

export type EvidenceCenterResult = EvidenceCenterSuccess | EvidenceCenterFailure;

export interface AdvanceEvidenceStatusInput {
  readonly evidence: EvidenceRecord;
  readonly toStatus: EvidenceStatus;
  readonly metadata?: EvidenceCenterMetadata;
}
