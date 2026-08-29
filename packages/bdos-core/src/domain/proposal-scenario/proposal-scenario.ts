import { BudgetVersionStatus, calculateBudgetVersionTotal, isValidMoneyCents } from "../budget-version";
import {
  PROPOSAL_SCENARIO_CALCULATION_METHOD,
  ProposalScenarioComparisonKind,
  type CreateProposalScenarioInput,
  type ProposalScenario,
  type ProposalScenarioError,
  type ProposalScenarioResult,
} from "./proposal-scenario.types";

const MAX_NAME_LENGTH = 120;

export function createProposalScenario(input: CreateProposalScenarioInput): ProposalScenarioResult {
  const errors: ProposalScenarioError[] = [];
  const name = input.name.trim();

  if (input.id.trim().length === 0) errors.push(error("missing_id", "id", "Scenario identity is required."));
  if (name.length === 0) errors.push(error("missing_name", "name", "Scenario name is required."));
  if (name.length > MAX_NAME_LENGTH) errors.push(error("invalid_name", "name", `Scenario name must have at most ${MAX_NAME_LENGTH} characters.`));
  if (input.sourceBudgetVersion.organizationId !== input.organizationId) {
    errors.push(error("organization_mismatch", "organizationId", "The source budget belongs to a different organization."));
  }
  if (input.sourceBudgetVersion.status !== BudgetVersionStatus.Consolidated) {
    errors.push(error("source_not_consolidated", "sourceBudgetVersion", "The source budget must be consolidated."));
  }
  if (!Number.isSafeInteger(input.sourceBudgetVersionRevision) || input.sourceBudgetVersionRevision < 0) {
    errors.push(error("invalid_source_revision", "sourceBudgetVersionRevision", "The source budget revision must be a non-negative integer."));
  }
  if (!isValidMoneyCents(input.targetValueCents)) {
    errors.push(error("invalid_target_value", "targetValueCents", "The target value must be valid integer cents."));
  }
  if (input.createdBy.trim().length === 0) errors.push(error("missing_actor", "createdBy", "The authenticated actor is required."));
  if (!isIsoTimestamp(input.createdAt)) errors.push(error("invalid_timestamp", "createdAt", "Creation time must be a valid ISO timestamp."));

  let officialValueCents = 0;
  try {
    officialValueCents = calculateBudgetVersionTotal(input.sourceBudgetVersion);
  } catch {
    errors.push(error("invalid_official_value", "sourceBudgetVersion", "The official budget total is invalid."));
  }

  if (!isValidMoneyCents(officialValueCents) || officialValueCents <= 0) {
    errors.push(error("invalid_official_value", "sourceBudgetVersion", "The official budget total must be positive."));
  }

  if (errors.length > 0) return freeze({ success: false, scenario: null, errors });

  const comparisonKind =
    input.targetValueCents < officialValueCents
      ? ProposalScenarioComparisonKind.Reduction
      : input.targetValueCents > officialValueCents
        ? ProposalScenarioComparisonKind.Increase
        : ProposalScenarioComparisonKind.Equal;
  const differenceCents = Math.abs(officialValueCents - input.targetValueCents);
  const differenceBasisPoints = roundedBasisPoints(differenceCents, officialValueCents);

  const scenario: ProposalScenario = {
    id: input.id,
    organizationId: input.organizationId,
    sourceBudgetVersionId: input.sourceBudgetVersion.id,
    sourceBudgetVersionRevision: input.sourceBudgetVersionRevision,
    name,
    officialValueCents,
    targetValueCents: input.targetValueCents,
    differenceCents,
    differenceBasisPoints,
    comparisonKind,
    calculationMethod: PROPOSAL_SCENARIO_CALCULATION_METHOD,
    parameters: { authority: "target_value_cents", targetValueCents: input.targetValueCents },
    createdBy: input.createdBy,
    createdAt: input.createdAt,
  };

  return freeze({ success: true, scenario, errors: [] });
}

/** Arredonda apenas a métrica de apresentação para 0,01%, por razão inteira metade-para-cima. */
function roundedBasisPoints(differenceCents: number, officialValueCents: number): string {
  const numerator = BigInt(differenceCents) * 10_000n;
  const denominator = BigInt(officialValueCents);
  return ((numerator * 2n + denominator) / (denominator * 2n)).toString();
}

function isIsoTimestamp(value: string): boolean {
  return value.trim().length > 0 && Number.isFinite(Date.parse(value));
}

function error(code: ProposalScenarioError["code"], field: string, message: string): ProposalScenarioError {
  return { code, field, message };
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((child) => freeze(child));
    Object.freeze(value);
  }
  return value;
}
