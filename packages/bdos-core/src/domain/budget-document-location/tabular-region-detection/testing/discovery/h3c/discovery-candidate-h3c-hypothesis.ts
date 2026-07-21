import { buildCandidatePageEvidence } from "../discovery-candidate-hypotheses";
import type { CandidatePageEvidence } from "../discovery-candidate-hypotheses";
import { formTabularRegionCandidateWindows } from "../../../tabular-region-formation";
import { BUDGET_DOCUMENT_TABULAR_REGION_DETECTION_PROFILE_V1 } from "../../../tabular-region-detection-profile";

/**
 * H3c — Envelope pareado de bordas em nível de página, corroborado por
 * adjacência vertical de âncoras confiáveis (Sprint 21.4B.3A.1, definição
 * congelada em `EPIC_21_SPRINT_4B3A1_H3C_PREREGISTRATION.md` §2-§8,
 * commit de pré-registro `a8777b5e999258be23025eeb987125359c8ff91a`).
 *
 * Exclusivamente diagnóstico — arquivo isolado (§10.1 do enunciado): nunca
 * importado por código de produção; nunca altera H0, H1, H2, H3, H3b ou
 * H4; nunca modifica o manifesto ou a especificação congelada. Reutiliza
 * apenas `buildCandidatePageEvidence` (extração de evidência neutra, já
 * usada por H1-H4/H3b) e `formTabularRegionCandidateWindows`/`profile`
 * (regra de produção atual e perfil, ambos inalterados) — nunca lógica de
 * decisão de nenhuma outra candidata.
 *
 * NENHUMA mudança de fórmula, evidência, normalização, constante, limiar,
 * comportamento de fronteira ou classificação de saída ocorreu após a
 * execução dos testes — a implementação abaixo é a tradução literal de
 * §2-§8 do pré-registro, nunca ajustada para fazer qualquer caso passar.
 */

export type H3cDecision = "must_include" | "must_exclude" | "insufficient_evidence";

const PROFILE = BUDGET_DOCUMENT_TABULAR_REGION_DETECTION_PROFILE_V1;

export { buildCandidatePageEvidence };
export type { CandidatePageEvidence };

interface AnchorSets {
  readonly pageAnchorSet: ReadonlySet<string>;
  readonly adjacentAnchorSet: ReadonlySet<string>;
}

/** §5 do pré-registro: âncoras — nunca a própria linha-alvo. */
function computeAnchorSets(evidence: CandidatePageEvidence, targetLineKey: string): AnchorSets {
  const windows = formTabularRegionCandidateWindows(evidence.lines, evidence.helperAlignments, PROFILE).filter((w) => !w.conflicted);
  const lineByKey = new Map(evidence.lines.map((l) => [l.lineKey, l]));
  const targetOrder = lineByKey.get(targetLineKey)?.verticalOrder;

  const pageAnchorSet = new Set<string>();
  windows.forEach((w) => {
    const remaining = w.lineKeys.filter((lk) => lk !== targetLineKey);
    if (remaining.length < PROFILE.minimumRegionLineCount) return;
    remaining.forEach((lk) => pageAnchorSet.add(lk));
  });

  const adjacentAnchorSet = new Set<string>();
  if (targetOrder !== undefined) {
    pageAnchorSet.forEach((lk) => {
      const order = lineByKey.get(lk)?.verticalOrder;
      if (order === targetOrder - 1 || order === targetOrder + 1) {
        adjacentAnchorSet.add(lk);
      }
    });
  }

  return { pageAnchorSet, adjacentAnchorSet };
}

/**
 * Identidade canônica de um `VerticalAlignmentDraft` para agrupamento —
 * nunca dependente de ordem de array (§6.4 do pré-registro). Usa
 * `segmentKey` (nunca `lineKey`) dos membros: em uma tabela densa, TODAS
 * as colunas compartilham exatamente o mesmo conjunto de `lineKey`
 * membros (cada linha tem um segmento em cada coluna) — identificar pelo
 * conjunto de linhas colapsaria colunas distintas na mesma identidade.
 * `segmentKey` é único por segmento físico (posição + linha), nunca
 * coincide entre colunas diferentes, e continua sendo um identificador
 * canônico e determinístico (nunca uma posição incidental de array).
 */
function draftIdentity(draft: CandidatePageEvidence["alignmentDrafts"][number]): string {
  const sortedSegmentKeys = [...draft.members.map((m) => m.segmentKey)].sort();
  return `${draft.alignmentType}:${sortedSegmentKeys.join(",")}`;
}

interface PairEnvelope {
  readonly supportLineKeys: ReadonlySet<string>;
  readonly representativeLeftPoints: number;
  readonly representativeRightPoints: number;
  readonly representativeLineHeightPoints: number;
}

