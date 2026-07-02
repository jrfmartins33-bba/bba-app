import type { MeasuredRevenue } from "../revenue-recognition";
import { RecognitionStatus } from "../revenue-recognition";
import type {
  AdvanceInvoiceStatusInput,
  Invoice,
  InvoiceCreationError,
  InvoiceCreationResult,
  InvoiceCreationSuccess,
  InvoiceMetadata,
  InvoiceRequest,
  InvoiceTransitionError,
  InvoiceTransitionFailure,
  InvoiceTransitionResult,
} from "./invoice.types";
import { InvoiceStatus } from "./invoice.types";

export interface CreateInvoiceInput {
  readonly measuredRevenue: MeasuredRevenue;
  readonly invoiceRequest: InvoiceRequest;
  readonly metadata?: InvoiceMetadata;
}

export function createInvoice(input: CreateInvoiceInput): InvoiceCreationResult {
  const metadata = createInvoiceMetadata(input);
  const validationErrors = validateInvoiceCreation(input, metadata);

  if (validationErrors.length > 0) {
    return freezeDomainObject({
      success: false,
      invoice: null,
      errors: validationErrors,
      metadata,
    });
  }

  return freezeDomainObject<InvoiceCreationSuccess>({
    success: true,
    invoice: createInvoiceDocument(input, metadata),
    errors: [],
    metadata,
  });
}

export function advanceInvoiceStatus(
  input: AdvanceInvoiceStatusInput,
): InvoiceTransitionResult {
  if (!canAdvanceInvoiceStatus(input.invoice.status, input.toStatus)) {
    return freezeDomainObject<InvoiceTransitionFailure>({
      success: false,
      error: createTransitionError(input),
    });
  }

  return freezeDomainObject({
    success: true,
    invoice: {
      ...input.invoice,
      status: input.toStatus,
      metadata: {
        ...input.invoice.metadata,
        ...(input.metadata ?? {}),
        fromStatus: input.invoice.status,
        toStatus: input.toStatus,
      },
    },
  });
}

function validateInvoiceCreation(
  input: CreateInvoiceInput,
  metadata: InvoiceMetadata,
): ReadonlyArray<InvoiceCreationError> {
  const errors: InvoiceCreationError[] = [];

  if (input.measuredRevenue.recognitionStatus !== RecognitionStatus.Recognized) {
    errors.push(
      createCreationError(
        "measured_revenue_not_recognized",
        "measuredRevenue.recognitionStatus",
        "Only recognized measured revenue can generate an invoice.",
        metadata,
      ),
    );
  }

  if (input.invoiceRequest.grossAmount > input.measuredRevenue.certifiedAmount) {
    errors.push(
      createCreationError(
        "invoice_exceeds_certified_revenue",
        "invoiceRequest.grossAmount",
        "Invoice gross amount cannot exceed certified measured revenue.",
        metadata,
      ),
    );
  } else if (
    input.invoiceRequest.grossAmount !== input.measuredRevenue.certifiedAmount
  ) {
    errors.push(
      createCreationError(
        "invoice_value_mismatch",
        "invoiceRequest.grossAmount",
        "Invoice gross amount must equal certified measured revenue.",
        metadata,
      ),
    );
  }

  return errors;
}

function createInvoiceDocument(
  input: CreateInvoiceInput,
  metadata: InvoiceMetadata,
): Invoice {
  return {
    invoiceId: input.invoiceRequest.invoiceId,
    invoiceNumber: input.invoiceRequest.invoiceNumber,
    series: input.invoiceRequest.series,
    issueDate: input.invoiceRequest.issueDate,
    dueDate: input.invoiceRequest.dueDate,
    contractId: input.measuredRevenue.contractId,
    projectId: input.measuredRevenue.projectId,
    measurementCycleId: input.measuredRevenue.measurementCycleId,
    customerId: input.invoiceRequest.customerId,
    grossAmount: input.invoiceRequest.grossAmount,
    taxAmount: input.invoiceRequest.taxAmount,
    netAmount: input.invoiceRequest.grossAmount - input.invoiceRequest.taxAmount,
    currency: input.invoiceRequest.currency,
    status: input.invoiceRequest.status ?? InvoiceStatus.Draft,
    metadata,
  };
}

function canAdvanceInvoiceStatus(
  fromStatus: InvoiceStatus,
  toStatus: InvoiceStatus,
): boolean {
  return allowedTransitions[fromStatus] === toStatus;
}

function createTransitionError(
  input: AdvanceInvoiceStatusInput,
): InvoiceTransitionError {
  return {
    code: "invalid_invoice_transition",
    message: `Cannot transition invoice from ${input.invoice.status} to ${input.toStatus}.`,
    from: input.invoice.status,
    to: input.toStatus,
    metadata: {
      ...input.invoice.metadata,
      ...(input.metadata ?? {}),
      invoiceId: input.invoice.invoiceId,
      attemptedStatus: input.toStatus,
    },
  };
}

function createCreationError(
  code: InvoiceCreationError["code"],
  field: string,
  message: string,
  metadata: InvoiceMetadata,
): InvoiceCreationError {
  return {
    code,
    field,
    message,
    metadata,
  };
}

function createInvoiceMetadata(input: CreateInvoiceInput): InvoiceMetadata {
  return {
    ...input.measuredRevenue.metadata,
    ...(input.invoiceRequest.metadata ?? {}),
    ...(input.metadata ?? {}),
    measuredRevenueId: input.measuredRevenue.id,
    measurementCycleId: input.measuredRevenue.measurementCycleId,
    contractId: input.measuredRevenue.contractId,
    projectId: input.measuredRevenue.projectId,
    periodId: input.measuredRevenue.periodId,
    bulletinId: input.measuredRevenue.bulletinId,
    certificationId: input.measuredRevenue.certificationId,
    certifiedAmount: input.measuredRevenue.certifiedAmount,
    recognitionStatus: input.measuredRevenue.recognitionStatus,
  };
}

const allowedTransitions: Readonly<Record<InvoiceStatus, InvoiceStatus | null>> = {
  [InvoiceStatus.Draft]: InvoiceStatus.Generated,
  [InvoiceStatus.Generated]: InvoiceStatus.Approved,
  [InvoiceStatus.Approved]: InvoiceStatus.Cancelled,
  [InvoiceStatus.Cancelled]: null,
};

type FreezableRecord = Record<PropertyKey, unknown>;

function freezeDomainObject<T>(value: T): T {
  return freezeClonedDomainObject(cloneDomainValue(value));
}

function cloneDomainValue<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneDomainValue(item)) as T;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, property]) => [
      key,
      cloneDomainValue(property),
    ]),
  ) as T;
}

function freezeClonedDomainObject<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  Object.values(value as FreezableRecord).forEach((property) => {
    freezeClonedDomainObject(property);
  });

  return Object.freeze(value);
}
