import type {
  ContractBaselineId,
  MeasurementCorrelationId,
  MeasurementDate,
  MeasurementMetadata,
  MeasurementPeriod,
  MeasurementQuantity,
} from "../measurement";

export type MeasurementCycleId = string;

export type MeasurementProjectId = string;

export type MeasurementBulletinId = string;

export type MeasurementCertificationId = string;

export type MeasurementTimelineEventId = string;

export type MeasurementTimelineEventType = string;

export type MeasurementActor = string;

export type MeasurementWorkflowMetadata = MeasurementMetadata;

export enum MeasurementCycleStatus {
  Draft = "draft",
  Measured = "measured",
  BulletinGenerated = "bulletin_generated",
  Certified = "certified",
  Closed = "closed",
}

export interface MeasurementBulletin {
  readonly id: MeasurementBulletinId;
  readonly measurementId: MeasurementCycleId;
  readonly bulletinNumber: number;
  readonly period: MeasurementPeriod;
  readonly issueDate: MeasurementDate;
  readonly totalMeasuredValue: number;
  readonly totalMeasuredQuantity: MeasurementQuantity;
  readonly metadata: MeasurementWorkflowMetadata;
}

export interface Certification {
  readonly id: MeasurementCertificationId;
  readonly bulletinId: MeasurementBulletinId;
  readonly certified: boolean;
  readonly certifiedBy: MeasurementActor;
  readonly certificationDate: MeasurementDate;
  readonly observations: string;
  readonly metadata: MeasurementWorkflowMetadata;
}

export interface TimelineEvent {
  readonly id: MeasurementTimelineEventId;
  readonly type: MeasurementTimelineEventType;
  readonly occurredAt: MeasurementDate;
  readonly actor: MeasurementActor;
  readonly description: string;
  readonly metadata: MeasurementWorkflowMetadata;
}

export interface MeasurementCycleTransitionError {
  readonly code: "invalid_measurement_cycle_transition";
  readonly message: string;
  readonly from: MeasurementCycleStatus;
  readonly to: MeasurementCycleStatus;
  readonly metadata: MeasurementWorkflowMetadata;
}

export interface MeasurementCycleTransitionFailure {
  readonly success: false;
  readonly error: MeasurementCycleTransitionError;
}
