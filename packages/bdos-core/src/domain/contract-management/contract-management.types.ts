export type ContractManagementMetadata = Readonly<Record<string, unknown>>;

export type ContractId = string;

export type ContractNumber = string;

export type ContractName = string;

export type ContractCurrency = string;

export type ContractProjectId = string;

export type ContractOrganizationId = string;

export type ContractProcessNumber = string;

export type ContractSeiReference = string;

export type ContractWorkOrderNumber = string;

export type ContractDate = string;

export type ContractCorrelationId = string;

export type ContractCreatedBy = string;

export type ContractSourceSystem = string;

export enum ContractStatus {
  Draft = "Draft",
  Active = "Active",
  Suspended = "Suspended",
  Finished = "Finished",
  Cancelled = "Cancelled",
}

export interface ContractParty {
  readonly name: string;
  readonly metadata: ContractManagementMetadata;
}

export interface ContractValue {
  readonly amount: number;
  readonly currency: ContractCurrency;
}

export interface ContractPeriod {
  readonly startDate: ContractDate;
  readonly expectedEndDate: ContractDate;
}

export interface Contract {
  readonly id: ContractId;
  readonly contractNumber: ContractNumber;
  readonly contractName: ContractName;
  readonly clientName: string;
  readonly contractorName: string;
  readonly contractValue: ContractValue;
  readonly currency: ContractCurrency;
  readonly projectId: ContractProjectId;
  readonly organizationId: ContractOrganizationId;
  readonly processNumber: ContractProcessNumber;
  readonly seiReference: ContractSeiReference;
  readonly workOrderNumber: ContractWorkOrderNumber;
  readonly startDate: ContractDate;
  readonly expectedEndDate: ContractDate;
  readonly status: ContractStatus;
  readonly metadata: ContractManagementMetadata;
}

export interface CreateContractInput {
  readonly id: ContractId;
  readonly contractNumber: ContractNumber;
  readonly contractName: ContractName;
  readonly client: ContractParty;
  readonly contractor: ContractParty;
  readonly contractValue: ContractValue;
  readonly projectId: ContractProjectId;
  readonly organizationId: ContractOrganizationId;
  readonly processNumber: ContractProcessNumber;
  readonly seiReference: ContractSeiReference;
  readonly workOrderNumber: ContractWorkOrderNumber;
  readonly period: ContractPeriod;
  readonly status?: ContractStatus;
  readonly correlationId: ContractCorrelationId;
  readonly createdBy: ContractCreatedBy;
  readonly sourceSystem: ContractSourceSystem;
  readonly metadata?: ContractManagementMetadata;
}

export type ContractManagementErrorCode =
  | "missing_contract_number"
  | "missing_contract_name"
  | "missing_client"
  | "missing_contractor"
  | "invalid_contract_value"
  | "missing_start_date"
  | "missing_expected_end_date"
  | "invalid_contract_period"
  | "missing_project_id"
  | "missing_organization_id"
  | "invalid_contract_transition";

export interface ContractManagementError {
  readonly code: ContractManagementErrorCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: ContractManagementMetadata;
}

export type ContractManagementWarningCode = "none";

export interface ContractManagementWarning {
  readonly code: ContractManagementWarningCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: ContractManagementMetadata;
}

export interface ContractManagementSuccess {
  readonly success: true;
  readonly contract: Contract;
  readonly errors: ReadonlyArray<ContractManagementError>;
  readonly warnings: ReadonlyArray<ContractManagementWarning>;
  readonly metadata: ContractManagementMetadata;
}

export interface ContractManagementFailure {
  readonly success: false;
  readonly contract: null;
  readonly errors: ReadonlyArray<ContractManagementError>;
  readonly warnings: ReadonlyArray<ContractManagementWarning>;
  readonly metadata: ContractManagementMetadata;
}

export type ContractManagementResult =
  | ContractManagementSuccess
  | ContractManagementFailure;

export interface AdvanceContractStatusInput {
  readonly contract: Contract;
  readonly toStatus: ContractStatus;
  readonly metadata?: ContractManagementMetadata;
}
