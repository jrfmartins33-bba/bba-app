/**
 * Institutional knowledge mapping between generic engineering service
 * categories and the calculation formulas they typically use. This does
 * not calculate anything, does not execute any formula, does not create
 * a measurement, and does not integrate with contracts, projects, Field
 * Evidence, or Document Reconstruction — it only answers "que tipo de
 * serviço normalmente usa qual fórmula?".
 *
 * `EngineeringServiceType` is deliberately generic BDOS vocabulary, not a
 * contract line item, budget item, or reference to any specific public
 * pricing table or institution — none is named here or anywhere in this
 * domain.
 *
 * Read-only by design: there is no add/update/delete, only lookup
 * functions over a fixed, deterministic list. `defaultFormulaType` and
 * `alternativeFormulaTypes` reference the Measurement Formula Catalog
 * (Sprint 13.2) by value — some are not yet implemented by the
 * Calculation Engine (Sprint 13.3), which is expected: this mapping
 * points at cataloged institutional knowledge, not at engine coverage.
 */
import type { CalculationFormulaType, MeasurementUnit } from "./measurement-calculation.types";
import { CalculationFormulaType as FormulaType, MeasurementUnit as Unit } from "./measurement-calculation.types";
import { freezeDomainObject } from "./measurement-calculation-shared";

export enum EngineeringServiceType {
  EarthworkExcavation = "earthwork_excavation",
  EarthworkFill = "earthwork_fill",
  EarthworkSpreading = "earthwork_spreading",
  EarthworkCompaction = "earthwork_compaction",

  InterlockingPaver = "interlocking_paver",
  Curb = "curb",
  Sidewalk = "sidewalk",
  PavementLayer = "pavement_layer",
  AsphaltPaving = "asphalt_paving",

  ConcreteStructure = "concrete_structure",
  ConcreteSlab = "concrete_slab",
  Masonry = "masonry",
  Formwork = "formwork",
  Rebar = "rebar",

  PipeInstallation = "pipe_installation",
  DrainageChannel = "drainage_channel",
  Manhole = "manhole",

  MachineOperation = "machine_operation",
  VehicleTransport = "vehicle_transport",
  MaterialDelivery = "material_delivery",

  TopographyMeasurement = "topography_measurement",
  LaboratoryTest = "laboratory_test",

  GeneralLinear = "general_linear",
  GeneralArea = "general_area",
  GeneralVolume = "general_volume",
  GeneralQuantity = "general_quantity",
  GeneralPercentage = "general_percentage",
}

export interface EngineeringServiceFormulaMappingEntry {
  readonly serviceType: EngineeringServiceType;
  readonly defaultFormulaType: CalculationFormulaType;
  readonly alternativeFormulaTypes: ReadonlyArray<CalculationFormulaType>;
  readonly requiredDimensionKeys: ReadonlyArray<string>;
  readonly recommendedUnit: MeasurementUnit;
  readonly description: string;
  readonly active: boolean;
}

export type EngineeringServiceFormulaMapping = ReadonlyArray<EngineeringServiceFormulaMappingEntry>;

export interface EngineeringServiceFormulaMappingSummary {
  readonly totalEntries: number;
  readonly activeEntries: number;
  readonly inactiveEntries: number;
}

