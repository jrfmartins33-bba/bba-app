import type {
  AlphaFinancialFlowValidationError,
  CreateMeasurementFinancialFlowInput,
  CreateMeasurementFinancialFlowResult,
} from "./financial-flow.types";

export function createMeasurementFinancialFlow(
  input: CreateMeasurementFinancialFlowInput,
): CreateMeasurementFinancialFlowResult {
  const errors = validateFinancialFlowTraceability(input);

  if (errors.length > 0) {
    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    financialFlow: {
      measurement: {
        ...input.measurement,
        metadata: {
          ...input.measurement.metadata,
        },
      },
      invoice: {
        ...input.invoice,
        metadata: {
          ...input.invoice.metadata,
        },
      },
      accountsReceivable: {
        ...input.accountsReceivable,
        metadata: {
          ...input.accountsReceivable.metadata,
        },
      },
      cashFlowSignal: {
        ...input.cashFlowSignal,
        metadata: {
          ...input.cashFlowSignal.metadata,
        },
      },
    },
  };
}

function validateFinancialFlowTraceability(
  input: CreateMeasurementFinancialFlowInput,
): ReadonlyArray<AlphaFinancialFlowValidationError> {
  const errors: AlphaFinancialFlowValidationError[] = [];

  if (input.invoice.measurementId !== input.measurement.id) {
    errors.push({
      field: "invoice.measurementId",
      message: "Invoice measurementId must match measurement id.",
    });
  }

  if (input.invoice.contractId !== input.measurement.contractId) {
    errors.push({
      field: "invoice.contractId",
      message: "Invoice contractId must match measurement contractId.",
    });
  }

  if (input.invoice.projectId !== input.measurement.projectId) {
    errors.push({
      field: "invoice.projectId",
      message: "Invoice projectId must match measurement projectId.",
    });
  }

  if (input.accountsReceivable.invoiceId !== input.invoice.id) {
    errors.push({
      field: "accountsReceivable.invoiceId",
      message: "Accounts receivable invoiceId must match invoice id.",
    });
  }

  if (input.cashFlowSignal.sourceId !== input.accountsReceivable.id) {
    errors.push({
      field: "cashFlowSignal.sourceId",
      message: "Cash flow signal sourceId must match accounts receivable id.",
    });
  }

  if (input.invoice.netAmount !== input.accountsReceivable.amount) {
    errors.push({
      field: "accountsReceivable.amount",
      message: "Accounts receivable amount must match invoice netAmount.",
    });
  }

  if (input.accountsReceivable.amount !== input.cashFlowSignal.amount) {
    errors.push({
      field: "cashFlowSignal.amount",
      message: "Cash flow signal amount must match accounts receivable amount.",
    });
  }

  return errors;
}
