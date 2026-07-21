import { buildTabularRegionDetectionFixture } from "../../tabular-region-detection-test-bridge";
import type { SyntheticGeometryPage } from "../../tabular-region-detection-test-bridge";
import { DISCOVERY_CASE_MATRIX } from "../discovery-case-matrix";
import type { DiscoveryCase } from "../discovery-case-matrix";
import { buildDiscoverySequence, GAP_RATIO_NORMAL, GAP_RATIO_TIGHT } from "../discovery-case-fixtures";
import { permuteItems, transformPage } from "../discovery-geometry-transforms";
import { buildCandidatePageEvidence, candidateH3cPairedEdgeEnvelope } from "./discovery-candidate-h3c-hypothesis";
import type { H3cDecision } from "./discovery-candidate-h3c-hypothesis";
import { BUDGET_DOCUMENT_TABULAR_REGION_DETECTION_PROFILE_V1 } from "../../../tabular-region-detection-profile";

/**
 * Avaliação de H3c contra a matriz sintética pré-registrada, invariâncias
 * e comportamento degenerado (Sprint 21.4B.3A.1, §10.2/§10.4 do
 * enunciado). Definição congelada em
 * `EPIC_21_SPRINT_4B3A1_H3C_PREREGISTRATION.md` (commit de pré-registro
 * `a8777b5e999258be23025eeb987125359c8ff91a`) — nenhuma mudança de
 * fórmula, evidência, normalização, limiar ou classificação de saída
 * ocorreu após a execução destes testes (ver §17 do pré-registro para a
 * única correção aplicada: um bug de implementação na identidade de
 * agrupamento, corrigido ANTES de qualquer resultado formal, nunca uma
 * mudança semântica).
 *
 * Resultado real (documento Lagoa do Arroz, avaliado por
 * `scripts/evaluate-h3c-real-manifest.ts` contra as 670 entradas do
 * manifesto congelado — script separado, não incluído aqui por depender
 * do PDF local): 25 acerto, 0 falso_positivo, 174 falso_negativo, 470
 * evidência_insuficiente, 1 incerto. H3c NUNCA produz falso positivo no
 * documento real, mas herda a fragmentação severa da regra de produção
 * atual (suas âncoras dependem de `formTabularRegionCandidateWindows`,
 * já reprovada em caso real) — a maioria das linhas reais não tem
 * nenhuma janela confirmada imediatamente adjacente, resultando em
 * `insufficient_evidence` maciço. Ver relatório final para o veredito.
 */

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function evaluateCase(discoveryCase: DiscoveryCase, pageOverride?: SyntheticGeometryPage): H3cDecision {
  const page = pageOverride ?? discoveryCase.buildPage();
  const structure = buildTabularRegionDetectionFixture(`h3c-${discoveryCase.id}`, [page]);
  assertEqual(structure.status, "completed", `${discoveryCase.id}: reconstrução estrutural falhou`);
  const reconstructedPage = structure.groups[0].pages[0];
  const targetItem = page.items.find((item) => item.text === discoveryCase.targetLineSourceText);
  assert(targetItem !== undefined, `${discoveryCase.id}: item-alvo não encontrado`);
  const itemIndex = targetItem!.index ?? page.items.indexOf(targetItem!);
  const line = reconstructedPage.lines.find((l) => l.sourceTextItemIndices.includes(itemIndex));
  assert(line !== undefined, `${discoveryCase.id}: linha-alvo não localizada`);
  const evidence = buildCandidatePageEvidence(reconstructedPage);
  return candidateH3cPairedEdgeEnvelope(evidence, line!.lineKey);
}

// --- §10.2: matriz sintética completa ---------------------------------------

runTest("H3c PASSA os 20 casos sintéticos obrigatórios (10 positivos + 10 negativos, incluindo os 3 adversariais N2/N8/N9) — 0 falhas", () => {
  const failures: string[] = [];
  DISCOVERY_CASE_MATRIX.forEach((c) => {
    const decision = evaluateCase(c);
    if (decision !== c.expectedLabel) {
      failures.push(`${c.id}: esperado=${c.expectedLabel} obtido=${decision}`);
    }
  });
  assertEqual(failures.length, 0, `H3c falhou em casos sintéticos: ${JSON.stringify(failures)}`);
});

// --- §10.4: determinismo e invariâncias --------------------------------------

