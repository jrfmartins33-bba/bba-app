import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { importPlanningExcel } from "../../../../packages/bdos-core/src/domain/schedule-management/adapters/excel-import/excel-import";
import {
  buildMeasurementPhysicalFinancialAnalysis,
  type MeasurementPhysicalFinancialAnalysis
} from "./measurement-physical-financial-analysis-service";
import type { PlanningDataset } from "@bba/bdos-core/domain/schedule-management";

// run-tests.mjs executa cada arquivo com cwd = diretório do package.json
// mais próximo (apps/web). O arquivo-fonte real vive na raiz do repo.
const REPO_ROOT = resolve(process.cwd(), "..", "..");
const REAL_CURVA_S = resolve(REPO_ROOT, "CURVA S_MED-08_R_00.xlsx");

function realDataset(): PlanningDataset {
  const bytes = new Uint8Array(readFileSync(REAL_CURVA_S));
  const result = importPlanningExcel({ bytes, fileName: "CURVA S_MED-08_R_00.xlsx", importedAt: "2026-08-27T00:00:00.000Z" });
  return result.dataset;
}

function analyze(): MeasurementPhysicalFinancialAnalysis {
  return buildMeasurementPhysicalFinancialAnalysis({
    planningDataset: realDataset(),
    datasetId: "dataset-under-test",
    sourceFileName: "CURVA S_MED-08_R_00.xlsx",
    measurementPeriod: { startDate: "2026-06-01", endDate: "2026-06-30" },
    measuredItemCodes: ["01.05.03", "02.01.00", "11.02.01", "99.01.00", "sem-codigo"]
  });
}

runTest("obra no mês 8 (junho/2026): valores acumulados verbatim da série agregada + situação determinística", () => {
  const obra = analyze().obra;
  assertTrue(obra !== null, "obra deve estar disponível para junho/2026");
  assertEqual(obra?.periodLabel, "mês 8", "período localizado por ano-mês da data de fim");
  assertEqual(obra?.plannedAccumulatedValueDecimal, "7166007.71", "planejado acumulado da obra (R$)");
  assertEqual(obra?.actualAccumulatedValueDecimal, "4772540.69", "realizado acumulado da obra (R$)");
  assertEqual(obra?.deviationValueDecimal, "-2393467.02", "desvio da obra (realizado - planejado)");
  assertEqual(obra?.plannedAccumulatedPercent, "94.14", "percentual planejado acumulado da obra");
  assertEqual(obra?.actualAccumulatedPercent, "62.70", "percentual realizado acumulado da obra");
  assertEqual(obra?.deviationPercentPoints, "-31.44", "desvio da obra em pontos percentuais");
  assertEqual(obra?.situation, "below_planned", "realizado < planejado -> abaixo do previsto");
});

runTest("Grupo 01 (Serviços Preliminares) no mês 8: acumulado somado das células mensais, nunca do BAC", () => {
  const group = analyze().groups.find((candidate) => candidate.groupCode === "1.0");
  assertTrue(group !== undefined, "grupo 1.0 deve ser reconhecido");
  assertEqual(group?.groupName, "SERVIÇOS PRELIMINARES E IMPLANTAÇÃO DO CANTEIRO DE OBRAS", "nome real do grupo");
  assertEqual(group?.plannedPeriodValueDecimal, "155876.66", "planejado no período (mês 8)");
  assertEqual(group?.actualPeriodValueDecimal, "42015.69", "realizado no período (mês 8)");
  assertEqual(group?.plannedAccumulatedValueDecimal, "1465240.63", "planejado acumulado (soma das parcelas mensais até mês 8)");
  assertEqual(group?.actualAccumulatedValueDecimal, "969649.18", "realizado acumulado até mês 8");
  assertEqual(group?.plannedAccumulatedPercent, "94.00", "percentual planejado acumulado do grupo");
  assertEqual(group?.actualAccumulatedPercent, "62.21", "percentual realizado acumulado do grupo");
  assertEqual(group?.deviationValueDecimal, "-495591.45", "desvio do grupo em R$");
  assertEqual(group?.deviationPercentPoints, "-31.79", "desvio do grupo em pontos percentuais");
  assertEqual(group?.situation, "below_planned", "grupo 1.0 abaixo do previsto");
});

runTest("Grupo 02 (Terraplenagem) no mês 8: planejado acumulado = 100% do grupo, realizado abaixo", () => {
  const group = analyze().groups.find((candidate) => candidate.groupCode === "2.0");
  assertTrue(group !== undefined, "grupo 2.0 deve ser reconhecido");
  assertEqual(group?.groupName, "TERRAPLENAGEM", "nome real do grupo");
  assertEqual(group?.plannedPeriodValueDecimal, "0.00", "nada planejado no mês 8 para terraplenagem");
  assertEqual(group?.actualPeriodValueDecimal, "210639.09", "realizado no período (mês 8)");
  assertEqual(group?.plannedAccumulatedValueDecimal, "2881755.82", "planejado acumulado = total do grupo");
  assertEqual(group?.actualAccumulatedValueDecimal, "2406254.79", "realizado acumulado até mês 8");
  assertEqual(group?.plannedAccumulatedPercent, "100.00", "percentual planejado acumulado do grupo");
  assertEqual(group?.actualAccumulatedPercent, "83.50", "percentual realizado acumulado do grupo");
  assertEqual(group?.deviationValueDecimal, "-475501.03", "desvio do grupo em R$");
  assertEqual(group?.situation, "below_planned", "grupo 2.0 abaixo do previsto");
});

