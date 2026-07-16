import { BUDGET_DOCUMENT_SIGNAL_CATALOG } from "../budget-document-signal-catalog";
import { normalizePageText } from "../physical-document-text-normalization";
import { computePageTextMetrics } from "../physical-document-page-metrics";
import { derivePageOrientation } from "../physical-document-page-orientation";
import {
  PHYSICAL_DOCUMENT_READ_SCHEMA_VERSION,
  PHYSICAL_DOCUMENT_READER_NAME,
  PHYSICAL_DOCUMENT_READER_VERSION,
} from "../physical-document-read.types";
import type { PhysicalDocumentPage, PhysicalDocumentReadResult, PhysicalDocumentTextExtractionAvailability } from "../physical-document-read.types";
import { observeDocumentSignals } from "./signal-observation";
import {
  DOCUMENT_SIGNAL_OBSERVER_NAME,
  DOCUMENT_SIGNAL_OBSERVER_VERSION,
  SIGNAL_OBSERVATION_RULE_SET_VERSION,
  SIGNAL_OBSERVATION_SCHEMA_VERSION,
} from "./signal-observation.types";
import { buildSyntheticReferenceSuite } from "../testing/synthetic-reference-suite";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(actual: boolean, message: string): void {
  if (!actual) {
    throw new Error(message);
  }
}

