import { readXlsxWorkbook } from "../schedule-management/adapters/excel-import/xlsx-reader";
import type { ExcelCellValue, ExcelSheetDto } from "../schedule-management/adapters/excel-import/xlsx-reader.types";
import type { MemoriaExtractionResult, MemoriaSheetLayout, ParsedMemoriaResumo } from "./measurement-item-documentary-history.types";

/**
 * Camada B — leitura determinística das abas "MEMÓRIA DE CÁLCULO" por
 * item. NÃO alimenta produção nesta rodada; primeiro FECHA a
 * caracterização documental (taxonomia de layouts, número/período da
 * medição de CADA aba — que NÃO estão todas no mesmo corte —, quantos
 * itens são inequivocamente interpretáveis, formato numérico por aba).
 *
 * Nunca infere um campo a partir de outro; campo ilegível fica `null`.
 * Célula já numérica é usada VERBATIM (sem re-parse que destruiria o
 * decimal); célula de TEXTO passa por detecção de formato pt-BR
 * (vírgula decimal) vs. ponto (milhar/decimal) — quando não dá para
 * decidir, o valor é marcado como não inequívoco.
 */

const CODE_SHEET = /^\d{2}\.\d{2}\.\d{2}$/;
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86_400_000;
const MEASUREMENT_HEADER = /mem[óo]ria\s+de\s+c[áa]lculo/i;
const MEASUREMENT_NUMBER = /medi[çc][ãa]o\s*n?[ºo°.]?\s*(\d{1,3})/i;

const RESUMO_FIELDS: ReadonlyArray<{
  key: keyof Pick<
    ParsedMemoriaResumo,
    "contractQuantity" | "executedAccumulatedQuantity" | "measuredAccumulatedQuantity" | "quantityToMeasureInPeriod" | "contractBalanceQuantity"
  >;
  match: RegExp;
}> = [
  { key: "contractQuantity", match: /quantidade\s+contratada/i },
  { key: "executedAccumulatedQuantity", match: /quantidade\s+executada\s+acumulada/i },
  { key: "measuredAccumulatedQuantity", match: /quantidade\s+medida\s+acumulada/i },
  { key: "quantityToMeasureInPeriod", match: /quantidade\s+a\s+medir\s+no\s+per[íi]odo/i },
  { key: "contractBalanceQuantity", match: /saldo\s+contratual/i }
];

export function extractMemoriasDeCalculo(bytes: Uint8Array, sourceFileName: string): MemoriaExtractionResult {
  const workbook = readXlsxWorkbook(bytes);
  const codeSheets = workbook.sheets.filter((s) => CODE_SHEET.test(s.name));

  const parsed = codeSheets.map((sheet) => parseSheet(sheet));

  const layoutCounts = parsed.reduce<Record<MemoriaSheetLayout, number>>(
    (acc, p) => {
      acc[p.layout] = (acc[p.layout] ?? 0) + 1;
      return acc;
    },
    {
      resumo_value_after_unit: 0,
      resumo_value_before_unit: 0,
      resumo_label_bleed: 0,
      resumo_with_ref_errors: 0,
      no_resumo_block: 0,
      not_item_memoria: 0
    }
  );

  return {
    sourceFileName,
    totalCodeSheets: codeSheets.length,
    parsed,
    layoutCounts,
    unambiguousCount: parsed.filter((p) => p.unambiguous).length,
    codesWithoutMemoria: []
  };
}

interface FieldRead {
  readonly value: number | null;
  /** true quando o valor veio de uma célula numérica OU de texto com formato decidível. */
  readonly confident: boolean;
}

