declare const process: { cwd(): string };

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CalculationFormulaType,
  CalculationOperator,
  CalculationStepKind,
  buildCalculationAuditTrail,
  executeCalculation,
  findMeasurementFormulaCatalogEntry,
  getMeasurementFormulaCatalog,
  isCalculationReconstructable,
  MeasurementUnit,
  summarizeCalculationExecution,
  supportsCalculationFormula,
  validateCalculationExecution,
  type MeasurementDimension,
} from "./index";

runTest("supportsCalculationFormula recognizes the 12 formulas implemented this sprint", () => {
  [
    CalculationFormulaType.LinearQuantity,
    CalculationFormulaType.AreaRectangle,
    CalculationFormulaType.AreaTriangle,
    CalculationFormulaType.AreaTrapezoid,
    CalculationFormulaType.AreaCircle,
    CalculationFormulaType.PerimeterRectangle,
    CalculationFormulaType.VolumeBox,
    CalculationFormulaType.MachineHours,
    CalculationFormulaType.VehicleTrips,
    CalculationFormulaType.SimpleQuantity,
    CalculationFormulaType.PercentageOfTotal,
    CalculationFormulaType.WeightedProgress,
  ].forEach((formulaType) => {
    assertEqual(supportsCalculationFormula(formulaType), true, `expected ${formulaType} to be supported`);
  });
});

runTest("recognizes the 12 additional formulas implemented in Sprint 13.8", () => {
  [
    CalculationFormulaType.VolumeCylinder,
    CalculationFormulaType.VolumeTrapezoidalPrism,
    CalculationFormulaType.CutFillVolumeAverageEndArea,
    CalculationFormulaType.AreaTimesThickness,
    CalculationFormulaType.AsphaltMassFromAreaThicknessDensity,
    CalculationFormulaType.ConcreteVolume,
    CalculationFormulaType.MortarVolume,
    CalculationFormulaType.TransportVolume,
    CalculationFormulaType.HaulageTonKm,
    CalculationFormulaType.SlopePercentage,
    CalculationFormulaType.LevelDifference,
    CalculationFormulaType.ExcavationDepthAverage,
  ].forEach((formulaType) => {
    assertEqual(supportsCalculationFormula(formulaType), true, `expected ${formulaType} to be supported`);
  });
});

runTest("recognizes the 7 final formulas implemented in Sprint 13.9", () => {
  [
    CalculationFormulaType.RebarWeightFromLength,
    CalculationFormulaType.SteelWeightFromUnitWeight,
    CalculationFormulaType.FormworkArea,
    CalculationFormulaType.PipeLength,
    CalculationFormulaType.DrainageChannelVolume,
    CalculationFormulaType.CurbLength,
    CalculationFormulaType.InterlockingPaverArea,
  ].forEach((formulaType) => {
    assertEqual(supportsCalculationFormula(formulaType), true, `expected ${formulaType} to be supported`);
  });
});

runTest("supportsCalculationFormula returns true for every formula in the Formula Catalog (100% coverage)", () => {
  const catalog = getMeasurementFormulaCatalog();

  assertEqual(catalog.length, Object.values(CalculationFormulaType).length, "catalog must cover the full enum");

  catalog.forEach((entry) => {
    assertEqual(
      supportsCalculationFormula(entry.formulaType),
      true,
      `expected ${entry.formulaType} to be supported after Sprint 13.9`,
    );
  });
});

runTest("no cataloged formula returns formula_not_yet_supported anymore", () => {
  const catalog = getMeasurementFormulaCatalog();

  catalog.forEach((entry) => {
    const result = executeCalculation({
      formulaType: entry.formulaType,
      dimensions: entry.requiredInputs.map((input) => dimension(input.key, 1, input.unit)),
    });

    assertEqual(
      result.warnings.some((warning) => warning.code === "formula_not_yet_supported"),
      false,
      `expected ${entry.formulaType} to no longer report formula_not_yet_supported`,
    );
    assertEqual(result.result !== null, true, `expected ${entry.formulaType} to produce a result`);
  });
});

runTest("linear_quantity computes the informed length directly", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.LinearQuantity,
    dimensions: [dimension("length", 500, MeasurementUnit.Meter)],
  });

  assertEqual(result.result?.value, 500, "value mismatch");
  assertEqual(result.result?.unit, MeasurementUnit.Meter, "unit mismatch");
  assertEqual(result.result?.rounded, false, "rounded must be false (no arbitrary rounding)");
  assertEqual(result.steps.length, 2, "expected one input step and one result step");
});

