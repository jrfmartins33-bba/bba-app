/**
 * Pré-registro da correção aditiva de métricas (Sprint 21.4B.3A.3, Momento
 * 3C.1). Ver
 * `packages/bdos-core/docs/EPIC_21_SPRINT_4B3A3_MOMENTO3C1_METRIC_CORRECTION_PREREGISTRATION.md`
 * §2 e §9.
 *
 * Este arquivo NUNCA executa as funções v2 (todas ainda são stubs que
 * lançam erro — Momento 3C.2 não autorizado). Em vez disso:
 * (a) congela, como fixtures exportadas, os 9 casos sintéticos exigidos,
 *     com o resultado esperado calculado à mão e verificado aqui apenas
 *     com primitivas já congeladas do Momento 3A (`boxesOverlapStrictly`,
 *     `normalizeLocalReaderText`) ou com as próprias funções de
 *     classificação finais já congeladas (`classifyLocalReaderMultilineDescription`,
 *     `classifyLocalReaderMathEvidence`, `classifyLocalReaderViability`) —
 *     nenhuma delas é "nova implementação", todas já existiam e foram
 *     aprovadas antes desta etapa;
 * (b) confirma que cada stub v2 lança o erro "not implemented" hoje —
 *     uma afirmação verdadeira e verificável neste exato commit.
 *
 * O Momento 3C.2 deverá reutilizar estas mesmas fixtures ao testar a
 * implementação real v2, sem redefini-las depois de observar o
 * comportamento do código novo.
 */

import { boxesOverlapStrictly } from "../discovery-local-reader-comparison";
import { normalizeLocalReaderText } from "../discovery-local-reader-normalization";
import { classifyLocalReaderMathEvidence, classifyLocalReaderMultilineDescription } from "../discovery-local-reader-metrics";
import { classifyLocalReaderViability } from "../discovery-local-reader-viability";
import type { LocalReaderConvertedBoundingBox, LocalReaderExpectedRegionRef, LocalReaderObservedRegionRef, LocalReaderViabilityGateInputs } from "../discovery-local-reader-evaluation.types";
import { associateObservedRegionsToReferenceV2 } from "./discovery-local-reader-comparison-v2";
import { computeLocalReaderRegionTextMetricsV2 } from "./discovery-local-reader-metrics-v2";
import { deriveObservedDescriptionLinesV2 } from "./discovery-local-reader-multiline-v2";
import { deriveMathEvidenceFieldsV2 } from "./discovery-local-reader-math-evidence-v2";
import { deriveViabilityInputsV2 } from "./discovery-local-reader-viability-inputs-v2";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertThrows(fn: () => void, message: string): void {
  try {
    fn();
  } catch {
    return;
  }
  throw new Error(message);
}

const box = (leftPoints: number, topPoints: number, rightPoints: number, bottomPoints: number): LocalReaderConvertedBoundingBox => ({ leftPoints, topPoints, rightPoints, bottomPoints });

// --- §9, itens 1-3: componente N:1 (fixtures congeladas para o Momento 3C.2) ---

interface RegionMergeFixtureV2 {
  readonly description: string;
  readonly expectedRegions: ReadonlyArray<LocalReaderExpectedRegionRef>;
  readonly observedRegion: LocalReaderObservedRegionRef;
  readonly expectedComponentOutcome: "multiple_expected_regions_merged";
  readonly expectedRegionIdsWithExactTextualMatch: ReadonlyArray<string>;
  readonly expectedRegionIdsCoveredSpatiallyOnly: ReadonlyArray<string>;
}

const THREE_EXPECTED_REGIONS: ReadonlyArray<LocalReaderExpectedRegionRef> = [
  { id: "r1", realPageNumber: 46, normalizedText: "Texto Um", boundingBox: box(0, 0, 100, 20) },
  { id: "r2", realPageNumber: 46, normalizedText: "Texto Dois", boundingBox: box(0, 20, 100, 40) },
  { id: "r3", realPageNumber: 46, normalizedText: "Texto Tres", boundingBox: box(0, 40, 100, 60) },
];

export const REGION_V2_FIXTURE_CASE_1_MERGED_EMPTY_TEXT: RegionMergeFixtureV2 = {
  description: "item 1 — componente N:1 com sobreposição e texto vazio",
  expectedRegions: THREE_EXPECTED_REGIONS,
  observedRegion: { id: "o1", realPageNumber: 46, normalizedText: "", boundingBox: box(0, 0, 100, 60) },
  expectedComponentOutcome: "multiple_expected_regions_merged",
  expectedRegionIdsWithExactTextualMatch: [],
  expectedRegionIdsCoveredSpatiallyOnly: ["r1", "r2", "r3"],
};

