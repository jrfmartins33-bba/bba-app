import type { SyntheticGeometryPage, SyntheticGeometryTextItem } from "./testing/physical-column-hypothesis-reconstruction-test-bridge";
import { buildPhysicalColumnHypothesisReconstructionFixture } from "./testing/physical-column-hypothesis-reconstruction-test-bridge";
import { reconstructBudgetDocumentPhysicalColumnHypotheses } from "./reconstruct-budget-document-physical-column-hypotheses";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
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

function page(items: ReadonlyArray<SyntheticGeometryTextItem>): SyntheticGeometryPage {
  return { widthPoints: PAGE_WIDTH, heightPoints: PAGE_HEIGHT, items };
}

function firstRegion(result: ReturnType<typeof reconstructBudgetDocumentPhysicalColumnHypotheses>) {
  return result.groups[0].pages[0].regions[0];
}

runTest("two clean columns (all three alignment types recur identically) consolidate into two hypotheses, each with three contributing alignments", () => {
  const input = buildPhysicalColumnHypothesisReconstructionFixture("two-clean-columns", [page(twoColumnRows(4))]);
  const result = reconstructBudgetDocumentPhysicalColumnHypotheses(input);
  assertEqual(result.status, "completed");
  const region = firstRegion(result);
  assertEqual(region.status, "hypotheses_reconstructed");
  assertEqual(region.hypotheses.length, 2);
  region.hypotheses.forEach((h) => {
    assertEqual(h.lineKeys.length, 4);
    assertEqual(h.contributingAlignmentKeys.length, 3, "left_edge + right_edge + horizontal_center of the same segments all consolidate");
  });
  assertEqual(region.segmentDispositions.every((d) => d.status === "included_in_physical_column_hypothesis"), true);
  assertEqual(region.metrics.totalSegmentCount, 8);
});

runTest("a column sustained only by left_edge (varying width) forms its own single-alignment hypothesis, separate from a clean companion column", () => {
  const items: SyntheticGeometryTextItem[] = [];
  for (let row = 0; row < 4; row += 1) {
    const top = 700 - row * ROW_STEP;
    items.push({ text: `varw-${row}`, leftPoints: 100, topPoints: top, rightPoints: 160 + row * 8, bottomPoints: top + ROW_HEIGHT, index: row * 2 });
    items.push({ text: `clean-${row}`, leftPoints: 300, topPoints: top, rightPoints: 360, bottomPoints: top + ROW_HEIGHT, index: row * 2 + 1 });
  }
  const input = buildPhysicalColumnHypothesisReconstructionFixture("left-edge-only", [page(items)]);
  const result = reconstructBudgetDocumentPhysicalColumnHypotheses(input);
  const region = firstRegion(result);
  assertEqual(region.hypotheses.length, 2);
  const singleAlignment = region.hypotheses.find((h) => h.contributingAlignmentKeys.length === 1);
  const tripleAlignment = region.hypotheses.find((h) => h.contributingAlignmentKeys.length === 3);
  assertEqual(singleAlignment !== undefined, true, "the varying-width column forms a hypothesis sustained by left_edge alone");
  assertEqual(tripleAlignment !== undefined, true);
});

runTest("a column sustained only by right_edge (varying left, fixed right) forms its own hypothesis", () => {
  const items: SyntheticGeometryTextItem[] = [];
  for (let row = 0; row < 4; row += 1) {
    const top = 700 - row * ROW_STEP;
    items.push({ text: `varl-${row}`, leftPoints: 100 + row * 8, topPoints: top, rightPoints: 200, bottomPoints: top + ROW_HEIGHT, index: row * 2 });
    items.push({ text: `clean-${row}`, leftPoints: 300, topPoints: top, rightPoints: 360, bottomPoints: top + ROW_HEIGHT, index: row * 2 + 1 });
  }
  const input = buildPhysicalColumnHypothesisReconstructionFixture("right-edge-only", [page(items)]);
  const result = reconstructBudgetDocumentPhysicalColumnHypotheses(input);
  const region = firstRegion(result);
  assertEqual(region.hypotheses.length, 2);
  const singleAlignment = region.hypotheses.find((h) => h.contributingAlignmentKeys.length === 1);
  assertEqual(singleAlignment !== undefined, true, "the varying-left column forms a hypothesis sustained by right_edge alone");
});

