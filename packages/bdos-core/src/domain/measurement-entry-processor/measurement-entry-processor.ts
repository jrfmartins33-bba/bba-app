import {
  MeasurementEntryStatus,
  type MeasurementEntry,
} from "../measurement-entry";
import type {
  MeasurementCorrelationId,
  MeasurementEvidenceReference,
  MeasurementMetadata,
  MeasurementPeriod,
  ServiceItem,
} from "../measurement";
import type { MeasurementExecution } from "../measurement-engine";
import type {
  CreateMeasurementExecutionsInput,
  MeasurementEntryProcessorError,
  MeasurementEntryProcessorMetadata,
  MeasurementEntryProcessorResult,
  MeasurementEntryProcessorSuccess,
  MeasurementEntryProcessorWarning,
} from "./measurement-entry-processor.types";

interface MeasurementEntryGroup {
  readonly key: string;
  readonly entries: ReadonlyArray<MeasurementEntry>;
}

export function createMeasurementExecutions(
  input: CreateMeasurementExecutionsInput,
): MeasurementEntryProcessorResult {
  const metadata = createProcessorMetadata(input);
  const acceptedEntries = input.measurementEntries.filter(
    (entry) => entry.status === MeasurementEntryStatus.Accepted,
  );
  const warnings = createProcessorWarnings(acceptedEntries, metadata);
  const errors = validateProcessorInput(input, acceptedEntries, metadata);

  if (errors.length > 0) {
    return freezeDomainObject({
      success: false,
      measurementExecutions: [],
      errors,
      warnings,
      metadata,
    });
  }

  const measurementExecutions = createExecutions(
    acceptedEntries,
    input.serviceItems,
    input.measurementPeriod as MeasurementPeriod,
  );

  return freezeDomainObject<MeasurementEntryProcessorSuccess>({
    success: true,
    measurementExecutions,
    errors: [],
    warnings,
    metadata: {
      ...metadata,
      acceptedEntryIds: acceptedEntries.map((entry) => entry.id).sort(),
      measurementExecutionIds: measurementExecutions
        .map((execution) => execution.id)
        .sort(),
    },
  });
}

function validateProcessorInput(
  input: CreateMeasurementExecutionsInput,
  acceptedEntries: ReadonlyArray<MeasurementEntry>,
  metadata: MeasurementEntryProcessorMetadata,
): ReadonlyArray<MeasurementEntryProcessorError> {
  const errors: MeasurementEntryProcessorError[] = [];

  if (input.measurementEntries.length === 0) {
    errors.push(
      createProcessorError(
        "empty_measurement_entries",
        "measurementEntries",
        "Measurement entries must be provided.",
        metadata,
      ),
    );
  }

  if (input.measurementPeriod === undefined || input.measurementPeriod === null) {
    errors.push(
      createProcessorError(
        "missing_measurement_period",
        "measurementPeriod",
        "Measurement period must be provided.",
        metadata,
      ),
    );
  }

  errors.push(...findDuplicateEntryErrors(input.measurementEntries, metadata));

  if (input.measurementPeriod !== undefined && input.measurementPeriod !== null) {
    errors.push(
      ...findContractErrors(acceptedEntries, input.measurementPeriod, metadata),
    );
    errors.push(
      ...findMeasurementPeriodErrors(
        acceptedEntries,
        input.measurementPeriod,
        metadata,
      ),
    );
  }

  errors.push(...findMissingServiceItemErrors(acceptedEntries, input.serviceItems, metadata));

  return errors;
}

function createExecutions(
  acceptedEntries: ReadonlyArray<MeasurementEntry>,
  serviceItems: ReadonlyArray<ServiceItem>,
  measurementPeriod: MeasurementPeriod,
): ReadonlyArray<MeasurementExecution> {
  return groupAcceptedEntries(acceptedEntries)
    .map((group) =>
      createExecutionFromGroup(
        group,
        findServiceItemForGroup(group.entries[0], serviceItems) as ServiceItem,
        measurementPeriod,
      ),
    )
    .sort((first, second) => first.id.localeCompare(second.id));
}

