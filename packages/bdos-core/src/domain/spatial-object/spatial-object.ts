import type {
  AddSpatialGeometryVersionInput,
  AddSpatialRelationshipInput,
  ArchiveSpatialObjectInput,
  AttachSpatialLayerInput,
  ConsolidateSpatialObjectInput,
  CreateSpatialObjectInput,
  SpatialCoordinate,
  SpatialGeometryInput,
  SpatialGeometryVersion,
  SpatialGraph,
  SpatialGraphEdge,
  SpatialGraphNode,
  SpatialLayer,
  SpatialLayerInput,
  SpatialObject,
  SpatialObjectError,
  SpatialObjectFailure,
  SpatialObjectMetadata,
  SpatialObjectResult,
  SpatialObjectSuccess,
  SpatialObjectSummary,
  SpatialObjectTimelineEvent,
  SpatialObjectTrace,
  SpatialRelationship,
  SpatialRelationshipInput,
} from "./spatial-object.types";
import { SpatialLayerType, SpatialObjectStatus } from "./spatial-object.types";

const MIN_LATITUDE = -90;
const MAX_LATITUDE = 90;
const MIN_LONGITUDE = -180;
const MAX_LONGITUDE = 180;

export function createSpatialObject(input: CreateSpatialObjectInput): SpatialObjectResult {
  const metadata = createObjectMetadata(input);
  const errors: SpatialObjectError[] = [];

  if (isBlank(input.id)) {
    errors.push(createObjectError("missing_id", "id", "Spatial object id is required.", metadata));
  }

  if (isBlank(input.label)) {
    errors.push(createObjectError("missing_label", "label", "Spatial object label is required.", metadata));
  }

  if (isBlank(input.kind)) {
    errors.push(createObjectError("missing_kind", "kind", "Spatial object kind is required.", metadata));
  }

  if (input.geometry != null) {
    errors.push(...validateGeometryInput(input.geometry, "geometry", metadata));
  }

  if (errors.length > 0) {
    return failureResult(errors, metadata);
  }

  const geometries: SpatialGeometryVersion[] =
    input.geometry != null
      ? [buildGeometryVersion(input.geometry, input.kind, input.occurredAt)]
      : [];

  const spatialObject: SpatialObject = {
    id: input.id,
    label: input.label,
    kind: input.kind,
    status: SpatialObjectStatus.Conceived,
    parentId: input.parentId ?? null,
    geometries,
    layers: [],
    relationships: [],
    timeline: [
      createTimelineEvent(
        "spatial_object_conceived",
        input.occurredAt,
        `Spatial object ${input.id} conceived as ${input.kind}.`,
        metadata,
      ),
    ],
    trace: [
      createTraceEntry(
        "spatial_object_conceived",
        input.actor,
        input.occurredAt,
        `Spatial object ${input.id} conceived.`,
        metadata,
      ),
    ],
    metadata,
  };

  return freezeDomainObject<SpatialObjectSuccess>({
    success: true,
    spatialObject,
    errors: [],
    warnings: [],
    metadata,
  });
}

/**
 * Appends a layer (Capítulo 15 — Spatial Layers). If the object is
 * still `Conceived` and the layer being attached is anything other than
 * `AsPlanned`, this is exactly "Ativação" (Capítulo 16): the object
 * auto-transitions to `Active` as a side effect of its first real-world
 * layer, never as a separate manual step.
 */
