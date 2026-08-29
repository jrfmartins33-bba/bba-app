import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { importPlanningExcel } from "../../../../packages/bdos-core/src/domain/schedule-management/adapters/excel-import/excel-import";
import {
  buildPhysicalFinancialExecutionHistory,
  type PhysicalFinancialExecutionHistory,
  type PhysicalFinancialHistoryPoint
} from "./measurement-physical-financial-analysis-service";
import {
  buildExecutionHistoryNoRealizationSummary,
  formatHistoryMonthLabel
} from "../../components/measurement/measurement-managerial-control-view-model";
import type { PlanningDataset } from "@bba/bdos-core/domain/schedule-management";

/**
 * Reproduz o que a UI faz: para um período SEM realização, procura o
 * último período anterior COM realização e monta o texto-resumo. Só
 * apresentação — nenhum recálculo.
 */
function noRealizationSummary(obra: ReadonlyArray<PhysicalFinancialHistoryPoint>, index: number): string {
  const point = obra[index];
  const prior =
    obra
      .slice(0, index)
      .reverse()
      .find((candidate) => candidate.actualAccumulatedValueDecimal !== null) ?? null;
  return buildExecutionHistoryNoRealizationSummary({
    selectedMonthLabel: formatHistoryMonthLabel(point),
    plannedPeriodValueDecimal: point.plannedPeriodValueDecimal,
    lastRealized:
      prior && prior.actualAccumulatedValueDecimal !== null
        ? { monthLabel: formatHistoryMonthLabel(prior), actualAccumulatedValueDecimal: prior.actualAccumulatedValueDecimal }
        : null
  });
}

// "Evolução da execução" (Parte A) — histórico OBRA × mês e GRUPO × mês
// a partir da Curva S consolidada. Mesmas primitivas de
// buildMeasurementPhysicalFinancialAnalysis, só que a série inteira.
// run-tests.mjs executa com cwd = apps/web; o arquivo-fonte real vive na
// raiz do repo (mesma convenção de
// measurement-physical-financial-analysis-service.test.ts).
const REPO_ROOT = resolve(process.cwd(), "..", "..");
const REAL_CURVA_S = resolve(REPO_ROOT, "CURVA S_MED-08_R_00.xlsx");

function realDataset(): PlanningDataset {
  const bytes = new Uint8Array(readFileSync(REAL_CURVA_S));
  return importPlanningExcel({ bytes, fileName: "CURVA S_MED-08_R_00.xlsx", importedAt: "2026-08-27T00:00:00.000Z" }).dataset;
}

function history(): PhysicalFinancialExecutionHistory {
  return buildPhysicalFinancialExecutionHistory({
    planningDataset: realDataset(),
    datasetId: "dataset-under-test",
    sourceFileName: "CURVA S_MED-08_R_00.xlsx"
  });
}

const CANONICAL_PERIOD_DATES = [
  "2025-11-01",
  "2025-12-01",
  "2026-01-01",
  "2026-02-01",
  "2026-03-01",
  "2026-04-01",
  "2026-05-01",
  "2026-06-01",
  "2026-07-01"
];

const OBRA_MONTHLY_REALIZED: Array<string | null> = [
  "848251.64", // nov/2025
  "889960.94", // dez/2025
  "506272.58", // jan/2026
  "539241.16", // fev/2026
  "582597.90", // mar/2026
  "857022.82", // abr/2026
  "296538.87", // mai/2026
  "252654.78", // jun/2026
  null // jul/2026 — Curva S ainda não traz realização (mês futuro); null, nunca 0
];

runTest("períodos canônicos: exatamente 9 meses (mês 1..9), nenhum mês 10–14", () => {
  const h = history();
  assertEqual(h.available, true, "histórico disponível a partir da Curva S consolidada");
  assertEqual(h.periods.length, 9, "9 períodos canônicos");
  assertEqual(h.obra.length, 9, "obra: 9 pontos");
  assertEqual(
    h.periods.map((period) => period.date).join(","),
    CANONICAL_PERIOD_DATES.join(","),
    "datas canônicas mês 1..9"
  );
  const forbidden = h.periods.filter((period) => period.date >= "2026-08-01");
  assertEqual(forbidden.length, 0, "nenhum mês 10–14 (>= 2026-08-01) aparece");
});

