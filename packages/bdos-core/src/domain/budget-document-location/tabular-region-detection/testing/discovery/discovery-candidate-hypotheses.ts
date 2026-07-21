import type { ReconstructedBudgetDocumentPage } from "../../../structure-reconstruction/budget-document-structure-reconstruction.types";
import { buildAlignmentCandidateSegments, observeVerticalAlignments } from "../../vertical-alignment-observation";
import type { AlignmentCandidateSegment, VerticalAlignmentDraft } from "../../vertical-alignment-observation";
import { formTabularRegionCandidateWindows } from "../../tabular-region-formation";
import type { RegionFormationAlignment, RegionFormationLine, TabularRegionFormationWindow } from "../../tabular-region-formation";
import { BUDGET_DOCUMENT_TABULAR_REGION_DETECTION_PROFILE_V1 } from "../../tabular-region-detection-profile";
import { computeAlignmentKey } from "../../tabular-region-detection-keys";

/**
 * Hipóteses candidatas de invariante de pertencimento (Sprint 21.4B.3A,
 * §12 do enunciado, momento 2 — DEPOIS do pré-registro e da prova de
 * indistinguibilidade). Funções puras, exclusivamente diagnósticas —
 * nunca importadas por código de produção, nunca chamadas por
 * `detect-budget-document-tabular-regions.ts`.
 *
 * Cada candidata responde apenas: "esta linha específica (`targetLineKey`)
 * pertence à mesma região da grade tabular que suas âncoras vizinhas
 * confirmadas?". Todas usam `formTabularRegionCandidateWindows` (a regra
 * de produção atual, INALTERADA) apenas para localizar janelas confirmadas
 * — nunca para decidir sozinha o pertencimento da linha-alvo, porque a
 * própria regra atual comprovadamente também SUPERINCLUI em casos
 * adversariais (achado desta Sprint, ver `zzz-probe` histórico no relatório):
 * uma linha larga cuja borda coincide com duas colunas reais (Caso N7), ou
 * um pequeno cluster de linhas externas repetidas que forma seu próprio
 * alinhamento privado (Caso N9), podem ser aceitos pela janela gulosa
 * atual tão facilmente quanto uma continuação legítima. Por isso a
 * "piscina de âncoras" (`anchorPoolFor`) exige DUAS salvaguardas
 * independentes antes de confiar em qualquer linha vizinha como âncora:
 *
 * 1. Nunca contar a própria linha-alvo como parte da evidência que a
 *    sustenta (exclusão explícita antes de qualquer contagem).
 * 2. Exigir `>= minimumRegionLineCount` linhas de âncora RESTANTES depois
 *    dessa exclusão — um cluster privado pequeno (ex.: N9, 3 linhas
 *    idênticas contando a própria linha-alvo) nunca sobra com âncoras
 *    suficientes uma vez que a própria linha-alvo é removida da contagem.
 */

export type MembershipDecision = "must_include" | "must_exclude" | "insufficient_evidence";

export interface CandidatePageEvidence {
  readonly lines: ReadonlyArray<RegionFormationLine>;
  readonly segments: ReadonlyArray<AlignmentCandidateSegment>;
  readonly alignmentDrafts: ReadonlyArray<VerticalAlignmentDraft>;
  readonly helperAlignments: ReadonlyArray<RegionFormationAlignment>;
  /** Blocos físicos bidimensionais de `f.1` (§2.3 do pré-registro) — Categoria B, propriedade de `f.1`. */
  readonly blocks: ReadonlyArray<{ readonly lineKeys: ReadonlyArray<string> }>;
  readonly profile: {
    readonly minimumRegionLineCount: number;
    readonly minimumRecurrentAlignmentCount: number;
    readonly minimumLinesSustainingAlignment: number;
  };
}

const PROFILE = BUDGET_DOCUMENT_TABULAR_REGION_DETECTION_PROFILE_V1;

/** Constrói a evidência de capacidade completa (§2.2/§2.3 do pré-registro) a partir de uma página real já reconstruída por `f.1` — reaproveita exclusivamente funções já exportadas por `f.2a`/`f.1`, nunca recalcula geometria por conta própria. */
export function buildCandidatePageEvidence(page: ReconstructedBudgetDocumentPage, pageProcessedKeyForAlignmentIds = "discovery"): CandidatePageEvidence {
  const segments = buildAlignmentCandidateSegments(page.lines, page.segments);
  const alignmentDrafts = observeVerticalAlignments(segments, PROFILE);
  const helperAlignments: RegionFormationAlignment[] = alignmentDrafts.map((draft) => ({
    alignmentKey: computeAlignmentKey(pageProcessedKeyForAlignmentIds, draft.alignmentType, draft.members.map((m) => m.segmentKey)),
    lineKeys: draft.members.map((m) => m.lineKey),
  }));
  return {
    lines: page.lines.map((l) => ({ lineKey: l.lineKey, verticalOrder: l.verticalOrder })),
    segments,
    alignmentDrafts,
    helperAlignments,
    blocks: page.blocks.map((b) => ({ lineKeys: b.lineKeys })),
    profile: {
      minimumRegionLineCount: PROFILE.minimumRegionLineCount,
      minimumRecurrentAlignmentCount: PROFILE.minimumRecurrentAlignmentCount,
      minimumLinesSustainingAlignment: PROFILE.minimumLinesSustainingAlignment,
    },
  };
}

