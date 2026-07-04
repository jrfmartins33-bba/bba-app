declare const process: { cwd(): string };

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CalculationFormulaType,
  findMeasurementFormulaCatalogEntry,
  getMeasurementFormulaCatalog,
  isSupportedCalculationFormulaType,
  listActiveMeasurementFormulas,
  summarizeMeasurementFormulaCatalog,
} from "./index";

runTest("catalog loads with entries", () => {
  const catalog = getMeasurementFormulaCatalog();
  assertEqual(catalog.length > 0, true, "expected a non-empty catalog");
});

runTest("every CalculationFormulaType from the Sprint 13.1 enum is present in the catalog", () => {
  const catalog = getMeasurementFormulaCatalog();
  const catalogFormulaTypes = new Set(catalog.map((entry) => entry.formulaType));
  const enumValues = Object.values(CalculationFormulaType);

  assertEqual(catalog.length, enumValues.length, "catalog size must match the enum size exactly");

  enumValues.forEach((formulaType) => {
    assertEqual(catalogFormulaTypes.has(formulaType), true, `missing catalog entry for ${formulaType}`);
  });
});

runTest("does not declare a formulaType outside the Sprint 13.1 enum", () => {
  const catalog = getMeasurementFormulaCatalog();
  const enumValues = new Set<string>(Object.values(CalculationFormulaType));

  catalog.forEach((entry) => {
    assertEqual(enumValues.has(entry.formulaType), true, `unexpected formulaType not in enum: ${entry.formulaType}`);
  });
});

runTest("formulaType is unique across the catalog", () => {
  const catalog = getMeasurementFormulaCatalog();
  const seen = new Set<string>();

  catalog.forEach((entry) => {
    assertEqual(seen.has(entry.formulaType), false, `duplicate formulaType found: ${entry.formulaType}`);
    seen.add(entry.formulaType);
  });
});

runTest("catalog entries are sorted alphabetically by formulaType", () => {
  const catalog = getMeasurementFormulaCatalog();
  const formulaTypes = catalog.map((entry) => entry.formulaType);
  const sorted = [...formulaTypes].sort((left, right) => left.localeCompare(right));

  assertEqual(JSON.stringify(formulaTypes), JSON.stringify(sorted), "expected alphabetical ordering by formulaType");
});

runTest("finds an existing catalog entry", () => {
  const entry = findMeasurementFormulaCatalogEntry(CalculationFormulaType.VolumeBox);

  assertEqual(entry !== null, true, "expected to find volume_box entry");
  assertEqual(entry?.formulaType, CalculationFormulaType.VolumeBox, "formulaType mismatch");
  assertEqual(typeof entry?.displayName, "string", "expected a displayName");
});

runTest("returns null for a formulaType that does not exist", () => {
  const entry = findMeasurementFormulaCatalogEntry("not_a_real_formula" as CalculationFormulaType);
  assertEqual(entry, null, "expected null for an unsupported formulaType");
});

runTest("lists only active formulas", () => {
  const active = listActiveMeasurementFormulas();
  const fullCatalog = getMeasurementFormulaCatalog();

  assertEqual(active.length, fullCatalog.length, "expected every seeded formula to be active");
  active.forEach((entry) => {
    assertEqual(entry.active, true, `expected only active entries, found inactive: ${entry.formulaType}`);
  });
});

runTest("isSupportedCalculationFormulaType recognizes known and unknown values", () => {
  assertEqual(isSupportedCalculationFormulaType(CalculationFormulaType.ConcreteVolume), true, "expected concrete_volume to be supported");
  assertEqual(isSupportedCalculationFormulaType("not_a_real_formula"), false, "expected an unknown value to be unsupported");
});

runTest("summarizeMeasurementFormulaCatalog reports accurate totals", () => {
  const catalog = getMeasurementFormulaCatalog();
  const summary = summarizeMeasurementFormulaCatalog();

  assertEqual(summary.totalEntries, catalog.length, "totalEntries mismatch");
  assertEqual(summary.activeEntries, catalog.filter((entry) => entry.active).length, "activeEntries mismatch");
  assertEqual(summary.inactiveEntries, catalog.length - summary.activeEntries, "inactiveEntries mismatch");
});

