import { buildXlsxFixture } from "./xlsx-test-fixtures";
import { readXlsxWorkbook } from "./xlsx-reader";
import { detectSheetPlanningType } from "./sheet-type-detector";

function sheetFromRows(rows: ReadonlyArray<ReadonlyArray<string | number | null>>) {
  const workbook = readXlsxWorkbook(buildXlsxFixture([{ name: "Planilha", rows }]));
  const sheet = workbook.sheets[0];
  if (sheet === undefined) {
    throw new Error("fixture sheet missing");
  }
  return sheet;
}

runTest("detects a classic cronograma header (EAP/Atividade/Início/Fim/Predecessoras)", () => {
  const sheet = sheetFromRows([["EAP", "Atividade", "Início", "Fim", "Duração", "Predecessoras"], ["1", "Escavação", "2026-01-05", "2026-01-12", 8, ""]]);

  const detection = detectSheetPlanningType(sheet);

  assertEqual(detection.detectedType, "cronograma", "expected cronograma detection");
  assertEqual(detection.hasPredecessorColumn, true, "expected a predecessors column to be found");
});

runTest("detects a período-matrix físico-financeiro sheet (ITEM/DESCRIÇÃO/CONTROLE/VALOR + mês N)", () => {
  const sheet = sheetFromRows([
    ["ITEM", "DESCRIÇÃO", "VALOR TOTAL (R$)", "CONTROLE"],
    [null, null, null, null, "mês 1", "mês 2", "mês 3"],
    ["1.0", "Terraplenagem", 100000, "PREVISTO", 0.5, 0.5],
  ]);

  const detection = detectSheetPlanningType(sheet);

  assertEqual(detection.detectedType, "fisico-financeiro", "expected fisico-financeiro detection");
  assertEqual(detection.periodColumns.length, 3, "expected 3 period columns");
  assertEqual(detection.hasValueColumn, true, "expected a value column to be found");
});

runTest("detects a período-matrix curva-s sheet (no VALOR column)", () => {
  const sheet = sheetFromRows([
    ["ITEM", "DESCRIÇÃO", "CONTROLE"],
    [null, null, null, "mês 1", "mês 2", "mês 3"],
    ["1.0", "Terraplenagem", "PREVISTO", 0.5, 0.5],
  ]);

  const detection = detectSheetPlanningType(sheet);

  assertEqual(detection.detectedType, "curva-s", "expected curva-s detection");
  assertEqual(detection.hasValueColumn, false, "expected no value column");
});

runTest("prefers the header row with more distinct kinds over a sub-header row with more raw matches (Boletim de Medição layout)", () => {
  // Reproduz o cabeçalho em duas linhas do BM_08 real (Epic 18
  // follow-up): a linha principal (ITEM/DISCRIMINAÇÃO/UND./VALORES DE
  // CONTRATO) introduz 2 tipos distintos reconhecidos (code, value —
  // "DISCRIMINAÇÃO"/"UND." não batem com nenhum token hoje, o que é
  // esperado e não faz parte desta correção); a sub-linha abaixo
  // repete FÍSICO/FINANCEIRO uma vez por período (5 pares = 5
  // correspondências brutas, todas do mesmo tipo "value"). Antes desta
  // correção, a sub-linha vencia por contagem bruta (5 > 2) e o
  // detector nunca via a linha real.
  const sheet = sheetFromRows([
    ["ITEM", "DISCRIMINAÇÃO", "UND.", "VALORES DE CONTRATO"],
    [null, null, null, null, "FISICO", "FINANCEIRO", "FISICO", "FINANCEIRO", "FISICO", "FINANCEIRO", "FISICO", "FINANCEIRO", "FISICO", "FINANCEIRO"],
    ["01.01.01", "CAPINA MANUAL", "M2", 1000],
  ]);

  const detection = detectSheetPlanningType(sheet);

  assertEqual(detection.headerRowIndex, 0, "expected the main header row (ITEM/VALORES DE CONTRATO), not the repetitive sub-header");
  assertEqual(
    detection.columns.some((c) => c.kind === "code"),
    true,
    "expected ITEM to be recognized as the code column"
  );
  assertEqual(
    detection.columns.some((c) => c.kind === "value"),
    true,
    "expected VALORES DE CONTRATO to be recognized as a value column"
  );
  assertEqual(detection.columns.length, 2, "expected exactly 2 recognized columns on the main row (code + value), not the 5 raw matches on the sub-header");
});

runTest("returns unknown for a sheet with no recognizable headers", () => {
  const sheet = sheetFromRows([
    ["Foo", "Bar", "Baz"],
    ["x", "y", "z"],
  ]);

  const detection = detectSheetPlanningType(sheet);

  assertEqual(detection.detectedType, "unknown", "expected unknown detection");
  assertEqual(detection.headerRowIndex, null, "expected no header row to be found");
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
