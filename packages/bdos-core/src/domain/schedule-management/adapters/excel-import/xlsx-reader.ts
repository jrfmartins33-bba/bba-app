import { inflateRawSync } from "node:zlib";
import type { ExcelCellRaw, ExcelCellValue, ExcelSheetDto, ExcelSheetRaw, ExcelSheetRow, ExcelSheetRowRaw, ExcelWorkbookDto, ExcelWorkbookRaw } from "./xlsx-reader.types";

/**
 * BBA Project Studio — Sprint 1. Leitor mínimo, hand-rolled, do
 * formato .xlsx (Office Open XML dentro de um ZIP) — a mesma
 * disciplina de zero dependências de runtime já aplicada ao leitor de
 * XML do MS Project (Sprint Zero). Não é um parser de ZIP/XLSX de
 * propósito geral: lê exatamente o necessário (entradas do ZIP,
 * `workbook.xml`, `workbook.xml.rels`, `sharedStrings.xml`, cada
 * planilha) para produzir um `ExcelWorkbookDto` neutro — o domínio
 * (`planning-dataset.ts`) nunca importa este arquivo, apenas o
 * detector/importador desta mesma pasta.
 */
export function readXlsxWorkbook(bytes: Uint8Array): ExcelWorkbookDto {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries = readCentralDirectory(bytes, view);
  const readText = (name: string): string | null => {
    const entry = entries.get(name);
    return entry === undefined ? null : decodeUtf8(readEntry(bytes, view, entry));
  };

  const workbookXml = readText("xl/workbook.xml");
  if (workbookXml === null) {
    throw new Error("Invalid .xlsx file: xl/workbook.xml not found.");
  }

  const relsXml = readText("xl/_rels/workbook.xml.rels");
  const sharedStrings = parseSharedStrings(readText("xl/sharedStrings.xml"));

  const relTargetById = parseRelationships(relsXml);
  const sheetMetas = parseWorkbookSheets(workbookXml);

  const sheets: ExcelSheetDto[] = sheetMetas.map((meta) => {
    const target = relTargetById.get(meta.relationshipId);
    const sheetPath = target === undefined ? null : resolveXlPath(target);
    const sheetXml = sheetPath === null ? null : readText(sheetPath);

    return {
      name: meta.name,
      hidden: meta.hidden,
      rows: sheetXml === null ? [] : parseSheetRows(sheetXml, sharedStrings),
    };
  });

  return { sheets };
}

interface ZipEntry {
  readonly compressionMethod: number;
  readonly compressedSize: number;
  readonly localHeaderOffset: number;
}

function readCentralDirectory(bytes: Uint8Array, view: DataView): Map<string, ZipEntry> {
  const eocdOffset = findEndOfCentralDirectory(bytes, view);
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);
  const entryCount = view.getUint16(eocdOffset + 10, true);

  const entries = new Map<string, ZipEntry>();
  let offset = centralDirectoryOffset;

  for (let i = 0; i < entryCount; i++) {
    const signature = view.getUint32(offset, true);
    if (signature !== 0x02014b50) {
      throw new Error(`Invalid .xlsx file: unexpected central directory signature at offset ${offset}.`);
    }

    const compressionMethod = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const name = decodeUtf8(bytes.subarray(offset + 46, offset + 46 + nameLength));

    entries.set(name, { compressionMethod, compressedSize, localHeaderOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(bytes: Uint8Array, view: DataView): number {
  const signature = 0x06054b50;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === signature) {
      return i;
    }
  }
  throw new Error("Invalid .xlsx file: End Of Central Directory record not found.");
}

function readEntry(bytes: Uint8Array, view: DataView, entry: ZipEntry): Uint8Array {
  const lh = entry.localHeaderOffset;
  const nameLength = view.getUint16(lh + 26, true);
  const extraLength = view.getUint16(lh + 28, true);
  const dataStart = lh + 30 + nameLength + extraLength;
  const compressed = bytes.subarray(dataStart, dataStart + entry.compressedSize);

  if (entry.compressionMethod === 0) {
    return compressed;
  }

  if (entry.compressionMethod === 8) {
    return inflateRawSync(compressed);
  }

  throw new Error(`Unsupported .xlsx ZIP compression method ${entry.compressionMethod}.`);
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes);
}

interface WorkbookSheetMeta {
  readonly name: string;
  readonly relationshipId: string;
  readonly hidden: boolean;
}

function parseWorkbookSheets(workbookXml: string): ReadonlyArray<WorkbookSheetMeta> {
  const sheetBlocks = workbookXml.match(/<sheet\s[^>]*\/>/g) ?? [];

  return sheetBlocks.map((block) => {
    const name = /name="([^"]*)"/.exec(block)?.[1] ?? "";
    const relationshipId = /r:id="([^"]*)"/.exec(block)?.[1] ?? "";
    const hidden = /state="hidden"/.test(block);
    return { name: decodeXmlEntities(name), relationshipId, hidden };
  });
}

