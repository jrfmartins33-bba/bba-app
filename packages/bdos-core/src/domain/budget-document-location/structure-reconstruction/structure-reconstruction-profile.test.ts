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

runTest("has a stable, versioned identity", () => {
  assertEqual(BUDGET_DOCUMENT_STRUCTURE_RECONSTRUCTION_PROFILE_V1.profileId, "budget-document-structure-reconstruction-profile-v1");
  assertEqual(BUDGET_DOCUMENT_STRUCTURE_RECONSTRUCTION_PROFILE_V1.profileVersion, 1);
});

runTest("every ratio constant is a finite positive number", () => {
  const profile = BUDGET_DOCUMENT_STRUCTURE_RECONSTRUCTION_PROFILE_V1;
  [
    profile.minimumPairVerticalOverlapRatio,
    profile.maximumPairCenterDistanceToMinimumHeightRatio,
    profile.maximumSegmentGapToMedianItemHeightRatio,
    profile.maximumBlockVerticalGapToMedianLineHeightRatio,
    profile.minimumBlockHorizontalOverlapRatio,
    profile.maximumBlockHorizontalGapToMedianSegmentHeightRatio,
  ].forEach((value) => {
    assertEqual(Number.isFinite(value) && value > 0, true, `expected a finite positive ratio, got ${value}`);
  });
});

runTest("declares the anti-chaining and mutual-adjacency invariants as fixed true", () => {
  assertEqual(BUDGET_DOCUMENT_STRUCTURE_RECONSTRUCTION_PROFILE_V1.requireCompleteLineCompatibility, true);
  assertEqual(BUDGET_DOCUMENT_STRUCTURE_RECONSTRUCTION_PROFILE_V1.requireMutualBlockAdjacency, true);
});
