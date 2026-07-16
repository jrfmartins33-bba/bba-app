import type { PhysicalDocumentPageOrientation } from "./physical-document-read.types";

/**
 * Deriva a orientação física de uma página a partir da geometria
 * efetivamente apresentada (largura e altura já ajustadas pela rotação,
 * quando a biblioteca concreta aplicar essa rotação ao viewport — ver
 * documentação do adaptador). Não usa limiar arbitrário: a única
 * comparação é `width > height`, `height > width` ou igualdade exata.
 *
 * `indeterminate` cobre exclusivamente: dado ausente (`null`), não finito,
 * ou <= 0; ou largura e altura exatamente iguais (página quadrada, sem
 * proporção que distinga retrato de paisagem).
 */
export function derivePageOrientation(
  widthPoints: number | null,
  heightPoints: number | null,
): PhysicalDocumentPageOrientation {
  if (!isValidDimension(widthPoints) || !isValidDimension(heightPoints)) {
    return "indeterminate";
  }

  if (widthPoints > heightPoints) {
    return "landscape";
  }

  if (heightPoints > widthPoints) {
    return "portrait";
  }

  return "indeterminate";
}

function isValidDimension(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value > 0;
}
