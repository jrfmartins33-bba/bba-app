import type { PhysicalColumnHypothesisReconstructionIdentityFingerprintInput } from "./physical-column-hypothesis-reconstruction-context-fingerprint";
import { computePhysicalColumnHypothesisReconstructionContentFingerprint, computePhysicalColumnHypothesisReconstructionIdentityFingerprint } from "./physical-column-hypothesis-reconstruction-context-fingerprint";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const BASE: PhysicalColumnHypothesisReconstructionIdentityFingerprintInput = {
  sourceByteHash: "a".repeat(64),
  sourceStructureReconstructionSchemaVersion: 1,
  sourceStructureReconstructorName: "budget-document-structure-reconstructor",
  sourceStructureReconstructorVersion: "budget-document-structure-reconstructor-v1",
  sourceStructureReconstructionProfileId: "budget-document-structure-reconstruction-profile-v1",
  sourceStructureReconstructionProfileVersion: 1,
  sourceStructureReconstructionContextFingerprintVersion: "budget-document-structure-reconstruction-context-fingerprint-v1",
  sourceStructureReconstructionContextFingerprint: "b".repeat(64),
  sourceTabularRegionDetectionSchemaVersion: 1,
  sourceTabularRegionDetectorName: "budget-document-tabular-region-detector",
  sourceTabularRegionDetectorVersion: "budget-document-tabular-region-detector-v1",
  sourceTabularRegionDetectionProfileId: "budget-document-tabular-region-detection-profile-v1",
  sourceTabularRegionDetectionProfileVersion: 1,
  sourceTabularRegionDetectionContextFingerprintVersion: "budget-document-tabular-region-detection-context-fingerprint-v1",
  sourceTabularRegionDetectionContextFingerprint: "c".repeat(64),
  reconstructorName: "budget-document-physical-column-hypothesis-reconstructor",
  reconstructorVersion: "budget-document-physical-column-hypothesis-reconstructor-v1",
  profileId: "budget-document-physical-column-hypothesis-reconstruction-profile-v1",
  profileVersion: 1,
  bandConstructionRuleId: "physical-vertical-band-single-alignment-envelope-v1",
  bandConstructionRuleVersion: 1,
  hypothesisFormationRuleId: "physical-column-hypothesis-exact-signature-consolidation-v1",
  hypothesisFormationRuleVersion: 1,
  geometryCanonicalizationVersion: "physical-column-hypothesis-reconstruction-output-geometry-canonicalization-v1",
};

runTest("identity fingerprint is deterministic for the same input", () => {
  assertEqual(computePhysicalColumnHypothesisReconstructionIdentityFingerprint(BASE), computePhysicalColumnHypothesisReconstructionIdentityFingerprint({ ...BASE }));
});

runTest("identity fingerprint is a 64-character lowercase hex SHA-256", () => {
  assertEqual(/^[0-9a-f]{64}$/.test(computePhysicalColumnHypothesisReconstructionIdentityFingerprint(BASE)), true);
});

(
  [
    "sourceByteHash",
    "sourceStructureReconstructionContextFingerprint",
    "sourceTabularRegionDetectionContextFingerprint",
    "reconstructorVersion",
    "profileVersion",
    "bandConstructionRuleVersion",
    "hypothesisFormationRuleVersion",
    "geometryCanonicalizationVersion",
  ] as const
).forEach((field) => {
  runTest(`identity fingerprint changes when ${field} changes`, () => {
    const original = computePhysicalColumnHypothesisReconstructionIdentityFingerprint(BASE);
    const mutated = computePhysicalColumnHypothesisReconstructionIdentityFingerprint({ ...BASE, [field]: `${BASE[field]}-changed` });
    assertEqual(original !== mutated, true);
  });
});

runTest("content fingerprint depends on both identity and canonical groups content", () => {
  const identity = computePhysicalColumnHypothesisReconstructionIdentityFingerprint(BASE);
  const withEmpty = computePhysicalColumnHypothesisReconstructionContentFingerprint(identity, []);
  const withSome = computePhysicalColumnHypothesisReconstructionContentFingerprint(identity, [{ sourceCandidateGroupKey: "g1" }]);
  assertEqual(withEmpty !== withSome, true);

  const differentIdentity = computePhysicalColumnHypothesisReconstructionIdentityFingerprint({ ...BASE, sourceByteHash: "d".repeat(64) });
  const withDifferentIdentity = computePhysicalColumnHypothesisReconstructionContentFingerprint(differentIdentity, []);
  assertEqual(withEmpty !== withDifferentIdentity, true);
});
