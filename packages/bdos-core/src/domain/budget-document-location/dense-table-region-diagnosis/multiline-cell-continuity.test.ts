import { buildTabularRegionDetectionFixture } from "../tabular-region-detection/testing/tabular-region-detection-test-bridge";
import { detectBudgetDocumentTabularRegions } from "../tabular-region-detection/detect-budget-document-tabular-regions";
import type { BudgetDocumentTabularRegionDetectionResult } from "../tabular-region-detection/budget-document-tabular-region-detection.types";
import type { SyntheticGeometryPage } from "../structure-reconstruction/testing/structure-reconstruction-test-bridge";
import {
  caseL1_singleTightContinuation,
  caseL2_twoConsecutiveTightContinuations,
  caseL3_threeConsecutiveTightContinuations,
  caseL4_boundaryProbeContinuation,
  caseL5_normalSubsequentRow,
  caseL6_externalParagraphNormalSpacing,
  caseL7_externalParagraphTightSpacing,
  caseL8_externalTitleTightSpacing,
  caseL9_lateralNoteTightSpacing,
  caseL10_twoLegitimateTabularRowsVeryClose,
  caseL11_tightLineBeforeTableStart,
  caseL12_tightLineAfterTableEnd,
} from "./multiline-cell-continuity-fixtures";

