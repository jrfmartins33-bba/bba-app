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
 * Prova de indistinguibilidade executável (Sprint 21.4B.3A, §8 do
 * enunciado) — primeira verificação, ANTES de qualquer algoritmo
 * candidato. Executa a cadeia real (reconstrução + detecção atual) sobre
 * os pares pré-registrados em `INDISTINGUISHABILITY_PAIRS` e demonstra,
 * por execução real (nunca por leitura de comentário histórico), que:
 *
 * 1. No nível do contrato ATUAL do helper (`formTabularRegionCandidateWindows`),
 *    a linha positiva e a linha negativa de cada par produzem
 *    representação canônica IDÊNTICA — nenhuma função determinística
 *    limitada a essa evidência pode distingui-las.
 * 2. Ao ampliar a evidência para o nível da capacidade completa (geometria
 *    de segmento, já calculada por `detectPage` antes da chamada ao
 *    helper, mas descartada), a igualdade se desfaz — refutando H0 nesse
 *    nível mais amplo e habilitando H1/H3 como candidatas viáveis.
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
