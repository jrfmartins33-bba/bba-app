/**
 * The first deterministic mathematical engine of BDOS. Executes the
 * formulas cataloged by `measurement-formula-catalog.ts` against a set of
 * `MeasurementDimension` values and returns a `CalculationResult` — it
 * never mutates a `CalculationMemory`, the Formula Catalog, or any other
 * aggregate (it is entirely stateless).
 *
 * Each formula listed under "IMPLEMENTAR NESTA SPRINT" has its own
 * dedicated, hand-written computation below — there is no expression
 * parser, no AST, no `eval`, no DSL, and no generic/reflective dispatch.
 * `computeFormula`'s `switch` is a closed, exhaustively-reviewable list of
 * cases; any `CalculationFormulaType` not listed there falls through to
 * `default` and is reported as `formula_not_yet_supported` — the engine
 * never fabricates a result for a formula it does not implement.
 *
 * Input resolution is by exact name: a `MeasurementDimension` feeds a
 * formula's required input when `dimension.name` equals the catalog
 * entry's `FormulaInputDefinition.key` (e.g. a dimension named "width"
 * feeds `area_rectangle`'s "width" input). This is a deliberate,
 * documented convention — not fuzzy matching, not positional inference —
 * so resolution stays fully deterministic and auditable.
 *
 * Sprint 13.4 (Calculation Steps & Audit Trail) enriched `CalculationStep`
 * with `kind`/`inputKeys`/`operator`/`unit`/`isFinal` — additive fields
 * only; `order`/`description`/`expression`/`value` and the number of
 * steps produced per formula are unchanged from Sprint 13.3, so no
 * existing behavior or step count changes. Every formula still produces
 * one `input`-kind step per required input followed by exactly one
 * `result`-kind step (`isFinal: true`) — the same single final step
 * Sprint 13.3 already produced, now explicitly labeled. The `operation`,
 * `validation` and `note` kinds are part of the vocabulary but are not
 * emitted by this engine this sprint (reserved for future use, same
 * forward-compatible-enum convention used elsewhere in this codebase).
 *
 * Sprint 13.8 (Civil Engineering Formula Expansion) implemented 12 more
 * formulas already present in the Formula Catalog since Sprint 13.2:
 * `volume_cylinder`, `volume_trapezoidal_prism`,
 * `cut_fill_volume_average_end_area`, `area_times_thickness`,
 * `asphalt_mass_from_area_thickness_density`, `concrete_volume`,
 * `mortar_volume`, `transport_volume`, `haulage_ton_km`,
 * `slope_percentage`, `level_difference`, `excavation_depth_average`.
 * `level_difference` and `slope_percentage` return an absolute value
 * (`Math.abs`) rather than a signed one: the general "resultado sempre
 * >= 0" rule is not changed this sprint, so a level drop (end below
 * start) is reported as its magnitude, not rejected as an invalid
 * negative result. `mortar_volume` reuses the same `area`/`thickness`
 * inputs cataloged in Sprint 13.2 (not `length`/`width`/`thickness`) —
 * this sprint edits only the engine and its test, not the catalog, so
 * the already-established input contract is honored as-is.
 *
 * Sprint 13.9 (Remaining Formula Completion) implemented the last 7
 * formulas: `rebar_weight_from_length`, `steel_weight_from_unit_weight`,
 * `formwork_area`, `pipe_length`, `drainage_channel_volume`,
 * `curb_length`, `interlocking_paver_area`. `formwork_area` uses the
 * catalog's `width`/`height` inputs (not `length`/`height`) and
 * `drainage_channel_volume` uses the catalog's `width`/`depth`/`length`
 * inputs (not `section_area`/`length`) — same reconciliation already
 * done for `mortar_volume` in Sprint 13.8: this sprint edits only the
 * engine and its test, never the catalog, so the input contracts
 * established in Sprint 13.2 are honored as-is (`width x depth` is
 * mathematically the same cross-section area the illustrative math
 * calls `section_area`).
 *
 * Every `CalculationFormulaType` enum member now has a `computeFormula`
 * case — `implementedFormulaTypes` covers all 31 cataloged formulas and
 * `supportsCalculationFormula` returns `true` for every one of them.
 * `formula_not_yet_supported` is no longer reachable through normal
 * catalog-backed usage; the `default` branch of the `switch` below and
 * the `entry === null` check in `executeCalculation` remain only as a
 * defensive guard against a `CalculationFormulaType` value that exists
 * at the type level but was never cataloged (structurally impossible
 * today, kept for safety).
 */
