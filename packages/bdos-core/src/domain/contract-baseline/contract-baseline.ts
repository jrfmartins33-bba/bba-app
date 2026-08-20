import {
  type ContractBaseline,
  ContractBaselineStatus,
  type CreateContractBaselineInput,
} from "./contract-baseline.types";
import { isValidMoneyCents } from "../budget-version/budget-version-money";

export class ContractBaselineValidationError extends Error {
  constructor(message: string) {
    super(`ContractBaselineValidationError: ${message}`);
    this.name = "ContractBaselineValidationError";
  }
}

/**
 * Escala interna para aritmética de alta precisão (8 casas decimais, suportando NUMERIC(20,8)).
 * Permite reconciliação exata de valores com precisão sub-centavo para contratos acima de R$ 100 milhões.
 */
const PRECISION_SCALE = 8;
const SCALE_MULTIPLIER = 10n ** BigInt(PRECISION_SCALE);
const CENTS_TO_SCALE_MULTIPLIER = 10n ** BigInt(PRECISION_SCALE - 2); // 10^6 (centavos = 10^2)

export function parseToFixedBigInt(decimalStr: string): bigint {
  const trimmed = decimalStr.trim();
  const isNegative = trimmed.startsWith("-");
  const unsigned = isNegative ? trimmed.slice(1) : trimmed;

  const parts = unsigned.split(".");
  if (parts.length > 2) {
    throw new ContractBaselineValidationError(`Invalid decimal string: "${decimalStr}"`);
  }

  const integerPart = parts[0] || "0";
  const fractionPart = (parts[1] || "").slice(0, PRECISION_SCALE).padEnd(PRECISION_SCALE, "0");

  const combined = BigInt(integerPart) * SCALE_MULTIPLIER + BigInt(fractionPart);
  return isNegative ? -combined : combined;
}

export function formatFromFixedBigInt(value: bigint): string {
  const isNegative = value < 0n;
  const absValue = isNegative ? -value : value;

  const integerPart = (absValue / SCALE_MULTIPLIER).toString();
  const fractionPart = (absValue % SCALE_MULTIPLIER).toString().padStart(PRECISION_SCALE, "0");

  const sign = isNegative ? "-" : "";
  return `${sign}${integerPart}.${fractionPart}`;
}

export function reconcileContractBaselineMath(
  contractedValueCents: number,
  derivedItemsTotalDecimal: string,
  roundingAdjustmentDecimal: string,
): { readonly matches: boolean; readonly expectedContracted: string; readonly calculatedTotal: string } {
  if (!Number.isSafeInteger(contractedValueCents) || contractedValueCents < 0) {
    throw new ContractBaselineValidationError(
      `contractedValueCents must be a non-negative safe integer. Found: ${contractedValueCents}`,
    );
  }

  const contractedFixed = BigInt(contractedValueCents) * CENTS_TO_SCALE_MULTIPLIER;
  const derivedFixed = parseToFixedBigInt(derivedItemsTotalDecimal);
  const adjustmentFixed = parseToFixedBigInt(roundingAdjustmentDecimal);

  const calculatedFixed = derivedFixed + adjustmentFixed;
  const matches = calculatedFixed === contractedFixed;

  return {
    matches,
    expectedContracted: formatFromFixedBigInt(contractedFixed),
    calculatedTotal: formatFromFixedBigInt(calculatedFixed),
  };
}

