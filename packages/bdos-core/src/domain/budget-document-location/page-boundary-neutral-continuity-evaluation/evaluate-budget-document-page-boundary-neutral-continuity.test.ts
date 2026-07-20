import { evaluateBudgetDocumentPageBoundaryNeutralContinuity } from "./evaluate-budget-document-page-boundary-neutral-continuity";
import { groupFixture, lineFixture, pageFixture, pageLocalResultFixture, positionFixture, regionFixture } from "./testing/page-boundary-neutral-continuity-evaluation-fixture-builders";

function equal<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function matchingPage(pageNumber: number, regionKey: string, lineKey: string, columnOrders: ReadonlyArray<number> = [1]): ReturnType<typeof pageFixture> {
  const positions = columnOrders.map((columnOrder, index) => positionFixture(`gi-${lineKey}-${index}`, lineKey, 1, columnOrder, pageNumber, regionKey));
  const line = lineFixture(lineKey, pageNumber, 1, "structured", positions);
  const region = regionFixture(regionKey, pageNumber, 1, "structured", [line], { leftPoints: 0, rightPoints: 100, widthPoints: 100 });
  return pageFixture(pageNumber, "structured", [region]);
}

// --- sustained -------------------------------------------------------------------

const p1 = matchingPage(1, "R1", "L1");
const p2 = matchingPage(2, "R2", "L2");
const sustainedGroup = groupFixture("GSUS", "structured", [p1, p2]);
const sustainedResult = evaluateBudgetDocumentPageBoundaryNeutralContinuity({ pageLocalNeutralStructuredEvidence: pageLocalResultFixture([sustainedGroup]) });
equal(sustainedResult.status, "evaluated", "a clean matching two-page group must produce global status 'evaluated'");
equal(sustainedResult.evaluations.length, 1, "a two-page group must produce exactly one evaluation");
equal(sustainedResult.evaluations[0].status, "continuity_sustained", "matching column signature and geometry must sustain continuity");
equal(sustainedResult.metrics.sustainedCount, 1, "metrics must reflect the sustained evaluation");
equal(sustainedResult.metrics.expectedPageBoundaryCount, sustainedResult.metrics.producedEvaluationCount, "expected and produced boundary counts must always match");

// --- not_sustained (geometria incompatível) --------------------------------------

const incompatiblePage2 = pageFixture(2, "structured", [regionFixture("R2b", 2, 1, "structured", [lineFixture("L2b", 2, 1, "structured", [positionFixture("gi-2b", "L2b", 1, 1, 2, "R2b")])], { leftPoints: 500, rightPoints: 900, widthPoints: 400 })]);
const notSustainedGroup = groupFixture("GNS", "structured", [p1, incompatiblePage2]);
const notSustainedResult = evaluateBudgetDocumentPageBoundaryNeutralContinuity({ pageLocalNeutralStructuredEvidence: pageLocalResultFixture([notSustainedGroup]) });
equal(notSustainedResult.evaluations[0].status, "continuity_not_sustained", "incompatible geometry must produce not_sustained");
equal(notSustainedResult.evaluations[0].contraryEvidence.length > 0, true, "not_sustained must carry at least one contrary evidence entry");

// --- ambiguous (linha de fronteira vazia => sinal D inconclusivo) ----------------

const emptyLinePage2 = pageFixture(2, "structured", [regionFixture("R2c", 2, 1, "structured", [lineFixture("L2c", 2, 1, "structured", [])], { leftPoints: 0, rightPoints: 100, widthPoints: 100 })]);
const ambiguousGroup = groupFixture("GAMB", "structured", [p1, emptyLinePage2]);
const ambiguousResult = evaluateBudgetDocumentPageBoundaryNeutralContinuity({ pageLocalNeutralStructuredEvidence: pageLocalResultFixture([ambiguousGroup]) });
equal(ambiguousResult.evaluations[0].status, "continuity_ambiguous", "an inconclusive merit signal with no contrary evidence must produce ambiguous");

// --- ambiguous via geometria não finita (nunca not_sustained) ---------------------

