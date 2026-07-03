export type ProjectManagementMetadata = Readonly<Record<string, unknown>>;

export type ProjectId = string;

export type ProjectCode = string;

export type ProjectName = string;

export type ProjectOrganizationId = string;

export type ProjectContractId = string;

export type ProjectDate = string;

export type ProjectManagerId = string;

export type ProjectManagerName = string;

export type ProjectCorrelationId = string;

export type ProjectCreatedBy = string;

export type ProjectSourceSystem = string;

export enum ProjectStatus {
  Draft = "Draft",
  Planning = "Planning",
  Executing = "Executing",
  Suspended = "Suspended",
  Completed = "Completed",
  Cancelled = "Cancelled",
}

export interface ProjectLocation {
  readonly location: string;
  readonly city: string;
  readonly state: string;
  readonly country: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly metadata: ProjectManagementMetadata;
}

export interface ProjectOwner {
  readonly clientName: string;
  readonly metadata: ProjectManagementMetadata;
}

export interface ProjectPeriod {
  readonly startDate: ProjectDate;
  readonly expectedEndDate: ProjectDate;
}

export interface Project {
  readonly id: ProjectId;
  readonly projectCode: ProjectCode;
  readonly projectName: ProjectName;
  readonly organizationId: ProjectOrganizationId;
  readonly contractId: ProjectContractId;
  readonly clientName: string;
  readonly location: string;
  readonly city: string;
  readonly state: string;
  readonly country: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly projectManagerId: ProjectManagerId;
  readonly projectManagerName: ProjectManagerName;
  readonly inspectionAgency: string;
  readonly supervisingEngineer: string;
  readonly startDate: ProjectDate;
  readonly expectedEndDate: ProjectDate;
  readonly status: ProjectStatus;
  readonly metadata: ProjectManagementMetadata;
}

export interface CreateProjectInput {
  readonly id: ProjectId;
  readonly projectCode: ProjectCode;
  readonly projectName: ProjectName;
  readonly organizationId: ProjectOrganizationId;
  readonly contractId: ProjectContractId;
  readonly owner: ProjectOwner;
  readonly location: ProjectLocation;
  readonly projectManagerId: ProjectManagerId;
  readonly projectManagerName: ProjectManagerName;
  readonly inspectionAgency: string;
  readonly supervisingEngineer: string;
  readonly period: ProjectPeriod;
  readonly status?: ProjectStatus;
  readonly correlationId: ProjectCorrelationId;
  readonly createdBy: ProjectCreatedBy;
  readonly sourceSystem: ProjectSourceSystem;
  readonly metadata?: ProjectManagementMetadata;
}

export type ProjectManagementErrorCode =
  | "missing_project_code"
  | "missing_project_name"
  | "missing_organization_id"
  | "missing_contract_id"
  | "missing_client"
  | "missing_city"
  | "missing_state"
  | "missing_country"
  | "missing_start_date"
  | "missing_expected_end_date"
  | "invalid_project_period"
  | "missing_project_manager"
  | "invalid_project_transition";

export interface ProjectManagementError {
  readonly code: ProjectManagementErrorCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: ProjectManagementMetadata;
}

export type ProjectManagementWarningCode = "none";

export interface ProjectManagementWarning {
  readonly code: ProjectManagementWarningCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: ProjectManagementMetadata;
}

export interface ProjectManagementSuccess {
  readonly success: true;
  readonly project: Project;
  readonly errors: ReadonlyArray<ProjectManagementError>;
  readonly warnings: ReadonlyArray<ProjectManagementWarning>;
  readonly metadata: ProjectManagementMetadata;
}

export interface ProjectManagementFailure {
  readonly success: false;
  readonly project: null;
  readonly errors: ReadonlyArray<ProjectManagementError>;
  readonly warnings: ReadonlyArray<ProjectManagementWarning>;
  readonly metadata: ProjectManagementMetadata;
}

export type ProjectManagementResult =
  | ProjectManagementSuccess
  | ProjectManagementFailure;

export interface AdvanceProjectStatusInput {
  readonly project: Project;
  readonly toStatus: ProjectStatus;
  readonly metadata?: ProjectManagementMetadata;
}
