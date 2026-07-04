export type MeasurementCalculationMetadata = Readonly<Record<string, unknown>>;

export type CalculationMemoryId = string;

export type CalculationMemoryActor = string;

export type CalculationMemoryOccurredAt = string;

export type CalculationMemoryCorrelationId = string;

export type CalculationMemoryCreatedBy = string;

export type CalculationMemorySourceSystem = string;

export type MeasurementDimensionId = string;

/**
 * Physical unit vocabulary for this domain. Deliberately its own enum
 * (not a re-export of the Field Evidence Intelligence domain's
 * `EvidenceUnit`) — this domain must not import that bounded context,
 * and each bounded context owns its own unit vocabulary even where the
 * values happen to coincide.
 */
export enum MeasurementUnit {
  Meter = "m",
  SquareMeter = "m2",
  CubicMeter = "m3",
  Kilogram = "kg",
  Ton = "ton",
  Hour = "hour",
  Trip = "trip",
  Unit = "unit",
  Percent = "percent",
  Day = "day",
  None = "none",
}

/**
 * The formula a `CalculationMemory` intends to apply. This sprint only
 * names the intent — no formula in this catalog is executed here (see
 * the module-level notes in measurement-calculation.ts).
 */
export enum CalculationFormulaType {
  LinearQuantity = "linear_quantity",
  AreaRectangle = "area_rectangle",
  AreaTriangle = "area_triangle",
  AreaTrapezoid = "area_trapezoid",
  AreaCircle = "area_circle",
  PerimeterRectangle = "perimeter_rectangle",

  VolumeBox = "volume_box",
  VolumeCylinder = "volume_cylinder",
  VolumeTrapezoidalPrism = "volume_trapezoidal_prism",
  CutFillVolumeAverageEndArea = "cut_fill_volume_average_end_area",

  AreaTimesThickness = "area_times_thickness",
  AsphaltMassFromAreaThicknessDensity = "asphalt_mass_from_area_thickness_density",
  ConcreteVolume = "concrete_volume",
  MortarVolume = "mortar_volume",

  MachineHours = "machine_hours",
  VehicleTrips = "vehicle_trips",
  TransportVolume = "transport_volume",
  HaulageTonKm = "haulage_ton_km",

  SimpleQuantity = "simple_quantity",
  PercentageOfTotal = "percentage_of_total",
  WeightedProgress = "weighted_progress",

  SlopePercentage = "slope_percentage",
  LevelDifference = "level_difference",
  ExcavationDepthAverage = "excavation_depth_average",

  RebarWeightFromLength = "rebar_weight_from_length",
  SteelWeightFromUnitWeight = "steel_weight_from_unit_weight",
  FormworkArea = "formwork_area",

  PipeLength = "pipe_length",
  DrainageChannelVolume = "drainage_channel_volume",
  CurbLength = "curb_length",
  InterlockingPaverArea = "interlocking_paver_area",
}

export enum CalculationMemoryStatus {
  Draft = "Draft",
  Ready = "Ready",
  Calculated = "Calculated",
  Reviewed = "Reviewed",
  Approved = "Approved",
  Rejected = "Rejected",
  Archived = "Archived",
}

/**
 * A single informed measurement that feeds a calculation (e.g. "largura:
 * 3.20 m"). Value Object of `CalculationMemory` — does not compute
 * anything. `sourceEvidenceIds` (Sprint 13.6, Calculation Evidence
 * Linkage) are opaque string references only — this domain never reads,
 * validates, or imports the Field Evidence Intelligence domain; it only
 * remembers which evidence ids someone has associated with this
 * dimension.
 */
export interface MeasurementDimension {
  readonly id: MeasurementDimensionId;
  readonly name: string;
  readonly value: number;
  readonly unit: MeasurementUnit;
  readonly notes: string | null;
  readonly sourceEvidenceIds: ReadonlyArray<string>;
}

export interface MeasurementDimensionInput {
  readonly id: MeasurementDimensionId;
  readonly name: string;
  readonly value: number;
  readonly unit: MeasurementUnit;
  readonly notes?: string | null;
  readonly sourceEvidenceIds?: ReadonlyArray<string> | null;
}

/**
 * The outcome of applying `formulaType` to `dimensions` — structurally
 * present from this sprint onward, but nothing in this domain computes
 * it. Callers (a future Calculation Engine) supply the value explicitly.
 */
export interface CalculationResult {
  readonly value: number;
  readonly unit: MeasurementUnit;
  readonly precision: number;
  readonly rounded: boolean;
}

export interface CalculationMemoryTimelineEvent {
  readonly type: string;
  readonly occurredAt: CalculationMemoryOccurredAt;
  readonly description: string;
  readonly metadata: MeasurementCalculationMetadata;
}

