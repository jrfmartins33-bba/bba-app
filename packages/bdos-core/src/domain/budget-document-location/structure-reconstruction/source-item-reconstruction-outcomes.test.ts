import type { PhysicalDocumentTextItem, PhysicalDocumentTextItemLayoutGeometry } from "../physical-document-read.types";
import { classifySourceTextItem, sortEligibleItemsCanonically } from "./source-item-reconstruction-outcomes";
import type { EligibleSourceTextItem } from "./source-item-reconstruction-outcomes";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function geometry(overrides: Partial<PhysicalDocumentTextItemLayoutGeometry> = {}): PhysicalDocumentTextItemLayoutGeometry {
  return {
    leftPoints: 0,
    topPoints: 0,
    rightPoints: 10,
    bottomPoints: 10,
    widthPoints: 10,
    heightPoints: 10,
    centerXPoints: 5,
    centerYPoints: 5,
    pageBoundsRelation: "inside",
    coordinateSpaceVersion: "physical-document-text-item-coordinate-space-v1",
    geometryProfileVersion: "physical-document-text-item-geometry-profile-v1",
    ...overrides,
  };
}

function placedItem(index: number, text: string, geometryOverrides: Partial<PhysicalDocumentTextItemLayoutGeometry> = {}): PhysicalDocumentTextItem {
  return { index, text, placement: { status: "placed", geometry: geometry(geometryOverrides), reasonCode: null } };
}

runTest("a placed item inside the page with non-empty text is eligible", () => {
  const outcome = classifySourceTextItem(placedItem(0, "1.1 Item"));
  assertEqual(outcome.kind, "eligible");
});

runTest("whitespace-only text is ignored_whitespace_only, regardless of geometry", () => {
  const outcome = classifySourceTextItem(placedItem(0, "   \t\n  "));
  assertEqual(outcome.kind, "ignored_whitespace_only");
});

runTest("empty text is ignored_whitespace_only", () => {
  assertEqual(classifySourceTextItem(placedItem(0, "")).kind, "ignored_whitespace_only");
});

runTest("an item with pageBoundsRelation outside is excluded_outside_page", () => {
  const outcome = classifySourceTextItem(placedItem(0, "text", { pageBoundsRelation: "outside" }));
  assertEqual(outcome.kind, "excluded_outside_page");
});

runTest("an item with pageBoundsRelation partially_outside remains eligible", () => {
  const outcome = classifySourceTextItem(placedItem(0, "text", { pageBoundsRelation: "partially_outside" }));
  assertEqual(outcome.kind, "eligible");
});

runTest("whitespace check runs before the outside-page check", () => {
  const outcome = classifySourceTextItem(placedItem(0, "   ", { pageBoundsRelation: "outside" }));
  assertEqual(outcome.kind, "ignored_whitespace_only");
});

const UNRESOLVED_CASES: ReadonlyArray<[PhysicalDocumentTextItem["placement"]["status"], string]> = [
  ["unresolved_missing_geometry", "unresolved_source_geometry_missing"],
  ["unresolved_invalid_geometry", "unresolved_source_geometry_invalid"],
  ["unresolved_unsupported_orientation", "unresolved_source_orientation_unsupported"],
  ["unresolved_normalization_failed", "unresolved_source_geometry_normalization_failed"],
];

UNRESOLVED_CASES.forEach(([sourceStatus, expectedKind]) => {
  runTest(`maps source status "${sourceStatus}" to "${expectedKind}"`, () => {
    const reasonCodeByStatus: Record<string, string> = {
      unresolved_missing_geometry: "text_item_geometry_missing",
      unresolved_invalid_geometry: "text_item_geometry_invalid",
      unresolved_unsupported_orientation: "text_item_orientation_unsupported",
      unresolved_normalization_failed: "text_item_geometry_normalization_failed",
    };
    const item: PhysicalDocumentTextItem = {
      index: 0,
      text: "irrelevant",
      placement: { status: sourceStatus, geometry: null, reasonCode: reasonCodeByStatus[sourceStatus] } as PhysicalDocumentTextItem["placement"],
    };
    assertEqual(classifySourceTextItem(item).kind, expectedKind);
  });
});

// --- canonical order (§23) ---------------------------------------------------

function eligible(index: number, overrides: Partial<PhysicalDocumentTextItemLayoutGeometry>): EligibleSourceTextItem {
  return { sourceTextItemIndex: index, geometry: geometry(overrides) };
}

runTest("orders primarily by topPoints ascending", () => {
  const items = [eligible(1, { topPoints: 20 }), eligible(0, { topPoints: 10 })];
  const ordered = sortEligibleItemsCanonically(items).map((i) => i.sourceTextItemIndex);
  assertEqual(JSON.stringify(ordered), JSON.stringify([0, 1]));
});

runTest("breaks ties in topPoints by centerYPoints", () => {
  const items = [eligible(1, { topPoints: 10, centerYPoints: 20 }), eligible(0, { topPoints: 10, centerYPoints: 15 })];
  const ordered = sortEligibleItemsCanonically(items).map((i) => i.sourceTextItemIndex);
  assertEqual(JSON.stringify(ordered), JSON.stringify([0, 1]));
});

runTest("breaks ties in topPoints and centerYPoints by leftPoints", () => {
  const items = [eligible(1, { topPoints: 10, centerYPoints: 15, leftPoints: 20 }), eligible(0, { topPoints: 10, centerYPoints: 15, leftPoints: 5 })];
  const ordered = sortEligibleItemsCanonically(items).map((i) => i.sourceTextItemIndex);
  assertEqual(JSON.stringify(ordered), JSON.stringify([0, 1]));
});

runTest("uses sourceTextItemIndex as the final tie-break", () => {
  const items = [eligible(3, {}), eligible(1, {}), eligible(2, {})];
  const ordered = sortEligibleItemsCanonically(items).map((i) => i.sourceTextItemIndex);
  assertEqual(JSON.stringify(ordered), JSON.stringify([1, 2, 3]));
});

runTest("canonical order is independent of the input array order", () => {
  const a = eligible(0, { topPoints: 5, leftPoints: 0 });
  const b = eligible(1, { topPoints: 15, leftPoints: 0 });
  const c = eligible(2, { topPoints: 25, leftPoints: 0 });
  const forward = sortEligibleItemsCanonically([a, b, c]).map((i) => i.sourceTextItemIndex);
  const reversed = sortEligibleItemsCanonically([c, b, a]).map((i) => i.sourceTextItemIndex);
  const shuffled = sortEligibleItemsCanonically([b, a, c]).map((i) => i.sourceTextItemIndex);
  assertEqual(JSON.stringify(forward), JSON.stringify([0, 1, 2]));
  assertEqual(JSON.stringify(reversed), JSON.stringify(forward));
  assertEqual(JSON.stringify(shuffled), JSON.stringify(forward));
});

runTest("does not mutate the input array", () => {
  const items = [eligible(1, { topPoints: 20 }), eligible(0, { topPoints: 10 })];
  const originalOrder = items.map((i) => i.sourceTextItemIndex);
  sortEligibleItemsCanonically(items);
  assertEqual(JSON.stringify(items.map((i) => i.sourceTextItemIndex)), JSON.stringify(originalOrder));
});