import { CalculationFormulaType } from "./measurement-calculation.types";
import type { MeasurementDimension, MeasurementUnit } from "./measurement-calculation.types";
import { findMeasurementFormulaCatalogEntry } from "./measurement-formula-catalog";
import type { MeasurementFormulaCatalogEntry } from "./measurement-formula-catalog";
import { freezeDomainObject } from "./measurement-calculation-shared";

export interface CalculationExecutionInput {
  readonly formulaType: CalculationFormulaType;
  readonly dimensions: ReadonlyArray<MeasurementDimension>;
}

/**
 * What role a `CalculationStep` plays in the audit trail. Only `Input`
 * and `Result` are produced this sprint — `Operation`, `Validation` and
 * `Note` are declared now so future engine work (compound multi-operator
 * formulas, failure explanations) has a settled vocabulary to grow into.
 */
export enum CalculationStepKind {
  Input = "input",
  Operation = "operation",
  Result = "result",
  Validation = "validation",
  Note = "note",
}

/**
 * The dominant arithmetic operator a step applies. For formulas that
 * combine more than one operator (e.g. `area_triangle` multiplies then
 * halves), the tag names the operation that best characterizes the step;
 * the exact arithmetic remains fully readable in `expression` regardless.
 */
export enum CalculationOperator {
  None = "none",
  Add = "add",
  Subtract = "subtract",
  Multiply = "multiply",
  Divide = "divide",
  Percentage = "percentage",
  Power = "power",
  Sqrt = "sqrt",
}

export interface CalculationStep {
  readonly order: number;
  readonly kind: CalculationStepKind;
  readonly description: string;
  readonly expression: string;
  readonly inputKeys: ReadonlyArray<string>;
  readonly operator: CalculationOperator;
  readonly value: number;
  readonly unit: MeasurementUnit;
  readonly isFinal: boolean;
}

export type CalculationExecutionWarningCode =
  | "formula_not_yet_supported"
  | "missing_required_input"
  | "negative_input_value"
  | "invalid_calculation_result";

export interface CalculationExecutionWarning {
  readonly code: CalculationExecutionWarningCode;
  readonly field: string;
  readonly message: string;
}

export interface CalculationExecutionResult {
  readonly result: {
    readonly value: number;
    readonly unit: MeasurementUnit;
    readonly precision: number;
    readonly rounded: boolean;
  } | null;
  readonly steps: ReadonlyArray<CalculationStep>;
  readonly warnings: ReadonlyArray<CalculationExecutionWarning>;
}

export interface CalculationExecutionSummary {
  readonly hasResult: boolean;
  readonly totalSteps: number;
  readonly totalWarnings: number;
  readonly resultValue: number | null;
  readonly resultUnit: MeasurementUnit | null;
}

interface FormulaComputation {
  readonly value: number;
  readonly description: string;
  readonly expression: string;
  readonly operator: CalculationOperator;
}

export function executeCalculation(input: CalculationExecutionInput): CalculationExecutionResult {
  const entry = findMeasurementFormulaCatalogEntry(input.formulaType);

  if (entry === null) {
    return failure(
      "formula_not_yet_supported",
      "formulaType",
      `Formula "${input.formulaType}" is not present in the Measurement Formula Catalog.`,
    );
  }

  const resolved = resolveRequiredInputs(entry, input.dimensions);

  if (resolved.warning !== null) {
    return failure(resolved.warning.code, resolved.warning.field, resolved.warning.message);
  }

  const computation = computeFormula(input.formulaType, resolved.values);

  if (computation === null) {
    return failure(
      "formula_not_yet_supported",
      "formulaType",
      `Formula "${input.formulaType}" (${entry.displayName}) is cataloged but not yet implemented by the Calculation Engine.`,
    );
  }

  if (!Number.isFinite(computation.value) || computation.value < 0) {
    return failure(
      "invalid_calculation_result",
      "result",
      `Formula "${input.formulaType}" produced an invalid (negative or non-finite) result.`,
    );
  }

  const steps = buildSteps(entry, resolved.values, computation);

  return freezeDomainObject<CalculationExecutionResult>({
    result: {
      value: computation.value,
      unit: entry.outputUnit,
      precision: decimalPrecisionOf(computation.value),
      rounded: false,
    },
    steps,
    warnings: [],
  });
}

