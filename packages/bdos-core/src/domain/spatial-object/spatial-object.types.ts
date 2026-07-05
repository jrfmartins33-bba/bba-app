export type SpatialObjectId = string;

export type SpatialObjectActor = string;

export type SpatialObjectOccurredAt = string;

export type SpatialObjectMetadata = Readonly<Record<string, unknown>>;

/**
 * What a Spatial Object geometrically represents. See PRINCIPLE 004 —
 * Spatial Intelligence and `packages/bdos-core/docs/GEOSPATIAL_ENGINE.md`,
 * Capítulo 11 (Spatial Object) and Capítulo 12 (Hierarquia Espacial).
 */
export enum SpatialObjectKind {
  Point = "Point",
  Line = "Line",
  Polygon = "Polygon",
  Volume = "Volume",
  Group = "Group",
}

/**
 * Lifecycle status — Capítulo 16 (Ciclo de Vida dos Objetos Espaciais).
 * "Ativação" and "Evolução" from the conceptual model are not separate
 * reachable statuses here: Ativação is the transition into `Active` (the
 * moment the first non-planning layer attaches, see
 * `attachSpatialLayer` in spatial-object.ts), and Evolução is simply the
 * sustained `Active` status for as long as new layers keep arriving. A
 * Spatial Object is never deleted — only archived, at any stage of its
 * life — preserving auditability.
 */
export enum SpatialObjectStatus {
  Conceived = "Conceived",
  Active = "Active",
  Consolidated = "Consolidated",
  Archived = "Archived",
}

/**
 * How a geometry version was captured. Drives Spatial Confidence
 * (`spatial-confidence.ts`) — never treated as mere descriptive
 * metadata (PRINCIPLE 004).
 */
export enum SpatialGeometrySource {
  ManualDeclaration = "manual_declaration",
  GpsApproximate = "gps_approximate",
  TopographySurvey = "topography_survey",
  RtkGnss = "rtk_gnss",
  DroneOrthomosaic = "drone_orthomosaic",
  Satellite = "satellite",
}

/**
 * Mirrors the field names of `MeasurementCoordinate`
 * (`domain/measurement`) on purpose, to ease a future consolidation —
 * this sprint does not import, extend, or alter that type (see the
 * PRINCIPLE 004 reconciliation note in `BDS_ARCHITECTURE_PRINCIPLES.md`
 * and `GEOSPATIAL_ENGINE.md`).
 */
export interface SpatialCoordinate {
  readonly latitude: number;
  readonly longitude: number;
  readonly elevation?: number | null;
}

/**
 * One versioned geometric representation of a Spatial Object (Capítulo
 * 13 — Spatial Identity). Geometry can be superseded by a more precise
 * version without the object's identity ever changing; superseded
 * versions are never removed, only marked via `supersededAt` — this
 * domain does not implement any topological algebra (intersection,
 * buffer, union) over `coordinates`, only stores and versions it.
 */
export interface SpatialGeometryVersion {
  readonly id: string;
  readonly kind: SpatialObjectKind;
  readonly coordinates: ReadonlyArray<SpatialCoordinate>;
  readonly source: SpatialGeometrySource;
  readonly capturedAt: SpatialObjectOccurredAt;
  readonly supersededAt: SpatialObjectOccurredAt | null;
  readonly metadata: SpatialObjectMetadata;
}

export interface SpatialGeometryInput {
  readonly id: string;
  readonly kind?: SpatialObjectKind;
  readonly coordinates: ReadonlyArray<SpatialCoordinate>;
  readonly source: SpatialGeometrySource;
  readonly metadata?: SpatialObjectMetadata;
}

/** Capítulo 15 — Spatial Layers. */
export enum SpatialLayerType {
  AsPlanned = "as_planned",
  AsPerformed = "as_performed",
  Evidential = "evidential",
  AsMeasured = "as_measured",
  Financial = "financial",
  LegalRegulatory = "legal_regulatory",
}

