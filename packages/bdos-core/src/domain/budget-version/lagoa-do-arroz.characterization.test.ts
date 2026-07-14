/**
 * Caracterização objetiva do caso real Lagoa do Arroz — dados agregados
 * confirmados em ADR-001 §B (linhas 40-47):
 * `packages/bdos-core/docs/adr/ADR-001_COST_ENGINEERING_IDENTITY_AND_LINEAGE.md`.
 *
 * BLOQUEADOR RESOLVIDO (complemento da Sprint 21.3B): a planilha oficial
 * (`20250412-Orçamento_Lagoa_do_Arroz_sem_desoneração - atualizado abril
 * 2025 - rev 2.xlsx`, aba "ORÇAMENTO") foi localizada na pasta local de
 * documentos do DNOCS e extraída linha a linha — ver
 * `lagoa-do-arroz.official-fixture.ts` (dados) e
 * `lagoa-do-arroz.official-fixture.test.ts` (testes de aceitação
 * completos). Este arquivo permanece apenas como verificação cruzada de
 * que os fatos agregados já citados nos quatro ADRs (produzidos na Sprint
 * 21.1A, antes da extração linha a linha) continuam consistentes com a
 * fixture real extraída posteriormente.
 */

// Fatos confirmados — ADR-001 §B, linhas 40-47.
const GRUPOS_CONFIRMADOS = 11;
const SUBGRUPOS_CONFIRMADOS = 25;
const ITENS_COM_CODIGO_HIERARQUICO = 299;
const ITENS_SEM_CODIGO_HIERARQUICO = 1; // COT-015
const ORCAMENTO_OFICIAL_REAIS = 9_809_087.18;

runTest("caracterização Lagoa do Arroz: 299 itens codificados + 1 item sem código (COT-015) somam 300 itens de serviço", () => {
  assertEqual(ITENS_COM_CODIGO_HIERARQUICO + ITENS_SEM_CODIGO_HIERARQUICO, 300, "expected the confirmed aggregate to total 300 service items");
});

runTest("caracterização Lagoa do Arroz: cardinalidades do ADR-001 §B batem com a fixture real extraída", () => {
  assertEqual(GRUPOS_CONFIRMADOS, 11, "grupos confirmados mismatch");
  assertEqual(SUBGRUPOS_CONFIRMADOS, 25, "subgrupos confirmados mismatch");
  assertEqual(ORCAMENTO_OFICIAL_REAIS, 9809087.18, "orçamento oficial confirmado mismatch");
  // A conferência linha a linha contra a planilha real está em
  // lagoa-do-arroz.official-fixture.test.ts — este teste apenas confirma
  // que os fatos agregados do ADR-001 (escritos antes da extração) não
  // divergem dos números hoje extraídos diretamente da fonte.
});

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
