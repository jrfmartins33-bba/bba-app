import { buildXlsxFixture } from "../../../schedule-management/adapters/excel-import/xlsx-test-fixtures";
import { readXlsxWorkbook } from "../../../schedule-management/adapters/excel-import/xlsx-reader";
import { detectBulletinSheet } from "./bulletin-sheet-detector";

function sheetFromRows(rows: ReadonlyArray<ReadonlyArray<string | number | null>>) {
  const workbook = readXlsxWorkbook(buildXlsxFixture([{ name: "Boletim", rows }]));
  const sheet = workbook.sheets[0];
  if (sheet === undefined) {
    throw new Error("fixture sheet missing");
  }
  return sheet;
}

// Reproduz a estrutura real de duas linhas do BM_08 (confirmado contra
// o arquivo real durante o Epic 19, Sprint 4C, e revisado após a
// investigação de fórmulas pós-19.4A/4C): a linha de rótulo de
// período traz ITEM/DISCRIMINAÇÃO/UND., o rótulo do bloco financeiro
// oficial ("CONTROLE FINANCEIRO – MEDIÇÃO") e os rótulos MED-NN; a
// linha logo abaixo traz QUANT./PREÇO UNITÁRIO/PREÇO TOTAL,
// QUANTITATIVO/VALOR (R$) (sob o bloco oficial) e, sob cada MED-NN,
// um par FISICO/FINANCEIRO.
const PERIOD_LABEL_ROW = [
  "ITEM",
  "DISCRIMINAÇÃO",
  "UND.",
  "VALORES DE CONTRATO",
  null,
  null,
  "CONTROLE FINANCEIRO – MEDIÇÃO",
  null,
  "MED-01",
  null,
  "MED-02",
  null,
  "MED-03",
  null
];
const SUB_HEADER_ROW = [
  null,
  null,
  null,
  "QUANT.",
  "PREÇO UNITÁRIO (R$)",
  "PREÇO TOTAL (R$)",
  "QUANTITATIVO",
  "VALOR (R$)",
  "FISICO",
  "FINANCEIRO",
  "FISICO",
  "FINANCEIRO",
  "FISICO",
  "FINANCEIRO"
];

runTest("reconhece o cabeçalho em duas linhas e pareia FISICO/FINANCEIRO por período", () => {
  const sheet = sheetFromRows([PERIOD_LABEL_ROW, SUB_HEADER_ROW, ["01.01.01", "ITEM LEAF", "M2", 10, 5, 50, 99, 999, 1, 10, 2, 20, 3, 30]]);

  const detection = detectBulletinSheet(sheet);

  assertEqual(detection === null, false, "esperava reconhecer o layout de Boletim de Medição");
  assertEqual(detection?.periodLabelRowIndex, 0, "linha de rótulo de período incorreta");
  assertEqual(detection?.subHeaderRowIndex, 1, "linha de sub-cabeçalho incorreta");
  assertEqual(detection?.periodColumns.length, 3, "esperava 3 períodos pareados");
  assertEqual(detection?.periodColumns[0]?.label, "MED-01");
  assertEqual(detection?.periodColumns[0]?.periodNumber, 1);
  assertEqual(detection?.periodColumns[0]?.physicalColumnIndex, 8);
  assertEqual(detection?.periodColumns[0]?.financialColumnIndex, 9);
  assertEqual(detection?.periodColumns[1]?.periodNumber, 2);
});

runTest("classifica código/nome/unidade na linha de rótulo de período, e quantidade/preço unitário na sub-linha", () => {
  const sheet = sheetFromRows([PERIOD_LABEL_ROW, SUB_HEADER_ROW]);

  const detection = detectBulletinSheet(sheet);

  assertEqual(detection?.codeColumnIndex, 0, "ITEM deveria ser reconhecido como coluna de código");
  assertEqual(detection?.nameColumnIndex, 1, "DISCRIMINAÇÃO deveria ser reconhecida como coluna de nome");
  assertEqual(detection?.unitColumnIndex, 2, "UND. deveria ser reconhecida como coluna de unidade");
  assertEqual(detection?.contractQuantityColumnIndex, 3, "QUANT. deveria ser reconhecida como quantidade de contrato");
  assertEqual(detection?.unitPriceColumnIndex, 4, "PREÇO UNITÁRIO deveria ser reconhecido, não confundido com PREÇO TOTAL");
});

runTest('reconhece o bloco financeiro oficial "CONTROLE FINANCEIRO – MEDIÇÃO" -> QUANTITATIVO/VALOR (R$) -- fonte autoritativa, não a grade MED-NN', () => {
  const sheet = sheetFromRows([PERIOD_LABEL_ROW, SUB_HEADER_ROW]);

  const detection = detectBulletinSheet(sheet);

  assertEqual(detection?.officialPeriodColumn !== null, true, "esperava encontrar o bloco financeiro oficial");
  assertEqual(detection?.officialPeriodColumn?.headerLabel, "CONTROLE FINANCEIRO – MEDIÇÃO");
  assertEqual(detection?.officialPeriodColumn?.quantityColumnIndex, 6, "QUANTITATIVO deveria ser a coluna 6");
  assertEqual(detection?.officialPeriodColumn?.valueColumnIndex, 7, "VALOR (R$) deveria ser a coluna 7, nunca confundida com PREÇO UNITÁRIO");
});

