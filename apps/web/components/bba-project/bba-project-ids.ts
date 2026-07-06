/**
 * BBA Project Studio — convenção de id compartilhada entre o
 * importador (bdos-core) e toda a UI: o `WorkPackage`/`SpatialObject`
 * gerado para uma atividade sempre usa
 * `spatial-object:work-package:${activityId}` como id (ver
 * `domain/spatial-object/adapters/work-package-management`). Nenhuma
 * lógica de negócio vive aqui — só a leitura/montagem dessa convenção.
 */
const SPATIAL_OBJECT_PREFIX = "spatial-object:work-package:";

export function activityIdFromSpatialObjectId(spatialObjectId: string): string | null {
  return spatialObjectId.startsWith(SPATIAL_OBJECT_PREFIX) ? spatialObjectId.slice(SPATIAL_OBJECT_PREFIX.length) : null;
}

export function spatialObjectIdForActivity(activityId: string): string {
  return `${SPATIAL_OBJECT_PREFIX}${activityId}`;
}