runTest("area_rectangle: largura x comprimento (matches the spec's own worked example)", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.AreaRectangle,
    dimensions: [dimension("width", 4, MeasurementUnit.Meter), dimension("length", 500, MeasurementUnit.Meter)],
  });

  assertEqual(result.result?.value, 2000, "expected 4 x 500 = 2000");
  assertEqual(result.result?.unit, MeasurementUnit.SquareMeter, "expected m2 output unit");
  assertEqual(result.steps.length, 3, "expected 2 input steps + 1 result step");
  assertEqual(result.steps[0]?.order, 1, "step 1 order mismatch");
  assertEqual(result.steps[0]?.value, 4, "step 1 (width) value mismatch");
  assertEqual(result.steps[1]?.order, 2, "step 2 order mismatch");
  assertEqual(result.steps[1]?.value, 500, "step 2 (length) value mismatch");
  assertEqual(result.steps[2]?.order, 3, "step 3 order mismatch");
  assertEqual(result.steps[2]?.value, 2000, "step 3 (result) value mismatch");
  assertEqual(result.steps[2]?.expression.includes("2000"), true, "final expression should show the result value");
});

runTest("area_rectangle steps carry kind, inputKeys, operator, unit and isFinal (Sprint 13.4)", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.AreaRectangle,
    dimensions: [dimension("width", 4, MeasurementUnit.Meter), dimension("length", 500, MeasurementUnit.Meter)],
  });

  assertEqual(result.steps[0]?.kind, CalculationStepKind.Input, "step 1 kind mismatch");
  assertEqual(result.steps[0]?.inputKeys.length, 1, "step 1 inputKeys length mismatch");
  assertEqual(result.steps[0]?.inputKeys[0], "width", "step 1 inputKeys content mismatch");
  assertEqual(result.steps[0]?.operator, CalculationOperator.None, "input steps carry no operator");
  assertEqual(result.steps[0]?.unit, MeasurementUnit.Meter, "step 1 unit mismatch");
  assertEqual(result.steps[0]?.isFinal, false, "input step must not be final");

  assertEqual(result.steps[1]?.kind, CalculationStepKind.Input, "step 2 kind mismatch");
  assertEqual(result.steps[1]?.isFinal, false, "second input step must not be final");

  assertEqual(result.steps[2]?.kind, CalculationStepKind.Result, "final step kind mismatch");
  assertEqual(result.steps[2]?.inputKeys.length, 2, "final step inputKeys must list every required input");
  assertEqual(result.steps[2]?.inputKeys.includes("width"), true, "final step inputKeys missing width");
  assertEqual(result.steps[2]?.inputKeys.includes("length"), true, "final step inputKeys missing length");
  assertEqual(result.steps[2]?.operator, CalculationOperator.Multiply, "final step operator mismatch");
  assertEqual(result.steps[2]?.unit, MeasurementUnit.SquareMeter, "final step unit must match the output unit");
  assertEqual(result.steps[2]?.isFinal, true, "final step must be final");

  const finalSteps = result.steps.filter((step) => step.isFinal);
  assertEqual(finalSteps.length, 1, "exactly one step must be final");
});

runTest("machine_hours final step is tagged with the Subtract operator", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.MachineHours,
    dimensions: [
      dimension("start_reading", 100, MeasurementUnit.Hour),
      dimension("end_reading", 150, MeasurementUnit.Hour),
    ],
  });

  const finalStep = result.steps[result.steps.length - 1];
  assertEqual(finalStep?.operator, CalculationOperator.Subtract, "expected Subtract operator for machine_hours");
  assertEqual(finalStep?.isFinal, true, "last step must be final");
});

runTest("percentage_of_total final step is tagged with the Percentage operator", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.PercentageOfTotal,
    dimensions: [dimension("part_value", 25, MeasurementUnit.Unit), dimension("total_value", 200, MeasurementUnit.Unit)],
  });

  const finalStep = result.steps[result.steps.length - 1];
  assertEqual(finalStep?.operator, CalculationOperator.Percentage, "expected Percentage operator");
});

runTest("area_triangle: (base x altura) / 2", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.AreaTriangle,
    dimensions: [dimension("base", 10, MeasurementUnit.Meter), dimension("height", 4, MeasurementUnit.Meter)],
  });

  assertEqual(result.result?.value, 20, "expected (10 x 4) / 2 = 20");
  assertEqual(result.result?.unit, MeasurementUnit.SquareMeter, "unit mismatch");
});

