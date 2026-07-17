export const PHYSICAL_VERTICAL_BAND_CONSTRUCTION_RULE_ID = "physical-vertical-band-single-alignment-envelope-v1" as const;
export const PHYSICAL_VERTICAL_BAND_CONSTRUCTION_RULE_VERSION = 1 as const;

export interface BandConstructionAlignmentInput {
  readonly alignmentKey: string;
  /** Em ordem vertical (`verticalOrder`), alinhado posicionalmente a `segmentKeys` — herdado tal como produzido pela Sprint 21.4A.2.f.2a, nunca reordenado aqui. */
  readonly lineKeys: ReadonlyArray<string>;
  readonly segmentKeys: ReadonlyArray<string>;
}

export interface BandConstructionSegmentGeometry {
  readonly leftPoints: number;
  readonly topPoints: number;
  readonly rightPoints: number;
  readonly bottomPoints: number;
}

/** Faixa vertical física — tipo exclusivamente interno, nunca exportado pelo barrel público (§5 da Sprint). */
export interface PhysicalVerticalBandDraft {
  readonly seedAlignmentKey: string;
  /** Assinatura física exata: pares `(lineKey, segmentKey)` em ordem vertical, herdados do alinhamento-semente. */
  readonly signature: ReadonlyArray<{ readonly lineKey: string; readonly segmentKey: string }>;
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
 * Constrói faixas verticais físicas a partir dos alinhamentos verticais
 * recorrentes da Sprint 21.4A.2.f.2a cujas linhas pertencem inteiramente à
 * região sendo processada (§5-§10.1 do enunciado da Sprint). Uma faixa
 * nasce de exatamente um alinhamento-semente: nunca funde, nunca absorve
 * segmentos órfãos, nunca usa posição sintética — os limites são a união
 * real (`min`/`max`) dos bounds completos dos segmentos que já sustentam
 * aquele alinhamento (reaproveitados de `structureReconstruction`, nunca
 * recalculados a partir de uma única posição). Determinístico e
 * independente da ordem de entrada dos alinhamentos.
 */
export function constructPhysicalVerticalBands(
  alignments: ReadonlyArray<BandConstructionAlignmentInput>,
  regionLineKeys: ReadonlySet<string>,
  segmentGeometryByKey: ReadonlyMap<string, BandConstructionSegmentGeometry>,
): ReadonlyArray<PhysicalVerticalBandDraft> {
  const qualifyingAlignments = alignments.filter((alignment) => alignment.lineKeys.every((lineKey) => regionLineKeys.has(lineKey)));
  const orderedAlignments = [...qualifyingAlignments].sort((a, b) => a.alignmentKey.localeCompare(b.alignmentKey));

  return orderedAlignments.map((alignment) => {
    const signature = alignment.lineKeys.map((lineKey, position) => ({ lineKey, segmentKey: alignment.segmentKeys[position] }));
    const geometries = signature.map((member) => segmentGeometryByKey.get(member.segmentKey)!);

    const left = Math.min(...geometries.map((g) => g.leftPoints));
    const top = Math.min(...geometries.map((g) => g.topPoints));
    const right = Math.max(...geometries.map((g) => g.rightPoints));
    const bottom = Math.max(...geometries.map((g) => g.bottomPoints));

    return {
      seedAlignmentKey: alignment.alignmentKey,
      signature,
      leftPoints: left,
      topPoints: top,
      rightPoints: right,
      bottomPoints: bottom,
      widthPoints: right - left,
      heightPoints: bottom - top,
      centerXPoints: (left + right) / 2,
      centerYPoints: (top + bottom) / 2,
    };
  });
}
