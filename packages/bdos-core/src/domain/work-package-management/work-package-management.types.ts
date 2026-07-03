export type WorkPackageManagementMetadata = Readonly<Record<string, unknown>>;

export type WorkPackageId = string;

export type WorkPackageOrganizationId = string;

export type WorkPackageClientId = string;

export type WorkPackageContractId = string;

export type WorkPackageProjectId = string;

export type WorkPackageCode = string;

export type WorkPackageName = string;

export type WorkPackageDescription = string;

export type WorkPackageCorrelationId = string;

export type WorkPackageCreatedBy = string;

export type WorkPackageSourceSystem = string;

export enum WorkPackageType {
  ScopeGroup = "scope_group",
  ExecutionFront = "execution_front",
  CostGroup = "cost_group",
  Administration = "administration",
  Mobilization = "mobilization",
  Demobilization = "demobilization",
  Other = "other",
}

export enum WorkPackageStatus {
  Draft = "Draft",
  Active = "Active",
  Suspended = "Suspended",
  Completed = "Completed",
  Cancelled = "Cancelled",
}

export interface WorkPackage {
  readonly id: WorkPackageId;
  readonly organizationId: WorkPackageOrganizationId;
  readonly clientId: WorkPackageClientId | null;
  readonly contractId: WorkPackageContractId;
  readonly projectId: WorkPackageProjectId;
  readonly code: WorkPackageCode;
  readonly name: WorkPackageName;
  readonly description: WorkPackageDescription;
  readonly type: WorkPackageType;
  readonly parentWorkPackageId: WorkPackageId | null;
  readonly sequence: number;
  readonly status: WorkPackageStatus;
  readonly metadata: WorkPackageManagementMetadata;
}

export interface CreateWorkPackageInput {
  readonly id: WorkPackageId;
  readonly organizationId: WorkPackageOrganizationId;
  readonly clientId?: WorkPackageClientId | null;
  readonly contractId: WorkPackageContractId;
  readonly projectId: WorkPackageProjectId;
  readonly code: WorkPackageCode;
  readonly name: WorkPackageName;
  readonly description: WorkPackageDescription;
  readonly type?: WorkPackageType | null;
  readonly parentWorkPackageId?: WorkPackageId | null;
  readonly sequence: number;
  readonly correlationId: WorkPackageCorrelationId;
  readonly createdBy: WorkPackageCreatedBy;
  readonly sourceSystem: WorkPackageSourceSystem;
  readonly metadata?: WorkPackageManagementMetadata;
}

export type WorkPackageManagementErrorCode =
  | "missing_organization_id"
  | "missing_contract_id"
  | "missing_project_id"
  | "missing_code"
  | "missing_name"
  | "missing_type"
  | "invalid_sequence"
  | "invalid_work_package_transition";

export interface WorkPackageManagementError {
  readonly code: WorkPackageManagementErrorCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: WorkPackageManagementMetadata;
}

export type WorkPackageManagementWarningCode = "none";

export interface WorkPackageManagementWarning {
  readonly code: WorkPackageManagementWarningCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: WorkPackageManagementMetadata;
}

export interface WorkPackageManagementSuccess {
  readonly success: true;
  readonly workPackage: WorkPackage;
  readonly errors: ReadonlyArray<WorkPackageManagementError>;
  readonly warnings: ReadonlyArray<WorkPackageManagementWarning>;
  readonly metadata: WorkPackageManagementMetadata;
}

export interface WorkPackageManagementFailure {
  readonly success: false;
  readonly workPackage: null;
  readonly errors: ReadonlyArray<WorkPackageManagementError>;
  readonly warnings: ReadonlyArray<WorkPackageManagementWarning>;
  readonly metadata: WorkPackageManagementMetadata;
}

export type WorkPackageManagementResult =
  | WorkPackageManagementSuccess
  | WorkPackageManagementFailure;

export interface AdvanceWorkPackageStatusInput {
  readonly workPackage: WorkPackage;
  readonly toStatus: WorkPackageStatus;
  readonly metadata?: WorkPackageManagementMetadata;
}
