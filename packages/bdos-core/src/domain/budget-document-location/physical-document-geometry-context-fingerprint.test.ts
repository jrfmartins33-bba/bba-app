import { createHash } from "node:crypto";
import { computeGeometryContextFingerprint } from "./physical-document-geometry-context-fingerprint";
import type { GeometryContextFingerprintInput } from "./physical-document-geometry-context-fingerprint";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const BASE_INPUT: GeometryContextFingerprintInput = {
  sourceByteHash: "a".repeat(64),
  physicalReadSchemaVersion: 2,
  readerName: "physical-document-reader",
  readerVersion: "physical-document-reader-v2",
  adapterVersion: "pdfjs-physical-document-reader-adapter-v2",
  underlyingLibraryVersion: "pdfjs-dist@6.1.200",
  coordinateSpaceVersion: "physical-document-text-item-coordinate-space-v1",
  geometryProfileVersion: "physical-document-text-item-geometry-profile-v1",
};

runTest("is a 64-character lowercase hex SHA-256 digest", () => {
  const fingerprint = computeGeometryContextFingerprint(BASE_INPUT);
  assertEqual(fingerprint.length, 64);
  assertEqual(/^[0-9a-f]{64}$/.test(fingerprint), true, `expected lowercase hex, got: ${fingerprint}`);
});

runTest("is deterministic: identical input produces the identical fingerprint", () => {
  const first = computeGeometryContextFingerprint(BASE_INPUT);
  const second = computeGeometryContextFingerprint({ ...BASE_INPUT });
  assertEqual(first, second);
});

runTest("changes when sourceByteHash changes", () => {
  const other = computeGeometryContextFingerprint({ ...BASE_INPUT, sourceByteHash: "b".repeat(64) });
  assertEqual(other === computeGeometryContextFingerprint(BASE_INPUT), false);
});

runTest("changes when physicalReadSchemaVersion changes", () => {
  const other = computeGeometryContextFingerprint({ ...BASE_INPUT, physicalReadSchemaVersion: 3 });
  assertEqual(other === computeGeometryContextFingerprint(BASE_INPUT), false);
});

runTest("changes when readerVersion changes", () => {
  const other = computeGeometryContextFingerprint({ ...BASE_INPUT, readerVersion: "physical-document-reader-v3" });
  assertEqual(other === computeGeometryContextFingerprint(BASE_INPUT), false);
});

runTest("changes when adapterVersion changes", () => {
  const other = computeGeometryContextFingerprint({ ...BASE_INPUT, adapterVersion: "other-adapter-v9" });
  assertEqual(other === computeGeometryContextFingerprint(BASE_INPUT), false);
});

runTest("changes when underlyingLibraryVersion changes (the library participates in v2 repeatability)", () => {
  const other = computeGeometryContextFingerprint({ ...BASE_INPUT, underlyingLibraryVersion: "pdfjs-dist@6.1.201" });
  assertEqual(other === computeGeometryContextFingerprint(BASE_INPUT), false);
});

runTest("changes when underlyingLibraryVersion is null instead of populated", () => {
  const other = computeGeometryContextFingerprint({ ...BASE_INPUT, underlyingLibraryVersion: null });
  assertEqual(other === computeGeometryContextFingerprint(BASE_INPUT), false);
});

runTest("changes when coordinateSpaceVersion changes", () => {
  const other = computeGeometryContextFingerprint({ ...BASE_INPUT, coordinateSpaceVersion: "physical-document-text-item-coordinate-space-v2" });
  assertEqual(other === computeGeometryContextFingerprint(BASE_INPUT), false);
});

runTest("changes when geometryProfileVersion changes", () => {
  const other = computeGeometryContextFingerprint({ ...BASE_INPUT, geometryProfileVersion: "physical-document-text-item-geometry-profile-v2" });
  assertEqual(other === computeGeometryContextFingerprint(BASE_INPUT), false);
});

runTest("accepts a null underlyingLibraryVersion without throwing (e.g. empty-bytes failed result)", () => {
  const fingerprint = computeGeometryContextFingerprint({ ...BASE_INPUT, underlyingLibraryVersion: null });
  assertEqual(fingerprint.length, 64);
});

runTest("uses an unambiguous delimited canonical representation, not naive concatenation", () => {
  // Two inputs whose fields would collide under naive string concatenation
  // without delimiters ("ab" + "c" === "a" + "bc") must not collide here.
  const first = computeGeometryContextFingerprint({ ...BASE_INPUT, readerName: "ab", readerVersion: "c" });
  const second = computeGeometryContextFingerprint({ ...BASE_INPUT, readerName: "a", readerVersion: "bc" });
  assertEqual(first === second, false);
});

runTest("matches an independently computed SHA-256 of the same fixed-order JSON array", () => {
  const expected = createHash("sha256")
    .update(
      JSON.stringify([
        "physical-document-geometry-context-fingerprint-v1",
        BASE_INPUT.sourceByteHash,
        BASE_INPUT.physicalReadSchemaVersion,
        BASE_INPUT.readerName,
        BASE_INPUT.readerVersion,
        BASE_INPUT.adapterVersion,
        BASE_INPUT.underlyingLibraryVersion,
        BASE_INPUT.coordinateSpaceVersion,
        BASE_INPUT.geometryProfileVersion,
        6,
      ]),
    )
    .digest("hex");
  assertEqual(computeGeometryContextFingerprint(BASE_INPUT), expected);
});
