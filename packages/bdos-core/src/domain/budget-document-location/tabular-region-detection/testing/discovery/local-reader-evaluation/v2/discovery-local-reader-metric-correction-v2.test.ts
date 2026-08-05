/**
 * Pré-registro da correção aditiva de métricas (Sprint 21.4B.3A.3,
 * Momentos 3C.1, 3C.1A e 3C.1B). Ver
 * `EPIC_21_SPRINT_4B3A3_MOMENTO3C1_METRIC_CORRECTION_PREREGISTRATION.md`
 * §2 e §9, `EPIC_21_SPRINT_4B3A3_MOMENTO3C1A_MATH_APPLICABILITY_AND_CELL_PROVENANCE_ADDENDUM.md`
 * §4, e `EPIC_21_SPRINT_4B3A3_MOMENTO3C1B_FINAL_V2_CONTRACT_ADDENDUM.md`
 * §1-§3.
 *
 * Este arquivo NUNCA executa as funções v2 (todas ainda são stubs que
 * lançam erro — Momento 3C.2 não autorizado). Em vez disso:
 * (a) congela, como fixtures exportadas, os casos sintéticos exigidos em
 *     cada Momento, com o resultado esperado calculado à mão e verificado
 *     aqui apenas com primitivas já congeladas do Momento 3A
 *     (`boxesOverlapStrictly`, `normalizeLocalReaderText`), com as
 *     próprias funções de classificação finais já congeladas
 *     (`classifyLocalReaderMultilineDescription`,
 *     `classifyLocalReaderMathEvidence`, `classifyLocalReaderViability`),
 *     ou por auto-consistência contra os próprios dados da fixture —
 *     nenhuma delas é "nova implementação v2";
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
import { classifyLocalReaderMathEvidenceV2, deriveMathEvidenceFieldStatesV2, deriveMathEvidenceFieldsV2 } from "./discovery-local-reader-math-evidence-v2";
import { deriveViabilityInputsV2 } from "./discovery-local-reader-viability-inputs-v2";
import type { LocalReaderMathEvidenceDerivationIntegrityErrorV2, LocalReaderMathEvidenceFieldStatesV2 } from "./discovery-local-reader-evaluation-v2.types";
import type { LocalReaderMathEvidenceAvailability } from "../discovery-local-reader-evaluation.types";
import type { ReferenceTruthMathRelation } from "../../reference-truth/discovery-reference-truth.types";

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
// a ambiguidade de "campo não aplicável" — resolvida no Momento 3C.1A (ver
// EPIC_21_SPRINT_4B3A3_MOMENTO3C1A_MATH_APPLICABILITY_AND_CELL_PROVENANCE_ADDENDUM.md
// §1-§4, que introduz o modelo de 4 estados testado na seção "Momento
// 3C.1A" mais abaixo). Estas 3 fixtures continuam válidas porque tratam os
// 4 campos como aplicáveis, caso em que o Record booleano nunca foi
// ambíguo — a ambiguidade só afeta linhas `item_de_servico` sem
// `subtotalOrTotal`.

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

// ============================================================================
// Momento 3C.1A — adendo: aplicabilidade de evidência matemática (4 estados)
// Ver EPIC_21_SPRINT_4B3A3_MOMENTO3C1A_MATH_APPLICABILITY_AND_CELL_PROVENANCE_ADDENDUM.md
// §1-§4. Resolve a ambiguidade registrada como pendência no §6 do
// pré-registro original — nunca adota "sempre true", "sempre false" ou
// alternância artificial. classifyLocalReaderMathEvidenceV2 é stub (não
// executado); as 7 fixtures abaixo são dados declarativos, nunca
// calculados chamando o stub.
// ============================================================================

// Rótulos em português — espelham exatamente MATH_EVIDENCE_FIELD_LABELS_PT
// (v1, discovery-local-reader-metrics.ts, inalterado), reaproveitados aqui
// apenas como literais de dados (nenhum import de função v1 necessário).
const MATH_EVIDENCE_FIELD_LABELS_PT_V2: Record<keyof LocalReaderMathEvidenceFieldStatesV2, string> = {
  quantity: "quantidade",
  unitPrice: "preço unitário",
  total: "total",
  subtotalOrTotal: "subtotal ou total oficial aplicável",
};

interface MathEvidenceFixtureV2 {
  readonly description: string;
  readonly fieldStates: LocalReaderMathEvidenceFieldStatesV2;
  readonly expectedResult: LocalReaderMathEvidenceAvailability | "integrity_error_no_applicable_field";
  /** `null` apenas para o caso de erro de integridade (item 7) — sem resultado de disponibilidade, as duas listas não se aplicam. */
  readonly expectedMissingFieldsPt: ReadonlyArray<string> | null;
  readonly expectedDivergentFieldsPt: ReadonlyArray<string> | null;
}

