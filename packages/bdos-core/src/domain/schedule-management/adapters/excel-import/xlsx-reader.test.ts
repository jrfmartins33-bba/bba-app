import { buildXlsxFixture } from "./xlsx-test-fixtures";
import { readXlsxWorkbook } from "./xlsx-reader";

/**
 * O arquivo real do cliente (usado durante o desenvolvimento para
 * validar o reconhecimento de colunas — ver `BBA_PROJECT.md`) contém
 * dados comerciais reais e nunca é commitado. Estes testes usam
 * fixtures sintéticos, construídos por `xlsx-test-fixtures.ts` (o
 * mesmo escritor de ZIP hand-rolled, sem biblioteca).
 */
runTest("reads a single-sheet workbook with mixed string/number cells", () => {
  const bytes = buildXlsxFixture([
    {
      name: "Cronograma",
      rows: [
        ["EAP", "Atividade", "Duração"],
        ["1", "Escavação", 8],
      ],
    },
  ]);

  const workbook = readXlsxWorkbook(bytes);

  assertEqual(workbook.sheets.length, 1, "expected 1 sheet");
  assertEqual(workbook.sheets[0]?.name, "Cronograma", "sheet name mismatch");
  assertEqual(workbook.sheets[0]?.hidden, false, "sheet should not be hidden");
  assertEqual(workbook.sheets[0]?.rows.length, 2, "expected 2 rows");
  assertEqual(workbook.sheets[0]?.rows[0]?.cells[1], "Atividade", "header cell mismatch");
  assertEqual(workbook.sheets[0]?.rows[1]?.cells[2], 8, "numeric cell mismatch");
});

runTest("preserves the hidden flag and reads multiple sheets in order", () => {
  const bytes = buildXlsxFixture([
    { name: "Principal", rows: [["A"]] },
    { name: "Oculta", hidden: true, rows: [["B"]] },
    { name: "Curva S", rows: [["C"]] },
  ]);

  const workbook = readXlsxWorkbook(bytes);

  assertEqual(workbook.sheets.length, 3, "expected 3 sheets");
  assertEqual(workbook.sheets[0]?.name, "Principal", "sheet 1 name mismatch");
  assertEqual(workbook.sheets[1]?.name, "Oculta", "sheet 2 name mismatch");
  assertEqual(workbook.sheets[1]?.hidden, true, "sheet 2 should be hidden");
  assertEqual(workbook.sheets[2]?.name, "Curva S", "sheet 3 name mismatch");
  assertEqual(workbook.sheets[2]?.hidden, false, "sheet 3 should not be hidden");
});

runTest("reuses the shared string table for repeated text values", () => {
  const bytes = buildXlsxFixture([
    {
      name: "Planilha",
      rows: [
        ["PREVISTO", "PREVISTO"],
        ["REALIZADO", "PREVISTO"],
      ],
    },
  ]);

  const workbook = readXlsxWorkbook(bytes);

  assertEqual(workbook.sheets[0]?.rows[0]?.cells[0], "PREVISTO", "cell (0,0) mismatch");
  assertEqual(workbook.sheets[0]?.rows[0]?.cells[1], "PREVISTO", "cell (0,1) mismatch");
  assertEqual(workbook.sheets[0]?.rows[1]?.cells[0], "REALIZADO", "cell (1,0) mismatch");
});

runTest("returns an empty rows array for an empty sheet", () => {
  const bytes = buildXlsxFixture([{ name: "Vazia", rows: [] }]);
  const workbook = readXlsxWorkbook(bytes);

  assertEqual(workbook.sheets[0]?.rows.length, 0, "expected zero rows");
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
