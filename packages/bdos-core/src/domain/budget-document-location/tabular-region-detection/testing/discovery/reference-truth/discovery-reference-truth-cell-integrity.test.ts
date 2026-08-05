/**
 * Cobertura adicional de teste sobre a verdade de referência já congelada
 * (Sprint 21.4B.3A.3, Momento 3C.1, §8 do pré-registro de correção —
 * `EPIC_21_SPRINT_4B3A3_MOMENTO3C1_METRIC_CORRECTION_PREREGISTRATION.md`).
 * Este arquivo é uma ADIÇÃO — nunca uma edição de
 * `discovery-reference-truth.test.ts` (Momento 2, congelado). Não
 * modifica nem recalcula nenhum dado da verdade de referência; apenas
 * adiciona duas asserções que a revisão técnica identificou como
 * ausentes: contagem total de células e resolução de `physicalRegionIds`
 * não vazios.
 *
 * As 1.019 células com `physicalRegionIds: []` (100% delas — nenhuma
 * célula preenche este campo; todas usam apenas o campo textual
 * `physicalOriginPt` como proveniência, ver diagnóstico abaixo)
 * permanecem exatamente como estão — esta Sprint declara explicitamente
 * que não serão retroativamente alteradas.
 *
 * Correção documental (Momento 3C.1A): este comentário originalmente
 * dizia "921 células com physicalRegionIds: []", herdando um número
 * incorreto da revisão técnica que precedeu o Momento 3C.1 (o "921"
 * pressupunha 98 células com vínculo estruturado; o diagnóstico real,
 * já executado neste arquivo, mostra 0). Nenhum dado da verdade de
 * referência foi alterado por esta correção — apenas o texto do
 * comentário.
 */

import { REFERENCE_TRUTH_BUNDLES } from "./discovery-reference-truth";

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

const ALL_REGIONS = REFERENCE_TRUTH_BUNDLES.flatMap((b) => b.physicalRegions);
const ALL_CELLS = REFERENCE_TRUTH_BUNDLES.flatMap((b) => b.cells);

runTest("item 10 (§8) — total de células da verdade de referência é exatamente 1.019", () => {
  assertEqual(ALL_CELLS.length, 1019, "contagem total de células mudou — esta asserção não existia antes desta correção (Momento 3C.1)");
});

runTest("item 11 (§8) — todo physicalRegionId não vazio de uma célula referencia uma região física existente na mesma página (vacuamente verdadeiro hoje — ver diagnóstico abaixo)", () => {
  const regionIdsByPage = new Map<number, Set<string>>();
  ALL_REGIONS.forEach((r) => {
    if (!regionIdsByPage.has(r.realPageNumber)) regionIdsByPage.set(r.realPageNumber, new Set());
    regionIdsByPage.get(r.realPageNumber)!.add(r.id);
  });

  ALL_CELLS.forEach((c) => {
    if (c.physicalRegionIds.length === 0) return;
    const idsOnPage = regionIdsByPage.get(c.realPageNumber) ?? new Set();
    c.physicalRegionIds.forEach((rid) => {
      assert(idsOnPage.has(rid), `${c.id}: physicalRegionId "${rid}" não existe entre as regiões físicas da página ${c.realPageNumber}`);
    });
  });
  // Não há asserção de "> 0 células com vínculo" aqui: o diagnóstico abaixo
  // confirma que, hoje, NENHUMA célula (0/1.019) preenche physicalRegionIds
  // — todas as 1.019 usam exclusivamente o campo textual physicalOriginPt.
  // Correção de um erro da revisão técnica anterior desta Sprint, que
  // relatou incorretamente "98 células" com base num grep que na verdade
  // capturava physicalRegionIds de LINHAS LÓGICAS (ReferenceTruthLogicalRow),
  // não de células.
});

runTest("diagnóstico (§8) — contagem de células com e sem physicalRegionIds estruturados (informativo, não é uma regressão fixada)", () => {
  const withIds = ALL_CELLS.filter((c) => c.physicalRegionIds.length > 0).length;
  const withoutIds = ALL_CELLS.length - withIds;
  console.log(`  (${withIds} célula(s) com physicalRegionIds estruturado, ${withoutIds} célula(s) usando apenas physicalOriginPt textual — nenhuma será retroativamente alterada nesta Sprint)`);
  assertEqual(withIds + withoutIds, ALL_CELLS.length);
  assertEqual(withIds, 0, "hoje, 0 células preenchem physicalRegionIds — todas as 1.019 usam exclusivamente physicalOriginPt textual (correção de um número incorreto relatado na revisão técnica anterior)");
});
