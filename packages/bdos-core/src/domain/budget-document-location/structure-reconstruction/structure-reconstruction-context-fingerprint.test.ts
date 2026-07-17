import { computeStructureReconstructionContextFingerprint } from "./structure-reconstruction-context-fingerprint";
import type { StructureReconstructionContextFingerprintInput } from "./structure-reconstruction-context-fingerprint";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const BASE_INPUT: StructureReconstructionContextFingerprintInput = {
  sourceByteHash: "a".repeat(64),
  physicalReadSchemaVersion: 2,
  physicalReaderName: "physical-document-reader",
  physicalReaderVersion: "physical-document-reader-v2",
  physicalAdapterVersion: "pdfjs-physical-document-reader-adapter-v2",
  physicalUnderlyingLibraryVersion: "pdfjs-dist@6.1.200",
  textItemCoordinateSpaceVersion: "physical-document-text-item-coordinate-space-v1",
  textItemGeometryProfileVersion: "physical-document-text-item-geometry-profile-v1",
  geometryContextFingerprintVersion: "physical-document-geometry-context-fingerprint-v1",
  geometryContextFingerprint: "b".repeat(64),
  pageLocationSchemaVersion: 1,
  pageLocatorName: "budget-document-page-locator",
  pageLocatorVersion: "budget-document-page-locator-v1",
  pageLocationDecisionRuleSetVersion: "budget-document-page-location-rules-v1",
  pageLocationCatalogVersion: "budget-document-signal-catalog-v1",
  pageLocationObserverVersion: "document-signal-observer-v1",
  pageLocationObservationRuleSetVersion: "document-signal-observation-rules-v1",
  reconstructorName: "budget-document-structure-reconstructor",
  reconstructorVersion: "budget-document-structure-reconstructor-v1",
  profileId: "budget-document-structure-reconstruction-profile-v1",
  profileVersion: 1,
};

runTest("is a 64-character lowercase hex SHA-256 digest", () => {
  const fingerprint = computeStructureReconstructionContextFingerprint(BASE_INPUT);
  assertEqual(fingerprint.length, 64);
  assertEqual(/^[0-9a-f]{64}$/.test(fingerprint), true);
});

runTest("is deterministic: identical input produces the identical fingerprint", () => {
  assertEqual(computeStructureReconstructionContextFingerprint(BASE_INPUT), computeStructureReconstructionContextFingerprint({ ...BASE_INPUT }));
});

runTest("changes when sourceByteHash changes", () => {
  const other = computeStructureReconstructionContextFingerprint({ ...BASE_INPUT, sourceByteHash: "c".repeat(64) });
  assertEqual(other === computeStructureReconstructionContextFingerprint(BASE_INPUT), false);
});

runTest("changes when geometryContextFingerprint changes (physical geometry identity participates)", () => {
  const other = computeStructureReconstructionContextFingerprint({ ...BASE_INPUT, geometryContextFingerprint: "d".repeat(64) });
  assertEqual(other === computeStructureReconstructionContextFingerprint(BASE_INPUT), false);
});

runTest("changes when pageLocatorVersion changes", () => {
  const other = computeStructureReconstructionContextFingerprint({ ...BASE_INPUT, pageLocatorVersion: "budget-document-page-locator-v2" });
  assertEqual(other === computeStructureReconstructionContextFingerprint(BASE_INPUT), false);
});

runTest("changes when reconstructorVersion changes", () => {
  const other = computeStructureReconstructionContextFingerprint({ ...BASE_INPUT, reconstructorVersion: "budget-document-structure-reconstructor-v2" });
  assertEqual(other === computeStructureReconstructionContextFingerprint(BASE_INPUT), false);
});

runTest("changes when profileVersion changes", () => {
  const other = computeStructureReconstructionContextFingerprint({ ...BASE_INPUT, profileVersion: 2 });
  assertEqual(other === computeStructureReconstructionContextFingerprint(BASE_INPUT), false);
});

runTest("accepts a null pageLocation observer/catalog version without throwing", () => {
  const fingerprint = computeStructureReconstructionContextFingerprint({
    ...BASE_INPUT,
    pageLocationCatalogVersion: null,
    pageLocationObserverVersion: null,
    pageLocationObservationRuleSetVersion: null,
  });
  assertEqual(fingerprint.length, 64);
});

runTest("uses an unambiguous delimited canonical representation, not naive concatenation", () => {
  const first = computeStructureReconstructionContextFingerprint({ ...BASE_INPUT, reconstructorName: "ab", reconstructorVersion: "c" });
  const second = computeStructureReconstructionContextFingerprint({ ...BASE_INPUT, reconstructorName: "a", reconstructorVersion: "bc" });
  assertEqual(first === second, false);
});
