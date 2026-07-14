/**
 * Caracterização objetiva do caso real Lagoa do Arroz (Sprint 21.1A) —
 * dados agregados confirmados em ADR-001 §B (linhas 40-47):
 * `packages/bdos-core/docs/adr/ADR-001_COST_ENGINEERING_IDENTITY_AND_LINEAGE.md`.
 *
 * BLOQUEADOR DOCUMENTADO (mapa §16, "Regra de integridade da fixture"):
 * nenhum dataset estruturado linha-a-linha dos 300 Itens de Serviço reais
 * (códigos, descrições, quantidades, preços unitários, associação
 * hierárquica em Grupos/Subgrupos) existe neste repositório — confirmado
 * por busca direcionada (nenhuma ocorrência de "COT-015" ou "lagoa" fora
 * dos quatro ADRs e do mapa de domínio). Reproduzir os 300 itens exigiria
 * inventar descrições, códigos, quantidades, valores por item e associação
 * hierárquica — expressamente proibido pela regra de integridade da
 * fixture. Este teste, portanto, verifica **apenas** os fatos agregados já
 * confirmados, sem construir nenhuma Versão do Orçamento com 300 linhas.
 *
 * A reprodução completa, linha a linha, do orçamento real permanece
 * pendente da Sprint 21.4A (ingestão documental), quando a planilha
 * original poderá ser lida. Esta Sprint 21.3B **não** declara reprodução
 * integral do orçamento real de Lagoa do Arroz.
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

runTest("caracterização Lagoa do Arroz: cardinalidades confirmadas no ADR-001 §B", () => {
  assertEqual(GRUPOS_CONFIRMADOS, 11, "grupos confirmados mismatch");
  assertEqual(SUBGRUPOS_CONFIRMADOS, 25, "subgrupos confirmados mismatch");
  assertEqual(ORCAMENTO_OFICIAL_REAIS, 9809087.18, "orçamento oficial confirmado mismatch");
});

runTest("caracterização Lagoa do Arroz: ausência de fonte detalhada é registrada objetivamente, não presumida", () => {
  // Este teste é intencionalmente uma asserção de documentação: confirma
  // que este arquivo, e não um dataset de 300 linhas, é a representação
  // deliberada do caso real nesta Sprint — nenhuma linha individual
  // (código, descrição, quantidade, preço unitário, grupo/subgrupo) é
  // fabricada. Ver comentário de bloqueador no topo do arquivo.
  const detailedLineItemSourceAvailableInRepository = false;
  assertEqual(
    detailedLineItemSourceAvailableInRepository,
    false,
    "if this ever becomes true, replace this characterization test with a real line-by-line fixture instead of inventing data",
  );
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
