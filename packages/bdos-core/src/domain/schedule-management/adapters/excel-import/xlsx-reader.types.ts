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
