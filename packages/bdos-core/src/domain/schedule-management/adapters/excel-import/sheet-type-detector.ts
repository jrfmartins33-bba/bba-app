import type { ExcelSheetDto } from "./xlsx-reader.types";
import type { DetectedColumn, DetectedPeriodColumn, PlanningColumnKind, SheetDetectionResult } from "./sheet-type-detector.types";

/**
 * BBA Project Studio — Sprint 1 (PARTE 6). Reconhece variações comuns
 * de cabeçalho de planilhas de planejamento — nunca inventa uma
 * coluna que não existe; uma coluna não reconhecida simplesmente não
 * entra em `columns`/`periodColumns`, e quem chama esta função decide
 * o que fazer com a lacuna (gerar warning, importar parcialmente).
 */
const HEADER_TOKENS: ReadonlyArray<readonly [PlanningColumnKind, ReadonlyArray<string>]> = [
  ["code", ["EAP", "WBS", "CODIGO", "ITEM"]],
  ["name", ["ATIVIDADE", "DESCRICAO", "SERVICO"]],
  ["start", ["INICIO", "DATA INICIO", "START"]],
  ["end", ["FIM", "TERMINO", "FINISH"]],
  ["duration", ["DURACAO", "DURATION"]],
  ["predecessors", ["PREDECESSORAS", "DEPENDENCIAS", "PREDECESSORS"]],
  ["percent", ["PERCENTUAL", "%", "AVANCO"]],
  ["value", ["VALOR", "CUSTO", "FINANCEIRO"]],
  ["weight", ["PESO"]],
  ["control", ["CONTROLE"]],
];

const ROWS_SCANNED_FOR_HEADER = 40;
const PERIOD_LABEL_PATTERN = /^MES\.?\s*\d+$/;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const COMBINING_DIACRITIC_RANGE_START = 0x0300;
const COMBINING_DIACRITIC_RANGE_END = 0x036f;

export function detectSheetPlanningType(sheet: ExcelSheetDto): SheetDetectionResult {
  const { headerRowIndex, columns } = findHeaderRow(sheet);
  const { periodHeaderRowIndex, periodColumns } = findPeriodRow(sheet);

  const hasCode = columns.some((c) => c.kind === "code");
  const hasName = columns.some((c) => c.kind === "name");
  const hasStartOrEnd = columns.some((c) => c.kind === "start" || c.kind === "end");
  const hasPredecessorColumn = columns.some((c) => c.kind === "predecessors");
  const hasValueColumn = columns.some((c) => c.kind === "value");
  const hasControl = columns.some((c) => c.kind === "control");

  const looksLikeCronograma = hasCode && hasName && hasStartOrEnd;
  const looksLikePeriodMatrix = periodColumns.length >= 3 && (hasControl || hasValueColumn) && hasCode;

  let detectedType: SheetDetectionResult["detectedType"];
  if (looksLikeCronograma && looksLikePeriodMatrix) {
    detectedType = "mixed";
  } else if (looksLikeCronograma) {
    detectedType = "cronograma";
  } else if (looksLikePeriodMatrix) {
    detectedType = hasValueColumn ? "fisico-financeiro" : "curva-s";
  } else {
    detectedType = "unknown";
  }

  const confidence = columns.length + periodColumns.length + (hasStartOrEnd ? 2 : 0) + (hasCode && hasName ? 2 : 0);

  return {
    detectedType,
    headerRowIndex,
    columns,
    periodHeaderRowIndex,
    periodColumns,
    hasPredecessorColumn,
    hasValueColumn,
    confidence,
  };
}

/**
 * Vence a linha com mais TIPOS distintos reconhecidos, não a linha com
 * mais correspondências brutas — um cabeçalho real introduz várias
 * categorias diferentes (código, nome, valor...), enquanto uma
 * sub-linha de um cabeçalho em duas linhas costuma repetir um único
 * tipo várias vezes (ex.: "FINANCEIRO" uma vez por coluna de período)
 * e, por contagem bruta, venceria incorretamente a linha real. A
 * contagem bruta só desempata entre linhas com a mesma diversidade.
 */
