import type { WorkPackage } from "../../../work-package-management";
import { WorkPackageType } from "../../../work-package-management";
import {
  addSpatialRelationship,
  attachSpatialLayer,
  createSpatialObject,
} from "../../spatial-object";
import type { SpatialObject, SpatialObjectError } from "../../spatial-object.types";
import { SpatialLayerType, SpatialObjectKind, SpatialRelationshipType } from "../../spatial-object.types";
import type {
  GenerateSpatialObjectsFromWorkPackagesInput,
  GenerateSpatialObjectsFromWorkPackagesResult,
  WorkPackageSpatialObjectSkip,
} from "./work-package-spatial-object-adapter.types";

/**
 * `domain/work-package-management` is one of the ten Engineering
 * Operational Layer domains guarded by
 * `architecture/engineering-boundaries.test.ts` (Rule E) — this is the
 * one authorized seam allowed to read it directly, mirroring exactly
 * how the Business Facts Generator's own engineering-application
 * adapter is the one seam authorized to read operational snapshots for
 * Rule C. `domain/spatial-object`'s own core files must never import
 * `work-package-management` outside this folder.
 *
 * Only `WorkPackageType.ExecutionFront` work packages become Spatial
 * Objects — every other type (ScopeGroup, CostGroup, Administration,
 * Mobilization, Demobilization, Other) is an organizational or
 * financial grouping, not a physical place, and turning one into a
 * Spatial Object would fabricate a location that does not exist (see
 * "não inventar dado" — no invented data — a standing rule across this
 * codebase). Skipped work packages are reported, never silently
 * dropped.
 *
 * No geometry is attached: `WorkPackage` carries no coordinate of any
 * kind. Every produced Spatial Object is born `Conceived`, with only
 * an `AsPlanned` layer — exactly Capítulo 16's "Concepção" stage
 * (`GEOSPATIAL_ENGINE.md`): "pode existir apenas como intenção
 * espacial... ainda não verificada em campo." Geometry arrives later,
 * from a topography/RTK/drone-fed Engine, via
 * `addSpatialGeometryVersion` — never from this adapter.
 */
export function generateSpatialObjectsFromWorkPackages(
  input: GenerateSpatialObjectsFromWorkPackagesInput,
): GenerateSpatialObjectsFromWorkPackagesResult {
  const { workPackages, actor, occurredAt } = input;

  const eligible = workPackages.filter((workPackage) => workPackage.type === WorkPackageType.ExecutionFront);
  const eligibleIds = new Set(eligible.map((workPackage) => workPackage.id));
  const skipped: WorkPackageSpatialObjectSkip[] = workPackages
    .filter((workPackage) => workPackage.type !== WorkPackageType.ExecutionFront)
    .map((workPackage) => ({ workPackageId: workPackage.id, reason: "not_execution_front" as const }));

  const errors: SpatialObjectError[] = [];
  const created = new Map<string, SpatialObject>();

  eligible.forEach((workPackage) => {
    const spatialObjectId = spatialObjectIdForWorkPackage(workPackage);
    const hasEligibleChildren = eligible.some(
      (candidate) => candidate.parentWorkPackageId === workPackage.id,
    );
    const parentId =
      workPackage.parentWorkPackageId !== null && eligibleIds.has(workPackage.parentWorkPackageId)
        ? spatialObjectIdForWorkPackage(workPackage.parentWorkPackageId)
        : null;

    const createdResult = createSpatialObject({
      id: spatialObjectId,
      label: workPackage.name,
      kind: hasEligibleChildren ? SpatialObjectKind.Group : SpatialObjectKind.Polygon,
      parentId,
      actor,
      occurredAt,
    });

    if (!createdResult.success) {
      errors.push(...createdResult.errors);
      return;
    }

    const withLayer = attachSpatialLayer({
      spatialObject: createdResult.spatialObject,
      layer: {
        id: `${spatialObjectId}:layer:as-planned`,
        type: SpatialLayerType.AsPlanned,
        source: "work-package-management",
        description: `Frente de execução planejada: ${workPackage.name} (${workPackage.code}).`,
      },
      actor,
      occurredAt,
    });

    if (!withLayer.success) {
      errors.push(...withLayer.errors);
      return;
    }

    created.set(workPackage.id, withLayer.spatialObject);
  });

  // `buildSpatialGraph` (spatial-object.ts) only projects
  // `relationships`, not `parentId` — an explicit Contains edge is
  // added here, on top of `parentId`, so the Spatial Graph produced
  // from these objects is complete, not just their bare hierarchy.
  eligible.forEach((workPackage) => {
    if (workPackage.parentWorkPackageId === null) {
      return;
    }

    const parent = created.get(workPackage.parentWorkPackageId);
    const child = created.get(workPackage.id);

    if (parent === undefined || child === undefined) {
      return;
    }

    const withRelationship = addSpatialRelationship({
      spatialObject: parent,
      relationship: {
        id: `${parent.id}:contains:${child.id}`,
        type: SpatialRelationshipType.Contains,
        targetId: child.id,
        description: `${parent.label} contém ${child.label}.`,
      },
      actor,
      occurredAt,
    });

    if (!withRelationship.success) {
      errors.push(...withRelationship.errors);
      return;
    }

    created.set(workPackage.parentWorkPackageId, withRelationship.spatialObject);
  });

  return {
    success: errors.length === 0,
    spatialObjects: Array.from(created.values()),
    skipped,
    errors,
  };
}

function spatialObjectIdForWorkPackage(workPackageOrId: WorkPackage | string): string {
  const workPackageId = typeof workPackageOrId === "string" ? workPackageOrId : workPackageOrId.id;
  return `spatial-object:work-package:${workPackageId}`;
}