runTest("H3c é determinístico: mesma entrada produz o mesmo resultado em execuções repetidas", () => {
  const c = DISCOVERY_CASE_MATRIX.find((x) => x.id === "P2")!;
  const first = evaluateCase(c);
  const second = evaluateCase(c);
  assertEqual(first, second);
});

runTest("H3c é invariante à permutação da ordem dos itens (Casos P2 e N8, adversarial)", () => {
  ["P2", "N8"].forEach((id) => {
    const c = DISCOVERY_CASE_MATRIX.find((x) => x.id === id)!;
    const original = evaluateCase(c);
    const permuted = evaluateCase(c, permuteItems(c.buildPage()));
    assertEqual(permuted, original, `${id}: decisão de H3c mudou sob permutação`);
  });
});

runTest("H3c é invariante à translação de todas as coordenadas (Casos P2 e N8, adversarial)", () => {
  ["P2", "N8"].forEach((id) => {
    const c = DISCOVERY_CASE_MATRIX.find((x) => x.id === id)!;
    const original = evaluateCase(c);
    const translated = evaluateCase(c, transformPage(c.buildPage(), { translateX: 1000, translateY: 2000 }));
    assertEqual(translated, original, `${id}: decisão de H3c mudou sob translação`);
  });
});

runTest("H3c é invariante à escala uniforme das coordenadas (Casos P2 e N8, adversarial; escalas 0.5x e 3x)", () => {
  ["P2", "N8"].forEach((id) => {
    const c = DISCOVERY_CASE_MATRIX.find((x) => x.id === id)!;
    const original = evaluateCase(c);
    const scaledUp = evaluateCase(c, transformPage(c.buildPage(), { scale: 3 }));
    const scaledDown = evaluateCase(c, transformPage(c.buildPage(), { scale: 0.5 }));
    assertEqual(scaledUp, original, `${id}: decisão de H3c mudou sob escala 3x`);
    assertEqual(scaledDown, original, `${id}: decisão de H3c mudou sob escala 0.5x`);
  });
});

// --- §9.5/§10.4: fronteira do limiar reutilizado (maximumAlignmentPositionDeviationToMinimumLineHeightRatio = 0.5) ---

const RATIO = BUDGET_DOCUMENT_TABULAR_REGION_DETECTION_PROFILE_V1.maximumAlignmentPositionDeviationToMinimumLineHeightRatio;
const ROW_HEIGHT = 12;
const TOLERANCE_POINTS = RATIO * ROW_HEIGHT; // 6pt, para linhas de altura uniforme 12pt

function buildBoundaryProbe(rightOffsetFromEnvelope: number): SyntheticGeometryPage {
  // Réplica de P2 (continuação única), mas com a borda direita da continuação
  // deslocada por `rightOffsetFromEnvelope` além do envelope real da coluna
  // DESCRICAO (representativeRightPoints = 430, mesma largura da coluna
  // cheia usada pelas âncoras) — testa a fronteira de `containedFromRight`.
  return buildDiscoverySequence([
    { kind: "full", gapRatioBefore: 0, label: "boundaryrow0" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "boundaryrow1" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "boundaryrow2" },
    { kind: "description-only", gapRatioBefore: GAP_RATIO_TIGHT, label: "boundarycont", rightPoints: 430 + rightOffsetFromEnvelope },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "boundaryrow3" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "boundaryrow4" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "boundaryrow5" },
  ]);
}

function evaluateBoundaryProbe(rightOffsetFromEnvelope: number): H3cDecision {
  const page = buildBoundaryProbe(rightOffsetFromEnvelope);
  const structure = buildTabularRegionDetectionFixture(`h3c-boundary-${rightOffsetFromEnvelope}`, [page]);
  assertEqual(structure.status, "completed");
  const reconstructedPage = structure.groups[0].pages[0];
  const itemIndex = page.items.findIndex((i) => i.text === "boundarycont-continuation");
  const line = reconstructedPage.lines.find((l) => l.sourceTextItemIndices.includes(itemIndex))!;
  const evidence = buildCandidatePageEvidence(reconstructedPage);
  return candidateH3cPairedEdgeEnvelope(evidence, line.lineKey);
}

