import { readXlsxWorkbook } from "./xlsx-reader";
import type { ExcelSheetDto } from "./xlsx-reader.types";
import { detectSheetPlanningType, normalize } from "./sheet-type-detector";
import type { DetectedColumn, DetectedPeriodColumn, PlanningColumnKind, SheetDetectionResult } from "./sheet-type-detector.types";
import type {
  PlanningActivityRecord,
  PlanningDataset,
  PlanningDatasetOrigin,
  PlanningDetectedType,
  PlanningFinancialSummary,
  PlanningImportWarning,
  PlanningPeriodPoint,
  PlanningPeriodSeries,
} from "../../planning-dataset.types";
import type { ExcelImportInput, ExcelImportResult } from "./excel-import.types";

/**
 * BBA Project Studio — Sprint 1 (PARTE 5). Orquestra
 * `readXlsxWorkbook` (neutro, sem significado de negócio) →
 * `detectSheetPlanningType` (por planilha) → extração para
 * `PlanningDataset`. O domínio (`planning-dataset.ts`) nunca importa
 * este arquivo nem sabe que Excel existe — só esta pasta.
 *
 * Escolhe UMA "aba principal" (a de maior confiança de detecção,
 * ignorando abas ocultas) — as demais entram como aviso estruturado,
 * nunca são mescladas silenciosamente. Nenhuma dependência é
 * inventada: um Excel sem coluna de predecessoras gera o warning
 * `missing_dependencies`, nunca uma predecessora artificial.
 */
export function importPlanningExcel(input: ExcelImportInput): ExcelImportResult {
  const workbook = readXlsxWorkbook(input.bytes);
  const warnings: PlanningImportWarning[] = [];

  const visibleSheets = workbook.sheets.filter((sheet) => !sheet.hidden);
  workbook.sheets
    .filter((sheet) => sheet.hidden)
    .forEach((sheet) => {
      warnings.push({
        code: "hidden_sheet_skipped",
        message: `A aba oculta "${sheet.name}" não foi considerada para o Planning Dataset.`,
        sheetName: sheet.name,
      });
    });

  if (visibleSheets.length === 0) {
    return emptyResult(input, warnings);
  }

  const detections = visibleSheets.map((sheet) => ({ sheet, detection: detectSheetPlanningType(sheet) }));
  const primary = detections.reduce((best, current) => (current.detection.confidence > best.detection.confidence ? current : best));

  detections
    .filter((candidate) => candidate.sheet !== primary.sheet)
    .forEach((candidate) => {
      warnings.push({
        code: "unrecognized_sheet",
        message: `A aba "${candidate.sheet.name}" não foi usada (confiança de detecção menor que "${primary.sheet.name}").`,
        sheetName: candidate.sheet.name,
      });
    });

  if (primary.detection.detectedType === "unknown") {
    warnings.push({
      code: "no_activities_recognized",
      message: `Nenhuma estrutura de planejamento reconhecida na aba "${primary.sheet.name}".`,
      sheetName: primary.sheet.name,
    });
    return emptyResult(input, warnings, primary.sheet.name);
  }

  const origin: PlanningDatasetOrigin = {
    sourceType: "excel",
    fileName: input.fileName,
    sheetName: primary.sheet.name,
    importedAt: input.importedAt,
  };

  const extraction =
    primary.detection.detectedType === "cronograma"
      ? extractRowPerActivity(primary.sheet, primary.detection)
      : extractPeriodMatrix(primary.sheet, primary.detection);

  const dataset: PlanningDataset = {
    origin,
    detectedType: primary.detection.detectedType,
    activities: extraction.activities,
    periodSeries: extraction.periodSeries,
    financial: extractFinancialSummary(primary.sheet),
    warnings: [...warnings, ...extraction.warnings],
  };

  return { success: dataset.activities.length > 0, dataset };
}

function emptyResult(input: ExcelImportInput, warnings: PlanningImportWarning[], sheetName: string | null = null): ExcelImportResult {
  return {
    success: false,
    dataset: {
      origin: { sourceType: "excel", fileName: input.fileName, sheetName, importedAt: input.importedAt },
      detectedType: "unknown",
      activities: [],
      periodSeries: [],
      financial: null,
      warnings,
    },
  };
}

interface ExtractionResult {
  readonly activities: ReadonlyArray<PlanningActivityRecord>;
  readonly periodSeries: ReadonlyArray<PlanningPeriodSeries>;
  readonly warnings: ReadonlyArray<PlanningImportWarning>;
}