function parseRelationships(relsXml: string | null): Map<string, string> {
  const map = new Map<string, string>();
  if (relsXml === null) {
    return map;
  }

  const blocks = relsXml.match(/<Relationship\s[^>]*\/>/g) ?? [];
  blocks.forEach((block) => {
    const id = /Id="([^"]*)"/.exec(block)?.[1];
    const target = /Target="([^"]*)"/.exec(block)?.[1];
    if (id !== undefined && target !== undefined) {
      map.set(id, target);
    }
  });

  return map;
}

function resolveXlPath(target: string): string {
  return target.startsWith("/") ? target.slice(1) : `xl/${target}`;
}

function parseSharedStrings(sharedStringsXml: string | null): ReadonlyArray<string> {
  if (sharedStringsXml === null) {
    return [];
  }

  const siBlocks = sharedStringsXml.match(/<si>[\s\S]*?<\/si>/g) ?? [];
  return siBlocks.map((block) => {
    const texts = [...block.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((match) => decodeXmlEntities(match[1] ?? ""));
    return texts.join("");
  });
}

function parseSheetRows(sheetXml: string, sharedStrings: ReadonlyArray<string>): ReadonlyArray<ExcelSheetRow> {
  const rowBlocks = sheetXml.match(/<row[^>]*\/>|<row[^>]*>[\s\S]*?<\/row>/g) ?? [];

  return rowBlocks.map((rowBlock) => {
    const rowNumber = Number(/<row r="(\d+)"/.exec(rowBlock)?.[1] ?? "0");
    const cellBlocks = rowBlock.match(/<c\s[^>]*\/>|<c\s[^>]*>[\s\S]*?<\/c>/g) ?? [];

    const sparse = new Map<number, ExcelCellValue>();
    let maxColumn = -1;

    cellBlocks.forEach((cellBlock) => {
      const cellRef = /r="([A-Z]+)\d+"/.exec(cellBlock)?.[1];
      if (cellRef === undefined) {
        return;
      }

      const columnIndex = columnLettersToIndex(cellRef);
      maxColumn = Math.max(maxColumn, columnIndex);
      sparse.set(columnIndex, readCellValue(cellBlock, sharedStrings));
    });

    const cells: ExcelCellValue[] = [];
    for (let column = 0; column <= maxColumn; column++) {
      cells.push(sparse.get(column) ?? null);
    }

    return { rowNumber, cells };
  });
}

function readCellValue(cellBlock: string, sharedStrings: ReadonlyArray<string>): ExcelCellValue {
  const type = /\st="([^"]+)"/.exec(cellBlock)?.[1] ?? null;
  const inlineMatch = /<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/.exec(cellBlock);

  if (inlineMatch !== null) {
    return decodeXmlEntities(inlineMatch[1]);
  }

  const valueMatch = /<v>([\s\S]*?)<\/v>/.exec(cellBlock);
  if (valueMatch === null) {
    return null;
  }

  const raw = valueMatch[1];

  if (type === "s") {
    const index = Number(raw);
    return sharedStrings[index] ?? null;
  }

  if (type === "str" || type === "e") {
    return decodeXmlEntities(raw);
  }

  if (type === "b") {
    return raw === "1" ? 1 : 0;
  }

  const numeric = Number(raw);
  return Number.isNaN(numeric) ? decodeXmlEntities(raw) : numeric;
}