function parseSheet(sheet: ExcelSheetDto): ParsedMemoriaResumo {
  const rows = sheet.rows;
  const flat = rows.map((r) => r.cells.map((c) => (c === null ? "" : String(c))));
  const headerText = flat
    .slice(0, 4)
    .map((cells) => cells.join(" "))
    .find((line) => MEASUREMENT_HEADER.test(line))
    ?.replace(/\s+/g, " ")
    .trim();
  const hasMemoriaHeader = headerText !== undefined;
  const hasRefErrors = flat.some((cells) => cells.some((c) => c.includes("#REF!")));

  const measurementHeaderRaw = headerText ?? null;
  const measurementNumberMatch = headerText ? MEASUREMENT_NUMBER.exec(headerText) : null;
  const measurementNumber = measurementNumberMatch ? Number.parseInt(measurementNumberMatch[1], 10) : null;
  const measurementPeriodLabel = extractPeriodLabel(headerText ?? null);

  const resumoRowIndex = rows.findIndex((r) => r.cells.some((c) => typeof c === "string" && /^\s*RESUMO\s*$/i.test(c)));

  const base: Omit<
    ParsedMemoriaResumo,
    "layout" | "unambiguous" | "numericFormatHint" | "contractQuantity" | "executedAccumulatedQuantity" | "measuredAccumulatedQuantity" | "quantityToMeasureInPeriod" | "contractBalanceQuantity" | "unit" | "freeformNotes"
  > = {
    itemCode: sheet.name,
    sheetName: sheet.name,
    hidden: sheet.hidden,
    measurementHeaderRaw,
    measurementNumber,
    measurementPeriodLabel,
    periodSeries: parsePeriodSeries(sheet)
  };

  const emptyNumbers = {
    contractQuantity: null,
    executedAccumulatedQuantity: null,
    measuredAccumulatedQuantity: null,
    quantityToMeasureInPeriod: null,
    contractBalanceQuantity: null
  } as const;

  if (!hasMemoriaHeader) {
    return { ...base, ...emptyNumbers, unit: null, freeformNotes: [], numericFormatHint: "ambiguous", layout: "not_item_memoria", unambiguous: false };
  }
  if (resumoRowIndex < 0) {
    return { ...base, ...emptyNumbers, unit: null, freeformNotes: [], numericFormatHint: "ambiguous", layout: "no_resumo_block", unambiguous: false };
  }

  let valueBeforeUnit = 0;
  let valueAfterUnit = 0;
  let labelBleed = 0;
  let commaDecimalHits = 0;
  let dotDecimalHits = 0;
  let textCellCount = 0;
  const notes: string[] = [];
  const values: Partial<Record<string, FieldRead>> = {};
  let unit: string | null = null;

  for (let i = resumoRowIndex + 1; i < Math.min(resumoRowIndex + 14, rows.length); i++) {
    const cells = rows[i].cells;
    const texts = cells.map((c) => (c === null ? "" : String(c)));
    const rowText = texts.join(" ").trim();
    if (rowText === "") continue;

    const field = RESUMO_FIELDS.find((f) => texts.some((t) => f.match.test(t)));
    if (!field) {
      if (/[A-Za-zÀ-ú]{8,}/.test(rowText) && !/quant/i.test(rowText)) notes.push(rowText.slice(0, 200));
      continue;
    }

    const numericCells: Array<{ idx: number; value: number; confident: boolean }> = [];
    const unitCells: Array<{ idx: number; value: string }> = [];
    let labelBled = false;

    cells.forEach((cell, idx) => {
      if (cell === null) return;
      if (typeof cell === "number") {
        if (Number.isFinite(cell)) numericCells.push({ idx, value: cell, confident: true });
        return;
      }
      const trimmed = String(cell).trim();
      if (trimmed === "" || field.match.test(trimmed)) {
        if (field.match.test(trimmed) && /\.{4,}/.test(trimmed) && numericCells.length === 0 && unitCells.length === 0) {
          labelBled = true;
        }
        return;
      }
      const textNumber = parseTextNumber(trimmed);
      if (textNumber !== null) {
        textCellCount++;
        if (textNumber.format === "comma_decimal") commaDecimalHits++;
        if (textNumber.format === "dot_decimal") dotDecimalHits++;
        numericCells.push({ idx, value: textNumber.value, confident: textNumber.format !== "ambiguous" });
      } else if (/^[A-Za-zÀ-ú²³.\s/x]{1,12}$/i.test(trimmed) && !/^\.+$/.test(trimmed)) {
        unitCells.push({ idx, value: trimmed });
      }
    });

    if (numericCells.length > 0) {
      const lastNumeric = numericCells[numericCells.length - 1];
      const lastUnit = unitCells[unitCells.length - 1];
      if (lastUnit) {
        if (lastUnit.idx < lastNumeric.idx) valueBeforeUnit++;
        else valueAfterUnit++;
        unit = unit ?? lastUnit.value.toUpperCase().replace(/\s+/g, "");
      }
      values[field.key] = { value: lastNumeric.value, confident: lastNumeric.confident };
    } else if (labelBled) {
      labelBleed++;
      values[field.key] = { value: null, confident: false };
    }
  }

  const numericFormatHint: ParsedMemoriaResumo["numericFormatHint"] =
    textCellCount === 0
      ? "dot_decimal" // só células numéricas -> sem ambiguidade de formato
      : commaDecimalHits > 0 && dotDecimalHits === 0
        ? "comma_decimal"
        : dotDecimalHits > 0 && commaDecimalHits === 0
          ? "dot_decimal"
          : "ambiguous";

  const read = (key: string): number | null => values[key]?.value ?? null;
  const confident = (key: string): boolean => values[key]?.confident ?? false;

  const contractQuantity = read("contractQuantity");
  const executedAccumulatedQuantity = read("executedAccumulatedQuantity");
  const measuredAccumulatedQuantity = read("measuredAccumulatedQuantity");
  const quantityToMeasureInPeriod = read("quantityToMeasureInPeriod");
  const contractBalanceQuantity = read("contractBalanceQuantity");

  const layout: MemoriaSheetLayout = hasRefErrors
    ? "resumo_with_ref_errors"
    : labelBleed > 0
      ? "resumo_label_bleed"
      : valueBeforeUnit > valueAfterUnit
        ? "resumo_value_before_unit"
        : "resumo_value_after_unit";

  const unambiguous =
    layout !== "resumo_with_ref_errors" &&
    layout !== "resumo_label_bleed" &&
    numericFormatHint !== "ambiguous" &&
    contractQuantity !== null &&
    confident("contractQuantity") &&
    measuredAccumulatedQuantity !== null &&
    confident("measuredAccumulatedQuantity") &&
    quantityToMeasureInPeriod !== null &&
    confident("quantityToMeasureInPeriod");

  return {
    ...base,
    unit,
    contractQuantity,
    executedAccumulatedQuantity,
    measuredAccumulatedQuantity,
    quantityToMeasureInPeriod,
    contractBalanceQuantity,
    freeformNotes: notes,
    numericFormatHint,
    layout,
    unambiguous
  };
}

