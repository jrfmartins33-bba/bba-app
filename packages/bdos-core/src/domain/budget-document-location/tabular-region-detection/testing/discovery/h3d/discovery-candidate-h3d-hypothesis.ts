import type { ReconstructedBudgetDocumentPage } from "../../../../structure-reconstruction/budget-document-structure-reconstruction.types";
import { buildAlignmentCandidateSegments, observeVerticalAlignments } from "../../../vertical-alignment-observation";
import type { AlignmentCandidateSegment, VerticalAlignmentDraft } from "../../../vertical-alignment-observation";
import { BUDGET_DOCUMENT_TABULAR_REGION_DETECTION_PROFILE_V1 } from "../../../tabular-region-detection-profile";
import type { BudgetDocumentTabularRegionDetectionProfile } from "../../../budget-document-tabular-region-detection.types";

/**
 * H3d — Grade física por pares recorrentes de bordas, independente da
 * formação de regiões (Sprint 21.4B.3A.2, definição declarativa congelada
 * no enunciado da Sprint §7, antes de qualquer implementação).
 *
 * Exclusivamente diagnóstico — arquivo isolado: nunca importado por
 * código de produção; nunca altera H0-H4, H3b, H3c ou H3c-r1; nunca
 * modifica o manifesto ou a especificação congelada.
 *
 * PROIBIÇÃO CENTRAL (§6.3 do enunciado, verificada também pelo teste
 * arquitetural `discovery-h3d-no-region-formation-dependency-boundaries.test.ts`):
 * este módulo NUNCA importa `tabular-region-formation.ts` nem
 * `formTabularRegionCandidateWindows`, nunca recebe janelas ou regiões
 * pré-formadas, e nunca reconstrói indiretamente o mesmo conceito com
 * outro nome. Os envelopes e componentes de grade abaixo são formados
 * exclusivamente a partir de `AlignmentCandidateSegment` (geometria de
 * segmento) e `VerticalAlignmentDraft` (evidência de alinhamento vertical
 * recorrente, `left_edge`/`right_edge` apenas) — ambos produzidos por
 * `vertical-alignment-observation.ts`, que é evidência de página inteira,
 * anterior e independente da formação de regiões de `f.2a`.
 *
 * NENHUMA mudança de fórmula, evidência, normalização, constante, limiar,
 * comportamento de fronteira ou classificação de saída pode ocorrer após
 * a execução dos testes — a implementação abaixo é a tradução literal de
 * §7 do enunciado da Sprint, nunca ajustada para fazer qualquer caso
 * passar (§10 do enunciado).
 */

export type H3dDecision = "must_include" | "must_exclude" | "insufficient_evidence";

const PROFILE = BUDGET_DOCUMENT_TABULAR_REGION_DETECTION_PROFILE_V1;

export interface H3dLine {
  readonly lineKey: string;
  readonly verticalOrder: number;
}

/**
 * Evidência de página exclusiva de H3d — deliberadamente mais estreita
 * que `CandidatePageEvidence` (usada por H1-H4/H3c): nunca expõe
 * `helperAlignments` (forma de entrada de `formTabularRegionCandidateWindows`)
 * nem `blocks` (Categoria B, fora do escopo desta Sprint, §6.1).
 */
export interface H3dPageEvidence {
  readonly lines: ReadonlyArray<H3dLine>;
  readonly segments: ReadonlyArray<AlignmentCandidateSegment>;
  readonly alignmentDrafts: ReadonlyArray<VerticalAlignmentDraft>;
}

/** Constrói a evidência de página de H3d a partir de uma página real já reconstruída por `f.1` — reaproveita exclusivamente `buildAlignmentCandidateSegments`/`observeVerticalAlignments` (evidência de página inteira, f.0/f.1-adjacente), nunca `formTabularRegionCandidateWindows`. */
export function buildH3dPageEvidence(page: ReconstructedBudgetDocumentPage): H3dPageEvidence {
  const segments = buildAlignmentCandidateSegments(page.lines, page.segments);
  const alignmentDrafts = observeVerticalAlignments(segments, PROFILE);
  return {
    lines: page.lines.map((l) => ({ lineKey: l.lineKey, verticalOrder: l.verticalOrder })),
    segments,
    alignmentDrafts,
  };
}

/** Mediana: ímpar → valor central; par → média dos dois centrais (mesma convenção já usada por H3c). */
function median(values: ReadonlyArray<number>): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** §7.2, ordenação canônica dos alinhamentos: tipo → posição canônica → menor `segmentKey` dos membros → quantidade de membros. Nunca depende da ordem incidental dos arrays. */
function compareAlignmentsCanonically(
  a: VerticalAlignmentDraft,
  b: VerticalAlignmentDraft,
  typeOrder: ReadonlyArray<VerticalAlignmentDraft["alignmentType"]>,
): number {
  const typeDiff = typeOrder.indexOf(a.alignmentType) - typeOrder.indexOf(b.alignmentType);
  if (typeDiff !== 0) return typeDiff;
  if (a.canonicalPositionPoints !== b.canonicalPositionPoints) return a.canonicalPositionPoints - b.canonicalPositionPoints;
  const minSegA = [...a.members.map((m) => m.segmentKey)].sort()[0] ?? "";
  const minSegB = [...b.members.map((m) => m.segmentKey)].sort()[0] ?? "";
  if (minSegA !== minSegB) return minSegA.localeCompare(minSegB);
  return a.members.length - b.members.length;
}

