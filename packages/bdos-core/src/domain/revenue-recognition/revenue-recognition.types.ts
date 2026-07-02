import type {
  ContractBaselineId,
  MeasurementDate,
  MeasurementMetadata,
  MeasurementPeriodId,
} from "../measurement";
import type {
  MeasurementBulletinId,
  MeasurementCertificationId,
  MeasurementCycleId,
  MeasurementProjectId,
} from "../measurement-workflow";

export type MeasuredRevenueId = string;

export type RevenueRecognitionMetadata = MeasurementMetadata;

export type RevenueRecognitionSource = "certified_measurement_cycle";

export enum RecognitionStatus {
  PendingCertification = "pending_certification",
  Recognized = "recognized",
  Blocked = "blocked",
  Cancelled = "cancelled",
}

export interface MeasuredRevenue {
  readonly id: MeasuredRevenueId;
  readonly measurementCycleId: MeasurementCycleId;
  readonly contractId: ContractBaselineId;
  readonly projectId: MeasurementProjectId;
  readonly periodId: MeasurementPeriodId;
  readonly bulletinId: MeasurementBulletinId;
  readonly certificationId: MeasurementCertificationId;
  readonly revenueDate: MeasurementDate;
  readonly grossAmount: number;
  readonly certifiedAmount: number;
  readonly recognitionStatus: RecognitionStatus;
  readonly source: RevenueRecognitionSource;
  readonly metadata: RevenueRecognitionMetadata;
}

export type RevenueRecognitionErrorCode =
  | "measurement_cycle_not_certified"
  | "missing_certification"
  | "certification_not_certified"
  | "missing_certified_bulletin";

export interface RevenueRecognitionError {
  readonly code: RevenueRecognitionErrorCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: RevenueRecognitionMetadata;
}

export type RevenueRecognitionWarningCode = "none";

export interface RevenueRecognitionWarning {
  readonly code: RevenueRecognitionWarningCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: RevenueRecognitionMetadata;
}
