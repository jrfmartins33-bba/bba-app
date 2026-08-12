/**
 * Sprint 21.5B — Importador determinístico de orçamento a partir de
 * planilha XLSX estruturada (Office Open XML).
 *
 * Recebe `ExcelWorkbookRaw` (produzido por `readXlsxWorkbookRaw`) e um
 * contexto externo; devolve `ImportBudgetReviewRowInput[]` + diagnósticos.
 *
 * Não persiste, não cria BudgetVersion, não aciona LLM, não conhece
 * Alagoas, DNOCS, quantidades esperadas nem nenhum cliente específico.
 * É uma transformação determinística pura (mesma entrada → mesma saída).
 *
 * Importação do reader a partir de `schedule-management/adapters`:
 * o guard de arquitetura (`engineering-boundaries.test.ts`) não proíbe
 * esta direção (`budget-official-review` não está na lista de domínios
 * operacionais protegidos) e o reader produz um DTO neutro sem lógica
 * de domínio de cronograma.
 */

import type { ExcelCellRaw, ExcelSheetRaw, ExcelWorkbookRaw } from "../../../schedule-management/adapters/excel-import/xlsx-reader.types";
import { BudgetLineKind } from "../../../budget-version";
import type { BudgetReviewRowKind, ImportBudgetReviewRowInput } from "../../budget-official-review.types";
import { BUDGET_XLSX_IMPORTER_VERSION } from "./budget-xlsx-importer.types";
import type {
  BudgetColumnRole,
  BudgetXlsxDiagnosticSeverity,
  BudgetXlsxImportContext,
  BudgetXlsxImportDiagnostic,
  BudgetXlsxImportResult,
  BudgetXlsxImportSummary,
  DetectedColumnRole,
} from "./budget-xlsx-importer.types";

// ---------------------------------------------------------------------------
// Public entry-point
// ---------------------------------------------------------------------------

/**
 * Importa linhas de orçamento a partir de um workbook XLSX estruturado.
 *
 * @param workbook  Resultado de `readXlsxWorkbookRaw(bytes)`.
 * @param context   Contexto fornecido pelo orquestrador (não inferido do XLSX).
 * @returns         Linhas candidatas + diagnósticos + sumário.
 */
export function importBudgetFromXlsx(
  workbook: ExcelWorkbookRaw,
  context: BudgetXlsxImportContext,
): BudgetXlsxImportResult {
  const diagnostics: BudgetXlsxImportDiagnostic[] = [];

  // Step 1 — Detect the budget sheet
  const sheetResult = detectOrcamentoSheet(workbook.sheets, diagnostics);
  if (sheetResult === null) {
    return makeResult([], diagnostics, nullSummary());
  }

  // Step 2 — Detect column roles (supports multi-row header merging)
  const colResult = detectColumnRoles(sheetResult.sheet, diagnostics);
  if (colResult === null) {
    return makeResult([], diagnostics, { ...nullSummary(), sheetName: sheetResult.sheet.name });
  }

  // Step 3 — Classify all data rows, attaching roles for field mapping
  const classified = classifyRows(sheetResult.sheet, colResult.headerRowNumber, colResult.roles, context);

  // Step 4 — Resolve hierarchy (parentRowId)
  const withHierarchy = resolveHierarchy(classified, diagnostics);

  // Step 5 — Build ImportBudgetReviewRowInput[] (exclude orphans)
  const accepted = withHierarchy.filter((r) => !r.orphan);
  const rows = accepted.map((row) => buildInputRow(row, context, sheetResult.sheet.name));

  const summary: BudgetXlsxImportSummary = {
    groupCount: accepted.filter((r) => r.kind === BudgetLineKind.Group).length,
    subgroupCount: accepted.filter((r) => r.kind === BudgetLineKind.Subgroup).length,
    serviceItemCount: accepted.filter((r) => r.kind === BudgetLineKind.ServiceItem).length,
    totalRowCount: rows.length,
    skippedRowCount: withHierarchy.filter((r) => r.orphan).length,
    orphanCount: withHierarchy.filter((r) => r.orphan).length,
    sheetName: sheetResult.sheet.name,
    headerRowNumber: colResult.headerRowNumber,
  };

  return makeResult(rows, diagnostics, summary);
}

// ---------------------------------------------------------------------------
// Sheet detection & Header detection
// ---------------------------------------------------------------------------

