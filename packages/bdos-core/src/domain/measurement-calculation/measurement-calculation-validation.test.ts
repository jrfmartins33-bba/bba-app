declare const process: { cwd(): string };

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CalculationFormulaType,
  CalculationOperator,
  CalculationStepKind,
  CalculationValidationSeverity,
  MeasurementUnit,
  executeCalculation,
  findMeasurementFormulaCatalogEntry,
  summarizeCalculationValidation,
  validateCalculationDimensions,
  validateCalculationExecution,
  validateCalculationResult,
  type CalculationExecutionInput,
  type CalculationExecutionResult,
  type CalculationStep,
  type MeasurementDimension,
  type MeasurementFormulaCatalogEntry,
} from "./index";

runTest("valid execution produces no issues", () => {
  const { executionInput, executionResult, catalogEntry } = runAreaRectangle([
    dimension("width", 4, MeasurementUnit.Meter),
    dimension("length", 500, MeasurementUnit.Meter),
  ]);

  const result = validateCalculationExecution({ executionInput, executionResult, catalogEntry });

  assertEqual(result.valid, true, "expected a valid execution to pass validation");
  assertEqual(result.issues.length, 0, "expected zero issues");
  assertEqual(result.errors.length, 0, "expected zero errors");
  assertEqual(result.warnings.length, 0, "expected zero warnings");
});

runTest("flags a missing required input", () => {
  const { executionInput, catalogEntry } = runAreaRectangle([dimension("width", 4, MeasurementUnit.Meter)]);

  const result = validateCalculationDimensions(executionInput, catalogEntry);

  assertEqual(result.valid, false, "expected invalid result");
  assertEqual(hasIssue(result, "missing_required_input", CalculationValidationSeverity.Error), true, "expected missing_required_input error");
});

runTest("flags a duplicated input name", () => {
  const { executionInput, catalogEntry } = runAreaRectangle([
    dimension("width", 4, MeasurementUnit.Meter),
    dimension("width", 4, MeasurementUnit.Meter),
    dimension("length", 500, MeasurementUnit.Meter),
  ]);

  const result = validateCalculationDimensions(executionInput, catalogEntry);

  assertEqual(hasIssue(result, "duplicated_input", CalculationValidationSeverity.Warning), true, "expected duplicated_input warning");
});

runTest("flags a negative input value", () => {
  const { executionInput, catalogEntry } = runAreaRectangle([
    dimension("width", -1, MeasurementUnit.Meter),
    dimension("length", 500, MeasurementUnit.Meter),
  ]);

  const result = validateCalculationDimensions(executionInput, catalogEntry);

  assertEqual(result.valid, false, "expected invalid result");
  assertEqual(hasIssue(result, "negative_input", CalculationValidationSeverity.Error), true, "expected negative_input error");
});

runTest("flags an invalid unit", () => {
  const { executionInput, catalogEntry } = runAreaRectangle([
    dimension("width", 4, MeasurementUnit.Kilogram),
    dimension("length", 500, MeasurementUnit.Meter),
  ]);

  const result = validateCalculationDimensions(executionInput, catalogEntry);

  assertEqual(result.valid, false, "expected invalid result");
  assertEqual(hasIssue(result, "invalid_unit", CalculationValidationSeverity.Error), true, "expected invalid_unit error");
});

runTest("flags a formula that does not exist in the catalog", () => {
  const executionInput: CalculationExecutionInput = {
    formulaType: "not_a_real_formula" as CalculationFormulaType,
    dimensions: [],
  };

  const result = validateCalculationDimensions(executionInput, null);

  assertEqual(result.valid, false, "expected invalid result");
  assertEqual(hasIssue(result, "invalid_formula", CalculationValidationSeverity.Error), true, "expected invalid_formula error");
});

