import type { NeutralDocumentGroup } from "../page-local-neutral-structured-evidence-formation/budget-document-page-local-neutral-structured-evidence-formation.types";
import type { PageBoundaryNeutralContinuityEvaluation } from "./budget-document-page-boundary-neutral-continuity-evaluation.types";
import { validateEvaluationConservation, validateMetricConservation } from "./page-boundary-neutral-continuity-evaluation-conservation";
import { evaluateBoundaryPair } from "./page-boundary-neutral-continuity-evaluation-pair-evaluator";
import { computeGlobalMetrics } from "./page-boundary-neutral-continuity-evaluation-metrics";
import { groupFixture, lineFixture, pageFixture, positionFixture, regionFixture } from "./testing/page-boundary-neutral-continuity-evaluation-fixture-builders";

function equal<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function pageWithMatchingRegion(pageNumber: number, regionKey: string, lineKey: string): ReturnType<typeof pageFixture> {
  const position = positionFixture(`gi-${lineKey}`, lineKey, 1, 1, pageNumber, regionKey);
  const line = lineFixture(lineKey, pageNumber, 1, "structured", [position]);
  const region = regionFixture(regionKey, pageNumber, 1, "structured", [line], { leftPoints: 0, rightPoints: 100, widthPoints: 100 });
  return pageFixture(pageNumber, "structured", [region]);
}

const page1 = pageWithMatchingRegion(1, "R1", "L1");
const page2 = pageWithMatchingRegion(2, "R2", "L2");
const page3 = pageWithMatchingRegion(3, "R3", "L3");
const group: NeutralDocumentGroup = groupFixture("GX", "structured", [page1, page2, page3]);
const groups: ReadonlyArray<NeutralDocumentGroup> = [group];

const baselineEvaluations: PageBoundaryNeutralContinuityEvaluation[] = [
  evaluateBoundaryPair("GX", page1, page2),
  evaluateBoundaryPair("GX", page2, page3),
];
equal(baselineEvaluations.every((evaluation) => evaluation.status === "continuity_sustained"), true, "sanity: baseline fixture must produce sustained evaluations on both boundaries");
equal(validateEvaluationConservation(baselineEvaluations, groups), null, "a genuinely conforming set of evaluations must pass all nine gates");

// --- Gate 1: população ----------------------------------------------------------

equal(validateEvaluationConservation([baselineEvaluations[0]], groups), "evaluation_population_conservation_failed", "an omitted expected boundary must fail Gate 1");
equal(validateEvaluationConservation([...baselineEvaluations, baselineEvaluations[0]], groups), "evaluation_population_conservation_failed", "a duplicated evaluation for the same boundary must fail Gate 1");

// --- Gate 2: referência -----------------------------------------------------------

const badReference: PageBoundaryNeutralContinuityEvaluation = { ...baselineEvaluations[0], originRegionKey: "does-not-exist" };
equal(validateEvaluationConservation([badReference, baselineEvaluations[1]], groups), "evaluation_reference_conservation_failed", "an evaluation referencing a nonexistent region key must fail Gate 2");

// --- Gate 3: direção/grupo ---------------------------------------------------------
// Gate 1 already encodes (groupKey, originPageNumber, targetPageNumber) as the boundary
// identity, and the expected population is by construction only ever consecutive pairs —
// so any direction violation ALSO changes the boundary key and is caught by Gate 1 first.
// Gate 3 remains as an explicit, independently-named defense-in-depth check (never dead
// code — it fires for any future population-encoding change that stopped folding direction
// into the key), but under the current encoding it is never the FIRST gate to trip.

const invertedDirection: PageBoundaryNeutralContinuityEvaluation = { ...baselineEvaluations[0], targetPageNumber: 3 };
equal(validateEvaluationConservation([invertedDirection, baselineEvaluations[1]], groups), "evaluation_population_conservation_failed", "an evaluation skipping a page (target != origin+1) changes its boundary identity and is caught by Gate 1 before Gate 3 is ever reached");

const selfReferencing: PageBoundaryNeutralContinuityEvaluation = { ...baselineEvaluations[0], targetPageNumber: baselineEvaluations[0].originPageNumber };
equal(validateEvaluationConservation([selfReferencing, baselineEvaluations[1]], groups), "evaluation_population_conservation_failed", "a self-referencing evaluation (origin === target) also changes its boundary identity and is likewise caught by Gate 1 first");

// --- Gate 4: seleção --------------------------------------------------------------

const wrongSelectionKeyFromOtherPage: PageBoundaryNeutralContinuityEvaluation = { ...baselineEvaluations[0], originRegionKey: "R2" }; // real key, but from the wrong page/role
equal(validateEvaluationConservation([wrongSelectionKeyFromOtherPage, baselineEvaluations[1]], groups), "evaluation_reference_conservation_failed", "a region key from a different page reused here is caught as a reference failure (R2 does not exist inside page 1)");

