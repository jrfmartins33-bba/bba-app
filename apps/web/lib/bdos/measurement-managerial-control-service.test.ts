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
    currentBulletinCertified: false,
    contractReconciliation: {
      // soma técnica autoritativa (alta precisão) + ajuste = oficial
      officialContractValueDecimal: "2399.50",
      itemsTechnicalTotalDecimal: "2400.12454550",
      roundingAdjustmentDecimal: "-0.62454550"
    },
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

runTest("§2/§5. reconciliação contratual vem AUTORITATIVA da Base Contratual -- soma técnica + ajuste = oficial, com precisão decimal", () => {
  const s = buildManagerialControlView(baseInput()).summary;
  assertEqual(s.contractOfficialValueDecimal, "2399.50", "valor oficial (autoritativo)");
  assertEqual(s.itemsTechnicalTotalDecimal, "2400.12454550", "soma técnica autoritativa da Base Contratual, alta precisão");
  assertEqual(s.contractRoundingAdjustmentDecimal, "-0.62454550", "ajuste autoritativo da Base Contratual");
  // soma técnica + ajuste = oficial, sem deriva de arredondamento
  const sum = (a: string, b: string) => {
    const [ai, af = ""] = a.replace("-", "").split(".");
    const [bi, bf = ""] = b.replace("-", "").split(".");
    const s8 = (i: string, f: string) => BigInt(i) * 100000000n + BigInt((f + "00000000").slice(0, 8));
    const av = (a.startsWith("-") ? -1n : 1n) * s8(ai, af);
    const bv = (b.startsWith("-") ? -1n : 1n) * s8(bi, bf);
    return av + bv;
  };
  assertEqual(sum("2400.12454550", "-0.62454550"), sum("2399.50000000", "0"), "soma técnica + ajuste = valor oficial (precisão decimal)");
});

runTest("§2/§3. R$ 0,5x da soma canônica dos itens NÃO é apresentado como ajuste contratual", () => {
  const s = buildManagerialControlView(baseInput()).summary;
  // a soma canônica a centavos existe só como informação, nunca como "ajuste"
  assertEqual(s.itemsCanonicalSumDecimal, "2400.00", "soma canônica a centavos dos itens (informativa)");
  // o campo de ajuste é o AUTORITATIVO, não itemsCanonicalSum - oficial (= 0.50)
  assertTrue(s.contractRoundingAdjustmentDecimal !== "0.50" && s.contractRoundingAdjustmentDecimal !== "-0.50", "o ajuste nunca é a diferença da soma arredondada");
});

runTest("§4. saldo consolidado parte do VALOR OFICIAL do contrato, não da soma dos itens", () => {
  const s = buildManagerialControlView(baseInput()).summary;
  // registrado total = 400 + 1000 + 300 = 1700.00 (BM não certificado); oficial = 2399.50
  assertEqual(s.bdosRegisteredValueTotalDecimal, "1700.00", "registrado consolidado");
  assertEqual(s.contractBalanceTotalDecimal, "699.50", "saldo = oficial 2399.50 - registrado 1700.00");
  assertEqual(s.bdosRegisteredFinancialPercent, "70.85", "% = 1700 / 2399.50 * 100 (vs. oficial, não vs. soma dos itens)");
});

runTest("§4. per item o saldo financeiro continua usando o valor contratual autoritativo DO ITEM", () => {
  const i = buildManagerialControlView(baseInput()).items.find((x) => x.code === "01.01.01")!;
  assertEqual(i.contractedValueDecimal, "1000.00", "valor contratual do item (measurement_certified_item_balances.contracted_value)");
  assertEqual(i.financialBalanceDecimal, "600.00", "1000.00 - 400.00 (registrado do item), sem tocar o oficial consolidado");
});

// -------- §1: sem dupla contagem quando o BM atual for certificado --------