runTest("obra: realizado NO PERÍODO por mês = subtração exata de acumulados consecutivos (nov/25..jun/26)", () => {
  const h = history();
  h.obra.forEach((point, index) => {
    assertEqual(
      point.actualPeriodValueDecimal,
      OBRA_MONTHLY_REALIZED[index],
      `realizado no período de ${point.periodDate}`
    );
  });
});

runTest("obra: realizado acumulado até junho/2026 = 4.772.540,69 e situação abaixo do previsto", () => {
  const h = history();
  const june = h.obra.find((point) => point.periodDate === "2026-06-01");
  assertTrue(june !== undefined, "mês de junho presente");
  assertEqual(june?.actualAccumulatedValueDecimal, "4772540.69", "realizado acumulado da obra em junho");
  assertEqual(june?.plannedAccumulatedValueDecimal, "7166007.71", "planejado acumulado da obra em junho");
  assertEqual(june?.actualAccumulatedPercent, "62.70", "percentual realizado acumulado");
  assertEqual(june?.plannedAccumulatedPercent, "94.14", "percentual planejado acumulado");
  assertEqual(june?.situation, "below_planned", "realizado < planejado");
});

runTest("obra: a soma dos realizados NO PERÍODO fecha com o realizado acumulado (sem deriva de centavos)", () => {
  const h = history();
  const realized = h.obra.filter((point) => point.actualPeriodValueDecimal !== null);
  const sum = realized.reduce((acc, point) => acc + decimalToCents(point.actualPeriodValueDecimal as string), 0n);
  const lastRealized = realized[realized.length - 1];
  assertEqual(
    sum,
    decimalToCents(lastRealized.actualAccumulatedValueDecimal as string),
    "Σ realizado no período = realizado acumulado do último mês com dados"
  );
  assertEqual(sum, 477254069n, "= R$ 4.772.540,69 em centavos");
});

runTest("obra: mês futuro sem realização (jul/2026) fica null em tudo que depende de realizado — nunca 0", () => {
  const h = history();
  const july = h.obra.find((point) => point.periodDate === "2026-07-01");
  assertTrue(july !== undefined, "mês 9 presente na série (planejado existe)");
  assertEqual(july?.actualPeriodValueDecimal, null, "realizado no período = null");
  assertEqual(july?.actualAccumulatedValueDecimal, null, "realizado acumulado = null");
  assertEqual(july?.deviationAccumulatedValueDecimal, null, "desvio = null");
  assertEqual(july?.situation, null, "situação = null (sem realização para comparar)");
  assertEqual(july?.plannedAccumulatedValueDecimal, "7611851.65", "planejado acumulado do mês 9 = valor do contrato");
});

runTest("grupo 1 (Serviços Preliminares) em junho/2026: realizado no período = 42.015,69", () => {
  const h = history();
  const group = h.groups.find((candidate) => candidate.groupCode === "1.0");
  assertTrue(group !== undefined, "grupo 1.0 reconhecido");
  assertEqual(group?.groupName, "SERVIÇOS PRELIMINARES E IMPLANTAÇÃO DO CANTEIRO DE OBRAS", "nome real");
  assertEqual(group?.points.length, 9, "9 pontos mensais");
  const june = group?.points.find((point) => point.periodDate === "2026-06-01");
  assertEqual(june?.actualPeriodValueDecimal ?? null, "42015.69", "realizado no período (junho) do grupo 1");
  assertEqual(june?.actualAccumulatedValueDecimal ?? null, "969649.18", "realizado acumulado do grupo 1 em junho");
});

runTest("grupo 2 (Terraplenagem) em junho/2026: realizado no período = 210.639,09", () => {
  const h = history();
  const group = h.groups.find((candidate) => candidate.groupCode === "2.0");
  assertTrue(group !== undefined, "grupo 2.0 reconhecido");
  const june = group?.points.find((point) => point.periodDate === "2026-06-01");
  assertEqual(june?.actualPeriodValueDecimal ?? null, "210639.09", "realizado no período (junho) do grupo 2");
});

