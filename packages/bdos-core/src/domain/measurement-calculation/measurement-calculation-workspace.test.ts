declare const process: { cwd(): string };

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CalculationFormulaType,
  MeasurementUnit,
  buildCalculationAuditTrail,
  buildMeasurementCalculationWorkspace,
  buildMeasurementMemory,
  createCalculationMemory,
  executeCalculation,
  findMeasurementFormulaCatalogEntry,
  isMeasurementCalculationWorkspaceReady,
  summarizeMeasurementCalculationWorkspace,
  validateCalculationExecution,
  type BuildMeasurementCalculationWorkspaceInput,
  type CalculationMemory,
  type CalculationMemoryResult,
  type MeasurementDimensionInput,
} from "./index";

const memoryId = "calc-memory-ws-001";
const actor = "engineer-bruno";
const occurredAt = "2026-07-03T14:00:00Z";
const correlationId = "measurement-calculation-workspace-correlation-001";
const createdBy = "engineering-app";
const sourceSystem = "engineering-workspace";

runTest("builds a workspace from a successful, valid, reconstructable calculation", () => {
  const input = buildCompleteInputFixture();
  const workspace = buildMeasurementCalculationWorkspace(input);

  assertEqual(workspace.memory.formulaType, CalculationFormulaType.AreaRectangle, "formulaType mismatch");
  assertEqual(workspace.execution.result?.value, 2000, "expected 4 x 500 = 2000");
  assertEqual(workspace.isValid, true, "expected isValid true");
  assertEqual(workspace.isReconstructable, true, "expected isReconstructable true");
  assertEqual(workspace.isComplete, true, "expected isComplete true");
});

runTest("summarizeMeasurementCalculationWorkspace reflects the workspace's own statusSummary", () => {
  const workspace = buildMeasurementCalculationWorkspace(buildCompleteInputFixture());
  const summary = summarizeMeasurementCalculationWorkspace(workspace);

  assertEqual(summary, workspace.statusSummary, "summarizeMeasurementCalculationWorkspace must return the workspace's own summary");
  assertEqual(summary.formulaType, CalculationFormulaType.AreaRectangle, "formulaType mismatch");
  assertEqual(summary.calculationStatus, "success", "calculationStatus mismatch");
  assertEqual(summary.validationStatus, "valid", "validationStatus mismatch");
  assertEqual(summary.auditStatus, "reconstructable", "auditStatus mismatch");
  assertEqual(summary.result, 2000, "result mismatch");
  assertEqual(summary.unit, MeasurementUnit.SquareMeter, "unit mismatch");
});

runTest("isValid reflects validation.valid", () => {
  const completeWorkspace = buildMeasurementCalculationWorkspace(buildCompleteInputFixture());
  assertEqual(completeWorkspace.isValid, completeWorkspace.validation.valid, "isValid must mirror validation.valid (true case)");

  const incompleteWorkspace = buildMeasurementCalculationWorkspace(buildIncompleteInputFixture());
  assertEqual(incompleteWorkspace.isValid, incompleteWorkspace.validation.valid, "isValid must mirror validation.valid (false case)");
  assertEqual(incompleteWorkspace.isValid, false, "expected isValid false for a failed calculation");
});

runTest("isReconstructable reflects audit.reconstructable", () => {
  const completeWorkspace = buildMeasurementCalculationWorkspace(buildCompleteInputFixture());
  assertEqual(completeWorkspace.isReconstructable, completeWorkspace.audit.reconstructable, "isReconstructable must mirror audit.reconstructable (true case)");

  const incompleteWorkspace = buildMeasurementCalculationWorkspace(buildIncompleteInputFixture());
  assertEqual(incompleteWorkspace.isReconstructable, incompleteWorkspace.audit.reconstructable, "isReconstructable must mirror audit.reconstructable (false case)");
  assertEqual(incompleteWorkspace.isReconstructable, false, "expected isReconstructable false for a failed calculation");
});

runTest("isComplete reflects isMeasurementMemoryComplete on the embedded measurementMemory", () => {
  const completeWorkspace = buildMeasurementCalculationWorkspace(buildCompleteInputFixture());
  assertEqual(completeWorkspace.isComplete, true, "expected isComplete true");

  const incompleteWorkspace = buildMeasurementCalculationWorkspace(buildIncompleteInputFixture());
  assertEqual(incompleteWorkspace.isComplete, false, "expected isComplete false");
});

runTest("isMeasurementCalculationWorkspaceReady is true only when valid, reconstructable and complete", () => {
  const completeWorkspace = buildMeasurementCalculationWorkspace(buildCompleteInputFixture());
  assertEqual(isMeasurementCalculationWorkspaceReady(completeWorkspace), true, "expected ready true");

  const incompleteWorkspace = buildMeasurementCalculationWorkspace(buildIncompleteInputFixture());
  assertEqual(isMeasurementCalculationWorkspaceReady(incompleteWorkspace), false, "expected ready false");
});