function columnLettersToIndex(letters: string): number {
  let index = 0;
  for (const char of letters) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return index - 1;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// ---------------------------------------------------------------------------
// readXlsxWorkbookRaw — Sprint 21.5B (additive, does not change the API above)
// ---------------------------------------------------------------------------

/**
 * Variante aditiva de `readXlsxWorkbook` que preserva, em cada célula, o
 * conteúdo bruto do elemento `<v>` (campo `rawString`, apenas para células de
 * tipo numérico) e a referência da coluna (`columnRef`, ex.: `"B"`). A API
 * original permanece inalterada. Reutiliza todos os helpers internos já
 * existentes; apenas `parseSheetRowsRaw` e `readCellRaw` são novos.
 */
export function readXlsxWorkbookRaw(bytes: Uint8Array): ExcelWorkbookRaw {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries = readCentralDirectory(bytes, view);
  const readText = (name: string): string | null => {
    const entry = entries.get(name);
    return entry === undefined ? null : decodeUtf8(readEntry(bytes, view, entry));
  };

  const workbookXml = readText("xl/workbook.xml");
  if (workbookXml === null) {
    throw new Error("Invalid .xlsx file: xl/workbook.xml not found.");
  }

  const relsXml = readText("xl/_rels/workbook.xml.rels");
  const sharedStrings = parseSharedStrings(readText("xl/sharedStrings.xml"));

  const relTargetById = parseRelationships(relsXml);
  const sheetMetas = parseWorkbookSheets(workbookXml);

  const sheets: ExcelSheetRaw[] = sheetMetas.map((meta) => {
    const target = relTargetById.get(meta.relationshipId);
    const sheetPath = target === undefined ? null : resolveXlPath(target);
    const sheetXml = sheetPath === null ? null : readText(sheetPath);

    return {
      name: meta.name,
      hidden: meta.hidden,
      rows: sheetXml === null ? [] : parseSheetRowsRaw(sheetXml, sharedStrings),
    };
  });

  return { sheets };
}

function parseSheetRowsRaw(
  sheetXml: string,
  sharedStrings: ReadonlyArray<string>,
): ReadonlyArray<ExcelSheetRowRaw> {
  const sharedFormulas = new Map<string, string>();
  const sharedMatches = sheetXml.matchAll(/<f\s[^>]*si="(\d+)"[^>]*>([\s\S]*?)<\/f>/g);
  for (const match of sharedMatches) {
    const si = match[1]!;
    const text = decodeXmlEntities(match[2] ?? "").trim();
    if (text.length > 0) {
      sharedFormulas.set(si, text);
    }
  }

  const rowBlocks = sheetXml.match(/<row[^>]*\/>|<row[^>]*>[\s\S]*?<\/row>/g) ?? [];

  return rowBlocks.map((rowBlock) => {
    const rowNumber = Number(/<row r="(\d+)"/.exec(rowBlock)?.[1] ?? "0");
    const cellBlocks = rowBlock.match(/<c\s[^>]*\/>|<c\s[^>]*>[\s\S]*?<\/c>/g) ?? [];

    const sparse = new Map<number, ExcelCellRaw>();
    let maxColumn = -1;
    const colRefs = new Map<number, string>();

    cellBlocks.forEach((cellBlock) => {
      const cellRefMatch = /r="([A-Z]+)\d+"/.exec(cellBlock);
      if (cellRefMatch === undefined || cellRefMatch === null) {
        return;
      }
      const colLetters = cellRefMatch[1]!;
      const columnIndex = columnLettersToIndex(colLetters);
      maxColumn = Math.max(maxColumn, columnIndex);
      colRefs.set(columnIndex, colLetters);
      sparse.set(columnIndex, readCellRaw(cellBlock, sharedStrings, colLetters, sharedFormulas));
    });

    const cells: ExcelCellRaw[] = [];
    for (let column = 0; column <= maxColumn; column++) {
      cells.push(
        sparse.get(column) ?? {
          value: null,
          rawString: null,
          columnRef: colRefs.get(column) ?? indexToColumnLetters(column),
          formula: null,
        },
      );
    }

    return { rowNumber, cells };
  });
}

function readCellRaw(
  cellBlock: string,
  sharedStrings: ReadonlyArray<string>,
  columnRef: string,
  sharedFormulas: ReadonlyMap<string, string>,
): ExcelCellRaw {
  let formula: string | null = null;
  const fMatch = /<f(?:\s[^>]*)?>([\s\S]*?)<\/f>|<f\s([^>]*)\/>/.exec(cellBlock);
  if (fMatch !== null) {
    const inlineText = decodeXmlEntities(fMatch[1] ?? "").trim();
    if (inlineText.length > 0) {
      formula = inlineText;
    } else {
      const attrStr = fMatch[2] ?? fMatch[0];
      const si = /si="(\d+)"/.exec(attrStr)?.[1];
      if (si !== undefined && sharedFormulas.has(si)) {
        formula = sharedFormulas.get(si)!;
      }
    }
  }

  const type = /\st="([^"]+)"/.exec(cellBlock)?.[1] ?? null;
  const inlineMatch = /<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/.exec(cellBlock);

  if (inlineMatch !== null) {
    return { value: decodeXmlEntities(inlineMatch[1] ?? ""), rawString: null, columnRef, formula };
  }

  const valueMatch = /<v>([\s\S]*?)<\/v>/.exec(cellBlock);
  if (valueMatch === null) {
    return { value: null, rawString: null, columnRef, formula };
  }

  const raw = valueMatch[1] ?? "";

  if (type === "s") {
    const index = Number(raw);
    return { value: sharedStrings[index] ?? null, rawString: null, columnRef, formula };
  }

  if (type === "str" || type === "e") {
    return { value: decodeXmlEntities(raw), rawString: null, columnRef, formula };
  }

  if (type === "b") {
    return { value: raw === "1" ? 1 : 0, rawString: null, columnRef, formula };
  }

  // Numeric cell (type absent or type === "n"): preserve rawString for exact decimal access.
  const numeric = Number(raw);
  const value = Number.isNaN(numeric) ? decodeXmlEntities(raw) : numeric;
  return {
    value,
    rawString: Number.isNaN(numeric) ? null : raw,
    columnRef,
    formula,
  };
}

/** Inverse of columnLettersToIndex — used only as a fallback for gap columns. */
function indexToColumnLetters(index: number): string {
  let result = "";
  let n = index + 1;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}