function segmentsOfLine(evidence: CandidatePageEvidence, lineKey: string): ReadonlyArray<AlignmentCandidateSegment> {
  return evidence.segments.filter((s) => s.lineKey === lineKey);
}

function totalWidthOf(segments: ReadonlyArray<AlignmentCandidateSegment>): number {
  return segments.reduce((sum, s) => sum + (s.rightPoints - s.leftPoints), 0);
}

function median(values: ReadonlyArray<number>): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function overlapRatio(aLeft: number, aRight: number, bLeft: number, bRight: number): number {
  const overlap = Math.max(0, Math.min(aRight, bRight) - Math.max(aLeft, bLeft));
  const minWidth = Math.min(aRight - aLeft, bRight - bLeft);
  return minWidth > 0 ? overlap / minWidth : 0;
}

/**
 * Piscina de linhas-âncora confiáveis para uma linha-alvo, derivada
 * exclusivamente das janelas confirmadas (não conflitantes) da regra de
 * produção ATUAL — nunca da própria linha-alvo, e nunca de um cluster
 * pequeno demais depois de excluí-la (ver comentário do módulo).
 */
function anchorPoolFor(evidence: CandidatePageEvidence, targetLineKey: string): ReadonlySet<string> {
  const windows = formTabularRegionCandidateWindows(evidence.lines, evidence.helperAlignments, PROFILE).filter((w) => !w.conflicted);
  const lineByKey = new Map(evidence.lines.map((l) => [l.lineKey, l]));
  const targetOrder = lineByKey.get(targetLineKey)?.verticalOrder;
  const pool = new Set<string>();
  if (targetOrder === undefined) {
    return pool;
  }

  const containing = windows.find((w) => w.lineKeys.includes(targetLineKey));
  if (containing) {
    const others = containing.lineKeys.filter((lk) => lk !== targetLineKey);
    if (others.length >= evidence.profile.minimumRegionLineCount) {
      others.forEach((lk) => pool.add(lk));
    }
  }

  windows.forEach((w) => {
    if (w === containing) return;
    if (w.lineKeys.length < evidence.profile.minimumRegionLineCount) return;
    const firstOrder = lineByKey.get(w.lineKeys[0])!.verticalOrder;
    const lastOrder = lineByKey.get(w.lineKeys[w.lineKeys.length - 1])!.verticalOrder;
    if (lastOrder === targetOrder - 1 || firstOrder === targetOrder + 1) {
      w.lineKeys.forEach((lk) => pool.add(lk));
    }
  });

  return pool;
}

/** Alinhamentos (evidência de página inteira, independente de janela) que a linha-alvo compartilha com ao menos uma linha da piscina de âncoras. */
function sharedAlignmentsWithPool(evidence: CandidatePageEvidence, targetLineKey: string, pool: ReadonlySet<string>): ReadonlyArray<VerticalAlignmentDraft> {
  if (pool.size === 0) {
    return [];
  }
  return evidence.alignmentDrafts.filter(
    (draft) => draft.members.some((m) => m.lineKey === targetLineKey) && draft.members.some((m) => pool.has(m.lineKey)),
  );
}

// --- H0: hipótese nula (referência de base — replica literalmente a regra de produção atual, sem nenhuma evidência adicional) ---

export function candidateH0CurrentRule(evidence: CandidatePageEvidence, targetLineKey: string): MembershipDecision {
  const windows = formTabularRegionCandidateWindows(evidence.lines, evidence.helperAlignments, PROFILE);
  const included = windows.some((w) => !w.conflicted && w.lineKeys.includes(targetLineKey));
  return included ? "must_include" : "must_exclude";
}

// --- H1: âncora + compatibilidade horizontal por SOBREPOSIÇÃO (sem largura) ---

const H1_MINIMUM_OVERLAP_RATIO = 0.5;

