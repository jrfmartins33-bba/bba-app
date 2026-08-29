import { buildXlsxFixture } from "../schedule-management/adapters/excel-import/xlsx-test-fixtures";
import { extractMemoriasDeCalculo } from "./parse-memoria-de-calculo";

/**
 * Camada B (ESPECIFICAÇÃO) — o protótipo classifica layouts e extrai o
 * bloco RESUMO das memórias, SEM inferir campo a partir de outro e SEM
 * canonicalizar (números vêm em formatos heterogêneos no arquivo real).
 */

runTest("classifica aba de memória com bloco RESUMO limpo e marca como inequívoca", () => {
  const bytes = buildXlsxFixture([
    {
      name: "01.02.01",
      rows: [
        ["MEMÓRIA DE CÁLCULO - MEDIÇÃO 08"],
        ["01.02.01", "ALUGUEL CONTAINER"],
        ["", "RESUMO", "", "", "", "", "QUANT", "UNID"],
        ["", "Quantidade Contratada.....", "", "", "", "", 9, "MÊS"],
        ["", "Quantidade executada acumulada atual", "", "", "", "", 8, "MÊS"],
        ["", "Quantidade medida acumulada em medições anteriores", "", "", "", "", 7, "MÊS"],
        ["", "Quantidade a medir no período", "", "", "", "", 1, "MÊS"],
        ["", "Saldo contratual", "", "", "", "", 1, "MÊS"]
      ]
    }
  ]);

  const r = extractMemoriasDeCalculo(bytes, "fixture.xlsx");
  assertEqual(r.totalCodeSheets, 1, "uma aba de código");
  const p = r.parsed[0];
  assertEqual(p.layout, "resumo_value_after_unit", "layout limpo");
  assertEqual(p.contractQuantity, 9, "contratada");
  assertEqual(p.executedAccumulatedQuantity, 8, "executada acumulada (distinta da medida)");
  assertEqual(p.measuredAccumulatedQuantity, 7, "medida acumulada (candidata a 'acumulado documental')");
  assertEqual(p.quantityToMeasureInPeriod, 1, "a medir no período");
  assertEqual(p.unambiguous, true, "os 3 campos decisórios foram lidos");
  assertEqual(r.unambiguousCount, 1, "contagem de inequívocos");
});

runTest("aba sem cabeçalho 'MEMÓRIA DE CÁLCULO' -> not_item_memoria, nunca inequívoca", () => {
  const bytes = buildXlsxFixture([{ name: "09.09.09", rows: [["planilha qualquer"], ["x", 1]] }]);
  const p = extractMemoriasDeCalculo(bytes, "f.xlsx").parsed[0];
  assertEqual(p.layout, "not_item_memoria", "layout");
  assertEqual(p.unambiguous, false, "nunca inequívoca");
});

runTest("aba de memória sem bloco RESUMO -> no_resumo_block", () => {
  const bytes = buildXlsxFixture([{ name: "01.04.01", rows: [["MEMÓRIA DE CÁLCULO"], ["01.04.01", "SERVIÇO"], ["", "EQUIPAMENTO", "PERÍODO"]] }]);
  const p = extractMemoriasDeCalculo(bytes, "f.xlsx").parsed[0];
  assertEqual(p.layout, "no_resumo_block", "layout");
  assertEqual(p.unambiguous, false, "sem RESUMO não há como fechar");
});

runTest("campo ausente permanece null -- nunca inferido de outro campo", () => {
  const bytes = buildXlsxFixture([
    {
      name: "02.03.01",
      rows: [
        ["MEMÓRIA DE CÁLCULO"],
        ["", "RESUMO"],
        ["", "Quantidade Contratada.....", "", 100, "M3"],
        ["", "Saldo contratual", "", 40, "M3"]
      ]
    }
  ]);
  const p = extractMemoriasDeCalculo(bytes, "f.xlsx").parsed[0];
  assertEqual(p.contractQuantity, 100, "contratada lida");
  assertEqual(p.measuredAccumulatedQuantity, null, "medida acumulada AUSENTE fica null (nunca 100-40)");
  assertEqual(p.quantityToMeasureInPeriod, null, "a medir AUSENTE fica null");
  assertEqual(p.unambiguous, false, "faltam campos decisórios -> não inequívoca");
});

runTest("notas livres (P.S./replanilhamento) entram como evidência, nunca como dado", () => {
  const bytes = buildXlsxFixture([
    {
      name: "01.02.04",
      rows: [
        ["MEMÓRIA DE CÁLCULO"],
        ["", "RESUMO"],
        ["", "Quantidade Contratada.....", "", 9, "M2"],
        ["", "Quantidade medida acumulada em medições anteriores", "", 9, "M2"],
        ["", "Quantidade a medir no período", "", 0, "M2"],
        ["", "P.S: FOI EXECUTADO NOVO ALMOXARIFADO A SER INSERIDO NO REPLANILHAMENTO"]
      ]
    }
  ]);
  const p = extractMemoriasDeCalculo(bytes, "f.xlsx").parsed[0];
  assertEqual(p.freeformNotes.length, 1, "uma nota capturada");
  assertEqual(/REPLANILHAMENTO/i.test(p.freeformNotes[0]), true, "conteúdo da nota");
  assertEqual(p.contractQuantity, 9, "campos numéricos não contaminados pela nota");
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
