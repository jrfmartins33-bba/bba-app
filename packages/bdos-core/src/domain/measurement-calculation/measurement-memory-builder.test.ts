declare const process: { cwd(): string };

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CalculationFormulaType,
  MeasurementUnit,
  buildCalculationAuditTrail,
  buildMeasurementMemory,
  createCalculationMemory,
  executeCalculation,
  findMeasurementFormulaCatalogEntry,
  isMeasurementMemoryComplete,
  summarizeMeasurementMemory,
  validateCalculationExecution,
  type BuildMeasurementMemoryInput,
  type CalculationMemory,
  type CalculationMemoryResult,
  type MeasurementDimensionInput,
} from "./index";

const memoryId = "calc-memory-mb-001";
const actor = "engineer-bruno";
const occurredAt = "2026-07-03T14:00:00Z";
const correlationId = "measurement-memory-builder-correlation-001";
const createdBy = "engineering-app";
const sourceSystem = "engineering-workspace";

runTest("builds a measurement memory document from a successful calculation", () => {
  const input = buildCompleteInputFixture();
  const document = buildMeasurementMemory(input);

  assertEqual(document.formulaType, CalculationFormulaType.AreaRectangle, "formulaType mismatch");
  assertEqual(document.title, input.memory.title, "title mismatch");
  assertEqual(document.result?.value, 2000, "expected 4 x 500 = 2000");
  assertEqual(document.result?.unit, MeasurementUnit.SquareMeter, "unit mismatch");
  assertEqual(document.reconstructable, true, "expected reconstructable true");
});

runTest("summarizeMeasurementMemory reflects the document summary", () => {
  const input = buildCompleteInputFixture();
  const document = buildMeasurementMemory(input);
  const summary = summarizeMeasurementMemory(document);

  assertEqual(summary, document.summary, "summarizeMeasurementMemory must return the document's own summary");
  assertEqual(summary.totalDimensions, input.memory.dimensions.length, "totalDimensions mismatch");
  assertEqual(summary.totalSteps, input.executionResult.steps.length, "totalSteps mismatch");
  assertEqual(summary.finalResult, 2000, "finalResult mismatch");
  assertEqual(summary.unit, MeasurementUnit.SquareMeter, "unit mismatch");
  assertEqual(summary.formulaType, CalculationFormulaType.AreaRectangle, "formulaType mismatch");
});

runTest("result is copied exactly, never recalculated", () => {
  const input = buildCompleteInputFixture();
  const document = buildMeasurementMemory(input);

  assertEqual(JSON.stringify(document.result), JSON.stringify(input.executionResult.result), "result must be an exact copy");
});

runTest("steps are preserved exactly from the execution result and audit trail", () => {
  const input = buildCompleteInputFixture();
  const document = buildMeasurementMemory(input);

  assertEqual(document.steps.length, input.executionResult.steps.length, "steps length mismatch");
  assertEqual(JSON.stringify(document.steps), JSON.stringify(input.executionResult.steps), "steps must be an exact copy");
  assertEqual(JSON.stringify(document.steps), JSON.stringify(input.auditTrail.steps), "steps must match the audit trail too");
});

runTest("dimensions are preserved exactly from the CalculationMemory aggregate", () => {
  const input = buildCompleteInputFixture();
  const document = buildMeasurementMemory(input);

  assertEqual(document.dimensions.length, input.memory.dimensions.length, "dimensions length mismatch");
  assertEqual(JSON.stringify(document.dimensions), JSON.stringify(input.memory.dimensions), "dimensions must be an exact copy");
  assertEqual(document.dimensions[0]?.name, "width", "dimension name mismatch");
});

runTest("audit trail is preserved exactly (generatedFromAudit)", () => {
  const input = buildCompleteInputFixture();
  const document = buildMeasurementMemory(input);

  assertEqual(JSON.stringify(document.generatedFromAudit), JSON.stringify(input.auditTrail), "generatedFromAudit must be an exact copy");
});

