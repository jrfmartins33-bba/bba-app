declare const process: { cwd(): string };

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  EngineeringServiceType,
  findEngineeringServiceFormulaMapping,
  findMeasurementFormulaCatalogEntry,
  getEngineeringServiceFormulaMappings,
  isSupportedCalculationFormulaType,
  listActiveEngineeringServiceFormulaMappings,
  suggestFormulaForEngineeringService,
  summarizeEngineeringServiceFormulaMappings,
} from "./index";

runTest("mapping loads with entries", () => {
  const mapping = getEngineeringServiceFormulaMappings();
  assertEqual(mapping.length > 0, true, "expected a non-empty mapping");
});

runTest("every EngineeringServiceType is present exactly once", () => {
  const mapping = getEngineeringServiceFormulaMappings();
  const enumValues = Object.values(EngineeringServiceType);

  assertEqual(mapping.length, enumValues.length, "mapping size must match the enum size exactly");

  const seen = new Set<string>();
  mapping.forEach((entry) => {
    assertEqual(seen.has(entry.serviceType), false, `duplicate serviceType found: ${entry.serviceType}`);
    seen.add(entry.serviceType);
  });

  enumValues.forEach((serviceType) => {
    assertEqual(seen.has(serviceType), true, `missing mapping entry for ${serviceType}`);
  });
});

runTest("mapping entries are sorted alphabetically by serviceType", () => {
  const mapping = getEngineeringServiceFormulaMappings();
  const serviceTypes = mapping.map((entry) => entry.serviceType);
  const sorted = [...serviceTypes].sort((left, right) => left.localeCompare(right));

  assertEqual(JSON.stringify(serviceTypes), JSON.stringify(sorted), "expected alphabetical ordering by serviceType");
});

runTest("finds an existing mapping entry", () => {
  const entry = findEngineeringServiceFormulaMapping(EngineeringServiceType.ConcreteStructure);

  assertEqual(entry !== null, true, "expected to find concrete_structure entry");
  assertEqual(entry?.serviceType, EngineeringServiceType.ConcreteStructure, "serviceType mismatch");
  assertEqual(entry?.defaultFormulaType, "concrete_volume", "defaultFormulaType mismatch");
});

runTest("returns null for a serviceType that does not exist", () => {
  const entry = findEngineeringServiceFormulaMapping("not_a_real_service" as EngineeringServiceType);
  assertEqual(entry, null, "expected null for an unmapped serviceType");
});

runTest("suggestFormulaForEngineeringService returns the default formula", () => {
  assertEqual(
    suggestFormulaForEngineeringService(EngineeringServiceType.MachineOperation),
    "machine_hours",
    "expected machine_operation to suggest machine_hours",
  );
  assertEqual(
    suggestFormulaForEngineeringService(EngineeringServiceType.GeneralPercentage),
    "percentage_of_total",
    "expected general_percentage to suggest percentage_of_total",
  );
});

runTest("suggestFormulaForEngineeringService returns null for an unmapped service", () => {
  const suggestion = suggestFormulaForEngineeringService("not_a_real_service" as EngineeringServiceType);
  assertEqual(suggestion, null, "expected null suggestion for an unmapped serviceType");
});

runTest("lists only active mapping entries", () => {
  const active = listActiveEngineeringServiceFormulaMappings();
  const fullMapping = getEngineeringServiceFormulaMappings();

  assertEqual(active.length, fullMapping.length, "expected every seeded mapping to be active");
  active.forEach((entry) => {
    assertEqual(entry.active, true, `expected only active entries, found inactive: ${entry.serviceType}`);
  });
});

runTest("every defaultFormulaType is supported by the Formula Catalog", () => {
  const mapping = getEngineeringServiceFormulaMappings();

  mapping.forEach((entry) => {
    assertEqual(
      isSupportedCalculationFormulaType(entry.defaultFormulaType),
      true,
      `defaultFormulaType "${entry.defaultFormulaType}" for ${entry.serviceType} is not present in the Formula Catalog`,
    );
  });
});

runTest("every alternativeFormulaType is supported by the Formula Catalog", () => {
  const mapping = getEngineeringServiceFormulaMappings();

  mapping.forEach((entry) => {
    entry.alternativeFormulaTypes.forEach((alternative) => {
      assertEqual(
        isSupportedCalculationFormulaType(alternative),
        true,
        `alternativeFormulaType "${alternative}" for ${entry.serviceType} is not present in the Formula Catalog`,
      );
    });
  });
});

