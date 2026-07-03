import type {
  AdvanceServiceItemStatusInput,
  CreateManagedServiceItemInput,
  ManagedServiceItem,
  ServiceItemManagementError,
  ServiceItemManagementFailure,
  ServiceItemManagementMetadata,
  ServiceItemManagementResult,
  ServiceItemManagementSuccess,
} from "./service-item-management.types";
import {
  ServiceItemStatus,
  type ServiceItemMeasurementType,
} from "./service-item-management.types";

export function createManagedServiceItem(
  input: CreateManagedServiceItemInput,
): ServiceItemManagementResult {
  const metadata = createServiceItemMetadata(input);
  const errors = validateServiceItem(input, metadata);

  if (errors.length > 0) {
    return freezeDomainObject<ServiceItemManagementFailure>({
      success: false,
      serviceItem: null,
      errors,
      warnings: [],
      metadata,
    });
  }

  return freezeDomainObject<ServiceItemManagementSuccess>({
    success: true,
    serviceItem: createServiceItemEntity(input, metadata),
    errors: [],
    warnings: [],
    metadata,
  });
}

export function advanceServiceItemStatus(
  input: AdvanceServiceItemStatusInput,
): ServiceItemManagementResult {
  const metadata = createTransitionMetadata(input);

  if (!canAdvanceServiceItemStatus(input.serviceItem.status, input.toStatus)) {
    return freezeDomainObject<ServiceItemManagementFailure>({
      success: false,
      serviceItem: null,
      errors: [
        {
          code: "invalid_service_item_transition",
          field: "status",
          message: `Cannot transition service item from ${input.serviceItem.status} to ${input.toStatus}.`,
          metadata,
        },
      ],
      warnings: [],
      metadata,
    });
  }

  return freezeDomainObject<ServiceItemManagementSuccess>({
    success: true,
    serviceItem: {
      ...input.serviceItem,
      status: input.toStatus,
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

function createServiceItemEntity(
  input: CreateManagedServiceItemInput,
  metadata: ServiceItemManagementMetadata,
): ManagedServiceItem {
  return {
    id: input.id,
    organizationId: input.organizationId,
    clientId: input.clientId ?? null,
    contractId: input.contractId,
    projectId: input.projectId,
    workPackageId: input.workPackageId,
    code: input.code,
    description: input.description,
    unit: input.unit,
    contractQuantity: input.contractQuantity,
    unitPrice: input.unitPrice,
    contractValue: calculateContractValue(input.contractQuantity, input.unitPrice),
    accumulatedQuantity: input.accumulatedQuantity,
    remainingQuantity: calculateRemainingQuantity(
      input.contractQuantity,
      input.accumulatedQuantity,
    ),
    measurementType: input.measurementType as ServiceItemMeasurementType,
    status: ServiceItemStatus.Draft,
    metadata,
  };
}

function validateServiceItem(
  input: CreateManagedServiceItemInput,
  metadata: ServiceItemManagementMetadata,
): ReadonlyArray<ServiceItemManagementError> {
  const errors: ServiceItemManagementError[] = [];

  if (isBlank(input.organizationId)) {
    errors.push(
      createServiceItemError(
        "missing_organization_id",
        "organizationId",
        "Organization id is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.contractId)) {
    errors.push(
      createServiceItemError(
        "missing_contract_id",
        "contractId",
        "Contract id is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.projectId)) {
    errors.push(
      createServiceItemError(
        "missing_project_id",
        "projectId",
        "Project id is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.workPackageId)) {
    errors.push(
      createServiceItemError(
        "missing_work_package_id",
        "workPackageId",
        "Work package id is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.code)) {
    errors.push(
      createServiceItemError(
        "missing_code",
        "code",
        "Service item code is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.description)) {
    errors.push(
      createServiceItemError(
        "missing_description",
        "description",
        "Service item description is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.unit)) {
    errors.push(
      createServiceItemError(
        "missing_unit",
        "unit",
        "Service item unit is required.",
        metadata,
      ),
    );
  }

  if (input.contractQuantity < 0) {
    errors.push(
      createServiceItemError(
        "invalid_contract_quantity",
        "contractQuantity",
        "Contract quantity must be greater than or equal to zero.",
        metadata,
      ),
    );
  }

  if (input.unitPrice < 0) {
    errors.push(
      createServiceItemError(
        "invalid_unit_price",
        "unitPrice",
        "Unit price must be greater than or equal to zero.",
        metadata,
      ),
    );
  }

  if (input.accumulatedQuantity < 0) {
    errors.push(
      createServiceItemError(
        "invalid_accumulated_quantity",
        "accumulatedQuantity",
        "Accumulated quantity must be greater than or equal to zero.",
        metadata,
      ),
    );
  }

  if (input.measurementType === undefined || input.measurementType === null) {
    errors.push(
      createServiceItemError(
        "missing_measurement_type",
        "measurementType",
        "Service item measurement type is required.",
        metadata,
      ),
    );
  }

  return errors;
}

function calculateContractValue(contractQuantity: number, unitPrice: number): number {
  return contractQuantity * unitPrice;
}

function calculateRemainingQuantity(
  contractQuantity: number,
  accumulatedQuantity: number,
): number {
  return contractQuantity - accumulatedQuantity;
}

function canAdvanceServiceItemStatus(
  fromStatus: ServiceItemStatus,
  toStatus: ServiceItemStatus,
): boolean {
  return allowedTransitions[fromStatus].includes(toStatus);
}

function createServiceItemError(
  code: ServiceItemManagementError["code"],
  field: string,
  message: string,
  metadata: ServiceItemManagementMetadata,
): ServiceItemManagementError {
  return {
    code,
    field,
    message,
    metadata,
  };
}

function createServiceItemMetadata(
  input: CreateManagedServiceItemInput,
): ServiceItemManagementMetadata {
  return {
    ...(input.metadata ?? {}),
    serviceItemId: input.id,
    organizationId: input.organizationId,
    clientId: input.clientId ?? null,
    contractId: input.contractId,
    projectId: input.projectId,
    workPackageId: input.workPackageId,
    code: input.code,
    correlationId: input.correlationId,
    createdBy: input.createdBy,
    sourceSystem: input.sourceSystem,
  };
}

function createTransitionMetadata(
  input: AdvanceServiceItemStatusInput,
): ServiceItemManagementMetadata {
  return {
    ...input.serviceItem.metadata,
    ...(input.metadata ?? {}),
    serviceItemId: input.serviceItem.id,
    organizationId: input.serviceItem.organizationId,
    clientId: input.serviceItem.clientId,
    contractId: input.serviceItem.contractId,
    projectId: input.serviceItem.projectId,
    workPackageId: input.serviceItem.workPackageId,
    code: input.serviceItem.code,
    fromStatus: input.serviceItem.status,
    toStatus: input.toStatus,
  };
}

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

const allowedTransitions: Readonly<
  Record<ServiceItemStatus, ReadonlyArray<ServiceItemStatus>>
> = {
  [ServiceItemStatus.Draft]: [
    ServiceItemStatus.Active,
    ServiceItemStatus.Cancelled,
  ],
  [ServiceItemStatus.Active]: [
    ServiceItemStatus.Suspended,
    ServiceItemStatus.Completed,
    ServiceItemStatus.Cancelled,
  ],
  [ServiceItemStatus.Suspended]: [ServiceItemStatus.Active],
  [ServiceItemStatus.Completed]: [],
  [ServiceItemStatus.Cancelled]: [],
};

type FreezableRecord = Record<PropertyKey, unknown>;

function freezeDomainObject<T>(value: T): T {
  return freezeClonedDomainObject(cloneDomainValue(value));
}

function cloneDomainValue<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneDomainValue(item)) as T;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, property]) => [
      key,
      cloneDomainValue(property),
    ]),
  ) as T;
}

function freezeClonedDomainObject<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  Object.values(value as FreezableRecord).forEach((property) => {
    freezeClonedDomainObject(property);
  });

  return Object.freeze(value);
}
