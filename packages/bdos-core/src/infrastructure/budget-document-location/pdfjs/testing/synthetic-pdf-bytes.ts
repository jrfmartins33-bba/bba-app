/**
 * Construtor de bytes de PDF mínimo, determinístico e hand-rolled,
 * exclusivamente para os testes deste adaptador. Não usa nenhuma
 * biblioteca de PDF para escrever os bytes (apenas para lê-los, no
 * adaptador sob teste) e não copia nenhum documento real — cada byte é
 * escrito por este arquivo. Não exportado pela API pública do pacote (ver
 * `packages/bdos-core/docs/EPIC_21_SPRINT_4A2C_DOCUMENT_READER_AND_PDF_ADAPTER.md`).
 */

/**
 * Uma única sequência de texto posicionada explicitamente via `Tm`
 * absoluto (não `Td` relativo), para permitir múltiplos itens textuais
 * independentes na mesma página (Sprint 21.4A.2.f.0) sem acumular
 * deslocamentos entre eles.
 */
export interface SyntheticPdfTextRunSpec {
  readonly text: string;
  /** Tamanho de fonte em pontos. Padrão: 24. */
  readonly fontSize?: number;
  /** Posição x da origem do baseline. Padrão: 72. */
  readonly x?: number;
  /** Posição y da origem do baseline. Padrão: 700. */
  readonly y?: number;
}

export interface SyntheticPdfPageSpec {
  /** Texto a desenhar via operador `Tj`. `null`/omitido produz uma página com stream de conteúdo vazio (sem texto extraível), a menos que `items` seja fornecido. Ignorado quando `items` é fornecido. */
  readonly text?: string | null;
  /** Valor de `/Rotate` da página, em graus. Omitido = sem entrada `/Rotate` no dicionário da página. */
  readonly rotateDegrees?: number;
  /** `/MediaBox` da página. Padrão: `[0, 0, 612, 792]`. Permite testar um `viewBox` deslocado (origem != 0). */
  readonly mediaBox?: readonly [number, number, number, number];
  /** Valor de `/UserUnit` da página. Omitido = sem entrada `/UserUnit` (equivalente a 1). */
  readonly userUnit?: number;
  /** Vários itens textuais independentes, cada um posicionado via `Tm` absoluto. Quando fornecido, substitui inteiramente `text`. */
  readonly items?: ReadonlyArray<SyntheticPdfTextRunSpec>;
}

/**
 * Codifica como Latin-1 (um byte por code point 0-255), não UTF-8: os
 * literais de string do PDF são interpretados byte a byte pela
 * `/Encoding /WinAnsiEncoding` do dicionário de fonte (ver
 * `FONT_DICTIONARY_BODY` abaixo), cujo intervalo 0xA0-0xFF coincide com
 * Latin-1/ISO-8859-1 — suficiente para os acentos do português (á, ç, ã,
 * ê, õ) e o traço "—" (0x97, também presente no CP1252/WinAnsi).
 * Codepoints acima de 255 (ex.: CJK) não são representáveis por esta
 * fonte Type1 padrão não incorporada e ficam fora do escopo deste helper.
 */
function encodeLatin1(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const codePoint = text.charCodeAt(i);
    if (codePoint > 0xff) {
      throw new Error(
        `synthetic-pdf-bytes: code point U+${codePoint.toString(16).toUpperCase()} at index ${i} is outside Latin-1 (0-255) and cannot be represented by the non-embedded WinAnsiEncoding Helvetica font this helper uses.`,
      );
    }
    bytes[i] = codePoint;
  }
  return bytes;
}

function buildContentStream(spec: SyntheticPdfPageSpec): string {
  if (spec.items !== undefined) {
    return spec.items
      .map((run) => {
        const fontSize = run.fontSize ?? 24;
        const x = run.x ?? 72;
        const y = run.y ?? 700;
        // `Tf` alone carries the font size scale; `Tm` here is identity
        // scale plus translation only — using the font size in Tm's
        // diagonal *too* would multiply the two (fontSize squared), which
        // is legitimate PDF but not this helper's intent.
        return `BT /F1 ${fontSize} Tf 1 0 0 1 ${x} ${y} Tm (${escapePdfLiteralString(run.text)}) Tj ET`;
      })
      .join(" ");
  }

  return spec.text === null || spec.text === undefined ? "" : `BT /F1 24 Tf 72 700 Td (${escapePdfLiteralString(spec.text)}) Tj ET`;
}

/**
 * Monta um PDF mínimo válido com uma página por item de `pages`, todas
 * usando a fonte padrão Helvetica (sem embutir fonte).
 */
export function buildSyntheticPdfBytes(pages: ReadonlyArray<SyntheticPdfPageSpec>): Uint8Array {
  const builder = new PdfObjectBuilder();

  const pageObjectNumbers = pages.map(() => builder.reserveObjectNumber());
  const contentObjectNumbers = pages.map(() => builder.reserveObjectNumber());
  const fontObjectNumber = builder.reserveObjectNumber();

  const catalogObjectNumber = builder.reserveObjectNumber();
  const pagesObjectNumber = builder.reserveObjectNumber();

  builder.writeObject(
    catalogObjectNumber,
    `<< /Type /Catalog /Pages ${pagesObjectNumber} 0 R >>`,
  );

  const kids = pageObjectNumbers.map((n) => `${n} 0 R`).join(" ");
  builder.writeObject(
    pagesObjectNumber,
    `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`,
  );

  pages.forEach((spec, i) => {
    const rotateEntry = spec.rotateDegrees !== undefined ? ` /Rotate ${spec.rotateDegrees}` : "";
    const box = spec.mediaBox ?? [0, 0, 612, 792];
    const userUnitEntry = spec.userUnit !== undefined ? ` /UserUnit ${spec.userUnit}` : "";
    builder.writeObject(
      pageObjectNumbers[i],
      `<< /Type /Page /Parent ${pagesObjectNumber} 0 R /MediaBox [${box.join(" ")}]${rotateEntry}${userUnitEntry} /Resources << /Font << /F1 ${fontObjectNumber} 0 R >> >> /Contents ${contentObjectNumbers[i]} 0 R >>`,
    );

    builder.writeStreamObject(contentObjectNumbers[i], buildContentStream(spec));
  });

  builder.writeObject(fontObjectNumber, FONT_DICTIONARY_BODY);

  return builder.finish(catalogObjectNumber);
}