runTest("area_trapezoid: ((base maior + base menor) / 2) x altura", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.AreaTrapezoid,
    dimensions: [
      dimension("base_major", 10, MeasurementUnit.Meter),
      dimension("base_minor", 6, MeasurementUnit.Meter),
      dimension("height", 4, MeasurementUnit.Meter),
    ],
  });

  assertEqual(result.result?.value, 32, "expected ((10 + 6) / 2) x 4 = 32");
});

runTest("area_circle: PI x raio x raio", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.AreaCircle,
    dimensions: [dimension("radius", 2, MeasurementUnit.Meter)],
  });

  assertEqual(result.result?.value, Math.PI * 4, "expected PI x 2 x 2");
  assertEqual(result.result?.unit, MeasurementUnit.SquareMeter, "unit mismatch");
});

runTest("perimeter_rectangle: 2 x (largura + comprimento)", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.PerimeterRectangle,
    dimensions: [dimension("width", 4, MeasurementUnit.Meter), dimension("length", 500, MeasurementUnit.Meter)],
  });

  assertEqual(result.result?.value, 1008, "expected 2 x (4 + 500) = 1008");
  assertEqual(result.result?.unit, MeasurementUnit.Meter, "unit mismatch");
});

runTest("volume_box: largura x altura x comprimento", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.VolumeBox,
    dimensions: [
      dimension("width", 2, MeasurementUnit.Meter),
      dimension("height", 3, MeasurementUnit.Meter),
      dimension("length", 5, MeasurementUnit.Meter),
    ],
  });

  assertEqual(result.result?.value, 30, "expected 2 x 3 x 5 = 30");
  assertEqual(result.result?.unit, MeasurementUnit.CubicMeter, "unit mismatch");
});

runTest("machine_hours: leitura final - leitura inicial", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.MachineHours,
    dimensions: [
      dimension("start_reading", 100, MeasurementUnit.Hour),
      dimension("end_reading", 150, MeasurementUnit.Hour),
    ],
  });

  assertEqual(result.result?.value, 50, "expected 150 - 100 = 50");
  assertEqual(result.result?.unit, MeasurementUnit.Hour, "unit mismatch");
});

runTest("machine_hours rejects a result that would be negative (end before start)", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.MachineHours,
    dimensions: [
      dimension("start_reading", 150, MeasurementUnit.Hour),
      dimension("end_reading", 100, MeasurementUnit.Hour),
    ],
  });

  assertEqual(result.result, null, "expected null result for an invalid negative calculation");
  assertEqual(result.warnings[0]?.code, "invalid_calculation_result", "expected invalid_calculation_result warning");
});

runTest("vehicle_trips returns the informed trip count directly", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.VehicleTrips,
    dimensions: [dimension("trip_count", 12, MeasurementUnit.Trip)],
  });

  assertEqual(result.result?.value, 12, "value mismatch");
  assertEqual(result.result?.unit, MeasurementUnit.Trip, "unit mismatch");
});

runTest("simple_quantity returns the informed quantity directly", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.SimpleQuantity,
    dimensions: [dimension("quantity", 7, MeasurementUnit.Unit)],
  });

  assertEqual(result.result?.value, 7, "value mismatch");
  assertEqual(result.result?.unit, MeasurementUnit.Unit, "unit mismatch");
});

runTest("percentage_of_total: (parte / total) x 100", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.PercentageOfTotal,
    dimensions: [dimension("part_value", 25, MeasurementUnit.Unit), dimension("total_value", 200, MeasurementUnit.Unit)],
  });

  assertEqual(result.result?.value, 12.5, "expected (25 / 200) x 100 = 12.5");
  assertEqual(result.result?.unit, MeasurementUnit.Percent, "unit mismatch");
  assertEqual(result.result?.precision, 1, "expected precision of 1 decimal place for 12.5");
});

runTest("percentage_of_total rejects a zero total (division by zero produces a non-finite result)", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.PercentageOfTotal,
    dimensions: [dimension("part_value", 25, MeasurementUnit.Unit), dimension("total_value", 0, MeasurementUnit.Unit)],
  });

  assertEqual(result.result, null, "expected null result for a non-finite computation");
  assertEqual(result.warnings[0]?.code, "invalid_calculation_result", "expected invalid_calculation_result warning");
});

