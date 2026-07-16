import {
  BUDGET_DOCUMENT_SIGNAL_CATALOG,
  BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
  getBudgetDocumentSignalDefinition,
  listBudgetDocumentSignalDefinitionsByFamily,
  validateBudgetDocumentSignalCatalog,
} from "./index";
import { BudgetDocumentSignalFamily } from "./index";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertNoViolations(issues: ReadonlyArray<unknown>, message?: string): void {
  if (issues.length > 0) {
    throw new Error(`${message ?? "expected no issues"}: ${JSON.stringify(issues)}`);
  }
}

const MINIMUM_DEFINITIONS_PER_FAMILY: Record<BudgetDocumentSignalFamily, number> = {
  [BudgetDocumentSignalFamily.Referential]: 2,
  [BudgetDocumentSignalFamily.Structural]: 3,
  [BudgetDocumentSignalFamily.Continuity]: 2,
  [BudgetDocumentSignalFamily.Closure]: 2,
  [BudgetDocumentSignalFamily.ExtractionCondition]: 10,
};

const EXTRACTION_CONDITION_IDS = [
  "extraction-text-available",
  "extraction-no-extractable-text",
  "extraction-error",
  "extraction-acceptable-quality",
  "extraction-degraded-quality",
  "extraction-indeterminate-quality",
  "extraction-composition-predominantly-textual",
  "extraction-composition-mixed",
  "extraction-composition-graphic-or-image",
  "extraction-composition-not-determinable",
] as const;

const KNOWN_SIGNAL_DEFINITION_KEYS = [
  "id",
  "definitionVersion",
  "family",
  "humanName",
  "description",
  "documentaryMeaning",
  "observableForms",
  "limitations",
  "permittedUses",
  "prohibitedUses",
  "sufficientAlone",
  "insufficiencyRationale",
  "relatedSignalIds",
  "catalogVersion",
].sort();

runTest("catalog passes its own structural integrity validation", () => {
  const issues = validateBudgetDocumentSignalCatalog(BUDGET_DOCUMENT_SIGNAL_CATALOG);
  assertNoViolations(issues, "catalog integrity issues");
});

runTest("catalog carries every definition's declared version", () => {
  BUDGET_DOCUMENT_SIGNAL_CATALOG.forEach((definition) => {
    assertEqual(definition.catalogVersion, BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION, `catalogVersion mismatch for ${definition.id}`);
  });
});

runTest("no signal in the catalog is documented as sufficient alone", () => {
  const sufficientAlone = BUDGET_DOCUMENT_SIGNAL_CATALOG.filter((definition) => definition.sufficientAlone);
  assertEqual(sufficientAlone.length, 0, "signals unexpectedly marked sufficientAlone");
});

runTest("every family has at least its minimum number of definitions", () => {
  (Object.keys(MINIMUM_DEFINITIONS_PER_FAMILY) as BudgetDocumentSignalFamily[]).forEach((family) => {
    const definitions = listBudgetDocumentSignalDefinitionsByFamily(BUDGET_DOCUMENT_SIGNAL_CATALOG, family);
    const minimum = MINIMUM_DEFINITIONS_PER_FAMILY[family];
    if (definitions.length < minimum) {
      throw new Error(`family ${family} has ${definitions.length} definitions, expected at least ${minimum}`);
    }
  });
});

runTest("all five documentary signal families are represented", () => {
  const families = new Set(BUDGET_DOCUMENT_SIGNAL_CATALOG.map((definition) => definition.family));
  assertEqual(families.has(BudgetDocumentSignalFamily.Referential), true, "missing Referential family");
  assertEqual(families.has(BudgetDocumentSignalFamily.Structural), true, "missing Structural family");
  assertEqual(families.has(BudgetDocumentSignalFamily.Continuity), true, "missing Continuity family");
  assertEqual(families.has(BudgetDocumentSignalFamily.Closure), true, "missing Closure family");
  assertEqual(families.has(BudgetDocumentSignalFamily.ExtractionCondition), true, "missing ExtractionCondition family");
});

runTest("getBudgetDocumentSignalDefinition finds a known signal and returns null for an unknown one", () => {
  const known = getBudgetDocumentSignalDefinition(BUDGET_DOCUMENT_SIGNAL_CATALOG, "referential-budget-spreadsheet-mention");
  assertEqual(known?.id, "referential-budget-spreadsheet-mention");
  const unknown = getBudgetDocumentSignalDefinition(BUDGET_DOCUMENT_SIGNAL_CATALOG, "does-not-exist");
  assertEqual(unknown, null);
});

runTest("the catalog is frozen at runtime, not only at the type level", () => {
  let threw = false;
  try {
    (BUDGET_DOCUMENT_SIGNAL_CATALOG as unknown as { push: (value: unknown) => void }).push({});
  } catch {
    threw = true;
  }
  assertEqual(threw, true, "expected mutation of the frozen catalog array to throw");

  let nestedThrew = false;
  try {
    (BUDGET_DOCUMENT_SIGNAL_CATALOG[0] as unknown as Record<string, unknown>).humanName = "mutated";
  } catch {
    nestedThrew = true;
  }
  assertEqual(nestedThrew, true, "expected mutation of a frozen definition to throw");
});

