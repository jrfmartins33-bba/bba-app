import { buildXlsxFixture } from "../../../schedule-management/adapters/excel-import/xlsx-test-fixtures";
import { readXlsxWorkbookRaw } from "../../../schedule-management/adapters/excel-import/xlsx-reader";
import { BudgetLineKind } from "../../../budget-version";
import { importBudgetFromXlsx, rawDecimalFractionToPercentText } from "./budget-xlsx-importer";
import type { BudgetXlsxImportContext } from "./budget-xlsx-importer.types";
import { BUDGET_XLSX_IMPORTER_VERSION } from "./budget-xlsx-importer.types";

const mockContext: BudgetXlsxImportContext = {
  lotReference: "Lote 01",
  sourceFileName: "Orcamento_Lote01.xlsx",
  sourceSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  importerVersion: BUDGET_XLSX_IMPORTER_VERSION,
};

// ---------------------------------------------------------------------------
// Unit Tests (T01 – T17)
// ---------------------------------------------------------------------------

runTest("T01: sheet detection by header row scoring", () => {
  const bytes = buildXlsxFixture([
    { name: "Capa", rows: [["Relatório Orçamentário"], ["Cliente: DNOCS"]] },
    {
      name: "Orçamento",
      rows: [
        ["ITEM", "CÓDIGO", "DESCRIÇÃO", "UNID", "QUANT", "BDI", "PREÇO UNIT", "PREÇO TOTAL"],
        ["1.0", "", "SERVIÇOS PRELIMINARES", "", "", "", "", 1000.0],
      ],
    },
  ]);

  const rawWb = readXlsxWorkbookRaw(bytes);
  const result = importBudgetFromXlsx(rawWb, mockContext);

  assertEqual(result.summary.sheetName, "Orçamento", "expected Orçamento sheet to be selected");
  assertEqual(result.rows.length, 1, "expected 1 row imported");
});

runTest("T02: NBSP and special whitespace normalization in headers", () => {
  const bytes = buildXlsxFixture([
    {
      name: "Plan1",
      rows: [
        ["ITEM\u00A0", "DESCRIÇÃO\u00A0", "UNID.", "QUANT.", "VALOR\u00A0TOTAL"],
        ["1.0", "MOBILIZAÇÃO", "", "", 5000],
      ],
    },
  ]);

  const rawWb = readXlsxWorkbookRaw(bytes);
  const result = importBudgetFromXlsx(rawWb, mockContext);

  assertEqual(result.summary.sheetName, "Plan1", "expected sheet selection despite NBSP in headers");
  assertEqual(result.rows.length, 1, "expected 1 row imported");
});

runTest("T03: header row in non-default row position (row 4)", () => {
  const bytes = buildXlsxFixture([
    {
      name: "Planilha1",
      rows: [
        ["ESTADO DE ALAGOAS"],
        ["OBRA DE BARRAGENS"],
        [""],
        ["ITEM", "CÓDIGO", "DESCRIÇÃO", "UNID", "QUANT", "VALOR TOTAL"],
        ["1.0", "", "SERVIÇOS PRELIMINARES", "", "", 150000],
      ],
    },
  ]);

  const rawWb = readXlsxWorkbookRaw(bytes);
  const result = importBudgetFromXlsx(rawWb, mockContext);

  assertEqual(result.summary.headerRowNumber, 4, "expected header on row 4");
  assertEqual(result.rows.length, 1, "expected 1 row imported");
});

runTest("T04: Group classification (code format '1.0', '15.0')", () => {
  const bytes = buildXlsxFixture([
    {
      name: "Orçamento",
      rows: [
        ["ITEM", "DESCRIÇÃO", "UNID", "QUANT", "VALOR TOTAL"],
        ["1.0", "SERVIÇOS PRELIMINARES", "", "", 10000],
        ["15.0", "INSTALAÇÕES E EQUIPAMENTOS", "", "", 50000],
      ],
    },
  ]);

  const rawWb = readXlsxWorkbookRaw(bytes);
  const result = importBudgetFromXlsx(rawWb, mockContext);

  assertEqual(result.summary.groupCount, 2, "expected 2 groups");
  assertEqual(result.rows[0]?.kind, BudgetLineKind.Group, "first row should be Group");
  assertEqual(result.rows[1]?.kind, BudgetLineKind.Group, "second row should be Group");
  assertEqual(result.rows[0]?.fields.documentalGroupTotalText, "10000.00", "documental total text should be set for Group");
  assertEqual(result.rows[0]?.fields.totalPriceText, null, "totalPriceText should be null for Group");
});

