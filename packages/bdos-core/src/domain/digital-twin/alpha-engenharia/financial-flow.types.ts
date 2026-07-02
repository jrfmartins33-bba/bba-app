import type {
  AlphaEngenhariaDate,
  AlphaEngenhariaId,
  AlphaEngenhariaMeasurement,
  AlphaEngenhariaMetadata,
  AlphaEngenhariaMoney,
} from "./alpha-engenharia.types";

export type AlphaInvoiceStatus = "draft" | "issued" | "approved" | "cancelled";

export type AlphaAccountsReceivableStatus =
  | "open"
  | "overdue"
  | "partially_received"
  | "received"
  | "cancelled";

export type AlphaCashFlowSignalDirection = "inflow" | "outflow";

export type AlphaCashFlowSignalCertainty = "confirmed" | "expected" | "at_risk";

export type AlphaCashFlowSignalSourceType = "accounts_receivable";

export type AlphaCashFlowSignalCategory =
  | "customer_receipt"
  | "retention_release"
  | "financing"
  | "supplier_payment"
  | "payroll"
  | "project_cost";

export interface AlphaInvoice {
  readonly id: AlphaEngenhariaId;
  readonly measurementId: AlphaEngenhariaId;
  readonly contractId: AlphaEngenhariaId;
  readonly projectId: AlphaEngenhariaId;
  readonly customerId: AlphaEngenhariaId;
  readonly issueDate: AlphaEngenhariaDate;
  readonly dueDate: AlphaEngenhariaDate;
  readonly grossAmount: AlphaEngenhariaMoney;
  readonly retentionAmount: AlphaEngenhariaMoney;
  readonly netAmount: AlphaEngenhariaMoney;
  readonly status: AlphaInvoiceStatus;
  readonly metadata: AlphaEngenhariaMetadata;
}

export interface AlphaAccountsReceivable {
  readonly id: AlphaEngenhariaId;
  readonly invoiceId: AlphaEngenhariaId;
  readonly customerId: AlphaEngenhariaId;
  readonly dueDate: AlphaEngenhariaDate;
  readonly expectedReceiptDate: AlphaEngenhariaDate;
  readonly amount: AlphaEngenhariaMoney;
  readonly status: AlphaAccountsReceivableStatus;
  readonly daysPastDue: number;
  readonly metadata: AlphaEngenhariaMetadata;
}

export interface AlphaCashFlowSignal {
  readonly id: AlphaEngenhariaId;
  readonly sourceType: AlphaCashFlowSignalSourceType;
  readonly sourceId: AlphaEngenhariaId;
  readonly date: AlphaEngenhariaDate;
  readonly direction: AlphaCashFlowSignalDirection;
  readonly amount: AlphaEngenhariaMoney;
  readonly category: AlphaCashFlowSignalCategory;
  readonly description: string;
  readonly certainty: AlphaCashFlowSignalCertainty;
  readonly metadata: AlphaEngenhariaMetadata;
}

export interface AlphaMeasurementFinancialFlow {
  readonly measurement: AlphaEngenhariaMeasurement;
  readonly invoice: AlphaInvoice;
  readonly accountsReceivable: AlphaAccountsReceivable;
  readonly cashFlowSignal: AlphaCashFlowSignal;
}

export interface AlphaFinancialFlowValidationError {
  readonly field: string;
  readonly message: string;
}

export interface CreateMeasurementFinancialFlowInput {
  readonly measurement: AlphaEngenhariaMeasurement;
  readonly invoice: AlphaInvoice;
  readonly accountsReceivable: AlphaAccountsReceivable;
  readonly cashFlowSignal: AlphaCashFlowSignal;
}

export interface CreateMeasurementFinancialFlowSuccess {
  readonly success: true;
  readonly financialFlow: AlphaMeasurementFinancialFlow;
}

export interface CreateMeasurementFinancialFlowFailure {
  readonly success: false;
  readonly errors: ReadonlyArray<AlphaFinancialFlowValidationError>;
}

export type CreateMeasurementFinancialFlowResult =
  | CreateMeasurementFinancialFlowSuccess
  | CreateMeasurementFinancialFlowFailure;
