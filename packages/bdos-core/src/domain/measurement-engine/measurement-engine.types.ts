import type {
  ContractBaselineId,
  MeasurementCorrelationId,
  MeasurementDate,
  MeasurementEvidenceReference,
  MeasurementMemoryId,
  MeasurementMetadata,
  MeasurementMoney,
  MeasurementPeriodId,
  MeasurementQuantity,
  ServiceItemId,
  WorkPackageId,
} from "../measurement";

export type MeasurementEngineer = string;

export type MeasurementWarningCode =
  | "remaining_quantity_below_zero"
  | "measurement_exceeds_contract"
  | "zero_quantity"
  | "negative_quantity"
  | "measurement_outside_period"
  | "duplicate_evidence_reference"
  | "contract_id_mismatch"
  | "work_package_id_mismatch"
  | "service_item_id_mismatch"
  | "measurement_period_contract_mismatch";

export interface MeasurementWarning {
  readonly code: MeasurementWarningCode;
  readonly field: string;
  readonly message: string;
  readonly metadata: MeasurementMetadata;
}

export interface MeasurementExecution {
  readonly id: MeasurementMemoryId;
  readonly contractId: ContractBaselineId;
  readonly workPackageId: WorkPackageId;
  readonly serviceItemId: ServiceItemId;
  readonly measurementPeriodId: MeasurementPeriodId;
  readonly executedQuantity: MeasurementQuantity;
  readonly measurementDate: MeasurementDate;
  readonly engineer: MeasurementEngineer;
  readonly evidenceReferences: ReadonlyArray<MeasurementEvidenceReference>;
  readonly correlationId: MeasurementCorrelationId;
  readonly metadata: MeasurementMetadata;
}

export interface MeasurementValidationResult {
  readonly valid: boolean;
  readonly warnings: ReadonlyArray<MeasurementWarning>;
  readonly metadata: MeasurementMetadata;
}

export type MeasurementCalculatedValue = MeasurementMoney;
