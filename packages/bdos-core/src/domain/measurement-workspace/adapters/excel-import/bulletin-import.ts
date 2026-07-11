import { readXlsxWorkbook } from "../../../schedule-management/adapters/excel-import/xlsx-reader";
import type { ExcelSheetDto } from "../../../schedule-management/adapters/excel-import/xlsx-reader.types";
import { detectBulletinSheet, normalizeBulletinToken } from "./bulletin-sheet-detector";
import type { BulletinSheetDetectionResult, DetectedBulletinPeriodColumn, DetectedOfficialPeriodColumn } from "./bulletin-sheet-detector.types";
import type {
  BulletinImportInput,
  BulletinImportResult,
  MeasurementImportIssue,
  ParsedManagedServiceItem,
  ParsedMeasurementBulletin,
  ParsedMeasurementLine,
  ParsedSkippedSheet,
  ParsedSkippedSheetReason,
  ParsedWorkPackage
} from "./bulletin-import.types";

/**
 * Epic 19, Sprint 4C — orquestra `readXlsxWorkbook` (reaproveitado do
 * Project Studio, neutro, sem significado de negócio — mesmo arquivo,
 * não uma cópia) → `detectBulletinSheet` (por planilha, formato
 * próprio do Boletim de Medição) → `ParsedMeasurementBulletin`.
 *
 * Zero persistência, zero conhecimento de Supabase/companyId/IDs —
 * contrato congelado na Sprint 4.0
 * (`bulletin-import.types.ts`). Nunca decide número oficial de
 * boletim nem datas oficiais de período — só extrai o que o arquivo
 * declara.
 *
 * Achado da revisão pós-19.4A/4C (investigação com leitura de
 * fórmulas do arquivo real, feita fora deste módulo): a grade
 * MED-NN/FÍSICO/FINANCEIRO (`detection.periodColumns`) é preenchida à
 * mão e não reconcilia com o total oficial do boletim. A fonte
 * autoritativa de `ParsedMeasurementLine` é sempre
 * `detection.officialPeriodColumn` (bloco "CONTROLE FINANCEIRO –
 * MEDIÇÃO", ligado por fórmula, no arquivo real, à aba `BOLETIM
 * FÍSICO FINANCEIRO`). A grade MED-NN permanece detectada apenas para
 * comparação/auditoria (`historical_grid_not_authoritative`) — nunca
 * alimenta uma linha.
 */
