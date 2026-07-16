/**
 * Construtor de bytes de PDF mínimo, determinístico e hand-rolled,
 * exclusivamente para os testes deste adaptador. Não usa nenhuma
 * biblioteca de PDF para escrever os bytes (apenas para lê-los, no
 * adaptador sob teste) e não copia nenhum documento real — cada byte é
 * escrito por este arquivo. Não exportado pela API pública do pacote (ver
 * `packages/bdos-core/docs/EPIC_21_SPRINT_4A2C_DOCUMENT_READER_AND_PDF_ADAPTER.md`).
 */

export interface SyntheticPdfPageSpec {
  /** Texto a desenhar via operador `Tj`. `null` produz uma página com stream de conteúdo vazio (sem texto extraível). */
  readonly text: string | null;
  /** Valor de `/Rotate` da página, em graus. Omitido = sem entrada `/Rotate` no dicionário da página. */
  readonly rotateDegrees?: number;
}

const encoder = new TextEncoder();

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
    builder.writeObject(
      pageObjectNumbers[i],
      `<< /Type /Page /Parent ${pagesObjectNumber} 0 R /MediaBox [0 0 612 792]${rotateEntry} /Resources << /Font << /F1 ${fontObjectNumber} 0 R >> >> /Contents ${contentObjectNumbers[i]} 0 R >>`,
    );

    const stream = spec.text === null ? "" : `BT /F1 24 Tf 72 700 Td (${escapePdfLiteralString(spec.text)}) Tj ET`;
    builder.writeStreamObject(contentObjectNumbers[i], stream);
  });

  builder.writeObject(fontObjectNumber, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

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

  builder.writeObject(fontObjectNumber, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  const brokenObjectNumber = pageObjectNumbers[brokenPageIndex - 1];
  return builder.finish(catalogObjectNumber, [{ objectNumber: brokenObjectNumber, corruptOffset: true }]);
}

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
    const bytes = encoder.encode(text);
    this.chunks.push(bytes);
    this.offset += bytes.length;
  }
}

function byteLength(text: string): number {
  return encoder.encode(text).length;
}