runTest("weighted_progress: percentual executado x (peso relativo / 100)", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.WeightedProgress,
    dimensions: [
      dimension("physical_progress_percent", 80, MeasurementUnit.Percent),
      dimension("item_weight_percent", 50, MeasurementUnit.Percent),
    ],
  });

  assertEqual(result.result?.value, 40, "expected 80 x (50 / 100) = 40");
  assertEqual(result.result?.unit, MeasurementUnit.Percent, "unit mismatch");
});

runTest("volume_cylinder: PI x raio x raio x altura", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.VolumeCylinder,
    dimensions: [dimension("radius", 2, MeasurementUnit.Meter), dimension("height", 5, MeasurementUnit.Meter)],
  });

  assertEqual(result.result?.value, Math.PI * 2 * 2 * 5, "expected PI x 2 x 2 x 5");
  assertEqual(result.result?.unit, MeasurementUnit.CubicMeter, "unit mismatch");
  assertEqual(result.steps.length, 3, "expected 2 input steps + 1 result step");
  assertEqual(result.steps[2]?.isFinal, true, "final step must be final");
});

runTest("volume_trapezoidal_prism: ((base maior + base menor) / 2) x altura x comprimento", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.VolumeTrapezoidalPrism,
    dimensions: [
      dimension("base_major", 10, MeasurementUnit.Meter),
      dimension("base_minor", 6, MeasurementUnit.Meter),
      dimension("height", 4, MeasurementUnit.Meter),
      dimension("length", 3, MeasurementUnit.Meter),
    ],
  });

  assertEqual(result.result?.value, 96, "expected ((10 + 6) / 2) x 4 x 3 = 96");
  assertEqual(result.result?.unit, MeasurementUnit.CubicMeter, "unit mismatch");
  assertEqual(result.steps.length, 5, "expected 4 input steps + 1 result step");
});

runTest("cut_fill_volume_average_end_area: ((area inicial + area final) / 2) x distancia", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.CutFillVolumeAverageEndArea,
    dimensions: [
      dimension("start_section_area", 20, MeasurementUnit.SquareMeter),
      dimension("end_section_area", 30, MeasurementUnit.SquareMeter),
      dimension("distance", 10, MeasurementUnit.Meter),
    ],
  });

  assertEqual(result.result?.value, 250, "expected ((20 + 30) / 2) x 10 = 250");
  assertEqual(result.result?.unit, MeasurementUnit.CubicMeter, "unit mismatch");
});

runTest("area_times_thickness: area x espessura", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.AreaTimesThickness,
    dimensions: [dimension("area", 50, MeasurementUnit.SquareMeter), dimension("thickness", 0.2, MeasurementUnit.Meter)],
  });

  assertEqual(result.result?.value, 10, "expected 50 x 0.2 = 10");
  assertEqual(result.result?.unit, MeasurementUnit.CubicMeter, "unit mismatch");
});

runTest("asphalt_mass_from_area_thickness_density: area x espessura x densidade", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.AsphaltMassFromAreaThicknessDensity,
    dimensions: [
      dimension("area", 100, MeasurementUnit.SquareMeter),
      dimension("thickness", 0.05, MeasurementUnit.Meter),
      dimension("density", 2.4, MeasurementUnit.Ton),
    ],
  });

  assertEqual(result.result?.value, 12, "expected 100 x 0.05 x 2.4 = 12");
  assertEqual(result.result?.unit, MeasurementUnit.Ton, "unit mismatch");
});

runTest("concrete_volume: largura x altura x comprimento", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.ConcreteVolume,
    dimensions: [
      dimension("width", 2, MeasurementUnit.Meter),
      dimension("height", 3, MeasurementUnit.Meter),
      dimension("length", 4, MeasurementUnit.Meter),
    ],
  });

  assertEqual(result.result?.value, 24, "expected 2 x 3 x 4 = 24");
  assertEqual(result.result?.unit, MeasurementUnit.CubicMeter, "unit mismatch");
});

runTest("mortar_volume: area x espessura", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.MortarVolume,
    dimensions: [dimension("area", 10, MeasurementUnit.SquareMeter), dimension("thickness", 0.02, MeasurementUnit.Meter)],
  });

  assertEqual(result.result?.value, 0.2, "expected 10 x 0.02 = 0.2");
  assertEqual(result.result?.unit, MeasurementUnit.CubicMeter, "unit mismatch");
});

runTest("transport_volume: quantidade de viagens x volume por viagem", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.TransportVolume,
    dimensions: [dimension("trip_count", 5, MeasurementUnit.Trip), dimension("volume_per_trip", 8, MeasurementUnit.CubicMeter)],
  });

  assertEqual(result.result?.value, 40, "expected 5 x 8 = 40");
  assertEqual(result.result?.unit, MeasurementUnit.CubicMeter, "unit mismatch");
});