interface H3dEnvelope {
  readonly supportLineKeys: ReadonlySet<string>;
  readonly supportVerticalOrders: ReadonlyArray<number>;
  readonly representativeLeftPoints: number;
  readonly representativeRightPoints: number;
  readonly representativeLineHeightPoints: number;
}

/**
 * §7.2 do enunciado: envelopes físicos de coluna. Para cada par
 * determinístico (alinhamento `left_edge`, alinhamento `right_edge`) —
 * obtido após ordenação canônica de todos os alinhamentos da página —
 * calcula a interseção dos `segmentKey` presentes em ambos, exclui
 * segmentos da linha-alvo, e só forma envelope quando o suporte restante
 * atende aos três critérios do §7.2.5. Nunca usa `horizontal_center`
 * (fora da evidência permitida, §6.1). Nunca usa `formTabularRegionCandidateWindows`.
 */
function formPhysicalColumnEnvelopes(
  evidence: H3dPageEvidence,
  targetLineKey: string,
  profile: BudgetDocumentTabularRegionDetectionProfile,
): ReadonlyArray<H3dEnvelope> {
  const sortedAlignments = [...evidence.alignmentDrafts].sort((a, b) => compareAlignmentsCanonically(a, b, profile.alignmentTypePriorityOrder));
  const leftAlignments = sortedAlignments.filter((a) => a.alignmentType === "left_edge");
  const rightAlignments = sortedAlignments.filter((a) => a.alignmentType === "right_edge");

  const segmentByKey = new Map(evidence.segments.map((s) => [s.segmentKey, s]));
  const lineByKey = new Map(evidence.lines.map((l) => [l.lineKey, l]));

  const envelopes: H3dEnvelope[] = [];

  leftAlignments.forEach((left) => {
    const leftSegmentKeys = new Set(left.members.map((m) => m.segmentKey));
    rightAlignments.forEach((right) => {
      const rightSegmentKeys = new Set(right.members.map((m) => m.segmentKey));
      const commonSegmentKeys = [...leftSegmentKeys].filter((k) => rightSegmentKeys.has(k));
      const supportSegmentKeys = commonSegmentKeys.filter((segmentKey) => {
        const segment = segmentByKey.get(segmentKey);
        return segment !== undefined && segment.lineKey !== targetLineKey;
      });
      if (supportSegmentKeys.length === 0) return;

      const supportLineKeySet = new Set<string>();
      const lefts: number[] = [];
      const rights: number[] = [];
      const heights: number[] = [];
      supportSegmentKeys.forEach((segmentKey) => {
        const segment = segmentByKey.get(segmentKey)!;
        supportLineKeySet.add(segment.lineKey);
        lefts.push(segment.leftPoints);
        rights.push(segment.rightPoints);
        heights.push(segment.lineHeightPoints);
      });

      if (supportLineKeySet.size < profile.minimumLinesSustainingAlignment) return;

      const representativeLeftPoints = median(lefts);
      const representativeRightPoints = median(rights);
      const representativeLineHeightPoints = median(heights);
      if (!(representativeRightPoints > representativeLeftPoints)) return;
      if (!(representativeLineHeightPoints > 0)) return;

      const supportVerticalOrders = [...supportLineKeySet].map((lk) => lineByKey.get(lk)!.verticalOrder).sort((a, b) => a - b);

      envelopes.push({ supportLineKeys: supportLineKeySet, supportVerticalOrders, representativeLeftPoints, representativeRightPoints, representativeLineHeightPoints });
    });
  });

  return envelopes;
}

interface H3dGridComponent {
  readonly envelopes: ReadonlyArray<H3dEnvelope>;
  readonly minVerticalOrder: number;
  readonly maxVerticalOrder: number;
}

/** §7.3 do enunciado: componentes de grade — cada envelope é um nó; dois envelopes pertencem ao mesmo componente quando a interseção de seus `supportLineKeys` possui >= `minimumRegionLineCount`. Só componentes com >= `minimumRecurrentAlignmentCount` envelopes distintos são elegíveis. */
function formGridComponents(envelopes: ReadonlyArray<H3dEnvelope>, profile: BudgetDocumentTabularRegionDetectionProfile): ReadonlyArray<H3dGridComponent> {
  const n = envelopes.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const intersectionSize = [...envelopes[i].supportLineKeys].filter((lk) => envelopes[j].supportLineKeys.has(lk)).length;
      if (intersectionSize >= profile.minimumRegionLineCount) union(i, j);
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i += 1) {
    const root = find(i);
    const arr = groups.get(root) ?? [];
    arr.push(i);
    groups.set(root, arr);
  }

  const components: H3dGridComponent[] = [];
  groups.forEach((indices) => {
    if (indices.length < profile.minimumRecurrentAlignmentCount) return;
    const componentEnvelopes = indices.map((i) => envelopes[i]);
    const allOrders = componentEnvelopes.flatMap((e) => e.supportVerticalOrders);
    components.push({ envelopes: componentEnvelopes, minVerticalOrder: Math.min(...allOrders), maxVerticalOrder: Math.max(...allOrders) });
  });
  return components;
}