runTest("recommendedUnit matches the Formula Catalog's output unit for the default formula", () => {
  const mapping = getEngineeringServiceFormulaMappings();

  mapping.forEach((entry) => {
    const catalogEntry = findMeasurementFormulaCatalogEntry(entry.defaultFormulaType);
    assertEqual(catalogEntry !== null, true, `expected a catalog entry for ${entry.defaultFormulaType}`);
    assertEqual(
      entry.recommendedUnit,
      catalogEntry?.outputUnit,
      `recommendedUnit for ${entry.serviceType} does not match the catalog's output unit`,
    );
  });
});

runTest("requiredDimensionKeys is never null and matches the default formula's required inputs", () => {
  const mapping = getEngineeringServiceFormulaMappings();

  mapping.forEach((entry) => {
    assertEqual(Array.isArray(entry.requiredDimensionKeys), true, `requiredDimensionKeys must be an array for ${entry.serviceType}`);
    assertEqual(entry.requiredDimensionKeys.length > 0, true, `expected at least one required dimension key for ${entry.serviceType}`);

    const catalogEntry = findMeasurementFormulaCatalogEntry(entry.defaultFormulaType);
    const catalogKeys = (catalogEntry?.requiredInputs ?? []).map((input) => input.key).sort();
    const mappingKeys = [...entry.requiredDimensionKeys].sort();

    assertEqual(
      JSON.stringify(mappingKeys),
      JSON.stringify(catalogKeys),
      `requiredDimensionKeys for ${entry.serviceType} do not match the catalog's required inputs for ${entry.defaultFormulaType}`,
    );
  });
});

runTest("every entry declares a non-blank description and recommendedUnit, and a boolean active flag", () => {
  const mapping = getEngineeringServiceFormulaMappings();

  mapping.forEach((entry) => {
    assertEqual(entry.description.trim().length > 0, true, `blank description for ${entry.serviceType}`);
    assertEqual(entry.recommendedUnit.trim().length > 0, true, `blank recommendedUnit for ${entry.serviceType}`);
    assertEqual(typeof entry.active, "boolean", `active must be boolean for ${entry.serviceType}`);
    assertEqual(Array.isArray(entry.alternativeFormulaTypes), true, `alternativeFormulaTypes must be an array for ${entry.serviceType}`);
  });
});

runTest("does not reference any specific public body, pricing table, or institution", () => {
  const sourceCode = readOwnSourceFile().toLowerCase();

  ["dnocs", "der", "caixa", "prefeitura", "sicro", "sinapi"].forEach((forbidden) => {
    assertEqual(sourceCode.includes(forbidden), false, `unexpected institution/table reference: ${forbidden}`);
  });
});

runTest("summarizeEngineeringServiceFormulaMappings reports accurate totals", () => {
  const mapping = getEngineeringServiceFormulaMappings();
  const summary = summarizeEngineeringServiceFormulaMappings();

  assertEqual(summary.totalEntries, mapping.length, "totalEntries mismatch");
  assertEqual(summary.activeEntries, mapping.filter((entry) => entry.active).length, "activeEntries mismatch");
  assertEqual(summary.inactiveEntries, mapping.length - summary.activeEntries, "inactiveEntries mismatch");
});

runTest("mapping output is deeply immutable", () => {
  const mapping = getEngineeringServiceFormulaMappings();

  assertEqual(Object.isFrozen(mapping), true, "mapping array should be frozen");
  assertEqual(Object.isFrozen(mapping[0]), true, "individual entry should be frozen");
  assertEqual(Object.isFrozen(mapping[0]?.alternativeFormulaTypes), true, "alternativeFormulaTypes should be frozen");
  assertEqual(Object.isFrozen(mapping[0]?.requiredDimensionKeys), true, "requiredDimensionKeys should be frozen");

  assertThrows(() => {
    (mapping as unknown as { push: (value: unknown) => void }).push({});
  }, "mutating the frozen mapping array must throw in strict mode");

  const active = listActiveEngineeringServiceFormulaMappings();
  assertEqual(Object.isFrozen(active), true, "active list should also be frozen");
});

runTest("mapping retrieval is deterministic across calls", () => {
  const first = JSON.stringify(getEngineeringServiceFormulaMappings());
  const second = JSON.stringify(getEngineeringServiceFormulaMappings());

  assertEqual(first, second, "expected deterministic mapping output across calls");

  const firstActive = JSON.stringify(listActiveEngineeringServiceFormulaMappings());
  const secondActive = JSON.stringify(listActiveEngineeringServiceFormulaMappings());
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
      `unexpected forbidden construct in mapping source: ${forbidden}`,
    );
  });
});

// --- Helpers -------------------------------------------------------------------

function readOwnSourceFile(): string {
  const filePath = resolve(
    process.cwd(),
    "src",
    "domain",
    "measurement-calculation",
    "measurement-service-formula-mapping.ts",
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