// Genuine Gate 4 violation: the claimed region key exists on the correct page, but is not the
// true extremal (max-order) region — must be caught by recomputed selection, not by reference.
const twoRegionPage1 = pageFixture(1, "structured", [
  regionFixture("R1", 1, 1, "structured", [lineFixture("L1", 1, 1, "structured", [positionFixture("gi-L1", "L1", 1, 1, 1, "R1")])], { leftPoints: 0, rightPoints: 100, widthPoints: 100 }),
  regionFixture("R1x", 1, 2, "structured", [lineFixture("L1x", 1, 1, "structured", [positionFixture("gi-L1x", "L1x", 1, 1, 1, "R1x")])], { leftPoints: 0, rightPoints: 100, widthPoints: 100 }),
]);
const twoRegionGroup: NeutralDocumentGroup = groupFixture("GY", "structured", [twoRegionPage1, page2]);
const trueEvaluation = evaluateBoundaryPair("GY", twoRegionPage1, page2);
equal(trueEvaluation.originRegionKey, "R1x", "sanity: the true closing region of a two-region page must be the one with the higher order");
const wrongButExistingSelection: PageBoundaryNeutralContinuityEvaluation = { ...trueEvaluation, originRegionKey: "R1", originBoundaryLineKey: "L1" };
equal(validateEvaluationConservation([wrongButExistingSelection], [twoRegionGroup]), "evaluation_selection_conservation_failed", "a claimed region that genuinely exists on the right page, but is not the true extremal boundary region, must fail Gate 4");

// --- Gate 5: sinais -----------------------------------------------------------------

const tamperedSignals: PageBoundaryNeutralContinuityEvaluation = {
  ...baselineEvaluations[0],
  observedSignals: baselineEvaluations[0].observedSignals.map((signal) => (signal.signal === "page_processability" ? { ...signal, outcome: "both_pages_not_processable" as const } : signal)),
};
equal(validateEvaluationConservation([tamperedSignals, baselineEvaluations[1]], groups), "evaluation_signal_conservation_failed", "a tampered observed signal that diverges from recomputation must fail Gate 5");

// --- Gate 6: evidência ---------------------------------------------------------------

const invalidEvidence: PageBoundaryNeutralContinuityEvaluation = {
  ...baselineEvaluations[0],
  favorableEvidence: [{ evidence: "matching_column_signature", sourceSignal: "column_signature_compatibility", sourceOutcome: "column_signature_match" }, { evidence: "compatible_horizontal_geometry", sourceSignal: "horizontal_geometry_compatibility", sourceOutcome: "geometry_compatible" }, { evidence: "matching_column_signature", sourceSignal: "column_signature_compatibility", sourceOutcome: "column_signature_match" }],
};
equal(validateEvaluationConservation([invalidEvidence, baselineEvaluations[1]], groups), "evaluation_evidence_conservation_failed", "a duplicated/extra favorable evidence entry not matching the recomputed evidence array must fail Gate 6");

// --- Gate 7: estado ---------------------------------------------------------------

const wrongStatus: PageBoundaryNeutralContinuityEvaluation = { ...baselineEvaluations[0], status: "continuity_not_sustained" };
equal(validateEvaluationConservation([wrongStatus, baselineEvaluations[1]], groups), "evaluation_status_conservation_failed", "a published status diverging from the classification matrix applied to the real signals must fail Gate 7");

// --- Gate 8: partição categórica -----------------------------------------------------

const bogusStatus = { ...baselineEvaluations[0], status: "not_a_real_status" as unknown as PageBoundaryNeutralContinuityEvaluation["status"] };
equal(validateEvaluationConservation([bogusStatus, baselineEvaluations[1]], groups), "evaluation_status_conservation_failed", "an out-of-enum status is first caught by Gate 7 (status rederivation) before ever reaching the partition gate");

// --- Gate 9: métricas ------------------------------------------------------------------

const correctMetrics = computeGlobalMetrics(1, 0, 3, baselineEvaluations, []);
equal(validateMetricConservation(baselineEvaluations, [], 1, 0, 3, correctMetrics), true, "metrics recomputed from the same inputs must conserve");
const tamperedMetrics = { ...correctMetrics, sustainedCount: correctMetrics.sustainedCount + 1 };
equal(validateMetricConservation(baselineEvaluations, [], 1, 0, 3, tamperedMetrics), false, "a published metric that diverges from recomputation must fail Gate 9");

console.log("ok - all nine conservation gates independently violated and caught (population, reference, direction/self-reference, selection-via-reference, signal, evidence, status, out-of-enum status, metric), plus a genuinely conforming baseline passing all nine");