interface SegmentCompatibility {
  readonly anchored: boolean;
  readonly contained: boolean;
}

/** §7.4 do enunciado: compatibilidade horizontal — fronteira sempre inclusiva (`<=`/`>=`). Fórmula idêntica à já aprovada e testada por H3c (mesma normalização pela menor altura), aplicada aqui contra os envelopes físicos de H3d. */
function evaluateSegmentCompatibility(
  segment: { readonly leftPoints: number; readonly rightPoints: number; readonly lineHeightPoints: number },
  envelope: H3dEnvelope,
  profile: BudgetDocumentTabularRegionDetectionProfile,
): SegmentCompatibility {
  const normalizingHeight = Math.min(segment.lineHeightPoints, envelope.representativeLineHeightPoints);
  const tolerancePoints = profile.maximumAlignmentPositionDeviationToMinimumLineHeightRatio * normalizingHeight;

  const leftAnchored = Math.abs(segment.leftPoints - envelope.representativeLeftPoints) <= tolerancePoints;
  const rightAnchored = Math.abs(segment.rightPoints - envelope.representativeRightPoints) <= tolerancePoints;
  const containedFromLeft = segment.leftPoints >= envelope.representativeLeftPoints - tolerancePoints;
  const containedFromRight = segment.rightPoints <= envelope.representativeRightPoints + tolerancePoints;

  const anchored = (leftAnchored && containedFromRight) || (rightAnchored && containedFromLeft);
  const contained = containedFromLeft && containedFromRight;
  return { anchored, contained };
}

/**
 * §7.5-§7.6 do enunciado: corroboração vertical e decisão final, avaliadas
 * por componente. Caso interno: ordem da linha-alvo entre a menor e a
 * maior ordem de suporte do componente — todos os segmentos contidos em
 * algum envelope do componente, ao menos um ancorado. Caso de fronteira:
 * ordem da linha-alvo exatamente uma posição antes/depois do suporte —
 * mesmas duas condições, mais a linha-alvo devendo corresponder (estar
 * contida) em ao menos `minimumRecurrentAlignmentCount` envelopes
 * distintos do componente. Fora da faixa: componente nunca inclui a
 * linha-alvo.
 */
function componentSatisfiesTargetLine(
  component: H3dGridComponent,
  targetSegments: ReadonlyArray<{ readonly leftPoints: number; readonly rightPoints: number; readonly lineHeightPoints: number }>,
  targetVerticalOrder: number,
  profile: BudgetDocumentTabularRegionDetectionProfile,
): boolean {
  const isInternal = targetVerticalOrder >= component.minVerticalOrder && targetVerticalOrder <= component.maxVerticalOrder;
  const isBoundary = targetVerticalOrder === component.minVerticalOrder - 1 || targetVerticalOrder === component.maxVerticalOrder + 1;
  if (!isInternal && !isBoundary) return false;

  let allSegmentsContained = true;
  let anySegmentAnchored = false;
  const distinctContainingEnvelopes = new Set<H3dEnvelope>();

  targetSegments.forEach((segment) => {
    let containedInAny = false;
    component.envelopes.forEach((envelope) => {
      const { anchored, contained } = evaluateSegmentCompatibility(segment, envelope, profile);
      if (anchored) anySegmentAnchored = true;
      if (contained) {
        containedInAny = true;
        distinctContainingEnvelopes.add(envelope);
      }
    });
    if (!containedInAny) allSegmentsContained = false;
  });

  if (!allSegmentsContained) return false;
  if (!anySegmentAnchored) return false;
  if (isBoundary && distinctContainingEnvelopes.size < profile.minimumRecurrentAlignmentCount) return false;
  return true;
}

/** §7.6 do enunciado: decisão final de H3d. */
export function candidateH3dPhysicalGridAnchors(evidence: H3dPageEvidence, targetLineKey: string, profile: BudgetDocumentTabularRegionDetectionProfile = PROFILE): H3dDecision {
  const targetLine = evidence.lines.find((l) => l.lineKey === targetLineKey);
  const targetSegments = evidence.segments.filter((s) => s.lineKey === targetLineKey);
  if (!targetLine || targetSegments.length === 0) {
    return "insufficient_evidence";
  }

  const envelopes = formPhysicalColumnEnvelopes(evidence, targetLineKey, profile);
  if (envelopes.length === 0) {
    return "insufficient_evidence";
  }

  const components = formGridComponents(envelopes, profile);
  if (components.length === 0) {
    return "insufficient_evidence";
  }

  const satisfied = components.some((component) => componentSatisfiesTargetLine(component, targetSegments, targetLine.verticalOrder, profile));
  return satisfied ? "must_include" : "must_exclude";
}