export const REGION_V2_FIXTURE_CASE_2_MERGED_DIVERGENT_TEXT: RegionMergeFixtureV2 = {
  description: "item 2 — componente N:1 com texto divergente",
  expectedRegions: THREE_EXPECTED_REGIONS,
  observedRegion: { id: "o1", realPageNumber: 46, normalizedText: "Texto Diferente De Todas", boundingBox: box(0, 0, 100, 60) },
  expectedComponentOutcome: "multiple_expected_regions_merged",
  expectedRegionIdsWithExactTextualMatch: [],
  expectedRegionIdsCoveredSpatiallyOnly: ["r1", "r2", "r3"],
};

export const REGION_V2_FIXTURE_CASE_3_MERGED_ONE_TRUE_MATCH: RegionMergeFixtureV2 = {
  description: "item 3 — componente N:1 com pelo menos uma correspondência textual verdadeira",
  expectedRegions: THREE_EXPECTED_REGIONS,
  observedRegion: { id: "o1", realPageNumber: 46, normalizedText: "Texto Um", boundingBox: box(0, 0, 100, 60) },
  expectedComponentOutcome: "multiple_expected_regions_merged",
  expectedRegionIdsWithExactTextualMatch: ["r1"],
  expectedRegionIdsCoveredSpatiallyOnly: ["r2", "r3"],
};

const REGION_MERGE_FIXTURES_V2: ReadonlyArray<RegionMergeFixtureV2> = [
  REGION_V2_FIXTURE_CASE_1_MERGED_EMPTY_TEXT,
  REGION_V2_FIXTURE_CASE_2_MERGED_DIVERGENT_TEXT,
  REGION_V2_FIXTURE_CASE_3_MERGED_ONE_TRUE_MATCH,
];

REGION_MERGE_FIXTURES_V2.forEach((fixture) => {
  runTest(`Problema B/A (§4/§3) — ${fixture.description}: fatos brutos da fixture são geometricamente e textualmente consistentes (primitivas v1 já congeladas, nenhuma implementação v2 executada)`, () => {
    assertEqual(
      fixture.expectedRegionIdsWithExactTextualMatch.length + fixture.expectedRegionIdsCoveredSpatiallyOnly.length,
      fixture.expectedRegions.length,
      "toda região esperada da fixture deve estar em exatamente uma das duas categorias (auto-consistência da fixture)",
    );

    // Sobreposição espacial estrita (Problema B, passo de formação de aresta) — usa boxesOverlapStrictly, já congelada em v1.
    fixture.expectedRegions.forEach((r) => {
      assert(
        r.boundingBox !== null && boxesOverlapStrictly(r.boundingBox, fixture.observedRegion.boundingBox!),
        `${r.id}: deveria ter sobreposição espacial estrita com a região observada única (pré-condição para formar o componente N:1)`,
      );
    });

    // Correspondência textual real (Problema A, passo 3) — usa normalizeLocalReaderText, já congelada em v1.
    const observedNormalized = normalizeLocalReaderText(fixture.observedRegion.normalizedText);
    fixture.expectedRegions.forEach((r) => {
      const hasRealTextMatch = normalizeLocalReaderText(r.normalizedText) === observedNormalized;
      if (fixture.expectedRegionIdsWithExactTextualMatch.includes(r.id)) {
        assert(hasRealTextMatch, `${r.id}: fixture declara correspondência textual exata, mas o texto normalizado diverge`);
      } else {
        assert(!hasRealTextMatch, `${r.id}: fixture declara cobertura apenas espacial, mas o texto normalizado na verdade coincide`);
      }
    });
  });
});

// --- §9, item 4-5: descrições multilinha (usa classifyLocalReaderMultilineDescription, v1, já congelada) ---

runTest("Problema C (§5) — item 4: multilinha muda de 'omitted' (hoje, entrada [] hardcoded) para 'fully_preserved' quando linhas reais são fornecidas", () => {
  const expectedLines = ["Linha A da descrição", "Linha B da descrição"];

  const today = classifyLocalReaderMultilineDescription(expectedLines, [], false, null);
  assertEqual(today, "omitted", "comportamento hoje hardcoded em run-local-reader-evaluation.ts (entrada [] fixa)");

  const realObservedLines = ["Linha A da descrição", "Linha B da descrição"];
  const corrected = classifyLocalReaderMultilineDescription(expectedLines, realObservedLines, false, null);
  assertEqual(corrected, "fully_preserved", "com linhas observadas reais (derivação v2 pré-registrada em §5), o mesmo caso deveria classificar como completo");
});