runTest("flags a structurally invalid (non-finite) result without recalculating", () => {
  const catalogEntry = findMeasurementFormulaCatalogEntry(CalculationFormulaType.AreaRectangle);
  const executionResult = handCraftedResult(Number.NaN, MeasurementUnit.SquareMeter, [finalStep(2, Number.NaN, MeasurementUnit.SquareMeter)]);

  const result = validateCalculationResult(executionResult, catalogEntry);

  assertEqual(result.valid, false, "expected invalid result");
  assertEqual(hasIssue(result, "invalid_result", CalculationValidationSeverity.Error), true, "expected invalid_result error");
});

runTest("flags a negative result value without recalculating", () => {
  const catalogEntry = findMeasurementFormulaCatalogEntry(CalculationFormulaType.AreaRectangle);
  const executionResult = handCraftedResult(-10, MeasurementUnit.SquareMeter, [finalStep(1, -10, MeasurementUnit.SquareMeter)]);

  const result = validateCalculationResult(executionResult, catalogEntry);

  assertEqual(result.valid, false, "expected invalid result");
  assertEqual(hasIssue(result, "invalid_result", CalculationValidationSeverity.Error), true, "expected invalid_result error for a negative value");
});

runTest("flags a successful result with no steps", () => {
  const catalogEntry = findMeasurementFormulaCatalogEntry(CalculationFormulaType.AreaRectangle);
  const executionResult: CalculationExecutionResult = {
    result: { value: 2000, unit: MeasurementUnit.SquareMeter, precision: 0, rounded: false },
    steps: [],
    warnings: [],
  };

  const result = validateCalculationResult(executionResult, catalogEntry);

  assertEqual(result.valid, false, "expected invalid result");
  assertEqual(hasIssue(result, "missing_step", CalculationValidationSeverity.Error), true, "expected missing_step error");
  assertEqual(hasIssue(result, "non_reconstructable", CalculationValidationSeverity.Error), true, "expected non_reconstructable error");
});

runTest("flags a result whose steps have no final step", () => {
  const catalogEntry = findMeasurementFormulaCatalogEntry(CalculationFormulaType.AreaRectangle);
  const executionResult: CalculationExecutionResult = {
    result: { value: 2000, unit: MeasurementUnit.SquareMeter, precision: 0, rounded: false },
    steps: [inputStep(1, "width", 4, MeasurementUnit.Meter)],
    warnings: [],
  };

  const result = validateCalculationResult(executionResult, catalogEntry);

  assertEqual(result.valid, false, "expected invalid result");
  assertEqual(hasIssue(result, "invalid_final_step", CalculationValidationSeverity.Error), true, "expected invalid_final_step error");
});

runTest("flags a result whose steps have two final steps", () => {
  const catalogEntry = findMeasurementFormulaCatalogEntry(CalculationFormulaType.AreaRectangle);
  const executionResult: CalculationExecutionResult = {
    result: { value: 2000, unit: MeasurementUnit.SquareMeter, precision: 0, rounded: false },
    steps: [finalStep(1, 4, MeasurementUnit.Meter), finalStep(2, 2000, MeasurementUnit.SquareMeter)],
    warnings: [],
  };

  const result = validateCalculationResult(executionResult, catalogEntry);

  assertEqual(result.valid, false, "expected invalid result");
  assertEqual(hasIssue(result, "invalid_final_step", CalculationValidationSeverity.Error), true, "expected invalid_final_step error for two final steps");
});

runTest("flags a non-reconstructable execution explicitly", () => {
  const catalogEntry = findMeasurementFormulaCatalogEntry(CalculationFormulaType.AreaRectangle);
  const executionResult: CalculationExecutionResult = {
    result: { value: 2000, unit: MeasurementUnit.SquareMeter, precision: 0, rounded: false },
    steps: [inputStep(1, "width", 4, MeasurementUnit.Meter), inputStep(2, "length", 500, MeasurementUnit.Meter)],
    warnings: [],
  };

  const result = validateCalculationResult(executionResult, catalogEntry);

  assertEqual(hasIssue(result, "non_reconstructable", CalculationValidationSeverity.Error), true, "expected non_reconstructable error");
});

