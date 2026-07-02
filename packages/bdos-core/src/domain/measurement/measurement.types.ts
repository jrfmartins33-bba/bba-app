export type MeasurementMetadata = Readonly<Record<string, unknown>>;

export type MeasurementCorrelationId = string;

export type ContractBaselineId = string;

export type ContractNumber = string;

export type ContractName = string;

export type ContractParty = string;

export type MeasurementDate = string;

export type WorkPackageId = string;

export type WorkPackageCode = string;

export type WorkPackageName = string;

export type ServiceItemId = string;

export type ServiceItemCode = string;

export type ServiceItemDescription = string;

export type MeasurementUnit = string;

export type MeasurementCatalogId = string;

export type MeasurementMemoryId = string;

export type MeasurementPeriodId = string;

export type MeasurementQuantity = number;

export type MeasurementMoney = number;

export interface MeasurementDimension {
  readonly value: MeasurementQuantity;
  readonly unit: MeasurementUnit;
  readonly metadata: MeasurementMetadata;
}

export interface MeasurementStation {
  readonly initial: string;
  readonly final: string;
  readonly distance?: MeasurementDimension;
  readonly metadata: MeasurementMetadata;
}

export interface MeasurementCoordinate {
  readonly latitude: number;
  readonly longitude: number;
  readonly elevation?: number;
  readonly metadata: MeasurementMetadata;
}

export interface MeasurementGeometry {
  readonly type: string;
  readonly description: string;
  readonly dimensions: ReadonlyArray<MeasurementDimension>;
  readonly metadata: MeasurementMetadata;
}

export interface MeasurementCalculationReference {
  readonly id: string;
  readonly description: string;
  readonly formula?: string;
  readonly metadata: MeasurementMetadata;
}

export interface MeasurementEvidenceReference {
  readonly id: string;
  readonly type: string;
  readonly description?: string;
  readonly uri?: string;
  readonly metadata: MeasurementMetadata;
}
