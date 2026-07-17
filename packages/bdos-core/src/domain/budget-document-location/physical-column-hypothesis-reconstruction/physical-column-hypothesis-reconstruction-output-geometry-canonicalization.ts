import { canonicalizeOutputGeometryBounds, canonicalizeStructureReconstructionOutputGeometry } from "../structure-reconstruction/structure-reconstruction-output-geometry-canonicalization";

/**
 * Canonicalização da fronteira de saída da reconstrução de hipóteses de
 * colunas físicas (Sprint 21.4A.2.f.2b). Reaproveita, sem duplicar, a
 * mesma política de quantização já consolidada nas Sprints anteriores
 * (seis casas decimais, arredondamento simétrico, `-0 → 0`, limites
 * canonicalizados primeiro, dimensões/centros derivados deles) — com
 * identidade de versão própria, pois a decisão de *onde* aplicá-la (a
 * fronteira de saída das hipóteses) é desta Sprint. Toda decisão
 * geométrica interna (construção de faixa, detecção de sobreposição)
 * permanece em precisão completa. Não exportada pelo barrel público.
 */
export const PHYSICAL_COLUMN_HYPOTHESIS_RECONSTRUCTION_OUTPUT_GEOMETRY_CANONICALIZATION_VERSION =
  "physical-column-hypothesis-reconstruction-output-geometry-canonicalization-v1" as const;

export function canonicalizePhysicalColumnHypothesisReconstructionOutputGeometry(value: number): number {
  return canonicalizeStructureReconstructionOutputGeometry(value);
}

interface GeometryBounds {
  readonly leftPoints: number;
  readonly topPoints: number;
  readonly rightPoints: number;
  readonly bottomPoints: number;
  readonly widthPoints: number;
  readonly heightPoints: number;
  readonly centerXPoints: number;
  readonly centerYPoints: number;
}

/** Canonicaliza os oito campos geométricos comuns às hipóteses de coluna — reaproveita a mesma função das Sprints anteriores (limites primeiro, dimensões/centros derivados). */
export function canonicalizePhysicalColumnHypothesisOutputGeometryBounds<T extends GeometryBounds>(bounds: T): T {
  return canonicalizeOutputGeometryBounds(bounds);
}
