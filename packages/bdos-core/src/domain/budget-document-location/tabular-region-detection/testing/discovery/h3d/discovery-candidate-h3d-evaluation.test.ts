import { buildTabularRegionDetectionFixture } from "../../tabular-region-detection-test-bridge";
import type { SyntheticGeometryPage } from "../../tabular-region-detection-test-bridge";
import { DISCOVERY_CASE_MATRIX } from "../discovery-case-matrix";
import type { DiscoveryCase } from "../discovery-case-matrix";
import { permuteItems, transformPage } from "../discovery-geometry-transforms";
import { buildH3dPageEvidence, candidateH3dPhysicalGridAnchors } from "./discovery-candidate-h3d-hypothesis";
import type { H3dDecision } from "./discovery-candidate-h3d-hypothesis";
import {
  caseH3dAdd1_multiColumnHeaderAtUpperBoundary,
  caseH3dAdd2_multiColumnTotalAtLowerBoundary,
  caseH3dAdd3_singleColumnFooterAtBoundaryAdversarial,
  H3D_ADD1_TARGET_LABEL,
  H3D_ADD2_TARGET_LABEL,
  H3D_ADD3_TARGET_LABEL,
} from "./discovery-h3d-additional-case-fixtures";

/**
 * Avaliação executável de H3d (Sprint 21.4B.3A.2, §12.2-§12.3 do
 * enunciado) contra a matriz sintética pré-registrada de 20 casos (mesma
 * matriz de H1-H4/H3b/H3c, `discovery-case-matrix.ts`, reaproveitada sem
 * alteração), os 3 casos adicionais direcionados à regra de fronteira
 * exclusiva de H3d (§7.5), e as invariâncias exigidas. Nenhuma mudança de
 * fórmula, evidência, normalização, constante, limiar, comportamento de
 * fronteira ou classificação de saída pode ocorrer após a execução destes
 * testes (§10 do enunciado).
 *
 * Resultado REAL observado (mesma disciplina de caracterização já usada
 * para H1/H2/H4 em `discovery-candidate-evaluation.test.ts`: trava o
 * comportamento medido, nunca o desejado presumido): H3d falha
 * exatamente em P9 e P10 (linha esparsa de UMA coluna só, sustentada
 * apenas pelo bloco âncora vizinho, na fronteira). Causa raiz, verificada
 * por inspeção manual antes de qualquer ajuste de implementação: P9/P10
 * são, por construção, sempre casos de FRONTEIRA (§7.5) — a linha-alvo
 * está exatamente uma posição antes/depois do único bloco de suporte da
 * página — e têm exatamente 1 segmento (DESCRICAO), que só pode
 * corresponder a no máximo 1 envelope físico distinto. A salvaguarda de
 * fronteira exige >= `minimumRecurrentAlignmentCount` (2) envelopes
 * distintos, exatamente para rejeitar ruído de coluna única (mesma regra
 * que corretamente rejeita ADD3) — mas essa mesma regra também rejeita
 * uma continuação legítima de coluna única na fronteira. Isto é uma
 * consequência estrutural da definição declarativa congelada (§7.5),
 * nunca um desvio de implementação — não corrigido (§10: "qualquer erro
 * na definição congelada deve ser registrado como falha da candidata,
 * não corrigido depois de observar resultados").
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
  readonly actual: H3dDecision;
}

function evaluateH3dOnPage(caseId: string, page: SyntheticGeometryPage, targetLineSourceText: string): H3dDecision {
  const structure = buildTabularRegionDetectionFixture(`${caseId}-H3d`, [page]);
  if (structure.status !== "completed") {
    throw new Error(`${caseId}: reconstrução estrutural falhou (${structure.status})`);
  }
  const reconstructedPage = structure.groups[0].pages[0];
  const targetItem = page.items.find((item) => item.text === targetLineSourceText);
  assert(targetItem !== undefined, `${caseId}: item-alvo não encontrado na página`);
  const itemIndex = targetItem!.index ?? page.items.indexOf(targetItem!);
  const line = reconstructedPage.lines.find((l) => l.sourceTextItemIndices.includes(itemIndex));
  assert(line !== undefined, `${caseId}: linha física da linha-alvo não localizada`);
  const evidence = buildH3dPageEvidence(reconstructedPage);
  return candidateH3dPhysicalGridAnchors(evidence, line!.lineKey);
}

function evaluateH3dOnCase(discoveryCase: DiscoveryCase, pageOverride?: SyntheticGeometryPage): H3dDecision {
  const page = pageOverride ?? discoveryCase.buildPage();
  return evaluateH3dOnPage(discoveryCase.id, page, discoveryCase.targetLineSourceText);
}

function evaluateH3dOnMatrix(): ReadonlyArray<CaseOutcome> {
  return DISCOVERY_CASE_MATRIX.map((c) => ({ caseId: c.id, expected: c.expectedLabel, actual: evaluateH3dOnCase(c) }));
}

function failuresOf(outcomes: ReadonlyArray<CaseOutcome>): ReadonlyArray<CaseOutcome> {
  return outcomes.filter((o) => o.actual !== o.expected);
}

// --- Matriz sintética completa: resultado REAL medido (caracterização) -----

const KNOWN_H3D_FAILURE_IDS = ["P9", "P10"] as const;

runTest("H3d: conjunto de falhas na matriz sintética é exatamente {P9, P10} — 18/20 casos obrigatórios passam, incluindo os 3 adversariais N2/N8/N9", () => {
  const outcomes = evaluateH3dOnMatrix();
  const failures = failuresOf(outcomes);
  const failureIds = failures.map((f) => f.caseId).sort();
  assertEqual(JSON.stringify(failureIds), JSON.stringify([...KNOWN_H3D_FAILURE_IDS].sort()), `H3d: conjunto de falhas mudou — ${JSON.stringify(outcomes)}`);
  assertEqual(outcomes.length, 20, "matriz sintética deveria ter 20 entradas");
});

runTest("H3d: todos os casos positivos, exceto P9/P10, são must_include", () => {
  DISCOVERY_CASE_MATRIX.filter((c) => c.category === "positive" && !(KNOWN_H3D_FAILURE_IDS as readonly string[]).includes(c.id)).forEach((c) => {
    const actual = evaluateH3dOnCase(c);
    assertEqual(actual, "must_include", `${c.id}: obtido ${actual}`);
  });
});

runTest("H3d: todos os 10 casos negativos são must_exclude, incluindo os 3 adversariais obrigatórios (N2, N8, N9)", () => {
  DISCOVERY_CASE_MATRIX.filter((c) => c.category === "negative").forEach((c) => {
    const actual = evaluateH3dOnCase(c);
    assertEqual(actual, "must_exclude", `${c.id}: obtido ${actual}`);
  });
});

runTest("H3d: P9 e P10 (linha esparsa de uma coluna só, sustentada apenas pelo bloco vizinho, na fronteira) são, medidamente, must_exclude — falha real registrada, nunca corrigida após a execução", () => {
  KNOWN_H3D_FAILURE_IDS.forEach((id) => {
    const discoveryCase = DISCOVERY_CASE_MATRIX.find((c) => c.id === id)!;
    const actual = evaluateH3dOnCase(discoveryCase);
    assertEqual(actual, "must_exclude", `${id}: comportamento medido mudou — obtido ${actual}`);
  });
});

// --- Casos adicionais direcionados à regra de fronteira (§7.5, exclusiva de H3d) ---

runTest("ADD1: cabeçalho interno multicoluna na fronteira SUPERIOR é must_include", () => {
  const actual = evaluateH3dOnPage("ADD1", caseH3dAdd1_multiColumnHeaderAtUpperBoundary(), H3D_ADD1_TARGET_LABEL);
  assertEqual(actual, "must_include", `ADD1: obtido ${actual}`);
});

runTest("ADD2: total multicoluna na fronteira INFERIOR é must_include", () => {
  const actual = evaluateH3dOnPage("ADD2", caseH3dAdd2_multiColumnTotalAtLowerBoundary(), H3D_ADD2_TARGET_LABEL);
  assertEqual(actual, "must_include", `ADD2: obtido ${actual}`);
});

runTest("ADD3 (ADVERSARIAL): rodapé de uma coluna só na fronteira é must_exclude — salvaguarda de fronteira rejeita ruído de coluna única", () => {
  const actual = evaluateH3dOnPage("ADD3", caseH3dAdd3_singleColumnFooterAtBoundaryAdversarial(), H3D_ADD3_TARGET_LABEL);
  assertEqual(actual, "must_exclude", `ADD3: obtido ${actual}`);
});

// --- Invariâncias (§12.3) ---------------------------------------------------

runTest("determinismo: duas execuções independentes sobre o mesmo caso produzem o mesmo resultado", () => {
  DISCOVERY_CASE_MATRIX.forEach((c) => {
    const first = evaluateH3dOnCase(c);
    const second = evaluateH3dOnCase(c);
    assertEqual(first, second, `${c.id}: resultado mudou entre execuções repetidas`);
  });
});

runTest("permutação dos itens (linhas/segmentos/alinhamentos derivam da mesma ordem física, nunca da ordem incidental do array)", () => {
  DISCOVERY_CASE_MATRIX.forEach((c) => {
    const original = evaluateH3dOnCase(c);
    const permuted = evaluateH3dOnCase(c, permuteItems(c.buildPage()));
    assertEqual(permuted, original, `${c.id}: resultado mudou sob permutação de itens`);
  });
});

runTest("translação horizontal positiva e negativa não muda o resultado (razões normalizadas, nunca coordenada absoluta)", () => {
  DISCOVERY_CASE_MATRIX.forEach((c) => {
    const original = evaluateH3dOnCase(c);
    const translatedPositive = evaluateH3dOnCase(c, transformPage(c.buildPage(), { translateX: 500 }));
    const translatedNegative = evaluateH3dOnCase(c, transformPage(c.buildPage(), { translateX: -5 }));
    assertEqual(translatedPositive, original, `${c.id}: resultado mudou sob translação horizontal positiva`);
    assertEqual(translatedNegative, original, `${c.id}: resultado mudou sob translação horizontal negativa`);
  });
});

runTest("escala 0.5x e 3x não muda o resultado (razões normalizadas pela altura mínima, nunca um valor absoluto de página)", () => {
  DISCOVERY_CASE_MATRIX.forEach((c) => {
    const original = evaluateH3dOnCase(c);
    const halfScale = evaluateH3dOnCase(c, transformPage(c.buildPage(), { scale: 0.5 }));
    const tripleScale = evaluateH3dOnCase(c, transformPage(c.buildPage(), { scale: 3 }));
    assertEqual(halfScale, original, `${c.id}: resultado mudou sob escala 0.5x`);
    assertEqual(tripleScale, original, `${c.id}: resultado mudou sob escala 3x`);
  });
});

runTest("fronteira inferior, exata e superior: ADD1 (fronteira superior) e ADD2 (fronteira inferior) continuam corretos após permutação e translação", () => {
  [
    { build: caseH3dAdd1_multiColumnHeaderAtUpperBoundary, target: H3D_ADD1_TARGET_LABEL, id: "ADD1" },
    { build: caseH3dAdd2_multiColumnTotalAtLowerBoundary, target: H3D_ADD2_TARGET_LABEL, id: "ADD2" },
  ].forEach(({ build, target, id }) => {
    const original = evaluateH3dOnPage(id, build(), target);
    const permuted = evaluateH3dOnPage(id, permuteItems(build()), target);
    const translated = evaluateH3dOnPage(id, transformPage(build(), { translateX: 200, translateY: 300 }), target);
    assertEqual(permuted, original, `${id}: resultado mudou sob permutação`);
    assertEqual(translated, original, `${id}: resultado mudou sob translação`);
  });
});

runTest("linha-alvo excluída da própria sustentação (§7.1): P6 (cabeçalho interno esparso, caso INTERNO — não de fronteira) permanece must_include mesmo com a exclusão explícita da própria linha-alvo do cálculo do envelope que a julga", () => {
  const discoveryCase = DISCOVERY_CASE_MATRIX.find((c) => c.id === "P6")!;
  const actual = evaluateH3dOnCase(discoveryCase);
  assertEqual(actual, "must_include", `P6: obtido ${actual}`);
});

runTest("N9 (linhas externas repetidas) permanece must_exclude — a própria linha-alvo nunca conta como sustentação do alinhamento privado que ela mesma ajudaria a formar", () => {
  const discoveryCase = DISCOVERY_CASE_MATRIX.find((c) => c.id === "N9")!;
  const actual = evaluateH3dOnCase(discoveryCase);
  assertEqual(actual, "must_exclude", `N9: obtido ${actual}`);
});

runTest("linha fora da faixa vertical: N5 (rodapé apertado imediatamente após o fim da única região da página) é must_exclude — mesmo estando na fronteira, o conteúdo largo nunca fica contido em nenhum envelope físico real", () => {
  const discoveryCase = DISCOVERY_CASE_MATRIX.find((c) => c.id === "N5")!;
  const actual = evaluateH3dOnCase(discoveryCase);
  assertEqual(actual, "must_exclude", `N5: obtido ${actual}`);
});

runTest("altura degenerada, ausência de alinhamento esquerdo/direito, e componente sem suporte mínimo nunca produzem must_include por engano — verificado indiretamente pela ausência de falsos positivos em toda a matriz negativa", () => {
  const negatives = DISCOVERY_CASE_MATRIX.filter((c) => c.category === "negative");
  negatives.forEach((c) => {
    const actual = evaluateH3dOnCase(c);
    assertEqual(actual, "must_exclude", `${c.id}: falso positivo — obtido ${actual}`);
  });
});
