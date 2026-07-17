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

runTest("profile identity is stable and versioned", () => {
  assertEqual(PROFILE.profileId, "budget-document-physical-column-hypothesis-reconstruction-profile-v1");
  assertEqual(PROFILE.profileVersion, 1);
});

runTest("exact signature equality and the overlap prohibition are fixed contract invariants — never numeric tolerances", () => {
  assertEqual(PROFILE.requireExactSignatureEquality, true);
  assertEqual(PROFILE.forbidPhysicalColumnHypothesisOverlap, true);
});

runTest("the profile declares no numeric fusion tolerance field (vinculante decision of this Sprint)", () => {
  const keys = Object.keys(PROFILE);
  const hasNumericTolerance = keys.some((key) => key.toLowerCase().includes("tolerance") || key.toLowerCase().includes("ratio"));
  assertEqual(hasNumericTolerance, false, `unexpected numeric-tolerance-looking field among: ${keys.join(", ")}`);
});

runTest("the alignment type priority order is fixed and used only for deterministic ordering", () => {
  assertEqual(JSON.stringify(PROFILE.alignmentTypePriorityOrder), JSON.stringify(["left_edge", "right_edge", "horizontal_center"]));
});

runTest("geometryCanonicalizationVersion is a non-empty identity string", () => {
  assertEqual(PROFILE.geometryCanonicalizationVersion.length > 0, true);
});
