import type { BudgetDocumentPhysicalColumnHypothesisReconstructionProfile } from "./budget-document-physical-column-hypothesis-reconstruction.types";

export const PHYSICAL_VERTICAL_BAND_CONSTRUCTION_RULE_ID = "physical-vertical-band-regional-alignment-projection-v1" as const;
export const PHYSICAL_VERTICAL_BAND_CONSTRUCTION_RULE_VERSION = 1 as const;

export interface BandConstructionAlignmentInput {
  readonly alignmentKey: string;
  /** Em ordem vertical (`verticalOrder`), alinhado posicionalmente a `segmentKeys` — herdado tal como produzido pela Sprint 21.4A.2.f.2a, nunca reordenado aqui. Pode conter linhas fora da região sendo processada (§1 da auditoria pós-revisão): `RecurrentVerticalAlignment` é observado no nível da página inteira, nunca por região. */
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
  /** Assinatura física exata: pares `(lineKey, segmentKey)` **projetados** para dentro da região — apenas os pares cuja linha pertence à região, em ordem vertical, herdados do alinhamento-semente. */
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
 * Constrói faixas verticais físicas a partir da **projeção regional** dos
 * alinhamentos verticais recorrentes da Sprint 21.4A.2.f.2a (auditoria
 * pós-revisão da Sprint 21.4A.2.f.2b, §1). `RecurrentVerticalAlignment` é
 * observado no nível da página inteira pela f.2a — um alinhamento
 * sustentador de uma região pode legitimamente conter linhas adicionais
 * fora dela (antes, depois, ou intercaladas com outras regiões da mesma
 * página). Para cada alinhamento, combina posicionalmente `lineKeys` e
 * `segmentKeys` e filtra apenas os pares cuja linha pertence à região,
 * preservando a ordem vertical original — nunca reordena por chave
 * lexicográfica, nunca perde a associação posicional entre linha e
 * segmento, nunca inclui na faixa qualquer linha ou segmento externo à
 * região. Isto **não é reclustering**: o `alignmentKey` original
 * permanece como evidência-semente única, e a projeção nunca reagrupa
 * segmentos que a f.2a não já havia agrupado.
 *
 * A projeção só forma faixa quando conserva, no mínimo,
 * `profile.minimumLinesSustainingProjectedAlignment` pares — herdado do
 * mesmo mínimo já exigido pela f.2a para o alinhamento como um todo,
 * nunca uma nova tolerância. Quando a projeção não conserva sustentação
 * suficiente, o alinhamento é legitimamente ignorado para esta região —
 * nunca uma falha técnica.
 *
 * Os limites da faixa são a união real (`min`/`max`) dos bounds completos
 * apenas dos segmentos projetados (nunca dos segmentos externos à
 * região). Determinístico e independente da ordem de entrada dos
 * alinhamentos.
 */
export function constructPhysicalVerticalBands(
  alignments: ReadonlyArray<BandConstructionAlignmentInput>,
  regionLineKeys: ReadonlySet<string>,
  segmentGeometryByKey: ReadonlyMap<string, BandConstructionSegmentGeometry>,
  profile: BudgetDocumentPhysicalColumnHypothesisReconstructionProfile,
): ReadonlyArray<PhysicalVerticalBandDraft> {
  const orderedAlignments = [...alignments].sort((a, b) => a.alignmentKey.localeCompare(b.alignmentKey));

  const bands: PhysicalVerticalBandDraft[] = [];

  orderedAlignments.forEach((alignment) => {
    const projectedSignature = alignment.lineKeys
      .map((lineKey, position) => ({ lineKey, segmentKey: alignment.segmentKeys[position] }))
      .filter((member) => regionLineKeys.has(member.lineKey));

    if (projectedSignature.length < profile.minimumLinesSustainingProjectedAlignment) {
      return;
    }

    const geometries = projectedSignature.map((member) => segmentGeometryByKey.get(member.segmentKey)!);

    const left = Math.min(...geometries.map((g) => g.leftPoints));
    const top = Math.min(...geometries.map((g) => g.topPoints));
    const right = Math.max(...geometries.map((g) => g.rightPoints));
    const bottom = Math.max(...geometries.map((g) => g.bottomPoints));

    bands.push({
      seedAlignmentKey: alignment.alignmentKey,
      signature: projectedSignature,
      leftPoints: left,
      topPoints: top,
      rightPoints: right,
      bottomPoints: bottom,
      widthPoints: right - left,
      heightPoints: bottom - top,
      centerXPoints: (left + right) / 2,
      centerYPoints: (top + bottom) / 2,
    });
  });

  return bands;
}
