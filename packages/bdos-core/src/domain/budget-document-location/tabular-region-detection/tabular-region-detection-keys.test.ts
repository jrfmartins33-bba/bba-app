import { computeAlignmentKey, computeGroupProcessedKey, computePageProcessedKey, computeRegionKey } from "./tabular-region-detection-keys";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

runTest("computeGroupProcessedKey is deterministic for the same inputs", () => {
  assertEqual(computeGroupProcessedKey("fp1", "g1"), computeGroupProcessedKey("fp1", "g1"));
});

runTest("computeGroupProcessedKey differs for a different fingerprint or a different group key", () => {
  const base = computeGroupProcessedKey("fp1", "g1");
  assertEqual(base !== computeGroupProcessedKey("fp2", "g1"), true);
  assertEqual(base !== computeGroupProcessedKey("fp1", "g2"), true);
});

runTest("computePageProcessedKey depends on both the group key and the page number", () => {
  const base = computePageProcessedKey("group1", 1);
  assertEqual(base !== computePageProcessedKey("group1", 2), true);
  assertEqual(base !== computePageProcessedKey("group2", 1), true);
});

runTest("computeAlignmentKey depends on alignment type and the ordered segment key list, never on array order alone (order changes the key by design)", () => {
  const a = computeAlignmentKey("page1", "left_edge", ["s1", "s2"]);
  const b = computeAlignmentKey("page1", "right_edge", ["s1", "s2"]);
  const c = computeAlignmentKey("page1", "left_edge", ["s2", "s1"]);
  assertEqual(a !== b, true, "alignment type participates in the key");
  assertEqual(a !== c, true, "member order participates in the key (callers must always pass canonical order)");
});

runTest("computeRegionKey depends on the ordered line key list", () => {
  const a = computeRegionKey("page1", ["l1", "l2", "l3"]);
  const b = computeRegionKey("page1", ["l1", "l2"]);
  assertEqual(a !== b, true);
});

runTest("all keys are 64-character lowercase hex (SHA-256), never a UUID or counter", () => {
  const hexPattern = /^[0-9a-f]{64}$/;
  assertEqual(hexPattern.test(computeGroupProcessedKey("fp", "g")), true);
  assertEqual(hexPattern.test(computePageProcessedKey("g", 1)), true);
  assertEqual(hexPattern.test(computeAlignmentKey("p", "left_edge", ["s"])), true);
  assertEqual(hexPattern.test(computeRegionKey("p", ["l"])), true);
});
