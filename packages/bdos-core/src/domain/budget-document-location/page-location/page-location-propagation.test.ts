import { locateBudgetDocumentPages } from "./locate-budget-document-pages";
import { buildObservation, SIGNAL_TEXT } from "./testing/page-location-test-fixtures";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertArrayEqual<T>(actual: ReadonlyArray<T>, expected: ReadonlyArray<T>, message?: string): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${message ?? "arrays differ"}: expected ${expectedJson}, got ${actualJson}`);
  }
}

runTest("item plus BDI propagates to the following service-item page", () => {
  const result = locateBudgetDocumentPages(
    buildObservation([
      { texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] },
      { texts: [SIGNAL_TEXT.serviceItem] },
    ]),
  );
  assertEqual(result.pageDecisions[1].candidateType, "structural_continuity");
  assertArrayEqual(result.pageDecisions[1].neighborPageNumbersUsed, [1]);
});

runTest("item plus BDI propagates to the previous service-item page", () => {
  const result = locateBudgetDocumentPages(
    buildObservation([
      { texts: [SIGNAL_TEXT.serviceItem] },
      { texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] },
    ]),
  );
  assertEqual(result.pageDecisions[0].candidateType, "structural_continuity");
  assertArrayEqual(result.pageDecisions[0].neighborPageNumbersUsed, [2]);
});

runTest("a propagated structural candidate continues propagation", () => {
  const result = locateBudgetDocumentPages(
    buildObservation([
      { texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] },
      { texts: [SIGNAL_TEXT.serviceItem] },
      { texts: [SIGNAL_TEXT.serviceItem] },
    ]),
  );
  assertEqual(result.pageDecisions[1].candidateType, "structural_continuity");
  assertEqual(result.pageDecisions[2].candidateType, "structural_continuity");
  assertArrayEqual(result.pageDecisions[2].neighborPageNumbersUsed, [2]);
});

runTest("fixed-point propagation also continues backwards", () => {
  const result = locateBudgetDocumentPages(
    buildObservation([
      { texts: [SIGNAL_TEXT.serviceItem] },
      { texts: [SIGNAL_TEXT.serviceItem] },
      { texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] },
    ]),
  );
  assertEqual(result.pageDecisions[0].candidateType, "structural_continuity");
  assertArrayEqual(result.pageDecisions[0].neighborPageNumbersUsed, [2]);
});

runTest("all qualifying adjacent anchors are recorded in physical order", () => {
  const result = locateBudgetDocumentPages(
    buildObservation([
      { texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] },
      { texts: [SIGNAL_TEXT.serviceItem] },
      { texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] },
    ]),
  );
  assertArrayEqual(result.pageDecisions[1].neighborPageNumbersUsed, [1, 3]);
});

runTest("item plus total does not propagate to either adjacent page", () => {
  const result = locateBudgetDocumentPages(
    buildObservation([
      { texts: [SIGNAL_TEXT.serviceItem] },
      { texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.total] },
      { texts: [SIGNAL_TEXT.serviceItem] },
    ]),
  );
  assertEqual(result.pageDecisions[0].classification, "ambiguous");
  assertEqual(result.pageDecisions[1].candidateType, "direct");
  assertEqual(result.pageDecisions[1].canAnchor, false);
  assertEqual(result.pageDecisions[2].classification, "ambiguous");
});

runTest("a total page adjacent to a structural anchor is a closing candidate", () => {
  const result = locateBudgetDocumentPages(
    buildObservation([
      { texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] },
      { texts: [SIGNAL_TEXT.total] },
    ]),
  );
  assertEqual(result.pageDecisions[1].classification, "candidate");
  assertEqual(result.pageDecisions[1].candidateType, "closing");
  assertEqual(result.pageDecisions[1].canAnchor, false);
});

runTest("a closing page records every qualifying structural neighbor", () => {
  const result = locateBudgetDocumentPages(
    buildObservation([
      { texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] },
      { texts: [SIGNAL_TEXT.total] },
      { texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] },
    ]),
  );
  assertArrayEqual(result.pageDecisions[1].neighborPageNumbersUsed, [1, 3]);
});

runTest("a closing candidate never propagates further", () => {
  const result = locateBudgetDocumentPages(
    buildObservation([
      { texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] },
      { texts: [SIGNAL_TEXT.total] },
      { texts: [SIGNAL_TEXT.serviceItem] },
    ]),
  );
  assertEqual(result.pageDecisions[1].candidateType, "closing");
  assertEqual(result.pageDecisions[2].classification, "ambiguous");
});

runTest("geometry mismatch forms a propagation barrier", () => {
  const result = locateBudgetDocumentPages(
    buildObservation([
      { texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi], widthPoints: 612, heightPoints: 792 },
      { texts: [SIGNAL_TEXT.serviceItem], widthPoints: 500, heightPoints: 700 },
      { texts: [SIGNAL_TEXT.serviceItem], widthPoints: 500, heightPoints: 700 },
    ]),
  );
  assertEqual(result.pageDecisions[1].classification, "ambiguous");
  assertEqual(result.pageDecisions[2].classification, "ambiguous");
});

runTest("a not-evaluable page forms a propagation barrier", () => {
  const result = locateBudgetDocumentPages(
    buildObservation([
      { texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] },
      { texts: [], extractionAvailability: "no_extractable_text" },
      { texts: [SIGNAL_TEXT.serviceItem] },
    ]),
  );
  assertEqual(result.pageDecisions[1].classification, "not_evaluable");
  assertEqual(result.pageDecisions[2].classification, "ambiguous");
});

runTest("an extraction-error page forms a propagation barrier", () => {
  const result = locateBudgetDocumentPages(
    buildObservation([
      { texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] },
      { texts: [], extractionAvailability: "extraction_failed" },
      { texts: [SIGNAL_TEXT.serviceItem] },
    ]),
  );
  assertEqual(result.status, "completed_with_problems");
  assertEqual(result.pageDecisions[1].classification, "not_evaluable");
  assertEqual(result.pageDecisions[2].classification, "ambiguous");
});

runTest("propagation output is independent of array traversal direction", () => {
  const source = buildObservation([
    { texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] },
    { texts: [SIGNAL_TEXT.serviceItem] },
    { texts: [SIGNAL_TEXT.serviceItem] },
    { texts: [SIGNAL_TEXT.serviceItem] },
  ]);
  const first = locateBudgetDocumentPages(source);
  const second = locateBudgetDocumentPages(source);
  assertArrayEqual(
    first.pageDecisions.map((decision) => [decision.pageNumber, decision.primaryRuleId, decision.neighborPageNumbersUsed]),
    second.pageDecisions.map((decision) => [decision.pageNumber, decision.primaryRuleId, decision.neighborPageNumbersUsed]),
  );
});
