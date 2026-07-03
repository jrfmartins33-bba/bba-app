import type {
  AdvanceContractStatusInput,
  Contract,
  ContractManagementError,
  ContractManagementFailure,
  ContractManagementMetadata,
  ContractManagementResult,
  ContractManagementSuccess,
  CreateContractInput,
} from "./contract-management.types";
import { ContractStatus } from "./contract-management.types";

export function createContract(input: CreateContractInput): ContractManagementResult {
  const metadata = createContractMetadata(input);
  const errors = validateContract(input, metadata);

  if (errors.length > 0) {
    return freezeDomainObject<ContractManagementFailure>({
      success: false,
      contract: null,
      errors,
      warnings: [],
      metadata,
    });
  }

  return freezeDomainObject<ContractManagementSuccess>({
    success: true,
    contract: createContractEntity(input, metadata),
    errors: [],
    warnings: [],
    metadata,
  });
}

export function advanceContractStatus(
  input: AdvanceContractStatusInput,
): ContractManagementResult {
  const metadata = createTransitionMetadata(input);

  if (!canAdvanceContractStatus(input.contract.status, input.toStatus)) {
    return freezeDomainObject<ContractManagementFailure>({
      success: false,
      contract: null,
      errors: [
        {
          code: "invalid_contract_transition",
          field: "status",
          message: `Cannot transition contract from ${input.contract.status} to ${input.toStatus}.`,
          metadata,
        },
      ],
      warnings: [],
      metadata,
    });
  }

  return freezeDomainObject<ContractManagementSuccess>({
    success: true,
    contract: {
      ...input.contract,
      status: input.toStatus,
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

function createContractEntity(
  input: CreateContractInput,
  metadata: ContractManagementMetadata,
): Contract {
  return {
    id: input.id,
    contractNumber: input.contractNumber,
    contractName: input.contractName,
    clientName: input.client.name,
    contractorName: input.contractor.name,
    contractValue: {
      amount: input.contractValue.amount,
      currency: input.contractValue.currency,
    },
    currency: input.contractValue.currency,
    projectId: input.projectId,
    organizationId: input.organizationId,
    processNumber: input.processNumber,
    seiReference: input.seiReference,
    workOrderNumber: input.workOrderNumber,
    startDate: input.period.startDate,
    expectedEndDate: input.period.expectedEndDate,
    status: input.status ?? ContractStatus.Draft,
    metadata,
  };
}

function validateContract(
  input: CreateContractInput,
  metadata: ContractManagementMetadata,
): ReadonlyArray<ContractManagementError> {
  const errors: ContractManagementError[] = [];

  if (isBlank(input.contractNumber)) {
    errors.push(
      createContractError(
        "missing_contract_number",
        "contractNumber",
        "Contract number is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.contractName)) {
    errors.push(
      createContractError(
        "missing_contract_name",
        "contractName",
        "Contract name is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.client.name)) {
    errors.push(
      createContractError(
        "missing_client",
        "client.name",
        "Client is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.contractor.name)) {
    errors.push(
      createContractError(
        "missing_contractor",
        "contractor.name",
        "Contractor is required.",
        metadata,
      ),
    );
  }

  if (input.contractValue.amount <= 0) {
    errors.push(
      createContractError(
        "invalid_contract_value",
        "contractValue.amount",
        "Contract value must be greater than zero.",
        metadata,
      ),
    );
  }

  if (isBlank(input.period.startDate)) {
    errors.push(
      createContractError(
        "missing_start_date",
        "period.startDate",
        "Start date is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.period.expectedEndDate)) {
    errors.push(
      createContractError(
        "missing_expected_end_date",
        "period.expectedEndDate",
        "Expected end date is required.",
        metadata,
      ),
    );
  }

  if (
    !isBlank(input.period.startDate) &&
    !isBlank(input.period.expectedEndDate) &&
    input.period.expectedEndDate < input.period.startDate
  ) {
    errors.push(
      createContractError(
        "invalid_contract_period",
        "period.expectedEndDate",
        "Expected end date cannot be earlier than start date.",
        metadata,
      ),
    );
  }

  if (isBlank(input.projectId)) {
    errors.push(
      createContractError(
        "missing_project_id",
        "projectId",
        "Project id is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.organizationId)) {
    errors.push(
      createContractError(
        "missing_organization_id",
        "organizationId",
        "Organization id is required.",
        metadata,
      ),
    );
  }

  return errors;
}

function canAdvanceContractStatus(
  fromStatus: ContractStatus,
  toStatus: ContractStatus,
): boolean {
  return allowedTransitions[fromStatus].includes(toStatus);
}

function createContractError(
  code: ContractManagementError["code"],
  field: string,
  message: string,
  metadata: ContractManagementMetadata,
): ContractManagementError {
  return {
    code,
    field,
    message,
    metadata,
  };
}

function createContractMetadata(
  input: CreateContractInput,
): ContractManagementMetadata {
  return {
    ...(input.metadata ?? {}),
    contractId: input.id,
    contractNumber: input.contractNumber,
    projectId: input.projectId,
    organizationId: input.organizationId,
    processNumber: input.processNumber,
    seiReference: input.seiReference,
    workOrderNumber: input.workOrderNumber,
    correlationId: input.correlationId,
    createdBy: input.createdBy,
    sourceSystem: input.sourceSystem,
  };
}

function createTransitionMetadata(
  input: AdvanceContractStatusInput,
): ContractManagementMetadata {
  return {
    ...input.contract.metadata,
    ...(input.metadata ?? {}),
    contractId: input.contract.id,
    contractNumber: input.contract.contractNumber,
    projectId: input.contract.projectId,
    organizationId: input.contract.organizationId,
    fromStatus: input.contract.status,
    toStatus: input.toStatus,
  };
}

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

const allowedTransitions: Readonly<
  Record<ContractStatus, ReadonlyArray<ContractStatus>>
> = {
  [ContractStatus.Draft]: [ContractStatus.Active, ContractStatus.Cancelled],
  [ContractStatus.Active]: [
    ContractStatus.Suspended,
    ContractStatus.Finished,
    ContractStatus.Cancelled,
  ],
  [ContractStatus.Suspended]: [ContractStatus.Active],
  [ContractStatus.Finished]: [],
  [ContractStatus.Cancelled]: [],
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