export interface SpatialLayer {
  readonly id: string;
  readonly type: SpatialLayerType;
  readonly source: string;
  readonly description: string;
  readonly attachedAt: SpatialObjectOccurredAt;
  readonly metadata: SpatialObjectMetadata;
}

export interface SpatialLayerInput {
  readonly id: string;
  readonly type: SpatialLayerType;
  readonly source: string;
  readonly description: string;
  readonly metadata?: SpatialObjectMetadata;
}

/** Capítulo 14 — Spatial Relationships. */
export enum SpatialRelationshipType {
  Contains = "contains",
  Adjacent = "adjacent",
  Overlaps = "overlaps",
  DependsOn = "depends_on",
  DerivedFrom = "derived_from",
  Corresponds = "corresponds",
  Restricts = "restricts",
}

export interface SpatialRelationship {
  readonly id: string;
  readonly type: SpatialRelationshipType;
  readonly targetId: SpatialObjectId;
  readonly description: string;
  readonly establishedAt: SpatialObjectOccurredAt;
  readonly metadata: SpatialObjectMetadata;
}

export interface SpatialRelationshipInput {
  readonly id: string;
  readonly type: SpatialRelationshipType;
  readonly targetId: SpatialObjectId;
  readonly description: string;
  readonly metadata?: SpatialObjectMetadata;
}

/**
 * Curated, business-readable narrative of this object's own lifecycle
 * — distinct from `trace`, which is the full technical audit record of
 * every mutation. Capítulo 17 — Temporal Layer: this is what makes
 * Replay Temporal possible, not an afterthought log.
 */
export interface SpatialObjectTimelineEvent {
  readonly type: string;
  readonly occurredAt: SpatialObjectOccurredAt;
  readonly description: string;
  readonly metadata: SpatialObjectMetadata;
}

export interface SpatialObjectTrace {
  readonly action: string;
  readonly actor: SpatialObjectActor;
  readonly occurredAt: SpatialObjectOccurredAt;
  readonly description: string;
  readonly metadata: SpatialObjectMetadata;
}

export interface SpatialObjectSummary {
  readonly status: SpatialObjectStatus;
  readonly totalGeometryVersions: number;
  readonly totalLayers: number;
  readonly totalRelationships: number;
  readonly isTerminal: boolean;
}

/**
 * Aggregate root — Capítulo 11 (Spatial Object). One conceptual "place"
 * in a work (a point, a segment, a polygon, a volume, or a logical
 * group of other Spatial Objects), stable across geometry refinements.
 * Named `spatial-object` deliberately, not `digital-twin` — see the
 * PRINCIPLE 004 reconciliation note: `domain/digital-twin` already
 * means a different thing (a static per-tenant demo dataset) and must
 * never be repurposed for this.
 */
export interface SpatialObject {
  readonly id: SpatialObjectId;
  readonly label: string;
  readonly kind: SpatialObjectKind;
  readonly status: SpatialObjectStatus;
  readonly parentId: SpatialObjectId | null;
  readonly geometries: ReadonlyArray<SpatialGeometryVersion>;
  readonly layers: ReadonlyArray<SpatialLayer>;
  readonly relationships: ReadonlyArray<SpatialRelationship>;
  readonly trace: ReadonlyArray<SpatialObjectTrace>;
  readonly timeline: ReadonlyArray<SpatialObjectTimelineEvent>;
  readonly metadata: SpatialObjectMetadata;
}

export interface CreateSpatialObjectInput {
  readonly id: SpatialObjectId;
  readonly label: string;
  readonly kind: SpatialObjectKind;
  readonly parentId?: SpatialObjectId | null;
  readonly geometry?: SpatialGeometryInput | null;
  readonly actor: SpatialObjectActor;
  readonly occurredAt: SpatialObjectOccurredAt;
  readonly metadata?: SpatialObjectMetadata;
}

