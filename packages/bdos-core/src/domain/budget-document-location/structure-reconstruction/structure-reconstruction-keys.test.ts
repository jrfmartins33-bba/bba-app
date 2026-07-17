import {
  computeBlockKey,
  computeGroupReconstructionKey,
  computeLineKey,
  computePageReconstructionKey,
  computeSegmentKey,
} from "./structure-reconstruction-keys";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const HEX_64 = /^[0-9a-f]{64}$/;

runTest("computeGroupReconstructionKey is a deterministic 64-char hex digest", () => {
  const first = computeGroupReconstructionKey("fp-a", "group-1");
  const second = computeGroupReconstructionKey("fp-a", "group-1");
  assertEqual(first, second);
  assertEqual(HEX_64.test(first), true);
});

runTest("computeGroupReconstructionKey changes with fingerprint or source group key", () => {
  const base = computeGroupReconstructionKey("fp-a", "group-1");
  assertEqual(computeGroupReconstructionKey("fp-b", "group-1") === base, false);
  assertEqual(computeGroupReconstructionKey("fp-a", "group-2") === base, false);
});

runTest("computePageReconstructionKey changes with group key or page number", () => {
  const base = computePageReconstructionKey("group-key-a", 1);
  assertEqual(computePageReconstructionKey("group-key-b", 1) === base, false);
  assertEqual(computePageReconstructionKey("group-key-a", 2) === base, false);
  assertEqual(HEX_64.test(base), true);
});

runTest("computeLineKey changes with page key or item indices, and is order-sensitive", () => {
  const base = computeLineKey("page-key-a", [0, 1, 2]);
  assertEqual(computeLineKey("page-key-b", [0, 1, 2]) === base, false);
  assertEqual(computeLineKey("page-key-a", [0, 1, 3]) === base, false);
  assertEqual(computeLineKey("page-key-a", [2, 1, 0]) === base, false);
});

runTest("computeSegmentKey changes with line key or item indices", () => {
  const base = computeSegmentKey("line-key-a", [0, 1]);
  assertEqual(computeSegmentKey("line-key-b", [0, 1]) === base, false);
  assertEqual(computeSegmentKey("line-key-a", [0, 2]) === base, false);
});

runTest("computeBlockKey changes with page key or segment keys", () => {
  const base = computeBlockKey("page-key-a", ["seg-1", "seg-2"]);
  assertEqual(computeBlockKey("page-key-b", ["seg-1", "seg-2"]) === base, false);
  assertEqual(computeBlockKey("page-key-a", ["seg-1", "seg-3"]) === base, false);
});

runTest("keys of different kinds do not collide even with identical raw parts", () => {
  const lineKey = computeLineKey("shared", [1]);
  const segmentKey = computeSegmentKey("shared", [1]);
  assertEqual(lineKey === segmentKey, false);
});
