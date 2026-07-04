/**
 * Institutional knowledge catalog of the calculation formulas BDOS is
 * aware of. This does not represent a real `CalculationMemory`, does not
 * execute any formula, does not generate calculation steps, and does not
 * validate a calculation memory as a whole — it only formally declares
 * which `CalculationFormulaType` values exist, which inputs each one
 * expects, and which `MeasurementUnit` each one produces.
 *
 * Read-only by design: there is no add/update/delete here, only lookup
 * functions over a fixed, deterministic list.
 */
import { CalculationFormulaType, MeasurementUnit } from "./measurement-calculation.types";
import { freezeDomainObject } from "./measurement-calculation-shared";

export interface FormulaInputDefinition {
  readonly key: string;
  readonly label: string;
  readonly unit: MeasurementUnit;
  readonly required: boolean;
}

export interface MeasurementFormulaCatalogEntry {
  readonly formulaType: CalculationFormulaType;
  readonly displayName: string;
  readonly description: string;
  readonly requiredInputs: ReadonlyArray<FormulaInputDefinition>;
  readonly optionalInputs: ReadonlyArray<FormulaInputDefinition>;
  readonly outputUnit: MeasurementUnit;
  readonly active: boolean;
}

export type MeasurementFormulaCatalog = ReadonlyArray<MeasurementFormulaCatalogEntry>;

export interface MeasurementFormulaCatalogSummary {
  readonly totalEntries: number;
  readonly activeEntries: number;
  readonly inactiveEntries: number;
}

function requiredInput(key: string, label: string, unit: MeasurementUnit): FormulaInputDefinition {
  return { key, label, unit, required: true };
}