runTest("requiredInputs and optionalInputs are never null on any entry", () => {
  const catalog = getMeasurementFormulaCatalog();

  catalog.forEach((entry) => {
    assertEqual(Array.isArray(entry.requiredInputs), true, `requiredInputs must be an array for ${entry.formulaType}`);
    assertEqual(Array.isArray(entry.optionalInputs), true, `optionalInputs must be an array for ${entry.formulaType}`);
    assertEqual(entry.requiredInputs.length > 0, true, `expected at least one required input for ${entry.formulaType}`);
  });
});

runTest("no entry has a duplicated input key across requiredInputs and optionalInputs", () => {
  const catalog = getMeasurementFormulaCatalog();

  catalog.forEach((entry) => {
    const allKeys = [...entry.requiredInputs, ...entry.optionalInputs].map((input) => input.key);
    const uniqueKeys = new Set(allKeys);
    assertEqual(uniqueKeys.size, allKeys.length, `duplicated input key found in ${entry.formulaType}`);
  });
});

runTest("every input declares key, label and unit, with a required flag coherent with its collection", () => {
  const catalog = getMeasurementFormulaCatalog();

  catalog.forEach((entry) => {
    entry.requiredInputs.forEach((input) => {
      assertEqual(input.key.trim().length > 0, true, `blank key in requiredInputs of ${entry.formulaType}`);
      assertEqual(input.label.trim().length > 0, true, `blank label in requiredInputs of ${entry.formulaType}`);
      assertEqual(input.unit.trim().length > 0, true, `blank unit in requiredInputs of ${entry.formulaType}`);
      assertEqual(input.required, true, `requiredInputs entry must have required=true in ${entry.formulaType}`);
    });

    entry.optionalInputs.forEach((input) => {
      assertEqual(input.key.trim().length > 0, true, `blank key in optionalInputs of ${entry.formulaType}`);
      assertEqual(input.label.trim().length > 0, true, `blank label in optionalInputs of ${entry.formulaType}`);
      assertEqual(input.unit.trim().length > 0, true, `blank unit in optionalInputs of ${entry.formulaType}`);
      assertEqual(input.required, false, `optionalInputs entry must have required=false in ${entry.formulaType}`);
    });
  });
});

runTest("every entry declares a non-blank displayName, description and outputUnit, and a boolean active flag", () => {
  const catalog = getMeasurementFormulaCatalog();

  catalog.forEach((entry) => {
    assertEqual(entry.displayName.trim().length > 0, true, `blank displayName for ${entry.formulaType}`);
    assertEqual(entry.description.trim().length > 0, true, `blank description for ${entry.formulaType}`);
    assertEqual(entry.outputUnit.trim().length > 0, true, `blank outputUnit for ${entry.formulaType}`);
    assertEqual(typeof entry.active, "boolean", `active must be boolean for ${entry.formulaType}`);
  });
});

runTest("catalog output is deeply immutable", () => {
  const catalog = getMeasurementFormulaCatalog();

  assertEqual(Object.isFrozen(catalog), true, "catalog array should be frozen");
  assertEqual(Object.isFrozen(catalog[0]), true, "individual entry should be frozen");
  assertEqual(Object.isFrozen(catalog[0]?.requiredInputs), true, "requiredInputs array should be frozen");
  assertEqual(Object.isFrozen(catalog[0]?.requiredInputs[0]), true, "individual required input should be frozen");
  assertEqual(Object.isFrozen(catalog[0]?.optionalInputs), true, "optionalInputs array should be frozen");

  assertThrows(() => {
    (catalog as unknown as { push: (value: unknown) => void }).push({});
  }, "mutating the frozen catalog array must throw in strict mode");

  const active = listActiveMeasurementFormulas();
  assertEqual(Object.isFrozen(active), true, "active list should also be frozen");
});

runTest("catalog retrieval is deterministic across calls", () => {
  const first = JSON.stringify(getMeasurementFormulaCatalog());
  const second = JSON.stringify(getMeasurementFormulaCatalog());

  assertEqual(first, second, "expected deterministic catalog output across calls");

  const firstActive = JSON.stringify(listActiveMeasurementFormulas());
  const secondActive = JSON.stringify(listActiveMeasurementFormulas());
  assertEqual(firstActive, secondActive, "expected deterministic active-list output across calls");
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
      `unexpected forbidden construct in catalog source: ${forbidden}`,
    );
  });
});

// --- Helpers -------------------------------------------------------------------

function readOwnSourceFile(): string {
  const filePath = resolve(process.cwd(), "src", "domain", "measurement-calculation", "measurement-formula-catalog.ts");
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
