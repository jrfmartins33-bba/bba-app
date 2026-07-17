import { canonicalizeOutputGeometryBounds, canonicalizeStructureReconstructionOutputGeometry } from "../structure-reconstruction/structure-reconstruction-output-geometry-canonicalization";

/**
 * Canonicalização da fronteira de saída da detecção de regiões tabulares
 * (Sprint 21.4A.2.f.2a). Reaproveita, sem duplicar, a mesma política de
 * quantização já consolidada na Sprint anterior
 * (`canonicalizeStructureReconstructionOutputGeometry`/
 * `canonicalizeOutputGeometryBounds`: seis casas decimais, arredondamento
 * simétrico, `-0 → 0`, limites canonicalizados primeiro e dimensões/centros
 * derivados deles) — nunca uma segunda política divergente — mas com
 * identidade de versão própria, pois a decisão de *onde* aplicá-la (a
 * fronteira de saída da detecção de regiões e alinhamentos, não a
 * reconstrução estrutural) é desta Sprint. Toda decisão geométrica interna
 * (tolerância de alinhamento, formação de janelas) permanece em precisão
 * completa; apenas os valores já decididos e expostos no contrato de saída
 * (`RecurrentVerticalAlignment.canonicalPositionPoints`/
 * `observedPositionsPoints`, `TabularRegionCandidate` bounds) são
 * canonicalizados aqui, uma única vez. Não exportada pelo barrel público.
 */
export const TABULAR_REGION_DETECTION_OUTPUT_GEOMETRY_CANONICALIZATION_VERSION =
  "tabular-region-detection-output-geometry-canonicalization-v1" as const;

export function canonicalizeTabularRegionDetectionOutputGeometry(value: number): number {
  return canonicalizeStructureReconstructionOutputGeometry(value);
}

export function canonicalizeTabularRegionDetectionOutputGeometryPoints(values: ReadonlyArray<number>): ReadonlyArray<number> {
  return values.map(canonicalizeTabularRegionDetectionOutputGeometry);
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

/** Canonicaliza os oito campos geométricos comuns às regiões — reaproveita a mesma função da Sprint anterior (limites primeiro, dimensões/centros derivados). */
export function canonicalizeTabularRegionOutputGeometryBounds<T extends GeometryBounds>(bounds: T): T {
  return canonicalizeOutputGeometryBounds(bounds);
}
