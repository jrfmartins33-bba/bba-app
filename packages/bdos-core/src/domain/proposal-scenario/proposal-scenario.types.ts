import type { BudgetVersion, MoneyCents } from "../budget-version";

export const PROPOSAL_SCENARIO_CALCULATION_METHOD = "target_value_v1" as const;

export enum ProposalScenarioComparisonKind {
  Reduction = "Reduction",
  Increase = "Increase",
  Equal = "Equal",
}

export interface ProposalScenario {
  readonly id: string;
  readonly organizationId: string;
  readonly sourceBudgetVersionId: string;
  readonly sourceBudgetVersionRevision: number;
  readonly name: string;
  readonly officialValueCents: MoneyCents;
  readonly targetValueCents: MoneyCents;
  readonly differenceCents: MoneyCents;
  /** Percentual de apresentação em pontos-base, preservado como inteiro decimal em texto. */
  readonly differenceBasisPoints: string;
  readonly comparisonKind: ProposalScenarioComparisonKind;
  readonly calculationMethod: typeof PROPOSAL_SCENARIO_CALCULATION_METHOD;
  readonly parameters: {
    readonly authority: "target_value_cents";
    readonly targetValueCents: MoneyCents;
  };
  readonly createdBy: string;
  readonly createdAt: string;
}

export interface CreateProposalScenarioInput {
  readonly id: string;
  readonly organizationId: string;
  readonly sourceBudgetVersion: BudgetVersion;
  readonly sourceBudgetVersionRevision: number;
  readonly name: string;
  readonly targetValueCents: MoneyCents;
  readonly createdBy: string;
  readonly createdAt: string;
}

export type ProposalScenarioErrorCode =
  | "missing_id"
  | "missing_name"
  | "invalid_name"
  | "organization_mismatch"
  | "source_not_consolidated"
  | "invalid_source_revision"
  | "invalid_official_value"
  | "invalid_target_value"
  | "missing_actor"
  | "invalid_timestamp";

export interface ProposalScenarioError {
  readonly code: ProposalScenarioErrorCode;
  readonly field: string;
  readonly message: string;
}

export type ProposalScenarioResult =
  | { readonly success: true; readonly scenario: ProposalScenario; readonly errors: ReadonlyArray<never> }
  | { readonly success: false; readonly scenario: null; readonly errors: ReadonlyArray<ProposalScenarioError> };
