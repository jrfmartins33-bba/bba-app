import { canonicalizePhysicalColumnHypothesisOutputGeometryBounds, canonicalizePhysicalColumnHypothesisReconstructionOutputGeometry } from "./physical-column-hypothesis-reconstruction-output-geometry-canonicalization";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

runTest("the classic binary artifact (0.1 + 0.2) canonicalizes cleanly to six decimal places", () => {
  assertEqual(canonicalizePhysicalColumnHypothesisReconstructionOutputGeometry(0.1 + 0.2), 0.3);
});

runTest("negative zero canonicalizes to positive zero", () => {
  const result = canonicalizePhysicalColumnHypothesisReconstructionOutputGeometry(-0);
  assertEqual(Object.is(result, -0), false);
  assertEqual(result, 0);
});

runTest("hypothesis bounds are canonicalized coherently: width/height/center derive from the already-canonicalized limits", () => {
  const bounds = canonicalizePhysicalColumnHypothesisOutputGeometryBounds({
    leftPoints: 0.1,
    topPoints: 0,
    rightPoints: 0.1 + 0.2,
    bottomPoints: 10,
    widthPoints: 999,
    heightPoints: 999,
    centerXPoints: 999,
    centerYPoints: 999,
  });
  assertEqual(bounds.leftPoints, 0.1);
  assertEqual(bounds.rightPoints, 0.3);
  assertEqual(bounds.widthPoints, 0.2);
  assertEqual(bounds.centerXPoints, 0.2);
});