/** Estratégia A — uma linha por atividade (cronograma clássico). */
function extractRowPerActivity(sheet: ExcelSheetDto, detection: SheetDetectionResult): ExtractionResult {
  const codeColumn = firstColumnOfKind(detection.columns, "code");
  const nameColumn = firstColumnOfKind(detection.columns, "name");
  const startColumn = firstColumnOfKind(detection.columns, "start");
  const endColumn = firstColumnOfKind(detection.columns, "end");
  const durationColumn = firstColumnOfKind(detection.columns, "duration");
  const percentColumn = firstColumnOfKind(detection.columns, "percent");
  const predecessorsColumn = firstColumnOfKind(detection.columns, "predecessors");

  const warnings: PlanningImportWarning[] = [];
  const activities: PlanningActivityRecord[] = [];

  if (codeColumn === null || nameColumn === null) {
    warnings.push({ code: "missing_column", message: "Colunas de código/nome de atividade não foram reconhecidas." });
    return { activities: [], periodSeries: [], warnings };
  }

  if (predecessorsColumn === null) {
    warnings.push({ code: "missing_dependencies", message: "Dependências não identificadas no Excel de origem." });
  }

  if (startColumn === null || endColumn === null) {
    warnings.push({ code: "missing_dates", message: "Datas de início/fim não identificadas para uma ou mais atividades." });
  }

  const rows = sheet.rows.slice((detection.headerRowIndex ?? -1) + 1);

  rows.forEach((row, index) => {
    const code = readText(row.cells[codeColumn]);
    const name = readText(row.cells[nameColumn]);

    if (code === null && name === null) {
      return;
    }

    const start = startColumn === null ? null : readIsoDate(row.cells[startColumn]);
    const end = endColumn === null ? null : readIsoDate(row.cells[endColumn]);
    const duration = durationColumn === null ? null : readNumber(row.cells[durationColumn]);
    const percent = percentColumn === null ? null : normalizePercent(readNumber(row.cells[percentColumn]));

    activities.push({
      id: `excel-activity-${index}`,
      code: code ?? String(index + 1),
      name: name ?? code ?? `Item ${index + 1}`,
      parentId: null,
      sequence: index,
      isSummary: false,
      isMilestone: false,
      plannedStart: start,
      plannedEnd: end,
      durationDays: duration,
      percentPlanned: null,
      percentActual: percent,
      plannedValue: null,
      actualValue: null,
      weight: null,
      dependencies: [],
    });
  });

  return { activities, periodSeries: [], warnings };
}

/** Estratégia B — matriz de períodos (curva S / cronograma físico-financeiro). */
function extractPeriodMatrix(sheet: ExcelSheetDto, detection: SheetDetectionResult): ExtractionResult {
  const codeColumn = firstColumnOfKind(detection.columns, "code");
  const nameColumn = firstColumnOfKind(detection.columns, "name");
  const controlColumn = firstColumnOfKind(detection.columns, "control");
  const periodColumns = detection.periodColumns;

  const warnings: PlanningImportWarning[] = [
    { code: "missing_dependencies", message: "Dependências não identificadas no Excel de origem." },
    { code: "missing_dates", message: "Este arquivo traz períodos (meses), não datas de início/fim por atividade." },
  ];

  if (codeColumn === null || nameColumn === null || periodColumns.length === 0) {
    warnings.push({ code: "missing_column", message: "Colunas de código/nome/período não foram reconhecidas o suficiente para extrair atividades." });
    return { activities: [], periodSeries: [], warnings };
  }

  const hasDateRow = periodColumns.some((column) => column.date !== null);
  const dataStart = (detection.periodHeaderRowIndex ?? 0) + (hasDateRow ? 2 : 1);
  const rows = sheet.rows.slice(dataStart);

  const activities: PlanningActivityRecord[] = [];
  const aggregatePoints = new Map<number, PeriodAccumulator>();

  let currentItem: { code: string; name: string; points: Map<number, PeriodAccumulator> } | null = null;
  let currentCategory: "planned" | "actual" | null = null;

  const flushCurrentItem = (): void => {
    if (currentItem === null) {
      return;
    }

    activities.push(buildActivityFromPoints(currentItem.code, currentItem.name, activities.length, periodColumns, currentItem.points));
    currentItem = null;
  };

  rows.forEach((row) => {
    const code = readText(row.cells[codeColumn]);
    const name = readText(row.cells[nameColumn]);
    const controlText = controlColumn === null ? null : readText(row.cells[controlColumn]);
    const category = classifyControlText(controlText);

    if (category !== null) {
      currentCategory = category;
    }

    // Uma linha "agregada" (TOTAL/PERCENTUAL/VALOR ... do projeto inteiro,
    // nunca de um item específico) nunca inicia nem contamina um item da
    // EAP — só a variante "ACUMULADO" é de fato guardada (é a Curva S real);
    // "TOTAL DO PERÍODO..."/"...NO PERÍODO" são reconhecidas para serem
    // corretamente ignoradas, não para contaminar o último item visto.
    const isAggregateRow = name !== null && isNonItemLabel(name);

    // Início de um novo item: qualquer linha com nome preenchido que não
    // seja um rótulo agregado — cobre tanto itens numerados ("1.0
    // TERRAPLENAGEM") quanto ajustes contratuais sem código ("ARREDONDAMENTO
    // CONTRATUAL"). Linhas de continuação (% e R$ de PREVISTO/REALIZADO)
    // sempre têm o nome em branco neste layout.
    const isNewItemRow = !isAggregateRow && name !== null;

    if (isNewItemRow) {
      flushCurrentItem();
      currentItem = { code: code ?? `adj-${activities.length + 1}`, name, points: new Map() };
      currentCategory = category ?? "planned";
    }

    if (currentCategory === null) {
      return;
    }

    if (isAggregateRow) {
      if (normalize(name as string).includes("ACUMULADO")) {
        applyRowToPoints(row.cells, periodColumns, currentCategory, classifyAggregateMagnitude(name as string), aggregatePoints);
      }
      return;
    }

    if (currentItem !== null) {
      applyRowToPoints(row.cells, periodColumns, currentCategory, null, currentItem.points);
    }
  });

  flushCurrentItem();

  const periodSeries: PlanningPeriodSeries[] = [];
  if (aggregatePoints.size > 0) {
    periodSeries.push({
      activityId: null,
      label: "Curva S (agregado do projeto)",
      points: periodColumns.map((column) => toPeriodPoint(column, aggregatePoints.get(column.columnIndex))),
    });
  }

  if (activities.length === 0) {
    warnings.push({ code: "no_activities_recognized", message: "Nenhum item de EAP foi reconhecido na matriz de períodos." });
  }

  return { activities, periodSeries, warnings };
}

