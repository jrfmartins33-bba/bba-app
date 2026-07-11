import type { ExcelSheetDto } from "../../../schedule-management/adapters/excel-import/xlsx-reader.types";
import type { BulletinSheetDetectionResult, DetectedBulletinPeriodColumn, DetectedOfficialPeriodColumn, DetectedOrphanColumn } from "./bulletin-sheet-detector.types";

/**
 * Epic 19, Sprint 4C — reconhece o layout real de um Boletim de
 * Medição (confirmado contra o arquivo BM_08 real durante o
 * Epic 18/19): cabeçalho em DUAS linhas.
 *
 * Linha do rótulo de período (ex.: "ITEM | DISCRIMINAÇÃO | UND. |
 * VALORES DE CONTRATO | CONTROLE FINANCEIRO – MEDIÇÃO | ... | MED-01 |
 * MED-02 | ... | MED-11"): traz `ITEM`/`DISCRIMINAÇÃO`/`UND.`
 * (código/nome/unidade do item), o rótulo do bloco financeiro
 * autoritativo E os rótulos `MED-NN` de período, todos na MESMA
 * linha.
 *
 * Linha imediatamente abaixo (sub-cabeçalho): traz `QUANT.`/`PREÇO
 * UNITÁRIO`/`PREÇO TOTAL` (sob "VALORES DE CONTRATO"), `QUANTITATIVO`/
 * `VALOR (R$)` (sob "CONTROLE FINANCEIRO – MEDIÇÃO") e, sob cada
 * `MED-NN`, um par `FISICO`/`FINANCEIRO` nas duas colunas logo abaixo
 * do rótulo do período.
 *
 * Achado da revisão pós-19.4A/4C (investigação com leitura de
 * fórmulas do arquivo real, fora deste módulo): a grade MED-NN
 * (`periodColumns`) é preenchida manualmente, sem fórmula, e não
 * reconcilia com o total oficial do boletim. O bloco "CONTROLE
 * FINANCEIRO – MEDIÇÃO" (`officialPeriodColumn`), por outro lado, é
 * ligado por fórmula à aba `BOLETIM FÍSICO FINANCEIRO` e reconcilia
 * exatamente com o rodapé/certificação do boletim e com `RESUMO`. Por
 * isso `officialPeriodColumn` é a única fonte usada para
 * `ParsedMeasurementLine`; `periodColumns` permanece detectado apenas
 * para auditoria (ver `bulletin-import.ts`).
 *
 * Layout diferente do `sheet-type-detector.ts` do Project Studio
 * (cronograma/curva-S) — arquivo próprio, sem reaproveitar aquele
 * detector: os tokens e a estrutura de duas linhas são específicos
 * deste formato.
 */
const ROWS_SCANNED_FOR_HEADER = 40;
const MINIMUM_PERIOD_COLUMNS = 3;
const PERIOD_LABEL_PATTERN = /^MED[-.\s]?(\d+)$/;
const OFFICIAL_BLOCK_HEADER_TOKEN = "CONTROLE FINANCEIRO";
const OFFICIAL_QUANTITY_TOKEN = "QUANTITATIVO";
const OFFICIAL_VALUE_TOKEN = "VALOR";
const ORPHAN_COLUMN_MINIMUM_VALUES = 10;
const COMBINING_DIACRITIC_RANGE_START = 0x0300;
const COMBINING_DIACRITIC_RANGE_END = 0x036f;