export function candidateH1AnchorAndOverlap(evidence: CandidatePageEvidence, targetLineKey: string): MembershipDecision {
  const pool = anchorPoolFor(evidence, targetLineKey);
  if (pool.size === 0) {
    return "insufficient_evidence";
  }
  const shared = sharedAlignmentsWithPool(evidence, targetLineKey, pool);
  if (shared.length === 0) {
    return "must_exclude";
  }
  const targetSegments = segmentsOfLine(evidence, targetLineKey);
  const targetLeft = Math.min(...targetSegments.map((s) => s.leftPoints));
  const targetRight = Math.max(...targetSegments.map((s) => s.rightPoints));

  const compatible = shared.some((draft) => {
    const poolMemberSegmentKeys = draft.members.filter((m) => pool.has(m.lineKey)).map((m) => m.segmentKey);
    const poolSegments = evidence.segments.filter((s) => poolMemberSegmentKeys.includes(s.segmentKey));
    if (poolSegments.length === 0) return false;
    const envelopeLeft = Math.min(...poolSegments.map((s) => s.leftPoints));
    const envelopeRight = Math.max(...poolSegments.map((s) => s.rightPoints));
    return overlapRatio(targetLeft, targetRight, envelopeLeft, envelopeRight) >= H1_MINIMUM_OVERLAP_RATIO;
  });
  return compatible ? "must_include" : "must_exclude";
}

// --- H2: componente de grafo de incidência linha x alinhamento (global, sem largura) ---

export function candidateH2IncidenceComponent(evidence: CandidatePageEvidence, targetLineKey: string): MembershipDecision {
  const pool = anchorPoolFor(evidence, targetLineKey);
  if (pool.size === 0) {
    return "insufficient_evidence";
  }

  const parent = new Map<string, string>();
  const find = (key: string): string => {
    if (!parent.has(key)) parent.set(key, key);
    let root = key;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(key, root);
    return root;
  };
  const union = (a: string, b: string): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  evidence.lines.forEach((l) => find(l.lineKey));
  evidence.alignmentDrafts.forEach((draft) => {
    const memberKeys = draft.members.map((m) => m.lineKey);
    for (let i = 1; i < memberKeys.length; i += 1) {
      union(memberKeys[0], memberKeys[i]);
    }
  });

  const targetRoot = find(targetLineKey);
  const anyPoolMemberSharesRoot = [...pool].some((lk) => find(lk) === targetRoot);
  return anyPoolMemberSharesRoot ? "must_include" : "must_exclude";
}

// --- H3: envelope de coluna derivado de âncoras + compatibilidade de LARGURA (por segmento, nunca a linha inteira) ---

/** Razão máxima entre a largura do segmento próprio da linha-alvo e a largura mediana dos segmentos-âncora que sustentam o MESMO alinhamento — normalizada, nunca um valor absoluto de página. Fisicamente: um segmento que pertence à mesma coluna nunca deveria ocupar uma largura muito maior que a já observada em >= `minimumRegionLineCount` segmentos reais dessa coluna. 1.6x é uma folga conservadora acima de 1.0 (pequenas variações de fonte/kerning), nunca calibrada por um documento específico — testada nas fronteiras (abaixo/no limite/acima) pela suíte de avaliação (§13 do enunciado). */
export const H3_MAXIMUM_WIDTH_TO_ENVELOPE_RATIO = 1.6;

export function candidateH3EnvelopeAndWidth(
  evidence: CandidatePageEvidence,
  targetLineKey: string,
  maximumWidthRatio: number = H3_MAXIMUM_WIDTH_TO_ENVELOPE_RATIO,
): MembershipDecision {
  const pool = anchorPoolFor(evidence, targetLineKey);
  if (pool.size === 0) {
    return "insufficient_evidence";
  }
  const shared = sharedAlignmentsWithPool(evidence, targetLineKey, pool);
  if (shared.length === 0) {
    return "must_exclude";
  }

  const compatible = shared.some((draft) => {
    const targetMember = draft.members.find((m) => m.lineKey === targetLineKey);
    if (!targetMember) return false;
    const targetSegment = evidence.segments.find((s) => s.segmentKey === targetMember.segmentKey);
    if (!targetSegment) return false;
    const targetSegmentWidth = targetSegment.rightPoints - targetSegment.leftPoints;

    const poolMemberSegmentKeys = draft.members.filter((m) => pool.has(m.lineKey)).map((m) => m.segmentKey);
    const poolSegments = evidence.segments.filter((s) => poolMemberSegmentKeys.includes(s.segmentKey));
    if (poolSegments.length === 0) return false;
    const medianPoolSegmentWidth = median(poolSegments.map((s) => s.rightPoints - s.leftPoints));
    if (medianPoolSegmentWidth <= 0) return false;
    return targetSegmentWidth / medianPoolSegmentWidth <= maximumWidthRatio;
  });
  return compatible ? "must_include" : "must_exclude";
}

// --- H3b: mesma invariante de H3, mas com referência de largura de coluna DERIVADA GLOBALMENTE (não apenas da piscina de âncoras local) ---