runTest("invariante de reconciliação: Σ realizado no período dos 11 grupos em junho/2026 = 252.654,78 = BM08", () => {
  const h = history();
  const juneGroupCents = h.groups.reduce((acc, group) => {
    const june = group.points.find((point) => point.periodDate === "2026-06-01");
    return acc + decimalToCents(june?.actualPeriodValueDecimal ?? "0.00");
  }, 0n);
  assertEqual(juneGroupCents, 25265478n, "Σ grupos junho = R$ 252.654,78 (mesmo valor do BM nº 08)");

  const obraJune = h.obra.find((point) => point.periodDate === "2026-06-01");
  assertEqual(decimalToCents(obraJune?.actualPeriodValueDecimal ?? "0.00"), 25265478n, "obra junho = Σ grupos junho");
});

runTest("11 grupos oficiais reconhecidos e ordenados por número do grupo", () => {
  const h = history();
  assertEqual(h.groups.length, 11, "11 grupos");
  const codes = h.groups.map((group) => group.groupCode);
  const sorted = [...codes].sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));
  assertEqual(codes.join(","), sorted.join(","), "ordenados por número do grupo");
});

runTest("grupo em jul/2026 com planejamento e realização AUSENTE -> null em tudo que depende de realizado; nunca 'abaixo do previsto'", () => {
  const h = history();
  // Ao menos 2 grupos têm planejado em julho e realização ausente (Curva S só realiza até junho).
  const groupsJuly = h.groups
    .map((g) => ({ groupCode: g.groupCode, groupName: g.groupName, july: g.points.find((p) => p.periodDate === "2026-07-01") ?? null }))
    .filter((entry): entry is { groupCode: string; groupName: string; july: NonNullable<typeof entry.july> } => entry.july !== null);

  const withPlannedJuly = groupsJuly.filter((entry) => entry.july.plannedPeriodValueDecimal !== "0.00" || entry.july.plannedAccumulatedValueDecimal !== "0.00");
  assertTrue(withPlannedJuly.length >= 2, "pelo menos 2 grupos com planejamento em julho");

  for (const entry of groupsJuly) {
    assertEqual(entry.july.actualPeriodValueDecimal, null, `${entry.groupCode}: realizado no período de julho = null (ausência, nunca 0)`);
    assertEqual(entry.july.actualAccumulatedValueDecimal, null, `${entry.groupCode}: acumulado realizado de julho = null (não carrega o acumulado anterior)`);
    assertEqual(entry.july.actualAccumulatedPercent, null, `${entry.groupCode}: % realizado acumulado de julho = null`);
    assertEqual(entry.july.deviationAccumulatedValueDecimal, null, `${entry.groupCode}: desvio de julho = null`);
    assertEqual(entry.july.deviationAccumulatedPercentPoints, null, `${entry.groupCode}: desvio p.p. de julho = null`);
    assertEqual(entry.july.situation, null, `${entry.groupCode}: situação de julho = null — nunca 'below_planned' num mês sem realização`);
    assertTrue(entry.july.situation !== "below_planned" && entry.july.situation !== "above_planned", `${entry.groupCode}: nunca classificado como atrasado/adiantado em julho`);
  }

  // O planejado do grupo em julho segue disponível quando existe.
  const g1July = groupsJuly.find((e) => e.groupCode === "1.0");
  assertTrue(g1July !== undefined && Number.parseFloat(g1July.july.plannedPeriodValueDecimal) > 0, "grupo 1 mantém o planejado do período de julho");
});

runTest("grupo em junho/2026 (COM realização) continua com situação e acumulado normais — só o mês vazio muda", () => {
  const h = history();
  const g1June = h.groups.find((g) => g.groupCode === "1.0")?.points.find((p) => p.periodDate === "2026-06-01");
  assertTrue(g1June !== undefined, "junho do grupo 1 presente");
  assertEqual(g1June?.actualPeriodValueDecimal ?? null, "42015.69", "realizado no período de junho intacto");
  assertEqual(g1June?.actualAccumulatedValueDecimal ?? null, "969649.18", "acumulado realizado de junho intacto");
  assertTrue(g1June?.situation !== null, "situação de junho continua definida");
});