runTest('officialPeriodColumn é null quando a aba não tem o bloco "CONTROLE FINANCEIRO – MEDIÇÃO" -- só a grade MED-NN legada', () => {
  const legacyLabelRow = ["ITEM", "DISCRIMINAÇÃO", "UND.", null, null, "MED-01", null, "MED-02", null, "MED-03", null];
  const legacySubHeaderRow = [null, null, null, "QUANT.", "PREÇO UNITÁRIO (R$)", "FISICO", "FINANCEIRO", "FISICO", "FINANCEIRO", "FISICO", "FINANCEIRO"];
  const sheet = sheetFromRows([legacyLabelRow, legacySubHeaderRow]);

  const detection = detectBulletinSheet(sheet);

  assertEqual(detection === null, false, "a grade MED-NN sozinha ainda deveria bastar para reconhecer a aba");
  assertEqual(detection?.officialPeriodColumn, null, "sem o bloco oficial, officialPeriodColumn deveria ser null");
});

runTest("detecta coluna residual sem cabeçalho (achado real: coluna N do BM_08) entre o bloco oficial e a grade de períodos, ignorando um gap totalmente vazio", () => {
  // Réplica minimal do gap real do BM_08 entre I (bloco oficial) e W
  // (grade MED-NN): uma coluna totalmente vazia (índice 8 -- nunca
  // vira "órfã", porque não tem valor nenhum) e uma coluna com texto
  // solto sem cabeçalho em nenhuma das duas linhas (índice 9 -- o
  // equivalente sintético da coluna N real).
  const labelRow = ["ITEM", "DISCRIMINAÇÃO", "UND.", null, null, "CONTROLE FINANCEIRO – MEDIÇÃO", null, null, null, "MED-01", null, "MED-02", null, "MED-03", null];
  const subHeaderRow = [null, null, null, "QUANT.", "PREÇO UNITÁRIO (R$)", "QUANTITATIVO", "VALOR (R$)", null, null, "FISICO", "FINANCEIRO", "FISICO", "FINANCEIRO", "FISICO", "FINANCEIRO"];
  const emptyGapColumnIndex = 7;
  const orphanColumnIndex = 8;

  const rows: (string | number | null)[][] = [labelRow, subHeaderRow];
  for (let i = 0; i < 12; i++) {
    const row = new Array(15).fill(null);
    row[0] = `01.0${i}.00`;
    row[1] = `ITEM ${i}`;
    row[orphanColumnIndex] = `TEXTO RESIDUAL ${i}`;
    rows.push(row);
  }

  const sheet = sheetFromRows(rows);
  const detection = detectBulletinSheet(sheet);

  assertEqual(detection === null, false);
  const orphan = detection?.orphanColumns.find((c) => c.columnIndex === orphanColumnIndex);
  assertEqual(orphan !== undefined, true, "esperava detectar a coluna 9 como residual (sem cabeçalho, com valores de texto)");
  assertEqual(orphan?.valueCount, 12);
  assertEqual(
    detection?.orphanColumns.some((c) => c.columnIndex === emptyGapColumnIndex),
    false,
    "a coluna 8, totalmente vazia, não deveria virar órfã -- só colunas com valor real contam"
  );
});

runTest("exige pelo menos 3 rótulos MED-NN na mesma linha -- menos que isso não é este layout", () => {
  const sheet = sheetFromRows([
    ["ITEM", "DISCRIMINAÇÃO", "UND.", null, null, "MED-01", null],
    [null, null, null, null, null, "FISICO", "FINANCEIRO"]
  ]);

  const detection = detectBulletinSheet(sheet);

  assertEqual(detection, null, "1 único período não deveria bastar para reconhecer o layout");
});

runTest("recusa um par MED-NN cuja sub-linha não tem FISICO/FINANCEIRO nas colunas esperadas", () => {
  const sheet = sheetFromRows([
    ["ITEM", "DISCRIMINAÇÃO", "UND.", "MED-01", null, "MED-02", null, "MED-03", null],
    [null, null, null, "algo", "outracoisa", "FISICO", "FINANCEIRO", "FISICO", "FINANCEIRO"]
  ]);

  const detection = detectBulletinSheet(sheet);

  // MED-01 não tem FISICO/FINANCEIRO reais abaixo -- só MED-02/MED-03
  // deveriam ser aceitos, e mesmo assim o total (2) fica abaixo do
  // mínimo de 3 -- layout recusado.
  assertEqual(detection, null, "esperava recusar por faltar um terceiro período válido");
});

runTest("retorna null para uma planilha que não é um Boletim de Medição", () => {
  const sheet = sheetFromRows([
    ["Foo", "Bar", "Baz"],
    ["x", "y", "z"]
  ]);

  const detection = detectBulletinSheet(sheet);

  assertEqual(detection, null);
});

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "assertion failed"}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