export function importBulletinExcel(input: BulletinImportInput): BulletinImportResult {
  const workbook = readXlsxWorkbook(input.bytes);
  const skippedSheets: ParsedSkippedSheet[] = [];

  const visibleSheets = workbook.sheets.filter((sheet) => !sheet.hidden);
  workbook.sheets
    .filter((sheet) => sheet.hidden)
    .forEach((sheet) => {
      skippedSheets.push({ sheetName: sheet.name, reason: "hidden_sheet_not_selected" });
    });

  if (visibleSheets.length === 0) {
    return emptyResult(input, skippedSheets, [{ code: "unrecognized_line", severity: "blocking", message: "Nenhuma aba visível encontrada no arquivo." }]);
  }

  const candidates = visibleSheets
    .map((sheet) => ({ sheet, detection: detectBulletinSheet(sheet) }))
    .filter((candidate): candidate is { sheet: ExcelSheetDto; detection: BulletinSheetDetectionResult } => candidate.detection !== null);

  visibleSheets
    .filter((sheet) => !candidates.some((candidate) => candidate.sheet === sheet))
    .forEach((sheet) => {
      skippedSheets.push({ sheetName: sheet.name, reason: classifyNonBulletinSheet(sheet) });
    });

  if (candidates.length === 0) {
    return emptyResult(input, skippedSheets, [
      { code: "unrecognized_line", severity: "blocking", message: "Nenhuma aba com o layout de Boletim de Medição foi reconhecida." }
    ]);
  }

  const primary = candidates.reduce((best, current) => (current.detection.confidence > best.detection.confidence ? current : best));

  candidates
    .filter((candidate) => candidate.sheet !== primary.sheet)
    .forEach((candidate) => {
      skippedSheets.push({ sheetName: candidate.sheet.name, reason: "duplicate_candidate" });
    });

  const issues: MeasurementImportIssue[] = [];
  const declaredBulletinNumber = extractDeclaredBulletinNumber(primary.sheet.name);
  const declaredPeriod = extractDeclaredPeriod(primary.sheet, primary.detection.periodColumns);

  // Grade histórica MED-NN -- mantida só para auditoria (ver nota no
  // topo do arquivo). O não-pareamento com o número declarado nunca
  // mais bloqueia a extração, porque a linha não depende mais dela.
  const targetPeriodColumn =
    declaredBulletinNumber === null
      ? null
      : primary.detection.periodColumns.find((column) => column.periodNumber === declaredBulletinNumber) ?? null;

  if (declaredBulletinNumber === null) {
    issues.push({ code: "ambiguous_period_label", severity: "blocking", message: `Não foi possível determinar o número do boletim a partir do nome da aba "${primary.sheet.name}".` });
  } else if (targetPeriodColumn === null) {
    issues.push({
      code: "ambiguous_period_label",
      severity: "warning",
      message: `O boletim declara o número ${declaredBulletinNumber}, mas nenhuma coluna "MED-${String(declaredBulletinNumber).padStart(2, "0")}" foi encontrada na grade histórica da aba "${primary.sheet.name}" -- sem impacto na medição extraída, que usa o bloco financeiro oficial, não a grade.`
    });
  }

  const officialPeriodColumn = primary.detection.officialPeriodColumn;
  if (officialPeriodColumn === null) {
    issues.push({
      code: "official_measurement_block_not_found",
      severity: "blocking",
      message: `Não foi possível localizar o bloco financeiro oficial ("CONTROLE FINANCEIRO – MEDIÇÃO" -> QUANTITATIVO/VALOR) na aba "${primary.sheet.name}".`
    });
  }

  issues.push(...auditOrphanColumns(primary.sheet, primary.detection));

  const resolvedPeriodLabel = targetPeriodColumn?.label ?? (declaredBulletinNumber === null ? null : `MED-${String(declaredBulletinNumber).padStart(2, "0")}`);

  const { workPackages, serviceItems, lines, rowIssues, officialPeriodTotal, historicalGridPeriodTotal, declaredOfficialTotal, declaredOfficialTotalSourceLocation } = extractRows(
    primary.sheet,
    primary.detection,
    officialPeriodColumn,
    targetPeriodColumn,
    resolvedPeriodLabel
  );
  issues.push(...rowIssues);
  issues.push(...auditHistoricalGrid(primary.sheet.name, officialPeriodColumn, targetPeriodColumn, officialPeriodTotal, historicalGridPeriodTotal));
  issues.push(...auditOfficialTotalReconciliation(primary.sheet.name, officialPeriodColumn, officialPeriodTotal, declaredOfficialTotal, declaredOfficialTotalSourceLocation));

  const bulletin: ParsedMeasurementBulletin = {
    source: {
      fileName: input.fileName,
      inspectedSheetCount: workbook.sheets.length,
      selectedSheets: [primary.sheet.name]
    },
    declaredBulletinNumber,
    declaredPeriod,
    workPackages,
    serviceItems,
    lines,
    skippedSheets,
    issues
  };

  const hasBlockingIssue = issues.some((issue) => issue.severity === "blocking");

  return { success: !hasBlockingIssue && lines.length > 0, bulletin };
}

function emptyResult(input: BulletinImportInput, skippedSheets: ReadonlyArray<ParsedSkippedSheet>, issues: ReadonlyArray<MeasurementImportIssue>): BulletinImportResult {
  return {
    success: false,
    bulletin: {
      source: { fileName: input.fileName, inspectedSheetCount: skippedSheets.length, selectedSheets: [] },
      declaredBulletinNumber: null,
      declaredPeriod: null,
      workPackages: [],
      serviceItems: [],
      lines: [],
      skippedSheets,
      issues
    }
  };
}

