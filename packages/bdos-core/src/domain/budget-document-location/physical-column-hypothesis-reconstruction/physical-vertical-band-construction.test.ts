import type { BandConstructionAlignmentInput, BandConstructionSegmentGeometry } from "./physical-vertical-band-construction";
import { constructPhysicalVerticalBands } from "./physical-vertical-band-construction";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function alignment(key: string, lineKeys: ReadonlyArray<string>, segmentKeys: ReadonlyArray<string>): BandConstructionAlignmentInput {
  return { alignmentKey: key, lineKeys, segmentKeys };
}

function geometry(left: number, top: number, right: number, bottom: number): BandConstructionSegmentGeometry {
  return { leftPoints: left, topPoints: top, rightPoints: right, bottomPoints: bottom };
}

runTest("a qualifying alignment (all lines inside the region) produces one band with an envelope union of its segments", () => {
  const geometries = new Map([
    ["s1", geometry(100, 700, 160, 712)],
    ["s2", geometry(100, 675, 160, 687)],
    ["s3", geometry(100, 650, 160, 662)],
  ]);
  const bands = constructPhysicalVerticalBands([alignment("a1", ["l1", "l2", "l3"], ["s1", "s2", "s3"])], new Set(["l1", "l2", "l3"]), geometries);
  assertEqual(bands.length, 1);
  assertEqual(bands[0].seedAlignmentKey, "a1");
  assertEqual(bands[0].leftPoints, 100);
  assertEqual(bands[0].rightPoints, 160);
  assertEqual(bands[0].topPoints, 650);
  assertEqual(bands[0].bottomPoints, 712);
  assertEqual(JSON.stringify(bands[0].signature), JSON.stringify([{ lineKey: "l1", segmentKey: "s1" }, { lineKey: "l2", segmentKey: "s2" }, { lineKey: "l3", segmentKey: "s3" }]));
});

runTest("an alignment with a line outside the region never produces a band (partial containment is rejected)", () => {
  const geometries = new Map([
    ["s1", geometry(100, 700, 160, 712)],
    ["s2", geometry(100, 675, 160, 687)],
    ["s3", geometry(100, 650, 160, 662)],
  ]);
  const bands = constructPhysicalVerticalBands([alignment("a1", ["l1", "l2", "l3"], ["s1", "s2", "s3"])], new Set(["l1", "l2"]), geometries);
  assertEqual(bands.length, 0);
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
  );
  assertEqual(bands.length, 2);
});

runTest("band order is deterministic regardless of alignment input order", () => {
  const geometries = new Map([
    ["s1", geometry(100, 700, 160, 712)],
    ["s2", geometry(100, 675, 160, 687)],
    ["s3", geometry(100, 650, 160, 662)],
    ["s4", geometry(300, 700, 360, 712)],
    ["s5", geometry(300, 675, 360, 687)],
    ["s6", geometry(300, 650, 360, 662)],
  ]);
  const alignments = [alignment("a-left", ["l1", "l2", "l3"], ["s1", "s2", "s3"]), alignment("a-right", ["l1", "l2", "l3"], ["s4", "s5", "s6"])];
  const ordered = constructPhysicalVerticalBands(alignments, new Set(["l1", "l2", "l3"]), geometries);
  const shuffled = constructPhysicalVerticalBands([alignments[1], alignments[0]], new Set(["l1", "l2", "l3"]), geometries);
  assertEqual(JSON.stringify(ordered), JSON.stringify(shuffled));
});
