import {
  buildManagerialControlView,
  type BuildManagerialControlViewInput,
  type ManagerialControlContractItemInput
} from "./measurement-managerial-control-service";
import type { MeasurementPhysicalFinancialAnalysis } from "./measurement-physical-financial-analysis-service";

function item(overrides: Partial<ManagerialControlContractItemInput> & { code: string }): ManagerialControlContractItemInput {
  return {
    id: `id-${overrides.code}`,
    description: `Serviço ${overrides.code}`,
    unit: "M2",
    contractQuantityDecimal: "100",
    unitPriceDecimal: "10.00",
    measurementType: "quantity",
    ...overrides
  };
}

const physicalFinancial: MeasurementPhysicalFinancialAnalysis = {
  obraAvailable: true,
  obraUnavailableReason: null,
  groupsAvailable: true,
  groupsUnavailableReason: null,
  sourceFileName: "CURVA S.xlsx",
  sourceSheetName: "CRONOGRAMA FÍSICO-FINANCEIRO",
  datasetId: "ds",
  period: { label: "mês 8", date: "2026-06-01" },
  obra: {
    periodLabel: "mês 8",
    periodDate: "2026-06-01",
    plannedAccumulatedValueDecimal: "7166007.71",
    actualAccumulatedValueDecimal: "4772540.69",
    deviationValueDecimal: "-2393467.02",
    plannedAccumulatedPercent: "94.14",
    actualAccumulatedPercent: "62.70",
    deviationPercentPoints: "-31.44",
    situation: "below_planned"
  },
  groups: [
    {
      groupCode: "1.0",
      groupName: "SERVIÇOS PRELIMINARES",
      plannedPeriodValueDecimal: "0.00",
      plannedAccumulatedValueDecimal: "1465240.63",
      actualPeriodValueDecimal: "0.00",
      actualAccumulatedValueDecimal: "969649.18",
      plannedAccumulatedPercent: "94.00",
      actualAccumulatedPercent: "62.21",
      deviationValueDecimal: "-495591.45",
      deviationPercentPoints: "-31.79",
      sharePercent: "20.71",
      situation: "below_planned"
    }
  ],
  adjustments: [],
  management: null,
  itemGroupByCode: new Map()
};

function baseInput(overrides: Partial<BuildManagerialControlViewInput> = {}): BuildManagerialControlViewInput {
  return {
    contractItems: [
      item({ code: "01.01.01", contractQuantityDecimal: "100", unitPriceDecimal: "10.00" }),
      item({ code: "01.02.01", contractQuantityDecimal: "50", unitPriceDecimal: "4.00" }),
      item({ code: "01.03.01", contractQuantityDecimal: "10", unitPriceDecimal: "100.00" }),
      item({ code: "02.01.01", contractQuantityDecimal: "8", unitPriceDecimal: "25.00" }),
      item({ code: "99.09.09", contractQuantityDecimal: "0", unitPriceDecimal: "0", measurementType: "lump_sum" })
    ],
    certifiedBalances: [
      { managedServiceItemId: "id-01.01.01", contractedValueDecimal: "1000.00", certifiedAccumulatedQuantityDecimal: "0", certifiedAccumulatedValueDecimal: "0" },
      { managedServiceItemId: "id-01.02.01", contractedValueDecimal: "200.00", certifiedAccumulatedQuantityDecimal: "0", certifiedAccumulatedValueDecimal: "0" },
      { managedServiceItemId: "id-01.03.01", contractedValueDecimal: "1000.00", certifiedAccumulatedQuantityDecimal: "0", certifiedAccumulatedValueDecimal: "0" },
      { managedServiceItemId: "id-02.01.01", contractedValueDecimal: "200.00", certifiedAccumulatedQuantityDecimal: "0", certifiedAccumulatedValueDecimal: "0" }
    ],
    currentBulletin: {
      bulletinNumber: 8,
      periodLabel: "2026-06-01 a 2026-06-30",
      totalValueDecimal: "1350.00",
      lines: [
        { managedServiceItemId: "id-01.01.01", code: "01.01.01", unit: "M2", quantityDecimal: "40", valueDecimal: "400.00", sheetName: "BOLETIM DE MEDIÇÃO 08", row: 19, columns: ["H", "I"] },
        { managedServiceItemId: "id-01.03.01", code: "01.03.01", unit: "M2", quantityDecimal: "10", valueDecimal: "1000.00", sheetName: "BOLETIM DE MEDIÇÃO 08", row: 21, columns: ["H", "I"] },
        { managedServiceItemId: "id-02.01.01", code: "02.01.01", unit: "M2", quantityDecimal: "12", valueDecimal: "300.00", sheetName: "BOLETIM DE MEDIÇÃO 08", row: 25, columns: ["H", "I"] }
      ]
    },
    physicalFinancial,
    certificationRegistered: false,
    contractOfficialValueDecimal: "2399.50",
    ...overrides
  };
}