runTest("all five artifacts are preserved exactly, never recalculated", () => {
  const input = buildCompleteInputFixture();
  const workspace = buildMeasurementCalculationWorkspace(input);

  assertEqual(JSON.stringify(workspace.memory), JSON.stringify(input.memory), "memory must be an exact copy");
  assertEqual(JSON.stringify(workspace.execution), JSON.stringify(input.execution), "execution must be an exact copy");
  assertEqual(JSON.stringify(workspace.audit), JSON.stringify(input.audit), "audit must be an exact copy");
  assertEqual(JSON.stringify(workspace.validation), JSON.stringify(input.validation), "validation must be an exact copy");
  assertEqual(JSON.stringify(workspace.measurementMemory), JSON.stringify(input.measurementMemory), "measurementMemory must be an exact copy");
});

runTest("workspace output is deeply immutable", () => {
  const workspace = buildMeasurementCalculationWorkspace(buildCompleteInputFixture());

  assertEqual(Object.isFrozen(workspace), true, "workspace should be frozen");
  assertEqual(Object.isFrozen(workspace.memory), true, "memory should be frozen");
  assertEqual(Object.isFrozen(workspace.execution), true, "execution should be frozen");
  assertEqual(Object.isFrozen(workspace.audit), true, "audit should be frozen");
  assertEqual(Object.isFrozen(workspace.validation), true, "validation should be frozen");
  assertEqual(Object.isFrozen(workspace.measurementMemory), true, "measurementMemory should be frozen");
  assertEqual(Object.isFrozen(workspace.statusSummary), true, "statusSummary should be frozen");

  assertThrows(() => {
    (workspace as unknown as { isValid: boolean }).isValid = false;
  }, "mutating a frozen workspace must throw in strict mode");
});

runTest("buildMeasurementCalculationWorkspace never mutates any of its five inputs", () => {
  const input = buildCompleteInputFixture();
  const beforeMemory = JSON.stringify(input.memory);
  const beforeExecution = JSON.stringify(input.execution);
  const beforeAudit = JSON.stringify(input.audit);
  const beforeValidation = JSON.stringify(input.validation);
  const beforeMeasurementMemory = JSON.stringify(input.measurementMemory);

  buildMeasurementCalculationWorkspace(input);

  assertEqual(JSON.stringify(input.memory), beforeMemory, "memory must remain unchanged");
  assertEqual(JSON.stringify(input.execution), beforeExecution, "execution must remain unchanged");
  assertEqual(JSON.stringify(input.audit), beforeAudit, "audit must remain unchanged");
  assertEqual(JSON.stringify(input.validation), beforeValidation, "validation must remain unchanged");
  assertEqual(JSON.stringify(input.measurementMemory), beforeMeasurementMemory, "measurementMemory must remain unchanged");
});

runTest("buildMeasurementCalculationWorkspace is deterministic for identical input", () => {
  const buildWorkspace = () => buildMeasurementCalculationWorkspace(buildCompleteInputFixture());

  const first = JSON.stringify(buildWorkspace());
  const second = JSON.stringify(buildWorkspace());

  assertEqual(first, second, "expected deterministic workspace output for identical input");
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
      `unexpected forbidden construct in workspace source: ${forbidden}`,
    );
  });
});

// --- Fixtures ------------------------------------------------------------------

function buildCompleteInputFixture(): BuildMeasurementCalculationWorkspaceInput {
  return buildWorkspaceInputFromDimensions([
    dimensionInputFixture({ id: "dim-width", name: "width", value: 4 }),
    dimensionInputFixture({ id: "dim-length", name: "length", value: 500 }),
  ]);
}

function buildIncompleteInputFixture(): BuildMeasurementCalculationWorkspaceInput {
  return buildWorkspaceInputFromDimensions([dimensionInputFixture({ id: "dim-width", name: "width", value: 4 })]);
}

function buildWorkspaceInputFromDimensions(
  dimensions: ReadonlyArray<MeasurementDimensionInput>,
): BuildMeasurementCalculationWorkspaceInput {
  const memory = buildMemoryFixture(dimensions);

  const execution = executeCalculation({ formulaType: memory.formulaType, dimensions: memory.dimensions });
  const audit = buildCalculationAuditTrail({ formulaType: memory.formulaType, executionResult: execution });
  const catalogEntry = findMeasurementFormulaCatalogEntry(memory.formulaType);
  const validation = validateCalculationExecution({
    executionInput: { formulaType: memory.formulaType, dimensions: memory.dimensions },
    executionResult: execution,
    catalogEntry,
  });
  const measurementMemory = buildMeasurementMemory({
    memory,
    executionResult: execution,
    auditTrail: audit,
    validationResult: validation,
  });

  return { memory, execution, audit, validation, measurementMemory };
}

function buildMemoryFixture(dimensions: ReadonlyArray<MeasurementDimensionInput>): CalculationMemory {
  const created = createCalculationMemory({
    id: memoryId,
    title: "Area do passeio - Trecho 02",
    description: "Memoria de calculo da area do passeio no trecho 02.",
    formulaType: CalculationFormulaType.AreaRectangle,
    dimensions,
    actor,
    occurredAt,
    correlationId,
    createdBy,
    sourceSystem,
    metadata: { source: "measurement-calculation-workspace" },
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
    "measurement-calculation-workspace.ts",
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