const catalogSource: ReadonlyArray<MeasurementFormulaCatalogEntry> = [
  {
    formulaType: CalculationFormulaType.LinearQuantity,
    displayName: "Quantidade Linear",
    description: "Calcula uma grandeza linear a partir de um comprimento informado diretamente em campo.",
    requiredInputs: [requiredInput("length", "Comprimento", MeasurementUnit.Meter)],
    optionalInputs: [],
    outputUnit: MeasurementUnit.Meter,
    active: true,
  },
  {
    formulaType: CalculationFormulaType.AreaRectangle,
    displayName: "Area de Retangulo",
    description: "Calcula a area de uma superficie retangular a partir da largura e do comprimento.",
    requiredInputs: [
      requiredInput("width", "Largura", MeasurementUnit.Meter),
      requiredInput("length", "Comprimento", MeasurementUnit.Meter),
    ],
    optionalInputs: [],
    outputUnit: MeasurementUnit.SquareMeter,
    active: true,
  },
  {
    formulaType: CalculationFormulaType.AreaTriangle,
    displayName: "Area de Triangulo",
    description: "Calcula a area de uma superficie triangular a partir da base e da altura.",
    requiredInputs: [
      requiredInput("base", "Base", MeasurementUnit.Meter),
      requiredInput("height", "Altura", MeasurementUnit.Meter),
    ],
    optionalInputs: [],
    outputUnit: MeasurementUnit.SquareMeter,
    active: true,
  },
  {
    formulaType: CalculationFormulaType.AreaTrapezoid,
    displayName: "Area de Trapezio",
    description: "Calcula a area de uma superficie trapezoidal a partir das bases maior e menor e da altura.",
    requiredInputs: [
      requiredInput("base_major", "Base Maior", MeasurementUnit.Meter),
      requiredInput("base_minor", "Base Menor", MeasurementUnit.Meter),
      requiredInput("height", "Altura", MeasurementUnit.Meter),
    ],
    optionalInputs: [],
    outputUnit: MeasurementUnit.SquareMeter,
    active: true,
  },
  {
    formulaType: CalculationFormulaType.AreaCircle,
    displayName: "Area de Circulo",
    description: "Calcula a area de uma superficie circular a partir do raio.",
    requiredInputs: [requiredInput("radius", "Raio", MeasurementUnit.Meter)],
    optionalInputs: [],
    outputUnit: MeasurementUnit.SquareMeter,
    active: true,
  },
  {
    formulaType: CalculationFormulaType.PerimeterRectangle,
    displayName: "Perimetro de Retangulo",
    description: "Calcula o perimetro de uma superficie retangular a partir da largura e do comprimento.",
    requiredInputs: [
      requiredInput("width", "Largura", MeasurementUnit.Meter),
      requiredInput("length", "Comprimento", MeasurementUnit.Meter),
    ],
    optionalInputs: [],
    outputUnit: MeasurementUnit.Meter,
    active: true,
  },
  {
    formulaType: CalculationFormulaType.VolumeBox,
    displayName: "Volume de Paralelepipedo",
    description: "Calcula o volume de um solido em formato de paralelepipedo a partir da largura, altura e comprimento.",
    requiredInputs: [
      requiredInput("width", "Largura", MeasurementUnit.Meter),
      requiredInput("height", "Altura", MeasurementUnit.Meter),
      requiredInput("length", "Comprimento", MeasurementUnit.Meter),
    ],
    optionalInputs: [],
    outputUnit: MeasurementUnit.CubicMeter,
    active: true,
  },
  {
    formulaType: CalculationFormulaType.VolumeCylinder,
    displayName: "Volume de Cilindro",
    description: "Calcula o volume de um solido cilindrico a partir do raio e da altura.",
    requiredInputs: [
      requiredInput("radius", "Raio", MeasurementUnit.Meter),
      requiredInput("height", "Altura", MeasurementUnit.Meter),
    ],
    optionalInputs: [],
    outputUnit: MeasurementUnit.CubicMeter,
    active: true,
  },
  {
    formulaType: CalculationFormulaType.VolumeTrapezoidalPrism,
    displayName: "Volume de Prisma Trapezoidal",
    description:
      "Calcula o volume de um solido em formato de prisma trapezoidal a partir das bases maior e menor, da altura e do comprimento.",
    requiredInputs: [
      requiredInput("base_major", "Base Maior", MeasurementUnit.Meter),
      requiredInput("base_minor", "Base Menor", MeasurementUnit.Meter),
      requiredInput("height", "Altura", MeasurementUnit.Meter),
      requiredInput("length", "Comprimento", MeasurementUnit.Meter),
    ],
    optionalInputs: [],
    outputUnit: MeasurementUnit.CubicMeter,
    active: true,
  },
  {
    formulaType: CalculationFormulaType.CutFillVolumeAverageEndArea,
    displayName: "Volume de Corte/Aterro pela Media das Areas Extremas",
    description:
      "Calcula o volume de corte ou aterro entre duas secoes transversais pela media das areas extremas e a distancia entre elas.",
    requiredInputs: [
      requiredInput("start_section_area", "Area da Secao Inicial", MeasurementUnit.SquareMeter),
      requiredInput("end_section_area", "Area da Secao Final", MeasurementUnit.SquareMeter),
      requiredInput("distance", "Distancia entre Secoes", MeasurementUnit.Meter),
    ],
    optionalInputs: [],
    outputUnit: MeasurementUnit.CubicMeter,
    active: true,
  },
  {
    formulaType: CalculationFormulaType.AreaTimesThickness,
    displayName: "Area vezes Espessura",
    description: "Calcula um volume a partir de uma area conhecida multiplicada pela espessura da camada.",
    requiredInputs: [
      requiredInput("area", "Area", MeasurementUnit.SquareMeter),
      requiredInput("thickness", "Espessura", MeasurementUnit.Meter),
    ],
    optionalInputs: [],
    outputUnit: MeasurementUnit.CubicMeter,
    active: true,
  },
  {
    formulaType: CalculationFormulaType.AsphaltMassFromAreaThicknessDensity,
    displayName: "Massa Asfaltica por Area, Espessura e Densidade",
    description:
      "Calcula a massa asfaltica aplicada a partir da area, da espessura da camada e da densidade do material.",
    requiredInputs: [
      requiredInput("area", "Area", MeasurementUnit.SquareMeter),
      requiredInput("thickness", "Espessura", MeasurementUnit.Meter),
      requiredInput("density", "Densidade (ton/m3)", MeasurementUnit.Ton),
    ],
    optionalInputs: [],
    outputUnit: MeasurementUnit.Ton,
    active: true,
  },
  {
    formulaType: CalculationFormulaType.ConcreteVolume,
    displayName: "Volume de Concreto",
    description: "Calcula o volume de concreto necessario a partir da largura, altura e comprimento do elemento.",
    requiredInputs: [
      requiredInput("width", "Largura", MeasurementUnit.Meter),
      requiredInput("height", "Altura", MeasurementUnit.Meter),
      requiredInput("length", "Comprimento", MeasurementUnit.Meter),
    ],
    optionalInputs: [],
    outputUnit: MeasurementUnit.CubicMeter,
    active: true,
  },
  {
    formulaType: CalculationFormulaType.MortarVolume,
    displayName: "Volume de Argamassa",
    description: "Calcula o volume de argamassa necessario a partir da area de aplicacao e da espessura da camada.",
    requiredInputs: [
      requiredInput("area", "Area", MeasurementUnit.SquareMeter),
      requiredInput("thickness", "Espessura", MeasurementUnit.Meter),
    ],
    optionalInputs: [],
    outputUnit: MeasurementUnit.CubicMeter,
    active: true,
  },
  {
    formulaType: CalculationFormulaType.MachineHours,
    displayName: "Horas de Maquina",
    description: "Calcula as horas trabalhadas de um equipamento a partir das leituras inicial e final do horimetro.",
    requiredInputs: [
      requiredInput("start_reading", "Leitura Inicial do Horimetro", MeasurementUnit.Hour),
      requiredInput("end_reading", "Leitura Final do Horimetro", MeasurementUnit.Hour),
    ],
    optionalInputs: [],
    outputUnit: MeasurementUnit.Hour,
    active: true,
  },
  {
    formulaType: CalculationFormulaType.VehicleTrips,
    displayName: "Viagens de Veiculo",
    description: "Registra a quantidade de viagens realizadas por um veiculo em uma atividade de transporte.",
    requiredInputs: [requiredInput("trip_count", "Quantidade de Viagens", MeasurementUnit.Trip)],
    optionalInputs: [],
    outputUnit: MeasurementUnit.Trip,
    active: true,
  },
  {
    formulaType: CalculationFormulaType.TransportVolume,
    displayName: "Volume Transportado",
    description: "Calcula o volume total transportado a partir da quantidade de viagens e do volume por viagem.",
    requiredInputs: [
      requiredInput("trip_count", "Quantidade de Viagens", MeasurementUnit.Trip),
      requiredInput("volume_per_trip", "Volume por Viagem", MeasurementUnit.CubicMeter),
    ],
    optionalInputs: [],
    outputUnit: MeasurementUnit.CubicMeter,
    active: true,
  },
  {
    formulaType: CalculationFormulaType.HaulageTonKm,
    displayName: "Transporte em Toneladas por Quilometro",
    description:
      "Calcula o indicador de transporte em toneladas-quilometro a partir do peso transportado e da distancia percorrida.",
    requiredInputs: [
      requiredInput("weight", "Peso Transportado", MeasurementUnit.Ton),
      requiredInput("distance_km", "Distancia Percorrida (km)", MeasurementUnit.Meter),
    ],
    optionalInputs: [],
    outputUnit: MeasurementUnit.Ton,
    active: true,
  },
  {
    formulaType: CalculationFormulaType.SimpleQuantity,
    displayName: "Quantidade Simples",
    description: "Registra uma quantidade simples informada diretamente, sem calculo geometrico associado.",
    requiredInputs: [requiredInput("quantity", "Quantidade", MeasurementUnit.Unit)],
    optionalInputs: [],
    outputUnit: MeasurementUnit.Unit,
    active: true,
  },
  {
    formulaType: CalculationFormulaType.PercentageOfTotal,
    displayName: "Percentual do Total",
    description: "Calcula o percentual que uma parte representa em relacao a um total informado.",
    requiredInputs: [
      requiredInput("part_value", "Valor da Parte", MeasurementUnit.Unit),
      requiredInput("total_value", "Valor Total", MeasurementUnit.Unit),
    ],
    optionalInputs: [],
    outputUnit: MeasurementUnit.Percent,
    active: true,
  },
  {
    formulaType: CalculationFormulaType.WeightedProgress,
    displayName: "Avanco Ponderado",
    description:
      "Calcula o avanco fisico ponderado de um item a partir do percentual executado e do peso relativo do item.",
    requiredInputs: [
      requiredInput("physical_progress_percent", "Percentual Executado", MeasurementUnit.Percent),
      requiredInput("item_weight_percent", "Peso Relativo do Item", MeasurementUnit.Percent),
    ],
    optionalInputs: [],
    outputUnit: MeasurementUnit.Percent,
    active: true,
  },
  {
    formulaType: CalculationFormulaType.SlopePercentage,
    displayName: "Declividade Percentual",
    description:
      "Calcula a declividade percentual de um trecho a partir do desnivel e da distancia horizontal percorrida.",
    requiredInputs: [
      requiredInput("level_difference", "Desnivel", MeasurementUnit.Meter),
      requiredInput("horizontal_distance", "Distancia Horizontal", MeasurementUnit.Meter),
    ],
    optionalInputs: [],
    outputUnit: MeasurementUnit.Percent,
    active: true,
  },
  {
    formulaType: CalculationFormulaType.LevelDifference,
    displayName: "Desnivel",
    description: "Calcula o desnivel entre dois pontos a partir das cotas inicial e final.",
    requiredInputs: [
      requiredInput("start_elevation", "Cota Inicial", MeasurementUnit.Meter),
      requiredInput("end_elevation", "Cota Final", MeasurementUnit.Meter),
    ],
    optionalInputs: [],
    outputUnit: MeasurementUnit.Meter,
    active: true,
  },
  {
    formulaType: CalculationFormulaType.ExcavationDepthAverage,
    displayName: "Profundidade Media de Escavacao",
    description:
      "Calcula a profundidade media de uma escavacao a partir das profundidades registradas inicial e final.",
    requiredInputs: [
      requiredInput("start_depth", "Profundidade Inicial", MeasurementUnit.Meter),
      requiredInput("end_depth", "Profundidade Final", MeasurementUnit.Meter),
    ],
    optionalInputs: [],
    outputUnit: MeasurementUnit.Meter,
    active: true,
  },
  {
    formulaType: CalculationFormulaType.RebarWeightFromLength,
    displayName: "Peso de Ferragem por Comprimento",
    description: "Calcula o peso de ferragem a partir do comprimento total e do peso unitario da barra.",
    requiredInputs: [
      requiredInput("length", "Comprimento Total", MeasurementUnit.Meter),
      requiredInput("unit_weight", "Peso Unitario (kg/m)", MeasurementUnit.Kilogram),
    ],
    optionalInputs: [],
    outputUnit: MeasurementUnit.Kilogram,
    active: true,
  },
  {
    formulaType: CalculationFormulaType.SteelWeightFromUnitWeight,
    displayName: "Peso de Aco por Peso Unitario",
    description: "Calcula o peso total de aco a partir da quantidade de pecas e do peso unitario de cada peca.",
    requiredInputs: [
      requiredInput("quantity", "Quantidade de Pecas", MeasurementUnit.Unit),
      requiredInput("unit_weight", "Peso Unitario", MeasurementUnit.Kilogram),
    ],
    optionalInputs: [],
    outputUnit: MeasurementUnit.Kilogram,
    active: true,
  },
  {
    formulaType: CalculationFormulaType.FormworkArea,
    displayName: "Area de Forma",
    description: "Calcula a area de forma de contato necessaria a partir da largura e da altura do elemento.",
    requiredInputs: [
      requiredInput("width", "Largura", MeasurementUnit.Meter),
      requiredInput("height", "Altura", MeasurementUnit.Meter),
    ],
    optionalInputs: [],
    outputUnit: MeasurementUnit.SquareMeter,
    active: true,
  },
  {
    formulaType: CalculationFormulaType.PipeLength,
    displayName: "Comprimento de Tubulacao",
    description: "Registra o comprimento de tubulacao instalada a partir da medicao direta em campo.",
    requiredInputs: [requiredInput("length", "Comprimento", MeasurementUnit.Meter)],
    optionalInputs: [],
    outputUnit: MeasurementUnit.Meter,
    active: true,
  },
  {
    formulaType: CalculationFormulaType.DrainageChannelVolume,
    displayName: "Volume de Canaleta de Drenagem",
    description: "Calcula o volume de uma canaleta de drenagem a partir da largura, profundidade e comprimento.",
    requiredInputs: [
      requiredInput("width", "Largura", MeasurementUnit.Meter),
      requiredInput("depth", "Profundidade", MeasurementUnit.Meter),
      requiredInput("length", "Comprimento", MeasurementUnit.Meter),
    ],
    optionalInputs: [],
    outputUnit: MeasurementUnit.CubicMeter,
    active: true,
  },
  {
    formulaType: CalculationFormulaType.CurbLength,
    displayName: "Comprimento de Meio-Fio",
    description: "Registra o comprimento de meio-fio instalado a partir da medicao direta em campo.",
    requiredInputs: [requiredInput("length", "Comprimento", MeasurementUnit.Meter)],
    optionalInputs: [],
    outputUnit: MeasurementUnit.Meter,
    active: true,
  },
  {
    formulaType: CalculationFormulaType.InterlockingPaverArea,
    displayName: "Area de Pavimento Intertravado",
    description: "Calcula a area de pavimento intertravado executada a partir da largura e do comprimento.",
    requiredInputs: [
      requiredInput("width", "Largura", MeasurementUnit.Meter),
      requiredInput("length", "Comprimento", MeasurementUnit.Meter),
    ],
    optionalInputs: [],
    outputUnit: MeasurementUnit.SquareMeter,
    active: true,
  },
];

export function getMeasurementFormulaCatalog(): MeasurementFormulaCatalog {
  return buildCatalog();
}

export function findMeasurementFormulaCatalogEntry(
  formulaType: CalculationFormulaType,
): MeasurementFormulaCatalogEntry | null {
  const entry = buildCatalog().find((candidate) => candidate.formulaType === formulaType);
  return entry ?? null;
}

export function listActiveMeasurementFormulas(): MeasurementFormulaCatalog {
  return Object.freeze(buildCatalog().filter((entry) => entry.active));
}

export function isSupportedCalculationFormulaType(value: string): boolean {
  return catalogSource.some((entry) => entry.formulaType === value);
}

export function summarizeMeasurementFormulaCatalog(): MeasurementFormulaCatalogSummary {
  const catalog = buildCatalog();
  const activeEntries = catalog.filter((entry) => entry.active).length;

  return {
    totalEntries: catalog.length,
    activeEntries,
    inactiveEntries: catalog.length - activeEntries,
  };
}

function buildCatalog(): MeasurementFormulaCatalog {
  const sorted = [...catalogSource].sort((left, right) => left.formulaType.localeCompare(right.formulaType));

  return freezeDomainObject<MeasurementFormulaCatalog>(sorted);
}
