import type { BudgetDocumentPageDecision } from "./budget-page-location.types";
import { locateBudgetDocumentPages } from "./locate-budget-document-pages";
import { buildObservation, SIGNAL_TEXT, withObserverRuleFailure } from "./testing/page-location-test-fixtures";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function locateOne(texts: ReadonlyArray<string>): BudgetDocumentPageDecision {
  const result = locateBudgetDocumentPages(buildObservation([{ texts }]));
  assertEqual(result.status, "completed");
  assertEqual(result.pageDecisions.length, 1);
  return result.pageDecisions[0];
}

runTest("item plus BDI is a direct anchoring candidate", () => {
  const decision = locateOne([SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi]);
  assertEqual(decision.classification, "candidate");
  assertEqual(decision.candidateType, "direct");
  assertEqual(decision.primaryRuleId, "candidate-service-item-and-bdi-v1");
  assertEqual(decision.canAnchor, true);
});

runTest("item plus total is a direct non-anchoring candidate", () => {
  const decision = locateOne([SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.total]);
  assertEqual(decision.classification, "candidate");
  assertEqual(decision.primaryRuleId, "candidate-service-item-and-total-v1");
  assertEqual(decision.canAnchor, false);
});

runTest("item plus BDI has precedence when both direct rules are satisfied", () => {
  const decision = locateOne([SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi, SIGNAL_TEXT.total]);
  assertEqual(decision.primaryRuleId, "candidate-service-item-and-bdi-v1");
  assertEqual(decision.satisfiedRules.length, 2);
});

runTest("reference alone is documentary context", () => {
  const decision = locateOne([SIGNAL_TEXT.reference]);
  assertEqual(decision.classification, "documentary_context");
  assertEqual(decision.canAnchor, false);
});

runTest("a numbered budget-spreadsheet summary entry remains ambiguous", () => {
  const decision = locateOne([`1.2 ${SIGNAL_TEXT.reference}`]);
  assertEqual(decision.classification, "ambiguous");
  assertEqual(decision.candidateType, null);
});

runTest("service item alone is ambiguous", () => {
  assertEqual(locateOne([SIGNAL_TEXT.serviceItem]).classification, "ambiguous");
});

runTest("BDI alone is ambiguous", () => {
  assertEqual(locateOne([SIGNAL_TEXT.bdi]).classification, "ambiguous");
});

runTest("general total alone is ambiguous", () => {
  assertEqual(locateOne([SIGNAL_TEXT.total]).classification, "ambiguous");
});

runTest("ordinary text with all four content signals absent is no-positive-evidence", () => {
  assertEqual(locateOne([SIGNAL_TEXT.ordinary]).classification, "no_positive_evidence");
});

runTest("uniform geometry alone never creates content ambiguity", () => {
  const source = buildObservation([
    { texts: [SIGNAL_TEXT.ordinary] },
    { texts: [SIGNAL_TEXT.ordinary] },
    { texts: [SIGNAL_TEXT.ordinary] },
    { texts: [SIGNAL_TEXT.ordinary] },
  ]);
  const result = locateBudgetDocumentPages(source);
  assertTrue(result.pageDecisions.every((decision) => decision.classification === "no_positive_evidence"), "expected no-positive pages");
  assertEqual(result.candidateGroups.length, 0);
});

runTest("a page without extractable text is not evaluable", () => {
  const result = locateBudgetDocumentPages(buildObservation([{ texts: [], extractionAvailability: "no_extractable_text" }]));
  assertEqual(result.pageDecisions[0].classification, "not_evaluable");
  assertEqual(result.pageDecisions[0].reasonCode, "not_evaluable_no_extractable_text");
});

runTest("a page with extraction error is not evaluable", () => {
  const result = locateBudgetDocumentPages(buildObservation([{ texts: [], extractionAvailability: "extraction_failed" }]));
  assertEqual(result.pageDecisions[0].classification, "not_evaluable");
  assertEqual(result.pageDecisions[0].reasonCode, "not_evaluable_extraction_error");
});

runTest("proven item plus BDI survives an unrelated total rule failure", () => {
  const source = withObserverRuleFailure(
    buildObservation([{ texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] }]),
    1,
    "closure-general-total-mention",
  );
  const result = locateBudgetDocumentPages(source);
  assertEqual(result.pageDecisions[0].classification, "candidate");
  assertEqual(result.pageDecisions[0].primaryRuleId, "candidate-service-item-and-bdi-v1");
  assertTrue(result.pageDecisions[0].limitingSignals.some((entry) => entry.signalId === "closure-general-total-mention"), "missing limitation");
});

