import type { TabularRegionDetectionIdentityFingerprintInput } from "./tabular-region-detection-context-fingerprint";
import { computeTabularRegionDetectionContentFingerprint, computeTabularRegionDetectionIdentityFingerprint } from "./tabular-region-detection-context-fingerprint";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const BASE: TabularRegionDetectionIdentityFingerprintInput = {
  sourceByteHash: "a".repeat(64),
  sourceReconstructionSchemaVersion: 1,
  sourceReconstructorName: "budget-document-structure-reconstructor",
  sourceReconstructorVersion: "budget-document-structure-reconstructor-v1",
  sourceReconstructionProfileId: "budget-document-structure-reconstruction-profile-v1",
  sourceReconstructionProfileVersion: 1,
  sourceReconstructionContextFingerprintVersion: "budget-document-structure-reconstruction-context-fingerprint-v1",
  sourceReconstructionContextFingerprint: "b".repeat(64),
  detectorName: "budget-document-tabular-region-detector",
  detectorVersion: "budget-document-tabular-region-detector-v1",
  profileId: "budget-document-tabular-region-detection-profile-v1",
  profileVersion: 1,
  alignmentFormationRuleId: "vertical-alignment-full-pairwise-compatibility-v1",
  alignmentFormationRuleVersion: 1,
  regionFormationRuleId: "tabular-region-maximal-shared-alignment-window-v1",
  regionFormationRuleVersion: 1,
  geometryCanonicalizationVersion: "tabular-region-detection-output-geometry-canonicalization-v1",
};

runTest("identity fingerprint is deterministic for the same input", () => {
  assertEqual(computeTabularRegionDetectionIdentityFingerprint(BASE), computeTabularRegionDetectionIdentityFingerprint({ ...BASE }));
});

runTest("identity fingerprint is a 64-character lowercase hex SHA-256, never a UUID or timestamp", () => {
  assertEqual(/^[0-9a-f]{64}$/.test(computeTabularRegionDetectionIdentityFingerprint(BASE)), true);
});

(
  [
    "sourceByteHash",
    "sourceReconstructorVersion",
    "sourceReconstructionProfileVersion",
    "sourceReconstructionContextFingerprint",
    "detectorVersion",
    "profileVersion",
    "alignmentFormationRuleVersion",
    "regionFormationRuleVersion",
    "geometryCanonicalizationVersion",
  ] as const
).forEach((field) => {
  runTest(`identity fingerprint changes when ${field} changes`, () => {
    const original = computeTabularRegionDetectionIdentityFingerprint(BASE);
    const mutated = computeTabularRegionDetectionIdentityFingerprint({ ...BASE, [field]: `${BASE[field]}-changed` });
    assertEqual(original !== mutated, true);
  });
});

runTest("content fingerprint depends on both the identity fingerprint and the canonical groups content", () => {
  const identity = computeTabularRegionDetectionIdentityFingerprint(BASE);
  const withEmptyGroups = computeTabularRegionDetectionContentFingerprint(identity, []);
  const withSomeGroups = computeTabularRegionDetectionContentFingerprint(identity, [{ sourceCandidateGroupKey: "g1" }]);
  assertEqual(withEmptyGroups !== withSomeGroups, true);

  const differentIdentity = computeTabularRegionDetectionIdentityFingerprint({ ...BASE, sourceByteHash: "c".repeat(64) });
  const withDifferentIdentity = computeTabularRegionDetectionContentFingerprint(differentIdentity, []);
  assertEqual(withEmptyGroups !== withDifferentIdentity, true);
});

runTest("content fingerprint is deterministic and JSON-stringify-stable for identical content", () => {
  const identity = computeTabularRegionDetectionIdentityFingerprint(BASE);
  const a = computeTabularRegionDetectionContentFingerprint(identity, [{ x: 1, y: [1, 2, 3] }]);
  const b = computeTabularRegionDetectionContentFingerprint(identity, [{ x: 1, y: [1, 2, 3] }]);
  assertEqual(a, b);
});
