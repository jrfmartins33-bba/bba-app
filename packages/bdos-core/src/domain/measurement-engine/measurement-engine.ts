import {
  createMeasurementMemory,
  type MeasurementMemory,
  type MeasurementMetadata,
  type MeasurementPeriod,
  type ServiceItem,
} from "../measurement";
import type {
  MeasurementCalculatedValue,
  MeasurementExecution,
  MeasurementValidationResult,
  MeasurementWarning,
} from "./measurement-engine.types";

export interface MeasurementResult {
  readonly contractId: MeasurementExecution["contractId"];
  readonly workPackageId: MeasurementExecution["workPackageId"];
  readonly serviceItemId: MeasurementExecution["serviceItemId"];
  readonly measurementPeriodId: MeasurementExecution["measurementPeriodId"];
  readonly correlationId: MeasurementExecution["correlationId"];
  readonly measurementMemory: MeasurementMemory;
  readonly calculatedValue: MeasurementCalculatedValue;
  readonly accumulatedQuantity: number;
  readonly remainingQuantity: number;
  readonly requiresReplanilhamento: boolean;
  readonly warnings: ReadonlyArray<MeasurementWarning>;
  readonly validation: MeasurementValidationResult;
  readonly metadata: MeasurementMetadata;
}

export interface MeasurementEngine {
  readonly createMeasurement: typeof createMeasurement;
  readonly validateMeasurement: typeof validateMeasurement;
}

export const measurementEngine: MeasurementEngine = Object.freeze({
  createMeasurement,
  validateMeasurement,
});

export function createMeasurement(
  execution: MeasurementExecution,
  serviceItem: ServiceItem,
  measurementPeriod: MeasurementPeriod,
): MeasurementResult {
  const calculatedValue = execution.executedQuantity * serviceItem.unitPrice;
  const accumulatedQuantity =
    serviceItem.accumulatedQuantity + execution.executedQuantity;
  const remainingQuantity = serviceItem.contractQuantity - accumulatedQuantity;
  const requiresReplanilhamento = accumulatedQuantity > serviceItem.contractQuantity;
  const validation = validateMeasurement(
    execution,
    serviceItem,
    measurementPeriod,
    accumulatedQuantity,
    remainingQuantity,
  );
  const metadata = createMeasurementResultMetadata(execution);

  return freezeDomainObject({
    contractId: execution.contractId,
    workPackageId: execution.workPackageId,
    serviceItemId: execution.serviceItemId,
    measurementPeriodId: execution.measurementPeriodId,
    correlationId: execution.correlationId,
    measurementMemory: createMeasurementMemory({
      id: execution.id,
      contractId: execution.contractId,
      workPackageId: execution.workPackageId,
      serviceItemId: execution.serviceItemId,
      correlationId: execution.correlationId,
      evidenceReferences: execution.evidenceReferences,
      metadata,
    }),
    calculatedValue,
    accumulatedQuantity,
    remainingQuantity,
    requiresReplanilhamento,
    warnings: validation.warnings,
    validation,
    metadata,
  });
}

export function validateMeasurement(
  execution: MeasurementExecution,
  serviceItem: ServiceItem,
  measurementPeriod: MeasurementPeriod,
  accumulatedQuantity = serviceItem.accumulatedQuantity + execution.executedQuantity,
  remainingQuantity = serviceItem.contractQuantity - accumulatedQuantity,
): MeasurementValidationResult {
  const warnings: MeasurementWarning[] = [];

  if (execution.executedQuantity === 0) {
    warnings.push(
      createWarning(
        "zero_quantity",
        "executedQuantity",
        "Measurement execution quantity is zero.",
      ),
    );
  }

  if (execution.executedQuantity < 0) {
    warnings.push(
      createWarning(
        "negative_quantity",
        "executedQuantity",
        "Measurement execution quantity is negative.",
      ),
    );
  }

  if (remainingQuantity < 0) {
    warnings.push(
      createWarning(
        "remaining_quantity_below_zero",
        "remainingQuantity",
        "Remaining contract quantity is below zero.",
        {
          remainingQuantity,
        },
      ),
    );
  }

  if (accumulatedQuantity > serviceItem.contractQuantity) {
    warnings.push(
      createWarning(
        "measurement_exceeds_contract",
        "accumulatedQuantity",
        "Accumulated measured quantity exceeds the contractual quantity.",
        {
          accumulatedQuantity,
          contractQuantity: serviceItem.contractQuantity,
        },
      ),
    );
  }

  if (isMeasurementOutsidePeriod(execution, measurementPeriod)) {
    warnings.push(
      createWarning(
        "measurement_outside_period",
        "measurementDate",
        "Measurement date is outside the measurement period.",
        {
          measurementDate: execution.measurementDate,
          periodStartDate: measurementPeriod.startDate,
          periodEndDate: measurementPeriod.endDate,
        },
      ),
    );
  }

  warnings.push(...findDuplicateEvidenceReferenceWarnings(execution));
  warnings.push(...findTraceabilityWarnings(execution, serviceItem, measurementPeriod));

  return freezeDomainObject({
    valid: warnings.length === 0,
    warnings,
    metadata: createMeasurementValidationMetadata(execution),
  });
}