runTest("proven item plus total survives an unrelated BDI rule failure", () => {
  const source = withObserverRuleFailure(
    buildObservation([{ texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.total] }]),
    1,
    "structural-bdi-documentary-mention",
  );
  const decision = locateBudgetDocumentPages(source).pageDecisions[0];
  assertEqual(decision.classification, "candidate");
  assertEqual(decision.primaryRuleId, "candidate-service-item-and-total-v1");
  assertEqual(decision.canAnchor, false);
});

runTest("item with failed BDI and absent total is not evaluable", () => {
  const source = withObserverRuleFailure(
    buildObservation([{ texts: [SIGNAL_TEXT.serviceItem] }]),
    1,
    "structural-bdi-documentary-mention",
  );
  assertEqual(locateBudgetDocumentPages(source).pageDecisions[0].classification, "not_evaluable");
});

runTest("item with absent BDI and failed total is not evaluable", () => {
  const source = withObserverRuleFailure(
    buildObservation([{ texts: [SIGNAL_TEXT.serviceItem] }]),
    1,
    "closure-general-total-mention",
  );
  assertEqual(locateBudgetDocumentPages(source).pageDecisions[0].classification, "not_evaluable");
});

runTest("BDI without item remains ambiguous despite failed total", () => {
  const source = withObserverRuleFailure(
    buildObservation([{ texts: [SIGNAL_TEXT.bdi] }]),
    1,
    "closure-general-total-mention",
  );
  assertEqual(locateBudgetDocumentPages(source).pageDecisions[0].classification, "ambiguous");
});

runTest("item remains ambiguous despite failed reference rule", () => {
  const source = withObserverRuleFailure(
    buildObservation([{ texts: [SIGNAL_TEXT.serviceItem] }]),
    1,
    "referential-budget-spreadsheet-mention",
  );
  assertEqual(locateBudgetDocumentPages(source).pageDecisions[0].classification, "ambiguous");
});

runTest("reference with failed item rule is not evaluable", () => {
  const source = withObserverRuleFailure(
    buildObservation([{ texts: [SIGNAL_TEXT.reference] }]),
    1,
    "structural-service-item-identification",
  );
  assertEqual(locateBudgetDocumentPages(source).pageDecisions[0].classification, "not_evaluable");
});

runTest("no-positive-evidence is blocked by any content rule failure", () => {
  const source = withObserverRuleFailure(
    buildObservation([{ texts: [SIGNAL_TEXT.ordinary] }]),
    1,
    "closure-general-total-mention",
  );
  assertEqual(locateBudgetDocumentPages(source).pageDecisions[0].classification, "not_evaluable");
});

runTest("geometry failure does not block a direct candidate", () => {
  const source = withObserverRuleFailure(
    buildObservation([{ texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] }]),
    1,
    "continuity-stable-geometry",
  );
  const decision = locateBudgetDocumentPages(source).pageDecisions[0];
  assertEqual(decision.classification, "candidate");
  assertTrue(decision.limitingSignals.some((entry) => entry.signalId === "continuity-stable-geometry"), "missing geometry limitation");
});

runTest("geometry failure does not block documentary context", () => {
  const source = withObserverRuleFailure(
    buildObservation([{ texts: [SIGNAL_TEXT.reference] }]),
    1,
    "continuity-stable-geometry",
  );
  assertEqual(locateBudgetDocumentPages(source).pageDecisions[0].classification, "documentary_context");
});

runTest("geometry failure does not block no-positive-evidence", () => {
  const source = withObserverRuleFailure(
    buildObservation([{ texts: [SIGNAL_TEXT.ordinary] }]),
    1,
    "continuity-stable-geometry",
  );
  assertEqual(locateBudgetDocumentPages(source).pageDecisions[0].classification, "no_positive_evidence");
});

runTest("a resolved observer limitation produces completed-with-problems", () => {
  const source = withObserverRuleFailure(
    buildObservation([{ texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] }]),
    1,
    "closure-general-total-mention",
  );
  assertEqual(locateBudgetDocumentPages(source).status, "completed_with_problems");
});