function createExecutionFromGroup(
  group: MeasurementEntryGroup,
  serviceItem: ServiceItem,
  measurementPeriod: MeasurementPeriod,
): MeasurementExecution {
  const sortedEntries = [...group.entries].sort((first, second) => {
    if (first.entryDate !== second.entryDate) {
      return first.entryDate.localeCompare(second.entryDate);
    }

    return first.id.localeCompare(second.id);
  });
  const firstEntry = sortedEntries[0] as MeasurementEntry;
  const entryIds = sortedEntries.map((entry) => entry.id).sort();
  const engineerIds = uniqueSorted(sortedEntries.map((entry) => entry.engineerId));
  const engineerNames = uniqueSorted(sortedEntries.map((entry) => entry.engineerName));
  const correlationIds = getCorrelationIds(sortedEntries);
  const evidenceReferences = aggregateEvidenceReferences(sortedEntries);
  const totalQuantity = sortedEntries.reduce(
    (total, entry) => total + entry.quantity,
    0,
  );
  const notes = sortedEntries
    .map((entry) => entry.notes)
    .filter((note) => note.trim().length > 0);

  return {
    id: createMeasurementExecutionId(firstEntry),
    contractId: firstEntry.contractId,
    workPackageId: firstEntry.workPackageId,
    serviceItemId: firstEntry.serviceItemId,
    measurementPeriodId: firstEntry.measurementPeriodId,
    executedQuantity: totalQuantity,
    measurementDate: sortedEntries[sortedEntries.length - 1]?.entryDate ??
      measurementPeriod.endDate,
    engineer: engineerNames.join(", "),
    evidenceReferences,
    correlationId: correlationIds[0] ?? serviceItem.correlationId,
    metadata: {
      ...mergeEntryMetadata(sortedEntries),
      contractId: firstEntry.contractId,
      projectId: firstEntry.projectId,
      workPackageId: firstEntry.workPackageId,
      serviceItemId: firstEntry.serviceItemId,
      measurementPeriodId: firstEntry.measurementPeriodId,
      serviceItemCode: serviceItem.code,
      totalQuantity,
      entryCount: sortedEntries.length,
      entryIds,
      firstEntryDate: sortedEntries[0]?.entryDate,
      lastEntryDate: sortedEntries[sortedEntries.length - 1]?.entryDate,
      evidenceReferenceIds: evidenceReferences.map((evidence) => evidence.id),
      engineerIds,
      engineerNames,
      notes,
      correlationIds,
    },
  };
}

function groupAcceptedEntries(
  acceptedEntries: ReadonlyArray<MeasurementEntry>,
): ReadonlyArray<MeasurementEntryGroup> {
  const groups = new Map<string, MeasurementEntry[]>();

  acceptedEntries.forEach((entry) => {
    const key = createGroupKey(entry);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  });

  return Array.from(groups.entries())
    .map(([key, entries]) => ({
      key,
      entries,
    }))
    .sort((first, second) => first.key.localeCompare(second.key));
}

function createGroupKey(entry: MeasurementEntry): string {
  return [
    entry.contractId,
    entry.projectId,
    entry.workPackageId,
    entry.serviceItemId,
    entry.measurementPeriodId,
  ].join("|");
}

function createMeasurementExecutionId(entry: MeasurementEntry): string {
  return [
    "measurement-execution",
    entry.contractId,
    entry.projectId,
    entry.workPackageId,
    entry.serviceItemId,
    entry.measurementPeriodId,
  ].join(":");
}

function findDuplicateEntryErrors(
  entries: ReadonlyArray<MeasurementEntry>,
  metadata: MeasurementEntryProcessorMetadata,
): ReadonlyArray<MeasurementEntryProcessorError> {
  const seenEntryIds = new Set<string>();
  const duplicateEntryIds = new Set<string>();

  entries.forEach((entry) => {
    if (seenEntryIds.has(entry.id)) {
      duplicateEntryIds.add(entry.id);
      return;
    }

    seenEntryIds.add(entry.id);
  });

  return Array.from(duplicateEntryIds).map((entryId) =>
    createProcessorError(
      "duplicate_measurement_entry",
      "measurementEntries",
      "Measurement entries contain duplicate IDs.",
      {
        ...metadata,
        entryId,
      },
    ),
  );
}

function findContractErrors(
  acceptedEntries: ReadonlyArray<MeasurementEntry>,
  measurementPeriod: MeasurementPeriod,
  metadata: MeasurementEntryProcessorMetadata,
): ReadonlyArray<MeasurementEntryProcessorError> {
  return acceptedEntries
    .filter((entry) => entry.contractId !== measurementPeriod.contractId)
    .map((entry) =>
      createProcessorError(
        "different_contract",
        "contractId",
        "Accepted measurement entries must belong to the measurement period contract.",
        {
          ...metadata,
          entryId: entry.id,
          entryContractId: entry.contractId,
          measurementPeriodContractId: measurementPeriod.contractId,
        },
      ),
    );
}

function findMeasurementPeriodErrors(
  acceptedEntries: ReadonlyArray<MeasurementEntry>,
  measurementPeriod: MeasurementPeriod,
  metadata: MeasurementEntryProcessorMetadata,
): ReadonlyArray<MeasurementEntryProcessorError> {
  return acceptedEntries
    .filter((entry) => entry.measurementPeriodId !== measurementPeriod.id)
    .map((entry) =>
      createProcessorError(
        "different_measurement_period",
        "measurementPeriodId",
        "Accepted measurement entries must belong to the provided measurement period.",
        {
          ...metadata,
          entryId: entry.id,
          entryMeasurementPeriodId: entry.measurementPeriodId,
          measurementPeriodId: measurementPeriod.id,
        },
      ),
    );
}

