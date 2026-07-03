import type {
  AdvanceWorkPackageStatusInput,
  CreateWorkPackageInput,
  WorkPackage,
  WorkPackageManagementError,
  WorkPackageManagementFailure,
  WorkPackageManagementMetadata,
  WorkPackageManagementResult,
  WorkPackageManagementSuccess,
} from "./work-package-management.types";
import {
  WorkPackageStatus,
  type WorkPackageType,
} from "./work-package-management.types";

export function createWorkPackage(
  input: CreateWorkPackageInput,
): WorkPackageManagementResult {
  const metadata = createWorkPackageMetadata(input);
  const errors = validateWorkPackage(input, metadata);

  if (errors.length > 0) {
    return freezeDomainObject<WorkPackageManagementFailure>({
      success: false,
      workPackage: null,
      errors,
      warnings: [],
      metadata,
    });
  }

  return freezeDomainObject<WorkPackageManagementSuccess>({
    success: true,
    workPackage: createWorkPackageEntity(input, metadata),
    errors: [],
    warnings: [],
    metadata,
  });
}

export function advanceWorkPackageStatus(
  input: AdvanceWorkPackageStatusInput,
): WorkPackageManagementResult {
  const metadata = createTransitionMetadata(input);

  if (!canAdvanceWorkPackageStatus(input.workPackage.status, input.toStatus)) {
    return freezeDomainObject<WorkPackageManagementFailure>({
      success: false,
      workPackage: null,
      errors: [
        {
          code: "invalid_work_package_transition",
          field: "status",
          message: `Cannot transition work package from ${input.workPackage.status} to ${input.toStatus}.`,
          metadata,
        },
      ],
      warnings: [],
      metadata,
    });
  }

  return freezeDomainObject<WorkPackageManagementSuccess>({
    success: true,
    workPackage: {
      ...input.workPackage,
      status: input.toStatus,
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

function createWorkPackageEntity(
  input: CreateWorkPackageInput,
  metadata: WorkPackageManagementMetadata,
): WorkPackage {
  return {
    id: input.id,
    organizationId: input.organizationId,
    clientId: input.clientId ?? null,
    contractId: input.contractId,
    projectId: input.projectId,
    code: input.code,
    name: input.name,
    description: input.description,
    type: input.type as WorkPackageType,
    parentWorkPackageId: input.parentWorkPackageId ?? null,
    sequence: input.sequence,
    status: WorkPackageStatus.Draft,
    metadata,
  };
}

function validateWorkPackage(
  input: CreateWorkPackageInput,
  metadata: WorkPackageManagementMetadata,
): ReadonlyArray<WorkPackageManagementError> {
  const errors: WorkPackageManagementError[] = [];

  if (isBlank(input.organizationId)) {
    errors.push(
      createWorkPackageError(
        "missing_organization_id",
        "organizationId",
        "Organization id is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.contractId)) {
    errors.push(
      createWorkPackageError(
        "missing_contract_id",
        "contractId",
        "Contract id is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.projectId)) {
    errors.push(
      createWorkPackageError(
        "missing_project_id",
        "projectId",
        "Project id is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.code)) {
    errors.push(
      createWorkPackageError(
        "missing_code",
        "code",
        "Work package code is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.name)) {
    errors.push(
      createWorkPackageError(
        "missing_name",
        "name",
        "Work package name is required.",
        metadata,
      ),
    );
  }

  if (input.type === undefined || input.type === null) {
    errors.push(
      createWorkPackageError(
        "missing_type",
        "type",
        "Work package type is required.",
        metadata,
      ),
    );
  }

  if (input.sequence < 0) {
    errors.push(
      createWorkPackageError(
        "invalid_sequence",
        "sequence",
        "Work package sequence must be greater than or equal to zero.",
        metadata,
      ),
    );
  }

  return errors;
}

function canAdvanceWorkPackageStatus(
  fromStatus: WorkPackageStatus,
  toStatus: WorkPackageStatus,
): boolean {
  return allowedTransitions[fromStatus].includes(toStatus);
}

function createWorkPackageError(
  code: WorkPackageManagementError["code"],
  field: string,
  message: string,
  metadata: WorkPackageManagementMetadata,
): WorkPackageManagementError {
  return {
    code,
    field,
    message,
    metadata,
  };
}

function createWorkPackageMetadata(
  input: CreateWorkPackageInput,
): WorkPackageManagementMetadata {
  return {
    ...(input.metadata ?? {}),
    workPackageId: input.id,
    organizationId: input.organizationId,
    clientId: input.clientId ?? null,
    contractId: input.contractId,
    projectId: input.projectId,
    code: input.code,
    parentWorkPackageId: input.parentWorkPackageId ?? null,
    correlationId: input.correlationId,
    createdBy: input.createdBy,
    sourceSystem: input.sourceSystem,
  };
}

function createTransitionMetadata(
  input: AdvanceWorkPackageStatusInput,
): WorkPackageManagementMetadata {
  return {
    ...input.workPackage.metadata,
    ...(input.metadata ?? {}),
    workPackageId: input.workPackage.id,
    organizationId: input.workPackage.organizationId,
    clientId: input.workPackage.clientId,
    contractId: input.workPackage.contractId,
    projectId: input.workPackage.projectId,
    code: input.workPackage.code,
    fromStatus: input.workPackage.status,
    toStatus: input.toStatus,
  };
}

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

const allowedTransitions: Readonly<
  Record<WorkPackageStatus, ReadonlyArray<WorkPackageStatus>>
> = {
  [WorkPackageStatus.Draft]: [
    WorkPackageStatus.Active,
    WorkPackageStatus.Cancelled,
  ],
  [WorkPackageStatus.Active]: [
    WorkPackageStatus.Suspended,
    WorkPackageStatus.Completed,
    WorkPackageStatus.Cancelled,
  ],
  [WorkPackageStatus.Suspended]: [WorkPackageStatus.Active],
  [WorkPackageStatus.Completed]: [],
  [WorkPackageStatus.Cancelled]: [],
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