runTest("validation result is preserved exactly (generatedFromValidation)", () => {
  const input = buildCompleteInputFixture();
  const document = buildMeasurementMemory(input);

  assertEqual(JSON.stringify(document.generatedFromValidation), JSON.stringify(input.validationResult), "generatedFromValidation must be an exact copy");
});

runTest("calculation execution result is preserved exactly (generatedFromCalculation)", () => {
  const input = buildCompleteInputFixture();
  const document = buildMeasurementMemory(input);

  assertEqual(JSON.stringify(document.generatedFromCalculation), JSON.stringify(input.executionResult), "generatedFromCalculation must be an exact copy");
});

runTest("reconstructable reflects the audit trail's own reconstructable flag", () => {
  const complete = buildCompleteInputFixture();
  const completeDocument = buildMeasurementMemory(complete);
  assertEqual(completeDocument.reconstructable, complete.auditTrail.reconstructable, "reconstructable mismatch (true case)");
  assertEqual(completeDocument.reconstructable, true, "expected true for a successful calculation");

  const incomplete = buildIncompleteInputFixture();
  const incompleteDocument = buildMeasurementMemory(incomplete);
  assertEqual(incompleteDocument.reconstructable, incomplete.auditTrail.reconstructable, "reconstructable mismatch (false case)");
  assertEqual(incompleteDocument.reconstructable, false, "expected false for a failed calculation");
});

runTest("isMeasurementMemoryComplete is true for a successful, reconstructable, valid calculation", () => {
  const document = buildMeasurementMemory(buildCompleteInputFixture());
  assertEqual(isMeasurementMemoryComplete(document), true, "expected a complete memory");
});

runTest("isMeasurementMemoryComplete is false when the calculation failed (validation invalid, audit non-reconstructable)", () => {
  const input = buildIncompleteInputFixture();
  const document = buildMeasurementMemory(input);

  assertEqual(document.generatedFromValidation.valid, false, "expected the validation to report invalid");
  assertEqual(document.reconstructable, false, "expected reconstructable false");
  assertEqual(document.result, null, "expected null result");
  assertEqual(isMeasurementMemoryComplete(document), false, "expected an incomplete memory");
});

runTest("the memory is still built even when validation and audit report failure", () => {
  const input = buildIncompleteInputFixture();
  const document = buildMeasurementMemory(input);

  assertEqual(document.formulaType, CalculationFormulaType.AreaRectangle, "expected the document to still be built");
  assertEqual(document.title, input.memory.title, "expected the document to still carry the memory's title");
  assertEqual(Array.isArray(document.steps), true, "expected steps to still be an array (empty on failure)");
});

runTest("document output is deeply immutable", () => {
  const document = buildMeasurementMemory(buildCompleteInputFixture());

  assertEqual(Object.isFrozen(document), true, "document should be frozen");
  assertEqual(Object.isFrozen(document.summary), true, "summary should be frozen");
  assertEqual(Object.isFrozen(document.steps), true, "steps should be frozen");
  assertEqual(Object.isFrozen(document.dimensions), true, "dimensions should be frozen");
  assertEqual(Object.isFrozen(document.generatedFromCalculation), true, "generatedFromCalculation should be frozen");
  assertEqual(Object.isFrozen(document.generatedFromAudit), true, "generatedFromAudit should be frozen");
  assertEqual(Object.isFrozen(document.generatedFromValidation), true, "generatedFromValidation should be frozen");

  assertThrows(() => {
    (document as unknown as { title: string }).title = "mutated";
  }, "mutating a frozen document must throw in strict mode");
});

runTest("buildMeasurementMemory never mutates any of its four inputs", () => {
  const input = buildCompleteInputFixture();
  const beforeMemory = JSON.stringify(input.memory);
  const beforeExecutionResult = JSON.stringify(input.executionResult);
  const beforeAuditTrail = JSON.stringify(input.auditTrail);
  const beforeValidationResult = JSON.stringify(input.validationResult);

  buildMeasurementMemory(input);

  assertEqual(JSON.stringify(input.memory), beforeMemory, "memory must remain unchanged");
  assertEqual(JSON.stringify(input.executionResult), beforeExecutionResult, "executionResult must remain unchanged");
  assertEqual(JSON.stringify(input.auditTrail), beforeAuditTrail, "auditTrail must remain unchanged");
  assertEqual(JSON.stringify(input.validationResult), beforeValidationResult, "validationResult must remain unchanged");
});