runTest("flags a failed (missing-input) execution end to end via validateCalculationExecution", () => {
  const { executionInput, executionResult, catalogEntry } = runAreaRectangle([
    dimension("width", 4, MeasurementUnit.Meter),
  ]);

  const result = validateCalculationExecution({ executionInput, executionResult, catalogEntry });

  assertEqual(result.valid, false, "expected invalid result");
  assertEqual(hasIssue(result, "non_reconstructable", CalculationValidationSeverity.Error), true, "a failed execution is never reconstructable");
});

runTest("summarizeCalculationValidation reflects a valid result", () => {
  const { executionInput, executionResult, catalogEntry } = runAreaRectangle([
    dimension("width", 4, MeasurementUnit.Meter),
    dimension("length", 500, MeasurementUnit.Meter),
  ]);
  const result = validateCalculationExecution({ executionInput, executionResult, catalogEntry });
  const summary = summarizeCalculationValidation(result);

  assertEqual(summary.valid, true, "summary valid mismatch");
  assertEqual(summary.totalIssues, result.issues.length, "summary totalIssues mismatch");
  assertEqual(summary.totalWarnings, result.warnings.length, "summary totalWarnings mismatch");
  assertEqual(summary.totalErrors, result.errors.length, "summary totalErrors mismatch");
});

runTest("summarizeCalculationValidation reflects an invalid result", () => {
  const { executionInput, executionResult, catalogEntry } = runAreaRectangle([
    dimension("width", -1, MeasurementUnit.Meter),
    dimension("length", 500, MeasurementUnit.Meter),
  ]);
  const result = validateCalculationExecution({ executionInput, executionResult, catalogEntry });
  const summary = summarizeCalculationValidation(result);

  assertEqual(summary.valid, false, "summary valid mismatch");
  assertEqual(summary.totalErrors > 0, true, "expected at least one error");
});

runTest("validation output is deeply immutable", () => {
  const { executionInput, executionResult, catalogEntry } = runAreaRectangle([
    dimension("width", 4, MeasurementUnit.Meter),
    dimension("length", 500, MeasurementUnit.Meter),
  ]);
  const result = validateCalculationExecution({ executionInput, executionResult, catalogEntry });

  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(Object.isFrozen(result.issues), true, "issues array should be frozen");
  assertEqual(Object.isFrozen(result.warnings), true, "warnings array should be frozen");
  assertEqual(Object.isFrozen(result.errors), true, "errors array should be frozen");

  assertThrows(() => {
    (result as unknown as { valid: boolean }).valid = false;
  }, "mutating a frozen validation result must throw in strict mode");
});

runTest("validation never mutates the execution input, execution result, or catalog entry", () => {
  const { executionInput, executionResult, catalogEntry } = runAreaRectangle([
    dimension("width", 4, MeasurementUnit.Meter),
    dimension("length", 500, MeasurementUnit.Meter),
  ]);

  const beforeInput = JSON.stringify(executionInput);
  const beforeResult = JSON.stringify(executionResult);
  const beforeCatalog = JSON.stringify(catalogEntry);

  validateCalculationExecution({ executionInput, executionResult, catalogEntry });

  assertEqual(JSON.stringify(executionInput), beforeInput, "executionInput must remain unchanged");
  assertEqual(JSON.stringify(executionResult), beforeResult, "executionResult must remain unchanged");
  assertEqual(JSON.stringify(catalogEntry), beforeCatalog, "catalogEntry must remain unchanged");
});

runTest("validation is deterministic for identical input", () => {
  const buildValidation = () => {
    const { executionInput, executionResult, catalogEntry } = runAreaRectangle([
      dimension("width", 4, MeasurementUnit.Meter),
      dimension("length", 500, MeasurementUnit.Meter),
    ]);
    return validateCalculationExecution({ executionInput, executionResult, catalogEntry });
  };

  const first = JSON.stringify(buildValidation());
  const second = JSON.stringify(buildValidation());

  assertEqual(first, second, "expected deterministic validation output for identical input");
});

