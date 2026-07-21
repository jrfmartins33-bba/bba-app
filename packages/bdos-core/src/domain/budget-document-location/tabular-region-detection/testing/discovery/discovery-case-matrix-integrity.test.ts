import { DISCOVERY_CASE_MATRIX, INDISTINGUISHABILITY_PAIRS } from "./discovery-case-matrix";

/**
 * Validador de integridade da matriz pré-registrada (Sprint 21.4B.3A,
 * §9/§10 do enunciado). Nenhum algoritmo candidato aqui — apenas
 * verificação estrutural de que a matriz de dados está bem formada antes
 * de qualquer experimento.
 */

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const REQUIRED_POSITIVE_IDS = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10"];
const REQUIRED_NEGATIVE_IDS = ["N1", "N2", "N3", "N4", "N5", "N6", "N7", "N8", "N9", "N10"];
const REQUIRED_ADVERSARIAL_IDS = ["N2", "N8", "N9"];

runTest("matriz contém exatamente os 10 casos positivos e 10 negativos obrigatórios do enunciado", () => {
  const ids = DISCOVERY_CASE_MATRIX.map((c) => c.id);
  [...REQUIRED_POSITIVE_IDS, ...REQUIRED_NEGATIVE_IDS].forEach((requiredId) => {
    assert(ids.includes(requiredId), `caso obrigatório ausente da matriz: ${requiredId}`);
  });
});

runTest("nenhum id duplicado na matriz", () => {
  const ids = DISCOVERY_CASE_MATRIX.map((c) => c.id);
  assertEqual(new Set(ids).size, ids.length, "há ids duplicados na matriz");
});

runTest("cada caso positivo tem expectedLabel=must_include e categoria=positive", () => {
  DISCOVERY_CASE_MATRIX.filter((c) => REQUIRED_POSITIVE_IDS.includes(c.id)).forEach((c) => {
    assertEqual(c.category, "positive", `${c.id}: categoria incorreta`);
    assertEqual(c.expectedLabel, "must_include", `${c.id}: rótulo esperado incorreto`);
  });
});

runTest("cada caso negativo tem expectedLabel=must_exclude e categoria=negative", () => {
  DISCOVERY_CASE_MATRIX.filter((c) => REQUIRED_NEGATIVE_IDS.includes(c.id)).forEach((c) => {
    assertEqual(c.category, "negative", `${c.id}: categoria incorreta`);
    assertEqual(c.expectedLabel, "must_exclude", `${c.id}: rótulo esperado incorreto`);
  });
});

runTest("os três adversariais obrigatórios (N2/N8/N9) estão marcados adversarial=true, e nenhum outro caso está", () => {
  DISCOVERY_CASE_MATRIX.forEach((c) => {
    const shouldBeAdversarial = REQUIRED_ADVERSARIAL_IDS.includes(c.id);
    assertEqual(c.adversarial, shouldBeAdversarial, `${c.id}: flag adversarial incorreta`);
  });
});

runTest("cada caso tem atribuição não vazia (origem documentada — reconstrução ou 'novo nesta Sprint')", () => {
  DISCOVERY_CASE_MATRIX.forEach((c) => {
    assert(c.attributionPt.trim().length > 0, `${c.id}: atribuição vazia`);
  });
});

runTest("cada caso constrói uma página cujo item de origem contém exatamente o texto-alvo declarado", () => {
  DISCOVERY_CASE_MATRIX.forEach((c) => {
    const page = c.buildPage();
    const found = page.items.some((item) => item.text === c.targetLineSourceText);
    assert(found, `${c.id}: nenhum item da página construída tem text === "${c.targetLineSourceText}"`);
  });
});

runTest("cada caso constrói uma página geometricamente válida (largura/altura positivas, ao menos 3 itens)", () => {
  DISCOVERY_CASE_MATRIX.forEach((c) => {
    const page = c.buildPage();
    assert(page.widthPoints > 0 && page.heightPoints > 0, `${c.id}: dimensões de página inválidas`);
    assert(page.items.length >= 3, `${c.id}: menos de 3 itens físicos — nunca suficiente para minimumRegionLineCount`);
  });
});

runTest("os pares de indistinguibilidade pré-registrados (F-vs-J, L1-vs-L7) constroem páginas válidas com o item-alvo presente", () => {
  INDISTINGUISHABILITY_PAIRS.forEach((pair) => {
    const positivePage = pair.positive.buildPage();
    const negativePage = pair.negative.buildPage();
    assert(positivePage.items.some((i) => i.text === pair.positive.targetLineSourceText), `${pair.pairId}: item positivo ausente`);
    assert(negativePage.items.some((i) => i.text === pair.negative.targetLineSourceText), `${pair.pairId}: item negativo ausente`);
  });
});

runTest("N6 e N10 declaram explicitamente o papel duplo da mesma fixture (nunca uma coincidência silenciosa)", () => {
  const n6 = DISCOVERY_CASE_MATRIX.find((c) => c.id === "N6")!;
  const n10 = DISCOVERY_CASE_MATRIX.find((c) => c.id === "N10")!;
  assertEqual(n6.buildPage, n10.buildPage, "N6/N10 deveriam reaproveitar a mesma função construtora (fixture do Caso H)");
  assert(n10.attributionPt.includes("papel duplo"), "N10 deve documentar explicitamente o papel duplo com N6");
});