runTest("validateBudgetDocumentSignalCatalog flags a duplicate id", () => {
  const [first, second, ...rest] = BUDGET_DOCUMENT_SIGNAL_CATALOG;
  const withDuplicate = [first, { ...second, id: first.id }, ...rest];
  const issues = validateBudgetDocumentSignalCatalog(withDuplicate);
  assertEqual(issues.some((issue) => issue.code === "duplicate_id"), true, "expected duplicate_id issue");
});

runTest("validateBudgetDocumentSignalCatalog flags a signal marked sufficientAlone", () => {
  const [first, ...rest] = BUDGET_DOCUMENT_SIGNAL_CATALOG;
  const tampered = [{ ...first, sufficientAlone: true, insufficiencyRationale: null }, ...rest];
  const issues = validateBudgetDocumentSignalCatalog(tampered);
  assertEqual(issues.some((issue) => issue.code === "sufficient_alone_without_architectural_authorization"), true, "expected sufficient_alone issue");
});

runTest("validateBudgetDocumentSignalCatalog flags a dangling related signal id", () => {
  const [first, ...rest] = BUDGET_DOCUMENT_SIGNAL_CATALOG;
  const tampered = [{ ...first, relatedSignalIds: ["does-not-exist"] }, ...rest];
  const issues = validateBudgetDocumentSignalCatalog(tampered);
  assertEqual(issues.some((issue) => issue.code === "dangling_related_signal_id"), true, "expected dangling_related_signal_id issue");
});

runTest("all ten ExtractionCondition identifiers exist in the catalog", () => {
  EXTRACTION_CONDITION_IDS.forEach((id) => {
    const definition = getBudgetDocumentSignalDefinition(BUDGET_DOCUMENT_SIGNAL_CATALOG, id);
    if (!definition) throw new Error(`expected signal "${id}" to exist in the catalog`);
    assertEqual(definition.family, BudgetDocumentSignalFamily.ExtractionCondition, `${id} is not in the ExtractionCondition family`);
  });
});

runTest("the ExtractionCondition family has exactly ten signals", () => {
  const definitions = listBudgetDocumentSignalDefinitionsByFamily(BUDGET_DOCUMENT_SIGNAL_CATALOG, BudgetDocumentSignalFamily.ExtractionCondition);
  assertEqual(definitions.length, 10, `expected exactly 10 ExtractionCondition signals, got ${definitions.length}`);
});

runTest("extraction-text-available is distinct from extraction-acceptable-quality", () => {
  const availability = getBudgetDocumentSignalDefinition(BUDGET_DOCUMENT_SIGNAL_CATALOG, "extraction-text-available");
  const quality = getBudgetDocumentSignalDefinition(BUDGET_DOCUMENT_SIGNAL_CATALOG, "extraction-acceptable-quality");
  if (!availability || !quality) throw new Error("expected both signals to exist");
  assertEqual(availability.id === quality.id, false, "availability and quality signals must be distinct definitions");
  assertEqual(availability.description.toLowerCase().includes("qualidade"), false, "extraction-text-available must not describe quality — availability and quality are separate dimensions");
});

runTest("extraction-error is distinct from extraction-no-extractable-text", () => {
  const error = getBudgetDocumentSignalDefinition(BUDGET_DOCUMENT_SIGNAL_CATALOG, "extraction-error");
  const noText = getBudgetDocumentSignalDefinition(BUDGET_DOCUMENT_SIGNAL_CATALOG, "extraction-no-extractable-text");
  if (!error || !noText) throw new Error("expected both signals to exist");
  assertEqual(error.id === noText.id, false, "extraction-error and extraction-no-extractable-text must be distinct definitions");
  assertEqual(error.limitations.some((l) => l.toLowerCase().includes("ausência de texto")), true, "extraction-error must document that it is not equivalent to absence of text");
});

runTest("all four composition signals are present", () => {
  ["extraction-composition-predominantly-textual", "extraction-composition-mixed", "extraction-composition-graphic-or-image", "extraction-composition-not-determinable"].forEach(
    (id) => {
      const definition = getBudgetDocumentSignalDefinition(BUDGET_DOCUMENT_SIGNAL_CATALOG, id);
      if (!definition) throw new Error(`expected composition signal "${id}" to exist`);
    },
  );
});

runTest("no ExtractionCondition signal carries a numeric threshold or score field", () => {
  listBudgetDocumentSignalDefinitionsByFamily(BUDGET_DOCUMENT_SIGNAL_CATALOG, BudgetDocumentSignalFamily.ExtractionCondition).forEach((definition) => {
    const actualKeys = Object.keys(definition).sort();
    assertEqual(JSON.stringify(actualKeys), JSON.stringify(KNOWN_SIGNAL_DEFINITION_KEYS), `${definition.id} has unexpected fields beyond the documented schema (possible score/threshold field)`);
  });
});

runTest("catalog now has exactly 23 signals across all families", () => {
  assertEqual(BUDGET_DOCUMENT_SIGNAL_CATALOG.length, 23, `expected 23 total signals, got ${BUDGET_DOCUMENT_SIGNAL_CATALOG.length}`);
});
