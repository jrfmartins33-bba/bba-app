declare const process: { cwd(): string };

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CalculationFormulaType,
  CalculationOperator,
  CalculationStepKind,
  MeasurementUnit,
  buildCalculationAuditTrail,
  executeCalculation,
  isCalculationReconstructable,
  summarizeCalculationAuditTrail,
  type CalculationExecutionResult,
  type MeasurementDimension,
} from "./index";

runTest("builds an audit trail for a successful calculation", () => {
  const executionResult = executeCalculation({
    formulaType: CalculationFormulaType.AreaRectangle,
    dimensions: [dimension("width", 4, MeasurementUnit.Meter), dimension("length", 500, MeasurementUnit.Meter)],
  });

  const trail = buildCalculationAuditTrail({ formulaType: CalculationFormulaType.AreaRectangle, executionResult });

  assertEqual(trail.formulaType, CalculationFormulaType.AreaRectangle, "formulaType mismatch");
  assertEqual(trail.steps.length, 3, "expected 2 input steps + 1 result step");
  assertEqual(trail.finalResult?.value, 2000, "finalResult value mismatch");
  assertEqual(trail.finalResult?.unit, MeasurementUnit.SquareMeter, "finalResult unit mismatch");
  assertEqual(trail.reconstructable, true, "expected a successful calculation to be reconstructable");
});

runTest("builds an audit trail for a failed calculation", () => {
  const executionResult = executeCalculation({
    formulaType: CalculationFormulaType.AreaRectangle,
    dimensions: [dimension("width", 4, MeasurementUnit.Meter)],
  });

  const trail = buildCalculationAuditTrail({ formulaType: CalculationFormulaType.AreaRectangle, executionResult });

  assertEqual(trail.steps.length, 0, "expected no steps on a failed calculation");
  assertEqual(trail.finalResult, null, "expected null finalResult on a failed calculation");
  assertEqual(trail.reconstructable, false, "expected a failed calculation to not be reconstructable");
});

runTest("isCalculationReconstructable is true for a successful execution", () => {
  const executionResult = executeCalculation({
    formulaType: CalculationFormulaType.VolumeBox,
    dimensions: [
      dimension("width", 2, MeasurementUnit.Meter),
      dimension("height", 3, MeasurementUnit.Meter),
      dimension("length", 5, MeasurementUnit.Meter),
    ],
  });

  assertEqual(isCalculationReconstructable(executionResult), true, "expected reconstructable true");
});

runTest("isCalculationReconstructable is false for every kind of failed execution", () => {
  const missingInput = executeCalculation({
    formulaType: CalculationFormulaType.AreaRectangle,
    dimensions: [],
  });
  assertEqual(isCalculationReconstructable(missingInput), false, "expected reconstructable false (missing input)");

  const negativeInput = executeCalculation({
    formulaType: CalculationFormulaType.AreaRectangle,
    dimensions: [dimension("width", -1, MeasurementUnit.Meter), dimension("length", 5, MeasurementUnit.Meter)],
  });
  assertEqual(isCalculationReconstructable(negativeInput), false, "expected reconstructable false (negative input)");

  const notYetSupported = executeCalculation({
    formulaType: "not_a_real_formula" as CalculationFormulaType,
    dimensions: [],
  });
  assertEqual(isCalculationReconstructable(notYetSupported), false, "expected reconstructable false (not yet supported)");
});

runTest("isCalculationReconstructable rejects a result with more than one final step", () => {
  const malformed: CalculationExecutionResult = {
    result: { value: 10, unit: MeasurementUnit.Meter, precision: 0, rounded: false },
    steps: [
      stepFixture(1, CalculationStepKind.Input, ["x"], 1, true),
      stepFixture(2, CalculationStepKind.Result, ["x"], 10, true),
    ],
    warnings: [],
  };

  assertEqual(isCalculationReconstructable(malformed), false, "expected false when more than one step is final");
});

runTest("isCalculationReconstructable rejects a result whose last step is not the final one", () => {
  const malformed: CalculationExecutionResult = {
    result: { value: 10, unit: MeasurementUnit.Meter, precision: 0, rounded: false },
    steps: [
      stepFixture(1, CalculationStepKind.Result, ["x"], 10, true),
      stepFixture(2, CalculationStepKind.Note, ["x"], 10, false),
    ],
    warnings: [],
  };

  assertEqual(isCalculationReconstructable(malformed), false, "expected false when the final step is not last");
});