function classifyNonBulletinSheet(sheet: ExcelSheetDto): ParsedSkippedSheetReason {
  const firstCellText = sheet.rows[0]?.cells.find((cell) => typeof cell === "string");
  const normalizedFirstCell = typeof firstCellText === "string" ? normalizeBulletinToken(firstCellText) : "";
  const normalizedName = normalizeBulletinToken(sheet.name);

  if (normalizedFirstCell.includes("MEMORIA DE CALCULO")) {
    return "calculation_memory_deferred";
  }

  if (normalizedName.includes("RESUMO")) {
    return "summary_sheet_not_measurement_lines";
  }

  if (sheet.rows.length <= 2) {
    return "empty_sheet";
  }

  return "unsupported_layout";
}

const BULLETIN_NAME_PATTERN = /BOLETIM|MEDICAO/;
const TRAILING_NUMBER_PATTERN = /(\d+)\s*$/;

function extractDeclaredBulletinNumber(sheetName: string): number | null {
  const normalized = normalizeBulletinToken(sheetName);
  if (!BULLETIN_NAME_PATTERN.test(normalized)) {
    return null;
  }

  const match = TRAILING_NUMBER_PATTERN.exec(normalized);
  return match ? Number(match[1]) : null;
}

const DATE_RANGE_PATTERN = /(\d{2})\/(\d{2})\/(\d{4})\s*A\s*(\d{2})\/(\d{2})\/(\d{4})/;
const DECLARED_PERIOD_SCAN_ROWS = 15;

function extractDeclaredPeriod(
  sheet: ExcelSheetDto,
  periodColumns: ReadonlyArray<{ label: string }>
): ParsedMeasurementBulletin["declaredPeriod"] {
  const labels = periodColumns.map((column) => column.label);

  for (const row of sheet.rows.slice(0, DECLARED_PERIOD_SCAN_ROWS)) {
    for (const cell of row.cells) {
      if (typeof cell !== "string") {
        continue;
      }

      const match = DATE_RANGE_PATTERN.exec(normalizeBulletinToken(cell));
      if (match === null) {
        continue;
      }

      return {
        startDate: `${match[3]}-${match[2]}-${match[1]}`,
        endDate: `${match[6]}-${match[5]}-${match[4]}`,
        labels
      };
    }
  }

  return labels.length > 0 ? { startDate: null, endDate: null, labels } : null;
}

const RECONCILIATION_EPSILON = 0.01;

/**
 * Compara o total bruto da grade histórica MED-NN (não autoritativa)
 * com o total oficial do bloco financeiro (autoritativo) para o
 * período correspondente ao número de boletim declarado. Gera um
 * warning, nunca ajusta nenhum dos dois valores -- a divergência é o
 * próprio achado, não um erro a corrigir (ver revisão pós-19.4A/4C).
 *
 * Os dois totais vêm de `extractRows` (mesma varredura que produz
 * `workPackages`/`lines`), nunca de uma varredura própria da folha
 * inteira -- somar a coluna sem se restringir às linhas reconhecidas
 * como linhas da tabela (código + nome válidos) capturaria qualquer
 * valor numérico solto mais abaixo na planilha (texto de certificação,
 * outra seção) e infla os totais sem relação com `SUM(I12:I347)` do
 * próprio arquivo.
 */
function auditHistoricalGrid(
  sheetName: string,
  officialPeriodColumn: DetectedOfficialPeriodColumn | null,
  targetPeriodColumn: DetectedBulletinPeriodColumn | null,
  officialPeriodTotal: number,
  historicalGridPeriodTotal: number | null
): ReadonlyArray<MeasurementImportIssue> {
  if (officialPeriodColumn === null || targetPeriodColumn === null || historicalGridPeriodTotal === null) {
    return [];
  }

  if (Math.abs(historicalGridPeriodTotal - officialPeriodTotal) <= RECONCILIATION_EPSILON) {
    return [];
  }

  const difference = historicalGridPeriodTotal - officialPeriodTotal;
  return [
    {
      code: "historical_grid_not_authoritative",
      severity: "warning",
      message:
        `Grade histórica encontrada na aba "${sheetName}" para "${targetPeriodColumn.label}" (coluna ${columnIndexToLetters(targetPeriodColumn.financialColumnIndex)}): soma bruta R$ ${historicalGridPeriodTotal.toFixed(2)}. ` +
        `Valor oficial do período (bloco "${officialPeriodColumn.headerLabel}", coluna ${columnIndexToLetters(officialPeriodColumn.valueColumnIndex)}): R$ ${officialPeriodTotal.toFixed(2)}. ` +
        `Diferença: R$ ${difference.toFixed(2)}. A grade histórica não reconcilia com a fonte oficial e não foi usada na medição importada.`
    }
  ];
}