const VALID_MATH_EVIDENCE_STATES = ["not_applicable", "present", "missing", "divergent"] as const;
const VALID_MATH_EVIDENCE_RESULTS = ["evidencia_completa", "evidencia_parcial", "evidencia_ausente", "evidencia_divergente_da_fonte", "integrity_error_no_applicable_field"] as const;

export const MATH_EVIDENCE_V2_FIXTURE_1_ITEM_NO_EVIDENCE: MathEvidenceFixtureV2 = {
  description: "item 1 (§4/3C.1A, §3/3C.1B) — item de serviço sem evidência",
  fieldStates: { quantity: "missing", unitPrice: "missing", total: "missing", subtotalOrTotal: "not_applicable" },
  expectedResult: "evidencia_ausente",
  expectedMissingFieldsPt: ["quantidade", "preço unitário", "total"],
  expectedDivergentFieldsPt: [],
};

export const MATH_EVIDENCE_V2_FIXTURE_2_ITEM_COMPLETE: MathEvidenceFixtureV2 = {
  description: "item 2 (§4/3C.1A) — item de serviço completo",
  fieldStates: { quantity: "present", unitPrice: "present", total: "present", subtotalOrTotal: "not_applicable" },
  expectedResult: "evidencia_completa",
  expectedMissingFieldsPt: [],
  expectedDivergentFieldsPt: [],
};

export const MATH_EVIDENCE_V2_FIXTURE_3_ITEM_PARTIAL: MathEvidenceFixtureV2 = {
  description: "item 3 (§4/3C.1A, §3/3C.1B) — item de serviço parcial",
  fieldStates: { quantity: "present", unitPrice: "present", total: "missing", subtotalOrTotal: "not_applicable" },
  expectedResult: "evidencia_parcial",
  expectedMissingFieldsPt: ["total"],
  expectedDivergentFieldsPt: [],
};

export const MATH_EVIDENCE_V2_FIXTURE_4_ITEM_DIVERGENT: MathEvidenceFixtureV2 = {
  description: "item 4 (§4/3C.1A, §3/3C.1B) — item de serviço divergente",
  fieldStates: { quantity: "present", unitPrice: "divergent", total: "present", subtotalOrTotal: "not_applicable" },
  expectedResult: "evidencia_divergente_da_fonte",
  expectedMissingFieldsPt: [],
  expectedDivergentFieldsPt: ["preço unitário"],
};

export const MATH_EVIDENCE_V2_FIXTURE_5_GROUP_COMPLETE: MathEvidenceFixtureV2 = {
  description: "item 5 (§4/3C.1A, §3/3C.1B) — grupo completo",
  fieldStates: { quantity: "not_applicable", unitPrice: "not_applicable", total: "not_applicable", subtotalOrTotal: "present" },
  expectedResult: "evidencia_completa",
  expectedMissingFieldsPt: [],
  expectedDivergentFieldsPt: [],
};

export const MATH_EVIDENCE_V2_FIXTURE_6_GROUP_MISSING: MathEvidenceFixtureV2 = {
  description: "item 6 (§4/3C.1A, §3/3C.1B) — grupo ausente",
  fieldStates: { quantity: "not_applicable", unitPrice: "not_applicable", total: "not_applicable", subtotalOrTotal: "missing" },
  expectedResult: "evidencia_ausente",
  expectedMissingFieldsPt: ["subtotal ou total oficial aplicável"],
  expectedDivergentFieldsPt: [],
};

