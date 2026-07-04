/**
 * Deterministic structural validation over the Measurement Calculation
 * Engine (Sprint 13.3) and its Audit Trail (Sprint 13.4). This module
 * never calculates anything and never recomputes a result to "check" it
 * — the arithmetic belongs entirely to `measurement-calculation-engine.ts`.
 * It only inspects a `CalculationExecutionInput`, the
 * `CalculationExecutionResult` produced for it, and the
 * `MeasurementFormulaCatalogEntry` it should conform to, and reports a
 * diagnostic. It never mutates any of the three.
 */
import type {
  CalculationExecutionInput,
  CalculationExecutionResult,
  CalculationExecutionWarning,
} from "./measurement-calculation-engine";
import type { MeasurementFormulaCatalogEntry } from "./measurement-formula-catalog";
import { isCalculationReconstructable } from "./measurement-calculation-audit";
import { freezeDomainObject, isBlank } from "./measurement-calculation-shared";

export enum CalculationValidationSeverity {
  Info = "info",
  Warning = "warning",
  Error = "error",
}

export type CalculationValidationCode =
  | "missing_required_input"
  | "duplicated_input"
  | "negative_input"
  | "invalid_unit"
  | "invalid_formula"
  | "invalid_result"
  | "unexpected_result"
  | "unsupported_formula"
  | "missing_step"
  | "invalid_final_step"
  | "non_reconstructable";

export interface CalculationValidationIssue {
  readonly severity: CalculationValidationSeverity;
  readonly code: CalculationValidationCode;
  readonly message: string;
  readonly path: string;
}

export interface CalculationValidationResult {
  readonly valid: boolean;
  readonly issues: ReadonlyArray<CalculationValidationIssue>;
  readonly warnings: ReadonlyArray<CalculationValidationIssue>;
  readonly errors: ReadonlyArray<CalculationValidationIssue>;
}

export interface CalculationValidationSummary {
  readonly valid: boolean;
  readonly totalIssues: number;
  readonly totalWarnings: number;
  readonly totalErrors: number;
}

export interface ValidateCalculationExecutionInput {
  readonly executionInput: CalculationExecutionInput;
  readonly executionResult: CalculationExecutionResult;
  readonly catalogEntry: MeasurementFormulaCatalogEntry | null;
}

/**
 * Validates the informed dimensions against what the catalog entry
 * declares as required — presence, duplicated names, negative values and
 * unit mismatches. Does not look at `CalculationExecutionResult` at all.
 */
export function validateCalculationDimensions(
  executionInput: CalculationExecutionInput,
  catalogEntry: MeasurementFormulaCatalogEntry | null,
): CalculationValidationResult {
  const issues: CalculationValidationIssue[] = [];

  if (catalogEntry === null) {
    issues.push(
      issue(
        CalculationValidationSeverity.Error,
        "invalid_formula",
        "formulaType",
        `Formula "${executionInput.formulaType}" is not present in the Measurement Formula Catalog.`,
      ),
    );
    return buildValidationResult(issues);
  }

  if (catalogEntry.formulaType !== executionInput.formulaType) {
    issues.push(
      issue(
        CalculationValidationSeverity.Error,
        "invalid_formula",
        "formulaType",
        `Catalog entry formulaType "${catalogEntry.formulaType}" does not match execution formulaType "${executionInput.formulaType}".`,
      ),
    );
    return buildValidationResult(issues);
  }

  const seenNames = new Set<string>();
  executionInput.dimensions.forEach((dimension) => {
    if (seenNames.has(dimension.name)) {
      issues.push(
        issue(
          CalculationValidationSeverity.Warning,
          "duplicated_input",
          `dimensions[name=${dimension.name}]`,
          `Dimension name "${dimension.name}" appears more than once among the provided dimensions.`,
        ),
      );
    } else {
      seenNames.add(dimension.name);
    }
  });

  catalogEntry.requiredInputs.forEach((requiredInput) => {
    const dimension = executionInput.dimensions.find((candidate) => candidate.name === requiredInput.key);

    if (dimension === undefined) {
      issues.push(
        issue(
          CalculationValidationSeverity.Error,
          "missing_required_input",
          `dimensions.${requiredInput.key}`,
          `Required input "${requiredInput.key}" (${requiredInput.label}) was not found among the provided dimensions.`,
        ),
      );
      return;
    }

    if (dimension.value < 0) {
      issues.push(
        issue(
          CalculationValidationSeverity.Error,
          "negative_input",
          `dimensions.${requiredInput.key}`,
          `Input "${requiredInput.key}" cannot be negative, got ${dimension.value}.`,
        ),
      );
    }

    if (dimension.unit !== requiredInput.unit) {
      issues.push(
        issue(
          CalculationValidationSeverity.Error,
          "invalid_unit",
          `dimensions.${requiredInput.key}`,
          `Input "${requiredInput.key}" expected unit "${requiredInput.unit}" but received "${dimension.unit}".`,
        ),
      );
    }
  });

  return buildValidationResult(issues);
}

/**
 * Validates the shape of a `CalculationExecutionResult` on its own
 * terms: result non-negativity, coherence with the catalog's declared
 * output unit, presence of steps, the single-final-step invariant, and
 * overall reconstructability. Never recomputes the result to check it —
 * only inspects the structure already produced by the Calculation Engine.
 */
