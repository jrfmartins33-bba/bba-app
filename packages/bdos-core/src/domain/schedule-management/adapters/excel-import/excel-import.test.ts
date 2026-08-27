import { buildXlsxFixture } from "./xlsx-test-fixtures";
import { importPlanningExcel } from "./excel-import";

runTest("imports a classic cronograma sheet with dates and dependencies", () => {
  const bytes = buildXlsxFixture([
    {
      name: "Cronograma",
      rows: [
        ["EAP", "Atividade", "Início", "Fim", "Duração", "Predecessoras"],
        ["1", "Escavação", "2026-01-05", "2026-01-12", 8, null],
        ["2", "Concretagem", "2026-01-13", "2026-01-20", 7, "1"],
      ],
    },
  ]);

  const result = importPlanningExcel({ bytes, fileName: "cronograma.xlsx", importedAt: "2026-07-06T00:00:00.000Z" });

  assertEqual(result.success, true, "expected import success");
  assertEqual(result.dataset.detectedType, "cronograma", "expected cronograma detection");
  assertEqual(result.dataset.activities.length, 2, "expected 2 activities");
  assertEqual(result.dataset.activities[0]?.plannedStart, "2026-01-05", "expected a real planned start date");
  assertEqual(
    result.dataset.warnings.some((warning) => warning.code === "missing_dependencies"),
    false,
    "should not warn about missing dependencies when a predecessors column exists",
  );
});

runTest("imports a período-matrix (físico-financeiro) sheet without dates or dependencies", () => {
  const bytes = buildXlsxFixture([
    {
      name: "CRONOGRAMA FÍSICO-FINANCEIRO",
      rows: [
        ["", "ITEM", "DESCRIÇÃO", "", "", "VALOR TOTAL (R$)", "CONTROLE"],
        ["", "", "", "", "", "", "", "mês 1", "mês 2", "mês 3"],
        ["", "1.0", "Terraplenagem", "", "", 100000, "PREVISTO", 0.5, 0.5, null],
        ["", "", "", "", "", "", "", 50000, 50000, null],
        ["", "", "", "", "", "", "REALIZADO", 0.4, 0.1, null],
        ["", "", "", "", "", "", "", 40000, 10000, null],
      ],
    },
  ]);

  const result = importPlanningExcel({ bytes, fileName: "fisico-financeiro.xlsx", importedAt: "2026-07-06T00:00:00.000Z" });

  assertEqual(result.success, true, "expected import success");
  assertEqual(result.dataset.detectedType, "fisico-financeiro", "expected fisico-financeiro detection");
  assertEqual(result.dataset.activities.length, 1, "expected 1 activity");
  assertEqual(result.dataset.activities[0]?.plannedStart, null, "físico-financeiro items have no individual dates");
  assertEqual(result.dataset.activities[0]?.plannedValue, 100000, "expected planned value to sum correctly across periods");
  assertEqual(result.dataset.activities[0]?.actualValue, 50000, "expected actual value to sum correctly across periods");
  assertEqual(
    result.dataset.warnings.some((warning) => warning.code === "missing_dependencies"),
    true,
    "expected a missing_dependencies warning for a período-matrix sheet",
  );
  assertEqual(
    result.dataset.warnings.some((warning) => warning.code === "missing_dates"),
    true,
    "expected a missing_dates warning for a período-matrix sheet",
  );
});

runTest("período-matrix emits one verbatim MONTHLY series per group (Cronograma Físico-Financeiro por Grupo)", () => {
  const bytes = buildXlsxFixture([
    {
      name: "CRONOGRAMA FÍSICO-FINANCEIRO",
      rows: [
        ["", "ITEM", "DESCRIÇÃO", "", "", "VALOR TOTAL (R$)", "CONTROLE"],
        ["", "", "", "", "", "", "", "mês 1", "mês 2", "mês 3"],
        ["", "1.0", "Terraplenagem", "", "", 100000, "PREVISTO", 0.5, 0.5, null],
        ["", "", "", "", "", "", "", 50000, 50000, null],
        ["", "", "", "", "", "", "REALIZADO", 0.4, 0.1, null],
        ["", "", "", "", "", "", "", 40000, 10000, null],
        ["", "2.0", "Concreto", "", "", 60000, "PREVISTO", null, 0.5, 0.5],
        ["", "", "", "", "", "", "", null, 30000, 30000],
        ["", "", "", "", "", "", "REALIZADO", null, 0.5, null],
        ["", "", "", "", "", "", "", null, 30000, null],
      ],
    },
  ]);

  const result = importPlanningExcel({ bytes, fileName: "fisico-financeiro.xlsx", importedAt: "2026-07-06T00:00:00.000Z" });

  const groupSeries = result.dataset.periodSeries.filter((series) => series.activityId !== null);
  assertEqual(groupSeries.length, 2, "expected one monthly series per group");

  const first = result.dataset.periodSeries.find((series) => series.activityId === result.dataset.activities[0]?.id);
  assertEqual(first !== undefined, true, "expected a series keyed by the first activity's id");
  assertEqual(first?.points.length, 3, "no date row -> every period column kept (verbatim fallback)");
  assertEqual(first?.points[0]?.plannedValue, 50000, "series point holds the MONTHLY planned value verbatim, not accumulated");
  assertEqual(first?.points[1]?.plannedValue, 50000, "second month planned value stays monthly (not 100000 accumulated)");
  assertEqual(first?.points[0]?.actualPercent, 0.4, "series point holds the raw REALIZADO % cell");
  assertEqual(first?.points[1]?.actualValue, 10000, "series point holds the MONTHLY actual value verbatim");

  const second = result.dataset.periodSeries.find((series) => series.activityId === result.dataset.activities[1]?.id);
  assertEqual(second?.points[0]?.plannedValue ?? null, null, "an empty leading month stays null — never coerced to 0");
  assertEqual(second?.points[2]?.plannedValue, 30000, "third month planned value verbatim");
});

