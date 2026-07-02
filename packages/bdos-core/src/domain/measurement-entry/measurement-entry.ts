import type {
  AdvanceMeasurementEntryStatusInput,
  CreateMeasurementEntryInput,
  MeasurementEntry,
  MeasurementEntryError,
  MeasurementEntryMetadata,
  MeasurementEntryResult,
  MeasurementEntrySuccess,
  MeasurementEntryTransitionError,
  MeasurementEntryTransitionFailure,
  MeasurementEntryTransitionResult,
} from "./measurement-entry.types";
import { MeasurementEntryStatus } from "./measurement-entry.types";

export function createMeasurementEntry(
  input: CreateMeasurementEntryInput,
): MeasurementEntryResult {
  const metadata = createMeasurementEntryMetadata(input);
  const errors = validateMeasurementEntry(input, metadata);

  if (errors.length > 0) {
    return freezeDomainObject({
      success: false,
      entry: null,
      errors,
      warnings: [],
      metadata,
    });
  }

  return freezeDomainObject<MeasurementEntrySuccess>({
    success: true,
    entry: createEntry(input, metadata),
    errors: [],
    warnings: [],
    metadata,
  });
}

export function advanceMeasurementEntryStatus(
  input: AdvanceMeasurementEntryStatusInput,
): MeasurementEntryTransitionResult {
  if (!canAdvanceMeasurementEntryStatus(input.entry.status, input.toStatus)) {
    return freezeDomainObject<MeasurementEntryTransitionFailure>({
      success: false,
      error: createTransitionError(input),
    });
  }

  return freezeDomainObject({
    success: true,
    entry: {
      ...input.entry,
      status: input.toStatus,
      metadata: {
        ...input.entry.metadata,
        ...(input.metadata ?? {}),
        fromStatus: input.entry.status,
        toStatus: input.toStatus,
      },
    },
  });
}

function createEntry(
  input: CreateMeasurementEntryInput,
  metadata: MeasurementEntryMetadata,
): MeasurementEntry {
  return {
    id: input.id,
    contractId: input.contractId,
    projectId: input.projectId,
    workPackageId: input.workPackageId,
    serviceItemId: input.serviceItemId,
    measurementPeriodId: input.measurementPeriodId,
    quantity: input.quantity,
    unit: input.unit,
    entryDate: input.entryDate,
    engineerId: input.engineerId,
    engineerName: input.engineerName,
    evidenceReferences: [...(input.evidenceReferences ?? [])],
    notes: input.notes ?? "",
    status: input.status ?? MeasurementEntryStatus.Draft,
    metadata,
  };
}

function validateMeasurementEntry(
  input: CreateMeasurementEntryInput,
  metadata: MeasurementEntryMetadata,
): ReadonlyArray<MeasurementEntryError> {
  const errors: MeasurementEntryError[] = [];

  if (input.quantity <= 0) {
    errors.push(
      createMeasurementEntryError(
        "invalid_quantity",
        "quantity",
        "Measurement entry quantity must be greater than zero.",
        metadata,
      ),
    );
  }

  findMissingReferenceFields(input).forEach((field) => {
    errors.push(
      createMeasurementEntryError(
        "missing_required_reference",
        field,
        "Measurement entry requires contract, project, work package, service item, and measurement period references.",
        metadata,
      ),
    );
  });

  findMissingEngineerFields(input).forEach((field) => {
    errors.push(
      createMeasurementEntryError(
        "missing_engineer_data",
        field,
        "Measurement entry requires engineerId and engineerName.",
        metadata,
      ),
    );
  });

  return errors;
}

function findMissingReferenceFields(
  input: CreateMeasurementEntryInput,
): ReadonlyArray<string> {
  const requiredReferences: ReadonlyArray<
    readonly [string, string]
  > = [
    ["contractId", input.contractId],
    ["projectId", input.projectId],
    ["workPackageId", input.workPackageId],
    ["serviceItemId", input.serviceItemId],
    ["measurementPeriodId", input.measurementPeriodId],
  ];

  return requiredReferences
    .filter(([, value]) => value.trim().length === 0)
    .map(([field]) => field);
}

function findMissingEngineerFields(
  input: CreateMeasurementEntryInput,
): ReadonlyArray<string> {
  const requiredEngineerFields: ReadonlyArray<
    readonly [string, string]
  > = [
    ["engineerId", input.engineerId],
    ["engineerName", input.engineerName],
  ];

  return requiredEngineerFields
    .filter(([, value]) => value.trim().length === 0)
    .map(([field]) => field);
}

function canAdvanceMeasurementEntryStatus(
  fromStatus: MeasurementEntryStatus,
  toStatus: MeasurementEntryStatus,
): boolean {
  return allowedTransitions[fromStatus].includes(toStatus);
}

function createTransitionError(
  input: AdvanceMeasurementEntryStatusInput,
): MeasurementEntryTransitionError {
  return {
    code: "invalid_measurement_entry_transition",
    message: `Cannot transition measurement entry from ${input.entry.status} to ${input.toStatus}.`,
    from: input.entry.status,
    to: input.toStatus,
    metadata: {
      ...input.entry.metadata,
      ...(input.metadata ?? {}),
      measurementEntryId: input.entry.id,
      attemptedStatus: input.toStatus,
    },
  };
}

function createMeasurementEntryError(
  code: MeasurementEntryError["code"],
  field: string,
  message: string,
  metadata: MeasurementEntryMetadata,
): MeasurementEntryError {
  return {
    code,
    field,
    message,
    metadata,
  };
}

function createMeasurementEntryMetadata(
  input: CreateMeasurementEntryInput,
): MeasurementEntryMetadata {
  return {
    ...(input.metadata ?? {}),
    measurementEntryId: input.id,
    contractId: input.contractId,
    projectId: input.projectId,
    workPackageId: input.workPackageId,
    serviceItemId: input.serviceItemId,
    measurementPeriodId: input.measurementPeriodId,
    engineerId: input.engineerId,
    entryDate: input.entryDate,
    correlationId: input.correlationId,
  };
}

const allowedTransitions: Readonly<
  Record<MeasurementEntryStatus, ReadonlyArray<MeasurementEntryStatus>>
> = {
  [MeasurementEntryStatus.Draft]: [
    MeasurementEntryStatus.Submitted,
    MeasurementEntryStatus.Cancelled,
  ],
  [MeasurementEntryStatus.Submitted]: [
    MeasurementEntryStatus.Accepted,
    MeasurementEntryStatus.Rejected,
    MeasurementEntryStatus.Cancelled,
  ],
  [MeasurementEntryStatus.Rejected]: [MeasurementEntryStatus.Draft],
  [MeasurementEntryStatus.Accepted]: [MeasurementEntryStatus.Cancelled],
  [MeasurementEntryStatus.Cancelled]: [],
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