runTest("buildMeasurementMemory is deterministic for identical input", () => {
  const buildDocument = () => buildMeasurementMemory(buildCompleteInputFixture());

  const first = JSON.stringify(buildDocument());
  const second = JSON.stringify(buildDocument());

  assertEqual(first, second, "expected deterministic document output for identical input");
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
  ].forEach((forbidden) => {
    assertEqual(
      lowerSourceCode.includes(forbidden),
      false,
      `unexpected forbidden construct in memory builder source: ${forbidden}`,
    );
  });
});

// --- Fixtures ------------------------------------------------------------------

function buildCompleteInputFixture(): BuildMeasurementMemoryInput {
  const memory = buildMemoryFixture([
    dimensionInputFixture({ id: "dim-width", name: "width", value: 4 }),
    dimensionInputFixture({ id: "dim-length", name: "length", value: 500 }),
  ]);

  const executionResult = executeCalculation({
    formulaType: memory.formulaType,
    dimensions: memory.dimensions,
  });
  const auditTrail = buildCalculationAuditTrail({ formulaType: memory.formulaType, executionResult });
  const catalogEntry = findMeasurementFormulaCatalogEntry(memory.formulaType);
  const validationResult = validateCalculationExecution({
    executionInput: { formulaType: memory.formulaType, dimensions: memory.dimensions },
    executionResult,
    catalogEntry,
  });

  return { memory, executionResult, auditTrail, validationResult };
}

function buildIncompleteInputFixture(): BuildMeasurementMemoryInput {
  const memory = buildMemoryFixture([dimensionInputFixture({ id: "dim-width", name: "width", value: 4 })]);

  const executionResult = executeCalculation({
    formulaType: memory.formulaType,
    dimensions: memory.dimensions,
  });
  const auditTrail = buildCalculationAuditTrail({ formulaType: memory.formulaType, executionResult });
  const catalogEntry = findMeasurementFormulaCatalogEntry(memory.formulaType);
  const validationResult = validateCalculationExecution({
    executionInput: { formulaType: memory.formulaType, dimensions: memory.dimensions },
    executionResult,
    catalogEntry,
  });

  return { memory, executionResult, auditTrail, validationResult };
}

function buildMemoryFixture(dimensions: ReadonlyArray<MeasurementDimensionInput>): CalculationMemory {
  const created = createCalculationMemory({
    id: memoryId,
    title: "Area do passeio - Trecho 01",
    description: "Memoria de calculo da area do passeio no trecho 01.",
    formulaType: CalculationFormulaType.AreaRectangle,
    dimensions,
    actor,
    occurredAt,
    correlationId,
    createdBy,
    sourceSystem,
    metadata: { source: "measurement-memory-builder" },
  });
  assertMemorySuccess(created, "expected creation success");
  return created.memory;
}

function dimensionInputFixture(
  overrides: Partial<MeasurementDimensionInput> = {},
): MeasurementDimensionInput {
  return {
    id: overrides.id ?? "dim-001",
    name: overrides.name ?? "width",
    value: overrides.value ?? 4,
    unit: overrides.unit ?? MeasurementUnit.Meter,
    notes: overrides.notes,
    sourceEvidenceIds: overrides.sourceEvidenceIds,
  };
}

function readOwnSourceFile(): string {
  const filePath = resolve(
    process.cwd(),
    "src",
    "domain",
    "measurement-calculation",
    "measurement-memory-builder.ts",
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

function assertMemorySuccess(
  result: CalculationMemoryResult,
  message: string,
): asserts result is Extract<CalculationMemoryResult, { readonly success: true }> {
  if (!result.success) {
    throw new Error(`${message}: ${JSON.stringify(result.errors)}`);
  }
}
