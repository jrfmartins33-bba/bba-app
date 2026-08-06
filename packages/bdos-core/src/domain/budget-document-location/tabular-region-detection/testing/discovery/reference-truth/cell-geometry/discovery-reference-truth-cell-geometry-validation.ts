/**
 * Validador puro, pós-projeção: re-verifica, de forma independente do
 * algoritmo de projeção, todas as invariantes geométricas obrigatórias
 * (§13 do enunciado da Sprint) sobre um conjunto já produzido de
 * `ReferenceTruthCellGeometry`. Nunca corrige — apenas relata. Nenhuma
 * tolerância decimal arbitrária: toda comparação é exata ou por
 * interseção estritamente positiva, reaproveitando
 * `discovery-reference-truth-cell-geometry-geometry-helpers`.
 */
import {
  boundingBoxesAreEqual,
  boxIsWithinPage,
  hasPositiveVerticalOverlap,
  intersectHorizontal,
  isValidBoundingBox,
  unionBoundingBoxes,
} from "./discovery-reference-truth-cell-geometry-geometry-helpers";
import type { ReferenceTruthCellGeometry, ReferenceTruthCellGeometryPageBounds } from "./discovery-reference-truth-cell-geometry.types";

export interface ReferenceTruthCellGeometryValidationIssue {
  readonly cellId: string;
  readonly code:
    | "invalid_bounding_box"
    | "fragment_outside_page"
    | "fragment_no_column_intersection_and_not_shared"
    | "fragment_outside_row_band"
    | "envelope_does_not_match_fragment_union"
    | "envelope_outside_page"
    | "shared_group_missing_partner"
    | "shared_group_asymmetric"
    | "shared_group_id_mismatch"
    | "duplicate_geometry_for_cell"
    | "legacy_key_status_inconsistent"
    | "reproducible_locator_missing"
    | "reproducible_locator_unexpected"
    | "reproducible_locator_wrong_page"
    | "reproducible_locator_invalid_order"
    | "reproducible_locator_invalid_box"
    | "association_basis_missing"
    | "association_basis_unexpected";
  readonly message: string;
}

const EXPECTED_LEGACY_KEY_STATUS = "legacy_unreproducible";
const EXPECTED_ASSOCIATION_BASIS = "exact_structural_position_with_region_geometry_validation";