runTest("T05: Subgroup classification (code format '01.01', '15.04')", () => {
  const bytes = buildXlsxFixture([
    {
      name: "Orçamento",
      rows: [
        ["ITEM", "DESCRIÇÃO", "UNID", "QUANT", "VALOR TOTAL"],
        ["1.0", "SERVIÇOS PRELIMINARES", "", "", 10000],
        ["01.01", "INSTALAÇÃO DO CANTEIRO", "", "", 10000],
      ],
    },
  ]);

  const rawWb = readXlsxWorkbookRaw(bytes);
  const result = importBudgetFromXlsx(rawWb, mockContext);

  assertEqual(result.summary.subgroupCount, 1, "expected 1 subgroup");
  assertEqual(result.rows[1]?.kind, BudgetLineKind.Subgroup, "second row should be Subgroup");
  assertEqual(result.rows[1]?.parentRowId, result.rows[0]?.id, "subgroup parent should be group 1.0");
});

runTest("T06: ServiceItem classification (code format '01.01.01')", () => {
  const bytes = buildXlsxFixture([
    {
      name: "Orçamento",
      rows: [
        ["ITEM", "FONTE", "CÓDIGO", "DESCRIÇÃO", "UNID", "QUANT", "CUSTO UNIT", "BDI", "PREÇO UNIT", "VALOR TOTAL"],
        ["1.0", "", "", "SERVIÇOS PRELIMINARES", "", "", "", "", "", 1000],
        ["01.01", "", "", "INSTALAÇÕES", "", "", "", "", "", 1000],
        ["01.01.01", "SINAPI", "74209/001", "PLACA DE OBRA", "UNID", 14.0, 3179.23, 0.2418, 3947.96, 55271.44],
      ],
    },
  ]);

  const rawWb = readXlsxWorkbookRaw(bytes);
  const result = importBudgetFromXlsx(rawWb, mockContext);

  assertEqual(result.summary.serviceItemCount, 1, "expected 1 service item");
  assertEqual(result.rows[2]?.kind, BudgetLineKind.ServiceItem, "third row should be ServiceItem");
  assertEqual(result.rows[2]?.fields.itemCode, "01.01.01", "expected itemCode");
  assertEqual(result.rows[2]?.fields.sourceCode, "74209/001", "expected sourceCode");
  assertEqual(result.rows[2]?.fields.unit, "UNID", "expected unit");
  assertEqual(result.rows[2]?.fields.bdiPercentText, "24.18%", "expected exact BDI string representation");
});

runTest("T07: hierarchy resolution (parentRowId assignment)", () => {
  const bytes = buildXlsxFixture([
    {
      name: "Orçamento",
      rows: [
        ["ITEM", "DESCRIÇÃO", "UNID", "QUANT", "VALOR TOTAL"],
        ["1.0", "GRUPO 1", "", "", 100],
        ["01.01", "SUBGRUPO 1.1", "", "", 100],
        ["01.01.01", "ITEM 1.1.1", "M2", 10, 100],
      ],
    },
  ]);

  const rawWb = readXlsxWorkbookRaw(bytes);
  const result = importBudgetFromXlsx(rawWb, mockContext);

  const group = result.rows[0]!;
  const subgroup = result.rows[1]!;
  const item = result.rows[2]!;

  assertEqual(group.parentRowId, null, "Group parent should be null");
  assertEqual(subgroup.parentRowId, group.id, "Subgroup parent should be Group");
  assertEqual(item.parentRowId, subgroup.id, "ServiceItem parent should be Subgroup");
});

runTest("T08: position and order preservation", () => {
  const bytes = buildXlsxFixture([
    {
      name: "Orçamento",
      rows: [
        ["ITEM", "DESCRIÇÃO", "UNID", "QUANT", "VALOR TOTAL"],
        ["1.0", "GRUPO A", "", "", 10],
        ["2.0", "GRUPO B", "", "", 20],
        ["3.0", "GRUPO C", "", "", 30],
      ],
    },
  ]);

  const rawWb = readXlsxWorkbookRaw(bytes);
  const result = importBudgetFromXlsx(rawWb, mockContext);

  assertEqual(result.rows[0]?.position, 1, "first position = 1");
  assertEqual(result.rows[1]?.position, 2, "second position = 2");
  assertEqual(result.rows[2]?.position, 3, "third position = 3");
});