export function attachSpatialLayer(input: AttachSpatialLayerInput): SpatialObjectResult {
  const metadata = createMutationMetadata(input.spatialObject, input.metadata);
  const errors = validateMutable(input.spatialObject, metadata);

  errors.push(...validateLayerInput(input.layer, metadata));

  if (input.spatialObject.layers.some((existing) => existing.id === input.layer.id)) {
    errors.push(
      createObjectError(
        "duplicate_layer_id",
        "layer.id",
        `Layer id ${input.layer.id} already exists on this spatial object.`,
        metadata,
      ),
    );
  }

  if (errors.length > 0) {
    return failureResult(errors, metadata);
  }

  const layer = buildLayer(input.layer, input.occurredAt);
  const shouldActivate =
    input.spatialObject.status === SpatialObjectStatus.Conceived && layer.type !== SpatialLayerType.AsPlanned;

  const timeline: SpatialObjectTimelineEvent[] = [
    ...input.spatialObject.timeline,
    createTimelineEvent(
      "spatial_layer_attached",
      input.occurredAt,
      `Layer ${layer.type} attached to spatial object ${input.spatialObject.id}.`,
      metadata,
    ),
  ];

  if (shouldActivate) {
    timeline.push(
      createTimelineEvent(
        "spatial_object_activated",
        input.occurredAt,
        `Spatial object ${input.spatialObject.id} activated by its first real-world layer.`,
        metadata,
      ),
    );
  }

  return freezeDomainObject<SpatialObjectSuccess>({
    success: true,
    spatialObject: {
      ...input.spatialObject,
      status: shouldActivate ? SpatialObjectStatus.Active : input.spatialObject.status,
      layers: [...input.spatialObject.layers, layer],
      timeline,
      trace: [
        ...input.spatialObject.trace,
        createTraceEntry(
          "spatial_layer_attached",
          input.actor,
          input.occurredAt,
          `Layer ${layer.id} (${layer.type}) attached to spatial object ${input.spatialObject.id}.`,
          metadata,
        ),
      ],
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

/**
 * Adds a new geometry version without changing the object's identity
 * (Capítulo 13 — Spatial Identity): the previously current version (the
 * one with `supersededAt === null`) is marked superseded, never
 * removed.
 */
export function addSpatialGeometryVersion(input: AddSpatialGeometryVersionInput): SpatialObjectResult {
  const metadata = createMutationMetadata(input.spatialObject, input.metadata);
  const errors = validateMutable(input.spatialObject, metadata);

  errors.push(...validateGeometryInput(input.geometry, "geometry", metadata));

  if (input.spatialObject.geometries.some((existing) => existing.id === input.geometry.id)) {
    errors.push(
      createObjectError(
        "duplicate_geometry_id",
        "geometry.id",
        `Geometry id ${input.geometry.id} already exists on this spatial object.`,
        metadata,
      ),
    );
  }

  if (errors.length > 0) {
    return failureResult(errors, metadata);
  }

  const supersededGeometries = input.spatialObject.geometries.map((geometry) =>
    geometry.supersededAt === null ? { ...geometry, supersededAt: input.occurredAt } : geometry,
  );

  const newGeometry = buildGeometryVersion(input.geometry, input.spatialObject.kind, input.occurredAt);

  return freezeDomainObject<SpatialObjectSuccess>({
    success: true,
    spatialObject: {
      ...input.spatialObject,
      geometries: [...supersededGeometries, newGeometry],
      timeline: [
        ...input.spatialObject.timeline,
        createTimelineEvent(
          "spatial_geometry_version_added",
          input.occurredAt,
          `New geometry version ${newGeometry.id} (${newGeometry.source}) recorded for spatial object ${input.spatialObject.id}.`,
          metadata,
        ),
      ],
      trace: [
        ...input.spatialObject.trace,
        createTraceEntry(
          "spatial_geometry_version_added",
          input.actor,
          input.occurredAt,
          `Geometry version ${newGeometry.id} added to spatial object ${input.spatialObject.id}.`,
          metadata,
        ),
      ],
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

export function addSpatialRelationship(input: AddSpatialRelationshipInput): SpatialObjectResult {
  const metadata = createMutationMetadata(input.spatialObject, input.metadata);
  const errors = validateMutable(input.spatialObject, metadata);

  errors.push(...validateRelationshipInput(input.relationship, metadata));

  if (input.relationship.targetId === input.spatialObject.id) {
    errors.push(
      createObjectError(
        "self_referencing_relationship",
        "relationship.targetId",
        `Spatial object ${input.spatialObject.id} cannot relate to itself.`,
        metadata,
      ),
    );
  }

  if (input.spatialObject.relationships.some((existing) => existing.id === input.relationship.id)) {
    errors.push(
      createObjectError(
        "duplicate_relationship_id",
        "relationship.id",
        `Relationship id ${input.relationship.id} already exists on this spatial object.`,
        metadata,
      ),
    );
  }

  if (errors.length > 0) {
    return failureResult(errors, metadata);
  }

  const relationship = buildRelationship(input.relationship, input.occurredAt);

  return freezeDomainObject<SpatialObjectSuccess>({
    success: true,
    spatialObject: {
      ...input.spatialObject,
      relationships: [...input.spatialObject.relationships, relationship],
      trace: [
        ...input.spatialObject.trace,
        createTraceEntry(
          "spatial_relationship_added",
          input.actor,
          input.occurredAt,
          `Relationship ${relationship.type} to ${relationship.targetId} added to spatial object ${input.spatialObject.id}.`,
          metadata,
        ),
      ],
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

export function consolidateSpatialObject(input: ConsolidateSpatialObjectInput): SpatialObjectResult {
  return transitionStatus(
    input.spatialObject,
    SpatialObjectStatus.Consolidated,
    "spatial_object_consolidated",
    input.actor,
    input.occurredAt,
    input.metadata,
  );
}

export function archiveSpatialObject(input: ArchiveSpatialObjectInput): SpatialObjectResult {
  return transitionStatus(
    input.spatialObject,
    SpatialObjectStatus.Archived,
    "spatial_object_archived",
    input.actor,
    input.occurredAt,
    input.metadata,
  );
}

export function findCurrentSpatialGeometry(
  spatialObject: SpatialObject,
): SpatialGeometryVersion | null {
  return spatialObject.geometries.find((geometry) => geometry.supersededAt === null) ?? null;
}

export function listSpatialLayersByType(
  spatialObject: SpatialObject,
  type: SpatialLayer["type"],
): ReadonlyArray<SpatialLayer> {
  return Object.freeze(spatialObject.layers.filter((layer) => layer.type === type));
}

export function summarizeSpatialObject(spatialObject: SpatialObject): SpatialObjectSummary {
  return {
    status: spatialObject.status,
    totalGeometryVersions: spatialObject.geometries.length,
    totalLayers: spatialObject.layers.length,
    totalRelationships: spatialObject.relationships.length,
    isTerminal: isTerminalStatus(spatialObject.status),
  };
}

/**
 * Capítulo 9 / 19 — Spatial Graph, built by traversing every object's
 * own outgoing `relationships`. Read-only projection: never mutates,
 * never stores, always derived from the given objects.
 */
export function buildSpatialGraph(spatialObjects: ReadonlyArray<SpatialObject>): SpatialGraph {
  const nodes: SpatialGraphNode[] = spatialObjects.map((spatialObject) => ({
    id: spatialObject.id,
    label: spatialObject.label,
    kind: spatialObject.kind,
    status: spatialObject.status,
  }));

  const edges: SpatialGraphEdge[] = spatialObjects.flatMap((spatialObject) =>
    spatialObject.relationships.map((relationship) => ({
      type: relationship.type,
      fromId: spatialObject.id,
      toId: relationship.targetId,
    })),
  );

  return freezeDomainObject<SpatialGraph>({ nodes, edges });
}

function isTerminalStatus(status: SpatialObjectStatus): boolean {
  return status === SpatialObjectStatus.Archived;
}

function canAdvanceStatus(fromStatus: SpatialObjectStatus, toStatus: SpatialObjectStatus): boolean {
  return allowedTransitions[fromStatus].includes(toStatus);
}

const allowedTransitions: Readonly<Record<SpatialObjectStatus, ReadonlyArray<SpatialObjectStatus>>> = {
  [SpatialObjectStatus.Conceived]: [SpatialObjectStatus.Active, SpatialObjectStatus.Archived],
  [SpatialObjectStatus.Active]: [SpatialObjectStatus.Consolidated, SpatialObjectStatus.Archived],
  [SpatialObjectStatus.Consolidated]: [SpatialObjectStatus.Archived],
  [SpatialObjectStatus.Archived]: [],
};

function transitionStatus(
  spatialObject: SpatialObject,
  toStatus: SpatialObjectStatus,
  timelineType: string,
  actor: string,
  occurredAt: string,
  extraMetadata: SpatialObjectMetadata | undefined,
): SpatialObjectResult {
  const metadata = createMutationMetadata(spatialObject, extraMetadata);
  const fromStatus = spatialObject.status;

  if (isTerminalStatus(fromStatus)) {
    return failureResult(
      [
        createObjectError(
          "object_terminal",
          "status",
          `Cannot transition spatial object from terminal status ${fromStatus}.`,
          metadata,
        ),
      ],
      metadata,
    );
  }

  if (!canAdvanceStatus(fromStatus, toStatus)) {
    return failureResult(
      [
        createObjectError(
          "invalid_spatial_object_status_transition",
          "status",
          `Cannot transition spatial object from ${fromStatus} to ${toStatus}.`,
          metadata,
        ),
      ],
      metadata,
    );
  }

  return freezeDomainObject<SpatialObjectSuccess>({
    success: true,
    spatialObject: {
      ...spatialObject,
      status: toStatus,
      timeline: [
        ...spatialObject.timeline,
        createTimelineEvent(
          timelineType,
          occurredAt,
          `Spatial object ${spatialObject.id} moved from ${fromStatus} to ${toStatus}.`,
          metadata,
        ),
      ],
      trace: [
        ...spatialObject.trace,
        createTraceEntry(
          timelineType,
          actor,
          occurredAt,
          `Spatial object status advanced from ${fromStatus} to ${toStatus}.`,
          metadata,
        ),
      ],
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

function validateMutable(spatialObject: SpatialObject, metadata: SpatialObjectMetadata): SpatialObjectError[] {
  const errors: SpatialObjectError[] = [];

  if (isTerminalStatus(spatialObject.status)) {
    errors.push(
      createObjectError(
        "object_terminal",
        "status",
        `Cannot mutate spatial object while status is ${spatialObject.status}.`,
        metadata,
      ),
    );
  }

  return errors;
}

function validateGeometryInput(
  geometry: SpatialGeometryInput,
  field: string,
  metadata: SpatialObjectMetadata,
): SpatialObjectError[] {
  const errors: SpatialObjectError[] = [];

  if (isBlank(geometry.id)) {
    errors.push(createObjectError("missing_geometry_id", `${field}.id`, "Geometry id is required.", metadata));
  }

  if (geometry.coordinates.length === 0) {
    errors.push(
      createObjectError(
        "missing_geometry_coordinates",
        `${field}.coordinates`,
        "Geometry must have at least one coordinate.",
        metadata,
      ),
    );
  }

  geometry.coordinates.forEach((coordinate, index) => {
    errors.push(...validateCoordinate(coordinate, `${field}.coordinates[${index}]`, metadata));
  });

  return errors;
}

function validateCoordinate(
  coordinate: SpatialCoordinate,
  field: string,
  metadata: SpatialObjectMetadata,
): SpatialObjectError[] {
  const errors: SpatialObjectError[] = [];

  if (coordinate.latitude < MIN_LATITUDE || coordinate.latitude > MAX_LATITUDE) {
    errors.push(
      createObjectError(
        "invalid_coordinate_latitude",
        `${field}.latitude`,
        `Latitude ${coordinate.latitude} is outside the valid range [${MIN_LATITUDE}, ${MAX_LATITUDE}].`,
        metadata,
      ),
    );
  }

  if (coordinate.longitude < MIN_LONGITUDE || coordinate.longitude > MAX_LONGITUDE) {
    errors.push(
      createObjectError(
        "invalid_coordinate_longitude",
        `${field}.longitude`,
        `Longitude ${coordinate.longitude} is outside the valid range [${MIN_LONGITUDE}, ${MAX_LONGITUDE}].`,
        metadata,
      ),
    );
  }

  return errors;
}

function validateLayerInput(layer: SpatialLayerInput, metadata: SpatialObjectMetadata): SpatialObjectError[] {
  const errors: SpatialObjectError[] = [];

  if (isBlank(layer.id)) {
    errors.push(createObjectError("missing_layer_id", "layer.id", "Layer id is required.", metadata));
  }

  if (isBlank(layer.type)) {
    errors.push(createObjectError("missing_layer_type", "layer.type", "Layer type is required.", metadata));
  }

  if (isBlank(layer.source)) {
    errors.push(createObjectError("missing_layer_source", "layer.source", "Layer source is required.", metadata));
  }

  return errors;
}

function validateRelationshipInput(
  relationship: SpatialRelationshipInput,
  metadata: SpatialObjectMetadata,
): SpatialObjectError[] {
  const errors: SpatialObjectError[] = [];

  if (isBlank(relationship.id)) {
    errors.push(
      createObjectError("missing_relationship_id", "relationship.id", "Relationship id is required.", metadata),
    );
  }

  if (isBlank(relationship.targetId)) {
    errors.push(
      createObjectError(
        "missing_relationship_target",
        "relationship.targetId",
        "Relationship targetId is required.",
        metadata,
      ),
    );
  }

  return errors;
}

function buildGeometryVersion(
  geometry: SpatialGeometryInput,
  fallbackKind: SpatialObject["kind"],
  capturedAt: string,
): SpatialGeometryVersion {
  return {
    id: geometry.id,
    kind: geometry.kind ?? fallbackKind,
    coordinates: [...geometry.coordinates],
    source: geometry.source,
    capturedAt,
    supersededAt: null,
    metadata: geometry.metadata ?? {},
  };
}

function buildLayer(layer: SpatialLayerInput, attachedAt: string): SpatialLayer {
  return {
    id: layer.id,
    type: layer.type,
    source: layer.source,
    description: layer.description,
    attachedAt,
    metadata: layer.metadata ?? {},
  };
}

function buildRelationship(relationship: SpatialRelationshipInput, establishedAt: string): SpatialRelationship {
  return {
    id: relationship.id,
    type: relationship.type,
    targetId: relationship.targetId,
    description: relationship.description,
    establishedAt,
    metadata: relationship.metadata ?? {},
  };
}

function failureResult(
  errors: ReadonlyArray<SpatialObjectError>,
  metadata: SpatialObjectMetadata,
): SpatialObjectFailure {
  return freezeDomainObject<SpatialObjectFailure>({
    success: false,
    spatialObject: null,
    errors,
    warnings: [],
    metadata,
  });
}

function createTimelineEvent(
  type: string,
  occurredAt: string,
  description: string,
  metadata: SpatialObjectMetadata,
): SpatialObjectTimelineEvent {
  return {
    type,
    occurredAt,
    description,
    metadata,
  };
}

function createTraceEntry(
  action: string,
  actor: string,
  occurredAt: string,
  description: string,
  metadata: SpatialObjectMetadata,
): SpatialObjectTrace {
  return {
    action,
    actor,
    occurredAt,
    description,
    metadata,
  };
}

function createObjectError(
  code: SpatialObjectError["code"],
  field: string,
  message: string,
  metadata: SpatialObjectMetadata,
): SpatialObjectError {
  return {
    code,
    field,
    message,
    metadata,
  };
}

function createObjectMetadata(input: CreateSpatialObjectInput): SpatialObjectMetadata {
  return {
    ...(input.metadata ?? {}),
    spatialObjectId: input.id,
    kind: input.kind,
  };
}

function createMutationMetadata(
  spatialObject: SpatialObject,
  extraMetadata: SpatialObjectMetadata | undefined,
): SpatialObjectMetadata {
  return {
    ...spatialObject.metadata,
    ...(extraMetadata ?? {}),
    spatialObjectId: spatialObject.id,
    kind: spatialObject.kind,
  };
}

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

type FreezableRecord = Record<PropertyKey, unknown>;

function freezeDomainObject<T>(value: T): T {
  return freezeClonedDomainObject(cloneDomainValue(value));
}

function cloneDomainValue<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneDomainValue(item)) as T;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, property]) => [
      key,
      cloneDomainValue(property),
    ]),
  ) as T;
}

function freezeClonedDomainObject<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  Object.values(value as FreezableRecord).forEach((property) => {
    freezeClonedDomainObject(property);
  });

  return Object.freeze(value);
}
