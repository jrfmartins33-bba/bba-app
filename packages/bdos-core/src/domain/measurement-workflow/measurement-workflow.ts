import type { ContractBaselineId, MeasurementCorrelationId, MeasurementPeriod } from "../measurement";
import type { MeasurementExecution, MeasurementResult } from "../measurement-engine";
import type {
  Certification,
  MeasurementBulletin,
  MeasurementCycleId,
  MeasurementCycleTransitionError,
  MeasurementCycleTransitionFailure,
  MeasurementProjectId,
  MeasurementWorkflowMetadata,
  TimelineEvent,
} from "./measurement-workflow.types";
import { MeasurementCycleStatus } from "./measurement-workflow.types";

export interface MeasurementCycle {
  readonly id: MeasurementCycleId;
  readonly contractId: ContractBaselineId;
  readonly projectId: MeasurementProjectId;
  readonly period: MeasurementPeriod;
  readonly status: MeasurementCycleStatus;
  readonly measurementExecutions: ReadonlyArray<MeasurementExecution>;
  readonly measurementResults: ReadonlyArray<MeasurementResult>;
  readonly measurementBulletins: ReadonlyArray<MeasurementBulletin>;
  readonly certifications: ReadonlyArray<Certification>;
  readonly timeline: ReadonlyArray<TimelineEvent>;
  readonly metadata: MeasurementWorkflowMetadata;
}

export interface CreateMeasurementCycleInput {
  readonly id: MeasurementCycleId;
  readonly contractId: ContractBaselineId;
  readonly projectId: MeasurementProjectId;
  readonly period: MeasurementPeriod;
  readonly status?: MeasurementCycleStatus;
  readonly measurementExecutions: ReadonlyArray<MeasurementExecution>;
  readonly measurementResults: ReadonlyArray<MeasurementResult>;
  readonly measurementBulletins?: ReadonlyArray<MeasurementBulletin>;
  readonly certifications?: ReadonlyArray<Certification>;
  readonly timeline?: ReadonlyArray<TimelineEvent>;
  readonly correlationId: MeasurementCorrelationId;
  readonly metadata?: MeasurementWorkflowMetadata;
}

export interface AdvanceMeasurementCycleInput {
  readonly measurementCycle: MeasurementCycle;
  readonly toStatus: MeasurementCycleStatus;
  readonly timelineEvent: TimelineEvent;
  readonly measurementBulletins?: ReadonlyArray<MeasurementBulletin>;
  readonly certifications?: ReadonlyArray<Certification>;
  readonly metadata?: MeasurementWorkflowMetadata;
}

export interface AdvanceMeasurementCycleSuccess {
  readonly success: true;
  readonly measurementCycle: MeasurementCycle;
}

export type AdvanceMeasurementCycleResult =
  | AdvanceMeasurementCycleSuccess
  | MeasurementCycleTransitionFailure;

export function createMeasurementCycle(
  input: CreateMeasurementCycleInput,
): MeasurementCycle {
  return freezeDomainObject({
    id: input.id,
    contractId: input.contractId,
    projectId: input.projectId,
    period: input.period,
    status: input.status ?? MeasurementCycleStatus.Draft,
    measurementExecutions: [...input.measurementExecutions],
    measurementResults: [...input.measurementResults],
    measurementBulletins: [...(input.measurementBulletins ?? [])],
    certifications: [...(input.certifications ?? [])],
    timeline: [...(input.timeline ?? [])],
    metadata: {
      ...(input.metadata ?? {}),
      correlationId: input.correlationId,
    },
  });
}

export function advanceMeasurementCycle(
  input: AdvanceMeasurementCycleInput,
): AdvanceMeasurementCycleResult {
  const fromStatus = input.measurementCycle.status;

  if (!canAdvanceMeasurementCycle(fromStatus, input.toStatus)) {
    return freezeDomainObject({
      success: false,
      error: createTransitionError(input.measurementCycle, input.toStatus),
    });
  }

  return freezeDomainObject({
    success: true,
    measurementCycle: {
      ...input.measurementCycle,
      status: input.toStatus,
      measurementBulletins:
        input.measurementBulletins ?? input.measurementCycle.measurementBulletins,
      certifications: input.certifications ?? input.measurementCycle.certifications,
      timeline: [
        ...input.measurementCycle.timeline,
        enrichTimelineEvent(input.measurementCycle, input.toStatus, input.timelineEvent),
      ],
      metadata: {
        ...input.measurementCycle.metadata,
        ...(input.metadata ?? {}),
      },
    },
  });
}

function canAdvanceMeasurementCycle(
  fromStatus: MeasurementCycleStatus,
  toStatus: MeasurementCycleStatus,
): boolean {
  return allowedTransitions[fromStatus] === toStatus;
}

function createTransitionError(
  measurementCycle: MeasurementCycle,
  toStatus: MeasurementCycleStatus,
): MeasurementCycleTransitionError {
  return {
    code: "invalid_measurement_cycle_transition",
    message: `Cannot transition measurement cycle from ${measurementCycle.status} to ${toStatus}.`,
    from: measurementCycle.status,
    to: toStatus,
    metadata: createTraceabilityMetadata(measurementCycle, {
      attemptedStatus: toStatus,
    }),
  };
}

function enrichTimelineEvent(
  measurementCycle: MeasurementCycle,
  toStatus: MeasurementCycleStatus,
  timelineEvent: TimelineEvent,
): TimelineEvent {
  return {
    ...timelineEvent,
    metadata: createTraceabilityMetadata(measurementCycle, {
      ...timelineEvent.metadata,
      fromStatus: measurementCycle.status,
      toStatus,
    }),
  };
}

function createTraceabilityMetadata(
  measurementCycle: MeasurementCycle,
  metadata: MeasurementWorkflowMetadata,
): MeasurementWorkflowMetadata {
  return {
    ...metadata,
    correlationId: measurementCycle.metadata["correlationId"],
    contractId: measurementCycle.contractId,
    projectId: measurementCycle.projectId,
    measurementId: measurementCycle.id,
    measurementExecutionIds: measurementCycle.measurementExecutions.map(
      (execution) => execution.id,
    ),
  };
}

const allowedTransitions: Readonly<
  Record<MeasurementCycleStatus, MeasurementCycleStatus | null>
> = {
  [MeasurementCycleStatus.Draft]: MeasurementCycleStatus.Measured,
  [MeasurementCycleStatus.Measured]: MeasurementCycleStatus.BulletinGenerated,
  [MeasurementCycleStatus.BulletinGenerated]: MeasurementCycleStatus.Certified,
  [MeasurementCycleStatus.Certified]: MeasurementCycleStatus.Closed,
  [MeasurementCycleStatus.Closed]: null,
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