runTest("correlação item -> grupo é determinística por prefixo, sem fuzzy e sem casar ajustes", () => {
  const analysis = analyze();
  assertEqual(analysis.itemGroupByCode.get("01.05.03"), "1.0", "01.xx.xx resolve o grupo 1.0");
  assertEqual(analysis.itemGroupByCode.get("02.01.00"), "2.0", "02.xx.xx resolve o grupo 2.0");
  assertEqual(analysis.itemGroupByCode.get("11.02.01"), "11.0", "11.xx.xx resolve o grupo 11.0");
  assertEqual(analysis.itemGroupByCode.has("99.01.00"), false, "prefixo sem grupo real não entra");
  assertEqual(analysis.itemGroupByCode.has("sem-codigo"), false, "código não hierárquico não entra");
});

runTest("linhas de ajuste (ARREDONDAMENTO / MANUTENÇÃO DO DESCONTO) nunca viram grupos de execução", () => {
  const analysis = analyze();
  const groupNames = analysis.groups.map((group) => group.groupName);
  assertEqual(groupNames.includes("ARREDONDAMENTO CONTRATUAL"), false, "arredondamento não é grupo");
  assertEqual(
    groupNames.includes("MANUTENÇÃO DO DESCONTO OFERTADO NA PROPOSTA VENCEDORA"),
    false,
    "manutenção do desconto não é grupo"
  );
  assertEqual(analysis.groups.every((group) => /^\d+\.0$/.test(group.groupCode)), true, "todo grupo tem código N.0");
  assertTrue(
    analysis.adjustments.some((row) => row.name === "ARREDONDAMENTO CONTRATUAL"),
    "ajustes ficam listados à parte"
  );
});

runTest("os 11 grupos oficiais do cronograma são reconhecidos e ordenados", () => {
  const codes = analyze().groups.map((group) => group.groupCode);
  assertEqual(codes.join(","), "1.0,2.0,3.0,4.0,5.0,6.0,7.0,8.0,9.0,10.0,11.0", "grupos 1.0..11.0 em ordem numérica");
});

runTest("dataset v1 (sem série por grupo) degrada grupos para indisponível, mas mantém a obra", () => {
  const full = realDataset();
  const v1Like: PlanningDataset = {
    ...full,
    periodSeries: full.periodSeries.filter((series) => series.activityId === null)
  };
  const analysis = buildMeasurementPhysicalFinancialAnalysis({
    planningDataset: v1Like,
    datasetId: "v1",
    sourceFileName: "CURVA S_MED-08_R_00.xlsx",
    measurementPeriod: { startDate: "2026-06-01", endDate: "2026-06-30" },
    measuredItemCodes: ["01.05.03"]
  });
  assertEqual(analysis.obraAvailable, true, "obra continua disponível a partir da série agregada");
  assertEqual(analysis.groupsAvailable, false, "grupos indisponíveis sem série mensal por grupo");
  assertTrue((analysis.groupsUnavailableReason ?? "").length > 0, "motivo explícito, sem invenção");
  assertEqual(analysis.groups.length, 0, "nenhum grupo inventado");
});

runTest("sem cronograma físico-financeiro consolidado -> tudo indisponível, com motivo", () => {
  const analysis = buildMeasurementPhysicalFinancialAnalysis({
    planningDataset: null,
    datasetId: null,
    sourceFileName: null,
    measurementPeriod: { startDate: "2026-06-01", endDate: "2026-06-30" },
    measuredItemCodes: ["01.05.03"]
  });
  assertEqual(analysis.obraAvailable, false, "obra indisponível");
  assertEqual(analysis.groupsAvailable, false, "grupos indisponíveis");
  assertTrue((analysis.obraUnavailableReason ?? "").length > 0, "motivo explícito");
});

runTest("período fora da planilha -> indisponível, nunca extrapola", () => {
  const analysis = buildMeasurementPhysicalFinancialAnalysis({
    planningDataset: realDataset(),
    datasetId: "d",
    sourceFileName: "CURVA S_MED-08_R_00.xlsx",
    measurementPeriod: { startDate: "2030-01-01", endDate: "2030-01-31" },
    measuredItemCodes: ["01.05.03"]
  });
  assertEqual(analysis.obraAvailable, false, "obra indisponível para período inexistente");
  assertTrue((analysis.obraUnavailableReason ?? "").includes("período"), "motivo menciona o período");
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

function assertTrue(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}