export const MATH_EVIDENCE_V2_FIXTURE_7_NO_APPLICABLE_FIELD: MathEvidenceFixtureV2 = {
  description: "item 7 (§4/3C.1A) — relação sem campo aplicável",
  fieldStates: { quantity: "not_applicable", unitPrice: "not_applicable", total: "not_applicable", subtotalOrTotal: "not_applicable" },
  expectedResult: "integrity_error_no_applicable_field",
  expectedMissingFieldsPt: null,
  expectedDivergentFieldsPt: null,
};

const MATH_EVIDENCE_V2_FIXTURES: ReadonlyArray<MathEvidenceFixtureV2> = [
  MATH_EVIDENCE_V2_FIXTURE_1_ITEM_NO_EVIDENCE,
  MATH_EVIDENCE_V2_FIXTURE_2_ITEM_COMPLETE,
  MATH_EVIDENCE_V2_FIXTURE_3_ITEM_PARTIAL,
  MATH_EVIDENCE_V2_FIXTURE_4_ITEM_DIVERGENT,
  MATH_EVIDENCE_V2_FIXTURE_5_GROUP_COMPLETE,
  MATH_EVIDENCE_V2_FIXTURE_6_GROUP_MISSING,
  MATH_EVIDENCE_V2_FIXTURE_7_NO_APPLICABLE_FIELD,
];

MATH_EVIDENCE_V2_FIXTURES.forEach((fixture) => {
  runTest(`Momento 3C.1A/3C.1B — ${fixture.description}: fixture bem formada (4 estados válidos, resultado esperado é um dos 5 valores possíveis) — nenhuma implementação v2 executada`, () => {
    (Object.keys(fixture.fieldStates) as Array<keyof LocalReaderMathEvidenceFieldStatesV2>).forEach((key) => {
      assert(
        (VALID_MATH_EVIDENCE_STATES as readonly string[]).includes(fixture.fieldStates[key]),
        `${fixture.description}: estado inválido para "${key}": "${fixture.fieldStates[key]}"`,
      );
    });
    assert(
      (VALID_MATH_EVIDENCE_RESULTS as readonly string[]).includes(fixture.expectedResult),
      `${fixture.description}: expectedResult inválido: "${fixture.expectedResult}"`,
    );

    const applicableCount = Object.values(fixture.fieldStates).filter((s) => s !== "not_applicable").length;
    if (fixture.expectedResult === "integrity_error_no_applicable_field") {
      assertEqual(applicableCount, 0, `${fixture.description}: erro de integridade esperado apenas quando 0 campos são aplicáveis`);
    } else {
      assert(applicableCount > 0, `${fixture.description}: resultado de disponibilidade esperado exige ao menos 1 campo aplicável`);
    }
  });
});