runTest("does not import any forbidden domain or use non-deterministic constructs", () => {
  const sourceCode = readOwnSourceFile();
  const lowerSourceCode = sourceCode.toLowerCase();

  [
    "date.now(",
    "math.random(",
    "crypto.randomuuid",
    "uuid()",
    "field-evidence",
    "engineering-contract",
    "engineering-project-context",
    "measurement-workspace",
    "approval-workflow",
    "official-template",
    "export-engine",
    "decision-engine",
    "engines/decision",
    "business-fact",
    "react",
    "next",
    "supabase",
    "\"fs\"",
    "'fs'",
    "node:fs",
    "\"path\"",
    "'path'",
    "node:path",
    "xlsx",
    "pdf-lib",
    "pdfkit",
    "docx",
    "ocr",
    "gps.get",
    "whatsapp",
    "tensorflow",
    "openai",
    "fetch(",
    " eval(",
    "new function(",
    "reflect.",
  ].forEach((forbidden) => {
    assertEqual(
      lowerSourceCode.includes(forbidden),
      false,
      `unexpected forbidden construct in validation source: ${forbidden}`,
    );
  });
});

// --- Fixtures ------------------------------------------------------------------

function dimension(name: string, value: number, unit: MeasurementUnit): MeasurementDimension {
  return { id: `dim-${name}`, name, value, unit, notes: null, sourceEvidenceIds: [] };
}

function runAreaRectangle(dimensions: ReadonlyArray<MeasurementDimension>): {
  executionInput: CalculationExecutionInput;
  executionResult: CalculationExecutionResult;
  catalogEntry: MeasurementFormulaCatalogEntry | null;
} {
  const executionInput: CalculationExecutionInput = {
    formulaType: CalculationFormulaType.AreaRectangle,
    dimensions,
  };
  const executionResult = executeCalculation(executionInput);
  const catalogEntry = findMeasurementFormulaCatalogEntry(CalculationFormulaType.AreaRectangle);

  return { executionInput, executionResult, catalogEntry };
}

function inputStep(order: number, key: string, value: number, unit: MeasurementUnit): CalculationStep {
  return {
    order,
    kind: CalculationStepKind.Input,
    description: key,
    expression: `${key} = ${value}`,
    inputKeys: [key],
    operator: CalculationOperator.None,
    value,
    unit,
    isFinal: false,
  };
}

function finalStep(order: number, value: number, unit: MeasurementUnit): CalculationStep {
  return {
    order,
    kind: CalculationStepKind.Result,
    description: "Resultado",
    expression: `${value}`,
    inputKeys: ["width", "length"],
    operator: CalculationOperator.Multiply,
    value,
    unit,
    isFinal: true,
  };
}

function handCraftedResult(
  value: number,
  unit: MeasurementUnit,
  steps: ReadonlyArray<CalculationStep>,
): CalculationExecutionResult {
  return {
    result: { value, unit, precision: 0, rounded: false },
    steps,
    warnings: [],
  };
}

function hasIssue(
  result: { readonly issues: ReadonlyArray<{ readonly code: string; readonly severity: CalculationValidationSeverity }> },
  code: string,
  severity: CalculationValidationSeverity,
): boolean {
  return result.issues.some((candidate) => candidate.code === code && candidate.severity === severity);
}

function readOwnSourceFile(): string {
  const filePath = resolve(
    process.cwd(),
    "src",
    "domain",
    "measurement-calculation",
    "measurement-calculation-validation.ts",
  );
  return readFileSync(filePath, "utf8");
}

// --- Test harness ----------------------------------------------------------------

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertThrows(fn: () => void, message: string): void {
  let threw = false;

  try {
    fn();
  } catch {
    threw = true;
  }

  if (!threw) {
    throw new Error(message);
  }
}