runTest("texto-resumo de jul/2026 (sem realização): aponta o acumulado disponível até jun/2026, não 'sem realização no acumulado'", () => {
  const h = history();
  const julyIndex = h.obra.findIndex((point) => point.periodDate === "2026-07-01");
  assertTrue(julyIndex >= 0, "julho presente na série");
  assertEqual(h.obra[julyIndex].situation, null, "julho sem realização documentada");

  const text = noRealizationSummary(h.obra, julyIndex);
  assertTrue(text.includes("Sem realização registrada em jul/26"), `contém 'Sem realização registrada em jul/26' -> ${text}`);
  assertTrue(text.includes("realizado acumulado disponível até jun/26"), `contém 'realizado acumulado disponível até jun/26' -> ${text}`);
  assertTrue(text.includes("R$ 4.772.540,69"), `contém o acumulado real R$ 4.772.540,69 -> ${text}`);
  assertTrue(text.includes("planejado no período: R$ 445.843,94"), `contém 'planejado no período: R$ 445.843,94' -> ${text}`);
  assertTrue(!text.includes("Sem realização no acumulado até jul/26"), "NÃO contém o texto antigo enganoso");
});

runTest("texto-resumo genérico: período futuro sem realizado + último período anterior realizado (sem hardcode)", () => {
  const obra: PhysicalFinancialHistoryPoint[] = [
    {
      periodLabel: "mês 1",
      periodDate: "2030-01-01",
      plannedPeriodValueDecimal: "1000.00",
      actualPeriodValueDecimal: "800.00",
      plannedAccumulatedValueDecimal: "1000.00",
      actualAccumulatedValueDecimal: "800.00",
      plannedAccumulatedPercent: "50.00",
      actualAccumulatedPercent: "40.00",
      deviationAccumulatedValueDecimal: "-200.00",
      deviationAccumulatedPercentPoints: "-10.00",
      situation: "below_planned"
    },
    {
      periodLabel: "mês 2",
      periodDate: "2030-02-01",
      plannedPeriodValueDecimal: "1000.00",
      actualPeriodValueDecimal: null,
      plannedAccumulatedValueDecimal: "2000.00",
      actualAccumulatedValueDecimal: null,
      plannedAccumulatedPercent: null,
      actualAccumulatedPercent: null,
      deviationAccumulatedValueDecimal: null,
      deviationAccumulatedPercentPoints: null,
      situation: null
    }
  ];
  const text = noRealizationSummary(obra, 1);
  assertEqual(
    text,
    "Sem realização registrada em fev/30 · realizado acumulado disponível até jan/30: R$ 800,00 · planejado no período: R$ 1.000,00.",
    "frase montada genericamente do read model"
  );
});

runTest("texto-resumo genérico: nenhum período anterior com realização -> não inventa acumulado", () => {
  const obra: PhysicalFinancialHistoryPoint[] = [
    {
      periodLabel: "mês 1",
      periodDate: "2030-01-01",
      plannedPeriodValueDecimal: "1000.00",
      actualPeriodValueDecimal: null,
      plannedAccumulatedValueDecimal: "1000.00",
      actualAccumulatedValueDecimal: null,
      plannedAccumulatedPercent: null,
      actualAccumulatedPercent: null,
      deviationAccumulatedValueDecimal: null,
      deviationAccumulatedPercentPoints: null,
      situation: null
    }
  ];
  const text = noRealizationSummary(obra, 0);
  assertEqual(
    text,
    "Sem realização registrada em jan/30 · planejado no período: R$ 1.000,00.",
    "sem acumulado anterior, a frase omite a parte do acumulado (nunca inventa)"
  );
});

runTest("período COM realização mantém o texto atual (badge de situação + acumulado)", () => {
  const h = history();
  const juneIndex = h.obra.findIndex((point) => point.periodDate === "2026-06-01");
  assertTrue(h.obra[juneIndex].situation !== null, "junho tem situação -> caminho do texto atual, não o de 'sem realização'");
});

runTest("sem cronograma físico-financeiro consolidado -> indisponível, com motivo, nunca inventa", () => {
  const h = buildPhysicalFinancialExecutionHistory({ planningDataset: null, datasetId: null, sourceFileName: null });
  assertEqual(h.available, false, "indisponível");
  assertEqual(h.obra.length, 0, "sem pontos");
  assertEqual(h.groups.length, 0, "sem grupos");
  assertTrue((h.unavailableReason ?? "").length > 0, "motivo explícito");
});

function decimalToCents(decimal: string): bigint {
  const negative = decimal.startsWith("-");
  const unsigned = negative ? decimal.slice(1) : decimal;
  const [integerPart, fractionalPart = ""] = unsigned.split(".");
  const cents = BigInt(integerPart || "0") * 100n + BigInt((fractionalPart + "00").slice(0, 2) || "0");
  return negative ? -cents : cents;
}

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
  if (!condition) throw new Error(message);
}