// --- Momento 3C.1B §3: as duas listas auditáveis, verificadas por
// auto-consistência contra o fieldStates da própria fixture — nunca
// calculadas chamando classifyLocalReaderMathEvidenceV2 (stub). Cobre
// exatamente os 5 casos exigidos: item ausente, item parcial, item
// divergente, grupo completo, grupo ausente.
[
  MATH_EVIDENCE_V2_FIXTURE_1_ITEM_NO_EVIDENCE,
  MATH_EVIDENCE_V2_FIXTURE_3_ITEM_PARTIAL,
  MATH_EVIDENCE_V2_FIXTURE_4_ITEM_DIVERGENT,
  MATH_EVIDENCE_V2_FIXTURE_5_GROUP_COMPLETE,
  MATH_EVIDENCE_V2_FIXTURE_6_GROUP_MISSING,
].forEach((fixture) => {
  runTest(`Momento 3C.1B (§3) — ${fixture.description}: missingFieldsPt/divergentFieldsPt consistentes com fieldStates (apenas campos aplicáveis; not_applicable nunca aparece)`, () => {
    const expectedMissing = (Object.keys(fixture.fieldStates) as Array<keyof LocalReaderMathEvidenceFieldStatesV2>)
      .filter((k) => fixture.fieldStates[k] === "missing")
      .map((k) => MATH_EVIDENCE_FIELD_LABELS_PT_V2[k]);
    const expectedDivergent = (Object.keys(fixture.fieldStates) as Array<keyof LocalReaderMathEvidenceFieldStatesV2>)
      .filter((k) => fixture.fieldStates[k] === "divergent")
      .map((k) => MATH_EVIDENCE_FIELD_LABELS_PT_V2[k]);

    assertEqual(JSON.stringify([...expectedMissing].sort()), JSON.stringify([...(fixture.expectedMissingFieldsPt ?? [])].sort()), `${fixture.description}: missingFieldsPt não bate com o derivado de fieldStates`);
    assertEqual(JSON.stringify([...expectedDivergent].sort()), JSON.stringify([...(fixture.expectedDivergentFieldsPt ?? [])].sort()), `${fixture.description}: divergentFieldsPt não bate com o derivado de fieldStates`);

    (Object.keys(fixture.fieldStates) as Array<keyof LocalReaderMathEvidenceFieldStatesV2>).forEach((key) => {
      if (fixture.fieldStates[key] === "not_applicable") {
        const label = MATH_EVIDENCE_FIELD_LABELS_PT_V2[key];
        assert(!(fixture.expectedMissingFieldsPt ?? []).includes(label), `${fixture.description}: campo not_applicable "${key}" não deveria aparecer em missingFieldsPt`);
        assert(!(fixture.expectedDivergentFieldsPt ?? []).includes(label), `${fixture.description}: campo not_applicable "${key}" não deveria aparecer em divergentFieldsPt`);
      }
    });
  });
});

runTest("stubs v2 (Momento 3C.1A/3C.1B): deriveMathEvidenceFieldStatesV2 lança 'not implemented' hoje", () => {
  assertThrows(() => deriveMathEvidenceFieldStatesV2({} as never, [], {} as never), "deveria lançar até o Momento 3C.2 ser implementado");
});

runTest("stubs v2 (Momento 3C.1A/3C.1B): classifyLocalReaderMathEvidenceV2 lança 'not implemented' hoje", () => {
  assertThrows(() => classifyLocalReaderMathEvidenceV2("relation-x", MATH_EVIDENCE_V2_FIXTURE_1_ITEM_NO_EVIDENCE.fieldStates), "deveria lançar até o Momento 3C.2 ser implementado");
});

// ============================================================================
// Momento 3C.1B §1-§2 — três cenários de erro de integridade, congelados
// como fixtures declarativas. Nenhum chama deriveMathEvidenceFieldStatesV2
// (stub, indistinguível hoje entre "not implemented" e um erro de
// integridade específico) — cada fixture apenas descreve o cenário e
// verifica, por auto-consistência, que ele de fato representa a violação
// alegada.
// ============================================================================

interface MathApplicabilityIntegrityFixtureV2 {
  readonly description: string;
  readonly relation: ReferenceTruthMathRelation;
  readonly relationFieldApplicable: boolean;
  readonly expectedCellExists: boolean;
  readonly expectedIntegrityError: LocalReaderMathEvidenceDerivationIntegrityErrorV2;
}

const SYNTHETIC_MATH_RELATION_BASE = {
  verifiableOperationPt: "fixture sintética do Momento 3C.1B — não corresponde a nenhum dado real do documento Lagoa do Arroz",
  result: "reconciliado_diretamente" as const,
  undisplayedPrecisionProof: null,
  sourceArithmeticInconsistency: null,
  groupCompletenessProof: null,
  notesPt: "Momento 3C.1B — fixture de cenário de erro de integridade, nunca dado real.",
};