const nonFiniteGeometryPage2 = matchingPage(2, "R2nf", "L2nf");
const nonFiniteGeometryPage2WithNaN = { ...nonFiniteGeometryPage2, regions: [{ ...nonFiniteGeometryPage2.regions[0], sourceRegionCandidate: { ...nonFiniteGeometryPage2.regions[0].sourceRegionCandidate, widthPoints: NaN } }] };
const nonFiniteGeometryGroup = groupFixture("GNANGEO", "structured", [p1, nonFiniteGeometryPage2WithNaN]);
const nonFiniteGeometryResult = evaluateBudgetDocumentPageBoundaryNeutralContinuity({ pageLocalNeutralStructuredEvidence: pageLocalResultFixture([nonFiniteGeometryGroup]) });
equal(nonFiniteGeometryResult.evaluations[0].status, "continuity_ambiguous", "a non-finite geometry input (matching column signature otherwise) must classify as ambiguous, never not_sustained");
equal(nonFiniteGeometryResult.evaluations[0].contraryEvidence.length, 0, "non-finite geometry must never produce contrary evidence");
const geometrySignal = nonFiniteGeometryResult.evaluations[0].observedSignals.find((s) => s.signal === "horizontal_geometry_compatibility")!;
equal(geometrySignal.outcome, "geometry_inconclusive", "the underlying signal outcome must be geometry_inconclusive");
equal((geometrySignal as { horizontalOverlapRatio: number | null }).horizontalOverlapRatio, null, "the published signal must carry null ratios, never NaN (which JSON would otherwise silently coerce to null anyway — this asserts the value, not just its serialization)");
const nonFiniteGeometryAgain = evaluateBudgetDocumentPageBoundaryNeutralContinuity({ pageLocalNeutralStructuredEvidence: pageLocalResultFixture([nonFiniteGeometryGroup]) });
equal(nonFiniteGeometryAgain.resultFingerprint, nonFiniteGeometryResult.resultFingerprint, "a non-finite geometry input must still produce a deterministic final fingerprint across repeated runs");

// --- not_processable (página upstream_not_processable) ---------------------------

const notProcessablePage2 = pageFixture(2, "upstream_not_processable", []);
const notProcessableGroup = groupFixture("GNP", "structured_with_problems", [p1, notProcessablePage2]);
const notProcessableResult = evaluateBudgetDocumentPageBoundaryNeutralContinuity({ pageLocalNeutralStructuredEvidence: pageLocalResultFixture([notProcessableGroup]) });
equal(notProcessableResult.evaluations[0].status, "continuity_not_processable", "a not-processable target page must produce continuity_not_processable, never ambiguous");

// --- failed (empate estrutural) + isolamento de par -------------------------------

const p3 = matchingPage(3, "R3", "L3");
// Page 2 has an UNAMBIGUOUS opening region (order 1, feeds boundary 1->2) but a TIED closing
// region (order 5 x2, feeds boundary 2->3) — proving the two boundaries sharing this page are
// isolated from each other, not merely both failing together because the whole page is broken.
const mixedTiePage2 = pageFixture(2, "structured", [
  regionFixture("R2open", 2, 1, "structured", [lineFixture("L2open", 2, 1, "structured", [positionFixture("gi-2open", "L2open", 1, 1, 2, "R2open")])], { leftPoints: 0, rightPoints: 100, widthPoints: 100 }),
  regionFixture("R2t1", 2, 5, "structured", [lineFixture("L2t1", 2, 1, "structured", [positionFixture("gi-2t1", "L2t1", 1, 1, 2, "R2t1")])]),
  regionFixture("R2t2", 2, 5, "structured", [lineFixture("L2t2", 2, 1, "structured", [positionFixture("gi-2t2", "L2t2", 1, 1, 2, "R2t2")])]),
]);
const isolationGroup = groupFixture("GISO", "structured", [p1, mixedTiePage2, p3]);
const isolationResult = evaluateBudgetDocumentPageBoundaryNeutralContinuity({ pageLocalNeutralStructuredEvidence: pageLocalResultFixture([isolationGroup]) });
equal(isolationResult.evaluations.length, 2, "a three-page group must still produce exactly two evaluations even when one boundary fails");
const pairOneToTwo = isolationResult.evaluations.find((evaluation) => evaluation.originPageNumber === 1 && evaluation.targetPageNumber === 2)!;
const pairTwoToThree = isolationResult.evaluations.find((evaluation) => evaluation.originPageNumber === 2 && evaluation.targetPageNumber === 3)!;
equal(pairOneToTwo.status, "continuity_sustained", "the 1->2 boundary must evaluate normally to completion — the tie affecting page 2's CLOSING selection must never leak into its unambiguous OPENING selection");
equal(pairTwoToThree.status, "continuity_evaluation_failed", "the 2->3 boundary must fail on page 2's genuinely tied closing region");
equal(pairTwoToThree.technicalProblems[0].code, "boundary_region_selection_ambiguous", "the failure must be reported with the correct technical problem code");
equal(isolationResult.status, "evaluated_with_problems", "any continuity_evaluation_failed evaluation must surface at the global status level");

// --- isolamento de grupo (Gate 0 incoerente não afeta grupo irmão) ----------------