runTest("a column sustained only by horizontal_center (left and right vary in tandem, center fixed) forms its own hypothesis", () => {
  const items: SyntheticGeometryTextItem[] = [];
  const offsets = [0, 10, 20, 30];
  for (let row = 0; row < 4; row += 1) {
    const top = 700 - row * ROW_STEP;
    const offset = offsets[row];
    items.push({ text: `varc-${row}`, leftPoints: 100 - offset, topPoints: top, rightPoints: 200 + offset, bottomPoints: top + ROW_HEIGHT, index: row * 2 });
    items.push({ text: `clean-${row}`, leftPoints: 300, topPoints: top, rightPoints: 360, bottomPoints: top + ROW_HEIGHT, index: row * 2 + 1 });
  }
  const input = buildPhysicalColumnHypothesisReconstructionFixture("center-only", [page(items)]);
  const result = reconstructBudgetDocumentPhysicalColumnHypotheses(input);
  const region = firstRegion(result);
  assertEqual(region.hypotheses.length, 2);
  const singleAlignment = region.hypotheses.find((h) => h.contributingAlignmentKeys.length === 1);
  assertEqual(singleAlignment !== undefined, true, "the tandem-varying column forms a hypothesis sustained by horizontal_center alone");
});

runTest("two columns with the same lineKeys but different segmentKeys never consolidate and remain independent (non-overlapping) hypotheses", () => {
  const input = buildPhysicalColumnHypothesisReconstructionFixture("distinct-segments", [page(twoColumnRows(4))]);
  const result = reconstructBudgetDocumentPhysicalColumnHypotheses(input);
  const region = firstRegion(result);
  assertEqual(region.hypotheses.length, 2);
  const [h1, h2] = region.hypotheses;
  assertEqual(JSON.stringify([...h1.lineKeys].sort()), JSON.stringify([...h2.lineKeys].sort()), "both hypotheses share the same lineKeys");
  assertEqual(JSON.stringify(h1.segmentKeys) === JSON.stringify(h2.segmentKeys), false, "but never the same segmentKeys");
});

runTest("a column present in only three of four lines forms a valid three-line hypothesis, without inventing a missing cell", () => {
  const items: SyntheticGeometryTextItem[] = [];
  for (let row = 0; row < 4; row += 1) {
    const top = 700 - row * ROW_STEP;
    items.push({ text: `clean-${row}`, leftPoints: 300, topPoints: top, rightPoints: 360, bottomPoints: top + ROW_HEIGHT, index: row });
  }
  // The partial column only appears on rows 0-2 (three lines, meeting the f.2a minimum); row 3 has no segment at that position at all.
  for (let row = 0; row < 3; row += 1) {
    const top = 700 - row * ROW_STEP;
    items.push({ text: `partial-${row}`, leftPoints: 100, topPoints: top, rightPoints: 160, bottomPoints: top + ROW_HEIGHT, index: 4 + row });
  }
  const input = buildPhysicalColumnHypothesisReconstructionFixture("partial-column", [page(items)]);
  const result = reconstructBudgetDocumentPhysicalColumnHypotheses(input);
  const region = firstRegion(result);
  const partialHypothesis = region.hypotheses.find((h) => h.lineKeys.length === 3);
  assertEqual(partialHypothesis !== undefined, true, "expected a three-line hypothesis for the partial column");
  assertEqual(region.metrics.totalSegmentCount, 4 + 3, "four clean-column segments plus three partial-column segments — never a fourth, invented partial segment");
});

runTest("a segment present in every line but never recurring at a stable position (an orphan) is preserved as not_in_physical_column_hypothesis, never absorbed and never discarded", () => {
  const items: SyntheticGeometryTextItem[] = [];
  const offsets = [0, 47, 13, 91];
  for (let row = 0; row < 4; row += 1) {
    const top = 700 - row * ROW_STEP;
    items.push({ text: `col1-${row}`, leftPoints: 100, topPoints: top, rightPoints: 160, bottomPoints: top + ROW_HEIGHT, index: row * 3 });
    items.push({ text: `col2-${row}`, leftPoints: 300, topPoints: top, rightPoints: 360, bottomPoints: top + ROW_HEIGHT, index: row * 3 + 1 });
    const offset = offsets[row];
    items.push({ text: `desc-${row}`, leftPoints: 400 + offset, topPoints: top, rightPoints: 430 + offset, bottomPoints: top + ROW_HEIGHT, index: row * 3 + 2 });
  }
  const input = buildPhysicalColumnHypothesisReconstructionFixture("orphan-segment", [page(items)]);
  const result = reconstructBudgetDocumentPhysicalColumnHypotheses(input);
  const region = firstRegion(result);
  assertEqual(region.metrics.totalSegmentCount, 12);
  assertEqual(region.metrics.notIncludedSegmentCount, 4, "the four never-recurring description segments are preserved as not-included, never dropped");
  assertEqual(region.metrics.includedSegmentCount, 8);
  const notIncluded = region.segmentDispositions.filter((d) => d.status === "not_in_physical_column_hypothesis");
  assertEqual(notIncluded.length, 4);
});

