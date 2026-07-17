import type { BudgetDocumentStructureReconstructionResult } from "../structure-reconstruction/budget-document-structure-reconstruction.types";
import { findCompatibleStructureReconstructionContract } from "./tabular-region-detection-source-contracts";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const VALID: BudgetDocumentStructureReconstructionResult = {
  schemaVersion: 1,
  reconstructorName: "budget-document-structure-reconstructor",
  reconstructorVersion: "budget-document-structure-reconstructor-v1",
  reconstructionProfileId: "budget-document-structure-reconstruction-profile-v1",
  reconstructionProfileVersion: 1,
  reconstructionContextFingerprintVersion: "budget-document-structure-reconstruction-context-fingerprint-v1",
  reconstructionContextFingerprint: "a".repeat(64),
  sourceByteHash: "b".repeat(64),
  physicalReadSchemaVersion: 2,
  physicalReaderName: "physical-document-reader",
  physicalReaderVersion: "physical-document-reader-v2",
  physicalAdapterVersion: "pdfjs-physical-document-reader-adapter-v2",
  physicalUnderlyingLibraryVersion: "pdfjs-dist@6.1.200",
  physicalTextItemCoordinateSpaceVersion: "physical-document-text-item-coordinate-space-v1",
  physicalTextItemGeometryProfileVersion: "physical-document-text-item-geometry-profile-v1",
  physicalGeometryContextFingerprintVersion: "physical-document-geometry-context-fingerprint-v1",
  physicalGeometryContextFingerprint: "c".repeat(64),
  pageLocationSchemaVersion: 1,
  pageLocatorName: "budget-document-page-locator",
  pageLocatorVersion: "budget-document-page-locator-v1",
  pageLocationDecisionRuleSetVersion: "budget-document-page-location-rules-v1",
  sourceObservationSchemaVersion: 1,
  sourceObserverName: "document-signal-observer",
  sourceObserverVersion: "document-signal-observer-v1",
  sourceObservationRuleSetVersion: "document-signal-observation-rules-v1",
  sourceCatalogVersion: "budget-document-signal-catalog-v1",
  status: "completed",
  groups: [],
  technicalProblems: [],
  metrics: {
    receivedGroupCount: 0,
    reconstructedGroupCount: 0,
    reconstructedWithProblemsGroupCount: 0,
    notReconstructableGroupCount: 0,
    candidatePageCount: 0,
    sourceTextItemCount: 0,
    lineCount: 0,
    segmentCount: 0,
    blockCount: 0,
  },
  limitations: [],
};

runTest("approves the exact currently-supported structure reconstruction contract", () => {
  assertEqual(findCompatibleStructureReconstructionContract(VALID) !== null, true);
});

runTest("rejects a different schema version, never by lexical comparison", () => {
  assertEqual(findCompatibleStructureReconstructionContract({ ...VALID, schemaVersion: 2 as unknown as 1 }), null);
});

runTest("rejects a different reconstructor name", () => {
  assertEqual(findCompatibleStructureReconstructionContract({ ...VALID, reconstructorName: "other-reconstructor" as unknown as typeof VALID.reconstructorName }), null);
});

runTest("rejects a different reconstructor version", () => {
  assertEqual(findCompatibleStructureReconstructionContract({ ...VALID, reconstructorVersion: "other-v2" as unknown as typeof VALID.reconstructorVersion }), null);
});

runTest("rejects a different reconstruction profile id or version", () => {
  assertEqual(findCompatibleStructureReconstructionContract({ ...VALID, reconstructionProfileId: "other-profile" }), null);
  assertEqual(findCompatibleStructureReconstructionContract({ ...VALID, reconstructionProfileVersion: 2 }), null);
});

runTest("rejects a different reconstruction context fingerprint version", () => {
  assertEqual(findCompatibleStructureReconstructionContract({ ...VALID, reconstructionContextFingerprintVersion: "other-fingerprint-v2" as unknown as typeof VALID.reconstructionContextFingerprintVersion }), null);
});

runTest("never accepts an unknown future version by best effort", () => {
  assertEqual(findCompatibleStructureReconstructionContract({ ...VALID, reconstructionProfileVersion: 999 }), null);
});