runTest("haulage_ton_km: peso transportado x distancia percorrida", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.HaulageTonKm,
    dimensions: [dimension("weight", 10, MeasurementUnit.Ton), dimension("distance_km", 25, MeasurementUnit.Meter)],
  });

  assertEqual(result.result?.value, 250, "expected 10 x 25 = 250");
  assertEqual(result.result?.unit, MeasurementUnit.Ton, "unit mismatch");
});

runTest("slope_percentage: ( |desnivel| / distancia horizontal ) x 100", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.SlopePercentage,
    dimensions: [
      dimension("level_difference", 5, MeasurementUnit.Meter),
      dimension("horizontal_distance", 100, MeasurementUnit.Meter),
    ],
  });

  assertEqual(result.result?.value, 5, "expected (5 / 100) x 100 = 5");
  assertEqual(result.result?.unit, MeasurementUnit.Percent, "unit mismatch");
});

runTest("slope_percentage rejects a zero horizontal_distance (division by zero)", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.SlopePercentage,
    dimensions: [
      dimension("level_difference", 5, MeasurementUnit.Meter),
      dimension("horizontal_distance", 0, MeasurementUnit.Meter),
    ],
  });

  assertEqual(result.result, null, "expected null result for a non-finite computation");
  assertEqual(result.warnings[0]?.code, "invalid_calculation_result", "expected invalid_calculation_result warning");
});

runTest("level_difference: |cota final - cota inicial| (result is always non-negative)", () => {
  const ascending = executeCalculation({
    formulaType: CalculationFormulaType.LevelDifference,
    dimensions: [
      dimension("start_elevation", 95, MeasurementUnit.Meter),
      dimension("end_elevation", 100, MeasurementUnit.Meter),
    ],
  });
  assertEqual(ascending.result?.value, 5, "expected |100 - 95| = 5");

  const descending = executeCalculation({
    formulaType: CalculationFormulaType.LevelDifference,
    dimensions: [
      dimension("start_elevation", 100, MeasurementUnit.Meter),
      dimension("end_elevation", 95, MeasurementUnit.Meter),
    ],
  });
  assertEqual(descending.result?.value, 5, "expected |95 - 100| = 5 (absolute value, never negative)");
  assertEqual(descending.result !== null && descending.result.value >= 0, true, "result must never be negative");
  assertEqual(descending.result?.unit, MeasurementUnit.Meter, "unit mismatch");
});

runTest("excavation_depth_average: (profundidade inicial + profundidade final) / 2", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.ExcavationDepthAverage,
    dimensions: [
      dimension("start_depth", 2, MeasurementUnit.Meter),
      dimension("end_depth", 4, MeasurementUnit.Meter),
    ],
  });

  assertEqual(result.result?.value, 3, "expected (2 + 4) / 2 = 3");
  assertEqual(result.result?.unit, MeasurementUnit.Meter, "unit mismatch");
});

runTest("rebar_weight_from_length: comprimento total x peso unitario", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.RebarWeightFromLength,
    dimensions: [dimension("length", 12, MeasurementUnit.Meter), dimension("unit_weight", 0.617, MeasurementUnit.Kilogram)],
  });

  assertEqual(result.result?.value, 12 * 0.617, "expected 12 x 0.617");
  assertEqual(result.result?.unit, MeasurementUnit.Kilogram, "unit mismatch");
  assertEqual(result.steps.length, 3, "expected 2 input steps + 1 result step");
  assertEqual(result.steps[2]?.isFinal, true, "final step must be final");
});

runTest("steel_weight_from_unit_weight: quantidade de pecas x peso unitario", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.SteelWeightFromUnitWeight,
    dimensions: [dimension("quantity", 50, MeasurementUnit.Unit), dimension("unit_weight", 2.5, MeasurementUnit.Kilogram)],
  });

  assertEqual(result.result?.value, 125, "expected 50 x 2.5 = 125");
  assertEqual(result.result?.unit, MeasurementUnit.Kilogram, "unit mismatch");
});

runTest("formwork_area: largura x altura", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.FormworkArea,
    dimensions: [dimension("width", 3, MeasurementUnit.Meter), dimension("height", 2.5, MeasurementUnit.Meter)],
  });

  assertEqual(result.result?.value, 7.5, "expected 3 x 2.5 = 7.5");
  assertEqual(result.result?.unit, MeasurementUnit.SquareMeter, "unit mismatch");
});