runTest("two independent tabular blocks with different column positions on the same page form two separate detected regions, each with its own hypotheses", () => {
  const upperBlock = twoColumnRows(3, 760);
  const lowerBlock: SyntheticGeometryTextItem[] = [];
  for (let row = 0; row < 3; row += 1) {
    const top = 500 - row * ROW_STEP;
    lowerBlock.push({ text: `low1-${row}`, leftPoints: 200, topPoints: top, rightPoints: 250, bottomPoints: top + ROW_HEIGHT, index: 6 + row * 2 });
    lowerBlock.push({ text: `low2-${row}`, leftPoints: 450, topPoints: top, rightPoints: 500, bottomPoints: top + ROW_HEIGHT, index: 6 + row * 2 + 1 });
  }
  const input = buildPhysicalColumnHypothesisReconstructionFixture("two-regions", [page([...upperBlock, ...lowerBlock])]);
  const result = reconstructBudgetDocumentPhysicalColumnHypotheses(input);
  const page1 = result.groups[0].pages[0];
  assertEqual(page1.regions.length, 2);
  assertEqual(page1.regions.every((r) => r.hypotheses.length === 2), true);
});

runTest("determinism: two independent reconstructions of the same input produce a JSON-equivalent result", () => {
  const input = buildPhysicalColumnHypothesisReconstructionFixture("determinism", [page(twoColumnRows(4))]);
  const a = reconstructBudgetDocumentPhysicalColumnHypotheses(input);
  const b = reconstructBudgetDocumentPhysicalColumnHypotheses(input);
  assertEqual(JSON.stringify(a), JSON.stringify(b));
});

runTest("permutation independence: shuffling the input item array produces a JSON-equivalent full result", () => {
  const ordered = twoColumnRows(4);
  const shuffled = [ordered[3], ordered[0], ordered[2], ordered[1], ordered[5], ordered[4], ordered[7], ordered[6]];
  const a = reconstructBudgetDocumentPhysicalColumnHypotheses(buildPhysicalColumnHypothesisReconstructionFixture("permutation", [page(ordered)]));
  const b = reconstructBudgetDocumentPhysicalColumnHypotheses(buildPhysicalColumnHypothesisReconstructionFixture("permutation", [page(shuffled)]));
  assertEqual(JSON.stringify(a), JSON.stringify(b));
});

runTest("the input is never mutated", () => {
  const input = buildPhysicalColumnHypothesisReconstructionFixture("immutability", [page(twoColumnRows(4))]);
  const before = JSON.stringify(input);
  Object.freeze(input);
  Object.freeze(input.structureReconstruction);
  Object.freeze(input.tabularRegionDetection);
  reconstructBudgetDocumentPhysicalColumnHypotheses(input);
  assertEqual(JSON.stringify(input), before);
});

runTest("conservation: every segment of every included line ends in exactly one disposition, and counts close exactly against the metrics", () => {
  const input = buildPhysicalColumnHypothesisReconstructionFixture("conservation", [page(twoColumnRows(5))]);
  const result = reconstructBudgetDocumentPhysicalColumnHypotheses(input);
  const region = firstRegion(result);
  const total = region.metrics.includedSegmentCount + region.metrics.notIncludedSegmentCount + region.metrics.ambiguousSegmentCount + region.metrics.detectionFailedSegmentCount;
  assertEqual(total, region.metrics.totalSegmentCount);
  assertEqual(region.segmentDispositions.length, region.metrics.totalSegmentCount);
  const uniqueSegments = new Set(region.segmentDispositions.map((d) => d.segmentKey));
  assertEqual(uniqueSegments.size, region.segmentDispositions.length, "no duplicated segment disposition");
});

runTest("individual source identities from both consumed contracts are preserved on the result", () => {
  const input = buildPhysicalColumnHypothesisReconstructionFixture("identities", [page(twoColumnRows(4))]);
  const result = reconstructBudgetDocumentPhysicalColumnHypotheses(input);
  assertEqual(result.sourceByteHash, input.structureReconstruction.sourceByteHash);
  assertEqual(result.sourceStructureReconstructorName, input.structureReconstruction.reconstructorName);
  assertEqual(result.sourceStructureReconstructionContextFingerprint, input.structureReconstruction.reconstructionContextFingerprint);
  assertEqual(result.sourceTabularRegionDetectorName, input.tabularRegionDetection.detectorName);
  assertEqual(result.sourceTabularRegionDetectionContextFingerprint, input.tabularRegionDetection.detectionContextFingerprint);
});

runTest("the result declares the required limitations, including no numeric fusion tolerance and orphan segments never absorbed", () => {
  const input = buildPhysicalColumnHypothesisReconstructionFixture("limitations", [page(twoColumnRows(4))]);
  const result = reconstructBudgetDocumentPhysicalColumnHypotheses(input);
  ["physical_column_hypothesis_is_not_a_confirmed_column", "no_numeric_fusion_tolerance_applied", "orphan_segments_never_absorbed_by_contention_or_proximity", "no_commercial_readiness_claim", "real_document_out_of_scope"].forEach(
    (code) => assertEqual(result.limitations.includes(code as (typeof result.limitations)[number]), true, `missing limitation ${code}`),
  );
});
