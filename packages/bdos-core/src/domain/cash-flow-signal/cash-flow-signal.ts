import type { MeasurementDate } from "../measurement";
import {
  AccountsReceivableStatus,
  type AccountsReceivable,
} from "../accounts-receivable";
import type {
  CashFlowSignal,
  CashFlowSignalError,
  CashFlowSignalId,
  CashFlowSignalMetadata,
  CashFlowSignalResult,
  CashFlowSignalSuccess,
  CashFlowSignalWarning,
} from "./cash-flow-signal.types";
import {
  CashFlowSignalCategory,
  CashFlowSignalCertainty,
  CashFlowSignalDirection,
} from "./cash-flow-signal.types";

export interface CreateCashFlowSignalFromReceivableInput {
  readonly accountsReceivable: AccountsReceivable;
  readonly id: CashFlowSignalId;
  readonly signalDate: MeasurementDate;
  readonly certainty: CashFlowSignalCertainty;
  readonly metadata?: CashFlowSignalMetadata;
}

export function createCashFlowSignalFromReceivable(
  input: CreateCashFlowSignalFromReceivableInput,
): CashFlowSignalResult {
  const metadata = createCashFlowSignalMetadata(input);
  const errors = validateCashFlowSignal(input, metadata);
  const warnings = createCashFlowSignalWarnings(input, metadata);

  if (errors.length > 0) {
    return freezeDomainObject({
      success: false,
      signal: null,
      errors,
      warnings,
      metadata,
    });
  }

  return freezeDomainObject<CashFlowSignalSuccess>({
    success: true,
    signal: createSignal(input, metadata),
    errors: [],
    warnings,
    metadata,
  });
}

function validateCashFlowSignal(
  input: CreateCashFlowSignalFromReceivableInput,
  metadata: CashFlowSignalMetadata,
): ReadonlyArray<CashFlowSignalError> {
  const errors: CashFlowSignalError[] = [];

  if (input.accountsReceivable.status === AccountsReceivableStatus.Cancelled) {
    errors.push(
      createCashFlowSignalError(
        "cancelled_receivable",
        "accountsReceivable.status",
        "Cancelled accounts receivable cannot create a cash flow signal.",
        metadata,
      ),
    );
  }

  if (input.accountsReceivable.amount <= 0) {
    errors.push(
      createCashFlowSignalError(
        "non_positive_signal_amount",
        "accountsReceivable.amount",
        "Cash flow signal amount must be greater than zero.",
        metadata,
      ),
    );
  }

  return errors;
}

function createCashFlowSignalWarnings(
  input: CreateCashFlowSignalFromReceivableInput,
  metadata: CashFlowSignalMetadata,
): ReadonlyArray<CashFlowSignalWarning> {
  if (
    input.accountsReceivable.status === AccountsReceivableStatus.Overdue &&
    input.certainty === CashFlowSignalCertainty.Confirmed
  ) {
    return [
      {
        code: "overdue_confirmed_inflow",
        field: "certainty",
        message:
          "Overdue accounts receivable marked as confirmed inflow may be inconsistent.",
        metadata,
      },
    ];
  }

  return [];
}

function createSignal(
  input: CreateCashFlowSignalFromReceivableInput,
  metadata: CashFlowSignalMetadata,
): CashFlowSignal {
  return {
    id: input.id,
    sourceType: "accounts_receivable",
    sourceId: input.accountsReceivable.id,
    contractId: input.accountsReceivable.contractId,
    projectId: input.accountsReceivable.projectId,
    customerId: input.accountsReceivable.customerId,
    date: input.signalDate,
    direction: CashFlowSignalDirection.Inflow,
    amount: input.accountsReceivable.amount,
    currency: input.accountsReceivable.currency,
    category: CashFlowSignalCategory.Receivable,
    certainty: input.certainty,
    riskLevel: input.accountsReceivable.riskLevel,
    metadata,
  };
}

function createCashFlowSignalError(
  code: CashFlowSignalError["code"],
  field: string,
  message: string,
  metadata: CashFlowSignalMetadata,
): CashFlowSignalError {
  return {
    code,
    field,
    message,
    metadata,
  };
}

function createCashFlowSignalMetadata(
  input: CreateCashFlowSignalFromReceivableInput,
): CashFlowSignalMetadata {
  return {
    ...input.accountsReceivable.metadata,
    ...(input.metadata ?? {}),
    cashFlowSignalId: input.id,
    accountsReceivableId: input.accountsReceivable.id,
    invoiceId: input.accountsReceivable.invoiceId,
    invoiceNumber: input.accountsReceivable.invoiceNumber,
    contractId: input.accountsReceivable.contractId,
    projectId: input.accountsReceivable.projectId,
    customerId: input.accountsReceivable.customerId,
    signalDate: input.signalDate,
    certainty: input.certainty,
    riskLevel: input.accountsReceivable.riskLevel,
  };
}

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