function findMissingServiceItemErrors(
  acceptedEntries: ReadonlyArray<MeasurementEntry>,
  serviceItems: ReadonlyArray<ServiceItem>,
  metadata: MeasurementEntryProcessorMetadata,
): ReadonlyArray<MeasurementEntryProcessorError> {
  return groupAcceptedEntries(acceptedEntries)
    .filter((group) => findServiceItemForGroup(group.entries[0], serviceItems) === undefined)
    .map((group) => {
      const entry = group.entries[0] as MeasurementEntry;

      return createProcessorError(
        "missing_service_item",
        "serviceItems",
        "A matching service item is required for every accepted measurement entry group.",
        {
          ...metadata,
          contractId: entry.contractId,
          workPackageId: entry.workPackageId,
          serviceItemId: entry.serviceItemId,
          entryIds: group.entries.map((groupEntry) => groupEntry.id).sort(),
        },
      );
    });
}

function findServiceItemForGroup(
  entry: MeasurementEntry | undefined,
  serviceItems: ReadonlyArray<ServiceItem>,
): ServiceItem | undefined {
  if (entry === undefined) {
    return undefined;
  }

  return serviceItems.find(
    (serviceItem) =>
      serviceItem.contractId === entry.contractId &&
      serviceItem.workPackageId === entry.workPackageId &&
      serviceItem.serviceItemId === entry.serviceItemId,
  );
}

function aggregateEvidenceReferences(
  entries: ReadonlyArray<MeasurementEntry>,
): ReadonlyArray<MeasurementEvidenceReference> {
  const evidenceById = new Map<string, MeasurementEvidenceReference>();

  entries.forEach((entry) => {
    entry.evidenceReferences.forEach((evidenceReference) => {
      if (!evidenceById.has(evidenceReference.id)) {
        evidenceById.set(evidenceReference.id, evidenceReference);
      }
    });
  });

  return Array.from(evidenceById.values()).sort((first, second) =>
    first.id.localeCompare(second.id),
  );
}

function getCorrelationIds(
  entries: ReadonlyArray<MeasurementEntry>,
): ReadonlyArray<MeasurementCorrelationId> {
  return uniqueSorted(
    entries
      .map((entry) => entry.metadata["correlationId"])
      .filter((value): value is MeasurementCorrelationId => typeof value === "string"),
  );
}

function mergeEntryMetadata(
  entries: ReadonlyArray<MeasurementEntry>,
): MeasurementMetadata {
  return entries.reduce<MeasurementMetadata>(
    (metadata, entry) => ({
      ...metadata,
      ...entry.metadata,
    }),
    {},
  );
}

function createProcessorWarnings(
  acceptedEntries: ReadonlyArray<MeasurementEntry>,
  metadata: MeasurementEntryProcessorMetadata,
): ReadonlyArray<MeasurementEntryProcessorWarning> {
  if (acceptedEntries.length > 0) {
    return [];
  }

  return [
    {
      code: "no_accepted_entries",
      field: "measurementEntries",
      message: "No accepted measurement entries were available for processing.",
      metadata,
    },
  ];
}

function createProcessorMetadata(
  input: CreateMeasurementExecutionsInput,
): MeasurementEntryProcessorMetadata {
  const acceptedEntries = input.measurementEntries.filter(
    (entry) => entry.status === MeasurementEntryStatus.Accepted,
  );

  return {
    ...(input.metadata ?? {}),
    measurementEntryIds: input.measurementEntries.map((entry) => entry.id).sort(),
    acceptedEntryIds: acceptedEntries.map((entry) => entry.id).sort(),
    ignoredEntryIds: input.measurementEntries
      .filter((entry) => entry.status !== MeasurementEntryStatus.Accepted)
      .map((entry) => entry.id)
      .sort(),
    serviceItemIds: input.serviceItems.map((serviceItem) => serviceItem.serviceItemId).sort(),
    measurementPeriodId: input.measurementPeriod?.id,
    contractId: input.measurementPeriod?.contractId,
    correlationIds: getCorrelationIds(input.measurementEntries),
  };
}

function createProcessorError(
  code: MeasurementEntryProcessorError["code"],
  field: string,
  message: string,
  metadata: MeasurementEntryProcessorMetadata,
): MeasurementEntryProcessorError {
  return {
    code,
    field,
    message,
    metadata,
  };
}

function uniqueSorted(values: ReadonlyArray<string>): ReadonlyArray<string> {
  return Array.from(new Set(values)).sort();
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
