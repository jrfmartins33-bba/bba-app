import type {
  AdvanceEngineeringContractStatusInput,
  CreateEngineeringContractInput,
  EngineeringContract,
  EngineeringContractError,
  EngineeringContractFailure,
  EngineeringContractId,
  EngineeringContractMetadata,
  EngineeringContractResult,
  EngineeringContractSuccess,
  EngineeringContractTimelineEvent,
  EngineeringContractTrace,
} from "./engineering-contract.types";
import { EngineeringContractStatus } from "./engineering-contract.types";

export function createEngineeringContract(
  input: CreateEngineeringContractInput,
  existingContractIds?: ReadonlyArray<EngineeringContractId> | null,
): EngineeringContractResult {
  const metadata = createContractMetadata(input);
  const errors = validateContractShell(input, existingContractIds, metadata);

  if (errors.length > 0) {
    return failureResult(errors, metadata);
  }

  const contract: EngineeringContract = {
    id: input.id,
    publicOwner: input.publicOwner,
    contractNumber: input.contractNumber,
    administrativeProcess: input.administrativeProcess,
    administrativeProcessSEI: input.administrativeProcessSEI ?? null,
    commitmentNumber: input.commitmentNumber ?? null,
    serviceOrder: input.serviceOrder ?? null,
    contractor: input.contractor ?? null,
    consortium: input.consortium ?? null,
    projectName: input.projectName ?? null,
    objectDescription: input.objectDescription,
    city: input.city,
    state: input.state,
    contractValue: input.contractValue ?? null,
    fundingSource: input.fundingSource ?? null,
    status: EngineeringContractStatus.Draft,
    timeline: [
      createTimelineEvent(
        "contract_created",
        input.occurredAt,
        `Contrato ${input.contractNumber} criado para ${input.publicOwner}.`,
        metadata,
      ),
    ],
    trace: [
      createTraceEntry(
        "contract_created",
        input.actor,
        input.occurredAt,
        `Engineering contract ${input.id} created.`,
        metadata,
      ),
    ],
    metadata,
  };

  return freezeDomainObject<EngineeringContractSuccess>({
    success: true,
    contract,
    errors: [],
    warnings: [],
    metadata,
  });
}

export function advanceEngineeringContractStatus(
  input: AdvanceEngineeringContractStatusInput,
): EngineeringContractResult {
  const metadata = createMutationMetadata(input.contract, input.metadata);
  const fromStatus = input.contract.status;

  if (isTerminalStatus(fromStatus)) {
    return failureResult(
      [
        createContractError(
          "contract_terminal",
          "status",
          `Cannot transition contract from terminal status ${fromStatus}.`,
          metadata,
        ),
      ],
      metadata,
    );
  }

  if (!canAdvanceStatus(fromStatus, input.toStatus)) {
    return failureResult(
      [
        createContractError(
          "invalid_contract_status_transition",
          "status",
          `Cannot transition contract from ${fromStatus} to ${input.toStatus}.`,
          metadata,
        ),
      ],
      metadata,
    );
  }

  const contract: EngineeringContract = {
    ...input.contract,
    status: input.toStatus,
    timeline: [
      ...input.contract.timeline,
      createTimelineEvent(
        timelineEventTypeForStatus(input.toStatus),
        input.occurredAt,
        `Contract ${input.contract.contractNumber} moved from ${fromStatus} to ${input.toStatus}.`,
        metadata,
      ),
    ],
    trace: [
      ...input.contract.trace,
      createTraceEntry(
        "contract_status_advanced",
        input.actor,
        input.occurredAt,
        `Contract status advanced from ${fromStatus} to ${input.toStatus}.`,
        metadata,
      ),
    ],
    metadata,
  };

  return freezeDomainObject<EngineeringContractSuccess>({
    success: true,
    contract,
    errors: [],
    warnings: [],
    metadata,
  });
}

function isTerminalStatus(status: EngineeringContractStatus): boolean {
  return (
    status === EngineeringContractStatus.Completed ||
    status === EngineeringContractStatus.Cancelled
  );
}

function canAdvanceStatus(
  fromStatus: EngineeringContractStatus,
  toStatus: EngineeringContractStatus,
): boolean {
  return allowedTransitions[fromStatus].includes(toStatus);
}

const allowedTransitions: Readonly<
  Record<EngineeringContractStatus, ReadonlyArray<EngineeringContractStatus>>