/**
 * Invariante permanente (não específica do BM_08): a soma das linhas
 * oficiais extraídas precisa reconciliar com o total que o PRÓPRIO
 * arquivo declara (linha "TOTAL...", nunca a nossa soma comparada
 * com ela mesma). Diferente de `auditHistoricalGrid` -- aqui a
 * divergência não é "grade não confiável", é "a extração pode ter
 * deixado uma linha real de fora", e por isso é sempre blocking:
 * nunca ajusta nem rateia a diferença, só recusa tratar o resultado
 * como confiável.
 */
function auditOfficialTotalReconciliation(
  sheetName: string,
  officialPeriodColumn: DetectedOfficialPeriodColumn | null,
  officialPeriodTotal: number,
  declaredOfficialTotal: number | null,
  declaredOfficialTotalSourceLocation: ParsedMeasurementLine["sourceLocation"] | null
): ReadonlyArray<MeasurementImportIssue> {
  if (officialPeriodColumn === null) {
    return []; // já reportado como official_measurement_block_not_found -- não duplica.
  }

  if (declaredOfficialTotal === null) {
    return [
      {
        code: "official_period_total_mismatch",
        severity: "blocking",
        message: `Não foi possível localizar a linha de total declarado (ex.: "TOTAL GERAL") na aba "${sheetName}" para confirmar a reconciliação com as linhas extraídas.`
      }
    ];
  }

  const difference = officialPeriodTotal - declaredOfficialTotal;
  if (Math.abs(difference) <= RECONCILIATION_EPSILON) {
    return [];
  }

  return [
    {
      code: "official_period_total_mismatch",
      severity: "blocking",
      message:
        `A soma das linhas extraídas do bloco oficial (R$ ${officialPeriodTotal.toFixed(2)}) não reconcilia com o total declarado pelo próprio boletim ` +
        `(R$ ${declaredOfficialTotal.toFixed(2)}, aba "${sheetName}"${declaredOfficialTotalSourceLocation ? `, linha ${declaredOfficialTotalSourceLocation.rowNumber}, coluna ${declaredOfficialTotalSourceLocation.financialColumn}` : ""}). ` +
        `Diferença: R$ ${difference.toFixed(2)}. Este resultado não deve ser tratado como uma importação confiável.`,
      sourceLocation: declaredOfficialTotalSourceLocation ?? undefined
    }
  ];
}

/**
 * Registra a existência de coluna(s) de texto residual (achado real:
 * coluna N do BM_08) num único warning por aba, com contagem -- nunca
 * usada para identidade, descrição ou correlação de item.
 */
function auditOrphanColumns(sheet: ExcelSheetDto, detection: BulletinSheetDetectionResult): ReadonlyArray<MeasurementImportIssue> {
  if (detection.orphanColumns.length === 0) {
    return [];
  }

  const perColumn = detection.orphanColumns
    .map((column) => `${columnIndexToLetters(column.columnIndex)} (${column.valueCount} valores, ${column.matchingNameColumnCount} coincidem com a descrição oficial)`)
    .join("; ");

  return [
    {
      code: "orphan_legacy_column_detected",
      severity: "warning",
      message: `Coluna(s) residual(is) sem cabeçalho reconhecido na aba "${sheet.name}", não utilizada(s) na extração: ${perColumn}.`
    }
  ];
}

