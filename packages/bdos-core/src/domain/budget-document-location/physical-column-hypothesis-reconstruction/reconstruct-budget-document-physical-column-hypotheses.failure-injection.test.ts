import type { SyntheticGeometryTextItem } from "./testing/physical-column-hypothesis-reconstruction-test-bridge";
import { buildPhysicalColumnHypothesisReconstructionFixture } from "./testing/physical-column-hypothesis-reconstruction-test-bridge";
import { reconstructBudgetDocumentPhysicalColumnHypothesesWithDependencies } from "./reconstruct-budget-document-physical-column-hypotheses";
import { constructPhysicalVerticalBands } from "./physical-vertical-band-construction";
import { formPhysicalColumnHypothesisCandidates } from "./physical-column-hypothesis-formation";

/**
 * Seam de injeção de dependências (mesmo padrão das duas Sprints
 * anteriores) — nenhuma das duas funções puras reais (construção de
 * faixa, formação de hipótese) tem um caminho natural de exceção a partir
 * de entrada geometricamente válida. Este arquivo prova, uma fase por
 * vez, que uma falha controlada é tratada corretamente: região
 * `region_not_processable`, disposição
 * `unresolved_physical_column_hypothesis_detection_failed` com a fase
 * correta, conservação íntegra.
 */

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const ROW_HEIGHT = 12;
const ROW_STEP = 25;

function twoColumnRows(count: number, startTop = 700): ReadonlyArray<SyntheticGeometryTextItem> {
  const items: SyntheticGeometryTextItem[] = [];
  for (let row = 0; row < count; row += 1) {
    const top = startTop - row * ROW_STEP;
    items.push({ text: `col1-${row}`, leftPoints: 100, topPoints: top, rightPoints: 160, bottomPoints: top + ROW_HEIGHT, index: row * 2 });
    items.push({ text: `col2-${row}`, leftPoints: 300, topPoints: top, rightPoints: 360, bottomPoints: top + ROW_HEIGHT, index: row * 2 + 1 });
  }
  return items;
}

function buildFixture() {
  return buildPhysicalColumnHypothesisReconstructionFixture("failure-injection", [{ widthPoints: 612, heightPoints: 792, items: twoColumnRows(4) }]);
}

function firstRegion(result: ReturnType<typeof reconstructBudgetDocumentPhysicalColumnHypothesesWithDependencies>) {
  return result.groups[0].pages[0].regions[0];
}

runTest("a controlled failure in band construction makes the region region_not_processable, never a false no_physical_column_hypothesis", () => {
  const input = buildFixture();
  const result = reconstructBudgetDocumentPhysicalColumnHypothesesWithDependencies(input, {
    constructBands: () => {
      throw new Error("controlled test failure: band construction");
    },
    formCandidates: formPhysicalColumnHypothesisCandidates,
  });
  const region = firstRegion(result);
  assertEqual(region.status, "region_not_processable");
  assertEqual(region.hypotheses.length, 0);
  assertEqual(region.segmentDispositions.length, 8, "every physical segment still receives a disposition — none silently disappears");
  assertEqual(region.segmentDispositions.every((d) => d.status === "unresolved_physical_column_hypothesis_detection_failed"), true);
  region.segmentDispositions.forEach((d) => {
    if (d.status === "unresolved_physical_column_hypothesis_detection_failed") {
      assertEqual(d.failedPhase, "band_construction");
    }
  });
  assertEqual(region.technicalProblems.some((p) => p.code === "physical_vertical_band_construction_failed"), true);
});

runTest("a controlled failure in hypothesis formation makes the region region_not_processable, never falsified as ordinary absence of columns", () => {
  const input = buildFixture();
  const result = reconstructBudgetDocumentPhysicalColumnHypothesesWithDependencies(input, {
    constructBands: constructPhysicalVerticalBands,
    formCandidates: () => {
      throw new Error("controlled test failure: hypothesis formation");
    },
  });
  const region = firstRegion(result);
  assertEqual(region.status, "region_not_processable");
  assertEqual(region.hypotheses.length, 0);
  assertEqual(region.segmentDispositions.every((d) => d.status === "unresolved_physical_column_hypothesis_detection_failed"), true);
  region.segmentDispositions.forEach((d) => {
    if (d.status === "unresolved_physical_column_hypothesis_detection_failed") {
      assertEqual(d.failedPhase, "hypothesis_formation");
    }
  });
  assertEqual(region.technicalProblems.some((p) => p.code === "physical_column_hypothesis_formation_failed"), true);
});

runTest("global status becomes completed_with_problems when a region failure occurs, never failed (a per-region failure is not a contract-level failure)", () => {
  const input = buildFixture();
  const result = reconstructBudgetDocumentPhysicalColumnHypothesesWithDependencies(input, {
    constructBands: () => {
      throw new Error("controlled");
    },
    formCandidates: formPhysicalColumnHypothesisCandidates,
  });
  assertEqual(result.status, "completed_with_problems");
});

runTest("a manufactured concurrent claim (two candidates sharing a segment, injected via formCandidates) never becomes a confirmed hypothesis and marks every affected segment ambiguous", () => {
  const input = buildFixture();
  const result = reconstructBudgetDocumentPhysicalColumnHypothesesWithDependencies(input, {
    constructBands: constructPhysicalVerticalBands,
    formCandidates: (bands) => {
      const orderedSignatures = bands.map((b) => b.signature);
      if (orderedSignatures.length === 0) {
        return [];
      }
      const first = bands[0];
      const second = bands[1] ?? bands[0];
      const candidateA = {
        signature: first.signature,
        contributingAlignmentKeys: ["synthetic-a"],
        leftPoints: first.leftPoints,
        topPoints: first.topPoints,
        rightPoints: first.rightPoints,
        bottomPoints: first.bottomPoints,
        widthPoints: first.widthPoints,
        heightPoints: first.heightPoints,
        centerXPoints: first.centerXPoints,
        centerYPoints: first.centerYPoints,
        conflicted: true,
      };
      const candidateB = {
        signature: second.signature,
        contributingAlignmentKeys: ["synthetic-b"],
        leftPoints: second.leftPoints,
        topPoints: second.topPoints,
        rightPoints: second.rightPoints,
        bottomPoints: second.bottomPoints,
        widthPoints: second.widthPoints,
        heightPoints: second.heightPoints,
        centerXPoints: second.centerXPoints,
        centerYPoints: second.centerYPoints,
        conflicted: true,
      };
      return [candidateA, candidateB];
    },
  });
  const region = firstRegion(result);
  assertEqual(region.hypotheses.length, 0, "no conflicting formation is ever declared a valid hypothesis");
  const ambiguous = region.segmentDispositions.filter((d) => d.status === "unresolved_physical_column_hypothesis_ambiguity");
  assertEqual(ambiguous.length > 0, true);
  ambiguous.forEach((d) => {
    if (d.status === "unresolved_physical_column_hypothesis_ambiguity") {
      assertEqual(d.conflictingCandidateHypothesisKeys.length >= 1, true);
    }
  });
  assertEqual(region.technicalProblems.some((p) => p.code === "physical_column_hypothesis_overlap_detected"), true);
});
