import { canonicalizeTabularRegionDetectionOutputGeometry, canonicalizeTabularRegionOutputGeometryBounds } from "./tabular-region-detection-output-geometry-canonicalization";

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
  assertEqual(canonicalizeTabularRegionDetectionOutputGeometry(0.1 + 0.2), 0.3);
});

runTest("negative zero canonicalizes to positive zero", () => {
  const result = canonicalizeTabularRegionDetectionOutputGeometry(-0);
  assertEqual(Object.is(result, -0), false);
  assertEqual(result, 0);
});

runTest("region bounds are canonicalized coherently: width/height/center derive from the already-canonicalized limits", () => {
  const bounds = canonicalizeTabularRegionOutputGeometryBounds({
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
  assertEqual(bounds.heightPoints, 10);
  assertEqual(bounds.centerXPoints, 0.2);
  assertEqual(bounds.centerYPoints, 5);
});

runTest("boundary: values on either side of the six-decimal rounding edge remain internally coherent", () => {
  const bounds = canonicalizeTabularRegionOutputGeometryBounds({
    leftPoints: 0.0000004,
    topPoints: 0,
    rightPoints: 0.0000006,
    bottomPoints: 1,
    widthPoints: 0,
    heightPoints: 0,
    centerXPoints: 0,
    centerYPoints: 0,
  });
  assertEqual(bounds.leftPoints <= bounds.rightPoints, true);
  assertEqual(bounds.widthPoints, canonicalizeTabularRegionDetectionOutputGeometry(bounds.rightPoints - bounds.leftPoints));
});
