import type { MeasurementEntryId } from "../measurement-entry";
import type {
  MeasurementCorrelationId,
  MeasurementMetadata,
  MeasurementPeriod,
  ServiceItem,
} from "../measurement";
import type { MeasurementExecution } from "../measurement-engine";

export type MeasurementEntryProcessorMetadata = MeasurementMetadata;

export type MeasurementEntryProcessorErrorCode =
  | "empty_measurement_entries"
  | "missing_measurement_period"
  | "duplicate_measurement_entry"
  | "missing_service_item"
  | "different_contract"
  | "different_measurement_period";

export interface MeasurementEntryProcessorError {
  readonly code: MeasurementEntryProcessorErrorCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: MeasurementEntryProcessorMetadata;
}

export type MeasurementEntryProcessorWarningCode = "no_accepted_entries";

export interface MeasurementEntryProcessorWarning {
  readonly code: MeasurementEntryProcessorWarningCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: MeasurementEntryProcessorMetadata;
}

export interface CreateMeasurementExecutionsInput {
  readonly measurementEntries: ReadonlyArray<import("../measurement-entry").MeasurementEntry>;
  readonly serviceItems: ReadonlyArray<ServiceItem>;
  readonly measurementPeriod?: MeasurementPeriod | null;
  readonly metadata?: MeasurementEntryProcessorMetadata;
}

export interface MeasurementEntryProcessorSuccess {
  readonly success: true;
  readonly measurementExecutions: ReadonlyArray<MeasurementExecution>;
  readonly errors: ReadonlyArray<MeasurementEntryProcessorError>;
  readonly warnings: ReadonlyArray<MeasurementEntryProcessorWarning>;
  readonly metadata: MeasurementEntryProcessorMetadata;
}

export interface MeasurementEntryProcessorFailure {
  readonly success: false;
  readonly measurementExecutions: ReadonlyArray<MeasurementExecution>;
  readonly errors: ReadonlyArray<MeasurementEntryProcessorError>;
  readonly warnings: ReadonlyArray<MeasurementEntryProcessorWarning>;
  readonly metadata: MeasurementEntryProcessorMetadata;
}

export type MeasurementEntryProcessorResult =
  | MeasurementEntryProcessorSuccess
  | MeasurementEntryProcessorFailure;

export interface MeasurementEntryGroupMetadata {
  readonly entryIds: ReadonlyArray<MeasurementEntryId>;
  readonly entryCount: number;
  readonly correlationIds: ReadonlyArray<MeasurementCorrelationId>;
}
