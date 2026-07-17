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

runTest("profile identity is stable and versioned", () => {
  assertEqual(PROFILE.profileId, "budget-document-tabular-region-detection-profile-v1");
  assertEqual(PROFILE.profileVersion, 1);
});

runTest("the §9 approved minimums are exactly as specified: 3 lines, 2 alignments, 3 sustaining lines", () => {
  assertEqual(PROFILE.minimumRegionLineCount, 3);
  assertEqual(PROFILE.minimumRecurrentAlignmentCount, 2);
  assertEqual(PROFILE.minimumLinesSustainingAlignment, 3);
});

runTest("full pairwise compatibility and the overlap prohibition are fixed contract invariants", () => {
  assertEqual(PROFILE.requireFullPairwiseAlignmentCompatibility, true);
  assertEqual(PROFILE.forbidRegionOverlap, true);
});

runTest("the alignment tolerance ratio reuses the Sprint 21.4A.2.f.1 value exactly (0.5)", () => {
  assertEqual(PROFILE.maximumAlignmentPositionDeviationToMinimumLineHeightRatio, 0.5);
});

runTest("the alignment type priority order is fixed, left-to-right reading order, all three types present exactly once", () => {
  assertEqual(JSON.stringify(PROFILE.alignmentTypePriorityOrder), JSON.stringify(["left_edge", "right_edge", "horizontal_center"]));
});

runTest("geometryCanonicalizationVersion is a non-empty identity string", () => {
  assertEqual(PROFILE.geometryCanonicalizationVersion.length > 0, true);
});
