import type { DocumentSignalObservationResult } from "../signal-observation/signal-observation.types";
import {
  BUDGET_DOCUMENT_PAGE_LOCATOR_VERSION,
  PAGE_LOCATION_DECISION_RULE_SET_VERSION,
} from "./budget-page-location.types";
import { locateBudgetDocumentPages } from "./locate-budget-document-pages";
import { buildObservation, deepFreeze, SIGNAL_TEXT, TEST_SOURCE_HASH } from "./testing/page-location-test-fixtures";

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

function assertTrue(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function forbiddenPropertyPaths(value: unknown, path = "result"): ReadonlyArray<string> {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => forbiddenPropertyPaths(item, `${path}[${index}]`));
  }
  if (value === null || typeof value !== "object") {
    return [];
  }
  const forbidden = /score|confidence|probability|rank|discard|timestamp|uuid/i;
  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => [
    ...(forbidden.test(key) ? [`${path}.${key}`] : []),
    ...forbiddenPropertyPaths(nested, `${path}.${key}`),
  ]);
}

runTest("a document without candidates forms no candidate groups", () => {
  const result = locateBudgetDocumentPages(buildObservation([{ texts: [SIGNAL_TEXT.ordinary] }]));
  assertEqual(result.candidateGroups.length, 0);
});

runTest("one candidate forms one single-page group", () => {
  const result = locateBudgetDocumentPages(buildObservation([{ texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] }]));
  assertEqual(result.candidateGroups.length, 1);
  assertArrayEqual(result.candidateGroups[0].pageNumbers, [1]);
});

runTest("contiguous direct, structural, and closing candidates form one group", () => {
  const result = locateBudgetDocumentPages(
    buildObservation([
      { texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] },
      { texts: [SIGNAL_TEXT.serviceItem] },
      { texts: [SIGNAL_TEXT.total] },
    ]),
  );
  assertEqual(result.candidateGroups.length, 1);
  assertArrayEqual(result.candidateGroups[0].pageNumbers, [1, 2, 3]);
  assertArrayEqual(
    result.candidateGroups[0].members.map((member) => member.candidateType),
    ["direct", "structural_continuity", "closing"],
  );
});

runTest("a closing member ends its group before a consecutive independent candidate", () => {
  const result = locateBudgetDocumentPages(
    buildObservation([
      { texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] },
      { texts: [SIGNAL_TEXT.total] },
      { texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] },
    ]),
  );
  assertArrayEqual(result.candidateGroups.map((group) => group.pageNumbers), [[1, 2], [3]]);
  assertEqual(result.candidateGroups[0].members[1].candidateType, "closing");
  assertEqual(result.candidateGroups[1].members[0].candidateType, "direct");
});

runTest("a non-candidate gap creates two candidate groups", () => {
  const result = locateBudgetDocumentPages(
    buildObservation([
      { texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] },
      { texts: [SIGNAL_TEXT.ordinary] },
      { texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] },
    ]),
  );
  assertEqual(result.candidateGroups.length, 2);
  assertArrayEqual(result.candidateGroups.map((group) => group.pageNumbers), [[1], [3]]);
});

runTest("an ambiguous page separates candidate groups", () => {
  const result = locateBudgetDocumentPages(
    buildObservation([
      { texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] },
      { texts: [SIGNAL_TEXT.serviceItem], widthPoints: 500, heightPoints: 700 },
      { texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] },
    ]),
  );
  assertEqual(result.pageDecisions[1].classification, "ambiguous");
  assertEqual(result.candidateGroups.length, 2);
});

runTest("a not-evaluable page separates candidate groups", () => {
  const result = locateBudgetDocumentPages(
    buildObservation([
      { texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] },
      { texts: [], extractionAvailability: "no_extractable_text" },
      { texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] },
    ]),
  );
  assertEqual(result.pageDecisions[1].classification, "not_evaluable");
  assertEqual(result.candidateGroups.length, 2);
});

runTest("immediately adjacent documentary context is informational on the group", () => {
  const result = locateBudgetDocumentPages(
    buildObservation([
      { texts: [SIGNAL_TEXT.reference] },
      { texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] },
      { texts: [SIGNAL_TEXT.reference] },
    ]),
  );
  assertEqual(result.candidateGroups[0].immediatelyPreviousContextPageNumber, 1);
  assertEqual(result.candidateGroups[0].immediatelyFollowingContextPageNumber, 3);
});

