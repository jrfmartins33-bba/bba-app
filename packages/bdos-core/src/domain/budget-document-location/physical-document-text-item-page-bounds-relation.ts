import type { PhysicalDocumentTextItemPageBoundsRelation } from "./physical-document-read.types";

/**
 * Deriva objetivamente a relação entre os limites de layout (já
 * canonicalizados) de um item textual e o retângulo `[0, 0,
 * pageWidthPoints, pageHeightPoints]` da página apresentada, no mesmo
 * espaço de coordenadas (Sprint 21.4A.2.f.0, seção 25). Nenhum `clamp` é
 * aplicado — esta função apenas classifica, nunca ajusta os limites.
 *
 * `pageWidthPoints`/`pageHeightPoints` devem ser as dimensões canônicas
 * (já validadas finitas e positivas) da página, no mesmo espaço de
 * coordenadas dos limites do item.
 */
export function deriveTextItemPageBoundsRelation(
  bounds: {
    readonly leftPoints: number;
    readonly topPoints: number;
    readonly rightPoints: number;
    readonly bottomPoints: number;
  },
  pageWidthPoints: number,
  pageHeightPoints: number,
): PhysicalDocumentTextItemPageBoundsRelation {
  const { leftPoints, topPoints, rightPoints, bottomPoints } = bounds;

  const hasIntersection = !(
    rightPoints < 0 ||
    leftPoints > pageWidthPoints ||
    bottomPoints < 0 ||
    topPoints > pageHeightPoints
  );

  if (!hasIntersection) {
    return "outside";
  }

  const isFullyInside = leftPoints >= 0 && topPoints >= 0 && rightPoints <= pageWidthPoints && bottomPoints <= pageHeightPoints;

  return isFullyInside ? "inside" : "partially_outside";
}
