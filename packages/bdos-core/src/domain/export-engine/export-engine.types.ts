export type ExportPackageMetadata = Readonly<Record<string, unknown>>;

export type ExportPackageId = string;

export type ExportPackageOrganizationId = string;

export type ExportPackageCorrelationId = string;

export type ExportPackageCreatedBy = string;

export type ExportPackageSourceSystem = string;

export type ExportPackageActor = string;

export type ExportPackageOccurredAt = string;

export type ExportDocumentRequestId = string;

export enum ExportPackageStatus {
  Draft = "Draft",
  Validated = "Validated",
  Prepared = "Prepared",
  Cancelled = "Cancelled",
}

export enum ExportPackageReferenceType {
  MeasurementBulletin = "measurement_bulletin",
  MeasurementWorkspace = "measurement_workspace",
  Project = "project",
  Contract = "contract",
}

export interface ExportPackageReference {
  readonly type: ExportPackageReferenceType;
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly status: string;
  readonly metadata: ExportPackageMetadata;
}

export enum ExportDocumentType {
  OfficialMeasurementSpreadsheet = "official_measurement_spreadsheet",
  OfficialMeasurementPdf = "official_measurement_pdf",
  MeasurementBulletin = "measurement_bulletin",
  Scurve = "scurve",
  EvidencePack = "evidence_pack",
  CustomDocument = "custom_document",
}

export enum ExportDocumentFormat {
  Excel = "excel",
  Pdf = "pdf",
  Csv = "csv",
  Json = "json",
}

export interface ExportDocumentRequest {
  readonly id: ExportDocumentRequestId;
  readonly type: ExportDocumentType;
  readonly format: ExportDocumentFormat;
  readonly label: string;
  readonly metadata: ExportPackageMetadata;
}

export interface ExportDocumentRequestInput {
  readonly id: ExportDocumentRequestId;
  readonly type: ExportDocumentType;
  readonly format: ExportDocumentFormat;
  readonly label: string;
  readonly metadata?: ExportPackageMetadata;
}

export interface ExportDocumentDescriptor {
  readonly requestId: ExportDocumentRequestId;
  readonly type: ExportDocumentType;
  readonly format: ExportDocumentFormat;
  readonly label: string;
  readonly fileNameSuggestion: string;
  readonly contentSummary: string;
  readonly metadata: ExportPackageMetadata;
}

export interface ExportPackageTrace {
  readonly action: string;
  readonly actor: ExportPackageActor;
  readonly occurredAt: ExportPackageOccurredAt;
  readonly description: string;
  readonly metadata: ExportPackageMetadata;
}

export enum ExportPackageValidationSeverity {
  Blocking = "blocking",
  Warning = "warning",
}

export interface ExportPackageValidationIssue {
  readonly code: string;
  readonly severity: ExportPackageValidationSeverity;
  readonly field: string;
  readonly message: string;
  readonly metadata: ExportPackageMetadata;
}

export interface ExportPackageSummary {
  readonly totalDocumentsRequested: number;
  readonly totalDocumentsPrepared: number;
  readonly formatsRequested: ReadonlyArray<ExportDocumentFormat>;
  readonly typesRequested: ReadonlyArray<ExportDocumentType>;
}

export interface ExportPackage {
  readonly id: ExportPackageId;
  readonly organizationId: ExportPackageOrganizationId;
  readonly reference: ExportPackageReference;
  readonly documents: ReadonlyArray<ExportDocumentRequest>;
  readonly descriptors: ReadonlyArray<ExportDocumentDescriptor>;
  readonly status: ExportPackageStatus;
  readonly validationIssues: ReadonlyArray<ExportPackageValidationIssue>;
  readonly summary: ExportPackageSummary;
  readonly trace: ReadonlyArray<ExportPackageTrace>;
  readonly metadata: ExportPackageMetadata;
}

export interface CreateExportPackageInput {
  readonly id: ExportPackageId;
  readonly organizationId: ExportPackageOrganizationId;
  readonly reference: ExportPackageReference;
  readonly documents: ReadonlyArray<ExportDocumentRequestInput>;
  readonly actor: ExportPackageActor;
  readonly occurredAt: ExportPackageOccurredAt;
  readonly correlationId: ExportPackageCorrelationId;
  readonly createdBy: ExportPackageCreatedBy;
  readonly sourceSystem: ExportPackageSourceSystem;
  readonly metadata?: ExportPackageMetadata;
}

export interface ValidateExportPackageInput {
  readonly exportPackage: ExportPackage;
  readonly actor: ExportPackageActor;
  readonly occurredAt: ExportPackageOccurredAt;
  readonly metadata?: ExportPackageMetadata;
}

export interface PrepareExportPackageInput {
  readonly exportPackage: ExportPackage;
  readonly actor: ExportPackageActor;
  readonly occurredAt: ExportPackageOccurredAt;
  readonly metadata?: ExportPackageMetadata;
}

export type ExportPackageErrorCode =
  | "missing_id"
  | "missing_organization_id"
  | "missing_reference"
  | "missing_reference_id"
  | "missing_document_id"
  | "missing_document_type"
  | "missing_document_format"
  | "duplicate_document_id"
  | "export_package_terminal"
  | "export_package_not_validated"
  | "blocking_validation_issues";

export interface ExportPackageError {
  readonly code: ExportPackageErrorCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: ExportPackageMetadata;
}

export type ExportPackageWarningCode = "none";

export interface ExportPackageWarning {
  readonly code: ExportPackageWarningCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: ExportPackageMetadata;
}

export interface ExportPackageSuccess {
  readonly success: true;
  readonly exportPackage: ExportPackage;
  readonly errors: ReadonlyArray<ExportPackageError>;
  readonly warnings: ReadonlyArray<ExportPackageWarning>;
  readonly metadata: ExportPackageMetadata;
}

export interface ExportPackageFailure {
  readonly success: false;
  readonly exportPackage: null;
  readonly errors: ReadonlyArray<ExportPackageError>;
  readonly warnings: ReadonlyArray<ExportPackageWarning>;
  readonly metadata: ExportPackageMetadata;
}

export type ExportPackageResult = ExportPackageSuccess | ExportPackageFailure;