function assertArrayEqual<T>(actual: ReadonlyArray<T>, expected: ReadonlyArray<T>, message?: string): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${message ?? "arrays differ"}: expected ${expectedJson}, got ${actualJson}`);
  }
}

// --- hand-built PhysicalDocumentPage/Result factories, for full control over edge cases ---

function buildPage(overrides: {
  pageNumber: number;
  itemTexts?: ReadonlyArray<string>;
  widthPoints?: number | null;
  heightPoints?: number | null;
  extractionAvailability?: PhysicalDocumentTextExtractionAvailability;
}): PhysicalDocumentPage {
  const itemTexts = overrides.itemTexts ?? [];
  const extractionAvailability = overrides.extractionAvailability ?? (itemTexts.length > 0 ? "text_available" : "no_extractable_text");
  const textItems = extractionAvailability === "text_available" ? itemTexts.map((text, index) => ({ index, text })) : [];
  const rawTexts = textItems.map((item) => item.text);
  const widthPoints = overrides.widthPoints ?? 612;
  const heightPoints = overrides.heightPoints ?? 792;

  return {
    pageNumber: overrides.pageNumber,
    widthPoints,
    heightPoints,
    rotationDegrees: null,
    orientation: derivePageOrientation(widthPoints, heightPoints),
    textItems,
    normalizedText: normalizePageText(rawTexts),
    metrics: computePageTextMetrics(rawTexts),
    extractionAvailability,
    technicalProblems: [],
  };
}

function buildReadResult(pages: ReadonlyArray<PhysicalDocumentPage>, hash = "hand-built-hash"): PhysicalDocumentReadResult {
  return {
    schemaVersion: PHYSICAL_DOCUMENT_READ_SCHEMA_VERSION,
    readerName: PHYSICAL_DOCUMENT_READER_NAME,
    readerVersion: PHYSICAL_DOCUMENT_READER_VERSION,
    adapterVersion: "hand-built-adapter",
    underlyingLibraryVersion: "hand-built-library@1.0.0",
    sourceByteHash: hash,
    totalPageCount: pages.length,
    pages,
    status: "completed",
    technicalProblems: [],
  };
}

// --- 5, 6, 7, 8: catalog/observer/rule-set versions and full 23-signal coverage ---

runTest("every page carries exactly 23 signal evaluations, one per catalog signal, in catalog order", () => {
  const result = observeDocumentSignals(buildReadResult([buildPage({ pageNumber: 1, itemTexts: ["hello"] })]));
  const page = result.pages[0];
  assertEqual(page.signalEvaluations.length, 23);
  assertArrayEqual(
    page.signalEvaluations.map((e) => e.signalId),
    BUDGET_DOCUMENT_SIGNAL_CATALOG.map((d) => d.id),
  );
});

runTest("result carries schema, observer, rule-set and catalog versions", () => {
  const result = observeDocumentSignals(buildReadResult([buildPage({ pageNumber: 1 })]));
  assertEqual(result.schemaVersion, SIGNAL_OBSERVATION_SCHEMA_VERSION);
  assertEqual(result.observerName, DOCUMENT_SIGNAL_OBSERVER_NAME);
  assertEqual(result.observerVersion, DOCUMENT_SIGNAL_OBSERVER_VERSION);
  assertEqual(result.ruleSetVersion, SIGNAL_OBSERVATION_RULE_SET_VERSION);
  assertTrue(result.catalogVersion.length > 0, "catalogVersion must be present");
});

// --- 9, 10: source hash and physical page number preserved --------------------

runTest("sourceByteHash is preserved from the input read result", () => {
  const result = observeDocumentSignals(buildReadResult([buildPage({ pageNumber: 1 })], "specific-hash-123"));
  assertEqual(result.sourceByteHash, "specific-hash-123");
});

runTest("physical page numbers are preserved as-is", () => {
  const result = observeDocumentSignals(
    buildReadResult([buildPage({ pageNumber: 1 }), buildPage({ pageNumber: 2 }), buildPage({ pageNumber: 3 })]),
  );
  assertArrayEqual(result.pages.map((p) => p.pageNumber), [1, 2, 3]);
});

// --- 1, 11, 12, 13, 14: observed with correct evidence, item index and both texts preserved ---

runTest("case 1/11/12/13/14: an observed signal carries evidence with the correct item index, original and normalized snippets", () => {
  const page = buildPage({ pageNumber: 1, itemTexts: ["Introdução", "Menciona BDI   no   texto", "Rodapé"] });
  const result = observeDocumentSignals(buildReadResult([page]));
  const evaluation = result.pages[0].signalEvaluations.find((e) => e.signalId === "structural-bdi-documentary-mention");
  assertTrue(evaluation !== undefined, "expected evaluation to exist");
  assertEqual(evaluation?.outcome, "observed");
  assertTrue(evaluation?.evidence !== null, "expected evidence to be present");
  assertEqual(evaluation?.evidence?.references[0]?.pageNumber, 1);
  assertArrayEqual(evaluation?.evidence?.references[0]?.textItemIndices ?? [], [1]);
  assertEqual(evaluation?.evidence?.references[0]?.originalSnippet, "Menciona BDI   no   texto");
  assertEqual(evaluation?.evidence?.references[0]?.normalizedSnippet, "Menciona BDI no texto");
  assertTrue(
    evaluation?.evidence?.references[0]?.originalSnippet !== evaluation?.evidence?.references[0]?.normalizedSnippet,
    "original and normalized snippets must remain distinct when normalization actually changed the text",
  );
});

// --- 2, 4: evaluated and not observed, distinct from not evaluable ------------

runTest("case 2/4: a rule that runs and finds nothing is not_observed, distinct from not_evaluable", () => {
  const page = buildPage({ pageNumber: 1, itemTexts: ["Texto qualquer sobre outro assunto"] });
  const result = observeDocumentSignals(buildReadResult([page]));
  const evaluation = result.pages[0].signalEvaluations.find((e) => e.signalId === "structural-bdi-documentary-mention");
  assertEqual(evaluation?.outcome, "not_observed");
  assertTrue(evaluation?.ruleId !== null, "not_observed must still carry the ruleId that ran");
  assertEqual(evaluation?.evidence, null);
  assertEqual(evaluation?.notEvaluableReasonCode, null);
});

// --- 3: not evaluable, both flavors --------------------------------------------

runTest("case 3a: unsupported signal is not_evaluable with no ruleId, on any page content", () => {
  const page = buildPage({ pageNumber: 1, itemTexts: ["qualquer coisa"] });
  const result = observeDocumentSignals(buildReadResult([page]));
  const evaluation = result.pages[0].signalEvaluations.find((e) => e.signalId === "structural-unit-quantity-price-block");
  assertEqual(evaluation?.outcome, "not_evaluable");
  assertEqual(evaluation?.ruleId, null);
  assertEqual(evaluation?.notEvaluableReasonCode, "unsupported_missing_row_reconstruction_capability");
});

runTest("case 3b: supported signal is not_evaluable with a ruleId, when this specific page lacks text", () => {
  const page = buildPage({ pageNumber: 1, extractionAvailability: "no_extractable_text" });
  const result = observeDocumentSignals(buildReadResult([page]));
  const evaluation = result.pages[0].signalEvaluations.find((e) => e.signalId === "structural-bdi-documentary-mention");
  assertEqual(evaluation?.outcome, "not_evaluable");
  assertTrue(evaluation?.ruleId !== null, "the rule exists and should be referenced even when it could not run on this page");
  assertEqual(evaluation?.notEvaluableReasonCode, "page_text_unavailable");
});

// --- 8 (user refinement): support-level unsupported vs page-level insufficiency ---

runTest("support unsupported + any page = not_evaluable by missing capability, never observed", () => {
  const withText = buildPage({ pageNumber: 1, itemTexts: ["texto disponível qualquer"] });
  const result = observeDocumentSignals(buildReadResult([withText]));
  const quality = result.pages[0].signalEvaluations.find((e) => e.signalId === "extraction-acceptable-quality");
  assertEqual(quality?.outcome, "not_evaluable");
  assertEqual(quality?.notEvaluableReasonCode, "unsupported_missing_evaluation_profile");
  assertEqual(quality?.notEvaluableDimension, "quality");
});

// --- 21, 22, 23: availability distinct from quality/composition; no threshold -----

runTest("case 21/22/23: all quality and composition signals are always not_evaluable, regardless of text content", () => {
  const richPage = buildPage({ pageNumber: 1, itemTexts: ["A".repeat(500), "B".repeat(500)] });
  const result = observeDocumentSignals(buildReadResult([richPage]));
  const qualityAndCompositionIds = [
    "extraction-acceptable-quality",
    "extraction-degraded-quality",
    "extraction-indeterminate-quality",
    "extraction-composition-predominantly-textual",
    "extraction-composition-mixed",
    "extraction-composition-graphic-or-image",
    "extraction-composition-not-determinable",
  ];
  qualityAndCompositionIds.forEach((signalId) => {
    const evaluation = result.pages[0].signalEvaluations.find((e) => e.signalId === signalId);
    assertEqual(evaluation?.outcome, "not_evaluable", `${signalId} must never be observed or not_observed in this version`);
  });
});

// --- 17: evidence with discontinuous item indices, never collapsed into a range ---

runTest("case 17: evidence preserves discontinuous item indices exactly, never collapsed into a range", () => {
  const page = buildPage({
    pageNumber: 1,
    itemTexts: ["item 0 irrelevante", "BDI aqui", "item 2 irrelevante", "outra menção a BDI"],
  });
  const result = observeDocumentSignals(buildReadResult([page]));
  const evaluation = result.pages[0].signalEvaluations.find((e) => e.signalId === "structural-bdi-documentary-mention");
  assertArrayEqual(evaluation?.evidence?.references[0]?.textItemIndices ?? [], [1, 3]);
});

// --- 24, 25: document boundaries for adjacent-page rules -----------------------

runTest("case 24: first page (no previous) is evaluable via the next page only", () => {
  const p1 = buildPage({ pageNumber: 1, widthPoints: 800, heightPoints: 600 });
  const p2 = buildPage({ pageNumber: 2, widthPoints: 800, heightPoints: 600 });
  const result = observeDocumentSignals(buildReadResult([p1, p2]));
  const evaluation = result.pages[0].signalEvaluations.find((e) => e.signalId === "continuity-stable-geometry");
  assertEqual(evaluation?.outcome, "observed");
  assertEqual(evaluation?.notEvaluableReasonCode, null);
});

runTest("case 25: last page (no next) is evaluable via the previous page only", () => {
  const p1 = buildPage({ pageNumber: 1, widthPoints: 800, heightPoints: 600 });
  const p2 = buildPage({ pageNumber: 2, widthPoints: 800, heightPoints: 600 });
  const result = observeDocumentSignals(buildReadResult([p1, p2]));
  const evaluation = result.pages[1].signalEvaluations.find((e) => e.signalId === "continuity-stable-geometry");
  assertEqual(evaluation?.outcome, "observed");
});

runTest("a single-page document cannot evaluate continuity-stable-geometry (no neighbor exists at all)", () => {
  const result = observeDocumentSignals(buildReadResult([buildPage({ pageNumber: 1 })]));
  const evaluation = result.pages[0].signalEvaluations.find((e) => e.signalId === "continuity-stable-geometry");
  assertEqual(evaluation?.outcome, "not_evaluable");
  assertEqual(evaluation?.notEvaluableReasonCode, "adjacent_page_unavailable");
});

// --- 26, 27, 30, 31, 32: no continuity/closure decision, no score/confidence/classification ---

const FORBIDDEN_RESULT_KEYWORDS = [
  "candidate",
  "contextual",
  "ambiguous",
  "discarded",
  "relevant",
  "irrelevant",
  "budgetfound",
  "budgetpage",
  "selectedpage",
  "confidence",
  "score",
  "threshold",
  "classification",
];

function collectAllKeysDeep(value: unknown, seen: Set<unknown> = new Set()): ReadonlyArray<string> {
  if (value === null || typeof value !== "object") {
    return [];
  }
  if (seen.has(value)) {
    return [];
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectAllKeysDeep(item, seen));
  }

  const keys: string[] = [];
  Object.entries(value as Record<string, unknown>).forEach(([key, nested]) => {
    keys.push(key);
    keys.push(...collectAllKeysDeep(nested, seen));
  });
  return keys;
}

runTest("case 26/27/30/31/32: the result contains no key matching decision/classification vocabulary", () => {
  const page = buildPage({ pageNumber: 1, itemTexts: ["Total Geral do bloco fictício"] });
  const result = observeDocumentSignals(buildReadResult([page]));
  const allKeys = collectAllKeysDeep(result).map((k) => k.toLowerCase());
  FORBIDDEN_RESULT_KEYWORDS.forEach((forbidden) => {
    assertEqual(allKeys.some((key) => key.includes(forbidden)), false, `result must not have a key matching "${forbidden}"`);
  });
});

// --- 28, 29: repeatability and stable evaluation order -------------------------

runTest("case 28: two observations of the same input produce an equivalent stable result", () => {
  const page = buildPage({ pageNumber: 1, itemTexts: ["BDI e total geral fictícios"] });
  const readResult = buildReadResult([page]);
  const first = observeDocumentSignals(readResult);
  const second = observeDocumentSignals(readResult);
  assertEqual(JSON.stringify(first), JSON.stringify(second));
});

runTest("case 29: evaluation order is the catalog's own stable order, independent of page content", () => {
  const emptyPage = buildPage({ pageNumber: 1 });
  const richPage = buildPage({ pageNumber: 1, itemTexts: ["BDI total geral anexo de preços"] });
  const orderA = observeDocumentSignals(buildReadResult([emptyPage])).pages[0].signalEvaluations.map((e) => e.signalId);
  const orderB = observeDocumentSignals(buildReadResult([richPage])).pages[0].signalEvaluations.map((e) => e.signalId);
  assertArrayEqual(orderA, orderB);
});

// --- failed source read --------------------------------------------------------

runTest("a failed source read produces a failed observation with zero pages", () => {
  const failedRead: PhysicalDocumentReadResult = {
    schemaVersion: PHYSICAL_DOCUMENT_READ_SCHEMA_VERSION,
    readerName: PHYSICAL_DOCUMENT_READER_NAME,
    readerVersion: PHYSICAL_DOCUMENT_READER_VERSION,
    adapterVersion: "hand-built-adapter",
    underlyingLibraryVersion: null,
    sourceByteHash: "failed-hash",
    totalPageCount: 0,
    pages: [],
    status: "failed",
    technicalProblems: [],
  };
  const result = observeDocumentSignals(failedRead);
  assertEqual(result.status, "failed");
  assertEqual(result.pages.length, 0);
  assertEqual(result.totalPageCount, 0);
  assertEqual(result.sourceByteHash, "failed-hash");
  assertEqual(result.sourceReadMetadata.sourceReadStatus, "failed");
});

// --- 39: an unexpected rule crash is caught and reported without a stack trace ---

runTest("case 39: an unexpected rule execution failure is caught, reported with a controlled code, and never includes a stack trace", () => {
  // Deliberately malformed page (bypassing the type system) to force an
  // unexpected runtime error inside a rule's text handling.
  const malformedPage = buildPage({ pageNumber: 1, itemTexts: ["ok"] });
  const brokenPage = {
    ...malformedPage,
    textItems: [{ index: 0, text: null as unknown as string }],
  } as unknown as PhysicalDocumentPage;

  const result = observeDocumentSignals(buildReadResult([brokenPage]));
  assertEqual(result.status, "completed_with_observer_problems");
  assertTrue(result.technicalProblems.length > 0, "expected at least one observer technical problem");
  result.technicalProblems.forEach((problem) => {
    assertEqual(problem.code, "observer_rule_execution_failed");
    assertTrue(!problem.message.includes("\n"), "message must not be multiline (stack trace-shaped)");
    assertTrue(!problem.message.includes("    at "), "message must not contain a stack trace frame");
  });

  const affectedEvaluations = result.pages[0].signalEvaluations.filter((e) => e.notEvaluableReasonCode === "observer_rule_execution_failed");
  assertTrue(affectedEvaluations.length > 0, "expected at least one evaluation marked as an observer rule execution failure");
});

// --- 40: the protected synthetic suite's shape is unchanged (regression tripwire) ---

runTest("case 40: the protected synthetic suite still has exactly 8 documents (unchanged by this Sprint)", () => {
  const suite = buildSyntheticReferenceSuite();
  assertEqual(suite.documents.length, 8);
  const totalPages = suite.documents.reduce((sum, doc) => sum + doc.pages.length, 0);
  assertEqual(totalPages, 33);
});
