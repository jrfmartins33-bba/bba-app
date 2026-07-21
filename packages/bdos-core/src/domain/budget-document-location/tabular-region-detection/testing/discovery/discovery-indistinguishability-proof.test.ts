import { buildTabularRegionDetectionFixture } from "../tabular-region-detection-test-bridge";
import { detectBudgetDocumentTabularRegionsWithDependencies } from "../../detect-budget-document-tabular-regions";
import type { TabularRegionDetectionDependencies } from "../../detect-budget-document-tabular-regions";
import { observeVerticalAlignments, buildAlignmentCandidateSegments } from "../../vertical-alignment-observation";
import { formTabularRegionCandidateWindows } from "../../tabular-region-formation";
import type { RegionFormationAlignment, RegionFormationLine } from "../../tabular-region-formation";
import { INDISTINGUISHABILITY_PAIRS } from "./discovery-case-matrix";
import {
  buildHelperLevelWindowEvidence,
  extractTargetLineFingerprint,
  fingerprintsEqual,
  buildTargetLineSegmentFacts,
} from "./discovery-evidence-representation";

/**
 * Prova de indistinguibilidade LOCAL DA LINHA-ALVO, executável (Sprint
 * 21.4B.3A, §8 do enunciado) — primeira verificação, ANTES de qualquer
 * algoritmo candidato. Executa a cadeia real (reconstrução + detecção
 * atual) sobre os pares pré-registrados em `INDISTINGUISHABILITY_PAIRS` e
 * demonstra, por execução real (nunca por leitura de comentário
 * histórico), que:
 *
 * 1. No nível do contrato ATUAL do helper (`formTabularRegionCandidateWindows`),
 *    o FINGERPRINT CANÔNICO DA LINHA-ALVO especificamente (posição
 *    relativa dentro da janela + extents de alinhamento relativos à sua
 *    própria posição — ver `extractTargetLineFingerprint`) é IDÊNTICO
 *    entre a linha positiva e a negativa de cada par.
 * 2. Ao ampliar a evidência para o nível da capacidade completa (geometria
 *    de segmento, já calculada por `detectPage` antes da chamada ao
 *    helper, mas descartada), essa igualdade se desfaz.
 *
 * CORREÇÃO (commit `docs(architecture): correct tabular discovery
 * evidence claims`): a versão original desta Sprint (commit `764a62c`)
 * afirmava que isso provava "que nenhuma função determinística limitada
 * a essa evidência pode distingui-las" — uma afirmação mais forte do que
 * o que foi de fato executado. O que foi comparado é apenas o
 * FINGERPRINT DA LINHA-ALVO (uma fatia da evidência: sua própria posição
 * relativa e os extents de alinhamento que ela sustenta, relativos a
 * si mesma) — nunca a representação canônica INTEGRAL de todo o
 * contrato recebido pelo helper (todas as linhas da janela, todos os
 * alinhamentos, módulo renomeação de `lineKey`/`alignmentKey`). É
 * inteiramente possível que uma função que examine a evidência de OUTRAS
 * linhas da janela (não apenas a linha-alvo) distinga os dois casos
 * mesmo com o fingerprint da linha-alvo idêntico — isso nunca foi testado
 * aqui. A afirmação correta e mais restrita: **a evidência
 * especificamente atribuível à linha-alvo, no nível do helper atual, é
 * insuficiente para decidir sobre ELA MESMA** — nunca que o contrato
 * inteiro da janela seja indistinguível.
 *
 * Nenhum algoritmo candidato de decisão é definido aqui — apenas
 * extração e comparação de fatos observáveis.
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

interface CapturedHelperCall {
  readonly lines: ReadonlyArray<RegionFormationLine>;
  readonly alignments: ReadonlyArray<RegionFormationAlignment>;
}

function buildCapturingDependencies(sink: { call: CapturedHelperCall | null }): TabularRegionDetectionDependencies {
  return {
    observeAlignments: observeVerticalAlignments,
    formRegions: (lines, alignments, profile) => {
      sink.call = { lines: [...lines], alignments: [...alignments] };
      return formTabularRegionCandidateWindows(lines, alignments, profile);
    },
  };
}

INDISTINGUISHABILITY_PAIRS.forEach((pair) => {
  runTest(`${pair.pairId}: nível helper — representação canônica da linha-alvo positiva e negativa é IDÊNTICA (H0 confirmada neste nível)`, () => {
    const positiveStructure = buildTabularRegionDetectionFixture(`${pair.pairId}-positive`, [pair.positive.buildPage()]);
    const negativeStructure = buildTabularRegionDetectionFixture(`${pair.pairId}-negative`, [pair.negative.buildPage()]);
    assertEqual(positiveStructure.status, "completed", "pré-condição: reconstrução estrutural positiva deve concluir sem falha");
    assertEqual(negativeStructure.status, "completed", "pré-condição: reconstrução estrutural negativa deve concluir sem falha");

    const positiveSink: { call: CapturedHelperCall | null } = { call: null };
    const negativeSink: { call: CapturedHelperCall | null } = { call: null };
    detectBudgetDocumentTabularRegionsWithDependencies({ structureReconstruction: positiveStructure }, buildCapturingDependencies(positiveSink));
    detectBudgetDocumentTabularRegionsWithDependencies({ structureReconstruction: negativeStructure }, buildCapturingDependencies(negativeSink));

    assert(positiveSink.call !== null, "chamada ao helper não capturada (positivo)");
    assert(negativeSink.call !== null, "chamada ao helper não capturada (negativo)");

    const positivePage = positiveStructure.groups[0].pages[0];
    const negativePage = negativeStructure.groups[0].pages[0];
    const positiveItems = pair.positive.buildPage().items;
    const negativeItems = pair.negative.buildPage().items;

    const positiveItemIndex = positiveItems.findIndex((item) => item.text === pair.positive.targetLineSourceText);
    const negativeItemIndex = negativeItems.findIndex((item) => item.text === pair.negative.targetLineSourceText);
    assert(positiveItemIndex >= 0, "item-alvo positivo não encontrado na página construída");
    assert(negativeItemIndex >= 0, "item-alvo negativo não encontrado na página construída");

    const positiveLine = positivePage.lines.find((line) => line.sourceTextItemIndices.includes(positiveItemIndex));
    const negativeLine = negativePage.lines.find((line) => line.sourceTextItemIndices.includes(negativeItemIndex));
    assert(positiveLine !== undefined, "linha física positiva não localizada");
    assert(negativeLine !== undefined, "linha física negativa não localizada");

    const positiveOrderedKeys = [...positiveSink.call!.lines].sort((a, b) => a.verticalOrder - b.verticalOrder).map((l) => l.lineKey);
    const negativeOrderedKeys = [...negativeSink.call!.lines].sort((a, b) => a.verticalOrder - b.verticalOrder).map((l) => l.lineKey);

    const positiveTargetIndex = positiveOrderedKeys.indexOf(positiveLine!.lineKey);
    const negativeTargetIndex = negativeOrderedKeys.indexOf(negativeLine!.lineKey);
    assert(positiveTargetIndex >= 0, "linha-alvo positiva ausente da chamada capturada ao helper");
    assert(negativeTargetIndex >= 0, "linha-alvo negativa ausente da chamada capturada ao helper");

    const positiveEvidence = buildHelperLevelWindowEvidence(positiveOrderedKeys, positiveSink.call!.alignments);
    const negativeEvidence = buildHelperLevelWindowEvidence(negativeOrderedKeys, negativeSink.call!.alignments);

    const positiveFingerprint = extractTargetLineFingerprint(positiveEvidence, positiveTargetIndex);
    const negativeFingerprint = extractTargetLineFingerprint(negativeEvidence, negativeTargetIndex);

    assert(
      fingerprintsEqual(positiveFingerprint, negativeFingerprint),
      `${pair.pairId}: esperava representação canônica IDÊNTICA no nível do helper (prova de indistinguibilidade) — ` +
        `positivo=${JSON.stringify(positiveFingerprint)} negativo=${JSON.stringify(negativeFingerprint)}`,
    );
  });

  runTest(`${pair.pairId}: nível capacidade completa — largura de segmento da linha-alvo DIFERE entre positivo e negativo (H0 refutada neste nível mais amplo)`, () => {
    const positiveStructure = buildTabularRegionDetectionFixture(`${pair.pairId}-positive-seg`, [pair.positive.buildPage()]);
    const negativeStructure = buildTabularRegionDetectionFixture(`${pair.pairId}-negative-seg`, [pair.negative.buildPage()]);

    const positivePage = positiveStructure.groups[0].pages[0];
    const negativePage = negativeStructure.groups[0].pages[0];
    const positiveItems = pair.positive.buildPage().items;
    const negativeItems = pair.negative.buildPage().items;

    const positiveItemIndex = positiveItems.findIndex((item) => item.text === pair.positive.targetLineSourceText);
    const negativeItemIndex = negativeItems.findIndex((item) => item.text === pair.negative.targetLineSourceText);
    const positiveLine = positivePage.lines.find((line) => line.sourceTextItemIndices.includes(positiveItemIndex))!;
    const negativeLine = negativePage.lines.find((line) => line.sourceTextItemIndices.includes(negativeItemIndex))!;

    const positiveSegments = buildAlignmentCandidateSegments(positivePage.lines, positivePage.segments).filter((s) => s.lineKey === positiveLine.lineKey);
    const negativeSegments = buildAlignmentCandidateSegments(negativePage.lines, negativePage.segments).filter((s) => s.lineKey === negativeLine.lineKey);

    const positiveFacts = buildTargetLineSegmentFacts(positiveSegments);
    const negativeFacts = buildTargetLineSegmentFacts(negativeSegments);

    assert(
      positiveFacts.widthToLineHeightRatio !== negativeFacts.widthToLineHeightRatio,
      `${pair.pairId}: esperava largura normalizada DIFERENTE entre positivo (${positiveFacts.widthToLineHeightRatio}) e negativo (${negativeFacts.widthToLineHeightRatio}) — ` +
        `se fossem iguais, a evidência de largura também seria insuficiente para este par`,
    );
  });
});