export interface CalculationMemoryTrace {
  readonly action: string;
  readonly actor: CalculationMemoryActor;
  readonly occurredAt: CalculationMemoryOccurredAt;
  readonly description: string;
  readonly metadata: MeasurementCalculationMetadata;
}

export interface CalculationMemorySummary {
  readonly status: CalculationMemoryStatus;
  readonly formulaType: CalculationFormulaType;
  readonly totalDimensions: number;
  readonly hasResult: boolean;
  readonly totalSourceEvidenceIds: number;
  readonly totalTraceEntries: number;
  readonly totalTimelineEntries: number;
  readonly isTerminal: boolean;
  readonly isOperationallyTerminal: boolean;
}

/**
 * Per-dimension breakdown of how many `sourceEvidenceIds` are linked to
 * it — the "rastreabilidade entre dimensão e evidência" required by
 * Sprint 13.6, expressed as opaque counts only (no evidence content, no
 * Field Evidence Intelligence lookups).
 */
export interface CalculationDimensionEvidenceLinkSummary {
  readonly dimensionId: MeasurementDimensionId;
  readonly totalLinkedEvidenceIds: number;
}

export interface CalculationEvidenceLinksSummary {
  readonly totalSourceEvidenceIds: number;
  readonly totalLinkedDimensions: number;
  readonly totalDimensionEvidenceLinks: number;
  readonly dimensionLinks: ReadonlyArray<CalculationDimensionEvidenceLinkSummary>;
}

/**
 * Aggregate root representing a single auditable calculation memory —
 * the inaugural aggregate of the Measurement Calculation Engine (Chapter
 * III — Engineering Intelligence). It only structures identification,
 * intended formula, informed dimensions, an optional result and
 * traceability. It does not execute `formulaType`, does not compute
 * `result`, and does not resolve `sourceEvidenceIds` against any other
 * aggregate — those are explicitly out of scope for this sprint.
 */
export interface CalculationMemory {
  readonly id: CalculationMemoryId;
  readonly title: string;
  readonly description: string;
  readonly formulaType: CalculationFormulaType;
  readonly status: CalculationMemoryStatus;
  readonly dimensions: ReadonlyArray<MeasurementDimension>;
  readonly result: CalculationResult | null;
  readonly sourceEvidenceIds: ReadonlyArray<string>;
  readonly trace: ReadonlyArray<CalculationMemoryTrace>;
  readonly timeline: ReadonlyArray<CalculationMemoryTimelineEvent>;
  readonly metadata: MeasurementCalculationMetadata;
}

export interface CreateCalculationMemoryInput {
  readonly id: CalculationMemoryId;
  readonly title: string;
  readonly description: string;
  readonly formulaType: CalculationFormulaType;
  readonly dimensions?: ReadonlyArray<MeasurementDimensionInput> | null;
  readonly sourceEvidenceIds?: ReadonlyArray<string> | null;
  readonly actor: CalculationMemoryActor;
  readonly occurredAt: CalculationMemoryOccurredAt;
  readonly correlationId: CalculationMemoryCorrelationId;
  readonly createdBy: CalculationMemoryCreatedBy;
  readonly sourceSystem: CalculationMemorySourceSystem;
  readonly metadata?: MeasurementCalculationMetadata;
}

export interface AddMeasurementDimensionInput {
  readonly memory: CalculationMemory;
  readonly dimension: MeasurementDimensionInput;
  readonly actor: CalculationMemoryActor;
  readonly occurredAt: CalculationMemoryOccurredAt;
  readonly metadata?: MeasurementCalculationMetadata;
}

export interface RemoveMeasurementDimensionInput {
  readonly memory: CalculationMemory;
  readonly dimensionId: MeasurementDimensionId;
  readonly actor: CalculationMemoryActor;
  readonly occurredAt: CalculationMemoryOccurredAt;
  readonly metadata?: MeasurementCalculationMetadata;
}

export interface SetCalculationResultInput {
  readonly memory: CalculationMemory;
  readonly value: number;
  readonly unit: MeasurementUnit;
  readonly precision: number;
  readonly rounded: boolean;
  readonly actor: CalculationMemoryActor;
  readonly occurredAt: CalculationMemoryOccurredAt;
  readonly metadata?: MeasurementCalculationMetadata;
}

export interface AddCalculationSourceEvidenceInput {
  readonly memory: CalculationMemory;
  readonly sourceEvidenceId: string;
  readonly actor: CalculationMemoryActor;
  readonly occurredAt: CalculationMemoryOccurredAt;
  readonly metadata?: MeasurementCalculationMetadata;
}