/**
 * Whether the engine (not just the Formula Catalog) actually knows how
 * to compute `formulaType` today. Distinct from the catalog's own
 * `isSupportedCalculationFormulaType`: a formula can be cataloged
 * institutional knowledge (Sprint 13.2) without this engine implementing
 * it yet (Sprint 13.3 implements only 12 of the 31 cataloged formulas).
 */
export function supportsCalculationFormula(formulaType: CalculationFormulaType): boolean {
  return implementedFormulaTypes.has(formulaType);
}

export function summarizeCalculationExecution(result: CalculationExecutionResult): CalculationExecutionSummary {
  return {
    hasResult: result.result !== null,
    totalSteps: result.steps.length,
    totalWarnings: result.warnings.length,
    resultValue: result.result?.value ?? null,
    resultUnit: result.result?.unit ?? null,
  };
}

function failure(
  code: CalculationExecutionWarningCode,
  field: string,
  message: string,
): CalculationExecutionResult {
  return freezeDomainObject<CalculationExecutionResult>({
    result: null,
    steps: [],
    warnings: [{ code, field, message }],
  });
}

function resolveRequiredInputs(
  entry: MeasurementFormulaCatalogEntry,
  dimensions: ReadonlyArray<MeasurementDimension>,
): { values: Map<string, number>; warning: null } | { values: null; warning: CalculationExecutionWarning } {
  const values = new Map<string, number>();

  for (const requiredInput of entry.requiredInputs) {
    const dimension = dimensions.find((candidate) => candidate.name === requiredInput.key);

    if (dimension === undefined) {
      return {
        values: null,
        warning: {
          code: "missing_required_input",
          field: requiredInput.key,
          message: `Required input "${requiredInput.key}" (${requiredInput.label}) was not found among the provided dimensions.`,
        },
      };
    }

    if (dimension.value < 0) {
      return {
        values: null,
        warning: {
          code: "negative_input_value",
          field: requiredInput.key,
          message: `Input "${requiredInput.key}" (${requiredInput.label}) cannot be negative, got ${dimension.value}.`,
        },
      };
    }

    values.set(requiredInput.key, dimension.value);
  }

  return { values, warning: null };
}

function buildSteps(
  entry: MeasurementFormulaCatalogEntry,
  values: ReadonlyMap<string, number>,
  computation: FormulaComputation,
): CalculationStep[] {
  const steps: CalculationStep[] = [];
  let order = 1;

  entry.requiredInputs.forEach((requiredInput) => {
    const value = mustGet(values, requiredInput.key);
    steps.push({
      order: order++,
      kind: CalculationStepKind.Input,
      description: requiredInput.label,
      expression: `${requiredInput.label} = ${value}`,
      inputKeys: [requiredInput.key],
      operator: CalculationOperator.None,
      value,
      unit: requiredInput.unit,
      isFinal: false,
    });
  });

  steps.push({
    order: order++,
    kind: CalculationStepKind.Result,
    description: computation.description,
    expression: computation.expression,
    inputKeys: entry.requiredInputs.map((requiredInput) => requiredInput.key),
    operator: computation.operator,
    value: computation.value,
    unit: entry.outputUnit,
    isFinal: true,
  });

  return steps;
}

/**
 * The exhaustive, hand-written list of formulas this sprint implements.
 * Any `CalculationFormulaType` not handled by a `case` here falls through
 * to `default` (`null`), which `executeCalculation` reports as
 * `formula_not_yet_supported` — never a fabricated result.
 */
