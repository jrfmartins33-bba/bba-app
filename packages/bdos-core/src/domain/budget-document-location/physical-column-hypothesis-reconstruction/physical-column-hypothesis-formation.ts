import type { PhysicalVerticalBandDraft } from "./physical-vertical-band-construction";

export const PHYSICAL_COLUMN_HYPOTHESIS_FORMATION_RULE_ID = "physical-column-hypothesis-exact-signature-consolidation-v1" as const;
export const PHYSICAL_COLUMN_HYPOTHESIS_FORMATION_RULE_VERSION = 1 as const;

export interface PhysicalColumnHypothesisFormationCandidate {
  /** Assinatura física exata (pares `(lineKey, segmentKey)` em ordem vertical), compartilhada por todas as faixas consolidadas nesta candidata. */
  readonly signature: ReadonlyArray<{ readonly lineKey: string; readonly segmentKey: string }>;
  /** Alinhamentos-semente cuja assinatura é exatamente esta — em ordem canônica (`alignmentKey` ascendente). */
  readonly contributingAlignmentKeys: ReadonlyArray<string>;
  readonly leftPoints: number;
  readonly topPoints: number;
  readonly rightPoints: number;
  readonly bottomPoints: number;
  readonly widthPoints: number;
  readonly heightPoints: number;
  readonly centerXPoints: number;
  readonly centerYPoints: number;
  /** `true` quando esta candidata compartilha ao menos um segmento com outra candidata de assinatura diferente, ou quando seus envelopes se sobrepõem horizontalmente de forma estritamente positiva — nenhuma candidata conflitante se torna hipótese válida. */
  readonly conflicted: boolean;
}

function signatureIdentityKey(signature: ReadonlyArray<{ readonly lineKey: string; readonly segmentKey: string }>): string {
  return signature.map((member) => `${member.lineKey}:${member.segmentKey}`).join("|");
}

function segmentsOverlapHorizontally(
  a: { readonly leftPoints: number; readonly rightPoints: number },
  b: { readonly leftPoints: number; readonly rightPoints: number },
): boolean {
  return Math.min(a.rightPoints, b.rightPoints) - Math.max(a.leftPoints, b.leftPoints) > 0;
}

/**
 * Consolida faixas verticais físicas em candidatas a hipótese de coluna
 * física por **assinatura física exatamente idêntica** — nunca por
 * `lineKeys` em comum, proximidade, posição canônica, envelope
 * semelhante, sobreposição parcial, distância ou tipo de alinhamento
 * preferencial (§6 do enunciado da Sprint). Duas ou mais faixas com a
 * mesma assinatura exata (mesmos pares `(lineKey, segmentKey)`, na mesma
 * ordem) são o mesmo conjunto físico e viram uma única candidata,
 * referenciando todos os alinhamentos-semente contribuintes.
 *
 * Candidatas de assinatura diferente que compartilham ao menos um
 * segmento, ou cujos envelopes se sobrepõem horizontalmente de forma
 * estritamente positiva (limites apenas encostados não contam), são
 * marcadas conflitantes (§8) — nenhuma delas se torna hipótese válida;
 * nenhuma escolha silenciosa; nenhuma fusão. Nenhuma tolerância numérica é
 * usada (§6-§8): esta é a política vinculante da versão inicial.
 * Determinístico e independente da ordem de entrada das faixas.
 */
export function formPhysicalColumnHypothesisCandidates(
  bands: ReadonlyArray<PhysicalVerticalBandDraft>,
): ReadonlyArray<PhysicalColumnHypothesisFormationCandidate> {
  const groupsBySignature = new Map<string, { signature: ReadonlyArray<{ lineKey: string; segmentKey: string }>; bounds: PhysicalVerticalBandDraft; alignmentKeys: string[] }>();

  bands.forEach((band) => {
    const identityKey = signatureIdentityKey(band.signature);
    const existing = groupsBySignature.get(identityKey);
    if (existing === undefined) {
      groupsBySignature.set(identityKey, { signature: band.signature, bounds: band, alignmentKeys: [band.seedAlignmentKey] });
      return;
    }
    existing.alignmentKeys.push(band.seedAlignmentKey);
  });

  const distinctCandidates = [...groupsBySignature.values()].map((group) => ({
    signature: group.signature,
    contributingAlignmentKeys: [...new Set(group.alignmentKeys)].sort(),
    leftPoints: group.bounds.leftPoints,
    topPoints: group.bounds.topPoints,
    rightPoints: group.bounds.rightPoints,
    bottomPoints: group.bounds.bottomPoints,
    widthPoints: group.bounds.widthPoints,
    heightPoints: group.bounds.heightPoints,
    centerXPoints: group.bounds.centerXPoints,
    centerYPoints: group.bounds.centerYPoints,
    segmentKeySet: new Set(group.signature.map((member) => member.segmentKey)),
  }));

  const conflicted = distinctCandidates.map(() => false);
  for (let a = 0; a < distinctCandidates.length; a += 1) {
    for (let b = a + 1; b < distinctCandidates.length; b += 1) {
      const sharesSegment = [...distinctCandidates[a].segmentKeySet].some((segmentKey) => distinctCandidates[b].segmentKeySet.has(segmentKey));
      const overlapsHorizontally = segmentsOverlapHorizontally(distinctCandidates[a], distinctCandidates[b]);
      if (sharesSegment || overlapsHorizontally) {
        conflicted[a] = true;
        conflicted[b] = true;
      }
    }
  }

  return distinctCandidates
    .map((candidate, index) => ({
      signature: candidate.signature,
      contributingAlignmentKeys: candidate.contributingAlignmentKeys,
      leftPoints: candidate.leftPoints,
      topPoints: candidate.topPoints,
      rightPoints: candidate.rightPoints,
      bottomPoints: candidate.bottomPoints,
      widthPoints: candidate.widthPoints,
      heightPoints: candidate.heightPoints,
      centerXPoints: candidate.centerXPoints,
      centerYPoints: candidate.centerYPoints,
      conflicted: conflicted[index],
    }))
    .sort((x, y) => {
      if (x.leftPoints !== y.leftPoints) return x.leftPoints - y.leftPoints;
      if (x.rightPoints !== y.rightPoints) return x.rightPoints - y.rightPoints;
      return signatureIdentityKey(x.signature).localeCompare(signatureIdentityKey(y.signature));
    });
}
