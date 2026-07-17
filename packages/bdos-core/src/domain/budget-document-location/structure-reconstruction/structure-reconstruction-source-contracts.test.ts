import type { PhysicalDocumentReadResult } from "../physical-document-read.types";
import type { BudgetDocumentPageLocationResult } from "../page-location/budget-page-location.types";
import { findCompatiblePageLocationContract, findCompatiblePhysicalReadContract } from "./structure-reconstruction-source-contracts";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const VALID_PHYSICAL_READ: PhysicalDocumentReadResult = {
  schemaVersion: 2,
  readerName: "physical-document-reader",
  readerVersion: "physical-document-reader-v2",
  adapterVersion: "any-adapter-v9",
  underlyingLibraryVersion: "any-library@1.0.0",
  sourceByteHash: "a".repeat(64),
  totalPageCount: 1,
  pages: [],
  status: "completed",
  technicalProblems: [],
  textItemCoordinateSpaceVersion: "physical-document-text-item-coordinate-space-v1",
  textItemGeometryProfileVersion: "physical-document-text-item-geometry-profile-v1",
  geometryContextFingerprintVersion: "physical-document-geometry-context-fingerprint-v1",
  geometryContextFingerprint: "b".repeat(64),
};

const VALID_PAGE_LOCATION: BudgetDocumentPageLocationResult = {
  schemaVersion: 1,
  locatorName: "budget-document-page-locator",
  locatorVersion: "budget-document-page-locator-v1",
  decisionRuleSetVersion: "budget-document-page-location-rules-v1",
  sourceByteHash: "a".repeat(64),
  sourceObservationSchemaVersion: 1,
  sourceObserverName: "document-signal-observer",
  sourceObserverVersion: "document-signal-observer-v1",
  sourceObservationRuleSetVersion: "document-signal-observation-rules-v1",
  sourceCatalogVersion: "budget-document-signal-catalog-v1",
  sourceReadMetadata: null,
  sourceObservationStatus: "completed",
  sourceObservationTechnicalProblems: [],
  totalPageCount: 1,
  supportedSignalIds: [],
  unsupportedSignalIds: [],
  status: "completed",
  pageDecisions: [],
  candidateGroups: [],
  technicalProblems: [],
  limitations: [],
};

runTest("approves the exact currently-supported physical read contract", () => {
  assertEqual(findCompatiblePhysicalReadContract(VALID_PHYSICAL_READ) !== null, true);
});

runTest("rejects an unknown physical read schema version (no lexical/best-effort comparison)", () => {
  assertEqual(findCompatiblePhysicalReadContract({ ...VALID_PHYSICAL_READ, schemaVersion: 3 as 2 }), null);
});

runTest("rejects an unknown physical reader version", () => {
  assertEqual(findCompatiblePhysicalReadContract({ ...VALID_PHYSICAL_READ, readerVersion: "physical-document-reader-v3" as typeof VALID_PHYSICAL_READ.readerVersion }), null);
});

runTest("rejects an unknown coordinate space version", () => {
  assertEqual(
    findCompatiblePhysicalReadContract({ ...VALID_PHYSICAL_READ, textItemCoordinateSpaceVersion: "physical-document-text-item-coordinate-space-v2" as typeof VALID_PHYSICAL_READ.textItemCoordinateSpaceVersion }),
    null,
  );
});

runTest("rejects an unknown geometry profile version", () => {
  assertEqual(
    findCompatiblePhysicalReadContract({ ...VALID_PHYSICAL_READ, textItemGeometryProfileVersion: "physical-document-text-item-geometry-profile-v2" as typeof VALID_PHYSICAL_READ.textItemGeometryProfileVersion }),
    null,
  );
});

runTest("rejects an unknown fingerprint version", () => {
  assertEqual(
    findCompatiblePhysicalReadContract({ ...VALID_PHYSICAL_READ, geometryContextFingerprintVersion: "physical-document-geometry-context-fingerprint-v2" as typeof VALID_PHYSICAL_READ.geometryContextFingerprintVersion }),
    null,
  );
});

runTest("approves the exact currently-supported page location contract", () => {
  assertEqual(findCompatiblePageLocationContract(VALID_PAGE_LOCATION) !== null, true);
});

runTest("rejects an unknown page location schema version", () => {
  assertEqual(findCompatiblePageLocationContract({ ...VALID_PAGE_LOCATION, schemaVersion: 2 as 1 }), null);
});

runTest("rejects an unknown decision rule set version", () => {
  assertEqual(
    findCompatiblePageLocationContract({ ...VALID_PAGE_LOCATION, decisionRuleSetVersion: "budget-document-page-location-rules-v2" as typeof VALID_PAGE_LOCATION.decisionRuleSetVersion }),
    null,
  );
});

runTest("rejects an unknown observer version even when the locator version matches", () => {
  assertEqual(findCompatiblePageLocationContract({ ...VALID_PAGE_LOCATION, sourceObserverVersion: "document-signal-observer-v2" }), null);
});

runTest("rejects a null observer/catalog version (never a best-effort match)", () => {
  assertEqual(findCompatiblePageLocationContract({ ...VALID_PAGE_LOCATION, sourceObserverVersion: null }), null);
});