/**
 * Tokens de papéis de coluna esperados em uma planilha orçamentária.
 * Normalizados (sem acento, uppercase). Suporta variações oficiais brasileiras.
 */
const COLUMN_ROLE_TOKENS: ReadonlyArray<{ role: BudgetColumnRole; tokens: ReadonlyArray<string> }> = [
  { role: "itemCode", tokens: ["ITEM", "N. ", "N.°", "N°"] },
  { role: "sourceCode", tokens: ["CODIGO", "COD COMP", "COMPOSICAO", "COMP."] },
  { role: "sourceType", tokens: ["BANCO", "FONTE DE PESQUISA", "FONTE", "TIPO", "ORIGEM"] },
  { role: "description", tokens: ["DESCRICAO", "DESCR", "DENOMINACAO", "ESPECIFICACAO"] },
  { role: "unit", tokens: ["UNID", "UNIDADE", "UND", "UN."] },
  { role: "quantity", tokens: ["QUANT", "QUANT.", "QTD", "QDE"] },
  { role: "bdiPct", tokens: ["BDI (%)", "BDI"] },
  { role: "unitCostNoBdi", tokens: ["CUSTO UNIT.S/BDI", "VALOR UNIT S/ BDI", "CUSTO UNIT", "UNIT S/ BDI", "UNIT SEM BDI", "UNIT S/BDI"] },
  { role: "unitPriceWithBdi", tokens: ["UNIT. C/ BDI", "VALOR UNIT C/ BDI", "PRECO UNIT C/ BDI", "PRECO UNIT", "PRECO FINAL", "UNIT C/ BDI", "C/BDI"] },
  { role: "total", tokens: ["TOTAL C/BDI", "TOTAL C/ BDI", "VALOR TOTAL", "VR TOTAL", "PRECO TOTAL", "PRECO TOT", "TOTAL"] },
];

const REQUIRED_ROLES: ReadonlyArray<BudgetColumnRole> = ["itemCode", "description", "unit", "quantity", "total"];
const MIN_ROLE_SCORE = 4;
const MAX_HEADER_SCAN_ROWS = 20;

interface SheetCandidate {
  readonly sheet: ExcelSheetRaw;
  readonly headerRowNumber: number;
  readonly score: number;
}

function detectOrcamentoSheet(
  sheets: ReadonlyArray<ExcelSheetRaw>,
  diagnostics: BudgetXlsxImportDiagnostic[],
): { sheet: ExcelSheetRaw; headerRowNumber: number } | null {
  const candidates = scoreSheetsForBudgetContent(sheets);

  if (candidates.length === 0 || (candidates[0]?.score ?? 0) < MIN_ROLE_SCORE) {
    diagnostics.push(diag("error", "SHEET_NOT_FOUND",
      `Nenhuma planilha com estrutura orçamentária encontrada (score mínimo: ${MIN_ROLE_SCORE}).`, {
        sheetsScanned: sheets.map((s) => s.name),
        bestScore: candidates[0]?.score ?? 0,
      }));
    return null;
  }

  const topScore = candidates[0]!.score;
  const topCandidates = candidates.filter((c) => c.score === topScore);

  if (topCandidates.length > 1) {
    diagnostics.push(diag("error", "AMBIGUOUS_SHEET",
      `${topCandidates.length} planilhas com score igual (${topScore}). Não é possível determinar a planilha principal.`, {
        candidates: topCandidates.map((c) => ({ name: c.sheet.name, score: c.score })),
      }));
    return null;
  }

  return { sheet: candidates[0]!.sheet, headerRowNumber: candidates[0]!.headerRowNumber };
}

