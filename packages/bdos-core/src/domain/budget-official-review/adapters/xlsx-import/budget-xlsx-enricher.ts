import { readXlsxWorkbookRaw } from "../../../schedule-management/adapters/excel-import/xlsx-reader";
import type { ExcelCellRaw, ExcelWorkbookRaw } from "../../../schedule-management/adapters/excel-import/xlsx-reader.types";
import { detectCalculationRule } from "../../budget-official-review-economic-value";
import type { BudgetReviewSession, BudgetSourceCalculationRule } from "../../budget-official-review.types";

/**
 * Enriquecimento automático e determinístico da regra de cálculo para sessões existentes (Sprint 21.5C.4).
 * Lê o XLSX original bruto (`readXlsxWorkbookRaw`), identifica as colunas
 * semanticamente por aba, lê as fórmulas `<f>` reais de cada célula TOTAL
 * e associa a `BudgetSourceCalculationRule` exata a cada `BudgetReviewRow` em memória.
 * NUNCA depende do nome da aba, NUNCA usa regras hardcoded, NUNCA reimporta dados.
 */
export function enrichSessionCalculationRules(
  session: BudgetReviewSession,
  xlsxBytes: Uint8Array,
): BudgetReviewSession {
  const rawWorkbook = readXlsxWorkbookRaw(xlsxBytes);
  const ruleMap = buildWorkbookCalculationRuleMap(rawWorkbook);

  const updatedRows = session.rows.map((row) => {
    if (row.calculationRule) return row;

    if (row.evidenceText) {
      const sheetMatch = /\|sheet=([^|]+)/.exec(row.evidenceText);
      const rowMatch = /\|row=(\d+)/.exec(row.evidenceText);
      if (sheetMatch && rowMatch) {
        const key = `${sheetMatch[1]}:${rowMatch[2]}`;
        const rule = ruleMap.get(key);
        if (rule) {
          return { ...row, calculationRule: rule };
        }
      }
    }
    return row;
  });

  return { ...session, rows: updatedRows };
}

/**
 * Mapeia todas as células orçamentárias de todas as folhas do workbook,
 * associando `${sheetName}:${rowNumber}` -> `BudgetSourceCalculationRule`.
 */
export function buildWorkbookCalculationRuleMap(
  workbook: ExcelWorkbookRaw,
): Map<string, BudgetSourceCalculationRule> {
  const ruleMap = new Map<string, BudgetSourceCalculationRule>();

  for (const sheet of workbook.sheets) {
    if (sheet.hidden || sheet.rows.length === 0) continue;

    // Localizar linha de cabeçalho
    const headerInfo = findHeaderRowAndRoles(sheet.rows);
    if (headerInfo === null) continue;

    const { totalColIdx, quantityColLetter, unitPriceColLetter } = headerInfo;

    for (const row of sheet.rows) {
      if (row.rowNumber <= headerInfo.headerRowNumber) continue;

      const totalCell = row.cells[totalColIdx];
      if (totalCell === undefined) continue;

      const rule = detectCalculationRule(totalCell.formula ?? null, {
        quantityColLetter,
        unitPriceColLetter,
      });

      const key = `${sheet.name}:${row.rowNumber}`;
      ruleMap.set(key, rule);
    }
  }

  return ruleMap;
}

interface HeaderInfo {
  headerRowNumber: number;
  totalColIdx: number;
  quantityColLetter?: string;
  unitPriceColLetter?: string;
}

function findHeaderRowAndRoles(rows: ReadonlyArray<import("../../../schedule-management/adapters/excel-import/xlsx-reader.types").ExcelSheetRowRaw>): HeaderInfo | null {
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const row = rows[i]!;
    let totalColIdx = -1;
    let quantityColLetter: string | undefined;
    let unitPriceColLetter: string | undefined;

    for (let c = 0; c < row.cells.length; c++) {
      const cell = row.cells[c];
      if (cell === undefined || typeof cell.value !== "string") continue;
      const norm = cell.value.toUpperCase();

      if ((norm.includes("TOTAL C/BDI") || norm.includes("VR TOTAL") || norm.includes("VALOR TOTAL") || norm.includes("PRECO TOTAL") || (norm.includes("TOTAL") && !norm.includes("SUBTOTAL"))) && totalColIdx === -1) {
        totalColIdx = c;
      }
      if ((norm.includes("QUANT") || norm.includes("QTD")) && quantityColLetter === undefined) {
        quantityColLetter = cell.columnRef;
      }
      if ((norm.includes("C/BDI") || norm.includes("UNIT C/ BDI") || norm.includes("PRECO UNIT")) && unitPriceColLetter === undefined) {
        unitPriceColLetter = cell.columnRef;
      }
    }

    if (totalColIdx !== -1) {
      return {
        headerRowNumber: row.rowNumber,
        totalColIdx,
        quantityColLetter,
        unitPriceColLetter,
      };
    }
  }
  return null;
}
