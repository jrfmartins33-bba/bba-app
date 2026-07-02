import type { BusinessFact } from "../../../business-fact";
import type {
  AlphaMeasurementFinancialFlow,
} from "../../../digital-twin/alpha-engenharia";
import {
  createBusinessFactsGenerationResult,
} from "../../business-facts-generator";
import type {
  BusinessFactGenerationError,
  BusinessFactsAdapter,
  BusinessFactsGenerationInput,
  BusinessFactsGenerationResult,
} from "../../business-facts-generator.types";

export const alphaEngenhariaFactsSource = "alpha-engenharia.digital-twin";

export interface AlphaEngenhariaFactsGenerationInput
  extends BusinessFactsGenerationInput {
  readonly measurementFinancialFlow?: AlphaMeasurementFinancialFlow;
  readonly companyId?: string;
  readonly tenantId?: string;
  readonly organizationId?: string;
  readonly capability?: string;
}

type ValidAlphaEngenhariaFactsGenerationInput =
  AlphaEngenhariaFactsGenerationInput & {
    readonly measurementFinancialFlow: AlphaMeasurementFinancialFlow;
    readonly companyId: string;
    readonly tenantId: string;
    readonly organizationId: string;
    readonly capability: string;
  };

export const alphaEngenhariaFactsAdapter: BusinessFactsAdapter<AlphaEngenhariaFactsGenerationInput> = {
  adapterId: "alpha-engenharia-facts-adapter",
  supportedSource: alphaEngenhariaFactsSource,
  generateFacts: generateAlphaEngenhariaFacts,
};

export function generateAlphaEngenhariaFacts(
  input: AlphaEngenhariaFactsGenerationInput,
): BusinessFactsGenerationResult {
  const errors = validateRequiredInput(input);

  if (errors.length > 0) {
    return createBusinessFactsGenerationResult({
      errors,
      metadata: createResultMetadata(input),
    });
  }

  const validInput = input as ValidAlphaEngenhariaFactsGenerationInput;

  return createBusinessFactsGenerationResult({
    facts: createFacts(validInput, validInput.measurementFinancialFlow),
    metadata: createResultMetadata(validInput),
  });
}

function validateRequiredInput(
  input: AlphaEngenhariaFactsGenerationInput,
): ReadonlyArray<BusinessFactGenerationError> {
  const errors: BusinessFactGenerationError[] = [];

  if (isMissing(input.tenantId)) {
    errors.push(createMissingFieldError(input, "tenantId"));
  }

  if (isMissing(input.organizationId)) {
    errors.push(createMissingFieldError(input, "organizationId"));
  }

  if (isMissing(input.companyId)) {
    errors.push(createMissingFieldError(input, "companyId"));
  }

  if (isMissing(input.capability)) {
    errors.push(createMissingFieldError(input, "capability"));
  }

  if (input.measurementFinancialFlow === undefined) {
    errors.push(createMissingFieldError(input, "measurementFinancialFlow"));
  }

  return errors;
}

function createFacts(
  input: ValidAlphaEngenhariaFactsGenerationInput,
  flow: AlphaMeasurementFinancialFlow,
): ReadonlyArray<BusinessFact> {
  const facts: BusinessFact[] = [];

  if (flow.measurement.status === "approved") {
    facts.push(createMeasurementApprovedFact(input, flow));
  }

  if (flow.invoice.status === "issued") {
    facts.push(createInvoiceIssuedFact(input, flow));
  }

  if (flow.accountsReceivable.status === "open") {
    facts.push(createReceivableOpenFact(input, flow));
  }

  if (flow.accountsReceivable.status === "overdue") {
    facts.push(createReceivableOverdueFact(input, flow));
  }

  if (
    flow.cashFlowSignal.direction === "inflow" &&
    flow.cashFlowSignal.certainty === "at_risk"
  ) {
    facts.push(createCashInflowAtRiskFact(input, flow));
  }

  return facts;
}

function createMeasurementApprovedFact(
  input: ValidAlphaEngenhariaFactsGenerationInput,
  flow: AlphaMeasurementFinancialFlow,
): BusinessFact {
  return {
    ...createBaseFact(input, flow),
    id: createFactId(input, "measurement-approved", flow.measurement.id),
    source: "alpha-engenharia.measurement",
    sourceReference: flow.measurement.id,
    category: "revenue",
    type: "measurement_approved",
    label: "Measurement approved",
    description:
      "Construction measurement approved and ready to support billing.",
    value: flow.invoice.grossAmount,
    observedAt: flow.measurement.measuredAt,
  };
}