runTest("the last step of a successful audit trail is the (only) final step", () => {
  const executionResult = executeCalculation({
    formulaType: CalculationFormulaType.AreaTrapezoid,
    dimensions: [
      dimension("base_major", 10, MeasurementUnit.Meter),
      dimension("base_minor", 6, MeasurementUnit.Meter),
      dimension("height", 4, MeasurementUnit.Meter),
    ],
  });

  const trail = buildCalculationAuditTrail({ formulaType: CalculationFormulaType.AreaTrapezoid, executionResult });

  assertEqual(trail.steps.length, 4, "expected 3 input steps + 1 result step");
  const lastStep = trail.steps[trail.steps.length - 1];
  assertEqual(lastStep?.isFinal, true, "expected the last step to be final");

  const finalSteps = trail.steps.filter((step) => step.isFinal);
  assertEqual(finalSteps.length, 1, "expected exactly one final step");
});

runTest("inputKeys are filled on every step", () => {
  const executionResult = executeCalculation({
    formulaType: CalculationFormulaType.AreaTriangle,
    dimensions: [dimension("base", 10, MeasurementUnit.Meter), dimension("height", 4, MeasurementUnit.Meter)],
  });

  const trail = buildCalculationAuditTrail({ formulaType: CalculationFormulaType.AreaTriangle, executionResult });

  assertEqual(trail.steps[0]?.inputKeys.length, 1, "expected step 1 to reference exactly one input key");
  assertEqual(trail.steps[0]?.inputKeys[0], "base", "step 1 inputKeys content mismatch");
  assertEqual(trail.steps[1]?.inputKeys[0], "height", "step 2 inputKeys content mismatch");

  const finalStep = trail.steps[trail.steps.length - 1];
  assertEqual(finalStep?.inputKeys.length, 2, "expected the final step to reference every required input");
  assertEqual(finalStep?.inputKeys.includes("base"), true, "final step inputKeys missing base");
  assertEqual(finalStep?.inputKeys.includes("height"), true, "final step inputKeys missing height");
});

runTest("operator is filled on every step", () => {
  const executionResult = executeCalculation({
    formulaType: CalculationFormulaType.WeightedProgress,
    dimensions: [
      dimension("physical_progress_percent", 80, MeasurementUnit.Percent),
      dimension("item_weight_percent", 50, MeasurementUnit.Percent),
    ],
  });

  const trail = buildCalculationAuditTrail({ formulaType: CalculationFormulaType.WeightedProgress, executionResult });

  trail.steps.forEach((step) => {
    assertEqual(typeof step.operator, "string", `operator must be defined for step ${step.order}`);
  });

  assertEqual(trail.steps[0]?.operator, CalculationOperator.None, "input steps carry no operator");
  const finalStep = trail.steps[trail.steps.length - 1];
  assertEqual(finalStep?.operator, CalculationOperator.Percentage, "expected the Percentage operator on the final step");
});

runTest("unit accompanies value on every step", () => {
  const executionResult = executeCalculation({
    formulaType: CalculationFormulaType.MachineHours,
    dimensions: [
      dimension("start_reading", 100, MeasurementUnit.Hour),
      dimension("end_reading", 150, MeasurementUnit.Hour),
    ],
  });

  const trail = buildCalculationAuditTrail({ formulaType: CalculationFormulaType.MachineHours, executionResult });

  trail.steps.forEach((step) => {
    assertEqual(step.unit.trim().length > 0, true, `unit must be non-blank for step ${step.order}`);
  });

  assertEqual(trail.steps[0]?.unit, MeasurementUnit.Hour, "step 1 unit must match its input's unit");
  const finalStep = trail.steps[trail.steps.length - 1];
  assertEqual(finalStep?.unit, MeasurementUnit.Hour, "final step unit must match the output unit");
});

runTest("summarizeCalculationAuditTrail reflects the trail", () => {
  const executionResult = executeCalculation({
    formulaType: CalculationFormulaType.PercentageOfTotal,
    dimensions: [dimension("part_value", 25, MeasurementUnit.Unit), dimension("total_value", 200, MeasurementUnit.Unit)],
  });

  const trail = buildCalculationAuditTrail({ formulaType: CalculationFormulaType.PercentageOfTotal, executionResult });
  const summary = summarizeCalculationAuditTrail(trail);

  assertEqual(summary, trail.summary, "summarizeCalculationAuditTrail must return the trail's own summary");
  assertEqual(summary.formulaType, CalculationFormulaType.PercentageOfTotal, "summary formulaType mismatch");
  assertEqual(summary.totalSteps, trail.steps.length, "summary totalSteps mismatch");
  assertEqual(summary.reconstructable, true, "summary reconstructable mismatch");
  assertEqual(summary.hasFinalResult, true, "summary hasFinalResult mismatch");
  assertEqual(summary.finalValue, 12.5, "summary finalValue mismatch");
  assertEqual(summary.finalUnit, MeasurementUnit.Percent, "summary finalUnit mismatch");
});

