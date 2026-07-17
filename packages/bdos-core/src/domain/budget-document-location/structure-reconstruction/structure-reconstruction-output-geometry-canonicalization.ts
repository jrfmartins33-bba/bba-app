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

/**
 * Confirma, após a canonicalização, que os oito campos permanecem
 * coerentes entre si (auditoria pós-PR #69, §3): canonicalizar cada campo
 * de forma independente pode produzir um contrato internamente
 * incoerente (ex.: `leftPoints=0`, `rightPoints=0.000001`,
 * `widthPoints=0`) quando os limites e a dimensão bruta caem em lados
 * diferentes da fronteira de arredondamento. Nunca esperado de disparar —
 * `canonicalizeOutputGeometryBounds` deriva largura/altura/centros dos
 * próprios limites já canonicalizados, o que torna estas igualdades
 * verdadeiras por construção — mas mantido como guarda de integridade
 * interna, nunca exposto ao contrato público.
 */
function assertCoherentCanonicalBounds(bounds: GeometryBounds): void {
  const { leftPoints, topPoints, rightPoints, bottomPoints, widthPoints, heightPoints, centerXPoints, centerYPoints } = bounds;
  const coherent =
    leftPoints <= rightPoints &&
    topPoints <= bottomPoints &&
    widthPoints >= 0 &&
    heightPoints >= 0 &&
    widthPoints === canonicalizeStructureReconstructionOutputGeometry(rightPoints - leftPoints) &&
    heightPoints === canonicalizeStructureReconstructionOutputGeometry(bottomPoints - topPoints) &&
    centerXPoints === canonicalizeStructureReconstructionOutputGeometry((leftPoints + rightPoints) / 2) &&
    centerYPoints === canonicalizeStructureReconstructionOutputGeometry((topPoints + bottomPoints) / 2);
  if (!coherent) {
    throw new Error("canonicalizeOutputGeometryBounds: canonicalized geometry is internally incoherent (programming error, never expected from valid input).");
  }
}

/**
 * Canonicaliza os oito campos geométricos comuns a linhas, segmentos e
 * blocos, preservando os demais campos do objeto. Canonicaliza primeiro
 * apenas os quatro limites (`leftPoints`/`topPoints`/`rightPoints`/`bottomPoints`)
 * e deriva largura, altura e centros **dos limites já canonicalizados** —
 * nunca canonicaliza a largura/altura/centro bruta do rascunho de forma
 * independente, o que poderia produzir um contrato internamente
 * incoerente na fronteira de arredondamento (auditoria pós-PR #69, §3).
 */
export function canonicalizeOutputGeometryBounds<T extends GeometryBounds>(bounds: T): T {
  const leftPoints = canonicalizeStructureReconstructionOutputGeometry(bounds.leftPoints);
  const topPoints = canonicalizeStructureReconstructionOutputGeometry(bounds.topPoints);
  const rightPoints = canonicalizeStructureReconstructionOutputGeometry(bounds.rightPoints);
  const bottomPoints = canonicalizeStructureReconstructionOutputGeometry(bounds.bottomPoints);
  const widthPoints = canonicalizeStructureReconstructionOutputGeometry(rightPoints - leftPoints);
  const heightPoints = canonicalizeStructureReconstructionOutputGeometry(bottomPoints - topPoints);
  const centerXPoints = canonicalizeStructureReconstructionOutputGeometry((leftPoints + rightPoints) / 2);
  const centerYPoints = canonicalizeStructureReconstructionOutputGeometry((topPoints + bottomPoints) / 2);

  const canonicalBounds = { leftPoints, topPoints, rightPoints, bottomPoints, widthPoints, heightPoints, centerXPoints, centerYPoints };
  assertCoherentCanonicalBounds(canonicalBounds);

  return { ...bounds, ...canonicalBounds };
}

/** Canonicaliza um array de lacunas normalizadas exportadas (`ReconstructedHorizontalSegment.observedInternalGaps`). */
export function canonicalizeOutputGaps(gaps: ReadonlyArray<number>): ReadonlyArray<number> {
  return gaps.map(canonicalizeStructureReconstructionOutputGeometry);
}