export const MATH_APPLICABILITY_INTEGRITY_FIXTURE_A_APPLICABLE_NO_CELL: MathApplicabilityIntegrityFixtureV2 = {
  description: "cenário (a) §1 — quantity aplicável pela relação (quantityScaled !== null), mas nenhuma célula esperada correspondente",
  relation: {
    ...SYNTHETIC_MATH_RELATION_BASE,
    id: "math-integrity-a",
    logicalRowId: "row-integrity-a",
    quantityScaled: { scaledValue: 500, scale: 2 },
    displayedUnitPriceCents: null,
    displayedTotalCents: null,
    officialSubtotalOrTotalCents: null,
  },
  relationFieldApplicable: true,
  expectedCellExists: false,
  expectedIntegrityError: "integrity_error_applicable_field_without_expected_cell",
};

export const MATH_APPLICABILITY_INTEGRITY_FIXTURE_B_NOT_APPLICABLE_HAS_CELL: MathApplicabilityIntegrityFixtureV2 = {
  description: "cenário (b) §1 — quantity não aplicável pela relação (quantityScaled === null), mas uma célula esperada existe mesmo assim",
  relation: {
    ...SYNTHETIC_MATH_RELATION_BASE,
    id: "math-integrity-b",
    logicalRowId: "row-integrity-b",
    quantityScaled: null,
    displayedUnitPriceCents: 100000,
    displayedTotalCents: 100000,
    officialSubtotalOrTotalCents: null,
  },
  relationFieldApplicable: false,
  expectedCellExists: true,
  expectedIntegrityError: "integrity_error_not_applicable_field_has_expected_cell",
};

[MATH_APPLICABILITY_INTEGRITY_FIXTURE_A_APPLICABLE_NO_CELL, MATH_APPLICABILITY_INTEGRITY_FIXTURE_B_NOT_APPLICABLE_HAS_CELL].forEach((fixture) => {
  runTest(`Momento 3C.1B (§1) — ${fixture.description}: cenário de fato representa a contradição alegada (relationFieldApplicable !== expectedCellExists) — nenhuma implementação v2 executada`, () => {
    assert(fixture.relationFieldApplicable !== fixture.expectedCellExists, `${fixture.description}: a fixture deveria representar uma divergência entre aplicabilidade e existência de célula`);
    assertEqual(fixture.relation.quantityScaled !== null, fixture.relationFieldApplicable, `${fixture.description}: relationFieldApplicable não bate com relation.quantityScaled`);
  });
});

interface MathComparisonCardinalityIntegrityFixtureV2 {
  readonly description: string;
  readonly expectedCellId: string;
  readonly matchingComparisonResultCount: number;
  readonly expectedIntegrityError: LocalReaderMathEvidenceDerivationIntegrityErrorV2;
}

export const MATH_CARDINALITY_INTEGRITY_FIXTURE_ZERO_RESULTS: MathComparisonCardinalityIntegrityFixtureV2 = {
  description: "cenário (c1) §2 — célula esperada aplicável com zero resultados de comparação contendo seu id",
  expectedCellId: "cell-integrity-zero",
  matchingComparisonResultCount: 0,
  expectedIntegrityError: "integrity_error_ambiguous_comparison_result_for_expected_cell",
};

export const MATH_CARDINALITY_INTEGRITY_FIXTURE_MULTIPLE_RESULTS: MathComparisonCardinalityIntegrityFixtureV2 = {
  description: "cenário (c2) §2 — célula esperada aplicável com mais de um resultado de comparação contendo seu id",
  expectedCellId: "cell-integrity-multiple",
  matchingComparisonResultCount: 2,
  expectedIntegrityError: "integrity_error_ambiguous_comparison_result_for_expected_cell",
};

[MATH_CARDINALITY_INTEGRITY_FIXTURE_ZERO_RESULTS, MATH_CARDINALITY_INTEGRITY_FIXTURE_MULTIPLE_RESULTS].forEach((fixture) => {
  runTest(`Momento 3C.1B (§2) — ${fixture.description}: contagem de fato viola "exatamente um" — nenhuma implementação v2 executada`, () => {
    assert(fixture.matchingComparisonResultCount !== 1, `${fixture.description}: a fixture deveria violar a cardinalidade "exatamente um"`);
  });
});
