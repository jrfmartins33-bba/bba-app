/**
 * Closes Chapter III (Engineering Intelligence). The Measurement
 * Calculation Workspace is a read-only aggregation view over the five
 * artifacts a single calculation cycle already produced: the
 * `CalculationMemory` aggregate (13.1), the `CalculationExecutionResult`
 * (13.3), the `CalculationAuditTrail` (13.4/13.6), the
 * `CalculationValidationResult` (13.5) and the `MeasurementMemoryDocument`
 * (13.10). It executes nothing, validates nothing, and audits nothing —
 * it only organizes five already-computed objects into one deterministic
 * object, copying each verbatim and never mutating any of them.
 *
 * This is the object a future Document Reconstruction Engine, Official
 * Template Engine, or Executive Intelligence capability is expected to
 * consume — none of them needs to know anything about the Formula
 * Catalog, the engine's dispatch table, or how an audit trail is built;
 * they only need this one workspace.
 */
import type { CalculationFormulaType, CalculationMemory, MeasurementUnit } from "./measurement-calculation.types";
import type { CalculationExecutionResult } from "./measurement-calculation-engine";
import type { CalculationAuditTrail } from "./measurement-calculation-audit";
import type { CalculationValidationResult } from "./measurement-calculation-validation";
import type { MeasurementMemoryDocument } from "./measurement-memory-builder";
import { isMeasurementMemoryComplete } from "./measurement-memory-builder";
import { freezeDomainObject } from "./measurement-calculation-shared";

export type MeasurementCalculationStatus = "success" | "failure";
export type MeasurementCalculationValidationStatus = "valid" | "invalid";
export type MeasurementCalculationAuditStatus = "reconstructable" | "non_reconstructable";

export interface BuildMeasurementCalculationWorkspaceInput {
  readonly memory: CalculationMemory;
  readonly execution: CalculationExecutionResult;
  readonly audit: CalculationAuditTrail;
  readonly validation: CalculationValidationResult;
  readonly measurementMemory: MeasurementMemoryDocument;
}

export interface MeasurementCalculationWorkspaceSummary {
  readonly formulaType: CalculationFormulaType;
  readonly calculationStatus: MeasurementCalculationStatus;
  readonly validationStatus: MeasurementCalculationValidationStatus;
  readonly auditStatus: MeasurementCalculationAuditStatus;
  readonly result: number | null;
  readonly unit: MeasurementUnit | null;
}

export interface MeasurementCalculationWorkspace {
  readonly memory: CalculationMemory;
  readonly execution: CalculationExecutionResult;
  readonly audit: CalculationAuditTrail;
  readonly validation: CalculationValidationResult;
  readonly measurementMemory: MeasurementMemoryDocument;
  readonly statusSummary: MeasurementCalculationWorkspaceSummary;
  readonly isValid: boolean;
  readonly isReconstructable: boolean;
  readonly isComplete: boolean;
}

export function buildMeasurementCalculationWorkspace(
  input: BuildMeasurementCalculationWorkspaceInput,
): MeasurementCalculationWorkspace {
  const { memory, execution, audit, validation, measurementMemory } = input;

  const isValid = validation.valid;
  const isReconstructable = audit.reconstructable;
  const isComplete = isMeasurementMemoryComplete(measurementMemory);

  const statusSummary: MeasurementCalculationWorkspaceSummary = {
    formulaType: memory.formulaType,
    calculationStatus: execution.result !== null ? "success" : "failure",
    validationStatus: isValid ? "valid" : "invalid",
    auditStatus: isReconstructable ? "reconstructable" : "non_reconstructable",
    result: execution.result?.value ?? null,
    unit: execution.result?.unit ?? null,
  };

  return freezeDomainObject<MeasurementCalculationWorkspace>({
    memory,
    execution,
    audit,
    validation,
    measurementMemory,
    statusSummary,
    isValid,
    isReconstructable,
    isComplete,
  });
}

export function summarizeMeasurementCalculationWorkspace(
  workspace: MeasurementCalculationWorkspace,
): MeasurementCalculationWorkspaceSummary {
  return workspace.statusSummary;
}

/**
 * Whether the workspace is safe for a downstream consumer (Document
 * Reconstruction Engine, Official Template Engine, Executive
 * Intelligence) to rely on: the calculation validated cleanly, its audit
 * trail is reconstructable, and its measurement memory is complete.
 * Reads the three already-derived flags only — never recomputes them.
 */
export function isMeasurementCalculationWorkspaceReady(workspace: MeasurementCalculationWorkspace): boolean {
  return workspace.isValid && workspace.isReconstructable && workspace.isComplete;
}
