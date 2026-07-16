import type { PhysicalDocumentPageMetrics } from "./physical-document-read.types";

/**
 * Caractere Unicode de substituição (ver RFC/Unicode U+FFFD), emitido por
 * decodificadores quando não conseguem mapear um byte/codepoint de origem.
 */
const REPLACEMENT_CHARACTER = "�";

/**
 * Codepoints de controle C0 (exceto TAB/LF/CR, legitimamente usados pela
 * normalização — ver `physical-document-text-normalization.ts`), DEL, e os
 * controles C1. Ver seção 17.3 do brief da Sprint: a regra precisa ser
 * objetiva e testada, não uma lista informal.
 */
function isUnexpectedControlCodePoint(codePoint: number): boolean {
  const isC0ControlExceptWhitespaceUsedByNormalization =
    codePoint <= 0x1f && codePoint !== 0x09 && codePoint !== 0x0a && codePoint !== 0x0d;
  const isDelete = codePoint === 0x7f;
  const isC1Control = codePoint >= 0x80 && codePoint <= 0x9f;
  return isC0ControlExceptWhitespaceUsedByNormalization || isDelete || isC1Control;
}

/**
 * Um codepoint é considerado vazio, para a contagem de caracteres não
 * vazios, quando corresponde a espaço em branco Unicode — determinado por
 * `/\s/u` (espaço, tabulação, quebras de linha e separadores Unicode de
 * espaço). Todos os demais codepoints, incluindo pontuação e símbolos,
 * contam como não vazios. Regra determinística, não econômica.
 */
function isEmptyCodePoint(char: string): boolean {
  return /\s/u.test(char);
}

/**
 * Calcula métricas técnicas objetivas e reproduzíveis a partir do texto
 * originalmente extraído de uma página (antes da normalização) — reflete
 * o que foi fisicamente observado, não o resultado da normalização.
 * Percorre por codepoint (não por unidade UTF-16), evitando contar
 * incorretamente pares substitutos.
 */
export function computePageTextMetrics(itemTexts: ReadonlyArray<string>): PhysicalDocumentPageMetrics {
  let nonEmptyCharacterCount = 0;
  let replacementCharacterCount = 0;
  let unexpectedControlCharacterCount = 0;

  for (const text of itemTexts) {
    for (const char of text) {
      if (char === REPLACEMENT_CHARACTER) {
        replacementCharacterCount += 1;
      }

      const codePoint = char.codePointAt(0);
      if (codePoint !== undefined && isUnexpectedControlCodePoint(codePoint)) {
        unexpectedControlCharacterCount += 1;
      }

      if (!isEmptyCodePoint(char)) {
        nonEmptyCharacterCount += 1;
      }
    }
  }

  return {
    textItemCount: itemTexts.length,
    nonEmptyCharacterCount,
    replacementCharacterCount,
    unexpectedControlCharacterCount,
  };
}
