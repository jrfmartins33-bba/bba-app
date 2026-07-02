import type { MeasurementDate, MeasurementMetadata } from "../measurement";
import type {
  Certification,
  MeasurementBulletin,
  MeasurementCycle,
} from "../measurement-workflow";
import { MeasurementCycleStatus } from "../measurement-workflow";
import type {
  MeasuredRevenue,
  MeasuredRevenueId,
  RevenueRecognitionError,
  RevenueRecognitionMetadata,
  RevenueRecognitionWarning,
} from "./revenue-recognition.types";
import { RecognitionStatus } from "./revenue-recognition.types";

export interface RecognizeMeasuredRevenueInput {
  readonly measurementCycle: MeasurementCycle;
  readonly id: MeasuredRevenueId;
  readonly revenueDate: MeasurementDate;
  readonly metadata?: RevenueRecognitionMetadata;
}

export interface RevenueRecognitionSuccess {
  readonly success: true;
  readonly measuredRevenue: MeasuredRevenue;
  readonly errors: ReadonlyArray<RevenueRecognitionError>;
  readonly warnings: ReadonlyArray<RevenueRecognitionWarning>;
  readonly metadata: RevenueRecognitionMetadata;
}

export interface RevenueRecognitionFailure {
  readonly success: false;
  readonly measuredRevenue: null;
  readonly errors: ReadonlyArray<RevenueRecognitionError>;
  readonly warnings: ReadonlyArray<RevenueRecognitionWarning>;
  readonly metadata: RevenueRecognitionMetadata;
}

export type RevenueRecognitionResult =
  | RevenueRecognitionSuccess
  | RevenueRecognitionFailure;

export function recognizeMeasuredRevenue(
  input: RecognizeMeasuredRevenueInput,
): RevenueRecognitionResult {
  const metadata = createRecognitionMetadata(input);

  if (!isRevenueRecognizableStatus(input.measurementCycle.status)) {
    return createFailureResult(input, [
      createError(
        "measurement_cycle_not_certified",
        "measurementCycle.status",
        "Only certified or closed measurement cycles can generate recognized revenue.",
        metadata,
      ),
    ]);
  }

  const certification = input.measurementCycle.certifications[0];

  if (certification === undefined) {
    return createFailureResult(input, [
      createError(
        "missing_certification",
        "measurementCycle.certifications",
        "Measured revenue cannot be recognized without a certification.",
        metadata,
      ),
    ]);
  }

  if (!certification.certified) {
    return createFailureResult(input, [
      createError(
        "certification_not_certified",
        "measurementCycle.certifications",
        "Measured revenue cannot be recognized from an uncertified measurement bulletin.",
        {
          ...metadata,
          certificationId: certification.id,
        },
      ),
    ]);
  }

  const bulletin = findCertifiedBulletin(input.measurementCycle, certification);

  if (bulletin === undefined) {
    return createFailureResult(input, [
      createError(
        "missing_certified_bulletin",
        "measurementCycle.measurementBulletins",
        "Measured revenue cannot be recognized because the certified bulletin was not found.",
        {
          ...metadata,
          certificationId: certification.id,
          bulletinId: certification.bulletinId,
        },
      ),
    ]);
  }

  return freezeDomainObject({
    success: true,
    measuredRevenue: createMeasuredRevenue(input, certification, bulletin),
    errors: [],
    warnings: [],
    metadata,
  });
}

function createMeasuredRevenue(
  input: RecognizeMeasuredRevenueInput,
  certification: Certification,
  bulletin: MeasurementBulletin,
): MeasuredRevenue {
  const metadata = createRecognitionMetadata(input, {
    bulletinId: bulletin.id,
    certificationId: certification.id,
  });

  return {
    id: input.id,
    measurementCycleId: input.measurementCycle.id,
    contractId: input.measurementCycle.contractId,
    projectId: input.measurementCycle.projectId,
    periodId: input.measurementCycle.period.id,
    bulletinId: bulletin.id,
    certificationId: certification.id,
    revenueDate: input.revenueDate,
    grossAmount: bulletin.totalMeasuredValue,
    certifiedAmount: bulletin.totalMeasuredValue,
    recognitionStatus: RecognitionStatus.Recognized,
    source: "certified_measurement_cycle",
    metadata,
  };
}

function createFailureResult(
  input: RecognizeMeasuredRevenueInput,
  errors: ReadonlyArray<RevenueRecognitionError>,
): RevenueRecognitionFailure {
  return freezeDomainObject({
    success: false,
    measuredRevenue: null,
    errors,
    warnings: [],
    metadata: createRecognitionMetadata(input),
  });
}

function isRevenueRecognizableStatus(status: MeasurementCycleStatus): boolean {
  return (
    status === MeasurementCycleStatus.Certified ||
    status === MeasurementCycleStatus.Closed
  );
}

function findCertifiedBulletin(
  measurementCycle: MeasurementCycle,
  certification: Certification,
): MeasurementBulletin | undefined {
  return measurementCycle.measurementBulletins.find(
    (bulletin) => bulletin.id === certification.bulletinId,
  );
}

function createRecognitionMetadata(
  input: RecognizeMeasuredRevenueInput,
  metadata: MeasurementMetadata = {},
): RevenueRecognitionMetadata {
  return {
    ...(input.metadata ?? {}),
    ...metadata,
    correlationId: input.measurementCycle.metadata["correlationId"],
    measurementCycleId: input.measurementCycle.id,
    contractId: input.measurementCycle.contractId,
    projectId: input.measurementCycle.projectId,
    periodId: input.measurementCycle.period.id,
  };
}

function createError(
  code: RevenueRecognitionError["code"],
  field: string,
  message: string,
  metadata: RevenueRecognitionMetadata,
): RevenueRecognitionError {
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