runTest("T09: economic fields mapping (quantity, costs, BDI, total)", () => {
  const bytes = buildXlsxFixture([
    {
      name: "Orçamento",
      rows: [
        ["ITEM", "DESCRIÇÃO", "UNID", "QUANT", "CUSTO UNIT", "BDI", "PREÇO UNIT", "VALOR TOTAL"],
        ["1.0", "GRUPO", "", "", "", "", "", 100],
        ["01.01", "SUBGRUPO", "", "", "", "", "", 100],
        ["01.01.01", "PLACA DE OBRA", "UNID", 14, 3179.23, 0.2418, 3947.96, 55271.44],
      ],
    },
  ]);

  const rawWb = readXlsxWorkbookRaw(bytes);
  const result = importBudgetFromXlsx(rawWb, mockContext);

  const fields = result.rows[2]!.fields;
  assertEqual(fields.quantityText, "14", "expected quantityText");
  assertEqual(fields.unitCostWithoutBdiText, "3179.23", "expected unitCostWithoutBdiText");
  assertEqual(fields.bdiPercentText, "24.18%", "expected bdiPercentText");
  assertEqual(fields.unitPriceWithBdiText, "3947.96", "expected unitPriceWithBdiText");
  assertEqual(fields.totalPriceText, "55271.44", "expected totalPriceText");
});

runTest("T10: rawDecimalFractionToPercentText precision helper", () => {
  assertEqual(rawDecimalFractionToPercentText("0.2418"), "24.18%", "0.2418 -> 24.18%");
  assertEqual(rawDecimalFractionToPercentText("0.25"), "25%", "0.25 -> 25%");
  assertEqual(rawDecimalFractionToPercentText("0.05"), "5%", "0.05 -> 5%");
  assertEqual(rawDecimalFractionToPercentText("0.123456"), "12.3456%", "0.123456 -> 12.3456%");
});

runTest("T11: cached formula values / raw string preservation", () => {
  const bytes = buildXlsxFixture([
    {
      name: "Orçamento",
      rows: [
        ["ITEM", "DESCRIÇÃO", "UNID", "QUANT", "VALOR TOTAL"],
        ["1.0", "GRUPO", "", "", 12345.67],
      ],
    },
  ]);

  const rawWb = readXlsxWorkbookRaw(bytes);
  const result = importBudgetFromXlsx(rawWb, mockContext);

  assertEqual(result.rows[0]?.fields.documentalGroupTotalText, "12345.67", "expected exact raw string value");
});

runTest("T12: skips title, header, empty and note rows", () => {
  const bytes = buildXlsxFixture([
    {
      name: "Orçamento",
      rows: [
        ["GOVERNO DO ESTADO DE ALAGOAS"],
        ["ORÇAMENTO ANALÍTICO DE REFERÊNCIA"],
        [""],
        ["ITEM", "DESCRIÇÃO", "UNID", "QUANT", "VALOR TOTAL"],
        ["1.0", "SERVIÇOS PRELIMINARES", "", "", 5000],
        ["TOTAL GERAL", "", "", "", 5000],
        ["Observações: BDI calculado conforme tabela DNOCS.", "", "", "", ""],
      ],
    },
  ]);

  const rawWb = readXlsxWorkbookRaw(bytes);
  const result = importBudgetFromXlsx(rawWb, mockContext);

  assertEqual(result.rows.length, 1, "only 1 valid group row expected (titles, blank, total general, notes skipped)");
});

runTest("T13: missing required column produces error diagnostic", () => {
  const bytes = buildXlsxFixture([
    {
      name: "PlanilhaIncompleta",
      rows: [
        ["ITEM", "DESCRIÇÃO"], // missing UNID, QUANT, TOTAL
        ["1.0", "TESTE"],
      ],
    },
  ]);

  const rawWb = readXlsxWorkbookRaw(bytes);
  const result = importBudgetFromXlsx(rawWb, mockContext);

  assertEqual(result.rows.length, 0, "expected 0 rows imported when required columns are missing");
  assertEqual(
    result.diagnostics.some((d) => d.code === "MISSING_REQUIRED_COLUMN" || d.code === "SHEET_NOT_FOUND"),
    true,
    "expected MISSING_REQUIRED_COLUMN or SHEET_NOT_FOUND diagnostic",
  );
});

