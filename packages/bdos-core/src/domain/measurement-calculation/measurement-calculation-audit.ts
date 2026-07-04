/**
 * Derives a reconstructability view over a `CalculationExecutionResult`
 * (Sprint 13.3, enriched in 13.4 with `kind`/`inputKeys`/`operator`/
 * `unit`/`isFinal` on `CalculationStep`). This module does not execute
 * any formula, does not create new formulas, and does not mutate the
 * `CalculationExecutionResult` it reads or any `CalculationMemory` — it
 * only reads an already-computed execution result and reports whether
 * the calculation it represents can be fully reconstructed from its
 * steps.
 */
import type { CalculationFormulaType, MeasurementUnit } from "./measurement-calculation.types";
import type { CalculationExecutionResult, CalculationStep } from "./measurement-calculation-engine";
import { freezeDomainObject } from "./measurement-calculation-shared";

export interface BuildCalculationAuditTrailInput {
  readonly formulaType: CalculationFormulaType;
  readonly executionResult: CalculationExecutionResult;
}

export interface CalculationAuditTrailSummary {
  readonly formulaType: CalculationFormulaType;
  readonly totalSteps: number;
  readonly reconstructable: boolean;
  readonly hasFinalResult: boolean;
  readonly finalValue: number | null;
  readonly finalUnit: MeasurementUnit | null;
}

export interface CalculationAuditTrail {
  readonly formulaType: CalculationFormulaType;
  readonly steps: ReadonlyArray<CalculationStep>;
  readonly finalResult: CalculationExecutionResult["result"];
  readonly reconstructable: boolean;
  readonly summary: CalculationAuditTrailSummary;
}

/**
 * A calculation is reconstructable when it produced a result AND its
 * steps carry exactly one `isFinal` step, which must be the last one.
 * Any error path (no result, no steps, a missing/misplaced/duplicated
 * final step) is reported as not reconstructable — matching "toda
 * execução bem-sucedida deve ser reconstructable=true" / "toda execução
 * com erro deve ser reconstructable=false" exactly.
 */
export function isCalculationReconstructable(executionResult: CalculationExecutionResult): boolean {
  if (executionResult.result === null) {
    return false;
  }

  if (executionResult.steps.length === 0) {
    return false;
  }

  const finalSteps = executionResult.steps.filter((step) => step.isFinal);

  if (finalSteps.length !== 1) {
    return false;
  }

  const lastStep = executionResult.steps[executionResult.steps.length - 1];
  return lastStep !== undefined && lastStep.isFinal;
}

export function buildCalculationAuditTrail(input: BuildCalculationAuditTrailInput): CalculationAuditTrail {
  const { formulaType, executionResult } = input;
  const reconstructable = isCalculationReconstructable(executionResult);

  const summary: CalculationAuditTrailSummary = {
    formulaType,
    totalSteps: executionResult.steps.length,
    reconstructable,
    hasFinalResult: executionResult.result !== null,
    finalValue: executionResult.result?.value ?? null,
    finalUnit: executionResult.result?.unit ?? null,
  };

  return freezeDomainObject<CalculationAuditTrail>({
    formulaType,
    steps: executionResult.steps,
    finalResult: executionResult.result,
    reconstructable,
    summary,
  });
}

export function summarizeCalculationAuditTrail(trail: CalculationAuditTrail): CalculationAuditTrailSummary {
  return trail.summary;
}