runTest("pipe_length returns the informed length directly", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.PipeLength,
    dimensions: [dimension("length", 42, MeasurementUnit.Meter)],
  });

  assertEqual(result.result?.value, 42, "value mismatch");
  assertEqual(result.result?.unit, MeasurementUnit.Meter, "unit mismatch");
  assertEqual(result.steps.length, 2, "expected 1 input step + 1 result step");
});

runTest("drainage_channel_volume: largura x profundidade x comprimento", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.DrainageChannelVolume,
    dimensions: [
      dimension("width", 1, MeasurementUnit.Meter),
      dimension("depth", 0.5, MeasurementUnit.Meter),
      dimension("length", 20, MeasurementUnit.Meter),
    ],
  });

  assertEqual(result.result?.value, 10, "expected 1 x 0.5 x 20 = 10");
  assertEqual(result.result?.unit, MeasurementUnit.CubicMeter, "unit mismatch");
});

runTest("curb_length returns the informed length directly", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.CurbLength,
    dimensions: [dimension("length", 75, MeasurementUnit.Meter)],
  });

  assertEqual(result.result?.value, 75, "value mismatch");
  assertEqual(result.result?.unit, MeasurementUnit.Meter, "unit mismatch");
});

runTest("interlocking_paver_area: largura x comprimento", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.InterlockingPaverArea,
    dimensions: [dimension("width", 4, MeasurementUnit.Meter), dimension("length", 6, MeasurementUnit.Meter)],
  });

  assertEqual(result.result?.value, 24, "expected 4 x 6 = 24");
  assertEqual(result.result?.unit, MeasurementUnit.SquareMeter, "unit mismatch");
});

runTest("Sprint 13.9 formulas reject a missing required input", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.RebarWeightFromLength,
    dimensions: [dimension("length", 12, MeasurementUnit.Meter)],
  });

  assertEqual(result.result, null, "expected null result on missing input");
  assertEqual(result.warnings[0]?.code, "missing_required_input", "expected missing_required_input warning");
  assertEqual(result.warnings[0]?.field, "unit_weight", "expected the missing field to be identified");
});

runTest("Sprint 13.9 formulas reject a negative input value", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.FormworkArea,
    dimensions: [dimension("width", -1, MeasurementUnit.Meter), dimension("height", 2, MeasurementUnit.Meter)],
  });

  assertEqual(result.result, null, "expected null result on negative input");
  assertEqual(result.warnings[0]?.code, "negative_input_value", "expected negative_input_value warning");
});

runTest("Audit Trail remains reconstructable for every Sprint 13.9 formula", () => {
  [
    { formulaType: CalculationFormulaType.RebarWeightFromLength, dimensions: [dimension("length", 12, MeasurementUnit.Meter), dimension("unit_weight", 0.6, MeasurementUnit.Kilogram)] },
    { formulaType: CalculationFormulaType.SteelWeightFromUnitWeight, dimensions: [dimension("quantity", 10, MeasurementUnit.Unit), dimension("unit_weight", 1.2, MeasurementUnit.Kilogram)] },
    { formulaType: CalculationFormulaType.FormworkArea, dimensions: [dimension("width", 2, MeasurementUnit.Meter), dimension("height", 3, MeasurementUnit.Meter)] },
    { formulaType: CalculationFormulaType.PipeLength, dimensions: [dimension("length", 10, MeasurementUnit.Meter)] },
    { formulaType: CalculationFormulaType.DrainageChannelVolume, dimensions: [dimension("width", 1, MeasurementUnit.Meter), dimension("depth", 1, MeasurementUnit.Meter), dimension("length", 1, MeasurementUnit.Meter)] },
    { formulaType: CalculationFormulaType.CurbLength, dimensions: [dimension("length", 10, MeasurementUnit.Meter)] },
    { formulaType: CalculationFormulaType.InterlockingPaverArea, dimensions: [dimension("width", 2, MeasurementUnit.Meter), dimension("length", 3, MeasurementUnit.Meter)] },
  ].forEach(({ formulaType, dimensions }) => {
    const result = executeCalculation({ formulaType, dimensions });
    assertEqual(isCalculationReconstructable(result), true, `expected ${formulaType} to remain reconstructable`);

    const trail = buildCalculationAuditTrail({ formulaType, executionResult: result });
    assertEqual(trail.reconstructable, true, `expected audit trail for ${formulaType} to be reconstructable`);
  });
});