runTest("T14: ambiguous sheet score produces error diagnostic", () => {
  const bytes = buildXlsxFixture([
    {
      name: "Lote 01 A",
      rows: [
        ["ITEM", "DESCRIÇÃO", "UNID", "QUANT", "VALOR TOTAL"],
        ["1.0", "GRUPO A", "", "", 100],
      ],
    },
    {
      name: "Lote 01 B",
      rows: [
        ["ITEM", "DESCRIÇÃO", "UNID", "QUANT", "VALOR TOTAL"],
        ["1.0", "GRUPO B", "", "", 200],
      ],
    },
  ]);

  const rawWb = readXlsxWorkbookRaw(bytes);
  const result = importBudgetFromXlsx(rawWb, mockContext);

  assertEqual(result.rows.length, 0, "expected 0 rows imported when ambiguous sheet detected");
  assertEqual(
    result.diagnostics.some((d) => d.code === "AMBIGUOUS_SHEET"),
    true,
    "expected AMBIGUOUS_SHEET diagnostic",
  );
});

runTest("T15: parent not found produces orphan diagnostic", () => {
  const bytes = buildXlsxFixture([
    {
      name: "Orçamento",
      rows: [
        ["ITEM", "DESCRIÇÃO", "UNID", "QUANT", "VALOR TOTAL"],
        // Subgroup 02.01 without Group 2.0
        ["02.01", "SUBGRUPO ÓRFÃO", "", "", 100],
      ],
    },
  ]);

  const rawWb = readXlsxWorkbookRaw(bytes);
  const result = importBudgetFromXlsx(rawWb, mockContext);

  assertEqual(result.rows.length, 0, "orphan row should be excluded from final imported rows");
  assertEqual(result.summary.orphanCount, 1, "expected 1 orphan count in summary");
  assertEqual(
    result.diagnostics.some((d) => d.code === "ORPHAN_ROW"),
    true,
    "expected ORPHAN_ROW diagnostic",
  );
});

runTest("T16: determinism (two identical runs produce identical output)", () => {
  const bytes = buildXlsxFixture([
    {
      name: "Orçamento",
      rows: [
        ["ITEM", "FONTE", "CÓDIGO", "DESCRIÇÃO", "UNID", "QUANT", "CUSTO UNIT", "BDI", "PREÇO UNIT", "VALOR TOTAL"],
        ["1.0", "", "", "SERVIÇOS PRELIMINARES", "", "", "", "", "", 1000],
        ["01.01", "", "", "INSTALAÇÕES", "", "", "", "", "", 1000],
        ["01.01.01", "SINAPI", "74209/001", "PLACA DE OBRA", "UNID", 14.0, 3179.23, 0.2418, 3947.96, 55271.44],
      ],
    },
  ]);

  const rawWb1 = readXlsxWorkbookRaw(bytes);
  const result1 = importBudgetFromXlsx(rawWb1, mockContext);

  const rawWb2 = readXlsxWorkbookRaw(bytes);
  const result2 = importBudgetFromXlsx(rawWb2, mockContext);

  assertEqual(JSON.stringify(result1), JSON.stringify(result2), "two runs must produce identical output");
});

runTest("T17: evidence text formatting", () => {
  const bytes = buildXlsxFixture([
    {
      name: "Orçamento",
      rows: [
        ["ITEM", "DESCRIÇÃO", "UNID", "QUANT", "VALOR TOTAL"],
        ["1.0", "SERVIÇOS PRELIMINARES", "", "", 1000],
      ],
    },
  ]);

  const rawWb = readXlsxWorkbookRaw(bytes);
  const result = importBudgetFromXlsx(rawWb, mockContext);

  const evidence = result.rows[0]?.evidenceText ?? "";
  assertEqual(evidence.includes("mechanism=xlsx_structured_import"), true, "should include mechanism");
  assertEqual(evidence.includes("version=" + BUDGET_XLSX_IMPORTER_VERSION), true, "should include version");
  assertEqual(evidence.includes("sheet=Orçamento"), true, "should include sheet name");
});

// ---------------------------------------------------------------------------
// Test Runner Helpers
// ---------------------------------------------------------------------------

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