function findHeaderRow(sheet: ExcelSheetDto): { headerRowIndex: number | null; columns: ReadonlyArray<DetectedColumn> } {
  let best: { rowIndex: number; columns: DetectedColumn[]; distinctKinds: number } | null = null;

  sheet.rows.slice(0, ROWS_SCANNED_FOR_HEADER).forEach((row, rowIndex) => {
    const columns: DetectedColumn[] = [];

    row.cells.forEach((cell, columnIndex) => {
      if (typeof cell !== "string") {
        return;
      }

      const kind = classifyHeaderToken(cell);
      if (kind !== null) {
        columns.push({ columnIndex, kind, header: cell });
      }
    });

    const distinctKinds = new Set(columns.map((column) => column.kind)).size;
    const isBetter =
      best === null || distinctKinds > best.distinctKinds || (distinctKinds === best.distinctKinds && columns.length > best.columns.length);

    if (columns.length >= 2 && isBetter) {
      best = { rowIndex, columns, distinctKinds };
    }
  });

  const resolved = best as { rowIndex: number; columns: DetectedColumn[]; distinctKinds: number } | null;
  return resolved === null ? { headerRowIndex: null, columns: [] } : { headerRowIndex: resolved.rowIndex, columns: resolved.columns };
}

function findPeriodRow(sheet: ExcelSheetDto): { periodHeaderRowIndex: number | null; periodColumns: ReadonlyArray<DetectedPeriodColumn> } {
  let best: { rowIndex: number; columns: DetectedPeriodColumn[] } | null = null;

  sheet.rows.slice(0, ROWS_SCANNED_FOR_HEADER).forEach((row, rowIndex) => {
    const matches: DetectedPeriodColumn[] = [];

    row.cells.forEach((cell, columnIndex) => {
      if (typeof cell !== "string") {
        return;
      }

      if (PERIOD_LABEL_PATTERN.test(normalize(cell))) {
        matches.push({ columnIndex, label: cell, date: null });
      }
    });

    if (matches.length >= 3 && (best === null || matches.length > best.columns.length)) {
      best = { rowIndex, columns: matches };
    }
  });

  const resolved = best as { rowIndex: number; columns: DetectedPeriodColumn[] } | null;
  if (resolved === null) {
    return { periodHeaderRowIndex: null, periodColumns: [] };
  }

  // A linha imediatamente abaixo do rótulo do período costuma trazer a data
  // real (serial do Excel) alinhada com cada coluna — usada só quando
  // presente, nunca inventada.
  const dateRow = sheet.rows[resolved.rowIndex + 1];
  const columnsWithDates = resolved.columns.map((column) => {
    const rawDate = dateRow?.cells[column.columnIndex];
    const date = typeof rawDate === "number" && isPlausibleExcelDateSerial(rawDate) ? excelSerialToIsoDate(rawDate) : null;
    return { ...column, date };
  });

  return { periodHeaderRowIndex: resolved.rowIndex, periodColumns: columnsWithDates };
}

/**
 * Correspondência por substring, não igualdade exata — cabeçalhos
 * reais raramente são o token puro ("VALOR TOTAL (R$)", não apenas
 * "VALOR"). `%` é comparado sem normalizar (a normalização remove
 * símbolos de outras naturezas, mas preserva `%`).
 */
function classifyHeaderToken(rawHeader: string): PlanningColumnKind | null {
  const normalized = normalize(rawHeader);

  for (const [kind, tokens] of HEADER_TOKENS) {
    if (tokens.some((token) => normalized.includes(normalize(token)))) {
      return kind;
    }
  }

  return null;
}

export function normalize(value: string): string {
  return stripDiacritics(value.normalize("NFD"))
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function stripDiacritics(value: string): string {
  return Array.from(value)
    .filter((char) => {
      const codePoint = char.codePointAt(0) ?? 0;
      return codePoint < COMBINING_DIACRITIC_RANGE_START || codePoint > COMBINING_DIACRITIC_RANGE_END;
    })
    .join("");
}

/**
 * Só trata um número como serial de data do Excel se estiver numa
 * faixa plausível (~1954 a ~2173) — evita confundir percentuais
 * pequenos (0.5) ou valores monetários/contagens que por acaso caiam
 * na linha logo abaixo do cabeçalho de período.
 */
function isPlausibleExcelDateSerial(value: number): boolean {
  return value >= 20000 && value <= 100000;
}

function excelSerialToIsoDate(serial: number): string {
  return new Date(EXCEL_EPOCH_UTC + serial * MS_PER_DAY).toISOString().slice(0, 10);
}
