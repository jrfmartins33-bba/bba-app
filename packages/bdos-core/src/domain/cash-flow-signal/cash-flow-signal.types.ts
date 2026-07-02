import type {
  ContractBaselineId,
  MeasurementDate,
  MeasurementMetadata,
} from "../measurement";
import type { MeasurementProjectId } from "../measurement-workflow";
import type {
  AccountsReceivableId,
  ReceivableRiskLevel,
} from "../accounts-receivable";
import type { InvoiceCurrency, InvoiceCustomerId } from "../invoice";

export type CashFlowSignalId = string;

export type CashFlowSignalMetadata = MeasurementMetadata;

export type CashFlowSignalSourceType = "accounts_receivable";

export enum CashFlowSignalDirection {
  Inflow = "inflow",
  Outflow = "outflow",
}

export enum CashFlowSignalCertainty {
  Confirmed = "confirmed",
  Expected = "expected",
  AtRisk = "at_risk",
}

export enum CashFlowSignalCategory {
  Receivable = "receivable",
  Payable = "payable",
  Payroll = "payroll",
  Tax = "tax",
  Capex = "capex",
  Opex = "opex",
  Financing = "financing",
}

export interface CashFlowSignal {
  readonly id: CashFlowSignalId;
  readonly sourceType: CashFlowSignalSourceType;
  readonly sourceId: AccountsReceivableId;
  readonly contractId: ContractBaselineId;
  readonly projectId: MeasurementProjectId;
  readonly customerId: InvoiceCustomerId;
  readonly date: MeasurementDate;
  readonly direction: CashFlowSignalDirection;
  readonly amount: number;
  readonly currency: InvoiceCurrency;
  readonly category: CashFlowSignalCategory;
  readonly certainty: CashFlowSignalCertainty;
  readonly riskLevel: ReceivableRiskLevel;
  readonly metadata: CashFlowSignalMetadata;
}

export type CashFlowSignalErrorCode =
  | "cancelled_receivable"
  | "non_positive_signal_amount";

export interface CashFlowSignalError {
  readonly code: CashFlowSignalErrorCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: CashFlowSignalMetadata;
}

export type CashFlowSignalWarningCode = "overdue_confirmed_inflow";

export interface CashFlowSignalWarning {
  readonly code: CashFlowSignalWarningCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: CashFlowSignalMetadata;
}

export interface CashFlowSignalSuccess {
  readonly success: true;
  readonly signal: CashFlowSignal;
  readonly errors: ReadonlyArray<CashFlowSignalError>;
  readonly warnings: ReadonlyArray<CashFlowSignalWarning>;
  readonly metadata: CashFlowSignalMetadata;
}

export interface CashFlowSignalFailure {
  readonly success: false;
  readonly signal: null;
  readonly errors: ReadonlyArray<CashFlowSignalError>;
  readonly warnings: ReadonlyArray<CashFlowSignalWarning>;
  readonly metadata: CashFlowSignalMetadata;
}

export type CashFlowSignalResult =
  | CashFlowSignalSuccess
  | CashFlowSignalFailure;
