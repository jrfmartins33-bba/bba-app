/**
 * BBA Project Studio — Sprint 1. Construtor de arquivos .xlsx
 * sintéticos, usado apenas pelos testes automatizados deste
 * adaptador. O arquivo real do cliente (usado para validar o
 * reconhecimento de colunas durante o desenvolvimento) contém dados
 * comerciais reais e nunca é commitado — estes fixtures sintéticos são
 * o que garante a suíte de testes permanente sem depender dele.
 *
 * Escreve um ZIP mínimo válido (entradas sem compressão, método
 * "stored") contendo só o necessário para `xlsx-reader.ts` funcionar:
 * `xl/workbook.xml`, `xl/_rels/workbook.xml.rels`,
 * `xl/sharedStrings.xml` e uma `xl/worksheets/sheetN.xml` por planilha
 * — não é um gerador de .xlsx de propósito geral.
 */
export interface FixtureSheetSpec {
  readonly name: string;
  readonly hidden?: boolean;
  readonly rows: ReadonlyArray<ReadonlyArray<string | number | null>>;
}

export function buildXlsxFixture(sheets: ReadonlyArray<FixtureSheetSpec>): Uint8Array {
  const sharedStrings: string[] = [];
  const sharedStringIndex = new Map<string, number>();

  const internString = (value: string): number => {
    const existing = sharedStringIndex.get(value);
    if (existing !== undefined) {
      return existing;
    }
    const index = sharedStrings.length;
    sharedStrings.push(value);
    sharedStringIndex.set(value, index);
    return index;
  };

  const entries: Array<{ name: string; data: Uint8Array }> = [];

  sheets.forEach((sheet, sheetIndex) => {
    entries.push({
      name: `xl/worksheets/sheet${sheetIndex + 1}.xml`,
      data: encodeUtf8(buildSheetXml(sheet.rows, internString)),
    });
  });

  entries.unshift({ name: "xl/sharedStrings.xml", data: encodeUtf8(buildSharedStringsXml(sharedStrings)) });
  entries.unshift({ name: "xl/_rels/workbook.xml.rels", data: encodeUtf8(buildWorkbookRelsXml(sheets.length)) });
  entries.unshift({ name: "xl/workbook.xml", data: encodeUtf8(buildWorkbookXml(sheets)) });

  return writeZip(entries);
}

function buildWorkbookXml(sheets: ReadonlyArray<FixtureSheetSpec>): string {
  const sheetTags = sheets
    .map((sheet, index) => {
      const hiddenAttr = sheet.hidden === true ? ` state="hidden"` : "";
      return `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}"${hiddenAttr} r:id="rId${index + 1}"/>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetTags}</sheets></workbook>`;
}

function buildWorkbookRelsXml(sheetCount: number): string {
  const sheetRels = Array.from({ length: sheetCount }, (_, index) => index + 1)
    .map(
      (id) =>
        `<Relationship Id="rId${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${id}.xml"/>`,
    )
    .join("");
  const sharedStringsRel = `<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetRels}${sharedStringsRel}</Relationships>`;
}

function buildSharedStringsXml(sharedStrings: ReadonlyArray<string>): string {
  const items = sharedStrings.map((value) => `<si><t>${escapeXml(value)}</t></si>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">${items}</sst>`;
}

function buildSheetXml(
  rows: ReadonlyArray<ReadonlyArray<string | number | null>>,
  internString: (value: string) => number,
): string {
  const rowTags = rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cellTags = row
        .map((cell, columnIndex) => {
          if (cell === null || cell === "") {
            return "";
          }

          const ref = `${columnIndexToLetters(columnIndex)}${rowNumber}`;

          if (typeof cell === "number") {
            return `<c r="${ref}"><v>${cell}</v></c>`;
          }

          return `<c r="${ref}" t="s"><v>${internString(cell)}</v></c>`;
        })
        .join("");

      return `<row r="${rowNumber}">${cellTags}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowTags}</sheetData></worksheet>`;
}

function columnIndexToLetters(index: number): string {
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function encodeUtf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function writeZip(entries: ReadonlyArray<{ name: string; data: Uint8Array }>): Uint8Array {
  const chunks: Uint8Array[] = [];
  const centralDirectoryEntries: Uint8Array[] = [];
  let offset = 0;

  entries.forEach((entry) => {
    const nameBytes = encodeUtf8(entry.name);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);

    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, 0, true);
    localView.setUint32(18, entry.data.length, true);
    localView.setUint32(22, entry.data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    chunks.push(localHeader, entry.data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);

    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, 0, true);
    centralView.setUint32(20, entry.data.length, true);
    centralView.setUint32(24, entry.data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralDirectoryEntries.push(centralHeader);
    offset += localHeader.length + entry.data.length;
  });

  const centralDirectoryOffset = offset;
  const centralDirectorySize = centralDirectoryEntries.reduce((sum, entry) => sum + entry.length, 0);

  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(4, 0, true);
  eocdView.setUint16(6, 0, true);
  eocdView.setUint16(8, entries.length, true);
  eocdView.setUint16(10, entries.length, true);
  eocdView.setUint32(12, centralDirectorySize, true);
  eocdView.setUint32(16, centralDirectoryOffset, true);
  eocdView.setUint16(20, 0, true);

  return concatUint8Arrays([...chunks, ...centralDirectoryEntries, eocd]);
}

function concatUint8Arrays(parts: ReadonlyArray<Uint8Array>): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let position = 0;
  parts.forEach((part) => {
    result.set(part, position);
    position += part.length;
  });
  return result;
}
