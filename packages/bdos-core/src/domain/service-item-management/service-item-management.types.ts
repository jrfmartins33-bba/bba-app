export type ServiceItemManagementMetadata = Readonly<Record<string, unknown>>;

export type ManagedServiceItemId = string;

export type ManagedServiceItemOrganizationId = string;

export type ManagedServiceItemClientId = string;

export type ManagedServiceItemContractId = string;

export type ManagedServiceItemProjectId = string;

export type ManagedServiceItemWorkPackageId = string;

export type ManagedServiceItemCode = string;

export type ManagedServiceItemDescription = string;

export type ManagedServiceItemUnit = string;

export type ManagedServiceItemCorrelationId = string;

export type ManagedServiceItemCreatedBy = string;

export type ManagedServiceItemSourceSystem = string;

export enum ServiceItemMeasurementType {
  Quantity = "quantity",
  Percentage = "percentage",
  LumpSum = "lump_sum",
}

export enum ServiceItemStatus {
  Draft = "Draft",
  Active = "Active",
  Suspended = "Suspended",
  Completed = "Completed",
  Cancelled = "Cancelled",
}

export interface ManagedServiceItem {
  readonly id: ManagedServiceItemId;
  readonly organizationId: ManagedServiceItemOrganizationId;
  readonly clientId: ManagedServiceItemClientId | null;
  readonly contractId: ManagedServiceItemContractId;
  readonly projectId: ManagedServiceItemProjectId;
  readonly workPackageId: ManagedServiceItemWorkPackageId;
  readonly code: ManagedServiceItemCode;
  readonly description: ManagedServiceItemDescription;
  readonly unit: ManagedServiceItemUnit;
  readonly contractQuantity: number;
  readonly unitPrice: number;
  readonly contractValue: number;
  readonly accumulatedQuantity: number;
  readonly remainingQuantity: number;
  readonly measurementType: ServiceItemMeasurementType;
  readonly status: ServiceItemStatus;
  readonly metadata: ServiceItemManagementMetadata;
}

export interface CreateManagedServiceItemInput {
  readonly id: ManagedServiceItemId;
  readonly organizationId: ManagedServiceItemOrganizationId;
  readonly clientId?: ManagedServiceItemClientId | null;
  readonly contractId: ManagedServiceItemContractId;
  readonly projectId: ManagedServiceItemProjectId;
  readonly workPackageId: ManagedServiceItemWorkPackageId;
  readonly code: ManagedServiceItemCode;
  readonly description: ManagedServiceItemDescription;
  readonly unit: ManagedServiceItemUnit;
  readonly contractQuantity: number;
  readonly unitPrice: number;
  readonly accumulatedQuantity: number;
  readonly measurementType?: ServiceItemMeasurementType | null;
  readonly correlationId: ManagedServiceItemCorrelationId;
  readonly createdBy: ManagedServiceItemCreatedBy;
  readonly sourceSystem: ManagedServiceItemSourceSystem;
  readonly metadata?: ServiceItemManagementMetadata;
}

export type ServiceItemManagementErrorCode =
  | "missing_organization_id"
  | "missing_contract_id"
  | "missing_project_id"
  | "missing_work_package_id"
  | "missing_code"
  | "missing_description"
  | "missing_unit"
  | "invalid_contract_quantity"
  | "invalid_unit_price"
  | "invalid_accumulated_quantity"
  | "missing_measurement_type"
  | "invalid_service_item_transition";

export interface ServiceItemManagementError {
  readonly code: ServiceItemManagementErrorCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: ServiceItemManagementMetadata;
}

export type ServiceItemManagementWarningCode = "none";

export interface ServiceItemManagementWarning {
  readonly code: ServiceItemManagementWarningCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: ServiceItemManagementMetadata;
}

export interface ServiceItemManagementSuccess {
  readonly success: true;
  readonly serviceItem: ManagedServiceItem;
  readonly errors: ReadonlyArray<ServiceItemManagementError>;
  readonly warnings: ReadonlyArray<ServiceItemManagementWarning>;
  readonly metadata: ServiceItemManagementMetadata;
}

export interface ServiceItemManagementFailure {
  readonly success: false;
  readonly serviceItem: null;
  readonly errors: ReadonlyArray<ServiceItemManagementError>;
  readonly warnings: ReadonlyArray<ServiceItemManagementWarning>;
  readonly metadata: ServiceItemManagementMetadata;
}

export type ServiceItemManagementResult =
  | ServiceItemManagementSuccess
  | ServiceItemManagementFailure;

export interface AdvanceServiceItemStatusInput {
  readonly serviceItem: ManagedServiceItem;
  readonly toStatus: ServiceItemStatus;
  readonly metadata?: ServiceItemManagementMetadata;
}