function scoreSheetsForBudgetContent(sheets: ReadonlyArray<ExcelSheetRaw>): SheetCandidate[] {
  const results: SheetCandidate[] = [];
  const ordered = [...sheets.filter((s) => !s.hidden), ...sheets.filter((s) => s.hidden)];

  for (const sheet of ordered) {
    const best = findBestHeaderRow(sheet);
    if (best !== null) {
      results.push({ sheet, headerRowNumber: best.rowNumber, score: best.score });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

function findBestHeaderRow(sheet: ExcelSheetRaw): { rowNumber: number; score: number } | null {
  let best: { rowNumber: number; score: number } | null = null;

  for (let i = 0; i < sheet.rows.length; i++) {
    const row = sheet.rows[i]!;
    if (row.rowNumber > MAX_HEADER_SCAN_ROWS) {
      break;
    }

    // Try single row score
    const singleScore = scoreRowAsHeader(row.cells);
    if (singleScore >= MIN_ROLE_SCORE && (best === null || singleScore > best.score)) {
      best = { rowNumber: row.rowNumber, score: singleScore };
    }

    // Try combined 2-row score (multi-line headers in official Excel files)
    const nextRow = sheet.rows[i + 1];
    if (nextRow !== undefined && nextRow.rowNumber <= MAX_HEADER_SCAN_ROWS) {
      const combinedCells = combineRowCells(row.cells, nextRow.cells);
      const combinedScore = scoreRowAsHeader(combinedCells);
      if (combinedScore >= MIN_ROLE_SCORE && (best === null || combinedScore > best.score)) {
        best = { rowNumber: nextRow.rowNumber, score: combinedScore };
      }
    }
  }

  return best;
}

function combineRowCells(rowA: ReadonlyArray<ExcelCellRaw>, rowB: ReadonlyArray<ExcelCellRaw>): ExcelCellRaw[] {
  const maxLen = Math.max(rowA.length, rowB.length);
  const result: ExcelCellRaw[] = [];
  for (let i = 0; i < maxLen; i++) {
    const cellA = rowA[i];
    const cellB = rowB[i];
    // Lower row (rowB) contains specific column labels (e.g. "TOTAL C/BDI", "UNIT. C/ BDI", "BDI (%)")
    // which take precedence over upper row (rowA) category labels (e.g. "PREÇO FINAL").
    if (cellB !== undefined && typeof cellB.value === "string" && cellB.value.trim().length > 0) {
      result.push(cellB);
    } else if (cellA !== undefined && typeof cellA.value === "string" && cellA.value.trim().length > 0) {
      result.push(cellA);
    } else {
      result.push(cellB ?? cellA ?? { value: null, rawString: null, columnRef: "A" });
    }
  }
  return result;
}

function matchRoleToken(role: BudgetColumnRole, norm: string): boolean {
  if (role === "bdiPct") {
    if (norm.includes("S/BDI") || norm.includes("C/BDI") || norm.includes("CUSTO")) {
      return false;
    }
    return norm.includes("BDI");
  }
  if (role === "unitCostNoBdi") {
    return norm.includes("S/BDI") || norm.includes("S/ BDI") || norm.includes("SEM BDI") || norm.includes("CUSTO UNIT");
  }
  if (role === "unitPriceWithBdi") {
    return norm.includes("C/BDI") || norm.includes("C/ BDI") || norm.includes("COM BDI") || norm.includes("PRECO FINAL") || norm.includes("PRECO UNIT");
  }
  if (role === "total") {
    return norm.includes("TOTAL C/BDI") || norm.includes("TOTAL C/ BDI") || norm.includes("VALOR TOTAL") || norm.includes("PRECO TOTAL") || (norm.includes("TOTAL") && !norm.includes("SUBTOTAL"));
  }

  const roleDef = COLUMN_ROLE_TOKENS.find((r) => r.role === role);
  return roleDef?.tokens.some((t) => norm.includes(t)) ?? false;
}

function scoreRowAsHeader(cells: ReadonlyArray<ExcelCellRaw>): number {
  const found = new Set<BudgetColumnRole>();
  for (const cell of cells) {
    if (typeof cell.value !== "string") {
      continue;
    }
    const norm = normalizeHeaderLabel(cell.value);
    for (const { role } of COLUMN_ROLE_TOKENS) {
      if (matchRoleToken(role, norm)) {
        found.add(role);
      }
    }
  }
  return found.size;
}

/** Normaliza rótulo de cabeçalho: uppercase, remove diacríticos, colapsa espaços/NBSP. */
function normalizeHeaderLabel(raw: string): string {
  return raw
    .replace(/[\u00A0\u00AD\u200B\uFEFF]/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036F]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Column role detection
// ---------------------------------------------------------------------------

interface ColRoleDetectionResult {
  readonly headerRowNumber: number;
  readonly roles: ReadonlyArray<DetectedColumnRole>;
}

function detectColumnRoles(
  sheet: ExcelSheetRaw,
  diagnostics: BudgetXlsxImportDiagnostic[],
): ColRoleDetectionResult | null {
  const headerCandidate = findBestHeaderRow(sheet);
  if (headerCandidate === null) {
    diagnostics.push(diag("error", "HEADER_ROW_NOT_FOUND",
      `Linha de cabeçalho não encontrada na planilha "${sheet.name}".`));
    return null;
  }

  // Find the header row (or combine headerRow - 1 and headerRow if multi-line)
  const headerRowIdx = sheet.rows.findIndex((r) => r.rowNumber === headerCandidate.rowNumber);
  if (headerRowIdx === -1) {
    diagnostics.push(diag("error", "HEADER_ROW_NOT_FOUND",
      `Linha ${headerCandidate.rowNumber} não encontrada no array de linhas da planilha "${sheet.name}".`));
    return null;
  }

  const currentRow = sheet.rows[headerRowIdx]!;
  const prevRow = headerRowIdx > 0 ? sheet.rows[headerRowIdx - 1] : undefined;

  // Effective header cells (merging prevRow and currentRow if multi-line)
  const effectiveCells = prevRow !== undefined
    ? combineRowCells(prevRow.cells, currentRow.cells)
    : currentRow.cells;

  const roles: DetectedColumnRole[] = [];
  const usedCols = new Set<number>();
  const usedRoles = new Set<BudgetColumnRole>();

  for (const { role } of COLUMN_ROLE_TOKENS) {
    for (let i = 0; i < effectiveCells.length; i++) {
      const cell = effectiveCells[i];
      if (cell === undefined || typeof cell.value !== "string") {
        continue;
      }
      const norm = normalizeHeaderLabel(cell.value);
      if (matchRoleToken(role, norm) && !usedCols.has(i) && !usedRoles.has(role)) {
        roles.push({ role, columnIndex: i, columnRef: cell.columnRef });
        usedCols.add(i);
        usedRoles.add(role);
        break;
      }
    }
  }

  const missingRequired = REQUIRED_ROLES.filter((r) => !usedRoles.has(r));
  if (missingRequired.length > 0) {
    diagnostics.push(diag("error", "MISSING_REQUIRED_COLUMN",
      `Coluna(s) obrigatória(s) não encontradas na linha de cabeçalho ${headerCandidate.rowNumber}: ${missingRequired.join(", ")}.`, {
        sheetName: sheet.name,
        headerRowNumber: headerCandidate.rowNumber,
        missingRoles: missingRequired,
        foundRoles: roles.map((r) => r.role),
      }));
    return null;
  }

  return { headerRowNumber: headerCandidate.rowNumber, roles };
}

// ---------------------------------------------------------------------------
// Row classification
// ---------------------------------------------------------------------------

/** Padrões de código orçamentário — suporta inteiros ("1", "1.0", "15") para Grupos. */
const GROUP_CODE_PATTERN = /^(\d+)(\.0+)?$/;
const SUBGROUP_CODE_PATTERN = /^(\d{1,3})\.(\d{2})$/;
const SERVICE_ITEM_CODE_PATTERN = /^(\d{1,3})\.(\d{2})\.(\d{2,})$/;

interface ClassifiedRow {
  readonly kind: BudgetReviewRowKind;
  /** Código original preservado da fonte (ex.: "1.0", "01.01", "01.01.01"). */
  readonly itemCode: string;
  readonly cells: ReadonlyArray<ExcelCellRaw>;
  readonly roles: ReadonlyArray<DetectedColumnRole>;
  readonly rowNumber: number;
  readonly position: number;
  readonly inferredParentCode: string | null;
  readonly rowId: string;
  /** true se o pai não foi encontrado na fase de resolução de hierarquia. */
  orphan: boolean;
  resolvedParentRowId: string | null;
}

function classifyRows(
  sheet: ExcelSheetRaw,
  headerRowNumber: number,
  roles: ReadonlyArray<DetectedColumnRole>,
  context: BudgetXlsxImportContext,
): ClassifiedRow[] {
  const itemCodeColIdx = roles.find((r) => r.role === "itemCode")?.columnIndex;
  const sourceCodeColIdx = roles.find((r) => r.role === "sourceCode")?.columnIndex;
  if (itemCodeColIdx === undefined) {
    return [];
  }

  const classified: ClassifiedRow[] = [];
  let position = 0;

  for (const row of sheet.rows) {
    if (row.rowNumber <= headerRowNumber) {
      continue;
    }

    const itemCell = row.cells[itemCodeColIdx];
    const sourceCell = sourceCodeColIdx !== undefined ? row.cells[sourceCodeColIdx] : undefined;

    const { code, kind } = extractCodeAndKind(itemCell, sourceCell);
    if (code === null || kind === null) {
      continue; // ex.: "TOTAL GERAL", notas, células em branco
    }

    // Itens de Serviço devem ter pelo menos um campo econômico
    if (kind === BudgetLineKind.ServiceItem && !hasAnyEconomicValue(row.cells, roles)) {
      continue;
    }

    position++;
    const rowId = buildRowId(context.lotReference, position);

    classified.push({
      kind,
      itemCode: code,
      cells: row.cells,
      roles,
      rowNumber: row.rowNumber,
      position,
      inferredParentCode: inferParentCode(code, kind),
      rowId,
      orphan: false,
      resolvedParentRowId: null,
    });
  }

  return classified;
}

function extractCodeAndKind(
  itemCell: ExcelCellRaw | undefined,
  sourceCell: ExcelCellRaw | undefined,
): { code: string | null; kind: BudgetReviewRowKind | null } {
  let itemStr = cellToCodeString(itemCell);
  let sourceStr = cellToCodeString(sourceCell);

  // Case 1: Item cell has "X" (official DNOCS group row format) and source cell has group number (1, 2, ... 15)
  if (itemStr === "X" && sourceStr !== null && GROUP_CODE_PATTERN.test(sourceStr)) {
    const num = parseInt(sourceStr, 10);
    return { code: `${num}.0`, kind: BudgetLineKind.Group };
  }

  if (itemStr === null || itemStr === "X") {
    return { code: null, kind: null };
  }

  // Case 2: Item cell is Subgroup ("01.01") or ServiceItem ("01.01.01")
  if (SUBGROUP_CODE_PATTERN.test(itemStr)) {
    return { code: itemStr, kind: BudgetLineKind.Subgroup };
  }

  if (SERVICE_ITEM_CODE_PATTERN.test(itemStr)) {
    return { code: itemStr, kind: BudgetLineKind.ServiceItem };
  }

  // Case 3: Item cell is Group ("1", "1.0", "01", "15")
  const groupMatch = GROUP_CODE_PATTERN.exec(itemStr);
  if (groupMatch !== null) {
    const num = parseInt(groupMatch[1]!, 10);
    return { code: `${num}.0`, kind: BudgetLineKind.Group };
  }

  return { code: null, kind: null };
}

function cellToCodeString(cell: ExcelCellRaw | undefined): string | null {
  if (cell === undefined || cell.value === null) {
    return null;
  }
  if (typeof cell.value === "string") {
    const trimmed = cell.value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }
  if (typeof cell.value === "number") {
    return cell.value.toString();
  }
  return null;
}

function hasAnyEconomicValue(
  cells: ReadonlyArray<ExcelCellRaw>,
  roles: ReadonlyArray<DetectedColumnRole>,
): boolean {
  const economicRoles: ReadonlyArray<BudgetColumnRole> = ["quantity", "total", "unitPriceWithBdi", "unitCostNoBdi"];
  for (const role of economicRoles) {
    const idx = roles.find((r) => r.role === role)?.columnIndex;
    if (idx === undefined) {
      continue;
    }
    const cell = cells[idx];
    if (cell !== undefined && cell.value !== null && cell.value !== 0) {
      return true;
    }
  }
  return false;
}

function inferParentCode(code: string, kind: BudgetReviewRowKind): string | null {
  if (kind === BudgetLineKind.Group) {
    return null;
  }
  if (kind === BudgetLineKind.Subgroup) {
    // "01.01" → grupo 1 → "1.0"
    const m = /^(\d+)\.\d+$/.exec(code);
    return m !== null ? `${parseInt(m[1]!, 10)}.0` : null;
  }
  if (kind === BudgetLineKind.ServiceItem) {
    // "01.01.01" → "01.01"
    const m = /^(\d+\.\d+)\.\d+/.exec(code);
    return m?.[1] ?? null;
  }
  return null;
}

function buildRowId(lotReference: string, position: number): string {
  return `xlsx:${BUDGET_XLSX_IMPORTER_VERSION}:${lotReference}:${String(position).padStart(6, "0")}`;
}

// ---------------------------------------------------------------------------
// Hierarchy resolution
// ---------------------------------------------------------------------------

function resolveHierarchy(
  rows: ClassifiedRow[],
  diagnostics: BudgetXlsxImportDiagnostic[],
): ClassifiedRow[] {
  const codeToId = new Map<string, string>();
  for (const row of rows) {
    codeToId.set(row.itemCode, row.rowId);
  }

  for (const row of rows) {
    if (row.inferredParentCode === null) {
      row.resolvedParentRowId = null;
      continue;
    }

    const parentId = codeToId.get(row.inferredParentCode);
    if (parentId !== undefined) {
      row.resolvedParentRowId = parentId;
      continue;
    }

    // Fallback: Item de Serviço sem subgrupo → tenta grupo direto
    if (row.kind === BudgetLineKind.ServiceItem) {
      const groupCode = inferGroupCode(row.itemCode);
      const groupId = groupCode !== null ? codeToId.get(groupCode) : undefined;
      if (groupId !== undefined) {
        row.resolvedParentRowId = groupId;
        diagnostics.push(diag("warning", "ORPHAN_SUBGROUP_FALLBACK_TO_GROUP",
          `Item "${row.itemCode}" vinculado ao grupo (subgrupo "${row.inferredParentCode}" não encontrado).`, {
            code: row.itemCode,
            expectedParent: row.inferredParentCode,
          }));
        continue;
      }
    }

    row.orphan = true;
    row.resolvedParentRowId = null;
    diagnostics.push(diag("error", "ORPHAN_ROW",
      `Linha "${row.itemCode}" (${row.kind}) sem pai encontrado ("${row.inferredParentCode}"). Excluída do resultado.`, {
        code: row.itemCode,
        kind: row.kind,
        expectedParent: row.inferredParentCode,
        rowNumber: row.rowNumber,
      }));
  }

  return rows;
}

function inferGroupCode(serviceItemCode: string): string | null {
  const m = /^(\d+)\./.exec(serviceItemCode);
  return m !== null ? `${parseInt(m[1]!, 10)}.0` : null;
}

// ---------------------------------------------------------------------------
// Field mapping + numeric precision
// ---------------------------------------------------------------------------

/**
 * Converte uma fração decimal XLSX ("0.2418") para texto de percentual
 * ("24.18%") via manipulação de string — sem aritmética de ponto flutuante.
 * Move o ponto decimal 2 casas à direita (equivalente a × 100).
 */
export function rawDecimalFractionToPercentText(rawString: string): string {
  const trimmed = rawString.trim();
  const match = /^(\d+)(?:\.(\d*))?$/.exec(trimmed);
  if (match === null) {
    return `${(Number(trimmed) * 100).toString()}%`;
  }

  const intPart = match[1]!;
  const fracPart = match[2] ?? "";
  const allDigits = intPart + fracPart;
  const newDotPos = intPart.length + 2;
  const paddedDigits = allDigits.padEnd(newDotPos, "0");

  let result: string;
  if (newDotPos >= paddedDigits.length) {
    result = paddedDigits;
  } else {
    result = `${paddedDigits.slice(0, newDotPos)}.${paddedDigits.slice(newDotPos)}`;
  }

  result = result.replace(/^0+(?=\d)/, "");
  if (result.includes(".")) {
    result = result.replace(/\.?0+$/, "") || "0";
  }

  return `${result}%`;
}

/**
 * Extrai o texto de uma célula para uso em campos `...Text`.
 * Para células numéricas, usa `rawString` (valor bruto do `<v>` XML) quando
 * disponível para evitar perda de precisão via `number.toString()`.
 */
function cellToMonetaryText(cell: ExcelCellRaw | undefined): string | null {
  if (cell === undefined || cell.value === null) {
    return null;
  }
  if (typeof cell.value === "string") {
    const t = cell.value.trim();
    return t.length === 0 ? null : t;
  }
  if (typeof cell.value === "number") {
    // Monetary values in official Brazilian budgets are strictly 2 decimal places
    return cell.value.toFixed(2);
  }
  return null;
}

function cellToQuantityText(cell: ExcelCellRaw | undefined): string | null {
  if (cell === undefined || cell.value === null) {
    return null;
  }
  if (typeof cell.value === "string") {
    const t = cell.value.trim();
    return t.length === 0 ? null : t;
  }
  if (typeof cell.value === "number") {
    if (cell.rawString !== null && !cell.rawString.includes("999999") && !cell.rawString.includes("0000000")) {
      return cell.rawString;
    }
    // Clean IEEE 754 float artifacts while preserving up to 6 decimal places for quantities
    return parseFloat(cell.value.toFixed(6)).toString();
  }
  return null;
}

function cellToText(cell: ExcelCellRaw | undefined): string | null {
  if (cell === undefined || cell.value === null) {
    return null;
  }
  if (typeof cell.value === "string") {
    const t = cell.value.trim();
    return t.length === 0 ? null : t;
  }
  if (typeof cell.value === "number") {
    return cell.value.toString();
  }
  return null;
}

function buildInputRow(
  row: ClassifiedRow,
  context: BudgetXlsxImportContext,
  sheetName: string,
): ImportBudgetReviewRowInput {
  function getCell(role: BudgetColumnRole): ExcelCellRaw | undefined {
    const idx = row.roles.find((r) => r.role === role)?.columnIndex;
    return idx !== undefined ? row.cells[idx] : undefined;
  }

  // BDI: XLSX armazena como fração decimal (ex.: 0.2418 = 24.18%)
  const bdiCell = getCell("bdiPct");
  let bdiPercentText: string | null = null;
  if (bdiCell !== undefined && bdiCell.value !== null) {
    if (typeof bdiCell.value === "number") {
      const bdiPctVal = parseFloat((bdiCell.value * 100).toFixed(4));
      bdiPercentText = `${bdiPctVal.toString()}%`;
    } else if (bdiCell.rawString !== null) {
      bdiPercentText = rawDecimalFractionToPercentText(bdiCell.rawString);
    }
  }

  const isGroupOrSubgroup =
    row.kind === BudgetLineKind.Group || row.kind === BudgetLineKind.Subgroup;

  const totalText = cellToMonetaryText(getCell("total"));
  const firstCol = row.cells[0]?.columnRef ?? "A";
  const lastCol = row.cells[row.cells.length - 1]?.columnRef ?? "A";
  const sha12 = context.sourceSha256.slice(0, 12);

  return {
    id: row.rowId,
    kind: row.kind,
    lotReference: context.lotReference,
    parentRowId: row.resolvedParentRowId ?? null,
    position: row.position,
    page: null,
    evidenceText:
      `mechanism=xlsx_structured_import|version=${BUDGET_XLSX_IMPORTER_VERSION}` +
      `|sha256=${sha12}|sheet=${sheetName}` +
      `|row=${row.rowNumber}|cols=${firstCol}${row.rowNumber}:${lastCol}${row.rowNumber}`,
    fields: {
      itemCode: row.itemCode,
      description: cellToText(getCell("description")),
      sourceCode: cellToText(getCell("sourceCode")),
      sourceFonte: cellToText(getCell("sourceType")),
      sourceTipo: null,
      unit: cellToText(getCell("unit")),
      quantityText: isGroupOrSubgroup ? null : cellToQuantityText(getCell("quantity")),
      unitCostWithoutBdiText: isGroupOrSubgroup ? null : cellToMonetaryText(getCell("unitCostNoBdi")),
      bdiPercentText: isGroupOrSubgroup ? null : bdiPercentText,
      unitPriceWithBdiText: isGroupOrSubgroup ? null : cellToMonetaryText(getCell("unitPriceWithBdi")),
      totalPriceText: isGroupOrSubgroup ? null : totalText,
      colFgvDnit: null,
      documentalGroupTotalText: isGroupOrSubgroup ? totalText : null,
    },
  };
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function diag(
  severity: BudgetXlsxDiagnosticSeverity,
  code: string,
  message: string,
  context?: Readonly<Record<string, unknown>>,
): BudgetXlsxImportDiagnostic {
  return { severity, code, message, ...(context !== undefined ? { context } : {}) };
}

function makeResult(
  rows: ReadonlyArray<ImportBudgetReviewRowInput>,
  diagnostics: ReadonlyArray<BudgetXlsxImportDiagnostic>,
  summary: BudgetXlsxImportSummary,
): BudgetXlsxImportResult {
  return { rows, diagnostics, summary };
}

function nullSummary(): BudgetXlsxImportSummary {
  return {
    groupCount: 0,
    subgroupCount: 0,
    serviceItemCount: 0,
    totalRowCount: 0,
    skippedRowCount: 0,
    orphanCount: 0,
    sheetName: null,
    headerRowNumber: null,
  };
}