export interface AttachSpatialLayerInput {
  readonly spatialObject: SpatialObject;
  readonly layer: SpatialLayerInput;
  readonly actor: SpatialObjectActor;
  readonly occurredAt: SpatialObjectOccurredAt;
  readonly metadata?: SpatialObjectMetadata;
}

export interface AddSpatialGeometryVersionInput {
  readonly spatialObject: SpatialObject;
  readonly geometry: SpatialGeometryInput;
  readonly actor: SpatialObjectActor;
  readonly occurredAt: SpatialObjectOccurredAt;
  readonly metadata?: SpatialObjectMetadata;
}

export interface AddSpatialRelationshipInput {
  readonly spatialObject: SpatialObject;
  readonly relationship: SpatialRelationshipInput;
  readonly actor: SpatialObjectActor;
  readonly occurredAt: SpatialObjectOccurredAt;
  readonly metadata?: SpatialObjectMetadata;
}

export interface ConsolidateSpatialObjectInput {
  readonly spatialObject: SpatialObject;
  readonly actor: SpatialObjectActor;
  readonly occurredAt: SpatialObjectOccurredAt;
  readonly metadata?: SpatialObjectMetadata;
}

export interface ArchiveSpatialObjectInput {
  readonly spatialObject: SpatialObject;
  readonly actor: SpatialObjectActor;
  readonly occurredAt: SpatialObjectOccurredAt;
  readonly metadata?: SpatialObjectMetadata;
}

export type SpatialObjectErrorCode =
  | "missing_id"
  | "missing_label"
  | "missing_kind"
  | "object_terminal"
  | "invalid_spatial_object_status_transition"
  | "missing_geometry_id"
  | "duplicate_geometry_id"
  | "missing_geometry_coordinates"
  | "invalid_coordinate_latitude"
  | "invalid_coordinate_longitude"
  | "missing_layer_id"
  | "duplicate_layer_id"
  | "missing_layer_type"
  | "missing_layer_source"
  | "missing_relationship_id"
  | "duplicate_relationship_id"
  | "missing_relationship_target"
  | "self_referencing_relationship";

export interface SpatialObjectError {
  readonly code: SpatialObjectErrorCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: SpatialObjectMetadata;
}

export type SpatialObjectWarningCode = "none";

export interface SpatialObjectWarning {
  readonly code: SpatialObjectWarningCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: SpatialObjectMetadata;
}

export interface SpatialObjectSuccess {
  readonly success: true;
  readonly spatialObject: SpatialObject;
  readonly errors: ReadonlyArray<SpatialObjectError>;
  readonly warnings: ReadonlyArray<SpatialObjectWarning>;
  readonly metadata: SpatialObjectMetadata;
}

export interface SpatialObjectFailure {
  readonly success: false;
  readonly spatialObject: null;
  readonly errors: ReadonlyArray<SpatialObjectError>;
  readonly warnings: ReadonlyArray<SpatialObjectWarning>;
  readonly metadata: SpatialObjectMetadata;
}

export type SpatialObjectResult = SpatialObjectSuccess | SpatialObjectFailure;

/**
 * Capítulo 9 / 19 — Spatial Graph: Spatial Objects as nodes, Spatial
 * Relationships as edges. Per the PRINCIPLE 004 reconciliation note,
 * this is a read-only projection built from existing objects — never a
 * structure parallel to `Decision` → `DecisionCase` →
 * `Recommendation.traceability`, which remains the actual decision
 * traceability backbone.
 */
export interface SpatialGraphNode {
  readonly id: SpatialObjectId;
  readonly label: string;
  readonly kind: SpatialObjectKind;
  readonly status: SpatialObjectStatus;
}

export interface SpatialGraphEdge {
  readonly type: SpatialRelationshipType;
  readonly fromId: SpatialObjectId;
  readonly toId: SpatialObjectId;
}

export interface SpatialGraph {
  readonly nodes: ReadonlyArray<SpatialGraphNode>;
  readonly edges: ReadonlyArray<SpatialGraphEdge>;
}
