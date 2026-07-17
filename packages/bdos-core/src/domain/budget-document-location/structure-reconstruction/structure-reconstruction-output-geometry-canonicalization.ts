import { canonicalizeGeometryPoints } from "../physical-document-text-item-geometry-canonicalization";

/**
 * Canonicalização da fronteira de saída da reconstrução estrutural
 * (Sprint 21.4A.2.f.1, auditoria pós-PR #69, §7). Toda decisão geométrica
 * — compatibilidade par a par de linha, lacuna normalizada de segmento,
 * candidatura bidimensional de bloco, desempates — permanece em precisão
 * completa durante o processamento; nenhuma comparação realizada antes da
 * saída passa por esta função. Apenas os limites, larguras, alturas,
 * centros e lacunas normalizadas **já decididos** e expostos no contrato
 * de saída (`ReconstructedPhysicalLine`, `ReconstructedHorizontalSegment`,
 * `ReconstructedPhysicalTextBlock`) são canonicalizados aqui, uma única
 * vez, na fronteira.
 *
 * Reutiliza deliberadamente a mesma política de quantização da leitura
 * física (`canonicalizeGeometryPoints`: seis casas decimais,
 * arredondamento simétrico, `-0 → 0`) — nunca uma segunda política
 * divergente — mas com identidade de versão própria, pois a decisão de
 * *quando* e *onde* aplicá-la (a fronteira de saída da reconstrução, não a
 * geometria de origem por item) é desta Sprint. Não exportada pelo barrel
 * público (mesma disciplina de `physical-document-text-item-geometry-canonicalization.ts`).
 */
export const STRUCTURE_RECONSTRUCTION_OUTPUT_GEOMETRY_CANONICALIZATION_VERSION =
  "structure-reconstruction-output-geometry-canonicalization-v1" as const;

export function canonicalizeStructureReconstructionOutputGeometry(value: number): number {
  return canonicalizeGeometryPoints(value);
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

/** Canonicaliza os oito campos geométricos comuns a linhas, segmentos e blocos, preservando os demais campos do objeto. */
export function canonicalizeOutputGeometryBounds<T extends GeometryBounds>(bounds: T): T {
  return {
    ...bounds,
    leftPoints: canonicalizeStructureReconstructionOutputGeometry(bounds.leftPoints),
    topPoints: canonicalizeStructureReconstructionOutputGeometry(bounds.topPoints),
    rightPoints: canonicalizeStructureReconstructionOutputGeometry(bounds.rightPoints),
    bottomPoints: canonicalizeStructureReconstructionOutputGeometry(bounds.bottomPoints),
    widthPoints: canonicalizeStructureReconstructionOutputGeometry(bounds.widthPoints),
    heightPoints: canonicalizeStructureReconstructionOutputGeometry(bounds.heightPoints),
    centerXPoints: canonicalizeStructureReconstructionOutputGeometry(bounds.centerXPoints),
    centerYPoints: canonicalizeStructureReconstructionOutputGeometry(bounds.centerYPoints),
  };
}

/** Canonicaliza um array de lacunas normalizadas exportadas (`ReconstructedHorizontalSegment.observedInternalGaps`). */
export function canonicalizeOutputGaps(gaps: ReadonlyArray<number>): ReadonlyArray<number> {
  return gaps.map(canonicalizeStructureReconstructionOutputGeometry);
}
