export type MeasurementBulletinMetadata = Readonly<Record<string, unknown>>;

export type MeasurementBulletinId = string;

export type MeasurementBulletinOrganizationId = string;

export type MeasurementBulletinCorrelationId = string;

export type MeasurementBulletinCreatedBy = string;

export type MeasurementBulletinSourceSystem = string;

export type MeasurementBulletinActor = string;

export type MeasurementBulletinOccurredAt = string;

export type MeasurementBulletinLineId = string;

export enum MeasurementBulletinStatus {
  Draft = "Draft",
  Validated = "Validated",
  Finalized = "Finalized",
  Cancelled = "Cancelled",
}

export enum MeasurementBulletinReferenceType {
  MeasurementWorkspace = "measurement_workspace",
  Project = "project",
  Contract = "contract",
  WorkPackage = "work_package",
}

export interface MeasurementBulletinReference {
  readonly type: MeasurementBulletinReferenceType;
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly metadata: MeasurementBulletinMetadata;
}

export interface MeasurementBulletinHeader {
  readonly contractId: string;
  readonly contractNumber: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly measurementPeriodId: string;
  readonly periodNumber: number;
  readonly startDate: string;
  readonly endDate: string;
  readonly technicalResponsibleId: string;
  readonly technicalResponsibleName: string;
  readonly metadata: MeasurementBulletinMetadata;
}

export interface MeasurementBulletinLine {
  readonly id: MeasurementBulletinLineId;
  readonly serviceItemId: string;
  readonly serviceItemCode: string;
  readonly description: string;
  readonly unit: string;
  readonly quantity: number;
  readonly unitValue: number;
  readonly totalValue: number;
  readonly metadata: MeasurementBulletinMetadata;
}

export interface MeasurementBulletinLineInput {
  readonly id: MeasurementBulletinLineId;
  readonly serviceItemId: string;
  readonly serviceItemCode: string;
  readonly description: string;
  readonly unit: string;
  readonly quantity: number;
  readonly unitValue: number;
  readonly metadata?: MeasurementBulletinMetadata;
}

export interface MeasurementBulletinTotals {
  readonly totalLines: number;
  readonly totalQuantity: number;
  readonly totalValue: number;
}

export interface MeasurementBulletinTrace {
  readonly action: string;
  readonly actor: MeasurementBulletinActor;
  readonly occurredAt: MeasurementBulletinOccurredAt;
  readonly description: string;
  readonly metadata: MeasurementBulletinMetadata;
}

export enum MeasurementBulletinValidationSeverity {
  Blocking = "blocking",
  Warning = "warning",
}

export interface MeasurementBulletinValidationIssue {
  readonly code: string;
  readonly severity: MeasurementBulletinValidationSeverity;
  readonly field: string;
  readonly message: string;
  readonly metadata: MeasurementBulletinMetadata;
}

export interface MeasurementBulletin {
  readonly id: MeasurementBulletinId;
  readonly organizationId: MeasurementBulletinOrganizationId;
  readonly reference: MeasurementBulletinReference;
  readonly header: MeasurementBulletinHeader;
  readonly lines: ReadonlyArray<MeasurementBulletinLine>;
  readonly totals: MeasurementBulletinTotals;
  readonly status: MeasurementBulletinStatus;
  readonly validationIssues: ReadonlyArray<MeasurementBulletinValidationIssue>;
  readonly trace: ReadonlyArray<MeasurementBulletinTrace>;
  readonly metadata: MeasurementBulletinMetadata;
}

export interface CreateMeasurementBulletinInput {
  readonly id: MeasurementBulletinId;
  readonly organizationId: MeasurementBulletinOrganizationId;
  readonly reference: MeasurementBulletinReference;
  readonly header: MeasurementBulletinHeader;
  readonly lines: ReadonlyArray<MeasurementBulletinLineInput>;
  readonly actor: MeasurementBulletinActor;
  readonly occurredAt: MeasurementBulletinOccurredAt;
  readonly correlationId: MeasurementBulletinCorrelationId;
  readonly createdBy: MeasurementBulletinCreatedBy;
  readonly sourceSystem: MeasurementBulletinSourceSystem;
  readonly metadata?: MeasurementBulletinMetadata;
}

export interface ValidateMeasurementBulletinInput {
  readonly bulletin: MeasurementBulletin;
  readonly actor: MeasurementBulletinActor;
  readonly occurredAt: MeasurementBulletinOccurredAt;
  readonly metadata?: MeasurementBulletinMetadata;
}

export interface FinalizeMeasurementBulletinInput {
  readonly bulletin: MeasurementBulletin;
  readonly actor: MeasurementBulletinActor;
  readonly occurredAt: MeasurementBulletinOccurredAt;
  readonly metadata?: MeasurementBulletinMetadata;
}

export type MeasurementBulletinErrorCode =
  | "missing_id"
  | "missing_organization_id"
  | "missing_reference"
  | "missing_reference_id"
  | "missing_header"
  | "missing_header_contract_id"
  | "missing_header_project_id"
  | "missing_header_period_id"
  | "missing_header_technical_responsible"
  | "missing_lines"
  | "missing_line_id"
  | "missing_line_service_item_id"
  | "duplicate_line_id"
  | "negative_quantity"
  | "negative_unit_value"
  | "bulletin_terminal"
  | "bulletin_not_validated"
  | "blocking_validation_issues";

export interface MeasurementBulletinError {
  readonly code: MeasurementBulletinErrorCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: MeasurementBulletinMetadata;
}

export type MeasurementBulletinWarningCode = "none";

export interface MeasurementBulletinWarning {
  readonly code: MeasurementBulletinWarningCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: MeasurementBulletinMetadata;
}

export interface MeasurementBulletinSuccess {
  readonly success: true;
  readonly bulletin: MeasurementBulletin;
  readonly errors: ReadonlyArray<MeasurementBulletinError>;
  readonly warnings: ReadonlyArray<MeasurementBulletinWarning>;
  readonly metadata: MeasurementBulletinMetadata;
}

export interface MeasurementBulletinFailure {
  readonly success: false;
  readonly bulletin: null;
  readonly errors: ReadonlyArray<MeasurementBulletinError>;
  readonly warnings: ReadonlyArray<MeasurementBulletinWarning>;
  readonly metadata: MeasurementBulletinMetadata;
}

export type MeasurementBulletinResult =
  | MeasurementBulletinSuccess
  | MeasurementBulletinFailure;
