import { buildTabularRegionDetectionFixture } from "../tabular-region-detection/testing/tabular-region-detection-test-bridge";
import { detectBudgetDocumentTabularRegions } from "../tabular-region-detection/detect-budget-document-tabular-regions";
import type { BudgetDocumentTabularRegionDetectionResult } from "../tabular-region-detection/budget-document-tabular-region-detection.types";
import {
  caseA_denseTableNoWrap,
  caseB_denseTableTwoWraps,
  caseC_simpleTableWithWrap,
  caseD_denseTableSingleCleanWrap,
  caseE_wrapStepVariant,
  caseF_denseTableWithLegitimateSparseRow,
  caseG_legitimateContinuationFixture,
  caseH_externalTitleBetweenTabularBlocks,
  caseI_lateralNoteOutsideEnvelope,
  caseJ_accidentalSingleAlignmentParagraph,
  caseK_sparseInternalHeader,
} from "./dense-table-region-diagnosis-fixtures";

/**
 * Diagnóstico da Sprint 21.4B.1 (Checkpoint de reprodução/caracterização,
 * nenhuma correção autorizada ainda). Geometria sintética genérica, nunca
 * o caso real Lagoa do Arroz.
 *
 * Escolha metodológica explícita: estes testes NUNCA fazem `pnpm test`
 * falhar — inclusive os que caracterizam o defeito atualmente observado.
 * Em vez de afirmar o resultado que *deveria* ocorrer após uma correção
 * futura (o que quebraria a suíte agregada e o CI hoje), cada teste
 * "CARACTERIZAÇÃO DE DEFEITO" trava o valor exato hoje produzido pela
 * cadeia real (nunca simulado), citando ao lado, em comentário, qual seria
 * o valor correto esperado. Quando a Sprint 21.4B.1 implementar a
 * correção, estes mesmos testes devem ser atualizados para afirmar o
 * valor correto — a diferença entre o valor travado aqui e o comentado
 * como "esperado" é, por construção, a prova objetiva do defeito. Os
 * testes "CONTROLE" já afirmam o comportamento correto hoje.
 *
 * Casos H-K (negativos/adversariais) foram usados para investigar um
 * discriminador seguro para a correção — ver `EPIC_21_SPRINT_4B1_...md`.
 * Resultado da investigação: um discriminador baseado apenas em
 * subconjunto de assinaturas de alinhamento (sem geometria) corrige B/C/D/
 * F/G/K corretamente, mas absorve incorretamente o Caso J (parágrafo com 1
 * alinhamento coincidente) — confirmado empiricamente: F e J produzem
 * exatamente a mesma assinatura (1 segmento, 1 alinhamento) na mesma
 * posição vertical normal, tornando-os indistinguíveis por qualquer sinal
 * hoje disponível em `tabular-region-formation.ts`. Nenhuma correção de
 * produção foi implementada nesta Sprint — ver relatório final.
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

function detect(pageBuilder: () => ReturnType<typeof caseA_denseTableNoWrap>, label: string): BudgetDocumentTabularRegionDetectionResult {
  const structureReconstruction = buildTabularRegionDetectionFixture(label, [pageBuilder()]);
  assertEqual(structureReconstruction.status, "completed", "pré-condição da fixture: reconstrução estrutural deve concluir sem falha");
  return detectBudgetDocumentTabularRegions({ structureReconstruction });
}

runTest("CONTROLE — Caso A: tabela densa (10 colunas) sem quebra de descrição forma uma única região com todas as linhas", () => {
  const result = detect(caseA_denseTableNoWrap, "case-a");
  const page = result.groups[0].pages[0];
  assertEqual(page.status, "detected");
  assertEqual(page.regions.length, 1);
  assertEqual(page.regions[0].lineKeys.length, 6);
  assertEqual(page.lineDispositions.every((d) => d.status === "included_in_candidate_region"), true);
});

runTest(
  "CARACTERIZAÇÃO DE DEFEITO — Caso B: duas quebras de descrição próximas (2 linhas de intervalo) eliminam quase toda a tabela da detecção " +
    "(esperado após correção: 1 região com as 8 linhas, ou ao menos 3 regiões cobrindo todas — hoje: 5 das 8 linhas nunca entram em nenhuma região)",
  () => {
    const result = detect(caseB_denseTableTwoWraps, "case-b");
    const page = result.groups[0].pages[0];
    assertEqual(page.regions.length, 1, "hoje sobrevive só o trecho final, sem quebra, longo o bastante");
    assertEqual(page.regions[0].lineKeys.length, 3);
    assertEqual(page.metrics.totalLineCount, 8);
    assertEqual(page.metrics.includedInCandidateRegionLineCount, 3, "hoje: 5 das 8 linhas físicas nunca entram em região alguma");
    assertEqual(page.lineDispositions.filter((d) => d.status === "not_in_tabular_region").length, 5);
  },
);

runTest(
  "CARACTERIZAÇÃO DE DEFEITO — Caso C: tabela SIMPLES de apenas 2 colunas também fragmenta com uma única quebra de descrição " +
    "(refuta a hipótese de que densidade de colunas é fator necessário) " +
    "(esperado após correção: 1 região com as 7 linhas — hoje: 2 regiões de 3, a linha de quebra excluída)",
  () => {
    const result = detect(caseC_simpleTableWithWrap, "case-c");
    const page = result.groups[0].pages[0];
    assertEqual(page.regions.length, 2);
    assertEqual(page.regions[0].lineKeys.length, 3);
    assertEqual(page.regions[1].lineKeys.length, 3);
    assertEqual(page.metrics.totalLineCount, 7);
    assertEqual(page.lineDispositions.filter((d) => d.status === "not_in_tabular_region").length, 1);
  },
);

runTest(
  "CARACTERIZAÇÃO DE DEFEITO — Caso D: tabela densa com exatamente UMA quebra isolada, geometria uniforme nas demais linhas " +
    "— a reprodução mínima controlada (esperado após correção: 1 região com as 7 linhas — hoje: 2 regiões de 3, a linha de quebra excluída)",
  () => {
    const result = detect(caseD_denseTableSingleCleanWrap, "case-d");
    const page = result.groups[0].pages[0];
    assertEqual(page.regions.length, 2);
    assertEqual(page.regions[0].lineKeys.length, 3);
    assertEqual(page.regions[1].lineKeys.length, 3);
    assertEqual(page.metrics.totalLineCount, 7);
    assertEqual(page.metrics.includedInCandidateRegionLineCount, 6);
  },
);

runTest(
  "CARACTERIZAÇÃO DE DEFEITO/LIMIAR — Caso E: sensibilidade exata da junção de linha física em f.1 (`minimumPairVerticalOverlapRatio: 0.5`, " +
    "`maximumPairCenterDistanceToMinimumHeightRatio: 0.5`, altura de item = 12pt) — o limiar algébrico exato é wrapStep = 6pt: " +
    "wrapStep >= 7 mantém 2 linhas físicas distintas (fragmenta em 2 regiões); wrapStep <= 6 funde as duas linhas físicas em uma só (nenhuma fragmentação)",
  () => {
    const aboveThreshold13 = detect(() => caseE_wrapStepVariant(13), "case-e-13");
    const aboveThreshold7 = detect(() => caseE_wrapStepVariant(7), "case-e-7");
    const atThreshold6 = detect(() => caseE_wrapStepVariant(6), "case-e-6");
    const belowThreshold3 = detect(() => caseE_wrapStepVariant(3), "case-e-3");

    assertEqual(aboveThreshold13.groups[0].pages[0].regions.length, 2, "wrapStep=13: linhas físicas distintas, fragmenta");
    assertEqual(aboveThreshold7.groups[0].pages[0].regions.length, 2, "wrapStep=7: ainda acima do limiar, fragmenta");
    assertEqual(atThreshold6.groups[0].pages[0].regions.length, 1, "wrapStep=6: exatamente no limiar, funde — não fragmenta");
    assertEqual(atThreshold6.groups[0].pages[0].metrics.totalLineCount, 6, "wrapStep=6: 6 linhas físicas (fundidas), não 7");
    assertEqual(belowThreshold3.groups[0].pages[0].regions.length, 1, "wrapStep=3: bem abaixo do limiar, funde — não fragmenta");
  },
);

runTest(
  "CARACTERIZAÇÃO DE DEFEITO — Caso F: uma linha esparsa LEGÍTIMA (só descrição, largura igual à de uma continuação de quebra, mas no " +
    "espaçamento vertical NORMAL entre linhas, nunca no espaçamento apertado de quebra) produz hoje a MESMA fragmentação que uma quebra real — " +
    "prova que f.2a não usa o espaçamento vertical como sinal distintivo, apenas a contagem de alinhamentos sustentados por linha " +
    "(esperado após correção: uma correção que apenas relaxe a exigência de alinhamentos por linha, sem considerar espaçamento, fundiria " +
    "indevidamente linhas esparsas legítimas com continuações de quebra — guarda-corpo para a Sprint de correção)",
  () => {
    const result = detect(caseF_denseTableWithLegitimateSparseRow, "case-f");
    const page = result.groups[0].pages[0];
    assertEqual(page.regions.length, 1);
    assertEqual(page.regions[0].lineKeys.length, 3);
    assertEqual(page.metrics.totalLineCount, 6);
    assertEqual(page.lineDispositions.filter((d) => d.status === "not_in_tabular_region").length, 3);
  },
);

runTest(
  "ESCOPO — Caso G: fixture de 'antes' para associação lógica de continuação de descrição — f.1/f.2a não têm hoje nenhum conceito de " +
    "'linha lógica' ou 'mesmo item orçamentário'; a região formada (ou fragmentada) é sobre linhas físicas apenas. A asserção de que a " +
    "linha de continuação deve associar-se ao mesmo item lógico pertence a uma camada futura (fora do escopo de f.1/f.2a e desta Sprint) " +
    "e deve ser reavaliada quando essa camada existir, usando esta mesma fixture como entrada",
  () => {
    const result = detect(caseG_legitimateContinuationFixture, "case-g");
    const page = result.groups[0].pages[0];
    assertEqual(page.regions.length, 2, "idêntico ao Caso D: mesma fixture, mesmo defeito hoje");
    const wrapLine = page.lineDispositions.find((d) => d.status === "not_in_tabular_region");
    assertEqual(wrapLine !== undefined, true, "a linha de continuação da descrição está hoje sempre fora de qualquer região");
  },
);

runTest("CONTROLE — Caso H: título externo largo entre dois blocos tabulares nunca funde os blocos nem entra em região", () => {
  const result = detect(caseH_externalTitleBetweenTabularBlocks, "case-h");
  const page = result.groups[0].pages[0];
  assertEqual(page.regions.length, 2, "dois blocos de 3 linhas permanecem separados — o título nunca faz ponte entre eles");
  assertEqual(page.regions[0].lineKeys.length, 3);
  assertEqual(page.regions[1].lineKeys.length, 3);
  const title = page.lineDispositions.find((d) => d.status === "not_in_tabular_region");
  assertEqual(title !== undefined, true, "o título permanece fora de qualquer região");
});

runTest("CONTROLE — Caso I: nota lateral fora do envelope horizontal das 10 colunas nunca corrompe a região nem é absorvida", () => {
  const result = detect(caseI_lateralNoteOutsideEnvelope, "case-i");
  const page = result.groups[0].pages[0];
  assertEqual(page.regions.length, 1);
  assertEqual(page.regions[0].lineKeys.length, 6);
  assertEqual(page.lineDispositions.every((d) => d.status === "included_in_candidate_region"), true, "a nota lateral vira um 11º segmento na mesma linha física, sem quebrar nenhuma coluna existente");
});

runTest(
  "ADVERSARIAL — Caso J: parágrafo comum cuja borda esquerda coincide por acidente com a coluna ITEM (espaçamento vertical NORMAL, " +
    "nunca apertado) permanece hoje corretamente fora da região — mas apenas como efeito colateral do defeito geral de fragmentação " +
    "(ver comentário do módulo: um discriminador puramente por assinatura de alinhamento absorveria isto incorretamente após corrigir B/D/F/K, " +
    "por ser geometricamente indistinguível do Caso F). Este teste deve ser reexecutado contra qualquer discriminador futuro antes de aprovar a correção.",
  () => {
    const result = detect(caseJ_accidentalSingleAlignmentParagraph, "case-j");
    const page = result.groups[0].pages[0];
    assertEqual(page.regions.length, 1, "hoje: só o trecho após o parágrafo forma região, efeito colateral do defeito geral — não uma exclusão deliberada");
    assertEqual(page.regions[0].lineKeys.length, 3);
    const paragraphLine = page.lineDispositions.find((d) => d.status === "not_in_tabular_region");
    assertEqual(paragraphLine !== undefined, true, "o parágrafo acidental está hoje fora de qualquer região");
  },
);

runTest("CONTROLE — Caso K: cabeçalho interno esparso (ITEM+DESCRICAO, largura de coluna cheia, espaçamento normal) já permanece corretamente incluído hoje", () => {
  const result = detect(caseK_sparseInternalHeader, "case-k");
  const page = result.groups[0].pages[0];
  assertEqual(page.regions.length, 1);
  assertEqual(page.regions[0].lineKeys.length, 6);
  assertEqual(page.lineDispositions.every((d) => d.status === "included_in_candidate_region"), true, "hoje já sustenta >=2 alinhamentos (ITEM+DESCRICAO largura cheia), portanto não quebra a janela — sorte geométrica, não regra deliberada");
});