> = {
  [EngineeringContractStatus.Draft]: [
    EngineeringContractStatus.Signed,
    EngineeringContractStatus.Cancelled,
  ],
  [EngineeringContractStatus.Signed]: [
    EngineeringContractStatus.Executed,
    EngineeringContractStatus.Cancelled,
  ],
  [EngineeringContractStatus.Executed]: [
    EngineeringContractStatus.Completed,
    EngineeringContractStatus.Cancelled,
  ],
  [EngineeringContractStatus.Completed]: [],
  [EngineeringContractStatus.Cancelled]: [],
};

const timelineEventTypeByStatus: Readonly<Record<EngineeringContractStatus, string>> = {
  [EngineeringContractStatus.Draft]: "contract_created",
  [EngineeringContractStatus.Signed]: "contract_signed",
  [EngineeringContractStatus.Executed]: "execution_started",
  [EngineeringContractStatus.Completed]: "contract_completed",
  [EngineeringContractStatus.Cancelled]: "contract_cancelled",
};

function timelineEventTypeForStatus(status: EngineeringContractStatus): string {
  return timelineEventTypeByStatus[status];
}

function validateContractShell(
  input: CreateEngineeringContractInput,
  existingContractIds: ReadonlyArray<EngineeringContractId> | null | undefined,
  metadata: EngineeringContractMetadata,
): EngineeringContractError[] {
  const errors: EngineeringContractError[] = [];

  if (isBlank(input.id)) {
    errors.push(
      createContractError("missing_id", "id", "Contract id is required.", metadata),
    );
  } else if (existingContractIds !== undefined && existingContractIds !== null) {
    if (existingContractIds.includes(input.id)) {
      errors.push(
        createContractError(
          "duplicate_contract_id",
          "id",
          `Contract id ${input.id} already exists.`,
          metadata,
        ),
      );
    }
  }

  if (isBlank(input.publicOwner)) {
    errors.push(
      createContractError(
        "missing_public_owner",
        "publicOwner",
        "Public owner (contracting authority) is required.",
        metadata,
      ),
    );
  }

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

  if (isBlank(input.administrativeProcess)) {
    errors.push(
      createContractError(
        "missing_administrative_process",
        "administrativeProcess",
        "Administrative process is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.objectDescription)) {
    errors.push(
      createContractError(
        "missing_object_description",
        "objectDescription",
        "Object description is required.",
        metadata,
      ),
    );
  }

  if (isBlank(input.city)) {
    errors.push(
      createContractError("missing_city", "city", "City is required.", metadata),
    );
  }

  if (isBlank(input.state)) {
    errors.push(
      createContractError("missing_state", "state", "State is required.", metadata),
    );
  }

  if (
    input.contractValue !== undefined &&
    input.contractValue !== null &&
    input.contractValue < 0
  ) {
    errors.push(
      createContractError(
        "negative_contract_value",
        "contractValue",
        "Contract value cannot be negative.",
        metadata,
      ),
    );
  }

  return errors;
}

function failureResult(
  errors: ReadonlyArray<EngineeringContractError>,
  metadata: EngineeringContractMetadata,
): EngineeringContractFailure {
  return freezeDomainObject<EngineeringContractFailure>({
    success: false,
    contract: null,
    errors,
    warnings: [],
    metadata,
  });
}

function createTimelineEvent(
  type: string,
  occurredAt: string,
  description: string,
  metadata: EngineeringContractMetadata,
): EngineeringContractTimelineEvent {
  return {
    type,
    occurredAt,
    description,
    metadata,
  };
}

function createTraceEntry(
  action: string,
  actor: string,
  occurredAt: string,
  description: string,
  metadata: EngineeringContractMetadata,
): EngineeringContractTrace {
  return {
    action,
    actor,
    occurredAt,
    description,
    metadata,
  };
}

function createContractError(
  code: EngineeringContractError["code"],
  field: string,
  message: string,
  metadata: EngineeringContractMetadata,
): EngineeringContractError {
  return {
    code,
    field,
    message,
    metadata,
  };
}

function createContractMetadata(
  input: CreateEngineeringContractInput,
): EngineeringContractMetadata {
  return {
    ...(input.metadata ?? {}),
    contractId: input.id,
    publicOwner: input.publicOwner,
    contractNumber: input.contractNumber,
    administrativeProcess: input.administrativeProcess,
    correlationId: input.correlationId,
    createdBy: input.createdBy,
    sourceSystem: input.sourceSystem,
  };
}

function createMutationMetadata(
  contract: EngineeringContract,
  extraMetadata: EngineeringContractMetadata | undefined,
): EngineeringContractMetadata {
  return {
    ...contract.metadata,
    ...(extraMetadata ?? {}),
    contractId: contract.id,
    publicOwner: contract.publicOwner,
    contractNumber: contract.contractNumber,
  };
}

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

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
