/**
 * Utilitários geométricos puros e genéricos, sem nenhum dado real —
 * mesma disciplina numérica já usada em
 * `structure-reconstruction/physical-text-block-reconstruction.ts` e
 * `physical-column-hypothesis-reconstruction/physical-vertical-band-construction.ts`
 * (união via min/max real dos limites completos, interseção horizontal
 * via `Math.max(0, min(rights) - max(lefts))`) — nunca reinventados aqui,
 * nunca com tolerância decimal arbitrária.
 */
import type { ReferenceTruthBoundingBox, ReferenceTruthHorizontalBand } from "./discovery-reference-truth-cell-geometry.types";

export function isFiniteBoundingBox(box: ReferenceTruthBoundingBox): boolean {
  return (
    Number.isFinite(box.leftPoints) &&
    Number.isFinite(box.topPoints) &&
    Number.isFinite(box.rightPoints) &&
    Number.isFinite(box.bottomPoints)
  );
}

export function isOrderedBoundingBox(box: ReferenceTruthBoundingBox): boolean {
  return box.leftPoints < box.rightPoints && box.topPoints < box.bottomPoints;
}

export function isValidBoundingBox(box: ReferenceTruthBoundingBox): boolean {
  return isFiniteBoundingBox(box) && isOrderedBoundingBox(box);
}

/** União real (min/max) dos limites completos das caixas fornecidas. `null` apenas para lista vazia. */
export function unionBoundingBoxes(boxes: ReadonlyArray<ReferenceTruthBoundingBox>): ReferenceTruthBoundingBox | null {
  if (boxes.length === 0) return null;
  return {
    leftPoints: Math.min(...boxes.map((b) => b.leftPoints)),
    topPoints: Math.min(...boxes.map((b) => b.topPoints)),
    rightPoints: Math.max(...boxes.map((b) => b.rightPoints)),
    bottomPoints: Math.max(...boxes.map((b) => b.bottomPoints)),
  };
}

export function boundingBoxesAreEqual(a: ReferenceTruthBoundingBox, b: ReferenceTruthBoundingBox): boolean {
  return a.leftPoints === b.leftPoints && a.topPoints === b.topPoints && a.rightPoints === b.rightPoints && a.bottomPoints === b.bottomPoints;
}

/** Interseção horizontal real entre uma caixa e uma faixa de coluna. `null` quando a largura resultante não é estritamente positiva. */
export function intersectHorizontal(box: ReferenceTruthBoundingBox, band: ReferenceTruthHorizontalBand): ReferenceTruthHorizontalBand | null {
  const leftPoints = Math.max(box.leftPoints, band.leftPoints);
  const rightPoints = Math.min(box.rightPoints, band.rightPoints);
  if (rightPoints <= leftPoints) return null;
  return { leftPoints, rightPoints };
}

/** Sobreposição vertical estritamente positiva entre duas caixas. */
export function hasPositiveVerticalOverlap(a: ReferenceTruthBoundingBox, b: ReferenceTruthBoundingBox): boolean {
  return Math.min(a.bottomPoints, b.bottomPoints) - Math.max(a.topPoints, b.topPoints) > 0;
}

export function boxIsWithinPage(box: ReferenceTruthBoundingBox, pageWidthPoints: number, pageHeightPoints: number): boolean {
  return box.leftPoints >= 0 && box.topPoints >= 0 && box.rightPoints <= pageWidthPoints && box.bottomPoints <= pageHeightPoints;
}