runTest("Validation Engine reports every Sprint 13.9 formula as valid", () => {
  [
    { formulaType: CalculationFormulaType.RebarWeightFromLength, dimensions: [dimension("length", 12, MeasurementUnit.Meter), dimension("unit_weight", 0.6, MeasurementUnit.Kilogram)] },
    { formulaType: CalculationFormulaType.FormworkArea, dimensions: [dimension("width", 2, MeasurementUnit.Meter), dimension("height", 3, MeasurementUnit.Meter)] },
    { formulaType: CalculationFormulaType.PipeLength, dimensions: [dimension("length", 10, MeasurementUnit.Meter)] },
    { formulaType: CalculationFormulaType.DrainageChannelVolume, dimensions: [dimension("width", 1, MeasurementUnit.Meter), dimension("depth", 1, MeasurementUnit.Meter), dimension("length", 1, MeasurementUnit.Meter)] },
    { formulaType: CalculationFormulaType.InterlockingPaverArea, dimensions: [dimension("width", 2, MeasurementUnit.Meter), dimension("length", 3, MeasurementUnit.Meter)] },
  ].forEach(({ formulaType, dimensions }) => {
    const executionInput = { formulaType, dimensions };
    const executionResult = executeCalculation(executionInput);
    const catalogEntry = findMeasurementFormulaCatalogEntry(formulaType);

    const validation = validateCalculationExecution({ executionInput, executionResult, catalogEntry });
    assertEqual(validation.valid, true, `expected ${formulaType} to validate cleanly`);
    assertEqual(validation.errors.length, 0, `expected zero errors for ${formulaType}`);
  });
});

runTest("rejects execution with a missing required input", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.AreaRectangle,
    dimensions: [dimension("width", 4, MeasurementUnit.Meter)],
  });

  assertEqual(result.result, null, "expected null result on missing input");
  assertEqual(result.steps.length, 0, "expected no steps on failure");
  assertEqual(result.warnings[0]?.code, "missing_required_input", "expected missing_required_input warning");
  assertEqual(result.warnings[0]?.field, "length", "expected the missing field to be identified");
});

runTest("rejects execution with a negative input value", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.AreaRectangle,
    dimensions: [dimension("width", -1, MeasurementUnit.Meter), dimension("length", 500, MeasurementUnit.Meter)],
  });

  assertEqual(result.result, null, "expected null result on negative input");
  assertEqual(result.warnings[0]?.code, "negative_input_value", "expected negative_input_value warning");
  assertEqual(result.warnings[0]?.field, "width", "expected the negative field to be identified");
});

runTest("formula_not_yet_supported is only reachable for a formulaType outside the catalog entirely (defensive guard)", () => {
  const result = executeCalculation({
    formulaType: "not_a_real_formula" as CalculationFormulaType,
    dimensions: [],
  });

  assertEqual(result.result, null, "expected null result for an unknown formulaType");
  assertEqual(result.warnings[0]?.code, "formula_not_yet_supported", "expected formula_not_yet_supported warning");
  assertEqual(result.steps.length, 0, "expected no steps");
});

runTest("never fabricates a result for a formulaType outside the catalog", () => {
  const result = executeCalculation({
    formulaType: "not_a_real_formula" as CalculationFormulaType,
    dimensions: [dimension("length", 1, MeasurementUnit.Meter)],
  });

  assertEqual(result.result, null, "must never invent a result for a formula outside the catalog");
});

runTest("summarizeCalculationExecution reflects a successful execution", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.VolumeBox,
    dimensions: [
      dimension("width", 2, MeasurementUnit.Meter),
      dimension("height", 3, MeasurementUnit.Meter),
      dimension("length", 5, MeasurementUnit.Meter),
    ],
  });

  const summary = summarizeCalculationExecution(result);
  assertEqual(summary.hasResult, true, "expected hasResult true");
  assertEqual(summary.totalSteps, result.steps.length, "totalSteps mismatch");
  assertEqual(summary.totalWarnings, 0, "expected zero warnings on success");
  assertEqual(summary.resultValue, 30, "resultValue mismatch");
  assertEqual(summary.resultUnit, MeasurementUnit.CubicMeter, "resultUnit mismatch");
});

runTest("summarizeCalculationExecution reflects a failed execution", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.AreaRectangle,
    dimensions: [],
  });

  const summary = summarizeCalculationExecution(result);
  assertEqual(summary.hasResult, false, "expected hasResult false");
  assertEqual(summary.totalSteps, 0, "expected zero steps");
  assertEqual(summary.totalWarnings, 1, "expected exactly one warning");
  assertEqual(summary.resultValue, null, "resultValue must be null");
  assertEqual(summary.resultUnit, null, "resultUnit must be null");
});