const mappingSource: ReadonlyArray<EngineeringServiceFormulaMappingEntry> = [
  {
    serviceType: EngineeringServiceType.EarthworkExcavation,
    defaultFormulaType: FormulaType.VolumeBox,
    alternativeFormulaTypes: [],
    requiredDimensionKeys: ["width", "height", "length"],
    recommendedUnit: Unit.CubicMeter,
    description: "Escavacao de terra, tipicamente medida em volume (corte).",
    active: true,
  },
  {
    serviceType: EngineeringServiceType.EarthworkFill,
    defaultFormulaType: FormulaType.VolumeBox,
    alternativeFormulaTypes: [],
    requiredDimensionKeys: ["width", "height", "length"],
    recommendedUnit: Unit.CubicMeter,
    description: "Aterro de terra, tipicamente medido em volume (aterro).",
    active: true,
  },
  {
    serviceType: EngineeringServiceType.EarthworkSpreading,
    defaultFormulaType: FormulaType.AreaRectangle,
    alternativeFormulaTypes: [],
    requiredDimensionKeys: ["width", "length"],
    recommendedUnit: Unit.SquareMeter,
    description: "Espalhamento de material sobre uma superficie, tipicamente medido em area.",
    active: true,
  },
  {
    serviceType: EngineeringServiceType.EarthworkCompaction,
    defaultFormulaType: FormulaType.AreaRectangle,
    alternativeFormulaTypes: [],
    requiredDimensionKeys: ["width", "length"],
    recommendedUnit: Unit.SquareMeter,
    description: "Compactacao de uma camada de solo, tipicamente medida em area.",
    active: true,
  },
  {
    serviceType: EngineeringServiceType.InterlockingPaver,
    defaultFormulaType: FormulaType.InterlockingPaverArea,
    alternativeFormulaTypes: [],
    requiredDimensionKeys: ["width", "length"],
    recommendedUnit: Unit.SquareMeter,
    description: "Pavimento intertravado, medido pela area executada.",
    active: true,
  },
  {
    serviceType: EngineeringServiceType.Curb,
    defaultFormulaType: FormulaType.CurbLength,
    alternativeFormulaTypes: [],
    requiredDimensionKeys: ["length"],
    recommendedUnit: Unit.Meter,
    description: "Meio-fio, medido pelo comprimento instalado.",
    active: true,
  },
  {
    serviceType: EngineeringServiceType.Sidewalk,
    defaultFormulaType: FormulaType.AreaRectangle,
    alternativeFormulaTypes: [],
    requiredDimensionKeys: ["width", "length"],
    recommendedUnit: Unit.SquareMeter,
    description: "Calcada, tipicamente medida em area.",
    active: true,
  },
  {
    serviceType: EngineeringServiceType.PavementLayer,
    defaultFormulaType: FormulaType.AreaTimesThickness,
    alternativeFormulaTypes: [],
    requiredDimensionKeys: ["area", "thickness"],
    recommendedUnit: Unit.CubicMeter,
    description: "Camada de pavimento, medida pela area multiplicada pela espessura.",
    active: true,
  },
  {
    serviceType: EngineeringServiceType.AsphaltPaving,
    defaultFormulaType: FormulaType.AsphaltMassFromAreaThicknessDensity,
    alternativeFormulaTypes: [],
    requiredDimensionKeys: ["area", "thickness", "density"],
    recommendedUnit: Unit.Ton,
    description: "Pavimentacao asfaltica, medida pela massa aplicada a partir da area, espessura e densidade.",
    active: true,
  },
  {
    serviceType: EngineeringServiceType.ConcreteStructure,
    defaultFormulaType: FormulaType.ConcreteVolume,
    alternativeFormulaTypes: [],
    requiredDimensionKeys: ["width", "height", "length"],
    recommendedUnit: Unit.CubicMeter,
    description: "Estrutura de concreto, medida pelo volume executado.",
    active: true,
  },
  {
    serviceType: EngineeringServiceType.ConcreteSlab,
    defaultFormulaType: FormulaType.ConcreteVolume,
    alternativeFormulaTypes: [],
    requiredDimensionKeys: ["width", "height", "length"],
    recommendedUnit: Unit.CubicMeter,
    description: "Laje de concreto, medida pelo volume executado.",
    active: true,
  },
  {
    serviceType: EngineeringServiceType.Masonry,
    defaultFormulaType: FormulaType.AreaRectangle,
    alternativeFormulaTypes: [],
    requiredDimensionKeys: ["width", "length"],
    recommendedUnit: Unit.SquareMeter,
    description: "Alvenaria, tipicamente medida em area.",
    active: true,
  },
  {
    serviceType: EngineeringServiceType.Formwork,
    defaultFormulaType: FormulaType.FormworkArea,
    alternativeFormulaTypes: [],
    requiredDimensionKeys: ["width", "height"],
    recommendedUnit: Unit.SquareMeter,
    description: "Forma de concretagem, medida pela area de contato.",
    active: true,
  },
  {
    serviceType: EngineeringServiceType.Rebar,
    defaultFormulaType: FormulaType.RebarWeightFromLength,
    alternativeFormulaTypes: [],
    requiredDimensionKeys: ["length", "unit_weight"],
    recommendedUnit: Unit.Kilogram,
    description: "Ferragem, medida pelo peso a partir do comprimento e do peso unitario.",
    active: true,
  },
  {
    serviceType: EngineeringServiceType.PipeInstallation,
    defaultFormulaType: FormulaType.PipeLength,
    alternativeFormulaTypes: [],
    requiredDimensionKeys: ["length"],
    recommendedUnit: Unit.Meter,
    description: "Instalacao de tubulacao, medida pelo comprimento instalado.",
    active: true,
  },
  {
    serviceType: EngineeringServiceType.DrainageChannel,
    defaultFormulaType: FormulaType.DrainageChannelVolume,
    alternativeFormulaTypes: [],
    requiredDimensionKeys: ["width", "depth", "length"],
    recommendedUnit: Unit.CubicMeter,
    description: "Canaleta de drenagem, medida pelo volume executado.",
    active: true,
  },
  {
    serviceType: EngineeringServiceType.Manhole,
    defaultFormulaType: FormulaType.SimpleQuantity,
    alternativeFormulaTypes: [],
    requiredDimensionKeys: ["quantity"],
    recommendedUnit: Unit.Unit,
    description: "Poco de visita, registrado como quantidade simples.",
    active: true,
  },
  {
    serviceType: EngineeringServiceType.MachineOperation,
    defaultFormulaType: FormulaType.MachineHours,
    alternativeFormulaTypes: [],
    requiredDimensionKeys: ["start_reading", "end_reading"],
    recommendedUnit: Unit.Hour,
    description: "Operacao de maquina, medida pelas horas trabalhadas.",
    active: true,
  },
  {
    serviceType: EngineeringServiceType.VehicleTransport,
    defaultFormulaType: FormulaType.VehicleTrips,
    alternativeFormulaTypes: [],
    requiredDimensionKeys: ["trip_count"],
    recommendedUnit: Unit.Trip,
    description: "Transporte por veiculo, medido pela quantidade de viagens.",
    active: true,
  },
  {
    serviceType: EngineeringServiceType.MaterialDelivery,
    defaultFormulaType: FormulaType.SimpleQuantity,
    alternativeFormulaTypes: [],
    requiredDimensionKeys: ["quantity"],
    recommendedUnit: Unit.Unit,
    description: "Entrega de material, registrada como quantidade simples.",
    active: true,
  },
  {
    serviceType: EngineeringServiceType.TopographyMeasurement,
    defaultFormulaType: FormulaType.LevelDifference,
    alternativeFormulaTypes: [],
    requiredDimensionKeys: ["start_elevation", "end_elevation"],
    recommendedUnit: Unit.Meter,
    description: "Medicao topografica, tipicamente expressa como desnivel.",
    active: true,
  },
  {
    serviceType: EngineeringServiceType.LaboratoryTest,
    defaultFormulaType: FormulaType.SimpleQuantity,
    alternativeFormulaTypes: [],
    requiredDimensionKeys: ["quantity"],
    recommendedUnit: Unit.Unit,
    description: "Ensaio de laboratorio, registrado como quantidade simples.",
    active: true,
  },
  {
    serviceType: EngineeringServiceType.GeneralLinear,
    defaultFormulaType: FormulaType.LinearQuantity,
    alternativeFormulaTypes: [],
    requiredDimensionKeys: ["length"],
    recommendedUnit: Unit.Meter,
    description: "Grandeza linear generica.",
    active: true,
  },
  {
    serviceType: EngineeringServiceType.GeneralArea,
    defaultFormulaType: FormulaType.AreaRectangle,
    alternativeFormulaTypes: [],
    requiredDimensionKeys: ["width", "length"],
    recommendedUnit: Unit.SquareMeter,
    description: "Grandeza de area generica.",
    active: true,
  },
  {
    serviceType: EngineeringServiceType.GeneralVolume,
    defaultFormulaType: FormulaType.VolumeBox,
    alternativeFormulaTypes: [],
    requiredDimensionKeys: ["width", "height", "length"],
    recommendedUnit: Unit.CubicMeter,
    description: "Grandeza de volume generica.",
    active: true,
  },
  {
    serviceType: EngineeringServiceType.GeneralQuantity,
    defaultFormulaType: FormulaType.SimpleQuantity,
    alternativeFormulaTypes: [],
    requiredDimensionKeys: ["quantity"],
    recommendedUnit: Unit.Unit,
    description: "Grandeza simples generica.",
    active: true,
  },
  {
    serviceType: EngineeringServiceType.GeneralPercentage,
    defaultFormulaType: FormulaType.PercentageOfTotal,
    alternativeFormulaTypes: [],
    requiredDimensionKeys: ["part_value", "total_value"],
    recommendedUnit: Unit.Percent,
    description: "Grandeza percentual generica.",
    active: true,
  },
];