function computeFormula(
  formulaType: CalculationFormulaType,
  values: ReadonlyMap<string, number>,
): FormulaComputation | null {
  switch (formulaType) {
    case CalculationFormulaType.LinearQuantity: {
      const length = mustGet(values, "length");
      return {
        value: length,
        description: "Resultado = Comprimento",
        expression: `${length}`,
        operator: CalculationOperator.None,
      };
    }

    case CalculationFormulaType.AreaRectangle: {
      const width = mustGet(values, "width");
      const length = mustGet(values, "length");
      const value = width * length;
      return {
        value,
        description: "Area = Largura x Comprimento",
        expression: `${width} x ${length} = ${value}`,
        operator: CalculationOperator.Multiply,
      };
    }

    case CalculationFormulaType.AreaTriangle: {
      const base = mustGet(values, "base");
      const height = mustGet(values, "height");
      const value = (base * height) / 2;
      return {
        value,
        description: "Area = (Base x Altura) / 2",
        expression: `(${base} x ${height}) / 2 = ${value}`,
        operator: CalculationOperator.Multiply,
      };
    }

    case CalculationFormulaType.AreaTrapezoid: {
      const baseMajor = mustGet(values, "base_major");
      const baseMinor = mustGet(values, "base_minor");
      const height = mustGet(values, "height");
      const value = ((baseMajor + baseMinor) / 2) * height;
      return {
        value,
        description: "Area = ((Base Maior + Base Menor) / 2) x Altura",
        expression: `((${baseMajor} + ${baseMinor}) / 2) x ${height} = ${value}`,
        operator: CalculationOperator.Multiply,
      };
    }

    case CalculationFormulaType.AreaCircle: {
      const radius = mustGet(values, "radius");
      const value = Math.PI * radius * radius;
      return {
        value,
        description: "Area = PI x Raio x Raio",
        expression: `PI x ${radius} x ${radius} = ${value}`,
        operator: CalculationOperator.Power,
      };
    }

    case CalculationFormulaType.PerimeterRectangle: {
      const width = mustGet(values, "width");
      const length = mustGet(values, "length");
      const value = 2 * (width + length);
      return {
        value,
        description: "Perimetro = 2 x (Largura + Comprimento)",
        expression: `2 x (${width} + ${length}) = ${value}`,
        operator: CalculationOperator.Add,
      };
    }

    case CalculationFormulaType.VolumeBox: {
      const width = mustGet(values, "width");
      const height = mustGet(values, "height");
      const length = mustGet(values, "length");
      const value = width * height * length;
      return {
        value,
        description: "Volume = Largura x Altura x Comprimento",
        expression: `${width} x ${height} x ${length} = ${value}`,
        operator: CalculationOperator.Multiply,
      };
    }

    case CalculationFormulaType.MachineHours: {
      const startReading = mustGet(values, "start_reading");
      const endReading = mustGet(values, "end_reading");
      const value = endReading - startReading;
      return {
        value,
        description: "Horas Trabalhadas = Leitura Final - Leitura Inicial",
        expression: `${endReading} - ${startReading} = ${value}`,
        operator: CalculationOperator.Subtract,
      };
    }

    case CalculationFormulaType.VehicleTrips: {
      const tripCount = mustGet(values, "trip_count");
      return {
        value: tripCount,
        description: "Resultado = Quantidade de Viagens",
        expression: `${tripCount}`,
        operator: CalculationOperator.None,
      };
    }

    case CalculationFormulaType.SimpleQuantity: {
      const quantity = mustGet(values, "quantity");
      return {
        value: quantity,
        description: "Resultado = Quantidade",
        expression: `${quantity}`,
        operator: CalculationOperator.None,
      };
    }

    case CalculationFormulaType.PercentageOfTotal: {
      const partValue = mustGet(values, "part_value");
      const totalValue = mustGet(values, "total_value");
      const value = (partValue / totalValue) * 100;
      return {
        value,
        description: "Percentual = (Valor da Parte / Valor Total) x 100",
        expression: `(${partValue} / ${totalValue}) x 100 = ${value}`,
        operator: CalculationOperator.Percentage,
      };
    }

    case CalculationFormulaType.WeightedProgress: {
      const physicalProgressPercent = mustGet(values, "physical_progress_percent");
      const itemWeightPercent = mustGet(values, "item_weight_percent");
      const value = physicalProgressPercent * (itemWeightPercent / 100);
      return {
        value,
        description: "Avanco Ponderado = Percentual Executado x (Peso Relativo / 100)",
        expression: `${physicalProgressPercent} x (${itemWeightPercent} / 100) = ${value}`,
        operator: CalculationOperator.Percentage,
      };
    }

    case CalculationFormulaType.VolumeCylinder: {
      const radius = mustGet(values, "radius");
      const height = mustGet(values, "height");
      const value = Math.PI * radius * radius * height;
      return {
        value,
        description: "Volume = PI x Raio x Raio x Altura",
        expression: `PI x ${radius} x ${radius} x ${height} = ${value}`,
        operator: CalculationOperator.Power,
      };
    }

    case CalculationFormulaType.VolumeTrapezoidalPrism: {
      const baseMajor = mustGet(values, "base_major");
      const baseMinor = mustGet(values, "base_minor");
      const height = mustGet(values, "height");
      const length = mustGet(values, "length");
      const value = ((baseMajor + baseMinor) / 2) * height * length;
      return {
        value,
        description: "Volume = ((Base Maior + Base Menor) / 2) x Altura x Comprimento",
        expression: `((${baseMajor} + ${baseMinor}) / 2) x ${height} x ${length} = ${value}`,
        operator: CalculationOperator.Multiply,
      };
    }

    case CalculationFormulaType.CutFillVolumeAverageEndArea: {
      const startSectionArea = mustGet(values, "start_section_area");
      const endSectionArea = mustGet(values, "end_section_area");
      const distance = mustGet(values, "distance");
      const value = ((startSectionArea + endSectionArea) / 2) * distance;
      return {
        value,
        description: "Volume = ((Area da Secao Inicial + Area da Secao Final) / 2) x Distancia",
        expression: `((${startSectionArea} + ${endSectionArea}) / 2) x ${distance} = ${value}`,
        operator: CalculationOperator.Multiply,
      };
    }

    case CalculationFormulaType.AreaTimesThickness: {
      const area = mustGet(values, "area");
      const thickness = mustGet(values, "thickness");
      const value = area * thickness;
      return {
        value,
        description: "Volume = Area x Espessura",
        expression: `${area} x ${thickness} = ${value}`,
        operator: CalculationOperator.Multiply,
      };
    }

    case CalculationFormulaType.AsphaltMassFromAreaThicknessDensity: {
      const area = mustGet(values, "area");
      const thickness = mustGet(values, "thickness");
      const density = mustGet(values, "density");
      const value = area * thickness * density;
      return {
        value,
        description: "Massa = Area x Espessura x Densidade",
        expression: `${area} x ${thickness} x ${density} = ${value}`,
        operator: CalculationOperator.Multiply,
      };
    }

    case CalculationFormulaType.ConcreteVolume: {
      const width = mustGet(values, "width");
      const height = mustGet(values, "height");
      const length = mustGet(values, "length");
      const value = width * height * length;
      return {
        value,
        description: "Volume = Largura x Altura x Comprimento",
        expression: `${width} x ${height} x ${length} = ${value}`,
        operator: CalculationOperator.Multiply,
      };
    }

    case CalculationFormulaType.MortarVolume: {
      const area = mustGet(values, "area");
      const thickness = mustGet(values, "thickness");
      const value = area * thickness;
      return {
        value,
        description: "Volume = Area x Espessura",
        expression: `${area} x ${thickness} = ${value}`,
        operator: CalculationOperator.Multiply,
      };
    }

    case CalculationFormulaType.TransportVolume: {
      const tripCount = mustGet(values, "trip_count");
      const volumePerTrip = mustGet(values, "volume_per_trip");
      const value = tripCount * volumePerTrip;
      return {
        value,
        description: "Volume Transportado = Quantidade de Viagens x Volume por Viagem",
        expression: `${tripCount} x ${volumePerTrip} = ${value}`,
        operator: CalculationOperator.Multiply,
      };
    }

    case CalculationFormulaType.HaulageTonKm: {
      const weight = mustGet(values, "weight");
      const distanceKm = mustGet(values, "distance_km");
      const value = weight * distanceKm;
      return {
        value,
        description: "Indicador = Peso Transportado x Distancia Percorrida",
        expression: `${weight} x ${distanceKm} = ${value}`,
        operator: CalculationOperator.Multiply,
      };
    }

    case CalculationFormulaType.SlopePercentage: {
      const levelDifference = mustGet(values, "level_difference");
      const horizontalDistance = mustGet(values, "horizontal_distance");
      const absoluteLevelDifference = Math.abs(levelDifference);
      const value = (absoluteLevelDifference / horizontalDistance) * 100;
      return {
        value,
        description: "Declividade = ( |Desnivel| / Distancia Horizontal ) x 100",
        expression: `(${absoluteLevelDifference} / ${horizontalDistance}) x 100 = ${value}`,
        operator: CalculationOperator.Percentage,
      };
    }

    case CalculationFormulaType.LevelDifference: {
      const startElevation = mustGet(values, "start_elevation");
      const endElevation = mustGet(values, "end_elevation");
      const value = Math.abs(endElevation - startElevation);
      return {
        value,
        description: "Desnivel = |Cota Final - Cota Inicial|",
        expression: `|${endElevation} - ${startElevation}| = ${value}`,
        operator: CalculationOperator.Subtract,
      };
    }

    case CalculationFormulaType.ExcavationDepthAverage: {
      const startDepth = mustGet(values, "start_depth");
      const endDepth = mustGet(values, "end_depth");
      const value = (startDepth + endDepth) / 2;
      return {
        value,
        description: "Profundidade Media = (Profundidade Inicial + Profundidade Final) / 2",
        expression: `(${startDepth} + ${endDepth}) / 2 = ${value}`,
        operator: CalculationOperator.Add,
      };
    }

    case CalculationFormulaType.RebarWeightFromLength: {
      const length = mustGet(values, "length");
      const unitWeight = mustGet(values, "unit_weight");
      const value = length * unitWeight;
      return {
        value,
        description: "Peso = Comprimento Total x Peso Unitario",
        expression: `${length} x ${unitWeight} = ${value}`,
        operator: CalculationOperator.Multiply,
      };
    }

    case CalculationFormulaType.SteelWeightFromUnitWeight: {
      const quantity = mustGet(values, "quantity");
      const unitWeight = mustGet(values, "unit_weight");
      const value = quantity * unitWeight;
      return {
        value,
        description: "Peso = Quantidade de Pecas x Peso Unitario",
        expression: `${quantity} x ${unitWeight} = ${value}`,
        operator: CalculationOperator.Multiply,
      };
    }

    case CalculationFormulaType.FormworkArea: {
      const width = mustGet(values, "width");
      const height = mustGet(values, "height");
      const value = width * height;
      return {
        value,
        description: "Area = Largura x Altura",
        expression: `${width} x ${height} = ${value}`,
        operator: CalculationOperator.Multiply,
      };
    }

    case CalculationFormulaType.PipeLength: {
      const length = mustGet(values, "length");
      return {
        value: length,
        description: "Resultado = Comprimento",
        expression: `${length}`,
        operator: CalculationOperator.None,
      };
    }

    case CalculationFormulaType.DrainageChannelVolume: {
      const width = mustGet(values, "width");
      const depth = mustGet(values, "depth");
      const length = mustGet(values, "length");
      const value = width * depth * length;
      return {
        value,
        description: "Volume = Largura x Profundidade x Comprimento",
        expression: `${width} x ${depth} x ${length} = ${value}`,
        operator: CalculationOperator.Multiply,
      };
    }

    case CalculationFormulaType.CurbLength: {
      const length = mustGet(values, "length");
      return {
        value: length,
        description: "Resultado = Comprimento",
        expression: `${length}`,
        operator: CalculationOperator.None,
      };
    }

    case CalculationFormulaType.InterlockingPaverArea: {
      const width = mustGet(values, "width");
      const length = mustGet(values, "length");
      const value = width * length;
      return {
        value,
        description: "Area = Largura x Comprimento",
        expression: `${width} x ${length} = ${value}`,
        operator: CalculationOperator.Multiply,
      };
    }

    default:
      // Defensive guard only: every `CalculationFormulaType` enum member
      // has a `case` above as of Sprint 13.9. This branch is unreachable
      // through normal catalog-backed usage — it exists solely to avoid
      // fabricating a result if a future enum member is ever added here
      // without a matching implementation.
      return null;
  }
}

