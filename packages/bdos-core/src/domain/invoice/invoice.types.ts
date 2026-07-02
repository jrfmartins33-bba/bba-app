import type {
  ContractBaselineId,
  MeasurementDate,
  MeasurementMetadata,
} from "../measurement";
import type {
  MeasurementCycleId,
  MeasurementProjectId,
} from "../measurement-workflow";
import type { MeasuredRevenueId } from "../revenue-recognition";

export type InvoiceId = string;

export type InvoiceNumber = string;

export type InvoiceSeries = string;

export type InvoiceCustomerId = string;

export type InvoiceCurrency = string;

export type InvoiceMetadata = MeasurementMetadata;

export enum InvoiceStatus {
  Draft = "draft",
  Generated = "generated",
  Approved = "approved",
  Cancelled = "cancelled",
}

export interface Invoice {
  readonly invoiceId: InvoiceId;
  readonly invoiceNumber: InvoiceNumber;
  readonly series: InvoiceSeries;
  readonly issueDate: MeasurementDate;
  readonly dueDate: MeasurementDate;
  readonly contractId: ContractBaselineId;
  readonly projectId: MeasurementProjectId;
  readonly measurementCycleId: MeasurementCycleId;
  readonly customerId: InvoiceCustomerId;
  readonly grossAmount: number;
  readonly taxAmount: number;
  readonly netAmount: number;
  readonly currency: InvoiceCurrency;
  readonly status: InvoiceStatus;
  readonly metadata: InvoiceMetadata;
}

export interface InvoiceRequest {
  readonly invoiceId: InvoiceId;
  readonly invoiceNumber: InvoiceNumber;
  readonly series: InvoiceSeries;
  readonly issueDate: MeasurementDate;
  readonly dueDate: MeasurementDate;
  readonly customerId: InvoiceCustomerId;
  readonly grossAmount: number;
  readonly taxAmount: number;
  readonly currency: InvoiceCurrency;
  readonly status?: InvoiceStatus;
  readonly metadata?: InvoiceMetadata;
}

export type InvoiceCreationErrorCode =
  | "measured_revenue_not_recognized"
  | "invoice_exceeds_certified_revenue"
  | "invoice_value_mismatch";

export interface InvoiceCreationError {
  readonly code: InvoiceCreationErrorCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: InvoiceMetadata;
}

export interface InvoiceCreationSuccess {
  readonly success: true;
  readonly invoice: Invoice;
  readonly errors: ReadonlyArray<InvoiceCreationError>;
  readonly metadata: InvoiceMetadata;
}

export interface InvoiceCreationFailure {
  readonly success: false;
  readonly invoice: null;
  readonly errors: ReadonlyArray<InvoiceCreationError>;
  readonly metadata: InvoiceMetadata;
}

export type InvoiceCreationResult =
  | InvoiceCreationSuccess
  | InvoiceCreationFailure;

export interface InvoiceTransitionError {
  readonly code: "invalid_invoice_transition";
  readonly message: string;
  readonly from: InvoiceStatus;
  readonly to: InvoiceStatus;
  readonly metadata: InvoiceMetadata;
}

export interface InvoiceTransitionSuccess {
  readonly success: true;
  readonly invoice: Invoice;
}

export interface InvoiceTransitionFailure {
  readonly success: false;
  readonly error: InvoiceTransitionError;
}

export type InvoiceTransitionResult =
  | InvoiceTransitionSuccess
  | InvoiceTransitionFailure;

export interface AdvanceInvoiceStatusInput {
  readonly invoice: Invoice;
  readonly toStatus: InvoiceStatus;
  readonly metadata?: InvoiceMetadata;
}

export interface InvoiceTraceabilityMetadata {
  readonly measuredRevenueId: MeasuredRevenueId;
  readonly contractId: ContractBaselineId;
  readonly projectId: MeasurementProjectId;
  readonly measurementCycleId: MeasurementCycleId;
}