runTest("group key includes hash, range, locator, and decision rule-set versions", () => {
  const result = locateBudgetDocumentPages(buildObservation([{ texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] }]));
  assertEqual(
    result.candidateGroups[0].groupKey,
    [TEST_SOURCE_HASH, 1, 1, BUDGET_DOCUMENT_PAGE_LOCATOR_VERSION, PAGE_LOCATION_DECISION_RULE_SET_VERSION].join(":"),
  );
});

runTest("the same input produces byte-equivalent JSON output", () => {
  const source = buildObservation([
    { texts: [SIGNAL_TEXT.reference] },
    { texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] },
    { texts: [SIGNAL_TEXT.serviceItem] },
  ]);
  assertEqual(JSON.stringify(locateBudgetDocumentPages(source)), JSON.stringify(locateBudgetDocumentPages(source)));
});

runTest("the locator does not mutate a deeply frozen input", () => {
  const source = deepFreeze(
    buildObservation([
      { texts: [SIGNAL_TEXT.reference] },
      { texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] },
      { texts: [SIGNAL_TEXT.total] },
    ]),
  );
  const before = JSON.stringify(source);
  const result = locateBudgetDocumentPages(source);
  assertEqual(result.status, "completed");
  assertEqual(JSON.stringify(source), before);
  assertTrue(Object.isFrozen(source.pages[0].signalEvaluations[0]), "nested evaluation was not frozen by the fixture");
});

runTest("every physical page has exactly one ordered final decision", () => {
  const result = locateBudgetDocumentPages(
    buildObservation([
      { texts: [SIGNAL_TEXT.reference] },
      { texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] },
      { texts: [SIGNAL_TEXT.total] },
      { texts: [SIGNAL_TEXT.ordinary] },
    ]),
  );
  assertArrayEqual(result.pageDecisions.map((decision) => decision.pageNumber), [1, 2, 3, 4]);
  assertEqual(new Set(result.pageDecisions.map((decision) => decision.pageNumber)).size, 4);
});

runTest("result integrity ties every decision and group to its required evidence", () => {
  const source = buildObservation([
    { texts: [SIGNAL_TEXT.reference] },
    { texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] },
    { texts: [SIGNAL_TEXT.serviceItem] },
    { texts: [SIGNAL_TEXT.total] },
    { texts: [SIGNAL_TEXT.ordinary], widthPoints: 500, heightPoints: 700 },
    { texts: [], extractionAvailability: "no_extractable_text", widthPoints: 500, heightPoints: 700 },
  ]);
  const result = locateBudgetDocumentPages(source);
  const decisionsByPage = new Map(result.pageDecisions.map((decision) => [decision.pageNumber, decision]));
  const outcomes = (pageNumber: number) =>
    new Map(source.pages[pageNumber - 1].signalEvaluations.map((evaluation) => [evaluation.signalId, evaluation.outcome]));

  result.pageDecisions.forEach((decision) => {
    const pageOutcomes = outcomes(decision.pageNumber);
    if (decision.candidateType === "structural_continuity") {
      assertEqual(pageOutcomes.get("structural-service-item-identification"), "observed");
      assertEqual(pageOutcomes.get("continuity-stable-geometry"), "observed");
      assertTrue(
        decision.neighborPageNumbersUsed.every((pageNumber) => decisionsByPage.get(pageNumber)?.canAnchor === true),
        "propagated candidate references a non-anchor",
      );
    }
    if (decision.candidateType === "closing") {
      assertEqual(pageOutcomes.get("closure-general-total-mention"), "observed");
      assertEqual(decision.canAnchor, false);
    }
    if (decision.classification === "documentary_context") {
      assertEqual(pageOutcomes.get("referential-budget-spreadsheet-mention"), "observed");
    }
    if (decision.classification === "no_positive_evidence") {
      [
        "referential-budget-spreadsheet-mention",
        "structural-service-item-identification",
        "structural-bdi-documentary-mention",
        "closure-general-total-mention",
      ].forEach((signalId) => assertEqual(pageOutcomes.get(signalId), "not_observed"));
      assertEqual(decision.supportingSignals.length, 4);
      assertTrue(
        decision.supportingSignals.every((reference) => reference.functionInDecision === "absence_support"),
        "negative decision support was not preserved",
      );
    }
    if (decision.classification === "not_evaluable") {
      assertTrue(decision.reasonCode.startsWith("not_evaluable_"), "not-evaluable decision lacks technical reason");
    }
  });

  const groupedPages = result.candidateGroups.flatMap((group) => group.pageNumbers);
  assertEqual(new Set(groupedPages).size, groupedPages.length);
  result.candidateGroups.forEach((group) => {
    assertTrue(group.pageNumbers.every((pageNumber) => decisionsByPage.get(pageNumber)?.classification === "candidate"), "group contains non-candidate");
    assertTrue(group.pageNumbers.every((pageNumber, index) => index === 0 || pageNumber === group.pageNumbers[index - 1] + 1), "group is not contiguous");
    assertTrue(
      group.members.every((member, index) => member.candidateType !== "closing" || index === group.members.length - 1),
      "closing candidate is not the final group member",
    );
  });
  assertEqual(new Set(result.candidateGroups.map((group) => group.groupKey)).size, result.candidateGroups.length);
});

