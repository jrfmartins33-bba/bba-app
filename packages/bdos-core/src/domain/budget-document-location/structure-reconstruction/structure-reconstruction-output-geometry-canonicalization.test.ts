import {
  STRUCTURE_RECONSTRUCTION_OUTPUT_GEOMETRY_CANONICALIZATION_VERSION,
  canonicalizeOutputGaps,
  canonicalizeOutputGeometryBounds,
  canonicalizeStructureReconstructionOutputGeometry,
} from "./structure-reconstruction-output-geometry-canonicalization";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

runTest("has a stable version identity", () => {
  assertEqual(STRUCTURE_RECONSTRUCTION_OUTPUT_GEOMETRY_CANONICALIZATION_VERSION, "structure-reconstruction-output-geometry-canonicalization-v1");
});

runTest("removes the classic binary floating point artifact of 0.1 + 0.2", () => {
  const artifact = 0.1 + 0.2; // 0.30000000000000004
  assertEqual(artifact === 0.3, false, "test setup: this must actually be an artifact, not already clean");
  assertEqual(canonicalizeStructureReconstructionOutputGeometry(artifact), 0.3);
});

runTest("removes the artifact from a right-minus-left width subtraction", () => {
  const left = 1;
  const right = 1 + (0.1 + 0.2); // 1.3000000000000003
  const rawWidth = right - left; // 0.30000000000000004
  assertEqual(canonicalizeStructureReconstructionOutputGeometry(rawWidth), 0.3);
});

runTest("normalizes -0 to 0", () => {
  const negativeZero = -0;
  assertEqual(Object.is(negativeZero, -0), true, "test setup: this must actually be -0");
  assertEqual(Object.is(canonicalizeStructureReconstructionOutputGeometry(negativeZero), -0), false);
  assertEqual(canonicalizeStructureReconstructionOutputGeometry(negativeZero), 0);
});

runTest("rounds to exactly six decimal places, symmetric for negative values", () => {
  assertEqual(canonicalizeStructureReconstructionOutputGeometry(1.23456789), 1.234568);
  assertEqual(canonicalizeStructureReconstructionOutputGeometry(-1.23456789), -1.234568);
});

runTest("canonicalizeOutputGeometryBounds canonicalizes all eight geometric fields and preserves other fields", () => {
  const artifact = 0.1 + 0.2;
  const bounds = {
    leftPoints: artifact,
    topPoints: artifact,
    rightPoints: artifact,
    bottomPoints: artifact,
    widthPoints: artifact,
    heightPoints: artifact,
    centerXPoints: artifact,
    centerYPoints: artifact,
    horizontalOrder: 7,
  };
  const canonical = canonicalizeOutputGeometryBounds(bounds);
  assertEqual(canonical.leftPoints, 0.3);
  assertEqual(canonical.topPoints, 0.3);
  assertEqual(canonical.rightPoints, 0.3);
  assertEqual(canonical.bottomPoints, 0.3);
  assertEqual(canonical.widthPoints, 0.3);
  assertEqual(canonical.heightPoints, 0.3);
  assertEqual(canonical.centerXPoints, 0.3);
  assertEqual(canonical.centerYPoints, 0.3);
  assertEqual(canonical.horizontalOrder, 7, "non-geometric fields must be preserved unchanged");
});

runTest("canonicalizeOutputGaps canonicalizes every element of the array", () => {
  const artifact = 0.1 + 0.2;
  const canonical = canonicalizeOutputGaps([artifact, 1.0, artifact]);
  assertEqual(JSON.stringify(canonical), JSON.stringify([0.3, 1.0, 0.3]));
});

runTest("canonicalizeOutputGaps preserves an empty array", () => {
  assertEqual(JSON.stringify(canonicalizeOutputGaps([])), JSON.stringify([]));
});
