import { readXlsxWorkbook } from "../schedule-management/adapters/excel-import/xlsx-reader";
import type { ExcelSheetDto } from "../schedule-management/adapters/excel-import/xlsx-reader.types";
import type { MemoriaExtractionResult, MemoriaSheetLayout, ParsedMemoriaResumo } from "./measurement-item-documentary-history.types";

/**
 * Camada B (ESPECIFICAÇÃO) — protótipo determinístico de leitura das
 * abas "MEMÓRIA DE CÁLCULO" por item. Objetivo: FECHAR A ESPECIFICAÇÃO
 * (taxonomia de layouts, quantos itens são inequivocamente
 * interpretáveis, quais campos canônicos), não alimentar produção.
 * Nunca infere um campo a partir de outro; campo ilegível fica null.
 */

const CODE_SHEET = /^\d{2}\.\d{2}\.\d{2}$/;
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86_400_000;

const RESUMO_FIELDS: ReadonlyArray<{ key: keyof Pick<ParsedMemoriaResumo, "contractQuantity" | "executedAccumulatedQuantity" | "measuredAccumulatedQuantity" | "quantityToMeasureInPeriod" | "contractBalanceQuantity">; match: RegExp }> = [
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

function parseSheet(sheet: ExcelSheetDto): ParsedMemoriaResumo {
  const rows = sheet.rows;
  const flat = rows.map((r) => r.cells.map((c) => (c === null ? "" : String(c))));
  const hasMemoriaHeader = flat.slice(0, 4).some((cells) => cells.some((c) => /mem[óo]ria\s+de\s+c[áa]lculo/i.test(c)));
  const hasRefErrors = flat.some((cells) => cells.some((c) => c.includes("#REF!")));

  const resumoRowIndex = rows.findIndex((r) => r.cells.some((c) => typeof c === "string" && /^\s*RESUMO\s*$/i.test(c)));

  const base: Omit<ParsedMemoriaResumo, "layout" | "unambiguous"> = {
    itemCode: sheet.name,
    sheetName: sheet.name,
    hidden: sheet.hidden,
    unit: null,
    contractQuantity: null,
    executedAccumulatedQuantity: null,
    measuredAccumulatedQuantity: null,
    quantityToMeasureInPeriod: null,
    contractBalanceQuantity: null,
    freeformNotes: [],
    periodSeries: parsePeriodSeries(sheet)
  };

  if (!hasMemoriaHeader) {
    return { ...base, layout: "not_item_memoria", unambiguous: false };
  }
  if (resumoRowIndex < 0) {
    return { ...base, layout: "no_resumo_block", unambiguous: false };
  }

  let valueBeforeUnit = 0;
  let valueAfterUnit = 0;
  let labelBleed = 0;
  const notes: string[] = [];
  const values: Partial<Record<string, number | null>> = {};
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

    // Detecta ordem valor/unidade e possível vazamento do rótulo.
    const numericCells: Array<{ idx: number; value: number }> = [];
    const unitCells: Array<{ idx: number; value: string }> = [];
    let labelBled = false;
    texts.forEach((t, idx) => {
      const trimmed = t.trim();
      if (trimmed === "") return;
      const num = toNumber(trimmed);
      if (num !== null && !field.match.test(trimmed)) {
        numericCells.push({ idx, value: num });
      } else if (/^[A-Za-zÀ-ú²³.\s/x]{1,12}$/i.test(trimmed) && !field.match.test(trimmed) && !/^\.+$/.test(trimmed)) {
        unitCells.push({ idx, value: trimmed });
      } else if (field.match.test(trimmed) && /\.{4,}/.test(trimmed) && numericCells.length === 0 && unitCells.length === 0) {
        // rótulo com "........" preenchendo a linha e sem valor legível
        labelBled = true;
      }
    });

    let numeric: number | null = null;
    if (numericCells.length > 0) {
      const lastNumeric = numericCells[numericCells.length - 1];
      const lastUnit = unitCells[unitCells.length - 1];
      numeric = lastNumeric.value;
      if (lastUnit) {
        if (lastUnit.idx < lastNumeric.idx) valueBeforeUnit++;
        else valueAfterUnit++;
        unit = unit ?? lastUnit.value.toUpperCase().replace(/\s+/g, "");
      }
    } else if (labelBled) {
      labelBleed++;
    }

    values[field.key] = numeric;
  }

  const contractQuantity = values.contractQuantity ?? null;
  const executedAccumulatedQuantity = values.executedAccumulatedQuantity ?? null;
  const measuredAccumulatedQuantity = values.measuredAccumulatedQuantity ?? null;
  const quantityToMeasureInPeriod = values.quantityToMeasureInPeriod ?? null;
  const contractBalanceQuantity = values.contractBalanceQuantity ?? null;

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
    contractQuantity !== null &&
    measuredAccumulatedQuantity !== null &&
    quantityToMeasureInPeriod !== null;

  return {
    ...base,
    unit,
    contractQuantity,
    executedAccumulatedQuantity,
    measuredAccumulatedQuantity,
    quantityToMeasureInPeriod,
    contractBalanceQuantity,
    freeformNotes: notes,
    layout,
    unambiguous
  };
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
    const cells = rows[i].cells;
    // procura um serial de data plausível e o próximo número como quantidade
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

function toNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}
