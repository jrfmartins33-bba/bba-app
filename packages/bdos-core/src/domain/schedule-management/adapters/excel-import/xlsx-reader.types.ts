export type ExcelCellValue = string | number | null;

export interface ExcelSheetRow {
  readonly rowNumber: number;
  /** Denso, indexado a partir de 0 (coluna A = 0) até a última coluna preenchida da linha. */
  readonly cells: ReadonlyArray<ExcelCellValue>;
}

export interface ExcelSheetDto {
  readonly name: string;
  readonly hidden: boolean;
  readonly rows: ReadonlyArray<ExcelSheetRow>;
}

export interface ExcelWorkbookDto {
  readonly sheets: ReadonlyArray<ExcelSheetDto>;
}

// ---------------------------------------------------------------------------
// Raw types (Sprint 21.5B — additive, backwards-compatible)
// Expose `rawString` (the <v> XML content for numeric-type cells) and
// `columnRef` (e.g. "B" for the second column) so that consumers that
// need the exact decimal representation (e.g. a BDI fraction "0.2418")
// can convert it without floating-point arithmetic. `rawString` is null
// for string/boolean/error/null cells — the `value` field already carries
// the correct string in those cases.
// ---------------------------------------------------------------------------

export interface ExcelCellRaw {
  /** Same typed value as produced by readXlsxWorkbook — unchanged semantics. */
  readonly value: ExcelCellValue;
  /**
   * Raw content of the `<v>` XML element for numeric cells (type absent or
   * `t="n"`). `null` for shared-string cells (`t="s"`), formula-string cells
   * (`t="str"`), boolean cells (`t="b"`), error cells (`t="e"`), and empty
   * cells. Use this field when you need the exact decimal representation from
   * the workbook (e.g. "0.2418" for a BDI fraction) without risk of IEEE 754
   * rounding when converting back to a string.
   */
  readonly rawString: string | null;
  /** Column letter(s) for this cell, e.g. "A", "B", "AB". */
  readonly columnRef: string;
}

export interface ExcelSheetRowRaw {
  readonly rowNumber: number;
  /** Dense, 0-indexed (column A = 0), same layout as ExcelSheetRow.cells. */
  readonly cells: ReadonlyArray<ExcelCellRaw>;
}

export interface ExcelSheetRaw {
  readonly name: string;
  readonly hidden: boolean;
  readonly rows: ReadonlyArray<ExcelSheetRowRaw>;
}

export interface ExcelWorkbookRaw {
  readonly sheets: ReadonlyArray<ExcelSheetRaw>;
}