runTest("1/23. lista TODOS os itens contratuais, medidos ou não", () => {
  const view = buildManagerialControlView(baseInput());
  assertEqual(view.available, true, "disponível");
  assertEqual(view.items.length, 5, "os 5 itens contratuais aparecem");
  assertEqual(view.summary.totalItems, 5, "contagem = base contratual, não hardcode");
});

runTest("2/3. item sem acumulado registrado = Sem medição registrada no BDOS (nunca 'sem execução')", () => {
  const view = buildManagerialControlView(baseInput());
  const i = view.items.find((x) => x.code === "01.02.01")!;
  assertEqual(i.status, "no_bdos_measurement", "status sem medição");
  assertEqual(i.bdosRegisteredValueDecimal, "0.00", "registrado zero");
  assertEqual(i.documentaryHistoryImported, false, "histórico documental não importado");
  assertEqual(i.flags.documentaryHistoryPending, true, "flag de pendência");
});

runTest("4. acumulado entre 0 e contratado = Em execução", () => {
  const i = buildManagerialControlView(baseInput()).items.find((x) => x.code === "01.01.01")!;
  assertEqual(i.status, "in_execution_bdos", "em execução (40 de 100)");
  assertEqual(i.executedPercent, "40.00", "% executado");
});

runTest("5. acumulado igual ao contratado = Quantidade contratada atingida", () => {
  const i = buildManagerialControlView(baseInput()).items.find((x) => x.code === "01.03.01")!;
  assertEqual(i.status, "contract_quantity_reached", "10 de 10");
  assertEqual(i.executedPercent, "100.00", "100%");
});

runTest("6/7. acumulado > contratado = Acima da quantidade contratada; % supera 100 e não trunca", () => {
  const i = buildManagerialControlView(baseInput()).items.find((x) => x.code === "02.01.01")!;
  assertEqual(i.status, "above_contract_quantity", "12 de 8");
  assertEqual(i.executedPercent, "150.00", "150%, nunca truncado");
});

runTest("8. saldo pode ficar negativo", () => {
  const i = buildManagerialControlView(baseInput()).items.find((x) => x.code === "02.01.01")!;
  assertEqual(i.quantityBalanceDecimal.startsWith("-"), true, "saldo de quantidade negativo");
  assertEqual(i.financialBalanceDecimal.startsWith("-"), true, "saldo financeiro negativo");
});

runTest("9. nenhuma situação inventa 'atrasado/adiantado/no prazo'", () => {
  const statuses = new Set(buildManagerialControlView(baseInput()).items.map((i) => i.status));
  for (const bad of ["atrasado", "adiantado", "no_prazo", "on_time", "delayed", "ahead"]) {
    assertEqual(statuses.has(bad as never), false, `status "${bad}" não existe`);
  }
});

runTest("10. flags gerenciais separadas do status (medido/sem medição no período)", () => {
  const view = buildManagerialControlView(baseInput());
  assertEqual(view.items.find((x) => x.code === "01.01.01")!.flags.measuredThisPeriod, true, "medido no período");
  assertEqual(view.items.find((x) => x.code === "01.02.01")!.flags.notMeasuredThisPeriod, true, "sem medição no período");
});

runTest("10b. base insuficiente quando não há quantidade contratada / tipo não-quantitativo", () => {
  const i = buildManagerialControlView(baseInput()).items.find((x) => x.code === "99.09.09")!;
  assertEqual(i.status, "insufficient_basis", "sem qty contratada e lump_sum");
  assertEqual(i.executedPercent, null, "sem % quando base insuficiente");
});