const gapGroup = groupFixture("GGAP", "structured", [matchingPage(10, "R10", "L10"), matchingPage(12, "R12", "L12")]);
const healthyGroup = groupFixture("GHEALTHY", "structured", [p1, p2]);
const mixedResult = evaluateBudgetDocumentPageBoundaryNeutralContinuity({ pageLocalNeutralStructuredEvidence: pageLocalResultFixture([gapGroup, healthyGroup]) });
equal(mixedResult.evaluations.length, 1, "an incoherent group must contribute zero evaluations while a sibling coherent group is fully evaluated");
equal(mixedResult.metrics.incoherentGroupCount, 1, "incoherent group count must be reported");
equal(mixedResult.status, "evaluated_with_problems", "any incoherent group must surface at the global status level");

// --- permutação incidental (ordem dos grupos na entrada não é normativa) ---------

const orderA = evaluateBudgetDocumentPageBoundaryNeutralContinuity({ pageLocalNeutralStructuredEvidence: pageLocalResultFixture([gapGroup, healthyGroup]) });
const orderB = evaluateBudgetDocumentPageBoundaryNeutralContinuity({ pageLocalNeutralStructuredEvidence: pageLocalResultFixture([healthyGroup, gapGroup]) });
equal(JSON.stringify(orderA.evaluations), JSON.stringify(orderB.evaluations), "the canonical evaluation ordering must be invariant to the incidental order of groups in the g.2 input");

// --- entrada inválida --------------------------------------------------------------

const tamperedSource = { ...pageLocalResultFixture([healthyGroup]), resultFingerprint: "tampered" };
const invalidResult = evaluateBudgetDocumentPageBoundaryNeutralContinuity({ pageLocalNeutralStructuredEvidence: tamperedSource });
equal(invalidResult.status, "failed", "a tampered g.2 source fingerprint must invalidate the entire g.3 evaluation");
equal(invalidResult.evaluations.length, 0, "an invalid input must never produce any evaluation");
equal(invalidResult.technicalProblems[0].code, "source_fingerprint_invalid", "the invalidation reason must be reported");

// --- unicidade global de sourceCandidateGroupKey (entrada inválida, nunca execução parcial) ---

const duplicateKeyGroupOne = groupFixture("GDUP", "structured", [p1, p2]);
const duplicateKeyGroupTwo = groupFixture("GDUP", "structured", [p3, matchingPage(4, "R4", "L4")]);
const duplicateGroupKeyResult = evaluateBudgetDocumentPageBoundaryNeutralContinuity({ pageLocalNeutralStructuredEvidence: pageLocalResultFixture([duplicateKeyGroupOne, duplicateKeyGroupTwo]) });
equal(duplicateGroupKeyResult.status, "failed", "two groups sharing the same sourceCandidateGroupKey must invalidate the entire g.3 evaluation globally");
equal(duplicateGroupKeyResult.evaluations.length, 0, "no evaluation may be produced — not even for the group that would otherwise be well-formed (no partial execution on an invalid global contract)");
equal(duplicateGroupKeyResult.technicalProblems.length, 1, "exactly one technical problem must be reported");
equal(duplicateGroupKeyResult.technicalProblems[0].code, "source_group_reference_invalid", "the reported code must be source_group_reference_invalid");
equal(duplicateGroupKeyResult.metrics.receivedGroupCount, 0, "metrics must reflect the global failure (zero groups processed), coherent with the invalid-input shape used elsewhere");
equal(duplicateGroupKeyResult.metrics.producedEvaluationCount, 0, "produced evaluation count must be zero, consistent with the empty evaluations array");

// --- fingerprints ---------------------------------------------------------------

const again = evaluateBudgetDocumentPageBoundaryNeutralContinuity({ pageLocalNeutralStructuredEvidence: pageLocalResultFixture([healthyGroup]) });
const first = evaluateBudgetDocumentPageBoundaryNeutralContinuity({ pageLocalNeutralStructuredEvidence: pageLocalResultFixture([healthyGroup]) });
equal(first.identityFingerprint, again.identityFingerprint, "identical g.2 source content must produce an identical identity fingerprint");
equal(first.resultFingerprint, again.resultFingerprint, "identical g.2 source content and identical evaluation output must produce an identical result fingerprint");
equal(first.identityFingerprint !== sustainedResult.identityFingerprint, true, "a different g.2 source content must produce a different identity fingerprint");

console.log("ok - end-to-end orchestrator: sustained, not_sustained, ambiguous, not_processable, failed-via-tie with pair-level isolation, group-level isolation of an incoherent group, permutation invariance of group order, invalid-input short-circuit, and fingerprint determinism/sensitivity");
