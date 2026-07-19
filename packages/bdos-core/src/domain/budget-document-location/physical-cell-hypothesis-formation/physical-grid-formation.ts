import type { ReconstructedPhysicalLine } from "../structure-reconstruction/budget-document-structure-reconstruction.types";
import type { PhysicalColumnHypothesis } from "../physical-column-hypothesis-reconstruction/budget-document-physical-column-hypothesis-reconstruction.types";
import type { PhysicalGeometryBounds, PhysicalGridIntersectionIdentity } from "./budget-document-physical-cell-hypothesis-formation.types";
import { computeGridIntersectionKey } from "./physical-cell-hypothesis-formation-keys";
import { PHYSICAL_GRID_FORMATION_RULE_ID, PHYSICAL_GRID_FORMATION_RULE_VERSION, PROFILE } from "./physical-cell-hypothesis-formation-profile";

export interface PhysicalGridIntersectionDraft extends PhysicalGridIntersectionIdentity {
  readonly sourceLine: ReconstructedPhysicalLine;
  readonly sourceColumn: PhysicalColumnHypothesis;
}

export function createBounds(leftPoints: number, topPoints: number, rightPoints: number, bottomPoints: number): PhysicalGeometryBounds {
  return {
    leftPoints, topPoints, rightPoints, bottomPoints,
    widthPoints: rightPoints - leftPoints,
    heightPoints: bottomPoints - topPoints,
    centerXPoints: (leftPoints + rightPoints) / 2,
    centerYPoints: (topPoints + bottomPoints) / 2,
  };
}

export function formPhysicalGrid(
  regionProcessedKey: string,
  sourceRegionKey: string,
  pageNumber: number,
  lines: ReadonlyArray<ReconstructedPhysicalLine>,
  columns: ReadonlyArray<PhysicalColumnHypothesis>,
): ReadonlyArray<PhysicalGridIntersectionDraft> {
  return lines.flatMap((line) => columns.map((column) => ({
    gridIntersectionKey: computeGridIntersectionKey(regionProcessedKey, line.lineKey, column.hypothesisKey),
    sourceLineKey: line.lineKey,
    sourcePhysicalColumnHypothesisKey: column.hypothesisKey,
    sourceRegionKey,
    pageNumber,
    rowOrder: line.verticalOrder,
    columnOrder: column.order,
    gridBounds: createBounds(column.leftPoints, line.topPoints, column.rightPoints, line.bottomPoints),
    gridFormationRuleId: PHYSICAL_GRID_FORMATION_RULE_ID,
    gridFormationRuleVersion: PHYSICAL_GRID_FORMATION_RULE_VERSION,
    profileId: PROFILE.profileId,
    profileVersion: PROFILE.profileVersion,
    sourceLine: line,
    sourceColumn: column,
  })));
}