export function validateCalculationResult(
  executionResult: CalculationExecutionResult,
  catalogEntry: MeasurementFormulaCatalogEntry | null,
): CalculationValidationResult {
  const issues: CalculationValidationIssue[] = [];

  if (executionResult.result === null) {
    executionResult.warnings.forEach((warning) => {
      issues.push(mapExecutionWarningToIssue(warning, catalogEntry));
    });

    issues.push(
      issue(
        CalculationValidationSeverity.Error,
        "non_reconstructable",
        "steps",
        "A failed execution cannot be reconstructed: it produced no result.",
      ),
    );

    return buildValidationResult(issues);
  }

  const { result } = executionResult;

  if (
    !Number.isFinite(result.value) ||
    result.value < 0 ||
    !Number.isInteger(result.precision) ||
    result.precision < 0 ||
    isBlank(result.unit)
  ) {
    issues.push(
      issue(
        CalculationValidationSeverity.Error,
        "invalid_result",
        "result.value",
        `Result value "${result.value}" is not a valid non-negative, finite measurement.`,
      ),
    );
  }

  if (catalogEntry === null) {
    issues.push(
      issue(
        CalculationValidationSeverity.Error,
        "invalid_formula",
        "catalogEntry",
        "No Measurement Formula Catalog entry was provided to validate this result against.",
      ),
    );
  } else if (result.unit !== catalogEntry.outputUnit) {
    issues.push(
      issue(
        CalculationValidationSeverity.Warning,
        "unexpected_result",
        "result.unit",
        `Result unit "${result.unit}" does not match the catalog's declared output unit "${catalogEntry.outputUnit}" for this formula.`,
      ),
    );
  }

  if (executionResult.steps.length === 0) {
    issues.push(
      issue(
        CalculationValidationSeverity.Error,
        "missing_step",
        "steps",
        "A successful execution must produce at least one CalculationStep.",
      ),
    );
  } else {
    const finalSteps = executionResult.steps.filter((step) => step.isFinal);
    const lastStep = executionResult.steps[executionResult.steps.length - 1];

    if (finalSteps.length !== 1 || lastStep === undefined || !lastStep.isFinal) {
      issues.push(
        issue(
          CalculationValidationSeverity.Error,
          "invalid_final_step",
          "steps",
          `Expected exactly one final step, positioned last; found ${finalSteps.length}.`,
        ),
      );
    }
  }

  if (!isCalculationReconstructable(executionResult)) {
    issues.push(
      issue(
        CalculationValidationSeverity.Error,
        "non_reconstructable",
        "steps",
        "This execution result cannot be fully reconstructed from its steps.",
      ),
    );
  }

  return buildValidationResult(issues);
}

/**
 * Runs both `validateCalculationDimensions` and `validateCalculationResult`
 * and merges their diagnostics. Does not perform any check the two do
 * not already perform on their own.
 */
export function validateCalculationExecution(
  input: ValidateCalculationExecutionInput,
): CalculationValidationResult {
  const dimensionsResult = validateCalculationDimensions(input.executionInput, input.catalogEntry);
  const resultResult = validateCalculationResult(input.executionResult, input.catalogEntry);

  return buildValidationResult([...dimensionsResult.issues, ...resultResult.issues]);
}

export function summarizeCalculationValidation(result: CalculationValidationResult): CalculationValidationSummary {
  return {
    valid: result.valid,
    totalIssues: result.issues.length,
    totalWarnings: result.warnings.length,
    totalErrors: result.errors.length,
  };
}

function mapExecutionWarningToIssue(
  warning: CalculationExecutionWarning,
  catalogEntry: MeasurementFormulaCatalogEntry | null,
): CalculationValidationIssue {
  switch (warning.code) {
    case "missing_required_input":
      return issue(CalculationValidationSeverity.Error, "missing_required_input", `dimensions.${warning.field}`, warning.message);

    case "negative_input_value":
      return issue(CalculationValidationSeverity.Error, "negative_input", `dimensions.${warning.field}`, warning.message);

    case "invalid_calculation_result":
      return issue(CalculationValidationSeverity.Error, "invalid_result", warning.field, warning.message);

    case "formula_not_yet_supported":
      return catalogEntry !== null
        ? issue(CalculationValidationSeverity.Warning, "unsupported_formula", warning.field, warning.message)
        : issue(CalculationValidationSeverity.Error, "invalid_formula", warning.field, warning.message);

    default:
      return issue(CalculationValidationSeverity.Error, "invalid_result", warning.field, warning.message);
  }
}

function issue(
  severity: CalculationValidationSeverity,
  code: CalculationValidationCode,
  path: string,
  message: string,
): CalculationValidationIssue {
  return { severity, code, path, message };
}

function buildValidationResult(issues: ReadonlyArray<CalculationValidationIssue>): CalculationValidationResult {
  const errors = issues.filter((candidate) => candidate.severity === CalculationValidationSeverity.Error);
  const warnings = issues.filter((candidate) => candidate.severity === CalculationValidationSeverity.Warning);

  return freezeDomainObject<CalculationValidationResult>({
    valid: errors.length === 0,
    issues,
    warnings,
    errors,
  });
}