interface ExtractRowsResult {
  readonly workPackages: ReadonlyArray<ParsedWorkPackage>;
  readonly serviceItems: ReadonlyArray<ParsedManagedServiceItem>;
  readonly lines: ReadonlyArray<ParsedMeasurementLine>;
  readonly rowIssues: ReadonlyArray<MeasurementImportIssue>;
  /** Soma bruta da coluna oficial (VALOR), só sobre linhas reconhecidas da tabela -- ver `auditHistoricalGrid`. */
  readonly officialPeriodTotal: number;
  /** Idem, para a grade histórica MED-NN correspondente ao número declarado; `null` se a grade não tem essa coluna. */
  readonly historicalGridPeriodTotal: number | null;
  /** Total que o PRÓPRIO arquivo declara (linha "TOTAL..."), independente da nossa soma -- ver `auditOfficialTotalReconciliation`. `null` se nenhuma linha de total foi encontrada. */
  readonly declaredOfficialTotal: number | null;
  readonly declaredOfficialTotalSourceLocation: ParsedMeasurementLine["sourceLocation"] | null;
}

function extractRows(
  sheet: ExcelSheetDto,
  detection: BulletinSheetDetectionResult,
  officialPeriodColumn: DetectedOfficialPeriodColumn | null,
  targetPeriodColumn: DetectedBulletinPeriodColumn | null,
  periodLabel: string | null
): ExtractRowsResult {
  const workPackages: ParsedWorkPackage[] = [];
  const serviceItems: ParsedManagedServiceItem[] = [];
  const lines: ParsedMeasurementLine[] = [];
  const rowIssues: MeasurementImportIssue[] = [];
  const seenServiceItemCodes = new Set<string>();
  let officialPeriodTotal = 0;
  let historicalGridPeriodTotal: number | null = targetPeriodColumn === null ? null : 0;
  let declaredOfficialTotal: number | null = null;
  let declaredOfficialTotalSourceLocation: ParsedMeasurementLine["sourceLocation"] | null = null;

  const { codeColumnIndex, nameColumnIndex, unitColumnIndex, contractQuantityColumnIndex, unitPriceColumnIndex } = detection;

  const dataRows = sheet.rows.slice(detection.subHeaderRowIndex + 1);

  dataRows.forEach((row) => {
    const code = codeColumnIndex === null ? null : readText(row.cells[codeColumnIndex]);
    const name = nameColumnIndex === null ? null : readText(row.cells[nameColumnIndex]);

    if (code === null && name === null) {
      return; // linha em branco / separador -- não é perda, é ausência.
    }

    const sourceLocation = { sheetName: sheet.name, rowNumber: row.rowNumber };

    if (code === null || name === null) {
      // A linha de total (ex.: "TOTAL GERAL (R$)") sempre cai aqui --
      // tem código mas nunca um nome de item real. É a ÚNICA fonte do
      // total declarado pelo próprio arquivo (independente da nossa
      // soma sobre as linhas de dado): sem capturá-la aqui, a
      // reconciliação abaixo compararia a nossa soma consigo mesma,
      // o que nunca detectaria uma linha real ignorada por engano.
      if (code !== null && officialPeriodColumn !== null && normalizeBulletinToken(code).includes("TOTAL")) {
        declaredOfficialTotal = readNumber(row.cells[officialPeriodColumn.valueColumnIndex]);
        declaredOfficialTotalSourceLocation = { ...sourceLocation, financialColumn: columnIndexToLetters(officialPeriodColumn.valueColumnIndex) };
      }

      rowIssues.push({
        code: code === null ? "missing_work_package_code" : "unrecognized_line",
        severity: "warning",
        message: `Linha com dado parcial (código ou nome ausente) na aba "${sheet.name}", linha ${row.rowNumber}.`,
        sourceLocation
      });
      return;
    }

    const unit = unitColumnIndex === null ? null : readText(row.cells[unitColumnIndex]);
    const isAggregator = unit === null;
    const parentCode = inferParentCode(code);

    workPackages.push({ code, name, parentCode, isAggregator });

    // Acumulado sobre TODA linha reconhecida da tabela (agregadora ou
    // folha), igual ao SUM() do próprio arquivo -- que não distingue
    // tipo de linha, só soma o que houver na coluna.
    if (officialPeriodColumn !== null) {
      officialPeriodTotal += readNumber(row.cells[officialPeriodColumn.valueColumnIndex]) ?? 0;
    }
    if (targetPeriodColumn !== null) {
      historicalGridPeriodTotal = (historicalGridPeriodTotal ?? 0) + (readNumber(row.cells[targetPeriodColumn.financialColumnIndex]) ?? 0);
    }

    if (isAggregator) {
      return;
    }

    if (seenServiceItemCodes.has(code)) {
      rowIssues.push({
        code: "duplicate_service_item_in_sheet",
        severity: "warning",
        message: `Código "${code}" aparece mais de uma vez como item medível na aba "${sheet.name}".`,
        sourceLocation
      });
    }
    seenServiceItemCodes.add(code);

    const declaredContractQuantity = contractQuantityColumnIndex === null ? null : readNumber(row.cells[contractQuantityColumnIndex]);
    const declaredUnitPrice = unitPriceColumnIndex === null ? null : readNumber(row.cells[unitPriceColumnIndex]);

    serviceItems.push({ code, workPackageCode: code, description: name, unit, declaredContractQuantity, declaredUnitPrice });

    if (officialPeriodColumn === null) {
      return; // já reportado como issue no nível do boletim -- não repete por linha.
    }

    const declaredQuantity = readNumber(row.cells[officialPeriodColumn.quantityColumnIndex]);
    const declaredTotalValue = readNumber(row.cells[officialPeriodColumn.valueColumnIndex]);

    // O bloco oficial é ligado por fórmula (achado real, fora deste
    // módulo): uma célula-fonte vazia nunca aparece como null aqui,
    // ela resolve para 0. Por isso 0 e null são equivalentes para
    // decidir "não medido neste período" -- sem isso, quase todo item
    // do catálogo viraria uma linha com valor 0, mesmo sem nenhuma
    // medição real (confirmado contra o BM_08: 300 itens folha, só 39
    // com valor genuinamente diferente de zero).
    const hasQuantity = declaredQuantity !== null && declaredQuantity !== 0;
    const hasTotalValue = declaredTotalValue !== null && declaredTotalValue !== 0;
    if (!hasQuantity && !hasTotalValue) {
      return; // item existe no catálogo mas não foi medido neste período -- não é uma linha de medição.
    }

    lines.push({
      workPackageCode: code,
      serviceItemCode: code,
      description: name,
      unit,
      declaredQuantity,
      declaredUnitValue: null,
      declaredTotalValue,
      periodLabel,
      sourceLocation: {
        ...sourceLocation,
        physicalColumn: columnIndexToLetters(officialPeriodColumn.quantityColumnIndex),
        financialColumn: columnIndexToLetters(officialPeriodColumn.valueColumnIndex)
      }
    });
  });

  return { workPackages, serviceItems, lines, rowIssues, officialPeriodTotal, historicalGridPeriodTotal, declaredOfficialTotal, declaredOfficialTotalSourceLocation };
}

