export type MeasurementWorkspaceMetadata = Readonly<Record<string, unknown>>;

export type MeasurementWorkspaceId = string;

export type MeasurementWorkspaceOrganizationId = string;

export type MeasurementWorkspaceCorrelationId = string;

export type MeasurementWorkspaceCreatedBy = string;

export type MeasurementWorkspaceSourceSystem = string;

export type MeasurementWorkspaceActor = string;

export type MeasurementWorkspaceOccurredAt = string;

export type MeasurementWorkspaceLineId = string;

export type MeasurementWorkspaceServiceItemId = string;

export enum MeasurementWorkspaceStatus {
  Draft = "Draft",
  InProgress = "InProgress",
  ReadyForReview = "ReadyForReview",
  Closed = "Closed",
  Cancelled = "Cancelled",
}

export enum MeasurementWorkspaceReferenceType {
  Project = "project",
  Contract = "contract",
  WorkPackage = "work_package",
}

export interface MeasurementWorkspaceReference {
  readonly type: MeasurementWorkspaceReferenceType;
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly metadata: MeasurementWorkspaceMetadata;
}

export interface MeasurementWorkspacePeriod {
  readonly measurementPeriodId: string;
  readonly periodNumber: number;
  readonly startDate: string;
  readonly endDate: string;
  readonly metadata: MeasurementWorkspaceMetadata;
}

export interface MeasurementWorkspaceLine {
  readonly id: MeasurementWorkspaceLineId;
  readonly serviceItemId: MeasurementWorkspaceServiceItemId;
  readonly serviceItemCode: string;
  readonly description: string;
  readonly unit: string;
  readonly quantity: number;
  readonly unitValue: number;
  readonly totalValue: number;
  readonly notes: string;
  readonly metadata: MeasurementWorkspaceMetadata;
}

export interface MeasurementWorkspaceLineInput {
  readonly id: MeasurementWorkspaceLineId;
  readonly serviceItemId: MeasurementWorkspaceServiceItemId;
  readonly serviceItemCode: string;
  readonly description: string;
  readonly unit: string;
  readonly quantity: number;
  readonly unitValue: number;
  readonly notes?: string;
  readonly metadata?: MeasurementWorkspaceMetadata;
}

export interface MeasurementWorkspaceSummary {
  readonly totalLines: number;
  readonly totalQuantity: number;
  readonly totalValue: number;
}

export interface MeasurementWorkspaceTrace {
  readonly action: string;
  readonly actor: MeasurementWorkspaceActor;
  readonly occurredAt: MeasurementWorkspaceOccurredAt;
  readonly description: string;
  readonly metadata: MeasurementWorkspaceMetadata;
}

export interface MeasurementWorkspace {
  readonly id: MeasurementWorkspaceId;
  readonly organizationId: MeasurementWorkspaceOrganizationId;
  readonly reference: MeasurementWorkspaceReference;
  readonly period: MeasurementWorkspacePeriod;
  readonly status: MeasurementWorkspaceStatus;
  readonly lines: ReadonlyArray<MeasurementWorkspaceLine>;
  readonly summary: MeasurementWorkspaceSummary;
  readonly trace: ReadonlyArray<MeasurementWorkspaceTrace>;
  readonly metadata: MeasurementWorkspaceMetadata;
}

export interface CreateMeasurementWorkspaceInput {
  readonly id: MeasurementWorkspaceId;
  readonly organizationId: MeasurementWorkspaceOrganizationId;
  readonly reference: MeasurementWorkspaceReference;
  readonly period: MeasurementWorkspacePeriod;
  readonly lines?: ReadonlyArray<MeasurementWorkspaceLineInput> | null;
  readonly actor: MeasurementWorkspaceActor;
  readonly occurredAt: MeasurementWorkspaceOccurredAt;
  readonly correlationId: MeasurementWorkspaceCorrelationId;
  readonly createdBy: MeasurementWorkspaceCreatedBy;
  readonly sourceSystem: MeasurementWorkspaceSourceSystem;
  readonly metadata?: MeasurementWorkspaceMetadata;
}

export interface AddMeasurementWorkspaceLineInput {
  readonly workspace: MeasurementWorkspace;
  readonly line: MeasurementWorkspaceLineInput;
  readonly actor: MeasurementWorkspaceActor;
  readonly occurredAt: MeasurementWorkspaceOccurredAt;
  readonly metadata?: MeasurementWorkspaceMetadata;
}

export interface RemoveMeasurementWorkspaceLineInput {
  readonly workspace: MeasurementWorkspace;
  readonly lineId: MeasurementWorkspaceLineId;
  readonly actor: MeasurementWorkspaceActor;
  readonly occurredAt: MeasurementWorkspaceOccurredAt;
  readonly metadata?: MeasurementWorkspaceMetadata;
}

export interface UpdateMeasurementWorkspaceLineQuantityInput {
  readonly workspace: MeasurementWorkspace;
  readonly lineId: MeasurementWorkspaceLineId;
  readonly quantity: number;
  readonly actor: MeasurementWorkspaceActor;
  readonly occurredAt: MeasurementWorkspaceOccurredAt;
  readonly metadata?: MeasurementWorkspaceMetadata;
}

export interface AdvanceMeasurementWorkspaceStatusInput {
  readonly workspace: MeasurementWorkspace;
  readonly toStatus: MeasurementWorkspaceStatus;
  readonly actor: MeasurementWorkspaceActor;
  readonly occurredAt: MeasurementWorkspaceOccurredAt;
  readonly metadata?: MeasurementWorkspaceMetadata;
}

export type MeasurementWorkspaceErrorCode =
  | "missing_id"
  | "missing_organization_id"
  | "missing_reference"
  | "missing_reference_id"
  | "missing_period"
  | "missing_period_id"
  | "missing_line_id"
  | "missing_line_service_item_id"
  | "duplicate_line_id"
  | "negative_quantity"
  | "negative_unit_value"
  | "line_not_found"
  | "workspace_not_mutable"
  | "invalid_workspace_status_transition";

export interface MeasurementWorkspaceError {
  readonly code: MeasurementWorkspaceErrorCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: MeasurementWorkspaceMetadata;
}

export type MeasurementWorkspaceWarningCode = "none";

export interface MeasurementWorkspaceWarning {
  readonly code: MeasurementWorkspaceWarningCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: MeasurementWorkspaceMetadata;
}

export interface MeasurementWorkspaceSuccess {
  readonly success: true;
  readonly workspace: MeasurementWorkspace;
  readonly errors: ReadonlyArray<MeasurementWorkspaceError>;
  readonly warnings: ReadonlyArray<MeasurementWorkspaceWarning>;
  readonly metadata: MeasurementWorkspaceMetadata;
}

export interface MeasurementWorkspaceFailure {
  readonly success: false;
  readonly workspace: null;
  readonly errors: ReadonlyArray<MeasurementWorkspaceError>;
  readonly warnings: ReadonlyArray<MeasurementWorkspaceWarning>;
  readonly metadata: MeasurementWorkspaceMetadata;
}

export type MeasurementWorkspaceResult =
  | MeasurementWorkspaceSuccess
  | MeasurementWorkspaceFailure;