function createInvoiceIssuedFact(
  input: ValidAlphaEngenhariaFactsGenerationInput,
  flow: AlphaMeasurementFinancialFlow,
): BusinessFact {
  return {
    ...createBaseFact(input, flow),
    id: createFactId(input, "invoice-issued", flow.invoice.id),
    source: "alpha-engenharia.invoice",
    sourceReference: flow.invoice.id,
    category: "revenue",
    type: "invoice_issued",
    label: "Invoice issued",
    description:
      "Invoice issued from an approved construction measurement.",
    value: flow.invoice.netAmount,
    observedAt: flow.invoice.issueDate,
  };
}

function createReceivableOpenFact(
  input: ValidAlphaEngenhariaFactsGenerationInput,
  flow: AlphaMeasurementFinancialFlow,
): BusinessFact {
  return {
    ...createBaseFact(input, flow),
    id: createFactId(input, "receivable-open", flow.accountsReceivable.id),
    source: "alpha-engenharia.accounts-receivable",
    sourceReference: flow.accountsReceivable.id,
    category: "cash",
    type: "receivable_open",
    label: "Accounts receivable open",
    description:
      "Accounts receivable is open and expected to become future cash inflow.",
    value: flow.accountsReceivable.amount,
    observedAt: flow.accountsReceivable.dueDate,
  };
}

function createReceivableOverdueFact(
  input: ValidAlphaEngenhariaFactsGenerationInput,
  flow: AlphaMeasurementFinancialFlow,
): BusinessFact {
  return {
    ...createBaseFact(input, flow),
    id: createFactId(input, "receivable-overdue", flow.accountsReceivable.id),
    source: "alpha-engenharia.accounts-receivable",
    sourceReference: flow.accountsReceivable.id,
    category: "cash",
    type: "receivable_overdue",
    label: "Accounts receivable overdue",
    description:
      "Accounts receivable is overdue and may affect projected cash position.",
    value: flow.accountsReceivable.amount,
    observedAt: flow.accountsReceivable.expectedReceiptDate,
  };
}

function createCashInflowAtRiskFact(
  input: ValidAlphaEngenhariaFactsGenerationInput,
  flow: AlphaMeasurementFinancialFlow,
): BusinessFact {
  return {
    ...createBaseFact(input, flow),
    id: createFactId(input, "cash-inflow-at-risk", flow.cashFlowSignal.id),
    source: "alpha-engenharia.cash-flow-signal",
    sourceReference: flow.cashFlowSignal.id,
    category: "cash",
    type: "cash_inflow_at_risk",
    label: "Cash inflow at risk",
    description: flow.cashFlowSignal.description,
    value: flow.cashFlowSignal.amount,
    observedAt: flow.cashFlowSignal.date,
  };
}

function createBaseFact(
  input: ValidAlphaEngenhariaFactsGenerationInput,
  flow: AlphaMeasurementFinancialFlow,
): Omit<
  BusinessFact,
  | "id"
  | "source"
  | "sourceReference"
  | "category"
  | "type"
  | "label"
  | "description"
  | "value"
  | "observedAt"
> {
  return {
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    capability: input.capability,
    unit: "currency",
    confidence: 100,
    metadata: createFactMetadata(input, flow),
    createdAt: input.generatedAt,
  };
}

function createFactMetadata(
  input: AlphaEngenhariaFactsGenerationInput,
  flow: AlphaMeasurementFinancialFlow,
) {
  return {
    ...input.metadata,
    adapterId: alphaEngenhariaFactsAdapter.adapterId,
    companyId: input.companyId,
    correlationId: input.correlationId,
    measurementId: flow.measurement.id,
    invoiceId: flow.invoice.id,
    accountsReceivableId: flow.accountsReceivable.id,
    cashFlowSignalId: flow.cashFlowSignal.id,
  };
}

function createResultMetadata(input: AlphaEngenhariaFactsGenerationInput) {
  return {
    ...input.metadata,
    adapterId: alphaEngenhariaFactsAdapter.adapterId,
    companyId: input.companyId,
    correlationId: input.correlationId,
  };
}

function createFactId(
  input: AlphaEngenhariaFactsGenerationInput,
  factType: string,
  sourceId: string,
): string {
  return `${input.correlationId}:${factType}:${sourceId}`;
}

function createMissingFieldError(
  input: AlphaEngenhariaFactsGenerationInput,
  field: string,
): BusinessFactGenerationError {
  return {
    code: "missing_required_data",
    message: `${field} is required.`,
    sourceId: input.correlationId,
    metadata: {
      ...input.metadata,
      adapterId: alphaEngenhariaFactsAdapter.adapterId,
      field,
      correlationId: input.correlationId,
    },
  };
}

function isMissing(value: string | undefined): boolean {
  return value === undefined || value.trim().length === 0;
}