interface PeriodAccumulator {
  plannedPercent: number | null;
  plannedValue: number | null;
  actualPercent: number | null;
  actualValue: number | null;
}

function applyRowToPoints(
  cells: ReadonlyArray<string | number | null>,
  periodColumns: ReadonlyArray<DetectedPeriodColumn>,
  category: "planned" | "actual",
  forcedMagnitude: "percent" | "value" | null,
  points: Map<number, PeriodAccumulator>,
): void {
  const numericValues = periodColumns.map((column) => readNumber(cells[column.columnIndex]));
  const magnitude = forcedMagnitude ?? classifyMagnitude(numericValues);

  periodColumns.forEach((column, index) => {
    const value = numericValues[index];
    if (value === null) {
      return;
    }

    const accumulator = points.get(column.columnIndex) ?? { plannedPercent: null, plannedValue: null, actualPercent: null, actualValue: null };

    if (category === "planned") {
      if (magnitude === "percent") {
        accumulator.plannedPercent = value;
      } else {
        accumulator.plannedValue = value;
      }
    } else if (magnitude === "percent") {
      accumulator.actualPercent = value;
    } else {
      accumulator.actualValue = value;
    }

    points.set(column.columnIndex, accumulator);
  });
}

function classifyMagnitude(values: ReadonlyArray<number | null>): "percent" | "value" {
  const known = values.filter((value): value is number => value !== null);
  if (known.length === 0) {
    return "value";
  }

  const maxAbsolute = Math.max(...known.map((value) => Math.abs(value)));
  return maxAbsolute <= 1.5 ? "percent" : "value";
}

function classifyAggregateMagnitude(label: string): "percent" | "value" {
  return normalize(label).includes("PERCENTUAL") ? "percent" : "value";
}

function buildActivityFromPoints(
  code: string,
  name: string,
  sequence: number,
  periodColumns: ReadonlyArray<DetectedPeriodColumn>,
  points: Map<number, PeriodAccumulator>,
): PlanningActivityRecord {
  let plannedSum = 0;
  let actualSum = 0;
  let plannedValueSum = 0;
  let actualValueSum = 0;

  periodColumns.forEach((column) => {
    const point = points.get(column.columnIndex);
    if (point === undefined) {
      return;
    }
    plannedSum += point.plannedPercent ?? 0;
    actualSum += point.actualPercent ?? 0;
    plannedValueSum += point.plannedValue ?? 0;
    actualValueSum += point.actualValue ?? 0;
  });

  return {
    id: `excel-activity-${sequence}`,
    code,
    name,
    parentId: null,
    sequence,
    isSummary: false,
    isMilestone: false,
    plannedStart: null,
    plannedEnd: null,
    durationDays: null,
    percentPlanned: roundPercent(plannedSum),
    percentActual: roundPercent(actualSum),
    plannedValue: plannedValueSum > 0 ? plannedValueSum : null,
    actualValue: actualValueSum > 0 ? actualValueSum : null,
    weight: null,
    dependencies: [],
  };
}

