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
  [BudgetDocumentSignalFamily.ExtractionCondition]: 3,
};

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
