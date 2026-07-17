import type { PhysicalVerticalBandDraft } from "./physical-vertical-band-construction";
import { formPhysicalColumnHypothesisCandidates } from "./physical-column-hypothesis-formation";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function band(
  seedAlignmentKey: string,
  signature: ReadonlyArray<{ lineKey: string; segmentKey: string }>,
  left: number,
  right: number,
  top = 0,
  bottom = 12,
): PhysicalVerticalBandDraft {
  return {
    seedAlignmentKey,
    signature,
    leftPoints: left,
    topPoints: top,
    rightPoints: right,
    bottomPoints: bottom,
    widthPoints: right - left,
    heightPoints: bottom - top,
    centerXPoints: (left + right) / 2,
    centerYPoints: (top + bottom) / 2,
  };
}

const SIG_A = [
  { lineKey: "l1", segmentKey: "s1" },
  { lineKey: "l2", segmentKey: "s2" },
  { lineKey: "l3", segmentKey: "s3" },
];

runTest("three bands with an identical signature (three alignment types of the same physical column) consolidate into one candidate", () => {
  const candidates = formPhysicalColumnHypothesisCandidates([
    band("left_edge_a", SIG_A, 100, 160),
    band("right_edge_a", SIG_A, 100, 160),
    band("center_a", SIG_A, 100, 160),
  ]);
  assertEqual(candidates.length, 1);
  assertEqual(candidates[0].conflicted, false);
  assertEqual(JSON.stringify(candidates[0].contributingAlignmentKeys), JSON.stringify(["center_a", "left_edge_a", "right_edge_a"]));
});

runTest("two candidates with the same lineKeys but different segmentKeys never consolidate and, if disjoint, remain independent", () => {
  const sigB = [
    { lineKey: "l1", segmentKey: "s4" },
    { lineKey: "l2", segmentKey: "s5" },
    { lineKey: "l3", segmentKey: "s6" },
  ];
  const candidates = formPhysicalColumnHypothesisCandidates([band("a", SIG_A, 100, 160), band("b", sigB, 300, 360)]);
  assertEqual(candidates.length, 2);
  assertEqual(candidates.every((c) => !c.conflicted), true);
});

runTest("candidates sharing at least one segment are marked conflicted even without identical signatures", () => {
  const sigOverlap = [
    { lineKey: "l1", segmentKey: "s1" }, // shares s1 with SIG_A
    { lineKey: "l4", segmentKey: "s9" },
    { lineKey: "l5", segmentKey: "s10" },
  ];
  const candidates = formPhysicalColumnHypothesisCandidates([band("a", SIG_A, 100, 160), band("b", sigOverlap, 100, 160)]);
  assertEqual(candidates.length, 2);
  assertEqual(candidates.every((c) => c.conflicted), true);
});

runTest("candidates with different signatures and no shared segment but positive horizontal envelope overlap are marked conflicted", () => {
  const sigDisjointSegments = [
    { lineKey: "l6", segmentKey: "s20" },
    { lineKey: "l7", segmentKey: "s21" },
    { lineKey: "l8", segmentKey: "s22" },
  ];
  const candidates = formPhysicalColumnHypothesisCandidates([band("a", SIG_A, 100, 160), band("b", sigDisjointSegments, 140, 200)]);
  assertEqual(candidates.length, 2);
  assertEqual(candidates.every((c) => c.conflicted), true);
});

runTest("boundary: envelopes that are merely touching (right of A equals left of B) never count as overlap", () => {
  const sigTouching = [
    { lineKey: "l6", segmentKey: "s20" },
    { lineKey: "l7", segmentKey: "s21" },
    { lineKey: "l8", segmentKey: "s22" },
  ];
  const candidates = formPhysicalColumnHypothesisCandidates([band("a", SIG_A, 100, 160), band("b", sigTouching, 160, 220)]);
  assertEqual(candidates.length, 2);
  assertEqual(candidates.every((c) => !c.conflicted), true);
});

runTest("determinism: candidate order is stable regardless of band input order", () => {
  const sigB = [
    { lineKey: "l1", segmentKey: "s4" },
    { lineKey: "l2", segmentKey: "s5" },
    { lineKey: "l3", segmentKey: "s6" },
  ];
  const bands = [band("a", SIG_A, 100, 160), band("b", sigB, 300, 360)];
  const ordered = formPhysicalColumnHypothesisCandidates(bands);
  const shuffled = formPhysicalColumnHypothesisCandidates([bands[1], bands[0]]);
  assertEqual(JSON.stringify(ordered), JSON.stringify(shuffled));
});

runTest("a single alignment (single-type signature) can sustain a hypothesis on its own — no requirement for two alignment types", () => {
  const candidates = formPhysicalColumnHypothesisCandidates([band("left_edge_only", SIG_A, 100, 160)]);
  assertEqual(candidates.length, 1);
  assertEqual(candidates[0].conflicted, false);
  assertEqual(JSON.stringify(candidates[0].contributingAlignmentKeys), JSON.stringify(["left_edge_only"]));
});
