import type {
  ContractBaselineId,
  MeasurementDate,
  MeasurementMetadata,
} from "../measurement";
import type { MeasurementProjectId } from "../measurement-workflow";
import type {
  InvoiceCustomerId,
  InvoiceCurrency,
  InvoiceId,
  InvoiceNumber,
} from "../invoice";

export type AccountsReceivableId = string;

export type AccountsReceivableMetadata = MeasurementMetadata;

export enum AccountsReceivableStatus {
  Open = "open",
  Overdue = "overdue",
  PartiallyReceived = "partially_received",
  Received = "received",
  Cancelled = "cancelled",
}

export enum ReceivableRiskLevel {
  Low = "low",
  Medium = "medium",
  High = "high",
  Critical = "critical",
}

export interface AccountsReceivable {
  readonly id: AccountsReceivableId;
  readonly invoiceId: InvoiceId;
  readonly invoiceNumber: InvoiceNumber;
  readonly contractId: ContractBaselineId;
  readonly projectId: MeasurementProjectId;
  readonly customerId: InvoiceCustomerId;
  readonly issueDate: MeasurementDate;
  readonly dueDate: MeasurementDate;
  readonly expectedReceiptDate: MeasurementDate;
  readonly amount: number;
  readonly currency: InvoiceCurrency;
  readonly status: AccountsReceivableStatus;
  readonly daysPastDue: number;
  readonly riskLevel: ReceivableRiskLevel;
  readonly metadata: AccountsReceivableMetadata;
}

export type AccountsReceivableErrorCode =
  | "invoice_not_approved"
  | "non_positive_receivable_amount";

export interface AccountsReceivableError {
  readonly code: AccountsReceivableErrorCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: AccountsReceivableMetadata;
}

export type AccountsReceivableWarningCode = "none";

export interface AccountsReceivableWarning {
  readonly code: AccountsReceivableWarningCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: AccountsReceivableMetadata;
}

export interface AccountsReceivableSuccess {
  readonly success: true;
  readonly receivable: AccountsReceivable;
  readonly errors: ReadonlyArray<AccountsReceivableError>;
  readonly warnings: ReadonlyArray<AccountsReceivableWarning>;
  readonly metadata: AccountsReceivableMetadata;
}

export interface AccountsReceivableFailure {
  readonly success: false;
  readonly receivable: null;
  readonly errors: ReadonlyArray<AccountsReceivableError>;
  readonly warnings: ReadonlyArray<AccountsReceivableWarning>;
  readonly metadata: AccountsReceivableMetadata;
}

export type AccountsReceivableResult =
  | AccountsReceivableSuccess
  | AccountsReceivableFailure;

export interface AccountsReceivableTransitionError {
  readonly code: "invalid_accounts_receivable_transition";
  readonly message: string;
  readonly from: AccountsReceivableStatus;
  readonly to: AccountsReceivableStatus;
  readonly metadata: AccountsReceivableMetadata;
}

export interface AccountsReceivableTransitionSuccess {
  readonly success: true;
  readonly receivable: AccountsReceivable;
}

export interface AccountsReceivableTransitionFailure {
  readonly success: false;
  readonly error: AccountsReceivableTransitionError;
}

export type AccountsReceivableTransitionResult =
  | AccountsReceivableTransitionSuccess
  | AccountsReceivableTransitionFailure;

export interface AdvanceAccountsReceivableStatusInput {
  readonly receivable: AccountsReceivable;
  readonly toStatus: AccountsReceivableStatus;
  readonly metadata?: AccountsReceivableMetadata;
}