runTest("11. grupo é CONTEXTO, não status individual", () => {
  const i = buildManagerialControlView(baseInput()).items.find((x) => x.code === "01.01.01")!;
  assertEqual(i.groupCode, "1.0", "grupo por prefixo determinístico");
  assertEqual(i.groupContext?.situation, "below_planned", "situação do grupo herdada como contexto");
  // o item nunca carrega uma "situação do item" própria além do status gerencial de quantidade
});

runTest("12. dinheiro em decimal exato -- somas canônicas, sem float", () => {
  const s = buildManagerialControlView(baseInput()).summary;
  assertEqual(s.bdosRegisteredValueTotalDecimal, "1700.00", "400 + 1000 + 300");
  assertEqual(s.currentBulletinLinesSumDecimal, "1700.00", "soma das linhas do BM");
});

runTest("13. rastreabilidade preservada por item medido", () => {
  const i = buildManagerialControlView(baseInput()).items.find((x) => x.code === "01.01.01")!;
  assertEqual(i.traceability?.sheetName, "BOLETIM DE MEDIÇÃO 08", "aba");
  assertEqual(i.traceability?.row, 19, "linha");
  assertEqual(i.traceability?.bulletinNumber, 8, "boletim");
});

runTest("17. concentração do valor -- top N dinâmico, sem threshold arbitrário", () => {
  const a = buildManagerialControlView(baseInput()).analyses;
  assertEqual(a.topByRegisteredValue[0]?.code, "01.03.01", "maior valor registrado");
  assertEqual(a.valueConcentration?.topCount, 3, "3 itens com valor (dos 5)");
  assertEqual(a.valueConcentration?.sharePercent, "100.00", "os 3 concentram 100% do registrado");
});

runTest("18. ajuste contratual NUNCA é rateado -- exibido à parte no resumo", () => {
  const s = buildManagerialControlView(baseInput()).summary;
  // soma dos contracted_value dos itens: 1000 + 200 + 1000 + 200 + (0*0=0) = 2400.00
  assertEqual(s.contractedValueTotalDecimal, "2400.00", "soma dos itens");
  assertEqual(s.contractOfficialValueDecimal, "2399.50", "contrato oficial");
  assertEqual(s.contractAdjustmentDecimal, "0.50", "ajuste = 2400.00 - 2399.50, à parte");
});

runTest("16/22. reconciliação do BM: soma das linhas = total do boletim", () => {
  const s = buildManagerialControlView(baseInput({ currentBulletin: { ...baseInput().currentBulletin!, totalValueDecimal: "1700.00" } })).summary;
  assertEqual(s.currentBulletinLinesSumDecimal, s.currentBulletinTotalValueDecimal, "reconciliado");
});

runTest("17b/certificado. 'certificado = 0' não é confundido com dado documental; obra de referência exibida à parte", () => {
  const s = buildManagerialControlView(baseInput()).summary;
  assertEqual(s.certificationRegistered, false, "nenhuma certificação registrada");
  assertEqual(s.documentaryHistoryImported, false, "histórico documental não importado");
  assertEqual(s.obraReference?.actualAccumulatedValueDecimal, "4772540.69", "posição real da obra (Curva S) mostrada como referência");
  assertEqual(s.obraReference?.actualAccumulatedPercent, "62.70", "e seu percentual");
});

runTest("19/20. nenhuma escrita: a função é pura, só projeta (sem I/O, sem persistência)", () => {
  const input = baseInput();
  const before = JSON.stringify(input.contractItems);
  buildManagerialControlView(input);
  assertEqual(JSON.stringify(input.contractItems), before, "entrada intacta -- função pura");
});

runTest("degrada sem base contratual, sem inventar", () => {
  const view = buildManagerialControlView(baseInput({ contractItems: [] }));
  assertEqual(view.available, false, "indisponível");
  assertEqual(view.items.length, 0, "nenhum item inventado");
  assertTrue((view.unavailableReason ?? "").length > 0, "motivo explícito");
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
  if (!condition) throw new Error(message);
}