/**
 * Monta um PDF com `totalPages` páginas válidas, exceto uma página
 * (`brokenPageIndex`, 1-based) cuja entrada de xref é deliberadamente
 * corrompida para apontar para bytes fora de qualquer objeto válido —
 * reproduz de forma determinística uma falha de página isolada (o
 * documento abre normalmente, mas aquela página específica não pode ser
 * carregada), sem depender de nenhum documento real.
 */
export function buildSyntheticPdfBytesWithBrokenPage(totalPages: number, brokenPageIndex: number): Uint8Array {
  const builder = new PdfObjectBuilder();

  const pageObjectNumbers: number[] = [];
  const contentObjectNumbers: number[] = [];
  for (let i = 0; i < totalPages; i++) {
    pageObjectNumbers.push(builder.reserveObjectNumber());
    contentObjectNumbers.push(builder.reserveObjectNumber());
  }
  const fontObjectNumber = builder.reserveObjectNumber();
  const catalogObjectNumber = builder.reserveObjectNumber();
  const pagesObjectNumber = builder.reserveObjectNumber();

  builder.writeObject(catalogObjectNumber, `<< /Type /Catalog /Pages ${pagesObjectNumber} 0 R >>`);

  const kids = pageObjectNumbers.map((n) => `${n} 0 R`).join(" ");
  builder.writeObject(pagesObjectNumber, `<< /Type /Pages /Kids [${kids}] /Count ${totalPages} >>`);

  for (let i = 0; i < totalPages; i++) {
    builder.writeObject(
      pageObjectNumbers[i],
      `<< /Type /Page /Parent ${pagesObjectNumber} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjectNumber} 0 R >> >> /Contents ${contentObjectNumbers[i]} 0 R >>`,
    );
    const stream = `BT /F1 24 Tf 72 700 Td (Page ${i + 1}) Tj ET`;
    builder.writeStreamObject(contentObjectNumbers[i], stream);
  }

  builder.writeObject(fontObjectNumber, FONT_DICTIONARY_BODY);

  const brokenObjectNumber = pageObjectNumbers[brokenPageIndex - 1];
  return builder.finish(catalogObjectNumber, [{ objectNumber: brokenObjectNumber, corruptOffset: true }]);
}

/** `/Encoding /WinAnsiEncoding` makes the font's upper byte range (used by `encodeLatin1`) resolve to the expected accented-Latin Unicode code points during text extraction. */
const FONT_DICTIONARY_BODY = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";

function escapePdfLiteralString(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

interface CorruptionSpec {
  readonly objectNumber: number;
  readonly corruptOffset: true;
}

class PdfObjectBuilder {
  private nextObjectNumber = 1;
  private readonly chunks: Uint8Array[] = [];
  private offset = 0;
  private readonly objectOffsets = new Map<number, number>();

  constructor() {
    this.push("%PDF-1.4\n");
  }

  reserveObjectNumber(): number {
    return this.nextObjectNumber++;
  }

  writeObject(objectNumber: number, dictionaryBody: string): void {
    this.objectOffsets.set(objectNumber, this.offset);
    this.push(`${objectNumber} 0 obj\n${dictionaryBody}\nendobj\n`);
  }

  writeStreamObject(objectNumber: number, streamBody: string): void {
    this.objectOffsets.set(objectNumber, this.offset);
    this.push(`${objectNumber} 0 obj\n<< /Length ${byteLength(streamBody)} >>\nstream\n${streamBody}\nendstream\nendobj\n`);
  }

  finish(rootObjectNumber: number, corruptions: ReadonlyArray<CorruptionSpec> = []): Uint8Array {
    for (const corruption of corruptions) {
      if (corruption.corruptOffset) {
        // Point the object's xref entry at byte 0 (inside "%PDF-1.4"), so
        // it cannot be parsed as a valid indirect object.
        this.objectOffsets.set(corruption.objectNumber, 0);
      }
    }

    const totalObjects = this.nextObjectNumber - 1;
    const xrefStart = this.offset;
    this.push(`xref\n0 ${totalObjects + 1}\n`);
    this.push("0000000000 65535 f \n");
    for (let n = 1; n <= totalObjects; n++) {
      const objOffset = this.objectOffsets.get(n);
      this.push(
        objOffset === undefined
          ? "0000000000 00000 f \n"
          : `${String(objOffset).padStart(10, "0")} 00000 n \n`,
      );
    }
    this.push(`trailer\n<< /Size ${totalObjects + 1} /Root ${rootObjectNumber} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

    const total = this.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const out = new Uint8Array(total);
    let pos = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, pos);
      pos += chunk.length;
    }
    return out;
  }

  private push(text: string): void {
    const bytes = encodeLatin1(text);
    this.chunks.push(bytes);
    this.offset += bytes.length;
  }
}

function byteLength(text: string): number {
  return encodeLatin1(text).length;
}