/** "...MEDIÇÃO Nº 08  -JUNHO / 2026" -> "JUNHO / 2026". null quando não há sufixo de mês/ano. */
function extractPeriodLabel(headerText: string | null): string | null {
  if (headerText === null) return null;
  const afterNumber = headerText.replace(MEASUREMENT_NUMBER, "").replace(/^.*?mem[óo]ria\s+de\s+c[áa]lculo/i, "");
  const monthYear = /([A-Za-zÀ-ú]{3,10})\s*\/\s*(\d{4})/.exec(afterNumber);
  return monthYear ? `${monthYear[1].toUpperCase()} / ${monthYear[2]}` : null;
}

interface TextNumber {
  readonly value: number;
  readonly format: "comma_decimal" | "dot_decimal" | "ambiguous";
}

/**
 * Interpreta um número em TEXTO respeitando o formato pt-BR. Regras
 * explícitas, sem adivinhação silenciosa:
 *  - "1.234,56"  -> ponto = milhar, vírgula = decimal            (comma_decimal)
 *  - "430,92"    -> vírgula decimal                              (comma_decimal)
 *  - "43.092"    -> um único ponto seguido de 3 dígitos = milhar; SEM vírgula
 *                   -> AMBÍGUO (pode ser 43092 ou 43,092)        (ambiguous)
 *  - "430.92"    -> um único ponto seguido de 1–2 dígitos = decimal (dot_decimal)
 *  - "8" / "-14" -> inteiro                                      (dot_decimal)
 */
function parseTextNumber(raw: string): TextNumber | null {
  const t = raw.trim().replace(/\s/g, "");
  if (!/^-?[\d.,]+$/.test(t) || !/\d/.test(t)) return null;

  const hasComma = t.includes(",");
  const hasDot = t.includes(".");

  if (hasComma) {
    // vírgula é sempre decimal aqui; pontos são milhar
    const normalized = t.replace(/\./g, "").replace(",", ".");
    const n = Number.parseFloat(normalized);
    return Number.isFinite(n) ? { value: n, format: "comma_decimal" } : null;
  }

  if (hasDot) {
    const dotCount = (t.match(/\./g) ?? []).length;
    const lastGroup = t.split(".").pop() ?? "";
    if (dotCount === 1 && lastGroup.length <= 2) {
      const n = Number.parseFloat(t);
      return Number.isFinite(n) ? { value: n, format: "dot_decimal" } : null;
    }
    if (dotCount >= 1 && lastGroup.length === 3) {
      // "43.092" ou "1.234.567" — provável milhar, mas SEM vírgula não dá
      // para descartar decimal. Ambíguo por design.
      const n = Number.parseFloat(t.replace(/\./g, ""));
      return Number.isFinite(n) ? { value: n, format: "ambiguous" } : null;
    }
    const n = Number.parseFloat(t.replace(/\./g, ""));
    return Number.isFinite(n) ? { value: n, format: "ambiguous" } : null;
  }

  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) ? { value: n, format: "dot_decimal" } : null;
}

function parsePeriodSeries(sheet: ExcelSheetDto): ParsedMemoriaResumo["periodSeries"] {
  const rows = sheet.rows;
  const headerIdx = rows.findIndex((r) => {
    const t = r.cells.map((c) => (c === null ? "" : String(c)));
    return t.some((x) => /^PER[ÍI]ODO$/i.test(x.trim())) && t.some((x) => /^QUANTIDADE$/i.test(x.trim()));
  });
  if (headerIdx < 0) return [];
  const out: Array<{ date: string | null; rawPeriod: string; quantity: number | null }> = [];
  for (let i = headerIdx + 1; i < Math.min(headerIdx + 20, rows.length); i++) {
    const cells: ReadonlyArray<ExcelCellValue> = rows[i].cells;
    const dateIdx = cells.findIndex((c) => typeof c === "number" && c >= 20000 && c <= 100000);
    if (dateIdx < 0) {
      if (rows[i].cells.every((c) => c === null || String(c).trim() === "")) break;
      continue;
    }
    const serial = cells[dateIdx] as number;
    const qty = cells.slice(dateIdx + 1).find((c) => typeof c === "number");
    out.push({
      date: new Date(EXCEL_EPOCH + serial * MS_PER_DAY).toISOString().slice(0, 10),
      rawPeriod: String(serial),
      quantity: typeof qty === "number" ? qty : null
    });
  }
  return out;
}
