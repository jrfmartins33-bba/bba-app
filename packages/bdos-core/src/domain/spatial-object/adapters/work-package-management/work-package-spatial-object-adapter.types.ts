import type { WorkPackage } from "../../../work-package-management";
import type { SpatialObject, SpatialObjectActor, SpatialObjectError, SpatialObjectOccurredAt } from "../../spatial-object.types";

export interface GenerateSpatialObjectsFromWorkPackagesInput {
  readonly workPackages: ReadonlyArray<WorkPackage>;
  readonly actor: SpatialObjectActor;
  readonly occurredAt: SpatialObjectOccurredAt;
}

export type WorkPackageSpatialObjectSkipReason = "not_execution_front";

export interface WorkPackageSpatialObjectSkip {
  readonly workPackageId: string;
  readonly reason: WorkPackageSpatialObjectSkipReason;
}

export interface GenerateSpatialObjectsFromWorkPackagesResult {
  readonly success: boolean;
  readonly spatialObjects: ReadonlyArray<SpatialObject>;
  readonly skipped: ReadonlyArray<WorkPackageSpatialObjectSkip>;
  readonly errors: ReadonlyArray<SpatialObjectError>;
}
