export type EngineerWorkspaceMetadata = Readonly<Record<string, unknown>>;

export type EngineerWorkspaceId = string;

export type EngineerWorkspaceEngineerId = string;

export type EngineerWorkspaceEngineerName = string;

export type EngineerWorkspaceOrganizationId = string;

export type EngineerWorkspaceCorrelationId = string;

export type EngineerWorkspaceCreatedBy = string;

export type EngineerWorkspaceSourceSystem = string;

export interface EngineerWorkspaceProject {
  readonly projectId: string;
  readonly projectCode: string;
  readonly projectName: string;
  readonly contractId: string;
  readonly clientName: string;
  readonly status: string;
  readonly location: string;
  readonly metadata: EngineerWorkspaceMetadata;
}

export interface EngineerWorkspacePeriod {
  readonly measurementPeriodId: string;
  readonly periodNumber: number;
  readonly startDate: string;
  readonly endDate: string;
  readonly status: string;
  readonly metadata: EngineerWorkspaceMetadata;
}

export interface EngineerWorkspaceServiceItem {
  readonly serviceItemId: string;
  readonly code: string;
  readonly description: string;
  readonly unit: string;
  readonly contractQuantity: number;
  readonly accumulatedQuantity: number;
  readonly remainingQuantity: number;
  readonly measurementType: string;
  readonly status: string;
  readonly metadata: EngineerWorkspaceMetadata;
}

export interface EngineerWorkspaceWorkPackage {
  readonly workPackageId: string;
  readonly code: string;
  readonly name: string;
  readonly type: string;
  readonly sequence: number;
  readonly serviceItems: ReadonlyArray<EngineerWorkspaceServiceItem>;
  readonly metadata: EngineerWorkspaceMetadata;
}

export interface EngineerWorkspaceSummary {
  readonly totalWorkPackages: number;
  readonly totalServiceItems: number;
  readonly activeServiceItems: number;
  readonly completedServiceItems: number;
  readonly itemsWithRemainingQuantity: number;
  readonly itemsWithoutRemainingQuantity: number;
}

export interface EngineerWorkspace {
  readonly id: EngineerWorkspaceId;
  readonly engineerId: EngineerWorkspaceEngineerId;
  readonly engineerName: EngineerWorkspaceEngineerName;
  readonly organizationId: EngineerWorkspaceOrganizationId;
  readonly project: EngineerWorkspaceProject;
  readonly period: EngineerWorkspacePeriod;
  readonly workPackages: ReadonlyArray<EngineerWorkspaceWorkPackage>;
  readonly summary: EngineerWorkspaceSummary;
  readonly metadata: EngineerWorkspaceMetadata;
}

export interface CreateEngineerWorkspaceInput {
  readonly id: EngineerWorkspaceId;
  readonly engineerId: EngineerWorkspaceEngineerId;
  readonly engineerName: EngineerWorkspaceEngineerName;
  readonly organizationId: EngineerWorkspaceOrganizationId;
  readonly project?: EngineerWorkspaceProject | null;
  readonly period?: EngineerWorkspacePeriod | null;
  readonly workPackages?: ReadonlyArray<EngineerWorkspaceWorkPackage> | null;
  readonly correlationId: EngineerWorkspaceCorrelationId;
  readonly createdBy: EngineerWorkspaceCreatedBy;
  readonly sourceSystem: EngineerWorkspaceSourceSystem;
  readonly metadata?: EngineerWorkspaceMetadata;
}

export type EngineerWorkspaceErrorCode =
  | "missing_id"
  | "missing_engineer_id"
  | "missing_engineer_name"
  | "missing_organization_id"
  | "missing_project"
  | "missing_period"
  | "missing_work_packages";

export interface EngineerWorkspaceError {
  readonly code: EngineerWorkspaceErrorCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: EngineerWorkspaceMetadata;
}

export type EngineerWorkspaceWarningCode = "none";

export interface EngineerWorkspaceWarning {
  readonly code: EngineerWorkspaceWarningCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: EngineerWorkspaceMetadata;
}

export interface EngineerWorkspaceSuccess {
  readonly success: true;
  readonly workspace: EngineerWorkspace;
  readonly errors: ReadonlyArray<EngineerWorkspaceError>;
  readonly warnings: ReadonlyArray<EngineerWorkspaceWarning>;
  readonly metadata: EngineerWorkspaceMetadata;
}

export interface EngineerWorkspaceFailure {
  readonly success: false;
  readonly workspace: null;
  readonly errors: ReadonlyArray<EngineerWorkspaceError>;
  readonly warnings: ReadonlyArray<EngineerWorkspaceWarning>;
  readonly metadata: EngineerWorkspaceMetadata;
}

export type EngineerWorkspaceResult =
  | EngineerWorkspaceSuccess
  | EngineerWorkspaceFailure;