const implementedFormulaTypes: ReadonlySet<string> = new Set([
  "linear_quantity",
  "area_rectangle",
  "area_triangle",
  "area_trapezoid",
  "area_circle",
  "perimeter_rectangle",
  "volume_box",
  "machine_hours",
  "vehicle_trips",
  "simple_quantity",
  "percentage_of_total",
  "weighted_progress",
  "volume_cylinder",
  "volume_trapezoidal_prism",
  "cut_fill_volume_average_end_area",
  "area_times_thickness",
  "asphalt_mass_from_area_thickness_density",
  "concrete_volume",
  "mortar_volume",
  "transport_volume",
  "haulage_ton_km",
  "slope_percentage",
  "level_difference",
  "excavation_depth_average",
  "rebar_weight_from_length",
  "steel_weight_from_unit_weight",
  "formwork_area",
  "pipe_length",
  "drainage_channel_volume",
  "curb_length",
  "interlocking_paver_area",
]);

function mustGet(values: ReadonlyMap<string, number>, key: string): number {
  const value = values.get(key);

  if (value === undefined) {
    throw new Error(`Internal error: expected resolved input "${key}" to be present.`);
  }

  return value;
}

function decimalPrecisionOf(value: number): number {
  const stringValue = value.toString();
  const decimalIndex = stringValue.indexOf(".");
  return decimalIndex === -1 ? 0 : stringValue.length - decimalIndex - 1;
}