runTest("período-matrix drops residual template columns (undated / date going backwards) from every series", () => {
  // Datas: mês 1 = 2025-11-01 (45962), mês 2 = 2025-12-01 (45992),
  // mês 3 = sem data, mês 4 = 2025-08-01 (45870, ANTES do mês 1).
  // Canônicos = só mês 1 e mês 2 (prefixo datado e crescente).
  const bytes = buildXlsxFixture([
    {
      name: "CRONOGRAMA FÍSICO-FINANCEIRO",
      rows: [
        ["", "ITEM", "DESCRIÇÃO", "", "", "VALOR TOTAL (R$)", "CONTROLE"],
        ["", "", "", "", "", "", "", "mês 1", "mês 2", "mês 3", "mês 4"],
        ["", "", "", "", "", "", "", 45962, 45992, null, 45870],
        ["", "1.0", "Terraplenagem", "", "", 100000, "PREVISTO", 0.25, 0.25, 0.25, 0.25],
        ["", "", "", "", "", "", "", 25000, 25000, 25000, 25000],
        ["", "", "", "", "", "", "REALIZADO", 0.2, 0.1, 0, 0],
        ["", "", "", "", "", "", "", 20000, 10000, 0, 0],
      ],
    },
  ]);

  const result = importPlanningExcel({ bytes, fileName: "fisico-financeiro.xlsx", importedAt: "2026-07-06T00:00:00.000Z" });

  const series = result.dataset.periodSeries.find((s) => s.activityId === result.dataset.activities[0]?.id);
  assertEqual(series?.points.length, 2, "só os meses canônicos (1 e 2) entram na série");
  assertEqual(series?.points.every((p) => p.date !== null), true, "todo ponto canônico tem data real");
  assertEqual(series?.points[0]?.date, "2025-11-01", "primeiro período datado");
  assertEqual(series?.points[1]?.date, "2025-12-01", "segundo período datado");
  assertEqual(result.dataset.activities[0]?.plannedValue, 50000, "somatório do item ignora as colunas-resíduo (25000+25000, nunca +25000+25000)");
  assertEqual(result.dataset.activities[0]?.actualValue, 30000, "realizado do item só sobre meses canônicos (20000+10000)");
});

runTest("never invents a predecessor when the sheet has no predecessors column", () => {
  const bytes = buildXlsxFixture([
    {
      name: "Cronograma",
      rows: [
        ["EAP", "Atividade", "Início", "Fim", "Duração"],
        ["1", "Escavação", "2026-01-05", "2026-01-12", 8],
        ["2", "Concretagem", "2026-01-13", "2026-01-20", 7],
      ],
    },
  ]);

  const result = importPlanningExcel({ bytes, fileName: "cronograma-sem-dependencias.xlsx", importedAt: "2026-07-06T00:00:00.000Z" });

  assertEqual(
    result.dataset.activities.every((activity) => activity.dependencies.length === 0),
    true,
    "expected zero dependencies on every activity — none should be fabricated",
  );
  assertEqual(
    result.dataset.warnings.some((warning) => warning.code === "missing_dependencies"),
    true,
    "expected a missing_dependencies warning",
  );
});

runTest("skips hidden sheets with a structured warning", () => {
  const bytes = buildXlsxFixture([
    { name: "Principal", rows: [["EAP", "Atividade", "Início", "Fim"], ["1", "A", "2026-01-01", "2026-01-05"]] },
    { name: "Fotos", hidden: true, rows: [["Descrição:"], ["Foto 1"]] },
  ]);

  const result = importPlanningExcel({ bytes, fileName: "com-aba-oculta.xlsx", importedAt: "2026-07-06T00:00:00.000Z" });

  assertEqual(result.dataset.origin.sheetName, "Principal", "expected the visible sheet to be used as primary");
  assertEqual(
    result.dataset.warnings.some((warning) => warning.code === "hidden_sheet_skipped" && warning.sheetName === "Fotos"),
    true,
    "expected a hidden_sheet_skipped warning naming the hidden sheet",
  );
});

runTest("returns a structured warning, not a crash, when no columns are recognized", () => {
  const bytes = buildXlsxFixture([{ name: "Desconhecida", rows: [["Foo", "Bar"], ["x", "y"]] }]);

  const result = importPlanningExcel({ bytes, fileName: "desconhecida.xlsx", importedAt: "2026-07-06T00:00:00.000Z" });

  assertEqual(result.success, false, "expected failure when nothing can be recognized");
  assertEqual(result.dataset.activities.length, 0, "expected zero activities");
  assertEqual(
    result.dataset.warnings.some((warning) => warning.code === "no_activities_recognized"),
    true,
    "expected a no_activities_recognized warning",
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