/**
 * "01.01.01" -> "01.01.00" (pai imediato); "01.01.00" -> "01.00.00";
 * "01.00.00" -> null (já é o topo). Heurística sobre o padrão de
 * código numérico pontilhado observado no arquivo real -- nunca
 * inventa hierarquia para códigos que não seguem esse padrão (nesse
 * caso, `parentCode` fica `null`, sem tentar adivinhar).
 */
function inferParentCode(code: string): string | null {
  const segments = code.split(".");
  if (segments.length < 2 || !segments.every((segment) => /^\d+$/.test(segment))) {
    return null;
  }

  const lastNonZeroIndex = findLastIndex(segments, (segment) => Number(segment) !== 0);
  if (lastNonZeroIndex <= -1) {
    return null;
  }

  const parentSegments = [...segments];
  parentSegments[lastNonZeroIndex] = "0".repeat(segments[lastNonZeroIndex]?.length ?? 2);

  if (parentSegments.every((segment) => Number(segment) === 0)) {
    return null;
  }

  return parentSegments.join(".");
}

function findLastIndex<T>(items: ReadonlyArray<T>, predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index] as T)) {
      return index;
    }
  }
  return -1;
}

function columnIndexToLetters(index: number): string {
  let remaining = index + 1;
  let letters = "";

  while (remaining > 0) {
    const rest = (remaining - 1) % 26;
    letters = String.fromCharCode(65 + rest) + letters;
    remaining = Math.floor((remaining - 1) / 26);
  }

  return letters;
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