export function normalizeBulletinToken(value: string): string {
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

export function detectBulletinSheet(sheet: ExcelSheetDto): BulletinSheetDetectionResult | null {
  const periodLabelRowIndex = findPeriodLabelRow(sheet);
  if (periodLabelRowIndex === null) {
    return null;
  }

  const periodLabelRow = sheet.rows[periodLabelRowIndex];
  const subHeaderRowIndex = periodLabelRowIndex + 1;
  const subHeaderRow = sheet.rows[subHeaderRowIndex];

  if (periodLabelRow === undefined || subHeaderRow === undefined) {
    return null;
  }

  const periodColumns = extractPeriodColumns(periodLabelRow, subHeaderRow);
  // Mesmo limiar de 3 usado para escolher a linha (findPeriodLabelRow)
  // -- se só uma fração dos rótulos MED-NN encontrados realmente
  // pareou com FISICO/FINANCEIRO na sub-linha, o layout não bate o
  // suficiente para ser tratado como um Boletim de Medição real.
  if (periodColumns.length < MINIMUM_PERIOD_COLUMNS) {
    return null;
  }

  const firstPeriodColumnIndex = Math.min(...periodColumns.map((c) => c.physicalColumnIndex));

  const { codeColumnIndex, nameColumnIndex, unitColumnIndex } = classifyPeriodLabelRow(periodLabelRow, firstPeriodColumnIndex);
  const { contractQuantityColumnIndex, unitPriceColumnIndex } = classifySubHeaderRow(subHeaderRow, firstPeriodColumnIndex);
  const officialPeriodColumn = findOfficialPeriodColumn(periodLabelRow, subHeaderRow, firstPeriodColumnIndex);
  const orphanColumns = findOrphanColumns(sheet, periodLabelRow, subHeaderRow, subHeaderRowIndex, nameColumnIndex, firstPeriodColumnIndex);

  const confidence =
    periodColumns.length +
    (codeColumnIndex !== null ? 2 : 0) +
    (nameColumnIndex !== null ? 2 : 0) +
    (unitPriceColumnIndex !== null ? 1 : 0) +
    (officialPeriodColumn !== null ? 2 : 0);

  return {
    periodLabelRowIndex,
    subHeaderRowIndex,
    codeColumnIndex,
    nameColumnIndex,
    unitColumnIndex,
    contractQuantityColumnIndex,
    unitPriceColumnIndex,
    periodColumns,
    officialPeriodColumn,
    orphanColumns,
    confidence
  };
}

/**
 * Bloco "CONTROLE FINANCEIRO – MEDIÇÃO" -> `QUANTITATIVO`/`VALOR
 * (R$)` -- fonte autoritativa do período corrente (ver nota no topo
 * do arquivo). Busca restrita às colunas ANTES da grade MED-NN, na
 * mesma dupla de linhas já usada para o resto do cabeçalho -- nunca
 * amarrada a uma posição de coluna fixa (H:I é só o resultado no
 * BM_08 real; outro boletim do mesmo órgão pode deslocar as colunas).
 */
function findOfficialPeriodColumn(
  periodLabelRow: ExcelSheetDto["rows"][number],
  subHeaderRow: ExcelSheetDto["rows"][number],
  firstPeriodColumnIndex: number
): DetectedOfficialPeriodColumn | null {
  let headerColumnIndex: number | null = null;
  let headerLabel: string | null = null;

  periodLabelRow.cells.forEach((cell, columnIndex) => {
    if (headerColumnIndex !== null || columnIndex >= firstPeriodColumnIndex || typeof cell !== "string") {
      return;
    }
    if (normalizeBulletinToken(cell).includes(OFFICIAL_BLOCK_HEADER_TOKEN)) {
      headerColumnIndex = columnIndex;
      headerLabel = cell.trim();
    }
  });

  if (headerColumnIndex === null || headerLabel === null) {
    return null;
  }

  let quantityColumnIndex: number | null = null;
  let valueColumnIndex: number | null = null;

  for (let columnIndex = headerColumnIndex; columnIndex < firstPeriodColumnIndex; columnIndex++) {
    const cell = subHeaderRow.cells[columnIndex];
    if (typeof cell !== "string") {
      continue;
    }
    const normalized = normalizeBulletinToken(cell);

    if (quantityColumnIndex === null && normalized.includes(OFFICIAL_QUANTITY_TOKEN)) {
      quantityColumnIndex = columnIndex;
      continue;
    }
    if (quantityColumnIndex !== null && valueColumnIndex === null && columnIndex > quantityColumnIndex && normalized.includes(OFFICIAL_VALUE_TOKEN)) {
      valueColumnIndex = columnIndex;
    }
  }

  if (quantityColumnIndex === null || valueColumnIndex === null) {
    return null;
  }

  return { headerLabel, quantityColumnIndex, valueColumnIndex };
}

/**
 * Colunas de texto livre sem NENHUM rótulo (nem na linha de período,
 * nem na sub-linha) situadas entre o bloco contratual e a grade
 * MED-NN, com um volume relevante de valores de texto -- achado real:
 * coluna N do BM_08, resíduo sem fórmula, sem relação estrutural
 * confiável com o resto da planilha (ver `bulletin-import.ts`, que
 * gera um warning agregado por coluna, nunca por célula).
 */
function findOrphanColumns(
  sheet: ExcelSheetDto,
  periodLabelRow: ExcelSheetDto["rows"][number],
  subHeaderRow: ExcelSheetDto["rows"][number],
  subHeaderRowIndex: number,
  nameColumnIndex: number | null,
  firstPeriodColumnIndex: number
): ReadonlyArray<DetectedOrphanColumn> {
  const candidateColumns: number[] = [];
  for (let columnIndex = 0; columnIndex < firstPeriodColumnIndex; columnIndex++) {
    const hasLabel = periodLabelRow.cells[columnIndex] != null || subHeaderRow.cells[columnIndex] != null;
    if (!hasLabel) {
      candidateColumns.push(columnIndex);
    }
  }

  if (candidateColumns.length === 0) {
    return [];
  }

  const dataRows = sheet.rows.slice(subHeaderRowIndex + 1);
  const nameValues = new Set<string>();
  if (nameColumnIndex !== null) {
    dataRows.forEach((row) => {
      const cell = row.cells[nameColumnIndex];
      if (typeof cell === "string" && cell.trim().length > 0) {
        nameValues.add(normalizeBulletinToken(cell));
      }
    });
  }

  return candidateColumns
    .map((columnIndex): DetectedOrphanColumn | null => {
      let valueCount = 0;
      let matchingNameColumnCount = 0;

      dataRows.forEach((row) => {
        const cell = row.cells[columnIndex];
        if (typeof cell !== "string" || cell.trim().length === 0) {
          return;
        }
        valueCount++;
        if (nameValues.has(normalizeBulletinToken(cell))) {
          matchingNameColumnCount++;
        }
      });

      return valueCount >= ORPHAN_COLUMN_MINIMUM_VALUES ? { columnIndex, valueCount, matchingNameColumnCount } : null;
    })
    .filter((column): column is DetectedOrphanColumn => column !== null);
}

function findPeriodLabelRow(sheet: ExcelSheetDto): number | null {
  let best: { rowIndex: number; matchCount: number } | null = null;

  sheet.rows.slice(0, ROWS_SCANNED_FOR_HEADER).forEach((row, rowIndex) => {
    const matchCount = row.cells.filter((cell) => typeof cell === "string" && PERIOD_LABEL_PATTERN.test(normalizeBulletinToken(cell))).length;

    if (matchCount >= MINIMUM_PERIOD_COLUMNS && (best === null || matchCount > best.matchCount)) {
      best = { rowIndex, matchCount };
    }
  });

  return best === null ? null : (best as { rowIndex: number; matchCount: number }).rowIndex;
}

function extractPeriodColumns(periodLabelRow: ExcelSheetDto["rows"][number], subHeaderRow: ExcelSheetDto["rows"][number]): ReadonlyArray<DetectedBulletinPeriodColumn> {
  const columns: DetectedBulletinPeriodColumn[] = [];

  periodLabelRow.cells.forEach((cell, columnIndex) => {
    if (typeof cell !== "string") {
      return;
    }

    const match = PERIOD_LABEL_PATTERN.exec(normalizeBulletinToken(cell));
    if (match === null) {
      return;
    }

    // FISICO/FINANCEIRO ficam nas duas colunas logo abaixo do rótulo
    // de período -- nunca deduzido de outra posição.
    const physicalCell = subHeaderRow.cells[columnIndex];
    const financialCell = subHeaderRow.cells[columnIndex + 1];

    const isPhysical = typeof physicalCell === "string" && normalizeBulletinToken(physicalCell).includes("FISICO");
    const isFinancial = typeof financialCell === "string" && normalizeBulletinToken(financialCell).includes("FINANCEIRO");

    if (!isPhysical || !isFinancial) {
      return;
    }

    columns.push({
      label: cell.trim(),
      periodNumber: Number(match[1]),
      physicalColumnIndex: columnIndex,
      financialColumnIndex: columnIndex + 1
    });
  });

  return columns;
}

function classifyPeriodLabelRow(
  row: ExcelSheetDto["rows"][number],
  beforeColumnIndex: number
): { codeColumnIndex: number | null; nameColumnIndex: number | null; unitColumnIndex: number | null } {
  let codeColumnIndex: number | null = null;
  let nameColumnIndex: number | null = null;
  let unitColumnIndex: number | null = null;

  row.cells.forEach((cell, columnIndex) => {
    if (typeof cell !== "string" || columnIndex >= beforeColumnIndex) {
      return;
    }

    const normalized = normalizeBulletinToken(cell);

    if (codeColumnIndex === null && normalized.includes("ITEM")) {
      codeColumnIndex = columnIndex;
      return;
    }

    if (nameColumnIndex === null && (normalized.includes("DISCRIMINACAO") || normalized.includes("DESCRICAO") || normalized.includes("SERVICO"))) {
      nameColumnIndex = columnIndex;
      return;
    }

    if (unitColumnIndex === null && (normalized === "UND." || normalized === "UND" || normalized.includes("UNIDADE"))) {
      unitColumnIndex = columnIndex;
    }
  });

  return { codeColumnIndex, nameColumnIndex, unitColumnIndex };
}

function classifySubHeaderRow(
  row: ExcelSheetDto["rows"][number],
  beforeColumnIndex: number
): { contractQuantityColumnIndex: number | null; unitPriceColumnIndex: number | null } {
  let contractQuantityColumnIndex: number | null = null;
  let unitPriceColumnIndex: number | null = null;

  row.cells.forEach((cell, columnIndex) => {
    if (typeof cell !== "string" || columnIndex >= beforeColumnIndex) {
      return;
    }

    const normalized = normalizeBulletinToken(cell);

    if (contractQuantityColumnIndex === null && normalized.startsWith("QUANT")) {
      contractQuantityColumnIndex = columnIndex;
      return;
    }

    if (unitPriceColumnIndex === null && normalized.includes("PRECO UNITARIO")) {
      unitPriceColumnIndex = columnIndex;
    }
  });

  return { contractQuantityColumnIndex, unitPriceColumnIndex };
}