/**
 * Diagnóstico da Sprint 21.4B.2 (Continuidade Tipográfica de Células
 * Multilinha) — geometria sintética genérica, nunca o caso real Lagoa do
 * Arroz. Matriz L1-L12 per mandato.
 *
 * Nenhuma correção de produção foi implementada nesta Sprint (ver
 * relatório final: `tabular-region-formation.ts` permanece idêntico à
 * `main`). Um spike de investigação (ponte de continuidade com evidência
 * vertical — `topPoints`/`bottomPoints`/`heightPoints` propagados de f.1,
 * razão de intervalo normalizada, subconjunto de alinhamentos, varredura
 * de linhas esparsas consecutivas, reconfirmação real) corrigiu
 * corretamente L1, L2, L4 e L5, mas falhou de duas formas decisivas:
 *
 * 1. Caso L3 (três continuações consecutivas): as três continuações,
 *    sendo idênticas, satisfazem sozinhas `minimumLinesSustainingAlignment`
 *    e formam seu próprio alinhamento privado (borda direita/centro),
 *    criando uma janela concorrente que conflita com a janela correta e
 *    ambiguiza a página inteira.
 * 2. Caso L7 (ADVERSARIAL, obrigatório permanecer fora): um parágrafo
 *    externo deliberadamente apertado, cuja borda esquerda coincide por
 *    acidente com uma coluna real, é estrutural e geometricamente
 *    IDÊNTICO a uma continuação legítima sob qualquer combinação de
 *    evidência vertical mínima (intervalo normalizado, subconjunto de
 *    alinhamentos, reconfirmação) — foi incorretamente absorvido pelo
 *    spike. Distingui-lo exigiria conhecimento do envelope/grade de
 *    colunas, explicitamente fora do escopo autorizado desta Sprint.
 *
 * Por instrução explícita ("Se o Caso L7... continuar indistinguível...
 * não implemente essa expansão sem nova autorização"), o spike foi
 * revertido por completo. Os testes abaixo travam o comportamento ATUAL
 * (o mesmo de antes desta Sprint) — nunca o comportamento defeituoso como
 * contrato final; ver relatório para a proposta de escalonamento
 * arquitetural.
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

function detect(pageBuilder: () => SyntheticGeometryPage, label: string): BudgetDocumentTabularRegionDetectionResult {
  const structureReconstruction = buildTabularRegionDetectionFixture(label, [pageBuilder()]);
  assertEqual(structureReconstruction.status, "completed");
  return detectBudgetDocumentTabularRegions({ structureReconstruction });
}

runTest(
  "CARACTERIZAÇÃO — L1: continuação apertada única entre 3+3 linhas completas fragmenta em 2 regiões, continuação excluída " +
    "(esperado após correção: 1 região com as 7 linhas)",
  () => {
    const page = detect(caseL1_singleTightContinuation, "l1").groups[0].pages[0];
    assertEqual(page.regions.length, 2);
    assertEqual(page.metrics.totalLineCount, 7);
    assertEqual(page.metrics.includedInCandidateRegionLineCount, 6);
  },
);

runTest(
  "CARACTERIZAÇÃO — L2: duas continuações consecutivas fragmentam em 2 regiões, ambas excluídas " +
    "(esperado após correção: 1 região com as 8 linhas)",
  () => {
    const page = detect(caseL2_twoConsecutiveTightContinuations, "l2").groups[0].pages[0];
    assertEqual(page.regions.length, 2);
    assertEqual(page.metrics.totalLineCount, 8);
    assertEqual(page.metrics.includedInCandidateRegionLineCount, 6);
  },
);

runTest(
  "CARACTERIZAÇÃO — L3: três continuações consecutivas idênticas formam sua PRÓPRIA região privada (alinhamento local às 3 " +
    "continuações) entre as duas regiões de dados — 3 regiões, todas as 9 linhas tecnicamente 'incluídas', mas nenhuma delas " +
    "unificada como a mesma tabela (esperado após correção: 1 região com as 9 linhas)",
  () => {
    const page = detect(caseL3_threeConsecutiveTightContinuations, "l3").groups[0].pages[0];
    assertEqual(page.regions.length, 3);
    assertEqual(page.metrics.totalLineCount, 9);
    assertEqual(page.metrics.includedInCandidateRegionLineCount, 9);
  },
);

runTest(
  "CARACTERIZAÇÃO — L4: sonda de fronteira (intervalo positivo pequeno) fragmenta em 2 regiões, mesma assinatura de L1 " +
    "(esperado após correção: 1 região com as 7 linhas)",
  () => {
    const page = detect(caseL4_boundaryProbeContinuation, "l4").groups[0].pages[0];
    assertEqual(page.regions.length, 2);
    assertEqual(page.metrics.totalLineCount, 7);
    assertEqual(page.metrics.includedInCandidateRegionLineCount, 6);
  },
);

runTest("CONTROLE — L5: linha normal subsequente, sem quebra nenhuma, já forma 1 região corretamente", () => {
  const page = detect(caseL5_normalSubsequentRow, "l5").groups[0].pages[0];
  assertEqual(page.regions.length, 1);
  assertEqual(page.regions[0].lineKeys.length, 4);
});

runTest("CONTROLE — L6: parágrafo externo com espaçamento NORMAL já permanece corretamente fora hoje", () => {
  const page = detect(caseL6_externalParagraphNormalSpacing, "l6").groups[0].pages[0];
  assertEqual(page.regions.length, 2);
  assertEqual(page.metrics.includedInCandidateRegionLineCount, 6);
});

runTest(
  "ADVERSARIAL — L7: parágrafo externo deliberadamente APERTADO (mesma assinatura geométrica de uma continuação real) permanece " +
    "hoje corretamente fora, mas apenas como efeito colateral da fragmentação geral (Categoria 2, herdada da 21.4B.1) — " +
    "um spike testado nesta Sprint (evidência vertical mínima: intervalo normalizado + subconjunto de alinhamentos + " +
    "reconfirmação) absorveu este caso incorretamente após corrigir L1/L2/L4 (ver relatório) — nenhuma correção foi mantida",
  () => {
    const page = detect(caseL7_externalParagraphTightSpacing, "l7").groups[0].pages[0];
    assertEqual(page.regions.length, 2, "hoje: mesma fragmentação de L1/L4, o parágrafo fica no meio excluído por efeito colateral");
    assertEqual(page.metrics.includedInCandidateRegionLineCount, 6);
  },
);

runTest("CONTROLE — L8: título externo apertado já permanece corretamente fora hoje (zero alinhamentos)", () => {
  const page = detect(caseL8_externalTitleTightSpacing, "l8").groups[0].pages[0];
  assertEqual(page.regions.length, 2);
  assertEqual(page.metrics.includedInCandidateRegionLineCount, 6);
});

runTest("CONTROLE — L9: nota lateral apertada, fora do envelope horizontal, já permanece corretamente fora hoje", () => {
  const page = detect(caseL9_lateralNoteTightSpacing, "l9").groups[0].pages[0];
  assertEqual(page.regions.length, 2);
  assertEqual(page.metrics.includedInCandidateRegionLineCount, 6);
});

runTest("CONTROLE — L10: duas linhas tabulares legítimas muito próximas já permanecem corretamente como 2 linhas físicas na mesma região hoje", () => {
  const page = detect(caseL10_twoLegitimateTabularRowsVeryClose, "l10").groups[0].pages[0];
  assertEqual(page.regions.length, 1);
  assertEqual(page.regions[0].lineKeys.length, 4);
});

runTest("CONTROLE — L11: linha apertada antes do início da tabela (sem predecessor tabular válido) já permanece corretamente fora hoje", () => {
  const page = detect(caseL11_tightLineBeforeTableStart, "l11").groups[0].pages[0];
  assertEqual(page.regions.length, 1);
  assertEqual(page.regions[0].lineKeys.length, 3);
  assertEqual(page.metrics.includedInCandidateRegionLineCount, 3);
});

runTest("CONTROLE — L12: linha apertada depois do fim da tabela (sem reconfirmação posterior) já permanece corretamente fora hoje", () => {
  const page = detect(caseL12_tightLineAfterTableEnd, "l12").groups[0].pages[0];
  assertEqual(page.regions.length, 1);
  assertEqual(page.regions[0].lineKeys.length, 3);
  assertEqual(page.metrics.includedInCandidateRegionLineCount, 3);
});