runTest("supporting evidence retains the exact source evaluation object", () => {
  const source = buildObservation([{ texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] }]);
  const sourceEvaluation = source.pages[0].signalEvaluations.find(
    (evaluation) => evaluation.signalId === "structural-service-item-identification",
  );
  const result = locateBudgetDocumentPages(source);
  const retained = result.pageDecisions[0].supportingSignals.find(
    (reference) => reference.signalId === "structural-service-item-identification",
  );
  assertTrue(retained?.sourceEvaluation === sourceEvaluation, "source evaluation was reconstructed instead of retained");
});

runTest("source read metadata and observation problems are preserved by reference", () => {
  const source = buildObservation([{ texts: [SIGNAL_TEXT.ordinary] }]);
  const result = locateBudgetDocumentPages(source);
  assertTrue(result.sourceReadMetadata === source.sourceReadMetadata, "source metadata reference was not preserved");
  assertTrue(result.sourceObservationTechnicalProblems === source.technicalProblems, "observer problems reference was not preserved");
});

runTest("result decisions carry all source and locator versions", () => {
  const source = buildObservation([{ texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] }]);
  const decision = locateBudgetDocumentPages(source).pageDecisions[0];
  assertEqual(decision.sourceByteHash, source.sourceByteHash);
  assertEqual(decision.sourceObserverVersion, source.observerVersion);
  assertEqual(decision.sourceObservationRuleSetVersion, source.ruleSetVersion);
  assertEqual(decision.sourceCatalogVersion, source.catalogVersion);
  assertEqual(decision.locatorVersion, BUDGET_DOCUMENT_PAGE_LOCATOR_VERSION);
  assertEqual(decision.decisionRuleSetVersion, PAGE_LOCATION_DECISION_RULE_SET_VERSION);
});

runTest("result contract contains no scoring, ranking, discard, UUID, or timestamp fields", () => {
  const result = locateBudgetDocumentPages(buildObservation([{ texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] }]));
  assertArrayEqual(forbiddenPropertyPaths(result), []);
});

runTest("result documents bounded technical limitations", () => {
  const result = locateBudgetDocumentPages(buildObservation([{ texts: [SIGNAL_TEXT.ordinary] }]));
  assertTrue(result.limitations.includes("no_economic_interpretation"), "missing economic limitation");
  assertTrue(result.limitations.includes("no_positive_evidence_is_not_discard"), "missing no-discard limitation");
});

runTest("unsupported source versions fail without partial decisions or groups", () => {
  const source = buildObservation([{ texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] }]);
  const future = { ...source, catalogVersion: "future-catalog" } as unknown as DocumentSignalObservationResult;
  const result = locateBudgetDocumentPages(future);
  assertEqual(result.status, "failed");
  assertEqual(result.pageDecisions.length, 0);
  assertEqual(result.candidateGroups.length, 0);
  assertEqual(result.technicalProblems[0].code, "source_observation_version_unsupported");
});

runTest("a coherent failed observation fails location without decisions", () => {
  const source = buildObservation([{ texts: [SIGNAL_TEXT.ordinary] }]);
  const failed: DocumentSignalObservationResult = {
    ...source,
    sourceReadMetadata: { ...source.sourceReadMetadata, sourceReadStatus: "failed" },
    totalPageCount: 0,
    pages: [],
    status: "failed",
    technicalProblems: [],
  };
  const result = locateBudgetDocumentPages(failed);
  assertEqual(result.status, "failed");
  assertEqual(result.technicalProblems[0].code, "source_observation_failed");
});

runTest("physical-read to observer to locator integration runs entirely in memory", () => {
  const source = buildObservation([
    { texts: [SIGNAL_TEXT.reference] },
    { texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] },
    { texts: [SIGNAL_TEXT.serviceItem] },
    { texts: [SIGNAL_TEXT.total] },
  ]);
  const result = locateBudgetDocumentPages(source);
  assertArrayEqual(
    result.pageDecisions.map((decision) => decision.classification),
    ["documentary_context", "candidate", "candidate", "candidate"],
  );
  assertArrayEqual(result.candidateGroups[0].pageNumbers, [2, 3, 4]);
});
