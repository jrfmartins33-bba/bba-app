import type { BandConstructionAlignmentInput, BandConstructionSegmentGeometry } from "./physical-vertical-band-construction";
import { constructPhysicalVerticalBands } from "./physical-vertical-band-construction";
import { BUDGET_DOCUMENT_PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTION_PROFILE_V1 } from "./physical-column-hypothesis-reconstruction-profile";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const PROFILE = BUDGET_DOCUMENT_PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTION_PROFILE_V1;

function alignment(key: string, lineKeys: ReadonlyArray<string>, segmentKeys: ReadonlyArray<string>): BandConstructionAlignmentInput {
  return { alignmentKey: key, lineKeys, segmentKeys };
}

function geometry(left: number, top: number, right: number, bottom: number): BandConstructionSegmentGeometry {
  return { leftPoints: left, topPoints: top, rightPoints: right, bottomPoints: bottom };
}

runTest("a fully-contained qualifying alignment (all lines inside the region) produces one band with an envelope union of its segments", () => {
  const geometries = new Map([
    ["s1", geometry(100, 700, 160, 712)],
    ["s2", geometry(100, 675, 160, 687)],
    ["s3", geometry(100, 650, 160, 662)],
  ]);
  const bands = constructPhysicalVerticalBands([alignment("a1", ["l1", "l2", "l3"], ["s1", "s2", "s3"])], new Set(["l1", "l2", "l3"]), geometries, PROFILE);
  assertEqual(bands.length, 1);
  assertEqual(bands[0].seedAlignmentKey, "a1");
  assertEqual(bands[0].leftPoints, 100);
  assertEqual(bands[0].rightPoints, 160);
  assertEqual(bands[0].topPoints, 650);
  assertEqual(bands[0].bottomPoints, 712);
  assertEqual(JSON.stringify(bands[0].signature), JSON.stringify([{ lineKey: "l1", segmentKey: "s1" }, { lineKey: "l2", segmentKey: "s2" }, { lineKey: "l3", segmentKey: "s3" }]));
});

// --- projeção regional (auditoria pós-revisão, §1) --------------------------

runTest("boundary: a projection retaining only 2 lines (below minimumLinesSustainingProjectedAlignment = 3) never forms a band", () => {
  const geometries = new Map([
    ["s1", geometry(100, 700, 160, 712)],
    ["s2", geometry(100, 675, 160, 687)],
    ["s3", geometry(100, 650, 160, 662)],
  ]);
  // The alignment recurs across l1..l3, but the region only contains l1 and l2.
  const bands = constructPhysicalVerticalBands([alignment("a1", ["l1", "l2", "l3"], ["s1", "s2", "s3"])], new Set(["l1", "l2"]), geometries, PROFILE);
  assertEqual(bands.length, 0);
});

runTest("boundary: a projection retaining exactly 3 lines (exactly minimumLinesSustainingProjectedAlignment) forms a valid band", () => {
  const geometries = new Map([
    ["s1", geometry(100, 700, 160, 712)],
    ["s2", geometry(100, 675, 160, 687)],
    ["s3", geometry(100, 650, 160, 662)],
    ["s4", geometry(100, 625, 160, 637)],
  ]);
  // The alignment recurs across four lines (l1..l4); the region contains only three of them (l1..l3).
  const bands = constructPhysicalVerticalBands([alignment("a1", ["l1", "l2", "l3", "l4"], ["s1", "s2", "s3", "s4"])], new Set(["l1", "l2", "l3"]), geometries, PROFILE);
  assertEqual(bands.length, 1);
  assertEqual(bands[0].signature.length, 3);
});

runTest("boundary: a projection retaining more than the minimum (4 lines) forms a valid band", () => {
  const geometries = new Map([
    ["s1", geometry(100, 700, 160, 712)],
    ["s2", geometry(100, 675, 160, 687)],
    ["s3", geometry(100, 650, 160, 662)],
    ["s4", geometry(100, 625, 160, 637)],
  ]);
  const bands = constructPhysicalVerticalBands([alignment("a1", ["l1", "l2", "l3", "l4"], ["s1", "s2", "s3", "s4"])], new Set(["l1", "l2", "l3", "l4"]), geometries, PROFILE);
  assertEqual(bands.length, 1);
  assertEqual(bands[0].signature.length, 4);
});

