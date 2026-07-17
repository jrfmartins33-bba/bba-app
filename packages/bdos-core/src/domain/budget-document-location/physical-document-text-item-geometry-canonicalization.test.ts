import {
  canonicalizeGeometryPoints,
  PHYSICAL_DOCUMENT_TEXT_ITEM_GEOMETRY_CANONICALIZATION_DECIMAL_PLACES,
} from "./physical-document-text-item-geometry-canonicalization";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

runTest("decimal places constant is exactly six", () => {
  assertEqual(PHYSICAL_DOCUMENT_TEXT_ITEM_GEOMETRY_CANONICALIZATION_DECIMAL_PLACES, 6);
});

runTest("an already-six-decimal value is unchanged", () => {
  assertEqual(canonicalizeGeometryPoints(72.123456), 72.123456);
});

runTest("a value with more than six decimals is rounded to six", () => {
  assertEqual(canonicalizeGeometryPoints(72.3333334449), 72.333333);
});

runTest("zero canonicalizes to zero", () => {
  assertEqual(canonicalizeGeometryPoints(0), 0);
});

runTest("negative zero canonicalizes to positive zero (Object.is, not just ===)", () => {
  const result = canonicalizeGeometryPoints(-0);
  assertEqual(Object.is(result, 0), true, "expected Object.is(result, 0) to be true, got -0 or another value");
});

runTest("a subnormal magnitude that quantizes to zero is normalized to positive zero, not negative zero", () => {
  const positive = canonicalizeGeometryPoints(0.0000004);
  const negative = canonicalizeGeometryPoints(-0.0000004);
  assertEqual(positive, 0);
  assertEqual(Object.is(negative, 0), true, "expected Object.is(negative, 0) to be true, got -0 or another value");
});

runTest("rounding is symmetric around zero at an exact midpoint (round-half-away-from-zero)", () => {
  assertEqual(canonicalizeGeometryPoints(0.0000015), 0.000002);
  assertEqual(canonicalizeGeometryPoints(-0.0000015), -0.000002);
});

runTest("rounding is symmetric around zero at a second, independently verified midpoint", () => {
  assertEqual(canonicalizeGeometryPoints(0.1234565), 0.123457);
  assertEqual(canonicalizeGeometryPoints(-0.1234565), -0.123457);
});

runTest("a small positive value just below the rounding threshold rounds down toward zero, not away", () => {
  assertEqual(canonicalizeGeometryPoints(0.0000001), 0);
});

runTest("a small negative value just below the rounding threshold rounds toward zero, not away, and stays positive zero", () => {
  const result = canonicalizeGeometryPoints(-0.0000001);
  assertEqual(Object.is(result, 0), true, "expected Object.is(result, 0) to be true");
});

runTest("large positive and negative magnitudes canonicalize symmetrically", () => {
  assertEqual(canonicalizeGeometryPoints(1234.5678905), 1234.567891);
  assertEqual(canonicalizeGeometryPoints(-1234.5678905), -1234.567891);
});

runTest("is deterministic across repeated calls with the same input", () => {
  const value = 792.0000004999;
  assertEqual(canonicalizeGeometryPoints(value), canonicalizeGeometryPoints(value));
});

runTest("throws for non-finite input: NaN", () => {
  let threw = false;
  try {
    canonicalizeGeometryPoints(Number.NaN);
  } catch {
    threw = true;
  }
  assertEqual(threw, true, "expected canonicalizeGeometryPoints(NaN) to throw");
});

runTest("throws for non-finite input: Infinity", () => {
  let threw = false;
  try {
    canonicalizeGeometryPoints(Number.POSITIVE_INFINITY);
  } catch {
    threw = true;
  }
  assertEqual(threw, true, "expected canonicalizeGeometryPoints(Infinity) to throw");
});

runTest("throws for non-finite input: -Infinity", () => {
  let threw = false;
  try {
    canonicalizeGeometryPoints(Number.NEGATIVE_INFINITY);
  } catch {
    threw = true;
  }
  assertEqual(threw, true, "expected canonicalizeGeometryPoints(-Infinity) to throw");
});
