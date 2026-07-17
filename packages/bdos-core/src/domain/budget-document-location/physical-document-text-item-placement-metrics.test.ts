import { computeTextItemPlacementMetrics } from "./physical-document-text-item-placement-metrics";
import type {
  PhysicalDocumentTextItem,
  PhysicalDocumentTextItemLayoutGeometry,
  PhysicalDocumentTextItemPlacement,
} from "./physical-document-read.types";
import {
  PHYSICAL_DOCUMENT_TEXT_ITEM_COORDINATE_SPACE_VERSION,
  PHYSICAL_DOCUMENT_TEXT_ITEM_GEOMETRY_PROFILE_VERSION,
} from "./physical-document-read.types";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const SAMPLE_GEOMETRY: PhysicalDocumentTextItemLayoutGeometry = {
  leftPoints: 0,
  topPoints: 0,
  rightPoints: 10,
  bottomPoints: 10,
  widthPoints: 10,
  heightPoints: 10,
  centerXPoints: 5,
  centerYPoints: 5,
  pageBoundsRelation: "inside",
  coordinateSpaceVersion: PHYSICAL_DOCUMENT_TEXT_ITEM_COORDINATE_SPACE_VERSION,
  geometryProfileVersion: PHYSICAL_DOCUMENT_TEXT_ITEM_GEOMETRY_PROFILE_VERSION,
};

function placedItem(index: number): PhysicalDocumentTextItem {
  return { index, text: "x", placement: { status: "placed", geometry: SAMPLE_GEOMETRY, reasonCode: null } };
}

type UnresolvedStatus = Exclude<PhysicalDocumentTextItemPlacement["status"], "placed">;

// Derives the matching reasonCode from status via an exhaustive switch,
// rather than accepting both as independent parameters — the whole point
// of splitting the union (audit follow-up to PR #68) is that a caller
// cannot construct a mismatched pair, including in test fixtures.
function unresolvedPlacementFor(status: UnresolvedStatus): PhysicalDocumentTextItemPlacement {
  switch (status) {
    case "unresolved_missing_geometry":
      return { status, geometry: null, reasonCode: "text_item_geometry_missing" };
    case "unresolved_invalid_geometry":
      return { status, geometry: null, reasonCode: "text_item_geometry_invalid" };
    case "unresolved_unsupported_orientation":
      return { status, geometry: null, reasonCode: "text_item_orientation_unsupported" };
    case "unresolved_normalization_failed":
      return { status, geometry: null, reasonCode: "text_item_geometry_normalization_failed" };
  }
}

function unresolvedItem(index: number, status: UnresolvedStatus): PhysicalDocumentTextItem {
  return { index, text: "x", placement: unresolvedPlacementFor(status) };
}

runTest("zero items produces all-zero metrics, not an error", () => {
  const metrics = computeTextItemPlacementMetrics([]);
  assertEqual(metrics.totalAdmittedTextItemCount, 0);
  assertEqual(metrics.placedTextItemCount, 0);
  assertEqual(metrics.unresolvedMissingGeometryCount, 0);
  assertEqual(metrics.unresolvedInvalidGeometryCount, 0);
  assertEqual(metrics.unresolvedUnsupportedOrientationCount, 0);
  assertEqual(metrics.unresolvedNormalizationFailedCount, 0);
});

runTest("all placed items count only toward placedTextItemCount", () => {
  const metrics = computeTextItemPlacementMetrics([placedItem(0), placedItem(1), placedItem(2)]);
  assertEqual(metrics.totalAdmittedTextItemCount, 3);
  assertEqual(metrics.placedTextItemCount, 3);
  assertEqual(metrics.unresolvedMissingGeometryCount, 0);
});

runTest("each unresolved status is counted in its own bucket", () => {
  const items: PhysicalDocumentTextItem[] = [
    placedItem(0),
    unresolvedItem(1, "unresolved_missing_geometry"),
    unresolvedItem(2, "unresolved_invalid_geometry"),
    unresolvedItem(3, "unresolved_unsupported_orientation"),
    unresolvedItem(4, "unresolved_normalization_failed"),
  ];
  const metrics = computeTextItemPlacementMetrics(items);
  assertEqual(metrics.totalAdmittedTextItemCount, 5);
  assertEqual(metrics.placedTextItemCount, 1);
  assertEqual(metrics.unresolvedMissingGeometryCount, 1);
  assertEqual(metrics.unresolvedInvalidGeometryCount, 1);
  assertEqual(metrics.unresolvedUnsupportedOrientationCount, 1);
  assertEqual(metrics.unresolvedNormalizationFailedCount, 1);
});

runTest("the conservation invariant holds: total equals the sum of every bucket", () => {
  const items: PhysicalDocumentTextItem[] = [
    placedItem(0),
    placedItem(1),
    unresolvedItem(2, "unresolved_missing_geometry"),
    unresolvedItem(3, "unresolved_missing_geometry"),
    unresolvedItem(4, "unresolved_invalid_geometry"),
    unresolvedItem(5, "unresolved_unsupported_orientation"),
    unresolvedItem(6, "unresolved_unsupported_orientation"),
    unresolvedItem(7, "unresolved_unsupported_orientation"),
    unresolvedItem(8, "unresolved_normalization_failed"),
  ];
  const metrics = computeTextItemPlacementMetrics(items);
  const sum =
    metrics.placedTextItemCount +
    metrics.unresolvedMissingGeometryCount +
    metrics.unresolvedInvalidGeometryCount +
    metrics.unresolvedUnsupportedOrientationCount +
    metrics.unresolvedNormalizationFailedCount;
  assertEqual(metrics.totalAdmittedTextItemCount, items.length);
  assertEqual(sum, metrics.totalAdmittedTextItemCount);
});

runTest("is deterministic across repeated calls with the same input", () => {
  const items: PhysicalDocumentTextItem[] = [placedItem(0), unresolvedItem(1, "unresolved_invalid_geometry")];
  assertEqual(JSON.stringify(computeTextItemPlacementMetrics(items)), JSON.stringify(computeTextItemPlacementMetrics(items)));
});