function toPeriodPoint(column: DetectedPeriodColumn, accumulator: PeriodAccumulator | undefined): PlanningPeriodPoint {
  return {
    period: column.label,
    date: column.date,
    plannedPercent: accumulator?.plannedPercent ?? null,
    plannedValue: accumulator?.plannedValue ?? null,
    actualPercent: accumulator?.actualPercent ?? null,
    actualValue: accumulator?.actualValue ?? null,
  };
}

function roundPercent(value: number): number | null {
  if (value === 0) {
    return null;
  }
  return Math.round(value <= 1.5 ? value * 100 : value);
}

function classifyControlText(text: string | null): "planned" | "actual" | null {
  if (text === null) {
    return null;
  }

  const normalized = normalize(text);
  if (normalized.includes("PREVISTO") || normalized.includes("PLANEJADO")) {
    return "planned";
  }
  if (normalized.includes("REALIZADO") || normalized.includes("EXECUTADO")) {
    return "actual";
  }
  return null;
}

/**
 * Rótulos que descrevem o projeto inteiro (totais, percentuais
 * agregados, valores contratuais) — nunca o nome de um item real da
 * EAP neste layout. Reconhecer estas linhas evita que elas iniciem um
 * "item" próprio ou contaminem os números do último item real visto.
 */
function isNonItemLabel(name: string): boolean {
  const normalized = normalize(name);
  return normalized.includes("TOTAL") || normalized.includes("PERCENTUAL") || normalized.includes("VALOR");
}

const FINANCIAL_LABELS: Readonly<Record<keyof PlanningFinancialSummary, ReadonlyArray<string>>> = {
  contractValue: ["VALOR DO CONTRATO", "VALOR INICIAL DA OBRA"],
  amendmentsValue: ["VALOR DA OBRA APOS ADITIVOS"],
  measuredAccumulatedValue: ["VALOR EXECUTADO ACUMULADO", "MEDICAO ACUMULADA"],
  remainingBalanceValue: ["SALDO CONTRATUAL"],
};

function extractFinancialSummary(sheet: ExcelSheetDto): PlanningFinancialSummary | null {
  const summary: Record<string, number | null> = {
    contractValue: null,
    amendmentsValue: null,
    measuredAccumulatedValue: null,
    remainingBalanceValue: null,
  };

  let foundAny = false;

  (Object.keys(FINANCIAL_LABELS) as Array<keyof PlanningFinancialSummary>).forEach((field) => {
    const value = findLabeledValue(sheet, FINANCIAL_LABELS[field]);
    if (value !== null) {
      summary[field] = value;
      foundAny = true;
    }
  });

  return foundAny ? (summary as unknown as PlanningFinancialSummary) : null;
}

function findLabeledValue(sheet: ExcelSheetDto, labelTokens: ReadonlyArray<string>): number | null {
  for (const row of sheet.rows) {
    for (let column = 0; column < row.cells.length; column++) {
      const cell = row.cells[column];
      if (typeof cell !== "string") {
        continue;
      }

      const normalized = normalize(cell);
      if (!labelTokens.some((token) => normalized.includes(normalize(token)))) {
        continue;
      }

      for (let candidate = column + 1; candidate < row.cells.length; candidate++) {
        const value = readNumber(row.cells[candidate]);
        if (value !== null) {
          return value;
        }
      }
    }
  }

  return null;
}

function firstColumnOfKind(columns: ReadonlyArray<DetectedColumn>, kind: PlanningColumnKind): number | null {
  const found = columns.find((column) => column.kind === kind);
  return found === undefined ? null : found.columnIndex;
}

function readText(cell: string | number | null | undefined): string | null {
  if (cell === undefined || cell === null) {
    return null;
  }
  const text = String(cell).trim();
  return text.length === 0 ? null : text;
}

function readNumber(cell: string | number | null | undefined): number | null {
  if (cell === undefined || cell === null) {
    return null;
  }
  if (typeof cell === "number") {
    return cell;
  }
  const parsed = Number(cell.replace(",", "."));
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizePercent(value: number | null): number | null {
  if (value === null) {
    return null;
  }
  return value <= 1.5 ? Math.round(value * 100) : Math.round(value);
}

function readIsoDate(cell: string | number | null | undefined): string | null {
  if (cell === undefined || cell === null) {
    return null;
  }
  if (typeof cell === "number") {
    return new Date(Date.UTC(1899, 11, 30) + cell * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }
  const parsed = new Date(cell);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

export type { PlanningDetectedType };
