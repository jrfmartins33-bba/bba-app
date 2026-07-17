import type { RegionFormationAlignment, RegionFormationLine } from "./tabular-region-formation";
import { formTabularRegionCandidateWindows } from "./tabular-region-formation";
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

function lines(n: number): ReadonlyArray<RegionFormationLine> {
  return Array.from({ length: n }, (_, index) => ({ lineKey: `l${index + 1}`, verticalOrder: index + 1 }));
}

function alignment(key: string, lineKeys: ReadonlyArray<string>): RegionFormationAlignment {
  return { alignmentKey: key, lineKeys };
}

runTest("three lines with two alignments spanning all three form exactly one region", () => {
  const windows = formTabularRegionCandidateWindows(lines(3), [alignment("A", ["l1", "l2", "l3"]), alignment("B", ["l1", "l2", "l3"])], PROFILE);
  assertEqual(windows.length, 1);
  assertEqual(windows[0].conflicted, false);
  assertEqual(JSON.stringify(windows[0].lineKeys), JSON.stringify(["l1", "l2", "l3"]));
  assertEqual(JSON.stringify(windows[0].supportingAlignmentKeys), JSON.stringify(["A", "B"]));
});

runTest("boundary: exactly two lines never forms a region (minimumRegionLineCount = 3)", () => {
  const windows = formTabularRegionCandidateWindows(lines(2), [alignment("A", ["l1", "l2"]), alignment("B", ["l1", "l2"])], PROFILE);
  assertEqual(windows.length, 0);
});

runTest("boundary: exactly one recurring alignment never forms a region (minimumRecurrentAlignmentCount = 2)", () => {
  const windows = formTabularRegionCandidateWindows(lines(4), [alignment("A", ["l1", "l2", "l3", "l4"])], PROFILE);
  assertEqual(windows.length, 0);
});

runTest("a paragraph aligned only on the left (a single alignment) never forms a region even with many lines", () => {
  const windows = formTabularRegionCandidateWindows(lines(6), [alignment("A", ["l1", "l2", "l3", "l4", "l5", "l6"])], PROFILE);
  assertEqual(windows.length, 0);
});

runTest("two independent regions on the same page, separated by a non-aligned line, never merge", () => {
  const testLines = lines(7);
  const alignments = [
    alignment("A", ["l1", "l2", "l3"]),
    alignment("B", ["l1", "l2", "l3"]),
    alignment("C", ["l5", "l6", "l7"]),
    alignment("D", ["l5", "l6", "l7"]),
  ];
  const windows = formTabularRegionCandidateWindows(testLines, alignments, PROFILE);
  assertEqual(windows.length, 2);
  assertEqual(windows.every((w) => !w.conflicted), true);
  const lineKeysSorted = windows.map((w) => [...w.lineKeys].sort()).sort((a, b) => a[0].localeCompare(b[0]));
  assertEqual(JSON.stringify(lineKeysSorted), JSON.stringify([["l1", "l2", "l3"], ["l5", "l6", "l7"]]));
});

runTest("a wide title/segment touching two regions never merges them (no alignment spans both groups)", () => {
  // l4 is present (contiguous verticalOrder) but shares no recurring alignment with either group — it never
  // extends either window, and it is not itself part of any region.
  const testLines = lines(7);
  const alignments = [alignment("A", ["l1", "l2", "l3"]), alignment("B", ["l1", "l2", "l3"]), alignment("C", ["l5", "l6", "l7"]), alignment("D", ["l5", "l6", "l7"])];
  const windows = formTabularRegionCandidateWindows(testLines, alignments, PROFILE);
  const allRegionLines = windows.flatMap((w) => w.lineKeys);
  assertEqual(allRegionLines.includes("l4"), false, "the unaligned wide element never joins a region");
});

runTest("transitive-compatibility adversary: A-B and B-C overlapping alignment sets never silently unify into one region when A-C's window would fail the minimum", () => {
  // l1..l3 share {A,B}; l3..l5 share {C,D}; l1..l5 as a whole shares nothing (<2) -> two windows, sharing line l3 -> both conflicted.
  const testLines = lines(5);
  const alignments = [
    alignment("A", ["l1", "l2", "l3"]),
    alignment("B", ["l1", "l2", "l3"]),
    alignment("C", ["l3", "l4", "l5"]),
    alignment("D", ["l3", "l4", "l5"]),
  ];
  const windows = formTabularRegionCandidateWindows(testLines, alignments, PROFILE);
  assertEqual(windows.length, 2, "two maximal windows are found");
  assertEqual(windows.every((w) => w.conflicted), true, "both are rejected because they concurrently claim line l3");
});

runTest("overlap between two maximal windows never produces a merged or arbitrarily-chosen single region", () => {
  const testLines = lines(6);
  const alignments = [
    alignment("A", ["l1", "l2", "l3", "l4"]),
    alignment("B", ["l1", "l2", "l3", "l4"]),
    alignment("C", ["l3", "l4", "l5", "l6"]),
    alignment("D", ["l3", "l4", "l5", "l6"]),
  ];
  const windows = formTabularRegionCandidateWindows(testLines, alignments, PROFILE);
  assertEqual(windows.length, 2);
  assertEqual(windows.every((w) => w.conflicted), true);
  // regions[] would exclude both; the orchestrator is responsible for marking every line of both windows ambiguous.
});

runTest("horizontal order of supporting alignment keys is stable and canonical (lexicographic)", () => {
  const windows = formTabularRegionCandidateWindows(lines(3), [alignment("Z", ["l1", "l2", "l3"]), alignment("A", ["l1", "l2", "l3"])], PROFILE);
  assertEqual(JSON.stringify(windows[0].supportingAlignmentKeys), JSON.stringify(["A", "Z"]));
});

runTest("permutation independence: shuffled line and alignment arrays produce the same windows", () => {
  const orderedLines = lines(4);
  const shuffledLines = [orderedLines[2], orderedLines[0], orderedLines[3], orderedLines[1]];
  const alignments = [alignment("A", ["l1", "l2", "l3", "l4"]), alignment("B", ["l1", "l2", "l3", "l4"])];
  const shuffledAlignments = [alignments[1], alignments[0]];

  const ordered = formTabularRegionCandidateWindows(orderedLines, alignments, PROFILE);
  const shuffled = formTabularRegionCandidateWindows(shuffledLines, shuffledAlignments, PROFILE);
  assertEqual(JSON.stringify(ordered), JSON.stringify(shuffled));
});

runTest("a footnote/side-note line adjacent to a region, aligned with none of its recurring alignments, is never absorbed", () => {
  const testLines = lines(4);
  const alignments = [alignment("A", ["l1", "l2", "l3"]), alignment("B", ["l1", "l2", "l3"])];
  const windows = formTabularRegionCandidateWindows(testLines, alignments, PROFILE);
  assertEqual(windows.length, 1);
  assertEqual(windows[0].lineKeys.includes("l4"), false);
});