/** Mediana: ímpar → valor central; par → média dos dois centrais (§6.9 do pré-registro). */
function median(values: ReadonlyArray<number>): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** §6 do pré-registro: envelopes pareados de bordas esquerda/direita — nunca `horizontal_center`, nunca blocos de f.1. */
function computePairEnvelopes(evidence: CandidatePageEvidence, targetLineKey: string, pageAnchorSet: ReadonlySet<string>): ReadonlyArray<PairEnvelope> {
  const leftDrafts = evidence.alignmentDrafts.filter((d) => d.alignmentType === "left_edge");
  const rightDrafts = evidence.alignmentDrafts.filter((d) => d.alignmentType === "right_edge");

  const groups = new Map<string, { lineKeys: Set<string>; lefts: number[]; rights: number[]; heights: number[] }>();

  evidence.segments.forEach((seg) => {
    if (seg.lineKey === targetLineKey) return;
    if (!pageAnchorSet.has(seg.lineKey)) return;

    const leftDraft = leftDrafts.find((d) => d.members.some((m) => m.lineKey === seg.lineKey && m.segmentKey === seg.segmentKey));
    const rightDraft = rightDrafts.find((d) => d.members.some((m) => m.lineKey === seg.lineKey && m.segmentKey === seg.segmentKey));
    if (!leftDraft || !rightDraft) return;

    const pairId = `${draftIdentity(leftDraft)}|${draftIdentity(rightDraft)}`;
    const bucket = groups.get(pairId) ?? { lineKeys: new Set<string>(), lefts: [] as number[], rights: [] as number[], heights: [] as number[] };
    bucket.lineKeys.add(seg.lineKey);
    bucket.lefts.push(seg.leftPoints);
    bucket.rights.push(seg.rightPoints);
    bucket.heights.push(seg.lineHeightPoints);
    groups.set(pairId, bucket);
  });

  const envelopes: PairEnvelope[] = [];
  groups.forEach((bucket) => {
    if (bucket.lineKeys.size < PROFILE.minimumRegionLineCount) return;
    const representativeLeftPoints = median(bucket.lefts);
    const representativeRightPoints = median(bucket.rights);
    const representativeLineHeightPoints = median(bucket.heights);
    if (representativeRightPoints - representativeLeftPoints <= 0) return;
    if (representativeLineHeightPoints <= 0) return;
    envelopes.push({ supportLineKeys: bucket.lineKeys, representativeLeftPoints, representativeRightPoints, representativeLineHeightPoints });
  });

  return envelopes;
}

interface SegmentCompatibility {
  readonly anchored: boolean;
  readonly contained: boolean;
}

/** §7 do pré-registro: compatibilidade — fronteira sempre inclusiva (`<=`/`>=`). */
function evaluateSegmentCompatibility(
  segment: { readonly leftPoints: number; readonly rightPoints: number; readonly lineHeightPoints: number },
  envelope: PairEnvelope,
): SegmentCompatibility {
  const normalizingHeight = Math.min(segment.lineHeightPoints, envelope.representativeLineHeightPoints);
  const tolerancePoints = PROFILE.maximumAlignmentPositionDeviationToMinimumLineHeightRatio * normalizingHeight;

  const leftAnchored = Math.abs(segment.leftPoints - envelope.representativeLeftPoints) <= tolerancePoints;
  const rightAnchored = Math.abs(segment.rightPoints - envelope.representativeRightPoints) <= tolerancePoints;
  const containedFromLeft = segment.leftPoints >= envelope.representativeLeftPoints - tolerancePoints;
  const containedFromRight = segment.rightPoints <= envelope.representativeRightPoints + tolerancePoints;

  const anchored = (leftAnchored && containedFromRight) || (rightAnchored && containedFromLeft);
  const contained = containedFromLeft && containedFromRight;
  return { anchored, contained };
}

/** §8 do pré-registro: decisão final. */
export function candidateH3cPairedEdgeEnvelope(evidence: CandidatePageEvidence, targetLineKey: string): H3cDecision {
  const targetLineExists = evidence.lines.some((l) => l.lineKey === targetLineKey);
  const targetSegments = evidence.segments.filter((s) => s.lineKey === targetLineKey);
  if (!targetLineExists || targetSegments.length === 0) {
    return "insufficient_evidence";
  }

  const { pageAnchorSet, adjacentAnchorSet } = computeAnchorSets(evidence, targetLineKey);
  if (adjacentAnchorSet.size === 0) {
    return "insufficient_evidence";
  }

  const allEnvelopes = computePairEnvelopes(evidence, targetLineKey, pageAnchorSet);
  const eligibleEnvelopes = allEnvelopes.filter((e) => [...e.supportLineKeys].some((lk) => adjacentAnchorSet.has(lk)));
  if (eligibleEnvelopes.length === 0) {
    return "insufficient_evidence";
  }

  let allSegmentsContained = true;
  let anySegmentAnchored = false;

  targetSegments.forEach((segment) => {
    const evaluations = eligibleEnvelopes.map((envelope) => evaluateSegmentCompatibility(segment, envelope));
    const containedInAny = evaluations.some((r) => r.contained);
    const anchoredInAny = evaluations.some((r) => r.anchored);
    if (!containedInAny) allSegmentsContained = false;
    if (anchoredInAny) anySegmentAnchored = true;
  });

  return allSegmentsContained && anySegmentAnchored ? "must_include" : "must_exclude";
}
