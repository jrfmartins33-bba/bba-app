import type {
  ContractBaselineId,
  MeasurementCorrelationId,
  MeasurementDate,
  MeasurementEvidenceReference,
  MeasurementMetadata,
  MeasurementPeriodId,
  MeasurementQuantity,
  MeasurementUnit,
  ServiceItemId,
  WorkPackageId,
} from "../measurement";
import type { MeasurementProjectId } from "../measurement-workflow";

export type MeasurementEntryId = string;

export type MeasurementEntryEngineerId = string;

export type MeasurementEntryEngineerName = string;

export type MeasurementEntryNotes = string;

export type MeasurementEntryMetadata = MeasurementMetadata;

export enum MeasurementEntryStatus {
  Draft = "draft",
  Submitted = "submitted",
  Rejected = "rejected",
  Accepted = "accepted",
  Cancelled = "cancelled",
}

export interface MeasurementEntry {
  readonly id: MeasurementEntryId;
  readonly contractId: ContractBaselineId;
  readonly projectId: MeasurementProjectId;
  readonly workPackageId: WorkPackageId;
  readonly serviceItemId: ServiceItemId;
  readonly measurementPeriodId: MeasurementPeriodId;
  readonly quantity: MeasurementQuantity;
  readonly unit: MeasurementUnit;
  readonly entryDate: MeasurementDate;
  readonly engineerId: MeasurementEntryEngineerId;
  readonly engineerName: MeasurementEntryEngineerName;
  readonly evidenceReferences: ReadonlyArray<MeasurementEvidenceReference>;
  readonly notes: MeasurementEntryNotes;
  readonly status: MeasurementEntryStatus;
  readonly metadata: MeasurementEntryMetadata;
}

export interface CreateMeasurementEntryInput {
  readonly id: MeasurementEntryId;
  readonly contractId: ContractBaselineId;
  readonly projectId: MeasurementProjectId;
  readonly workPackageId: WorkPackageId;
  readonly serviceItemId: ServiceItemId;
  readonly measurementPeriodId: MeasurementPeriodId;
  readonly quantity: MeasurementQuantity;
  readonly unit: MeasurementUnit;
  readonly entryDate: MeasurementDate;
  readonly engineerId: MeasurementEntryEngineerId;
  readonly engineerName: MeasurementEntryEngineerName;
  readonly evidenceReferences?: ReadonlyArray<MeasurementEvidenceReference>;
  readonly notes?: MeasurementEntryNotes;
  readonly status?: MeasurementEntryStatus;
  readonly correlationId: MeasurementCorrelationId;
  readonly metadata?: MeasurementEntryMetadata;
}

export type MeasurementEntryErrorCode =
  | "invalid_quantity"
  | "missing_required_reference"
  | "missing_engineer_data";

export interface MeasurementEntryError {
  readonly code: MeasurementEntryErrorCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: MeasurementEntryMetadata;
}

export type MeasurementEntryWarningCode = "none";

export interface MeasurementEntryWarning {
  readonly code: MeasurementEntryWarningCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: MeasurementEntryMetadata;
}

export interface MeasurementEntrySuccess {
  readonly success: true;
  readonly entry: MeasurementEntry;
  readonly errors: ReadonlyArray<MeasurementEntryError>;
  readonly warnings: ReadonlyArray<MeasurementEntryWarning>;
  readonly metadata: MeasurementEntryMetadata;
}

export interface MeasurementEntryFailure {
  readonly success: false;
  readonly entry: null;
  readonly errors: ReadonlyArray<MeasurementEntryError>;
  readonly warnings: ReadonlyArray<MeasurementEntryWarning>;
  readonly metadata: MeasurementEntryMetadata;
}

export type MeasurementEntryResult =
  | MeasurementEntrySuccess
  | MeasurementEntryFailure;

export interface MeasurementEntryTransitionError {
  readonly code: "invalid_measurement_entry_transition";
  readonly message: string;
  readonly from: MeasurementEntryStatus;
  readonly to: MeasurementEntryStatus;
  readonly metadata: MeasurementEntryMetadata;
}

export interface MeasurementEntryTransitionSuccess {
  readonly success: true;
  readonly entry: MeasurementEntry;
}

export interface MeasurementEntryTransitionFailure {
  readonly success: false;
  readonly error: MeasurementEntryTransitionError;
}

export type MeasurementEntryTransitionResult =
  | MeasurementEntryTransitionSuccess
  | MeasurementEntryTransitionFailure;

export interface AdvanceMeasurementEntryStatusInput {
  readonly entry: MeasurementEntry;
  readonly toStatus: MeasurementEntryStatus;
  readonly metadata?: MeasurementEntryMetadata;
}