export function createContractBaseline(input: CreateContractBaselineInput): ContractBaseline {
  if (!input.id || typeof input.id !== "string" || input.id.trim().length === 0) {
    throw new ContractBaselineValidationError("Contract baseline id must be a non-empty string.");
  }
  if (!input.organizationId || typeof input.organizationId !== "string" || input.organizationId.trim().length === 0) {
    throw new ContractBaselineValidationError("Contract baseline organizationId must be a non-empty string.");
  }
  if (!input.engineeringProjectId || typeof input.engineeringProjectId !== "string" || input.engineeringProjectId.trim().length === 0) {
    throw new ContractBaselineValidationError("Contract baseline engineeringProjectId must be a non-empty string.");
  }
  if (!input.contractNumber || typeof input.contractNumber !== "string" || input.contractNumber.trim().length === 0) {
    throw new ContractBaselineValidationError("Contract baseline contractNumber must be a non-empty string.");
  }

  const contractorName = (input.contractorNameSnapshot ?? input.contractorName)?.trim();
  if (!contractorName || contractorName.length === 0) {
    throw new ContractBaselineValidationError("Contract baseline contractorNameSnapshot must be a non-empty string.");
  }

  if (typeof input.contractedValueCents !== "number" || !isValidMoneyCents(input.contractedValueCents)) {
    throw new ContractBaselineValidationError(
      `contractedValueCents must be a valid non-negative integer of cents. Found: ${input.contractedValueCents}`,
    );
  }

  if (
    input.historicalOfficialBudgetCents !== undefined &&
    input.historicalOfficialBudgetCents !== null &&
    (!isValidMoneyCents(input.historicalOfficialBudgetCents))
  ) {
    throw new ContractBaselineValidationError(
      `historicalOfficialBudgetCents must be a valid non-negative integer of cents. Found: ${input.historicalOfficialBudgetCents}`,
    );
  }

  // Exact math reconciliation check
  const reconciliation = reconcileContractBaselineMath(
    input.contractedValueCents,
    input.derivedItemsTotalDecimal,
    input.contractualRoundingAdjustmentDecimal,
  );

  if (!reconciliation.matches) {
    throw new ContractBaselineValidationError(
      `Contract baseline values do not reconcile: derivedItemsTotal (${input.derivedItemsTotalDecimal}) + adjustment (${input.contractualRoundingAdjustmentDecimal}) produces ${reconciliation.calculatedTotal}, expected contractedValue (${reconciliation.expectedContracted}).`,
    );
  }

  return {
    id: input.id.trim(),
    organizationId: input.organizationId.trim(),
    engineeringProjectId: input.engineeringProjectId.trim(),
    procurementCaseId: input.procurementCaseId ? input.procurementCaseId.trim() : null,
    consortiumId: input.consortiumId ? input.consortiumId.trim() : null,
    sourceBudgetVersionId: input.sourceBudgetVersionId ? input.sourceBudgetVersionId.trim() : null,
    contractNumber: input.contractNumber.trim(),
    contractorNameSnapshot: contractorName,
    status: input.status ?? ContractBaselineStatus.InExecution,
    contractedValueCents: input.contractedValueCents,
    historicalOfficialBudgetCents: input.historicalOfficialBudgetCents ?? null,
    derivedItemsTotalDecimal: input.derivedItemsTotalDecimal.trim(),
    contractualRoundingAdjustmentDecimal: input.contractualRoundingAdjustmentDecimal.trim(),
    metadata: input.metadata ?? {},
  };
}

export function formatContractedValuePtBr(baseline: ContractBaseline): string {
  const reais = baseline.contractedValueCents / 100;
  return reais.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatHistoricalOfficialBudgetPtBr(baseline: ContractBaseline): string | null {
  if (baseline.historicalOfficialBudgetCents === null) return null;
  const reais = baseline.historicalOfficialBudgetCents / 100;
  return reais.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDerivedItemsTotalPtBr(baseline: ContractBaseline): string {
  const num = Number(baseline.derivedItemsTotalDecimal);
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatRoundingAdjustmentPtBr(baseline: ContractBaseline): string {
  const num = Number(baseline.contractualRoundingAdjustmentDecimal);
  const isNeg = num < 0;
  const absNum = Math.abs(num);
  const formattedAbs = absNum.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return isNeg ? `- ${formattedAbs}` : formattedAbs;
}
