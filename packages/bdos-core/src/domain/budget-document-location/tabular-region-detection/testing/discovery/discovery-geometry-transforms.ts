import type { SyntheticGeometryPage, SyntheticGeometryTextItem } from "../tabular-region-detection-test-bridge";

/**
 * Transformações puramente geométricas de uma `SyntheticGeometryPage`,
 * usadas exclusivamente pela suíte de avaliação de candidatos (Sprint
 * 21.4B.3A, §13/§14 do enunciado: nenhuma candidata pode depender de
 * coordenada absoluta, ordem incidental de array, translação ou escala
 * específica de uma página). Nunca usadas por código de produção.
 */

/** Permuta a ordem dos itens (preservando o `index` técnico original de cada um) — nenhuma candidata deve depender da ordem de descoberta do array. */
export function permuteItems(page: SyntheticGeometryPage): SyntheticGeometryPage {
  const withStableIndex: SyntheticGeometryTextItem[] = page.items.map((item, position) => ({ ...item, index: item.index ?? position }));
  const permuted = [...withStableIndex].reverse();
  return { ...page, items: permuted };
}

export interface GeometryTransform {
  readonly scale?: number;
  readonly translateX?: number;
  readonly translateY?: number;
}

/** Aplica escala uniforme e/ou translação a todas as coordenadas de todos os itens — nenhuma candidata cujas decisões dependam de razões normalizadas deveria mudar de resultado sob esta transformação. */
export function transformPage(page: SyntheticGeometryPage, transform: GeometryTransform): SyntheticGeometryPage {
  const scale = transform.scale ?? 1;
  const translateX = transform.translateX ?? 0;
  const translateY = transform.translateY ?? 0;
  const mapPoint = (v: number, translate: number): number => v * scale + translate;

  const items = page.items.map((item) => ({
    ...item,
    leftPoints: mapPoint(item.leftPoints, translateX),
    rightPoints: mapPoint(item.rightPoints, translateX),
    topPoints: mapPoint(item.topPoints, translateY),
    bottomPoints: mapPoint(item.bottomPoints, translateY),
  }));

  return {
    widthPoints: page.widthPoints * scale + translateX,
    heightPoints: page.heightPoints * scale + translateY,
    items,
  };
}