runTest("an alignment containing lines external to the region (before, inside, and after) projects only its internal lines — external lines never leak into the band", () => {
  const geometries = new Map([
    ["s0", geometry(100, 750, 160, 762)], // external, before the region
    ["s1", geometry(100, 700, 160, 712)], // internal
    ["s2", geometry(100, 675, 160, 687)], // internal
    ["s3", geometry(100, 650, 160, 662)], // internal
    ["s4", geometry(100, 600, 160, 612)], // external, after the region
  ]);
  const alignments = [alignment("a1", ["l0", "l1", "l2", "l3", "l4"], ["s0", "s1", "s2", "s3", "s4"])];
  const bands = constructPhysicalVerticalBands(alignments, new Set(["l1", "l2", "l3"]), geometries, PROFILE);
  assertEqual(bands.length, 1);
  assertEqual(bands[0].signature.length, 3, "only the three internal lines are retained");
  assertEqual(JSON.stringify(bands[0].signature), JSON.stringify([{ lineKey: "l1", segmentKey: "s1" }, { lineKey: "l2", segmentKey: "s2" }, { lineKey: "l3", segmentKey: "s3" }]));
  assertEqual(bands[0].topPoints, 650, "bounds never incorporate the external segments (s0 at 750, s4 at 600)");
  assertEqual(bands[0].bottomPoints, 712);
});

runTest("vertical order of the projected pairs is preserved — never reordered by lexicographic key", () => {
  const geometries = new Map([
    ["sZ", geometry(100, 700, 160, 712)],
    ["sA", geometry(100, 675, 160, 687)],
    ["sM", geometry(100, 650, 160, 662)],
  ]);
  // Segment keys are deliberately out of lexicographic order relative to vertical position.
  const bands = constructPhysicalVerticalBands([alignment("a1", ["l1", "l2", "l3"], ["sZ", "sA", "sM"])], new Set(["l1", "l2", "l3"]), geometries, PROFILE);
  assertEqual(JSON.stringify(bands[0].signature.map((m) => m.segmentKey)), JSON.stringify(["sZ", "sA", "sM"]), "vertical order preserved, never sorted lexicographically");
});

runTest("left_edge, right_edge and horizontal_center alignments with different external extents but the same projected signature within the region produce signature-identical bands", () => {
  const geometries = new Map([
    ["s1", geometry(100, 700, 160, 712)],
    ["s2", geometry(100, 675, 160, 687)],
    ["s3", geometry(100, 650, 160, 662)],
    ["sExtra", geometry(100, 600, 160, 612)],
  ]);
  const alignments = [
    alignment("left_edge_a", ["l1", "l2", "l3"], ["s1", "s2", "s3"]),
    alignment("right_edge_a", ["l1", "l2", "l3", "l4"], ["s1", "s2", "s3", "sExtra"]), // one extra external line
    alignment("center_a", ["l0", "l1", "l2", "l3"], ["sExtra", "s1", "s2", "s3"]), // a different extra external line
  ];
  const bands = constructPhysicalVerticalBands(alignments, new Set(["l1", "l2", "l3"]), geometries, PROFILE);
  assertEqual(bands.length, 3);
  const signatures = bands.map((b) => JSON.stringify(b.signature));
  assertEqual(new Set(signatures).size, 1, "all three bands project down to the exact same in-region signature, despite differing external extents");
});

runTest("multiple qualifying alignments produce one band each, never merged at this stage", () => {
  const geometries = new Map([
    ["s1", geometry(100, 700, 160, 712)],
    ["s2", geometry(100, 675, 160, 687)],
    ["s3", geometry(100, 650, 160, 662)],
    ["s4", geometry(300, 700, 360, 712)],
    ["s5", geometry(300, 675, 360, 687)],
    ["s6", geometry(300, 650, 360, 662)],
  ]);
  const bands = constructPhysicalVerticalBands(
    [alignment("a-left", ["l1", "l2", "l3"], ["s1", "s2", "s3"]), alignment("a-right", ["l1", "l2", "l3"], ["s4", "s5", "s6"])],
    new Set(["l1", "l2", "l3"]),
    geometries,
    PROFILE,
  );
  assertEqual(bands.length, 2);
});

runTest("band order and signatures are deterministic regardless of alignment input order", () => {
  const geometries = new Map([
    ["s1", geometry(100, 700, 160, 712)],
    ["s2", geometry(100, 675, 160, 687)],
    ["s3", geometry(100, 650, 160, 662)],
    ["s4", geometry(300, 700, 360, 712)],
    ["s5", geometry(300, 675, 360, 687)],
    ["s6", geometry(300, 650, 360, 662)],
  ]);
  const alignments = [alignment("a-left", ["l1", "l2", "l3"], ["s1", "s2", "s3"]), alignment("a-right", ["l1", "l2", "l3"], ["s4", "s5", "s6"])];
  const ordered = constructPhysicalVerticalBands(alignments, new Set(["l1", "l2", "l3"]), geometries, PROFILE);
  const shuffled = constructPhysicalVerticalBands([alignments[1], alignments[0]], new Set(["l1", "l2", "l3"]), geometries, PROFILE);
  assertEqual(JSON.stringify(ordered), JSON.stringify(shuffled));
});