export function getEngineeringServiceFormulaMappings(): EngineeringServiceFormulaMapping {
  return buildMapping();
}

export function findEngineeringServiceFormulaMapping(
  serviceType: EngineeringServiceType,
): EngineeringServiceFormulaMappingEntry | null {
  const entry = buildMapping().find((candidate) => candidate.serviceType === serviceType);
  return entry ?? null;
}

/**
 * Returns the default formula the catalog suggests for `serviceType`, or
 * `null` when the service type is not mapped. Does not check whether the
 * Calculation Engine has actually implemented that formula yet — this
 * mapping points at the Formula Catalog, not at engine coverage.
 */
export function suggestFormulaForEngineeringService(
  serviceType: EngineeringServiceType,
): CalculationFormulaType | null {
  const entry = findEngineeringServiceFormulaMapping(serviceType);
  return entry?.defaultFormulaType ?? null;
}

export function listActiveEngineeringServiceFormulaMappings(): EngineeringServiceFormulaMapping {
  return Object.freeze(buildMapping().filter((entry) => entry.active));
}

export function summarizeEngineeringServiceFormulaMappings(): EngineeringServiceFormulaMappingSummary {
  const mapping = buildMapping();
  const activeEntries = mapping.filter((entry) => entry.active).length;

  return {
    totalEntries: mapping.length,
    activeEntries,
    inactiveEntries: mapping.length - activeEntries,
  };
}

function buildMapping(): EngineeringServiceFormulaMapping {
  const sorted = [...mappingSource].sort((left, right) => left.serviceType.localeCompare(right.serviceType));

  return freezeDomainObject<EngineeringServiceFormulaMapping>(sorted);
}
