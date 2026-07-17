import type { PhysicalDocumentTextItemLayoutGeometry } from "../physical-document-read.types";
import { reconstructHorizontalSegments } from "./horizontal-segment-reconstruction";
import { BUDGET_DOCUMENT_STRUCTURE_RECONSTRUCTION_PROFILE_V1 } from "./structure-reconstruction-profile";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const PROFILE = BUDGET_DOCUMENT_STRUCTURE_RECONSTRUCTION_PROFILE_V1;

function geometry(left: number, right: number, top = 0, bottom = 10): PhysicalDocumentTextItemLayoutGeometry {
  return {
    leftPoints: left,
    topPoints: top,
    rightPoints: right,
    bottomPoints: bottom,
    widthPoints: right - left,
    heightPoints: bottom - top,
    centerXPoints: (left + right) / 2,
    centerYPoints: (top + bottom) / 2,
    pageBoundsRelation: "inside",
    coordinateSpaceVersion: "physical-document-text-item-coordinate-space-v1",
    geometryProfileVersion: "physical-document-text-item-geometry-profile-v1",
  };
}

/** Segment groupings, serialized to JSON so `assertEqual` compares by value, not by array reference. */
function segmentIndicesOf(map: Map<number, PhysicalDocumentTextItemLayoutGeometry>, indices: number[]): string {
  return JSON.stringify(reconstructHorizontalSegments(indices, map, PROFILE).map((s) => [...s.sourceTextItemIndices]));
}

function expectGroups(groups: ReadonlyArray<ReadonlyArray<number>>): string {
  return JSON.stringify(groups);
}

runTest("a single item forms a single segment", () => {
  const map = new Map([[0, geometry(0, 10)]]);
  const segments = reconstructHorizontalSegments([0], map, PROFILE);
  assertEqual(segments.length, 1);
  assertEqual(segments[0].horizontalOrder, 1);
  assertEqual(JSON.stringify(segments[0].sourceTextItemIndices), JSON.stringify([0]));
  assertEqual(JSON.stringify(segments[0].observedInternalGaps), JSON.stringify([]));
});

runTest("small gap (well below threshold) keeps items in the same segment", () => {
  // Height 10, threshold 2.0 -> tolerated raw gap up to 20. Gap here is 5.
  const map = new Map([[0, geometry(0, 10)], [1, geometry(15, 25)]]);
  assertEqual(segmentIndicesOf(map, [0, 1]), expectGroups([[0, 1]]));
});

runTest("gap exactly at the threshold keeps items in the same segment (<=, not <)", () => {
  // medianItemHeight = 10, threshold 2.0 -> boundary raw gap = 20.
  const map = new Map([[0, geometry(0, 10)], [1, geometry(30, 40)]]);
  assertEqual(segmentIndicesOf(map, [0, 1]), expectGroups([[0, 1]]));
});

runTest("gap just above the threshold starts a new segment", () => {
  const map = new Map([[0, geometry(0, 10)], [1, geometry(30.000001, 40)]]);
  assertEqual(segmentIndicesOf(map, [0, 1]), expectGroups([[0], [1]]));
});

runTest("overlapping items (negative gap) remain in the same segment", () => {
  const map = new Map([[0, geometry(0, 20)], [1, geometry(10, 30)]]);
  assertEqual(segmentIndicesOf(map, [0, 1]), expectGroups([[0, 1]]));
});

runTest("touching items (zero gap) remain in the same segment", () => {
  const map = new Map([[0, geometry(0, 20)], [1, geometry(20, 30)]]);
  assertEqual(segmentIndicesOf(map, [0, 1]), expectGroups([[0, 1]]));
});

runTest("two segments: a large gap splits the line into two groups", () => {
  const map = new Map([[0, geometry(0, 10)], [1, geometry(15, 25)], [2, geometry(200, 210)]]);
  assertEqual(segmentIndicesOf(map, [0, 1, 2]), expectGroups([[0, 1], [2]]));
});

runTest("three segments: two large gaps split the line into three groups", () => {
  const map = new Map([[0, geometry(0, 10)], [1, geometry(200, 210)], [2, geometry(400, 410)]]);
  assertEqual(segmentIndicesOf(map, [0, 1, 2]), expectGroups([[0], [1], [2]]));
});

runTest("a zero-width item participates in gap calculation without special-casing", () => {
  const map = new Map([[0, geometry(0, 10)], [1, geometry(15, 15)], [2, geometry(20, 30)]]);
  assertEqual(segmentIndicesOf(map, [0, 1, 2]), expectGroups([[0, 1, 2]]));
});

runTest("items of differing heights use the median height of the whole line for normalization", () => {
  // Heights: 10, 10, 30 -> median 10 (sorted [10,10,30], middle index 1 -> 10).
  const map = new Map([
    [0, geometry(0, 10, 0, 10)],
    [1, geometry(15, 25, 0, 10)],
    [2, geometry(35, 45, 0, 30)],
  ]);
  // gap between item1 and item2 = 10, normalized by median height 10 -> ratio 1.0, within 2.0 threshold.
  assertEqual(segmentIndicesOf(map, [0, 1, 2]), expectGroups([[0, 1, 2]]));
});

runTest("median of an even number of items averages the two central heights", () => {
  // Heights 10, 20, 30, 40 -> sorted [10,20,30,40], median = (20+30)/2 = 25.
  const map = new Map([
    [0, geometry(0, 10, 0, 10)],
    [1, geometry(200, 210, 0, 20)],
    [2, geometry(400, 410, 0, 30)],
    [3, geometry(600, 610, 0, 40)],
  ]);
  // gap item0->item1 = 190, normalized by median 25 -> 7.6 > 2.0 -> new segment each time.
  assertEqual(segmentIndicesOf(map, [0, 1, 2, 3]), expectGroups([[0], [1], [2], [3]]));
});

runTest("input order does not affect the resulting segments (re-sorted left to right internally)", () => {
  const map = new Map([[0, geometry(0, 10)], [1, geometry(15, 25)], [2, geometry(200, 210)]]);
  assertEqual(segmentIndicesOf(map, [2, 0, 1]), expectGroups([[0, 1], [2]]));
});

runTest("segment bounds are the canonical union of its member items", () => {
  const map = new Map([[0, geometry(0, 10, 2, 8)], [1, geometry(15, 25, 0, 12)]]);
  const segments = reconstructHorizontalSegments([0, 1], map, PROFILE);
  assertEqual(segments.length, 1);
  assertEqual(segments[0].leftPoints, 0);
  assertEqual(segments[0].rightPoints, 25);
  assertEqual(segments[0].topPoints, 0);
  assertEqual(segments[0].bottomPoints, 12);
});
