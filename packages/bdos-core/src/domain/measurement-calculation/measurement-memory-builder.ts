/**
 * The first Memory Builder of BDOS. Transforms an already-computed
 * `CalculationExecutionResult` (Sprint 13.3), its `CalculationAuditTrail`
 * (Sprint 13.4/13.6) and its `CalculationValidationResult` (Sprint 13.5),
 * alongside the `CalculationMemory` aggregate (Sprint 13.1) that
 * originated them, into one flat, structured `MeasurementMemoryDocument`.
 *
 * It does not render a PDF, a Word document, HTML, or Markdown — it
 * builds a pure domain model only. It does not calculate anything: every
 * field is copied verbatim from its source, never recomputed, and none
 * of the four inputs is ever mutated. `formulaType`/`title`/`dimensions`
 * come from the `CalculationMemory` aggregate (which alone knows the
 * dimensions' full traceability, including `sourceEvidenceIds` from
 * Sprint 13.6); `steps`/`result` come from the `CalculationExecutionResult`;
 * `reconstructable` is copied from the `CalculationAuditTrail`.
 *
 * A validation error or a non-reconstructable audit trail does not stop
 * the memory from being built — `buildMeasurementMemory` always
 * succeeds structurally; it just faithfully reflects whatever state its
 * three inputs were already in. `isMeasurementMemoryComplete` is the
 * function that judges whether the resulting document represents a
 * fully successful, audited and validated calculation.
 *
 * This document is intentionally generic: a future Document
 * Reconstruction Engine is expected to render it into a PDF, a Word
 * file, a measurement bulletin, or a report — none of which exists in
 * this domain.
 */
import type { CalculationFormulaType, CalculationMemory, MeasurementDimension, MeasurementUnit } from "./measurement-calculation.types";
import type { CalculationExecutionResult, CalculationStep } from "./measurement-calculation-engine";
import type { CalculationAuditTrail } from "./measurement-calculation-audit";
import type { CalculationValidationResult } from "./measurement-calculation-validation";
import { freezeDomainObject } from "./measurement-calculation-shared";

export interface BuildMeasurementMemoryInput {
  readonly memory: CalculationMemory;
  readonly executionResult: CalculationExecutionResult;
  readonly auditTrail: CalculationAuditTrail;
  readonly validationResult: CalculationValidationResult;
}

export interface MeasurementMemorySummary {
  readonly totalDimensions: number;
  readonly totalSteps: number;
  readonly finalResult: number | null;
  readonly unit: MeasurementUnit | null;
  readonly formulaType: CalculationFormulaType;
}

export interface MeasurementMemoryDocument {
  readonly formulaType: CalculationFormulaType;
  readonly title: string;
  readonly summary: MeasurementMemorySummary;
  readonly steps: ReadonlyArray<CalculationStep>;
  readonly result: CalculationExecutionResult["result"];
  readonly dimensions: ReadonlyArray<MeasurementDimension>;
  readonly generatedFromCalculation: CalculationExecutionResult;
  readonly generatedFromAudit: CalculationAuditTrail;
  readonly generatedFromValidation: CalculationValidationResult;
  readonly reconstructable: boolean;
}

export function buildMeasurementMemory(input: BuildMeasurementMemoryInput): MeasurementMemoryDocument {
  const { memory, executionResult, auditTrail, validationResult } = input;

  const summary: MeasurementMemorySummary = {
    totalDimensions: memory.dimensions.length,
    totalSteps: executionResult.steps.length,
    finalResult: executionResult.result?.value ?? null,
    unit: executionResult.result?.unit ?? null,
    formulaType: memory.formulaType,
  };

  return freezeDomainObject<MeasurementMemoryDocument>({
    formulaType: memory.formulaType,
    title: memory.title,
    summary,
    steps: executionResult.steps,
    result: executionResult.result,
    dimensions: memory.dimensions,
    generatedFromCalculation: executionResult,
    generatedFromAudit: auditTrail,
    generatedFromValidation: validationResult,
    reconstructable: auditTrail.reconstructable,
  });
}

export function summarizeMeasurementMemory(document: MeasurementMemoryDocument): MeasurementMemorySummary {
  return document.summary;
}

/**
 * A memory is "complete" when it represents a calculation that actually
 * produced a result, has at least one step, is reconstructable per its
 * audit trail, and was reported valid by the Validation Engine. Any
 * single failure (missing result, no steps, non-reconstructable, or a
 * validation error) makes it incomplete — the document itself is still
 * built and returned either way, this function only judges it.
 */
export function isMeasurementMemoryComplete(document: MeasurementMemoryDocument): boolean {
  return (
    document.result !== null &&
    document.steps.length > 0 &&
    document.reconstructable &&
    document.generatedFromValidation.valid
  );
}
