import type { DocumentSignalObservationResult, SignalEvaluation } from "../signal-observation/signal-observation.types";
import { validatePageLocationInput } from "./page-location-input-validation";
import { buildObservation, cloneObservation, SIGNAL_TEXT, withObserverRuleFailure } from "./testing/page-location-test-fixtures";

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

function replaceEvaluation(
  source: DocumentSignalObservationResult,
  pageNumber: number,
  signalId: string,
  transform: (evaluation: SignalEvaluation) => SignalEvaluation,
): DocumentSignalObservationResult {
  return {
    ...source,
    pages: source.pages.map((page) =>
      page.pageNumber !== pageNumber
        ? page
        : {
            ...page,
            signalEvaluations: page.signalEvaluations.map((evaluation) =>
              evaluation.signalId === signalId ? transform(evaluation) : evaluation,
            ),
          },
    ),
  };
}

runTest("accepts a complete observation produced by the real observer", () => {
  const result = validatePageLocationInput(buildObservation([{ texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] }]));
  assertEqual(result.kind, "valid");
  assertEqual(result.problems.length, 0);
});

runTest("rejects an unknown observer version without best effort", () => {
  const source = buildObservation([{ texts: [SIGNAL_TEXT.ordinary] }]);
  const future = { ...source, observerVersion: "document-signal-observer-v99" } as unknown as DocumentSignalObservationResult;
  const result = validatePageLocationInput(future);
  assertEqual(result.kind, "version_unsupported");
  assertEqual(result.problems[0]?.code, "source_observation_version_unsupported");
});

runTest("rejects an unknown observation rule-set version", () => {
  const source = buildObservation([{ texts: [SIGNAL_TEXT.ordinary] }]);
  const future = { ...source, ruleSetVersion: "future-rules" } as unknown as DocumentSignalObservationResult;
  assertEqual(validatePageLocationInput(future).kind, "version_unsupported");
});

runTest("accepts a coherent failed source as controlled source failure", () => {
  const source = buildObservation([{ texts: [SIGNAL_TEXT.ordinary] }]);
  const failed: DocumentSignalObservationResult = {
    ...source,
    sourceReadMetadata: { ...source.sourceReadMetadata, sourceReadStatus: "failed" },
    totalPageCount: 0,
    pages: [],
    status: "failed",
    technicalProblems: [],
  };
  const result = validatePageLocationInput(failed);
  assertEqual(result.kind, "source_failed");
  assertEqual(result.problems[0]?.code, "source_observation_failed");
});

runTest("rejects non-dense physical page numbering", () => {
  const source = buildObservation([{ texts: [SIGNAL_TEXT.ordinary] }, { texts: [SIGNAL_TEXT.ordinary] }]);
  const invalid: DocumentSignalObservationResult = {
    ...source,
    pages: [source.pages[0], { ...source.pages[1], pageNumber: 3 }],
  };
  assertEqual(validatePageLocationInput(invalid).kind, "invalid");
});

runTest("rejects a mismatch between totalPageCount and page count", () => {
  const source = buildObservation([{ texts: [SIGNAL_TEXT.ordinary] }]);
  assertEqual(validatePageLocationInput({ ...source, totalPageCount: 2 }).kind, "invalid");
});

runTest("rejects a page with a missing catalog evaluation", () => {
  const source = buildObservation([{ texts: [SIGNAL_TEXT.ordinary] }]);
  const invalid: DocumentSignalObservationResult = {
    ...source,
    pages: [{ ...source.pages[0], signalEvaluations: source.pages[0].signalEvaluations.slice(1) }],
  };
  assertEqual(validatePageLocationInput(invalid).kind, "invalid");
});

runTest("rejects a duplicate signal evaluation", () => {
  const source = buildObservation([{ texts: [SIGNAL_TEXT.ordinary] }]);
  const evaluations = source.pages[0].signalEvaluations;
  const invalid: DocumentSignalObservationResult = {
    ...source,
    pages: [{ ...source.pages[0], signalEvaluations: [evaluations[0], ...evaluations.slice(0, -1)] }],
  };
  assertEqual(validatePageLocationInput(invalid).kind, "invalid");
});

runTest("rejects an unknown signal evaluation", () => {
  const source = buildObservation([{ texts: [SIGNAL_TEXT.ordinary] }]);
  const evaluations = source.pages[0].signalEvaluations;
  const unknown = { ...evaluations[0], signalId: "unknown-signal" };
  const invalid: DocumentSignalObservationResult = {
    ...source,
    pages: [{ ...source.pages[0], signalEvaluations: [unknown, ...evaluations.slice(1)] }],
  };
  assertEqual(validatePageLocationInput(invalid).kind, "invalid");
});

runTest("rejects a duplicate physical page number", () => {
  const source = buildObservation([{ texts: [SIGNAL_TEXT.ordinary] }, { texts: [SIGNAL_TEXT.ordinary] }]);
  const invalid: DocumentSignalObservationResult = {
    ...source,
    pages: [source.pages[0], { ...source.pages[1], pageNumber: 1 }],
  };
  assertEqual(validatePageLocationInput(invalid).kind, "invalid");
});

