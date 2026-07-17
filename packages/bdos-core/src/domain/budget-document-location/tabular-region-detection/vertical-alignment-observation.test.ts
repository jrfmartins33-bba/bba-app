import type { AlignmentCandidateSegment } from "./vertical-alignment-observation";
import { observeVerticalAlignments } from "./vertical-alignment-observation";
import { BUDGET_DOCUMENT_TABULAR_REGION_DETECTION_PROFILE_V1 } from "./tabular-region-detection-profile";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const PROFILE = BUDGET_DOCUMENT_TABULAR_REGION_DETECTION_PROFILE_V1;

function segment(
  segmentKey: string,
  lineKey: string,
  lineVerticalOrder: number,
  lineHeightPoints: number,
  leftPoints: number,
  rightPoints: number,
  horizontalOrder = 1,
): AlignmentCandidateSegment {
  return { segmentKey, horizontalOrder, lineKey, lineVerticalOrder, lineHeightPoints, leftPoints, rightPoints, centerXPoints: (leftPoints + rightPoints) / 2 };
}

function leftEdgeAlignments(segments: ReadonlyArray<AlignmentCandidateSegment>) {
  return observeVerticalAlignments(segments, PROFILE).filter((a) => a.alignmentType === "left_edge");
}

runTest("three segments with identical left edges across three lines form one recurring alignment", () => {
  const segments = [
    segment("s1", "l1", 1, 12, 100, 160),
    segment("s2", "l2", 2, 12, 100, 160),
    segment("s3", "l3", 3, 12, 100, 160),
  ];
  const alignments = leftEdgeAlignments(segments);
  assertEqual(alignments.length, 1);
  assertEqual(alignments[0].members.length, 3);
  assertEqual(alignments[0].canonicalPositionPoints, 100);
  assertEqual(JSON.stringify(alignments[0].members.map((m) => m.lineKey)), JSON.stringify(["l1", "l2", "l3"]));
});

runTest("only two lines never form a recurring alignment (minimumLinesSustainingAlignment = 3)", () => {
  const segments = [segment("s1", "l1", 1, 12, 100, 160), segment("s2", "l2", 2, 12, 100, 160)];
  assertEqual(leftEdgeAlignments(segments).length, 0);
});

runTest("boundary: deviation exactly at the tolerance limit (ratio 0.5 * height 12 = 6 points) still joins", () => {
  const segments = [
    segment("s1", "l1", 1, 12, 100, 160),
    segment("s2", "l2", 2, 12, 106, 166),
    segment("s3", "l3", 3, 12, 100, 160),
  ];
  assertEqual(leftEdgeAlignments(segments).length, 1);
});

runTest("boundary: deviation just above the tolerance limit never joins the same cluster", () => {
  const segments = [
    segment("s1", "l1", 1, 12, 100, 160),
    segment("s2", "l2", 2, 12, 106.000001, 166),
    segment("s3", "l3", 3, 12, 100, 160),
  ];
  const alignments = leftEdgeAlignments(segments);
  // s2 must never join the {s1, s3} cluster; since it alone cannot sustain the minimum of 3 lines, no alignment forms.
  assertEqual(alignments.length, 0);
});

runTest("boundary: deviation just below the tolerance limit joins comfortably", () => {
  const segments = [
    segment("s1", "l1", 1, 12, 100, 160),
    segment("s2", "l2", 2, 12, 105.999999, 166),
    segment("s3", "l3", 3, 12, 100, 160),
  ];
  assertEqual(leftEdgeAlignments(segments).length, 1);
});

// Antiencadeamento (mesmo padrão de physical-line-reconstruction.ts, §12 do domínio):
// A left=100. B left=105 (A-B desvio 5, dentro do limite 6). C left=110 (B-C desvio 5, dentro do limite; A-C desvio 10, fora do limite).
runTest("antiencadeamento: A-B and B-C compatible, A-C incompatible, never join the same alignment", () => {
  const segments = [
    segment("sA", "lA", 1, 12, 100, 160),
    segment("sB", "lB", 2, 12, 105, 165),
    segment("sC", "lC", 3, 12, 110, 170),
  ];
  const alignments = leftEdgeAlignments(segments);
  alignments.forEach((alignment) => {
    assertEqual(alignment.members.length <= 2, true, "no cluster may contain all three of A, B, C given A-C is incompatible");
  });
});

runTest("at most one segment per line participates in a given alignment cluster", () => {
  const segments = [
    segment("s1", "l1", 1, 12, 100, 160, 1),
    segment("s1b", "l1", 1, 12, 101, 161, 2),
    segment("s2", "l2", 2, 12, 100, 160, 1),
    segment("s3", "l3", 3, 12, 100, 160, 1),
  ];
  const alignments = leftEdgeAlignments(segments);
  assertEqual(alignments.length, 1);
  const lineKeys = alignments[0].members.map((m) => m.lineKey);
  assertEqual(new Set(lineKeys).size, lineKeys.length, "no duplicate line in a single alignment");
});

runTest("left_edge, right_edge and horizontal_center are observed independently and never fused", () => {
  const segments = [
    segment("s1", "l1", 1, 12, 100, 200),
    segment("s2", "l2", 2, 12, 100, 260),
    segment("s3", "l3", 3, 12, 100, 320),
  ];
  const alignments = observeVerticalAlignments(segments, PROFILE);
  const leftEdge = alignments.filter((a) => a.alignmentType === "left_edge");
  const rightEdge = alignments.filter((a) => a.alignmentType === "right_edge");
  const center = alignments.filter((a) => a.alignmentType === "horizontal_center");
  assertEqual(leftEdge.length, 1, "left edges (all 100) recur");
  assertEqual(rightEdge.length, 0, "right edges (200/260/320) never recur within tolerance");
  assertEqual(center.length, 0, "centers (150/180/210) never recur within tolerance");
});

runTest("permutation independence: shuffled segment array produces the same alignments", () => {
  const segments = [
    segment("s1", "l1", 1, 12, 100, 160),
    segment("s2", "l2", 2, 12, 100, 160),
    segment("s3", "l3", 3, 12, 100, 160),
  ];
  const shuffled = [segments[2], segments[0], segments[1]];
  assertEqual(JSON.stringify(leftEdgeAlignments(segments)), JSON.stringify(leftEdgeAlignments(shuffled)));
});

runTest("a single alignment never forms with fewer than the profile's minimum sustaining lines, even with four candidates where only two are mutually compatible", () => {
  const segments = [
    segment("s1", "l1", 1, 12, 100, 160),
    segment("s2", "l2", 2, 12, 100, 160),
    segment("s3", "l3", 3, 12, 500, 560),
    segment("s4", "l4", 4, 12, 500, 560),
  ];
  assertEqual(leftEdgeAlignments(segments).length, 0, "two isolated pairs, neither reaching the minimum of three lines");
});

runTest("zero-height (degenerate) lines never participate in any alignment", () => {
  const segments = [
    segment("s1", "l1", 1, 0, 100, 160),
    segment("s2", "l2", 2, 12, 100, 160),
    segment("s3", "l3", 3, 12, 100, 160),
  ];
  const alignments = leftEdgeAlignments(segments);
  alignments.forEach((alignment) => assertEqual(alignment.members.some((m) => m.lineKey === "l1"), false));
});