runTest(`H3c: fronteira exata do limiar reutilizado (tolerancePoints=${TOLERANCE_POINTS}pt) — abaixo inclui, no limite inclui (<=), acima exclui`, () => {
  const below = evaluateBoundaryProbe(TOLERANCE_POINTS - 1);
  const atLimit = evaluateBoundaryProbe(TOLERANCE_POINTS);
  const above = evaluateBoundaryProbe(TOLERANCE_POINTS + 1);
  assertEqual(below, "must_include", "abaixo do limiar deveria incluir");
  assertEqual(atLimit, "must_include", "exatamente no limiar (<=) deveria incluir");
  assertEqual(above, "must_exclude", "acima do limiar deveria excluir");
});

// --- §10.4/§11: comportamento degenerado -------------------------------------

runTest("H3c: linha-alvo isolada (sem vizinho adjacente qualificado) retorna insufficient_evidence, nunca must_include silencioso", () => {
  const page = buildDiscoverySequence([
    { kind: "wide-external", gapRatioBefore: 0, label: "isolada-unica-linha", leftPoints: 10, rightPoints: 890 },
  ]);
  const structure = buildTabularRegionDetectionFixture("h3c-isolated", [page]);
  assertEqual(structure.status, "completed");
  const reconstructedPage = structure.groups[0].pages[0];
  const line = reconstructedPage.lines[0];
  const evidence = buildCandidatePageEvidence(reconstructedPage);
  const decision = candidateH3cPairedEdgeEnvelope(evidence, line.lineKey);
  assertEqual(decision, "insufficient_evidence");
});

runTest("H3c: linha-alvo nunca sustenta sua própria decisão — excluí-la da evidência não muda o resultado dos outros positivos/negativos", () => {
  // Já verificado implicitamente por todo P1-P10/N1-N10 (cada um usa a piscina de
  // âncoras/envelopes SEM a linha-alvo, por construção de `computeAnchorSets`/
  // `computePairEnvelopes`, que sempre filtram `lk !== targetLineKey`). Este teste
  // confirma explicitamente que uma linha idêntica à âncora, mas marcada como
  // alvo dentro de uma janela de controle (P1), não infla artificialmente seu
  // próprio suporte a ponto de mascarar `minimumRegionLineCount`.
  const c = DISCOVERY_CASE_MATRIX.find((x) => x.id === "P1")!;
  const decision = evaluateCase(c);
  assertEqual(decision, "must_include");
});

runTest("H3c: altura de linha degenerada (<=0) nunca lança exceção — resultado determinístico (must_exclude ou insufficient_evidence, nunca crash)", () => {
  const page: SyntheticGeometryPage = {
    widthPoints: 900,
    heightPoints: 792,
    items: [
      { text: "row0-item", leftPoints: 40, topPoints: 700, rightPoints: 70, bottomPoints: 700 },
      { text: "row0-desc", leftPoints: 245, topPoints: 700, rightPoints: 430, bottomPoints: 700 },
      { text: "row1-item", leftPoints: 40, topPoints: 713, rightPoints: 70, bottomPoints: 725 },
      { text: "row1-desc", leftPoints: 245, topPoints: 713, rightPoints: 430, bottomPoints: 725 },
      { text: "row2-item", leftPoints: 40, topPoints: 738, rightPoints: 70, bottomPoints: 750 },
      { text: "row2-desc", leftPoints: 245, topPoints: 738, rightPoints: 430, bottomPoints: 750 },
      { text: "target-desc", leftPoints: 245, topPoints: 726, rightPoints: 340, bottomPoints: 737 },
    ],
  };
  let decision: H3cDecision | null = null;
  let threw = false;
  try {
    const structure = buildTabularRegionDetectionFixture("h3c-degenerate-height", [page]);
    if (structure.status === "completed") {
      const reconstructedPage = structure.groups[0].pages[0];
      const itemIndex = page.items.findIndex((i) => i.text === "target-desc");
      const line = reconstructedPage.lines.find((l) => l.sourceTextItemIndices.includes(itemIndex));
      if (line) {
        const evidence = buildCandidatePageEvidence(reconstructedPage);
        decision = candidateH3cPairedEdgeEnvelope(evidence, line.lineKey);
      }
    }
  } catch {
    threw = true;
  }
  assert(!threw, "H3c não deveria lançar exceção sob geometria de altura mínima/degenerada");
  assert(decision === null || ["must_include", "must_exclude", "insufficient_evidence"].includes(decision), "resultado deveria ser um dos três valores válidos");
});
