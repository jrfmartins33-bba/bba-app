import type { MeasurementCycleStatus } from "../measurement-workflow";

export type MeasurementDecimalInput = string | number | bigint;

export type CanonicalMeasurementDecimal = string & {
  readonly __canonicalMeasurementDecimal: unique symbol;
};

export enum MeasurementDecimalQuantizationMode {
  RoundHalfAwayFromZero = "round_half_away_from_zero",
  TruncateTowardZero = "truncate_toward_zero",
}

export interface MeasurementMonetaryPolicy {
  readonly key: string;
  readonly scale: number;
  readonly quantizationMode: MeasurementDecimalQuantizationMode;
}

export interface MeasurementSourceDecimal {
  readonly raw: string;
  readonly canonical: CanonicalMeasurementDecimal;
  readonly scale: number;
}

export interface MeasurementScopeReference {
  readonly organizationId: string;
  readonly projectId: string;
}

export interface MeasurementWorkspaceLineScopeInput {
  readonly workspace: MeasurementScopeReference;
  readonly operationalItem: MeasurementScopeReference;
}

export type MeasurementWorkspaceLineScopeError =
  | "organization_mismatch"
  | "project_mismatch";

export interface MeasurementWorkspaceLineScopeValidation {
  readonly valid: boolean;
  readonly errors: ReadonlyArray<MeasurementWorkspaceLineScopeError>;
}

export interface MeasurementWorkspaceLineIdentity {
  readonly workspaceId: string;
  readonly operationalItemId: string;
}

export interface MeasurementWorkspaceLineCardinalityValidation {
  readonly valid: boolean;
  readonly duplicatePairs: ReadonlyArray<MeasurementWorkspaceLineIdentity>;
}

export interface MeasurementProjectAuthorityInput {
  readonly relationalProjectId: string;
  readonly legacyEvidenceProjectId?: string | null;
}

export interface MeasurementProjectAuthority {
  readonly projectId: string;
  readonly legacyEvidenceProjectId: string | null;
  readonly provenanceMismatch: boolean;
}

export interface MeasurementPeriodContribution {
  readonly periodId: string;
  readonly cycleStatus: MeasurementCycleStatus | null;
  readonly quantity: MeasurementDecimalInput;
  readonly value: MeasurementDecimalInput;
}

export interface BuildCertifiedMeasurementItemAggregateInput {
  readonly targetPeriodId: string;
  readonly contractQuantity: MeasurementDecimalInput;
  readonly contractedValue: MeasurementDecimalInput;
  readonly contributions: ReadonlyArray<MeasurementPeriodContribution>;
  readonly quantityScale: number;
  readonly moneyScale: number;
}

export interface CertifiedMeasurementItemAggregate {
  readonly contractQuantity: CanonicalMeasurementDecimal;
  readonly measuredPeriodQuantity: CanonicalMeasurementDecimal;
  readonly certifiedPeriodQuantity: CanonicalMeasurementDecimal;
  readonly certifiedAccumulatedQuantity: CanonicalMeasurementDecimal;
  readonly quantityBalance: CanonicalMeasurementDecimal;
  readonly certifiedPeriodValue: CanonicalMeasurementDecimal;
  readonly certifiedAccumulatedValue: CanonicalMeasurementDecimal;
  readonly contractedValue: CanonicalMeasurementDecimal;
  readonly financialBalance: CanonicalMeasurementDecimal;
}
