import { deriveTextItemPageBoundsRelation } from "./physical-document-text-item-page-bounds-relation";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;

runTest("fully inside the page bounds returns inside", () => {
  const relation = deriveTextItemPageBoundsRelation(
    { leftPoints: 72, topPoints: 74, rightPoints: 104, bottomPoints: 97 },
    PAGE_WIDTH,
    PAGE_HEIGHT,
  );
  assertEqual(relation, "inside");
});

runTest("touching all four page edges exactly is still inside (non-strict bounds)", () => {
  const relation = deriveTextItemPageBoundsRelation(
    { leftPoints: 0, topPoints: 0, rightPoints: PAGE_WIDTH, bottomPoints: PAGE_HEIGHT },
    PAGE_WIDTH,
    PAGE_HEIGHT,
  );
  assertEqual(relation, "inside");
});

runTest("extends past the right edge is partially_outside", () => {
  const relation = deriveTextItemPageBoundsRelation(
    { leftPoints: 600, topPoints: 74, rightPoints: 640, bottomPoints: 97 },
    PAGE_WIDTH,
    PAGE_HEIGHT,
  );
  assertEqual(relation, "partially_outside");
});

runTest("extends past the left edge (negative left) is partially_outside", () => {
  const relation = deriveTextItemPageBoundsRelation(
    { leftPoints: -10, topPoints: 74, rightPoints: 20, bottomPoints: 97 },
    PAGE_WIDTH,
    PAGE_HEIGHT,
  );
  assertEqual(relation, "partially_outside");
});

runTest("extends past the top edge (negative top) is partially_outside", () => {
  const relation = deriveTextItemPageBoundsRelation(
    { leftPoints: 72, topPoints: -5, rightPoints: 104, bottomPoints: 20 },
    PAGE_WIDTH,
    PAGE_HEIGHT,
  );
  assertEqual(relation, "partially_outside");
});

runTest("extends past the bottom edge is partially_outside", () => {
  const relation = deriveTextItemPageBoundsRelation(
    { leftPoints: 72, topPoints: 780, rightPoints: 104, bottomPoints: 800 },
    PAGE_WIDTH,
    PAGE_HEIGHT,
  );
  assertEqual(relation, "partially_outside");
});

runTest("entirely beyond the right edge (no intersection) is outside", () => {
  const relation = deriveTextItemPageBoundsRelation(
    { leftPoints: 700, topPoints: 74, rightPoints: 750, bottomPoints: 97 },
    PAGE_WIDTH,
    PAGE_HEIGHT,
  );
  assertEqual(relation, "outside");
});

runTest("entirely beyond the left edge (no intersection) is outside", () => {
  const relation = deriveTextItemPageBoundsRelation(
    { leftPoints: -100, topPoints: 74, rightPoints: -10, bottomPoints: 97 },
    PAGE_WIDTH,
    PAGE_HEIGHT,
  );
  assertEqual(relation, "outside");
});

runTest("entirely beyond the top edge (negative, no intersection) is outside", () => {
  const relation = deriveTextItemPageBoundsRelation(
    { leftPoints: 72, topPoints: -100, rightPoints: 104, bottomPoints: -10 },
    PAGE_WIDTH,
    PAGE_HEIGHT,
  );
  assertEqual(relation, "outside");
});

runTest("entirely beyond the bottom edge (no intersection) is outside", () => {
  const relation = deriveTextItemPageBoundsRelation(
    { leftPoints: 72, topPoints: 900, rightPoints: 104, bottomPoints: 950 },
    PAGE_WIDTH,
    PAGE_HEIGHT,
  );
  assertEqual(relation, "outside");
});

runTest("a zero-width item exactly on the right edge still intersects (touching counts as intersection)", () => {
  const relation = deriveTextItemPageBoundsRelation(
    { leftPoints: PAGE_WIDTH, topPoints: 74, rightPoints: PAGE_WIDTH, bottomPoints: 97 },
    PAGE_WIDTH,
    PAGE_HEIGHT,
  );
  assertEqual(relation, "inside");
});

runTest("never applies a clamp: bounds are read back unchanged by the caller (this function only classifies)", () => {
  const bounds = { leftPoints: -500, topPoints: -500, rightPoints: -400, bottomPoints: -400 };
  deriveTextItemPageBoundsRelation(bounds, PAGE_WIDTH, PAGE_HEIGHT);
  assertEqual(bounds.leftPoints, -500);
  assertEqual(bounds.rightPoints, -400);
});