function createMeasurementResultMetadata(
  execution: MeasurementExecution,
): MeasurementMetadata {
  return {
    ...execution.metadata,
    measurementExecutionId: execution.id,
    measurementPeriodId: execution.measurementPeriodId,
    measurementDate: execution.measurementDate,
    engineer: execution.engineer,
    executedQuantity: execution.executedQuantity,
  };
}

function createMeasurementValidationMetadata(
  execution: MeasurementExecution,
): MeasurementMetadata {
  return {
    measurementExecutionId: execution.id,
    measurementPeriodId: execution.measurementPeriodId,
    correlationId: execution.correlationId,
  };
}

function findDuplicateEvidenceReferenceWarnings(
  execution: MeasurementExecution,
): ReadonlyArray<MeasurementWarning> {
  const warnings: MeasurementWarning[] = [];
  const seenEvidenceIds = new Set<string>();
  const duplicatedEvidenceIds = new Set<string>();

  execution.evidenceReferences.forEach((evidenceReference) => {
    if (seenEvidenceIds.has(evidenceReference.id)) {
      duplicatedEvidenceIds.add(evidenceReference.id);
      return;
    }

    seenEvidenceIds.add(evidenceReference.id);
  });

  duplicatedEvidenceIds.forEach((evidenceReferenceId) => {
    warnings.push(
      createWarning(
        "duplicate_evidence_reference",
        "evidenceReferences",
        "Measurement execution contains a duplicate evidence reference.",
        {
          evidenceReferenceId,
        },
      ),
    );
  });

  return warnings;
}

function findTraceabilityWarnings(
  execution: MeasurementExecution,
  serviceItem: ServiceItem,
  measurementPeriod: MeasurementPeriod,
): ReadonlyArray<MeasurementWarning> {
  const warnings: MeasurementWarning[] = [];

  if (execution.contractId !== serviceItem.contractId) {
    warnings.push(
      createWarning(
        "contract_id_mismatch",
        "contractId",
        "Measurement execution contract does not match the service item contract.",
      ),
    );
  }

  if (execution.workPackageId !== serviceItem.workPackageId) {
    warnings.push(
      createWarning(
        "work_package_id_mismatch",
        "workPackageId",
        "Measurement execution work package does not match the service item work package.",
      ),
    );
  }

  if (execution.serviceItemId !== serviceItem.serviceItemId) {
    warnings.push(
      createWarning(
        "service_item_id_mismatch",
        "serviceItemId",
        "Measurement execution service item does not match the service item.",
      ),
    );
  }

  if (execution.contractId !== measurementPeriod.contractId) {
    warnings.push(
      createWarning(
        "measurement_period_contract_mismatch",
        "measurementPeriodId",
        "Measurement period belongs to a different contract.",
      ),
    );
  }

  return warnings;
}

function isMeasurementOutsidePeriod(
  execution: MeasurementExecution,
  measurementPeriod: MeasurementPeriod,
): boolean {
  return (
    execution.measurementDate < measurementPeriod.startDate ||
    execution.measurementDate > measurementPeriod.endDate
  );
}

function createWarning(
  code: MeasurementWarning["code"],
  field: string,
  message: string,
  metadata: MeasurementMetadata = {},
): MeasurementWarning {
  return {
    code,
    field,
    message,
    metadata,
  };
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