/**
 * Refinamento de H3 motivado por achado real desta Sprint (execução
 * contra o documento Lagoa do Arroz, páginas 46-54): usar apenas a
 * piscina de âncoras LOCAL (a janela confirmada mais próxima) como
 * referência de largura herda a própria fragmentação da regra de
 * produção atual — quando a janela adjacente mais próxima é ela mesma
 * pequena ou atipicamente curta, a largura mediana derivada dela
 * subestima a largura real da coluna, rejeitando continuações legítimas
 * mas largas. H3b usa, em vez disso, TODOS os membros do MESMO
 * alinhamento na página inteira (evidência já existente e page-global —
 * `VerticalAlignmentDraft.members` — nunca um novo cálculo, nunca uma
 * nova capacidade) como referência de largura — mais estável e menos
 * sensível à fragmentação local. O portão de "compartilha alinhamento com
 * uma âncora adjacente confirmada" (nunca com toda a página) permanece
 * idêntico a H3 — por isso N9 (cluster privado) continua corretamente
 * excluído: seu alinhamento privado nunca é "compartilhado com a
 * piscina de âncoras" em primeiro lugar, independentemente de como a
 * largura de referência é calculada depois.
 */
export function candidateH3bGlobalEnvelopeAndWidth(
  evidence: CandidatePageEvidence,
  targetLineKey: string,
  maximumWidthRatio: number = H3_MAXIMUM_WIDTH_TO_ENVELOPE_RATIO,
): MembershipDecision {
  const pool = anchorPoolFor(evidence, targetLineKey);
  if (pool.size === 0) {
    return "insufficient_evidence";
  }
  const shared = sharedAlignmentsWithPool(evidence, targetLineKey, pool);
  if (shared.length === 0) {
    return "must_exclude";
  }

  const compatible = shared.some((draft) => {
    const targetMember = draft.members.find((m) => m.lineKey === targetLineKey);
    if (!targetMember) return false;
    const targetSegment = evidence.segments.find((s) => s.segmentKey === targetMember.segmentKey);
    if (!targetSegment) return false;
    const targetSegmentWidth = targetSegment.rightPoints - targetSegment.leftPoints;

    // Diferença em relação a H3: referência de largura = TODOS os membros deste alinhamento na página (evidência já global, nunca recalculada), não apenas os que caem na piscina de âncoras local.
    const allMemberSegmentKeys = draft.members.filter((m) => m.lineKey !== targetLineKey).map((m) => m.segmentKey);
    const allMemberSegments = evidence.segments.filter((s) => allMemberSegmentKeys.includes(s.segmentKey));
    if (allMemberSegments.length === 0) return false;
    const medianMemberSegmentWidth = median(allMemberSegments.map((s) => s.rightPoints - s.leftPoints));
    if (medianMemberSegmentWidth <= 0) return false;
    return targetSegmentWidth / medianMemberSegmentWidth <= maximumWidthRatio;
  });
  return compatible ? "must_include" : "must_exclude";
}

// --- H4: extensão mínima de contrato — blocos físicos bidimensionais de f.1 ---

export function candidateH4PhysicalBlockMembership(evidence: CandidatePageEvidence, targetLineKey: string): MembershipDecision {
  const pool = anchorPoolFor(evidence, targetLineKey);
  if (pool.size === 0) {
    return "insufficient_evidence";
  }
  const sharesBlock = evidence.blocks.some((block) => block.lineKeys.includes(targetLineKey) && block.lineKeys.some((lk) => pool.has(lk)));
  return sharesBlock ? "must_include" : "must_exclude";
}

export interface CandidateDefinition {
  readonly id: string;
  readonly namePt: string;
  readonly categoryPt: "A" | "B";
  readonly evaluate: (evidence: CandidatePageEvidence, targetLineKey: string) => MembershipDecision;
}

export const CANDIDATES: ReadonlyArray<CandidateDefinition> = [
  { id: "H1", namePt: "Âncora + sobreposição horizontal (sem largura)", categoryPt: "A", evaluate: candidateH1AnchorAndOverlap },
  { id: "H2", namePt: "Componente de incidência linha×alinhamento (global, sem largura)", categoryPt: "A", evaluate: candidateH2IncidenceComponent },
  { id: "H3", namePt: "Envelope de coluna (piscina local) + compatibilidade de largura por segmento", categoryPt: "A", evaluate: candidateH3EnvelopeAndWidth },
  { id: "H3b", namePt: "Envelope de coluna (todos os membros do alinhamento na página) + compatibilidade de largura por segmento", categoryPt: "A", evaluate: candidateH3bGlobalEnvelopeAndWidth },
  { id: "H4", namePt: "Pertencimento a bloco físico bidimensional (f.1)", categoryPt: "B", evaluate: candidateH4PhysicalBlockMembership },
];