export function validateReferenceTruthCellGeometries(
  geometries: ReadonlyArray<ReferenceTruthCellGeometry>,
  pageBounds: ReadonlyArray<ReferenceTruthCellGeometryPageBounds>,
): ReadonlyArray<ReferenceTruthCellGeometryValidationIssue> {
  const issues: ReferenceTruthCellGeometryValidationIssue[] = [];
  const pageBoundsByPage = new Map(pageBounds.map((p) => [p.realPageNumber, p] as const));
  const geometryByCellId = new Map<string, ReferenceTruthCellGeometry>();

  geometries.forEach((geometry) => {
    if (geometryByCellId.has(geometry.cellId)) {
      issues.push({ cellId: geometry.cellId, code: "duplicate_geometry_for_cell", message: `more than one geometry record exists for cell "${geometry.cellId}"` });
      return;
    }
    geometryByCellId.set(geometry.cellId, geometry);
  });

  geometries.forEach((geometry) => {
    const bounds = pageBoundsByPage.get(geometry.realPageNumber);

    if (!isValidBoundingBox(geometry.expectedEnvelope)) {
      issues.push({ cellId: geometry.cellId, code: "invalid_bounding_box", message: "expectedEnvelope is not a finite, correctly ordered bounding box" });
    } else if (bounds !== undefined && !boxIsWithinPage(geometry.expectedEnvelope, bounds.pageWidthPoints, bounds.pageHeightPoints)) {
      issues.push({ cellId: geometry.cellId, code: "envelope_outside_page", message: "expectedEnvelope extends beyond the page bounds" });
    }

    const fragmentBoxes = geometry.fragments.map((f) => f.projectedBoundingBox);
    const recomputedEnvelope = unionBoundingBoxes(fragmentBoxes);
    if (recomputedEnvelope === null || !boundingBoxesAreEqual(recomputedEnvelope, geometry.expectedEnvelope)) {
      issues.push({ cellId: geometry.cellId, code: "envelope_does_not_match_fragment_union", message: "expectedEnvelope is not the exact union of the cell's own fragments" });
    }

    geometry.fragments.forEach((fragment) => {
      if (!isValidBoundingBox(fragment.projectedBoundingBox)) {
        issues.push({ cellId: geometry.cellId, code: "invalid_bounding_box", message: `fragment "${fragment.id}" is not a finite, correctly ordered bounding box` });
        return;
      }

      if (bounds !== undefined && !boxIsWithinPage(fragment.projectedBoundingBox, bounds.pageWidthPoints, bounds.pageHeightPoints)) {
        issues.push({ cellId: geometry.cellId, code: "fragment_outside_page", message: `fragment "${fragment.id}" extends beyond the page bounds` });
      }

      if (fragment.projectionKind !== "row_column_empty_slot" && intersectHorizontal(fragment.projectedBoundingBox, geometry.columnBand) === null) {
        issues.push({ cellId: geometry.cellId, code: "fragment_no_column_intersection_and_not_shared", message: `fragment "${fragment.id}" has no horizontal intersection with its own column band` });
      }

      if (!hasPositiveVerticalOverlap(fragment.projectedBoundingBox, geometry.rowBand)) {
        issues.push({ cellId: geometry.cellId, code: "fragment_outside_row_band", message: `fragment "${fragment.id}" has no vertical overlap with its logical row's band` });
      }

      const isEmptySlotFragment = fragment.projectionKind === "row_column_empty_slot";

      if (isEmptySlotFragment) {
        if (fragment.legacyDeclaredSegmentKey !== null || fragment.legacyDeclaredSegmentKeyStatus !== null || fragment.reproducibleLocator !== null || fragment.associationBasis !== null) {
          issues.push({ cellId: geometry.cellId, code: "reproducible_locator_unexpected", message: `fragment "${fragment.id}" is an empty-slot projection but declares legacy key, status, locator or association basis` });
        }
      } else {
        if (fragment.legacyDeclaredSegmentKey === null || fragment.legacyDeclaredSegmentKeyStatus !== EXPECTED_LEGACY_KEY_STATUS) {
          issues.push({ cellId: geometry.cellId, code: "legacy_key_status_inconsistent", message: `fragment "${fragment.id}" must declare a legacy key with status "${EXPECTED_LEGACY_KEY_STATUS}"` });
        }

        if (fragment.associationBasis !== EXPECTED_ASSOCIATION_BASIS) {
          issues.push({ cellId: geometry.cellId, code: "association_basis_missing", message: `fragment "${fragment.id}" must declare associationBasis "${EXPECTED_ASSOCIATION_BASIS}"` });
        }

        const locator = fragment.reproducibleLocator;
        if (locator === null) {
          issues.push({ cellId: geometry.cellId, code: "reproducible_locator_missing", message: `fragment "${fragment.id}" has no reproducibleLocator` });
        } else {
          if (locator.realPageNumber !== geometry.realPageNumber) {
            issues.push({ cellId: geometry.cellId, code: "reproducible_locator_wrong_page", message: `fragment "${fragment.id}" locator page ${locator.realPageNumber} != geometry page ${geometry.realPageNumber}` });
          }
          if (!Number.isInteger(locator.regionVerticalOrder) || locator.regionVerticalOrder <= 0) {
            issues.push({ cellId: geometry.cellId, code: "reproducible_locator_invalid_order", message: `fragment "${fragment.id}" locator has invalid regionVerticalOrder` });
          }
          if (!Number.isInteger(locator.segmentHorizontalOrder) || locator.segmentHorizontalOrder <= 0) {
            issues.push({ cellId: geometry.cellId, code: "reproducible_locator_invalid_order", message: `fragment "${fragment.id}" locator has invalid segmentHorizontalOrder` });
          }
          if (!isValidBoundingBox(locator.regionBoundingBox) || !isValidBoundingBox(locator.segmentBoundingBox)) {
            issues.push({ cellId: geometry.cellId, code: "reproducible_locator_invalid_box", message: `fragment "${fragment.id}" locator has an invalid region or segment bounding box` });
          }
        }
      }
    });

    if (geometry.sharedGeometryGroupId !== null) {
      if (geometry.sharedWithCellIds.length === 0) {
        issues.push({ cellId: geometry.cellId, code: "shared_group_missing_partner", message: "declares a sharedGeometryGroupId but sharedWithCellIds is empty" });
      }
      geometry.sharedWithCellIds.forEach((partnerId) => {
        const partner = geometryByCellId.get(partnerId);
        if (partner === undefined) {
          issues.push({ cellId: geometry.cellId, code: "shared_group_missing_partner", message: `sharedWithCellIds references "${partnerId}", which has no geometry record` });
          return;
        }
        if (partner.sharedGeometryGroupId !== geometry.sharedGeometryGroupId) {
          issues.push({ cellId: geometry.cellId, code: "shared_group_id_mismatch", message: `partner "${partnerId}" does not declare the same sharedGeometryGroupId` });
          return;
        }
        if (!partner.sharedWithCellIds.includes(geometry.cellId)) {
          issues.push({ cellId: geometry.cellId, code: "shared_group_asymmetric", message: `partner "${partnerId}" does not list this cell back in its own sharedWithCellIds` });
        }
      });
    }
  });

  return issues;
}
