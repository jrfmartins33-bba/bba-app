/**
 * Mapeamento de coordenadas congelado (§7 do protocolo, Momento 3A).
 * Preserva sempre a coordenada bruta, a convenção de origem declarada
 * e a unidade declarada — nunca assume silenciosamente origem
 * superior esquerda, origem inferior esquerda, pixels ou pontos.
 * Converte sempre para a convenção da verdade de referência: origem
 * superior esquerda, unidade em pontos.
 *
 * Quando a convenção de origem ou a unidade são `"unknown"`, a
 * conversão é interrompida (retorna `box: null`), preservando a
 * métrica textual separadamente — nunca adivinha uma convenção
 * plausível.
 */

import type { LocalReaderBoundingBoxConversionResult, LocalReaderPageGeometry, LocalReaderRawBoundingBox } from "./discovery-local-reader-evaluation.types";

const POINTS_PER_INCH = 72;

export function convertLocalReaderBoundingBox(raw: LocalReaderRawBoundingBox, page: LocalReaderPageGeometry): LocalReaderBoundingBoxConversionResult {
  if (raw.originConvention === "unknown") {
    return { box: null, interruptedPt: "Convenção de origem da coordenada bruta não identificada ('unknown') — métrica espacial interrompida para esta caixa; texto avaliado separadamente." };
  }
  if (raw.unit === "unknown") {
    return { box: null, interruptedPt: "Unidade da coordenada bruta não identificada ('unknown') — métrica espacial interrompida para esta caixa; texto avaliado separadamente." };
  }

  const scaleToPoints = raw.unit === "pixels" ? POINTS_PER_INCH / page.renderingResolutionDpi : 1;
  const xMinPt = raw.xMin * scaleToPoints;
  const xMaxPt = raw.xMax * scaleToPoints;
  const yMinPt = raw.yMin * scaleToPoints;
  const yMaxPt = raw.yMax * scaleToPoints;

  let topPoints: number;
  let bottomPoints: number;
  if (raw.originConvention === "top_left") {
    topPoints = yMinPt;
    bottomPoints = yMaxPt;
  } else {
    // bottom_left: y cresce de baixo para cima a partir da borda inferior da página.
    topPoints = page.pageHeightPoints - yMaxPt;
    bottomPoints = page.pageHeightPoints - yMinPt;
  }

  return {
    box: { leftPoints: xMinPt, topPoints, rightPoints: xMaxPt, bottomPoints },
    interruptedPt: null,
  };
}
