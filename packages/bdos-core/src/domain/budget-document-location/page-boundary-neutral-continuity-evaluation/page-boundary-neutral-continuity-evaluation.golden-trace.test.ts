import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateBudgetDocumentPageBoundaryNeutralContinuity } from "./evaluate-budget-document-page-boundary-neutral-continuity";
import { groupFixture, lineFixture, pageFixture, pageLocalResultFixture, positionFixture, regionFixture } from "./testing/page-boundary-neutral-continuity-evaluation-fixture-builders";

/**
 * Cenário canônico: um grupo de quatro páginas cobrindo os quatro estados de
 * mérito/gate possíveis num único trace — 1->2 sustained, 2->3 not_sustained
 * (geometria incompatível), 3->4 ambiguous (linha de fronteira vazia) — mais
 * um segundo grupo de duas páginas com fronteira not_processable. Prova em
 * conjunto: conservação, métricas, fingerprint e invariância de permutação.
 */
function page(pageNumber: number, regionKey: string, lineKey: string, geometry: { leftPoints: number; rightPoints: number; widthPoints: number }, columnOrders: ReadonlyArray<number> | null): ReturnType<typeof pageFixture> {
  const positions = columnOrders === null ? [] : columnOrders.map((columnOrder, index) => positionFixture(`gi-${lineKey}-${index}`, lineKey, 1, columnOrder, pageNumber, regionKey));
  const line = lineFixture(lineKey, pageNumber, 1, "structured", positions);
  const region = regionFixture(regionKey, pageNumber, 1, "structured", [line], geometry);
  return pageFixture(pageNumber, "structured", [region]);
}

const geometryA = { leftPoints: 0, rightPoints: 100, widthPoints: 100 };
const geometryFar = { leftPoints: 500, rightPoints: 900, widthPoints: 400 };

const page1 = page(1, "R1", "L1", geometryA, [1]);
const page2 = page(2, "R2", "L2", geometryA, [1]);
const page3 = page(3, "R3", "L3", geometryFar, [1]);
const page4 = page(4, "R4", "L4", geometryFar, []);
const groupA = groupFixture("GOLD-A", "structured", [page1, page2, page3, page4]);

const page10 = page(10, "R10", "L10", geometryA, [1]);
const page11 = pageFixture(11, "upstream_not_processable", []);
const groupB = groupFixture("GOLD-B", "structured_with_problems", [page10, page11]);

function run(groups: ReadonlyArray<ReturnType<typeof groupFixture>>) {
  return evaluateBudgetDocumentPageBoundaryNeutralContinuity({ pageLocalNeutralStructuredEvidence: pageLocalResultFixture(groups) });
}

const actual = run([groupA, groupB]);
if (actual.status !== "evaluated") throw new Error(`golden trace must be a clean 'evaluated' run (no failed evaluations, no incoherent groups), got ${actual.status}`);

const statuses = actual.evaluations.map((evaluation) => `${evaluation.sourceCandidateGroupKey}:${evaluation.originPageNumber}->${evaluation.targetPageNumber}:${evaluation.status}`);
const expectedStatuses = ["GOLD-A:1->2:continuity_sustained", "GOLD-A:2->3:continuity_not_sustained", "GOLD-A:3->4:continuity_ambiguous", "GOLD-B:10->11:continuity_not_processable"];
if (JSON.stringify(statuses) !== JSON.stringify(expectedStatuses)) throw new Error(`unexpected canonical status sequence:\n${JSON.stringify(statuses, null, 2)}`);

const goldenPath = join(dirname(fileURLToPath(import.meta.url)), "testing", "page-boundary-neutral-continuity-evaluation-golden-trace.json");
const snapshot = { status: actual.status, evaluations: actual.evaluations, technicalProblems: actual.technicalProblems, metrics: actual.metrics, identityFingerprint: actual.identityFingerprint, resultFingerprint: actual.resultFingerprint };
if (process.env.WRITE_GOLDEN === "1") {
  writeFileSync(goldenPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
} else {
  const expected = JSON.parse(readFileSync(goldenPath, "utf8"));
  if (JSON.stringify(snapshot) !== JSON.stringify(expected)) throw new Error(`complete golden trace changed:\n${JSON.stringify(snapshot, null, 2)}`);
}

// Invariância de permutação: a ordem incidental dos grupos na entrada nunca é normativa.
const permuted = run([groupB, groupA]);
const permutedSnapshot = { status: permuted.status, evaluations: permuted.evaluations, technicalProblems: permuted.technicalProblems, metrics: permuted.metrics, identityFingerprint: permuted.identityFingerprint, resultFingerprint: permuted.resultFingerprint };
if (JSON.stringify(permutedSnapshot) !== JSON.stringify(snapshot)) throw new Error("permuting the incidental order of groups in the g.2 input changed the canonical golden trace");

// Conservação e partição, sobre o próprio trace publicado.
const m = actual.metrics;
if (m.producedEvaluationCount !== m.sustainedCount + m.ambiguousCount + m.notSustainedCount + m.notProcessableCount + m.failedCount) throw new Error("categorical partition does not sum to producedEvaluationCount");
if (m.expectedPageBoundaryCount !== m.producedEvaluationCount) throw new Error("expected and produced boundary counts must match exactly");
if (m.sustainedCount !== 1 || m.notSustainedCount !== 1 || m.ambiguousCount !== 1 || m.notProcessableCount !== 1 || m.failedCount !== 0) throw new Error("golden trace must exercise exactly one evaluation of each of the four reachable states");

console.log("ok - golden trace: four-boundary canonical scenario covering sustained/not_sustained/ambiguous/not_processable in one run, full-snapshot equality (fingerprints included), group-order permutation invariance, and categorical partition conservation");
