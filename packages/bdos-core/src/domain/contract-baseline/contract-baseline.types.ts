import type { MoneyCents } from "../budget-version/budget-version-money";

export type ContractBaselineId = string;
export type OrganizationId = string;
export type EngineeringProjectId = string;
export type ProcurementCaseId = string;
export type ConsortiumId = string;
export type BudgetVersionId = string;

export enum ContractBaselineStatus {
  Draft = "Draft",
  InExecution = "InExecution",
  Suspended = "Suspended",
  Completed = "Completed",
  Cancelled = "Cancelled",
}

export interface ContractBaseline {
  readonly id: ContractBaselineId;
  readonly organizationId: OrganizationId;
  readonly engineeringProjectId: EngineeringProjectId;
  readonly procurementCaseId: ProcurementCaseId | null;
  readonly consortiumId: ConsortiumId | null;
  readonly sourceBudgetVersionId: BudgetVersionId | null;
  readonly contractNumber: string;
  readonly contractorNameSnapshot: string;
  readonly status: ContractBaselineStatus;

  // Autoridade monetária única em centavos inteiros
  readonly contractedValueCents: MoneyCents; // 761185165 para R$ 7.611.851,65
  readonly historicalOfficialBudgetCents: MoneyCents | null; // 980908718 para R$ 9.809.087,18

  // Campos com precisão sub-centavo (NUMERIC(20,8))
  readonly derivedItemsTotalDecimal: string; // "7611852.11454550"
  readonly contractualRoundingAdjustmentDecimal: string; // "-0.46454550"

  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface CreateContractBaselineInput {
  readonly id: ContractBaselineId;
  readonly organizationId: OrganizationId;
  readonly engineeringProjectId: EngineeringProjectId;
  readonly procurementCaseId?: ProcurementCaseId | null;
  readonly consortiumId?: ConsortiumId | null;
  readonly sourceBudgetVersionId?: BudgetVersionId | null;
  readonly contractNumber: string;
  readonly contractorNameSnapshot?: string;
  readonly contractorName?: string; // alias semântico aceito na entrada
  readonly status?: ContractBaselineStatus;

  readonly contractedValueCents: MoneyCents;
  readonly historicalOfficialBudgetCents?: MoneyCents | null;

  readonly derivedItemsTotalDecimal: string; // "7611852.11454550"
  readonly contractualRoundingAdjustmentDecimal: string; // "-0.46454550"

  readonly metadata?: Readonly<Record<string, unknown>>;
}
