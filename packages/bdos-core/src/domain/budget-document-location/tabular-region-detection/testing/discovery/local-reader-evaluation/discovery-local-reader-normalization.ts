/**
 * Normalização de texto congelada (§6 do protocolo, Momento 3A).
 * Permitido, exatamente: NFC; remoção de espaços nas extremidades;
 * colapso de sequências de espaço/tab horizontal; normalização de
 * quebras de linha para `\n`. Nunca corrige ortografia, nunca troca
 * vírgula por ponto, nunca remove sinais/símbolos, nunca completa
 * zeros, nunca traduz, nunca infere valores, nunca substitui
 * caracteres visualmente semelhantes, nunca usa fuzzy matching para
 * declarar acerto.
 */

export function normalizeLocalReaderText(text: string): string {
  const nfc = text.normalize("NFC");
  const newlinesNormalized = nfc.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const linesCollapsed = newlinesNormalized
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n");
  return linesCollapsed.trim();
}

/**
 * Distância de Levenshtein — exclusivamente informativa (§6, último
 * parágrafo). Nunca usada pelo algoritmo de comparação (§8) para
 * declarar um valor como correto.
 */
export function computeLocalReaderTextualDistance(a: string, b: string): number {
  if (a === b) return 0;
  const lengthA = a.length;
  const lengthB = b.length;
  if (lengthA === 0) return lengthB;
  if (lengthB === 0) return lengthA;

  let previousRow: number[] = new Array(lengthB + 1);
  let currentRow: number[] = new Array(lengthB + 1);
  for (let j = 0; j <= lengthB; j += 1) previousRow[j] = j;

  for (let i = 1; i <= lengthA; i += 1) {
    currentRow[0] = i;
    for (let j = 1; j <= lengthB; j += 1) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      currentRow[j] = Math.min(
        previousRow[j] + 1,
        currentRow[j - 1] + 1,
        previousRow[j - 1] + substitutionCost,
      );
    }
    const swap = previousRow;
    previousRow = currentRow;
    currentRow = swap;
  }
  return previousRow[lengthB];
}
