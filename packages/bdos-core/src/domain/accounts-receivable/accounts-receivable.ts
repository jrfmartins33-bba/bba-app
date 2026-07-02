import type { MeasurementDate } from "../measurement";
import type { Invoice } from "../invoice";
import { InvoiceStatus } from "../invoice";
import type {
  AccountsReceivable,
  AccountsReceivableError,
  AccountsReceivableMetadata,
  AccountsReceivableResult,
  AccountsReceivableSuccess,
  AccountsReceivableTransitionError,
  AccountsReceivableTransitionFailure,
  AccountsReceivableTransitionResult,
  AccountsReceivableWarning,
  AdvanceAccountsReceivableStatusInput,
  ReceivableRiskLevel,
} from "./accounts-receivable.types";
import { AccountsReceivableStatus } from "./accounts-receivable.types";

export interface CreateAccountsReceivableInput {
  readonly invoice: Invoice;
  readonly id: string;
  readonly expectedReceiptDate: MeasurementDate;
  readonly daysPastDue: number;
  readonly riskLevel: ReceivableRiskLevel;
  readonly metadata?: AccountsReceivableMetadata;
}

export function createAccountsReceivable(
  input: CreateAccountsReceivableInput,
): AccountsReceivableResult {
  const metadata = createAccountsReceivableMetadata(input);
  const errors = validateAccountsReceivableCreation(input, metadata);

  if (errors.length > 0) {
    return freezeDomainObject({
      success: false,
      receivable: null,
      errors,
      warnings: [],
      metadata,
    });
  }

  return freezeDomainObject<AccountsReceivableSuccess>({
    success: true,
    receivable: createReceivable(input, metadata),
    errors: [],
    warnings: [],
    metadata,
  });
}

export function advanceAccountsReceivableStatus(
  input: AdvanceAccountsReceivableStatusInput,
): AccountsReceivableTransitionResult {
  if (!canAdvanceAccountsReceivableStatus(input.receivable.status, input.toStatus)) {
    return freezeDomainObject<AccountsReceivableTransitionFailure>({
      success: false,
      error: createTransitionError(input),
    });
  }

  return freezeDomainObject({
    success: true,
    receivable: {
      ...input.receivable,
      status: input.toStatus,
      metadata: {
        ...input.receivable.metadata,
        ...(input.metadata ?? {}),
        fromStatus: input.receivable.status,
        toStatus: input.toStatus,
      },
    },
  });
}

function validateAccountsReceivableCreation(
  input: CreateAccountsReceivableInput,
  metadata: AccountsReceivableMetadata,
): ReadonlyArray<AccountsReceivableError> {
  const errors: AccountsReceivableError[] = [];

  if (input.invoice.status !== InvoiceStatus.Approved) {
    errors.push(
      createAccountsReceivableError(
        "invoice_not_approved",
        "invoice.status",
        "Only approved invoices can create accounts receivable.",
        metadata,
      ),
    );
  }

  if (input.invoice.netAmount <= 0) {
    errors.push(
      createAccountsReceivableError(
        "non_positive_receivable_amount",
        "invoice.netAmount",
        "Accounts receivable amount must be greater than zero.",
        metadata,
      ),
    );
  }

  return errors;
}

function createReceivable(
  input: CreateAccountsReceivableInput,
  metadata: AccountsReceivableMetadata,
): AccountsReceivable {
  return {
    id: input.id,
    invoiceId: input.invoice.invoiceId,
    invoiceNumber: input.invoice.invoiceNumber,
    contractId: input.invoice.contractId,
    projectId: input.invoice.projectId,
    customerId: input.invoice.customerId,
    issueDate: input.invoice.issueDate,
    dueDate: input.invoice.dueDate,
    expectedReceiptDate: input.expectedReceiptDate,
    amount: input.invoice.netAmount,
    currency: input.invoice.currency,
    status: AccountsReceivableStatus.Open,
    daysPastDue: input.daysPastDue,
    riskLevel: input.riskLevel,
    metadata,
  };
}

function canAdvanceAccountsReceivableStatus(
  fromStatus: AccountsReceivableStatus,
  toStatus: AccountsReceivableStatus,
): boolean {
  return allowedTransitions[fromStatus].includes(toStatus);
}

function createTransitionError(
  input: AdvanceAccountsReceivableStatusInput,
): AccountsReceivableTransitionError {
  return {
    code: "invalid_accounts_receivable_transition",
    message: `Cannot transition accounts receivable from ${input.receivable.status} to ${input.toStatus}.`,
    from: input.receivable.status,
    to: input.toStatus,
    metadata: {
      ...input.receivable.metadata,
      ...(input.metadata ?? {}),
      accountsReceivableId: input.receivable.id,
      invoiceId: input.receivable.invoiceId,
      attemptedStatus: input.toStatus,
    },
  };
}

function createAccountsReceivableError(
  code: AccountsReceivableError["code"],
  field: string,
  message: string,
  metadata: AccountsReceivableMetadata,
): AccountsReceivableError {
  return {
    code,
    field,
    message,
    metadata,
  };
}

function createAccountsReceivableMetadata(
  input: CreateAccountsReceivableInput,
): AccountsReceivableMetadata {
  return {
    ...input.invoice.metadata,
    ...(input.metadata ?? {}),
    accountsReceivableId: input.id,
    invoiceId: input.invoice.invoiceId,
    invoiceNumber: input.invoice.invoiceNumber,
    contractId: input.invoice.contractId,
    projectId: input.invoice.projectId,
    customerId: input.invoice.customerId,
    measurementCycleId: input.invoice.measurementCycleId,
    dueDate: input.invoice.dueDate,
    expectedReceiptDate: input.expectedReceiptDate,
    daysPastDue: input.daysPastDue,
    riskLevel: input.riskLevel,
  };
}

const allowedTransitions: Readonly<
  Record<AccountsReceivableStatus, ReadonlyArray<AccountsReceivableStatus>>
> = {
  [AccountsReceivableStatus.Open]: [
    AccountsReceivableStatus.Overdue,
    AccountsReceivableStatus.PartiallyReceived,
    AccountsReceivableStatus.Received,
    AccountsReceivableStatus.Cancelled,
  ],
  [AccountsReceivableStatus.Overdue]: [
    AccountsReceivableStatus.PartiallyReceived,
    AccountsReceivableStatus.Received,
    AccountsReceivableStatus.Cancelled,
  ],
  [AccountsReceivableStatus.PartiallyReceived]: [
    AccountsReceivableStatus.Received,
    AccountsReceivableStatus.Cancelled,
  ],
  [AccountsReceivableStatus.Received]: [],
  [AccountsReceivableStatus.Cancelled]: [],
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