runTest("Problema C (§5) — item 5: descrição parcial quando apenas uma das linhas esperadas foi recuperada", () => {
  const expectedLines = ["Linha A da descrição", "Linha B da descrição"];
  const realObservedLines = ["Linha A da descrição"]; // segunda célula em expected_cell_omitted
  const result = classifyLocalReaderMultilineDescription(expectedLines, realObservedLines, false, null);
  assertEqual(result, "partially_preserved");
});

// --- §9, item 6-8: evidência matemática (usa classifyLocalReaderMathEvidence, v1, já congelada) ---
// `fieldsPresent` é um Record completo das 4 chaves (não parcial — espelha a
// assinatura real de `classifyLocalReaderMathEvidence`). Estas 3 fixtures
// tratam os 4 campos como aplicáveis (ex. uma relação de nível de grupo,
// onde `subtotalOrTotal` genuinamente existe), contornando deliberadamente
// a ambiguidade de "campo não aplicável" registrada como pendência no §6
// do pré-registro — essa ambiguidade só afeta linhas `item_de_servico`
// sem `subtotalOrTotal`, não os 3 campos sempre aplicáveis.

runTest("Problema D (§6) — item 6: evidência matemática completa quando todos os campos aplicáveis vêm de direct_match", () => {
  const result = classifyLocalReaderMathEvidence("math-fixture-1", { quantity: true, unitPrice: true, total: true, subtotalOrTotal: true }, []);
  assertEqual(result.availability, "evidencia_completa");
});

runTest("Problema D (§6) — item 7: evidência matemática parcial quando um campo aplicável está ausente (expected_cell_omitted)", () => {
  const result = classifyLocalReaderMathEvidence("math-fixture-2", { quantity: true, unitPrice: false, total: true, subtotalOrTotal: true }, []);
  assertEqual(result.availability, "evidencia_parcial");
});

runTest("Problema D (§6) — item 8: evidência matemática divergente quando um campo tem correct_coordinate_wrong_text", () => {
  const result = classifyLocalReaderMathEvidence("math-fixture-3", { quantity: true, unitPrice: true, total: false, subtotalOrTotal: true }, ["total"]);
  assertEqual(result.availability, "evidencia_divergente_da_fonte");
});

// --- §9, item 9: viabilidade muda quando os insumos reais mudam (usa classifyLocalReaderViability, v1, já congelada) ---

runTest("Problema E (§7) — item 9: veredito de viabilidade muda de 'candidato_principal' para 'nao_viavel_nesta_configuracao' apenas por impedingInstability real mudar — a tabela de decisão em si (v1) não é alterada", () => {
  const baseInputs: LocalReaderViabilityGateInputs = {
    processedAllThreePages: true,
    inventedMonetaryValue: false,
    providedPhysicalOriginForCriticalFields: true,
    recoveredRequiredFieldsOf80Items: true,
    incorporatedTcuNoteAsItemOrValue: false,
    producedUsableTableCellStructure: true,
    ranOffline: true,
    reproducibleConfiguration: true,
    failedOnAnyPage: false,
    requiredNetworkOrExternalService: false,
    impedingInstability: false,
    providedRelevantTraceableComplementaryEvidence: false,
  };

  const withoutInstability = classifyLocalReaderViability(baseInputs);
  assertEqual(withoutInstability.classification, "candidato_principal");

  const withInstability = classifyLocalReaderViability({ ...baseInputs, impedingInstability: true });
  assertEqual(withInstability.classification, "nao_viavel_nesta_configuracao");
});

// --- Confirmação de que as 5 funções v2 são stubs hoje (Momento 3C.2 ainda não autorizado) ---

runTest("stubs v2: associateObservedRegionsToReferenceV2 lança 'not implemented' hoje", () => {
  assertThrows(() => associateObservedRegionsToReferenceV2([], []), "deveria lançar até o Momento 3C.2 ser implementado");
});

runTest("stubs v2: computeLocalReaderRegionTextMetricsV2 lança 'not implemented' hoje", () => {
  assertThrows(() => computeLocalReaderRegionTextMetricsV2([]), "deveria lançar até o Momento 3C.2 ser implementado");
});

runTest("stubs v2: deriveObservedDescriptionLinesV2 lança 'not implemented' hoje", () => {
  assertThrows(() => deriveObservedDescriptionLinesV2({} as never, "row-x", []), "deveria lançar até o Momento 3C.2 ser implementado");
});

runTest("stubs v2: deriveMathEvidenceFieldsV2 lança 'not implemented' hoje", () => {
  assertThrows(() => deriveMathEvidenceFieldsV2({} as never, [], {} as never), "deveria lançar até o Momento 3C.2 ser implementado");
});

runTest("stubs v2: deriveViabilityInputsV2 lança 'not implemented' hoje", () => {
  assertThrows(() => deriveViabilityInputsV2({} as never), "deveria lançar até o Momento 3C.2 ser implementado");
});