runTest("execution output is deeply immutable", () => {
  const result = executeCalculation({
    formulaType: CalculationFormulaType.AreaRectangle,
    dimensions: [dimension("width", 4, MeasurementUnit.Meter), dimension("length", 500, MeasurementUnit.Meter)],
  });

  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(Object.isFrozen(result.steps), true, "steps array should be frozen");
  assertEqual(Object.isFrozen(result.steps[0]), true, "individual step should be frozen");
  assertEqual(Object.isFrozen(result.result), true, "result payload should be frozen");
  assertEqual(Object.isFrozen(result.warnings), true, "warnings array should be frozen");

  assertThrows(() => {
    (result as unknown as { result: unknown }).result = null;
  }, "mutating a frozen execution result must throw in strict mode");
});

runTest("execution never mutates the provided dimensions", () => {
  const dimensions: ReadonlyArray<MeasurementDimension> = [
    dimension("width", 4, MeasurementUnit.Meter),
    dimension("length", 500, MeasurementUnit.Meter),
  ];
  const before = JSON.stringify(dimensions);

  executeCalculation({ formulaType: CalculationFormulaType.AreaRectangle, dimensions });

  assertEqual(JSON.stringify(dimensions), before, "dimensions must remain unchanged after execution");
});

runTest("execution never alters the Formula Catalog", () => {
  const before = JSON.stringify(getMeasurementFormulaCatalog());

  executeCalculation({
    formulaType: CalculationFormulaType.AreaRectangle,
    dimensions: [dimension("width", 4, MeasurementUnit.Meter), dimension("length", 500, MeasurementUnit.Meter)],
  });

  assertEqual(JSON.stringify(getMeasurementFormulaCatalog()), before, "Formula Catalog must remain unchanged after execution");
});

runTest("execution is deterministic for identical input", () => {
  const buildInput = () => ({
    formulaType: CalculationFormulaType.AreaTrapezoid,
    dimensions: [
      dimension("base_major", 10, MeasurementUnit.Meter),
      dimension("base_minor", 6, MeasurementUnit.Meter),
      dimension("height", 4, MeasurementUnit.Meter),
    ],
  });

  const first = JSON.stringify(executeCalculation(buildInput()));
  const second = JSON.stringify(executeCalculation(buildInput()));

  assertEqual(first, second, "expected deterministic execution output for identical input");
});

runTest("does not import any forbidden domain or use non-deterministic constructs", () => {
  const sourceCode = readOwnSourceFile();
  const lowerSourceCode = sourceCode.toLowerCase();

  [
    "date.now(",
    "math.random(",
    "crypto.randomuuid",
    "uuid()",
    "field-evidence",
    "engineering-contract",
    "engineering-project-context",
    "measurement-workspace",
    "approval-workflow",
    "official-template",
    "export-engine",
    "decision-engine",
    "engines/decision",
    "business-fact",
    "react",
    "next",
    "supabase",
    "\"fs\"",
    "'fs'",
    "node:fs",
    "\"path\"",
    "'path'",
    "node:path",
    "xlsx",
    "pdf-lib",
    "pdfkit",
    "docx",
    "ocr",
    "gps.get",
    "whatsapp",
    "tensorflow",
    "openai",
    "fetch(",
    " eval(",
    "new function(",
    "reflect.",
  ].forEach((forbidden) => {
    assertEqual(
      lowerSourceCode.includes(forbidden),
      false,
      `unexpected forbidden construct in engine source: ${forbidden}`,
    );
  });
});

// --- Helpers -------------------------------------------------------------------

function dimension(name: string, value: number, unit: MeasurementUnit): MeasurementDimension {
  return { id: `dim-${name}`, name, value, unit, notes: null, sourceEvidenceIds: [] };
}

function readOwnSourceFile(): string {
  const filePath = resolve(
    process.cwd(),
    "src",
    "domain",
    "measurement-calculation",
    "measurement-calculation-engine.ts",
  );
  return readFileSync(filePath, "utf8");
}

// --- Test harness --------------------------------------------------------------

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertThrows(fn: () => void, message: string): void {
  let threw = false;

  try {
    fn();
  } catch {
    threw = true;
  }

  if (!threw) {
    throw new Error(message);
  }
}
