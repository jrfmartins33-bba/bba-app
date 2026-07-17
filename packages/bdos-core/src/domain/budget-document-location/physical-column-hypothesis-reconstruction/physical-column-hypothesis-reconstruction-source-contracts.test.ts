import type { BudgetDocumentTabularRegionDetectionResult } from "../tabular-region-detection/budget-document-tabular-region-detection.types";
import { findCompatibleTabularRegionDetectionContract } from "./physical-column-hypothesis-reconstruction-source-contracts";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const VALID: BudgetDocumentTabularRegionDetectionResult = {
  schemaVersion: 1,
  detectorName: "budget-document-tabular-region-detector",
  detectorVersion: "budget-document-tabular-region-detector-v1",
  detectionProfileId: "budget-document-tabular-region-detection-profile-v1",
  detectionProfileVersion: 1,
  detectionContextFingerprintVersion: "budget-document-tabular-region-detection-context-fingerprint-v1",
  detectionContextFingerprint: "a".repeat(64),
  sourceByteHash: "b".repeat(64),
  sourceReconstructionSchemaVersion: 1,
  sourceReconstructorName: "budget-document-structure-reconstructor",
  sourceReconstructorVersion: "budget-document-structure-reconstructor-v1",
  sourceReconstructionProfileId: "budget-document-structure-reconstruction-profile-v1",
  sourceReconstructionProfileVersion: 1,
  sourceReconstructionContextFingerprintVersion: "budget-document-structure-reconstruction-context-fingerprint-v1",
  sourceReconstructionContextFingerprint: "c".repeat(64),
  status: "completed",
  groups: [],
  technicalProblems: [],
  metrics: {
    receivedGroupCount: 0,
    detectedGroupCount: 0,
    detectedWithProblemsGroupCount: 0,
    noCandidateRegionGroupCount: 0,
    notDetectableGroupCount: 0,
    candidatePageCount: 0,
    lineCount: 0,
    alignmentCount: 0,
    regionCount: 0,
  },
  limitations: [],
};

runTest("approves the exact currently-supported tabular region detection contract", () => {
  assertEqual(findCompatibleTabularRegionDetectionContract(VALID) !== null, true);
});

runTest("rejects a different schema version, never by lexical comparison", () => {
  assertEqual(findCompatibleTabularRegionDetectionContract({ ...VALID, schemaVersion: 2 as unknown as 1 }), null);
});

runTest("rejects a different detector name or version", () => {
  assertEqual(findCompatibleTabularRegionDetectionContract({ ...VALID, detectorName: "other" as unknown as typeof VALID.detectorName }), null);
  assertEqual(findCompatibleTabularRegionDetectionContract({ ...VALID, detectorVersion: "other-v2" as unknown as typeof VALID.detectorVersion }), null);
});

runTest("rejects a different detection profile id or version", () => {
  assertEqual(findCompatibleTabularRegionDetectionContract({ ...VALID, detectionProfileId: "other-profile" }), null);
  assertEqual(findCompatibleTabularRegionDetectionContract({ ...VALID, detectionProfileVersion: 2 }), null);
});

runTest("never accepts an unknown future version by best effort", () => {
  assertEqual(findCompatibleTabularRegionDetectionContract({ ...VALID, detectionProfileVersion: 999 }), null);
});