runTest("rejects positive text evidence bound to another physical page", () => {
  const source = buildObservation([{ texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] }]);
  const invalid = replaceEvaluation(source, 1, "structural-service-item-identification", (evaluation) => ({
    ...evaluation,
    evidence:
      evaluation.evidence === null
        ? null
        : {
            ...evaluation.evidence,
            references: evaluation.evidence.references.map((reference) => ({ ...reference, pageNumber: 2 })),
          },
  }));
  const result = validatePageLocationInput(invalid);
  assertEqual(result.kind, "invalid");
  assertTrue(result.problems.some((entry) => entry.code === "source_observation_evidence_inconsistent"), "expected evidence problem");
});

runTest("rejects geometry invented inside textual evidence", () => {
  const source = buildObservation([{ texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] }]);
  const invalid = replaceEvaluation(source, 1, "structural-service-item-identification", (evaluation) => ({
    ...evaluation,
    evidence:
      evaluation.evidence === null
        ? null
        : {
            ...evaluation.evidence,
            references: evaluation.evidence.references.map((reference) => ({
              ...reference,
              geometry: { widthPoints: 612, heightPoints: 792, orientation: "portrait" },
            })),
          },
  }));
  assertEqual(validatePageLocationInput(invalid).kind, "invalid");
});

runTest("rejects text items invented inside geometric evidence", () => {
  const source = buildObservation([{ texts: [SIGNAL_TEXT.ordinary] }, { texts: [SIGNAL_TEXT.ordinary] }]);
  const invalid = replaceEvaluation(source, 1, "continuity-stable-geometry", (evaluation) => ({
    ...evaluation,
    evidence:
      evaluation.evidence === null
        ? null
        : {
            ...evaluation.evidence,
            references: evaluation.evidence.references.map((reference, index) =>
              index === 0
                ? {
                    ...reference,
                    textItems: [{ textItemIndex: 0, originalText: "invented", normalizedText: "invented" }],
                  }
                : reference,
            ),
          },
  }));
  assertEqual(validatePageLocationInput(invalid).kind, "invalid");
});

runTest("rejects an observed evidence hash different from the source hash", () => {
  const source = buildObservation([{ texts: [SIGNAL_TEXT.serviceItem, SIGNAL_TEXT.bdi] }]);
  const invalid = replaceEvaluation(source, 1, "structural-bdi-documentary-mention", (evaluation) => ({
    ...evaluation,
    evidence: evaluation.evidence === null ? null : { ...evaluation.evidence, sourceByteHash: "b".repeat(64) },
  }));
  assertEqual(validatePageLocationInput(invalid).kind, "invalid");
});

runTest("rejects duplicate geometric neighbor evidence", () => {
  const source = buildObservation([{ texts: [SIGNAL_TEXT.ordinary] }, { texts: [SIGNAL_TEXT.ordinary] }]);
  const invalid = replaceEvaluation(source, 1, "continuity-stable-geometry", (evaluation) => ({
    ...evaluation,
    evidence:
      evaluation.evidence === null
        ? null
        : { ...evaluation.evidence, references: [...evaluation.evidence.references, evaluation.evidence.references[1]] },
  }));
  assertEqual(validatePageLocationInput(invalid).kind, "invalid");
});

runTest("rejects incomplete source read version metadata", () => {
  const source = buildObservation([{ texts: [SIGNAL_TEXT.ordinary] }]);
  const invalid: DocumentSignalObservationResult = {
    ...source,
    sourceReadMetadata: { ...source.sourceReadMetadata, adapterVersion: "" },
  };
  assertEqual(validatePageLocationInput(invalid).kind, "invalid");
});

runTest("accepts a coherent observer rule execution failure", () => {
  const source = withObserverRuleFailure(
    buildObservation([{ texts: [SIGNAL_TEXT.serviceItem] }]),
    1,
    "structural-bdi-documentary-mention",
  );
  assertEqual(validatePageLocationInput(source).kind, "valid");
});

runTest("rejects an observer failure without its matching technical problem", () => {
  const source = withObserverRuleFailure(
    buildObservation([{ texts: [SIGNAL_TEXT.serviceItem] }]),
    1,
    "structural-bdi-documentary-mention",
  );
  const invalid: DocumentSignalObservationResult = { ...source, technicalProblems: [], status: "completed" };
  assertEqual(validatePageLocationInput(invalid).kind, "invalid");
});

runTest("rejects completed status with observer technical problems", () => {
  const source = withObserverRuleFailure(
    buildObservation([{ texts: [SIGNAL_TEXT.serviceItem] }]),
    1,
    "structural-bdi-documentary-mention",
  );
  assertEqual(validatePageLocationInput({ ...source, status: "completed" }).kind, "invalid");
});

runTest("cloning a source fixture preserves its valid contract", () => {
  const clone = cloneObservation(buildObservation([{ texts: [SIGNAL_TEXT.reference] }]));
  assertEqual(validatePageLocationInput(clone).kind, "valid");
});
