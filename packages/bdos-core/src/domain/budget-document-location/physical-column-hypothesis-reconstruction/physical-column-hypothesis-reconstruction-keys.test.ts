import { computeGroupProcessedKey, computeHypothesisKey, computePageProcessedKey, computeRegionProcessedKey } from "./physical-column-hypothesis-reconstruction-keys";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

runTest("computeGroupProcessedKey is deterministic and depends on both inputs", () => {
  assertEqual(computeGroupProcessedKey("fp1", "g1"), computeGroupProcessedKey("fp1", "g1"));
  assertEqual(computeGroupProcessedKey("fp1", "g1") !== computeGroupProcessedKey("fp2", "g1"), true);
  assertEqual(computeGroupProcessedKey("fp1", "g1") !== computeGroupProcessedKey("fp1", "g2"), true);
});

runTest("computePageProcessedKey depends on group key and page number", () => {
  assertEqual(computePageProcessedKey("g1", 1) !== computePageProcessedKey("g1", 2), true);
  assertEqual(computePageProcessedKey("g1", 1) !== computePageProcessedKey("g2", 1), true);
});

runTest("computeRegionProcessedKey depends on page key and source region key", () => {
  assertEqual(computeRegionProcessedKey("p1", "r1") !== computeRegionProcessedKey("p1", "r2"), true);
  assertEqual(computeRegionProcessedKey("p1", "r1") !== computeRegionProcessedKey("p2", "r1"), true);
});

runTest("computeHypothesisKey depends on region key and the ordered segment key signature", () => {
  const a = computeHypothesisKey("r1", ["s1", "s2"]);
  const b = computeHypothesisKey("r1", ["s2", "s1"]);
  const c = computeHypothesisKey("r2", ["s1", "s2"]);
  assertEqual(a !== b, true, "order participates in the key (callers must always pass the canonical vertical order)");
  assertEqual(a !== c, true);
});

runTest("all keys are 64-character lowercase hex (SHA-256), never a UUID or counter", () => {
  const hexPattern = /^[0-9a-f]{64}$/;
  assertEqual(hexPattern.test(computeGroupProcessedKey("fp", "g")), true);
  assertEqual(hexPattern.test(computePageProcessedKey("g", 1)), true);
  assertEqual(hexPattern.test(computeRegionProcessedKey("p", "r")), true);
  assertEqual(hexPattern.test(computeHypothesisKey("r", ["s"])), true);
});