runTest("summarizeCalculationAuditTrail reflects a failed trail", () => {
  const executionResult = executeCalculation({
    formulaType: CalculationFormulaType.AreaRectangle,
    dimensions: [],
  });

  const trail = buildCalculationAuditTrail({ formulaType: CalculationFormulaType.AreaRectangle, executionResult });
  const summary = summarizeCalculationAuditTrail(trail);

  assertEqual(summary.reconstructable, false, "expected reconstructable false");
  assertEqual(summary.hasFinalResult, false, "expected hasFinalResult false");
  assertEqual(summary.finalValue, null, "expected finalValue null");
  assertEqual(summary.finalUnit, null, "expected finalUnit null");
});

runTest("audit trail output is deeply immutable", () => {
  const executionResult = executeCalculation({
    formulaType: CalculationFormulaType.AreaRectangle,
    dimensions: [dimension("width", 4, MeasurementUnit.Meter), dimension("length", 500, MeasurementUnit.Meter)],
  });

  const trail = buildCalculationAuditTrail({ formulaType: CalculationFormulaType.AreaRectangle, executionResult });

  assertEqual(Object.isFrozen(trail), true, "trail should be frozen");
  assertEqual(Object.isFrozen(trail.steps), true, "trail steps should be frozen");
  assertEqual(Object.isFrozen(trail.steps[0]), true, "individual step should be frozen");
  assertEqual(Object.isFrozen(trail.finalResult), true, "finalResult should be frozen");
  assertEqual(Object.isFrozen(trail.summary), true, "summary should be frozen");

  assertThrows(() => {
    (trail as unknown as { reconstructable: boolean }).reconstructable = false;
  }, "mutating a frozen audit trail must throw in strict mode");
});

runTest("buildCalculationAuditTrail never mutates the execution result", () => {
  const executionResult = executeCalculation({
    formulaType: CalculationFormulaType.VolumeBox,
    dimensions: [
      dimension("width", 2, MeasurementUnit.Meter),
      dimension("height", 3, MeasurementUnit.Meter),
      dimension("length", 5, MeasurementUnit.Meter),
    ],
  });
  const before = JSON.stringify(executionResult);

  buildCalculationAuditTrail({ formulaType: CalculationFormulaType.VolumeBox, executionResult });

  assertEqual(JSON.stringify(executionResult), before, "execution result must remain unchanged after building the audit trail");
});

runTest("buildCalculationAuditTrail is deterministic for identical input", () => {
  const buildTrail = () => {
    const executionResult = executeCalculation({
      formulaType: CalculationFormulaType.AreaCircle,
      dimensions: [dimension("radius", 2, MeasurementUnit.Meter)],
    });
    return buildCalculationAuditTrail({ formulaType: CalculationFormulaType.AreaCircle, executionResult });
  };

  const first = JSON.stringify(buildTrail());
  const second = JSON.stringify(buildTrail());

  assertEqual(first, second, "expected deterministic audit trail output for identical input");
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
      `unexpected forbidden construct in audit source: ${forbidden}`,
    );
  });
});

// --- Helpers -------------------------------------------------------------------

function dimension(name: string, value: number, unit: MeasurementUnit): MeasurementDimension {
  return { id: `dim-${name}`, name, value, unit, notes: null, sourceEvidenceIds: [] };
}

function stepFixture(
  order: number,
  kind: CalculationStepKind,
  inputKeys: ReadonlyArray<string>,
  value: number,
  isFinal: boolean,
) {
  return {
    order,
    kind,
    description: `step-${order}`,
    expression: `${value}`,
    inputKeys,
    operator: CalculationOperator.None,
    value,
    unit: MeasurementUnit.Meter,
    isFinal,
  };
}

function readOwnSourceFile(): string {
  const filePath = resolve(
    process.cwd(),
    "src",
    "domain",
    "measurement-calculation",
    "measurement-calculation-audit.ts",
  );
  return readFileSync(filePath, "utf8");
}

// --- Test harness --------------------------------------------------------------

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