runTest("§1a. zero certificações + BM atual (não certificado) → registrado = BM", () => {
  const i = buildManagerialControlView(baseInput()).items.find((x) => x.code === "01.01.01")!;
  assertEqual(i.certifiedAccumulatedValueDecimal, "0.00", "nada certificado ainda");
  assertEqual(i.bdosRegisteredValueDecimal, "400.00", "= período do BM (400)");
  assertEqual(i.bdosRegisteredQuantityDecimal, "40.000000", "= qtd. do período");
});

runTest("§1b. certificações anteriores + BM atual NÃO certificado → anterior + BM", () => {
  const input = baseInput({
    certifiedBalances: [
      { managedServiceItemId: "id-01.01.01", contractedValueDecimal: "1000.00", certifiedAccumulatedQuantityDecimal: "30", certifiedAccumulatedValueDecimal: "300.00" },
      ...baseInput().certifiedBalances.slice(1)
    ]
  });
  const i = buildManagerialControlView(input).items.find((x) => x.code === "01.01.01")!;
  assertEqual(i.bdosRegisteredValueDecimal, "700.00", "acumulado anterior 300 + BM atual 400");
  assertEqual(i.bdosRegisteredQuantityDecimal, "70.000000", "30 + 40");
  assertEqual(i.periodValueDecimal, "400.00", "o valor do período continua visível à parte");
});

runTest("§1c. BM atual JÁ certificado → acumulado certificado, sem somar o BM de novo (nenhuma dupla contagem)", () => {
  const input = baseInput({
    currentBulletinCertified: true,
    certifiedBalances: [
      // após certificar o BM 8, o balance já incorpora o período: 300 (anterior) + 400 (BM) = 700
      { managedServiceItemId: "id-01.01.01", contractedValueDecimal: "1000.00", certifiedAccumulatedQuantityDecimal: "70", certifiedAccumulatedValueDecimal: "700.00" },
      ...baseInput().certifiedBalances.slice(1)
    ]
  });
  const i = buildManagerialControlView(input).items.find((x) => x.code === "01.01.01")!;
  assertEqual(i.bdosRegisteredValueDecimal, "700.00", "= acumulado certificado, NÃO 700 + 400");
  assertEqual(i.bdosRegisteredQuantityDecimal, "70.000000", "sem dupla contagem de quantidade");
});

runTest("§1d. valor do período continua visível após certificação", () => {
  const input = baseInput({
    currentBulletinCertified: true,
    certifiedBalances: [
      { managedServiceItemId: "id-01.01.01", contractedValueDecimal: "1000.00", certifiedAccumulatedQuantityDecimal: "70", certifiedAccumulatedValueDecimal: "700.00" },
      ...baseInput().certifiedBalances.slice(1)
    ]
  });
  const i = buildManagerialControlView(input).items.find((x) => x.code === "01.01.01")!;
  assertEqual(i.periodValueDecimal, "400.00", "\"neste período\" segue exibido");
  assertEqual(i.periodQuantityDecimal, "40.000000", "qtd. do período segue exibida");
  assertEqual(i.flags.measuredThisPeriod, true, "flag do período mantida");
});

runTest("§1e. consolidado sem dupla contagem quando o BM atual está certificado", () => {
  const certifiedBalances = baseInput().certifiedBalances.map((b) => {
    const line = baseInput().currentBulletin!.lines.find((l) => l.managedServiceItemId === b.managedServiceItemId);
    return line
      ? { ...b, certifiedAccumulatedValueDecimal: line.valueDecimal, certifiedAccumulatedQuantityDecimal: line.quantityDecimal }
      : b;
  });
  const s = buildManagerialControlView(baseInput({ currentBulletinCertified: true, certifiedBalances })).summary;
  assertEqual(s.bdosRegisteredValueTotalDecimal, "1700.00", "= soma dos certificados (que já incluem o BM), nunca 1700 + 1700");
  assertEqual(s.currentBulletinCertified, true, "estado do ciclo propagado ao resumo");
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
