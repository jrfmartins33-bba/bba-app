import { buildTabularRegionDetectionFixture } from "../tabular-region-detection-test-bridge";
import type { SyntheticGeometryPage } from "../tabular-region-detection-test-bridge";
import { DISCOVERY_CASE_MATRIX } from "./discovery-case-matrix";
import type { DiscoveryCase } from "./discovery-case-matrix";
import { buildDiscoverySequence, GAP_RATIO_NORMAL, GAP_RATIO_TIGHT } from "./discovery-case-fixtures";
import { buildCandidatePageEvidence, CANDIDATES, H3_MAXIMUM_WIDTH_TO_ENVELOPE_RATIO, candidateH3EnvelopeAndWidth } from "./discovery-candidate-hypotheses";
import type { MembershipDecision } from "./discovery-candidate-hypotheses";
import { permuteItems, transformPage } from "./discovery-geometry-transforms";

/**
 * Avaliação executável dos candidatos H1-H4 (Sprint 21.4B.3A, §12/§14 do
 * enunciado) contra a matriz pré-registrada — momento 2, DEPOIS do
 * pré-registro (commit anterior) e da prova de indistinguibilidade.
 *
 * Cada teste abaixo trava o comportamento REAL observado por execução —
 * nunca o comportamento desejado presumido — seguindo a mesma convenção
 * das Sprints diagnósticas anteriores (21.4B.1/21.4B.2): testes de
 * caracterização nunca quebram a suíte agregada, mesmo quando documentam
 * a rejeição de uma candidata. Resultado real, medido nesta Sprint:
 *
 * - H1 (âncora + sobreposição, sem largura): falha em N1, N2, N7, N8 —
 *   confirma que sobreposição sem largura absorve incorretamente
 *   parágrafos externos largos que tocam uma borda de coluna real.
 * - H2 (componente de incidência, sem largura): falha exatamente nos
 *   mesmos 4 casos que H1, pela mesma razão estrutural.
 * - H3 (envelope de coluna, piscina local + largura por segmento): PASSA
 *   os 20 casos obrigatórios SINTÉTICOS (10 positivos + 10 negativos,
 *   incluindo os 3 adversariais N2/N8/N9) — mas, contra o documento real
 *   (Lagoa do Arroz, páginas 46-54), exclui incorretamente várias
 *   continuações de descrição legítimas mais largas do que o modelo
 *   sintético previu (ver `EPIC_21_SPRINT_4B3A_EVIDENCE_PACKAGE.md`).
 * - H3b (mesma invariante, referência de largura = todos os membros do
 *   alinhamento na página inteira, não apenas a piscina local): também
 *   PASSA os 20 casos sintéticos; melhora alguns dos falsos negativos
 *   reais de H3, mas introduz outros — generalização real permanece
 *   incompleta. Nenhuma das duas variantes é aprovada como segura para o
 *   documento real dentro desta Sprint (ver relatório para o veredito
 *   final D — inconclusivo).
 * - H4 (blocos físicos de f.1): falha em TODOS os 10 negativos — blocos
 *   conectam geometricamente qualquer elemento próximo (largo, coincidente
 *   com borda de coluna, ou repetido) às âncoras com a mesma facilidade
 *   que conteúdo tabular legítimo. Categoria B (extensão de contrato via
 *   `f.1`) não produz invariante segura por si só.
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

interface CaseOutcome {
  readonly caseId: string;
  readonly expected: "must_include" | "must_exclude";
  readonly actual: MembershipDecision;
}

function evaluateCandidateOnCase(candidateId: string, discoveryCase: DiscoveryCase, pageOverride?: SyntheticGeometryPage): MembershipDecision {
  const candidate = CANDIDATES.find((c) => c.id === candidateId)!;
  const page = pageOverride ?? discoveryCase.buildPage();
  const structure = buildTabularRegionDetectionFixture(`${discoveryCase.id}-${candidateId}`, [page]);
  if (structure.status !== "completed") {
    throw new Error(`${discoveryCase.id}: reconstrução estrutural falhou (${structure.status})`);
  }
  const reconstructedPage = structure.groups[0].pages[0];
  const targetItem = page.items.find((item) => item.text === discoveryCase.targetLineSourceText);
  assert(targetItem !== undefined, `${discoveryCase.id}: item-alvo não encontrado na página`);
  // Usa o índice técnico estável do item (nunca a posição no array — a permutação de ordem preserva o índice, não a posição).
  const itemIndex = targetItem!.index ?? page.items.indexOf(targetItem!);
  const line = reconstructedPage.lines.find((l) => l.sourceTextItemIndices.includes(itemIndex));
  assert(line !== undefined, `${discoveryCase.id}: linha física da linha-alvo não localizada`);
  const evidence = buildCandidatePageEvidence(reconstructedPage);
  return candidate.evaluate(evidence, line!.lineKey);
}

function evaluateCandidateOnMatrix(candidateId: string): ReadonlyArray<CaseOutcome> {
  return DISCOVERY_CASE_MATRIX.map((c) => ({
    caseId: c.id,
    expected: c.expectedLabel,
    actual: evaluateCandidateOnCase(candidateId, c),
  }));
}

function failuresOf(outcomes: ReadonlyArray<CaseOutcome>): ReadonlyArray<CaseOutcome> {
  return outcomes.filter((o) => o.actual !== o.expected);
}

// --- Matriz completa: um teste por candidata, travando o resultado real medido ---

runTest("H1 (âncora + sobreposição, sem largura): passa todos os 10 positivos, falha em N1/N2/N7/N8 (absorve parágrafos externos largos)", () => {
  const outcomes = evaluateCandidateOnMatrix("H1");
  const failures = failuresOf(outcomes);
  const failureIds = failures.map((f) => f.caseId).sort();
  assertEqual(JSON.stringify(failureIds), JSON.stringify(["N1", "N2", "N7", "N8"]), `H1: conjunto de falhas mudou — ${JSON.stringify(outcomes)}`);
  DISCOVERY_CASE_MATRIX.filter((c) => c.category === "positive").forEach((c) => {
    const outcome = outcomes.find((o) => o.caseId === c.id)!;
    assertEqual(outcome.actual, "must_include", `H1 deveria incluir corretamente todos os positivos — falhou em ${c.id}`);
  });
});

runTest("H2 (componente de incidência global, sem largura): passa todos os 10 positivos, falha exatamente nos mesmos N1/N2/N7/N8 que H1", () => {
  const outcomes = evaluateCandidateOnMatrix("H2");
  const failures = failuresOf(outcomes);
  const failureIds = failures.map((f) => f.caseId).sort();
  assertEqual(JSON.stringify(failureIds), JSON.stringify(["N1", "N2", "N7", "N8"]), `H2: conjunto de falhas mudou — ${JSON.stringify(outcomes)}`);
});

runTest("H3 (envelope de coluna, piscina local + largura por segmento): PASSA os 20 casos obrigatórios sintéticos (0 falhas)", () => {
  const outcomes = evaluateCandidateOnMatrix("H3");
  const failures = failuresOf(outcomes);
  assertEqual(failures.length, 0, `H3 deveria passar todos os casos — falhas observadas: ${JSON.stringify(failures)}`);
});

runTest("H3b (envelope de coluna, todos os membros do alinhamento na página + largura por segmento): PASSA os 20 casos obrigatórios sintéticos (0 falhas)", () => {
  const outcomes = evaluateCandidateOnMatrix("H3b");
  const failures = failuresOf(outcomes);
  assertEqual(failures.length, 0, `H3b deveria passar todos os casos — falhas observadas: ${JSON.stringify(failures)}`);
});

runTest("H4 (blocos físicos de f.1): passa todos os 10 positivos, mas falha em TODOS os 10 negativos — blocos conectam qualquer elemento geometricamente próximo às âncoras, tabular ou não", () => {
  const outcomes = evaluateCandidateOnMatrix("H4");
  const failures = failuresOf(outcomes);
  const failureIds = failures.map((f) => f.caseId).sort();
  assertEqual(
    JSON.stringify(failureIds),
    JSON.stringify(["N1", "N10", "N2", "N3", "N4", "N5", "N6", "N7", "N8", "N9"]),
    `H4: conjunto de falhas mudou — ${JSON.stringify(outcomes)}`,
  );
  DISCOVERY_CASE_MATRIX.filter((c) => c.category === "positive").forEach((c) => {
    const outcome = outcomes.find((o) => o.caseId === c.id)!;
    assertEqual(outcome.actual, "must_include", `H4 deveria incluir corretamente todos os positivos — falhou em ${c.id}`);
  });
});

// --- Invariância de permutação (§14.8): H3 nunca deve depender da ordem incidental do array de itens ---

runTest("H3 é invariante à permutação da ordem dos itens (Casos P2 e N8, adversarial)", () => {
  ["P2", "N8"].forEach((caseId) => {
    const discoveryCase = DISCOVERY_CASE_MATRIX.find((c) => c.id === caseId)!;
    const original = evaluateCandidateOnCase("H3", discoveryCase);
    const permuted = evaluateCandidateOnCase("H3", discoveryCase, permuteItems(discoveryCase.buildPage()));
    assertEqual(permuted, original, `${caseId}: decisão de H3 mudou sob permutação da ordem dos itens`);
  });
});

// --- Invariância de translação (§14.9) ---

runTest("H3 é invariante à translação de todas as coordenadas (Casos P2 e N8, adversarial)", () => {
  ["P2", "N8"].forEach((caseId) => {
    const discoveryCase = DISCOVERY_CASE_MATRIX.find((c) => c.id === caseId)!;
    const original = evaluateCandidateOnCase("H3", discoveryCase);
    const translated = evaluateCandidateOnCase("H3", discoveryCase, transformPage(discoveryCase.buildPage(), { translateX: 1000, translateY: 2000 }));
    assertEqual(translated, original, `${caseId}: decisão de H3 mudou sob translação`);
  });
});

// --- Invariância de escala (§14.10) ---

runTest("H3 é invariante à escala uniforme das coordenadas (Casos P2 e N8, adversarial; escalas 0.5x e 3x)", () => {
  ["P2", "N8"].forEach((caseId) => {
    const discoveryCase = DISCOVERY_CASE_MATRIX.find((c) => c.id === caseId)!;
    const original = evaluateCandidateOnCase("H3", discoveryCase);
    const scaledUp = evaluateCandidateOnCase("H3", discoveryCase, transformPage(discoveryCase.buildPage(), { scale: 3 }));
    const scaledDown = evaluateCandidateOnCase("H3", discoveryCase, transformPage(discoveryCase.buildPage(), { scale: 0.5 }));
    assertEqual(scaledUp, original, `${caseId}: decisão de H3 mudou sob escala 3x`);
    assertEqual(scaledDown, original, `${caseId}: decisão de H3 mudou sob escala 0.5x`);
  });
});

// --- Fronteira do limiar de largura de H3 (§13/§14.2: testar abaixo/no limite/acima) ---

const DESCRICAO_ENVELOPE_WIDTH = 185; // 430 - 245, largura real da coluna DESCRICAO nas fixtures desta Sprint.

function buildRatioBoundaryProbe(continuationWidthPoints: number): SyntheticGeometryPage {
  return buildDiscoverySequence([
    { kind: "full", gapRatioBefore: 0, label: "boundaryrow0" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "boundaryrow1" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "boundaryrow2" },
    { kind: "description-only", gapRatioBefore: GAP_RATIO_TIGHT, label: "boundarycont", rightPoints: 245 + continuationWidthPoints },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "boundaryrow3" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "boundaryrow4" },
    { kind: "full", gapRatioBefore: GAP_RATIO_NORMAL, label: "boundaryrow5" },
  ]);
}

function evaluateBoundaryProbe(continuationWidthPoints: number): MembershipDecision {
  const page = buildRatioBoundaryProbe(continuationWidthPoints);
  const structure = buildTabularRegionDetectionFixture(`boundary-${continuationWidthPoints}`, [page]);
  assertEqual(structure.status, "completed");
  const reconstructedPage = structure.groups[0].pages[0];
  const itemIndex = page.items.findIndex((i) => i.text === "boundarycont-continuation");
  const line = reconstructedPage.lines.find((l) => l.sourceTextItemIndices.includes(itemIndex))!;
  const evidence = buildCandidatePageEvidence(reconstructedPage);
  return candidateH3EnvelopeAndWidth(evidence, line.lineKey);
}

runTest(
  `H3: fronteira exata do limiar de largura (${H3_MAXIMUM_WIDTH_TO_ENVELOPE_RATIO}x) — abaixo inclui, no limite inclui, acima exclui`,
  () => {
    const belowThreshold = evaluateBoundaryProbe(DESCRICAO_ENVELOPE_WIDTH * (H3_MAXIMUM_WIDTH_TO_ENVELOPE_RATIO - 0.1));
    const atThreshold = evaluateBoundaryProbe(DESCRICAO_ENVELOPE_WIDTH * H3_MAXIMUM_WIDTH_TO_ENVELOPE_RATIO);
    const aboveThreshold = evaluateBoundaryProbe(DESCRICAO_ENVELOPE_WIDTH * (H3_MAXIMUM_WIDTH_TO_ENVELOPE_RATIO + 0.1));

    assertEqual(belowThreshold, "must_include", "abaixo do limiar deveria incluir");
    assertEqual(atThreshold, "must_include", "exatamente no limiar (<=) deveria incluir");
    assertEqual(aboveThreshold, "must_exclude", "acima do limiar deveria excluir");
  },
);