export interface RemoveCalculationSourceEvidenceInput {
  readonly memory: CalculationMemory;
  readonly sourceEvidenceId: string;
  readonly actor: CalculationMemoryActor;
  readonly occurredAt: CalculationMemoryOccurredAt;
  readonly metadata?: MeasurementCalculationMetadata;
}

export interface LinkEvidenceToDimensionInput {
  readonly memory: CalculationMemory;
  readonly dimensionId: MeasurementDimensionId;
  readonly sourceEvidenceId: string;
  readonly actor: CalculationMemoryActor;
  readonly occurredAt: CalculationMemoryOccurredAt;
  readonly metadata?: MeasurementCalculationMetadata;
}

export interface UnlinkEvidenceFromDimensionInput {
  readonly memory: CalculationMemory;
  readonly dimensionId: MeasurementDimensionId;
  readonly sourceEvidenceId: string;
  readonly actor: CalculationMemoryActor;
  readonly occurredAt: CalculationMemoryOccurredAt;
  readonly metadata?: MeasurementCalculationMetadata;
}

export interface MarkCalculationMemoryReadyInput {
  readonly memory: CalculationMemory;
  readonly actor: CalculationMemoryActor;
  readonly occurredAt: CalculationMemoryOccurredAt;
  readonly metadata?: MeasurementCalculationMetadata;
}

export interface MarkCalculationMemoryCalculatedInput {
  readonly memory: CalculationMemory;
  readonly actor: CalculationMemoryActor;
  readonly occurredAt: CalculationMemoryOccurredAt;
  readonly metadata?: MeasurementCalculationMetadata;
}

export interface MarkCalculationMemoryReviewedInput {
  readonly memory: CalculationMemory;
  readonly actor: CalculationMemoryActor;
  readonly occurredAt: CalculationMemoryOccurredAt;
  readonly metadata?: MeasurementCalculationMetadata;
}

export interface ApproveCalculationMemoryInput {
  readonly memory: CalculationMemory;
  readonly actor: CalculationMemoryActor;
  readonly occurredAt: CalculationMemoryOccurredAt;
  readonly metadata?: MeasurementCalculationMetadata;
}

export interface RejectCalculationMemoryInput {
  readonly memory: CalculationMemory;
  readonly actor: CalculationMemoryActor;
  readonly occurredAt: CalculationMemoryOccurredAt;
  readonly metadata?: MeasurementCalculationMetadata;
}

export interface ArchiveCalculationMemoryInput {
  readonly memory: CalculationMemory;
  readonly actor: CalculationMemoryActor;
  readonly occurredAt: CalculationMemoryOccurredAt;
  readonly metadata?: MeasurementCalculationMetadata;
}

export type CalculationMemoryErrorCode =
  | "missing_id"
  | "missing_title"
  | "missing_description"
  | "missing_formula_type"
  | "missing_dimension_id"
  | "duplicate_dimension_id"
  | "missing_dimension_name"
  | "negative_dimension_value"
  | "missing_dimension_unit"
  | "dimension_not_found"
  | "duplicate_source_evidence_id"
  | "negative_result_value"
  | "missing_result_unit"
  | "invalid_result_precision"
  | "result_not_allowed_in_current_status"
  | "memory_terminal"
  | "invalid_calculation_memory_status_transition"
  | "memory_locked_for_dimension_changes"
  | "missing_source_evidence_id"
  | "source_evidence_id_not_found"
  | "source_evidence_still_linked"
  | "unknown_source_evidence_reference"
  | "duplicate_dimension_source_evidence_id"
  | "dimension_source_evidence_id_not_found"
  | "memory_locked_for_evidence_changes";

export interface CalculationMemoryError {
  readonly code: CalculationMemoryErrorCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: MeasurementCalculationMetadata;
}

export type CalculationMemoryWarningCode = "none";

export interface CalculationMemoryWarning {
  readonly code: CalculationMemoryWarningCode;
  readonly message: string;
  readonly field: string;
  readonly metadata: MeasurementCalculationMetadata;
}

export interface CalculationMemorySuccess {
  readonly success: true;
  readonly memory: CalculationMemory;
  readonly errors: ReadonlyArray<CalculationMemoryError>;
  readonly warnings: ReadonlyArray<CalculationMemoryWarning>;
  readonly metadata: MeasurementCalculationMetadata;
}

export interface CalculationMemoryFailure {
  readonly success: false;
  readonly memory: null;
  readonly errors: ReadonlyArray<CalculationMemoryError>;
  readonly warnings: ReadonlyArray<CalculationMemoryWarning>;
  readonly metadata: MeasurementCalculationMetadata;
}

export type CalculationMemoryResult = CalculationMemorySuccess | CalculationMemoryFailure;
