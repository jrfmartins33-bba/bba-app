import { buildXlsxFixture } from "../schedule-management/adapters/excel-import/xlsx-test-fixtures";
import { createMeasurementMonetaryPolicy, MeasurementDecimalQuantizationMode } from "../measurement-certification";
import { extractMemoriasDeCalculo } from "./parse-memoria-de-calculo";
import { classifyMemoriaResumo } from "./documentary-history-taxonomy";
import {
  buildDocumentaryHistoryPreview,
  buildItemDocumentaryObservations,
  reconcileDocumentaryHistory,
  type DocumentaryContractItem,
  type DocumentaryCurvaSObraPeriod,
  type DocumentaryCurvaSPeriod,
  type DocumentaryFormalPeriodLine
} from "./documentary-history-reconstruction";

// Política documental comprovada do BM08/Lagoa (measurement-bulletin-import-service).
const DOC_POLICY = createMeasurementMonetaryPolicy({
  key: "source-document-truncation-to-cents",
  scale: 2,
  quantizationMode: MeasurementDecimalQuantizationMode.TruncateTowardZero
});
import {
  MEASUREMENT_ITEM_DOCUMENTARY_HISTORY_SCHEMA_VERSION,
  MEASUREMENT_ITEM_DOCUMENTARY_OBSERVATION_SCHEMA_VERSION
} from "./measurement-item-documentary-history.types";

// Camada B (Parte B) — parser + taxonomia + observações item × período +
// reconciliação ITENS → GRUPO → OBRA → CURVA S. SEM persistência.
// Fixtures sintéticas (CI-safe); os números de ouro do BM nº 08 real
// são conferidos à parte no relatório da rodada.

function resumoSheet(name: string, header: string, fields: Record<string, number | null>) {
  const row = (label: string, key: string, unit = "MÊS") =>
    fields[key] === undefined ? [] : ["", label, "", "", "", "", fields[key], unit];
  return {
    name,
    rows: [
      [header],
      [name, "SERVIÇO"],
      ["", "RESUMO", "", "", "", "", "QUANT", "UNID"],
      row("Quantidade Contratada.....", "contract"),
      row("Quantidade executada acumulada atual", "executed"),
      row("Quantidade medida acumulada em medições anteriores", "measured"),
      row("Quantidade a medir no período", "toMeasure"),
      row("Saldo contratual", "balance")
    ].filter((r) => r.length > 0)
  };
}

// -------------------------------------------------------------------

runTest("1. schema versions: snapshot v1 e observação item×período v2 são distintas e explícitas", () => {
  assertEqual(MEASUREMENT_ITEM_DOCUMENTARY_HISTORY_SCHEMA_VERSION, 1, "snapshot v1");
  assertEqual(MEASUREMENT_ITEM_DOCUMENTARY_OBSERVATION_SCHEMA_VERSION, 2, "observação item×período v2");
});

runTest("2. cabeçalho da aba carrega SEU PRÓPRIO Nº de medição — abas em cortes diferentes não são o mesmo período", () => {
  const bytes = buildXlsxFixture([
    resumoSheet("01.02.01", "MEMÓRIA DE CÁLCULO - MEDIÇÃO Nº 08  -JUNHO / 2026", { contract: 9, measured: 7, toMeasure: 1, balance: 1 }),
    resumoSheet("01.01.01", "MEMÓRIA DE CÁLCULO - MEDIÇÃO Nº 02  - DEZEMBRO / 2025", { contract: 430.92, measured: 430.92, toMeasure: 0, balance: 0 })
  ]);
  const r = extractMemoriasDeCalculo(bytes, "f.xlsx");
  const june = r.parsed.find((p) => p.itemCode === "01.02.01")!;
  const dec = r.parsed.find((p) => p.itemCode === "01.01.01")!;
  assertEqual(june.measurementNumber, 8, "aba de junho: MED-08");
  assertEqual(june.measurementPeriodLabel, "JUNHO / 2026", "rótulo do período da aba");
  assertEqual(dec.measurementNumber, 2, "aba antiga: MED-02 (corte diferente, NÃO junho)");
  assertEqual(dec.measurementPeriodLabel, "DEZEMBRO / 2025", "rótulo do período da aba antiga");
});

runTest("3. decimal exato: célula numérica 430,92 NUNCA vira 43092 (bug de re-parse do protótipo)", () => {
  const bytes = buildXlsxFixture([
    resumoSheet("01.01.01", "MEMÓRIA DE CÁLCULO - MEDIÇÃO Nº 02", { contract: 430.92, measured: 430.92, toMeasure: 0, balance: 0 })
  ]);
  const p = extractMemoriasDeCalculo(bytes, "f.xlsx").parsed[0];
  assertEqual(p.contractQuantity, 430.92, "contratada lida verbatim da célula numérica");
  assertEqual(p.numericFormatHint, "dot_decimal", "só células numéricas -> sem ambiguidade de formato");
});

runTest("4. 'executada' NÃO vira 'medida' automaticamente — campos semanticamente distintos", () => {
  const bytes = buildXlsxFixture([
    resumoSheet("01.02.04", "MEMÓRIA DE CÁLCULO - MEDIÇÃO Nº 08", { contract: 9, executed: 23.1, measured: 9, toMeasure: 0, balance: -14.1 })
  ]);
  const p = extractMemoriasDeCalculo(bytes, "f.xlsx").parsed[0];
  const fields = classifyMemoriaResumo(p);
  const executed = fields.find((f) => f.semanticField === "executed_accumulated_quantity")!;
  const measured = fields.find((f) => f.semanticField === "measured_accumulated_quantity_prior")!;
  assertEqual(executed.quantityDecimal, "23.1", "executada declarada");
  assertEqual(measured.quantityDecimal, "9", "medida acumulada anterior");
  assertEqual(executed.semanticField !== measured.semanticField, true, "campos distintos, nunca fundidos");
  assertEqual(measured.measurementRef, 7, "medida acumulada 'anterior' = MED da aba (8) − 1");
});

runTest("5. ausência documental permanece null — nunca convertida em zero", () => {
  const bytes = buildXlsxFixture([
    resumoSheet("02.03.01", "MEMÓRIA DE CÁLCULO - MEDIÇÃO Nº 05", { contract: 100 })
  ]);
  const p = extractMemoriasDeCalculo(bytes, "f.xlsx").parsed[0];
  assertEqual(p.measuredAccumulatedQuantity, null, "medida acumulada AUSENTE = null");
  assertEqual(p.quantityToMeasureInPeriod, null, "a medir AUSENTE = null");
  const period = classifyMemoriaResumo(p).find((f) => f.semanticField === "quantity_to_measure_in_period")!;
  assertEqual(period.quantityDecimal, null, "observação de período fica null, não 0");
  assertEqual(period.isUnambiguous, false, "campo ausente -> não inequívoco");
  assertEqual(period.reasonIfAmbiguous, "campo ausente na aba", "motivo explícito");
});

runTest("6. campo AMBÍGUO (label bleed) não é inequívoco e não entra em saldo", () => {
  const bytes = buildXlsxFixture([
    {
      name: "01.03.03",
      rows: [
        ["MEMÓRIA DE CÁLCULO - MEDIÇÃO Nº 04"],
        ["", "RESUMO"],
        ["", "Quantidade Contratada........................................................"],
        ["", "Quantidade medida acumulada em medições anteriores.........................."],
        ["", "Quantidade a medir no período.............................................."]
      ]
    }
  ]);
  const p = extractMemoriasDeCalculo(bytes, "f.xlsx").parsed[0];
  assertEqual(p.layout, "resumo_label_bleed", "layout com vazamento de rótulo");
  const fields = classifyMemoriaResumo(p);
  assertEqual(fields.every((f) => !f.isUnambiguous), true, "todos os campos da aba marcados como não inequívocos");
  assertEqual(
    fields[0].reasonIfAmbiguous,
    "rótulo vaza para a coluna de valor (label bleed) — leitura não confiável sem inspeção",
    "motivo de ambiguidade propagado da aba"
  );
});

runTest("7. formato numérico ambíguo por aba ('43.092' sem vírgula) -> campos não inequívocos", () => {
  const bytes = buildXlsxFixture([
    {
      name: "07.01.01",
      rows: [
        ["MEMÓRIA DE CÁLCULO - MEDIÇÃO Nº 06"],
        ["", "RESUMO", "", "QUANT", "UNID"],
        ["", "Quantidade Contratada.....", "", "43.092", "M3"],
        ["", "Quantidade medida acumulada em medições anteriores", "", "10.000", "M3"],
        ["", "Quantidade a medir no período", "", "1.234", "M3"]
      ]
    }
  ]);
  const p = extractMemoriasDeCalculo(bytes, "f.xlsx").parsed[0];
  assertEqual(p.numericFormatHint, "ambiguous", "aba mistura ponto de milhar sem vírgula -> ambíguo");
  assertEqual(p.unambiguous, false, "aba ambígua nunca é inequívoca");
});

runTest("8. universo item a item: só abas que resolvem contra os 300 itens oficiais entram; estruturais/renomeadas ficam de fora", () => {
  const bytes = buildXlsxFixture([
    resumoSheet("01.02.01", "MEMÓRIA DE CÁLCULO - MEDIÇÃO Nº 08", { contract: 9, measured: 7, toMeasure: 1, balance: 1 }),
    resumoSheet("01.00.00", "MEMÓRIA DE CÁLCULO - MEDIÇÃO Nº 08", { contract: 5, measured: 2, toMeasure: 1, balance: 2 }), // linha estrutural de grupo
    resumoSheet("99.99.99", "MEMÓRIA DE CÁLCULO - MEDIÇÃO Nº 08", { contract: 5, measured: 2, toMeasure: 1, balance: 2 }) // código sem item oficial
  ]);
  const memorias = extractMemoriasDeCalculo(bytes, "f.xlsx").parsed;
  const contractItems: DocumentaryContractItem[] = [
    { code: "01.02.01", managedServiceItemId: "op-1", unitPriceDecimal: "886.47", contractQuantityDecimal: "9", groupCode: "1.0" }
  ];
  const result = buildItemDocumentaryObservations({ memorias, contractItems, derivedReferenceMonetaryPolicy: DOC_POLICY });

  assertEqual(result.observations.every((o) => o.itemCode === "01.02.01"), true, "só 01.02.01 gera observação");
  assertEqual(result.observations.every((o) => o.identityBasis === "operational_item_id" && o.managedServiceItemId === "op-1"), true, "vínculo sempre por id operacional");
  assertEqual([...result.memoriaCodesWithoutContractItem].sort().join(","), "01.00.00,99.99.99", "abas sem item oficial listadas à parte");
  assertEqual(result.memoriasMatchingContractItems, 1, "1 das 3 abas corresponde a um item oficial");

  const period = result.observations.find((o) => o.semanticField === "quantity_to_measure_in_period")!;
  assertEqual(period.derivedReferenceValueDecimal, "886.47", "VALOR DERIVADO DE REFERÊNCIA = qtd (1) × preço (886.47), política truncate-to-cents");
  assertEqual(period.derivedReferenceValueAvailable, true, "flag de valor derivado disponível");
  assertEqual(period.derivedReferenceMonetaryPolicyKey, "source-document-truncation-to-cents", "política monetária rastreável no registro");
});

runTest("8b. sem política monetária explícita -> valor derivado fica null (nunca inventa política)", () => {
  const bytes = buildXlsxFixture([
    resumoSheet("01.02.01", "MEMÓRIA DE CÁLCULO - MEDIÇÃO Nº 08", { contract: 9, measured: 7, toMeasure: 1, balance: 1 })
  ]);
  const memorias = extractMemoriasDeCalculo(bytes, "f.xlsx").parsed;
  const result = buildItemDocumentaryObservations({
    memorias,
    contractItems: [{ code: "01.02.01", managedServiceItemId: "op-1", unitPriceDecimal: "886.47", contractQuantityDecimal: "9", groupCode: "1.0" }]
  });
  const period = result.observations.find((o) => o.semanticField === "quantity_to_measure_in_period")!;
  assertEqual(period.quantityDecimal, "1", "QUANTIDADE DOCUMENTAL preservada");
  assertEqual(period.derivedReferenceValueDecimal, null, "sem política -> valor derivado indisponível");
  assertEqual(period.derivedReferenceValueAvailable, false, "flag false");
  assertEqual(period.derivedReferenceMonetaryPolicyKey, null, "nenhuma política registrada");
});

runTest("9. BM nº 08 (golden): 15 linhas formais -> grupo 1 (42.015,69) + grupo 2 (210.639,09) = obra junho (252.654,78) = Curva S", () => {
  const june = "2026-06-01";
  const g1 = [
    ["01.02.01", "886.47"],
    ["01.02.02", "1152.65"],
    ["01.02.11", "11701.48"],
    ["01.02.12", "1150.53"],
    ["01.04.01", "27124.56"]
  ];
  const g2 = [
    ["02.02.01", "6912.00"],
    ["02.02.02", "4626.00"],
    ["02.02.03", "2325.60"],
    ["02.02.04", "10663.20"],
    ["02.02.05", "1488.38"],
    ["02.02.06", "1353.60"],
    ["02.02.08", "151160.00"],
    ["02.02.09", "6932.73"],
    ["02.02.10", "2467.58"],
    ["02.02.11", "22710.00"]
  ];
  const formalPeriodLines: DocumentaryFormalPeriodLine[] = [
    ...g1.map(([itemCode, valueDecimal]) => ({ itemCode, groupCode: "1.0", periodDate: june, valueDecimal })),
    ...g2.map(([itemCode, valueDecimal]) => ({ itemCode, groupCode: "2.0", periodDate: june, valueDecimal }))
  ];
  // Curva S junho: só grupos 1 e 2 têm realização; demais 0.
  const curvaSGroupPeriods: DocumentaryCurvaSPeriod[] = [
    { periodDate: june, groupCode: "1.0", actualPeriodValueDecimal: "42015.69" },
    { periodDate: june, groupCode: "2.0", actualPeriodValueDecimal: "210639.09" },
    ...["3.0", "4.0", "5.0", "6.0", "7.0", "8.0", "9.0", "10.0", "11.0"].map((groupCode) => ({
      periodDate: june,
      groupCode,
      actualPeriodValueDecimal: "0.00"
    }))
  ];
  const curvaSObraPeriods: DocumentaryCurvaSObraPeriod[] = [{ periodDate: june, actualPeriodValueDecimal: "252654.78" }];
  const contractItems: DocumentaryContractItem[] = [...g1, ...g2].map(([code]) => ({
    code,
    managedServiceItemId: `op-${code}`,
    unitPriceDecimal: "1",
    contractQuantityDecimal: "1",
    groupCode: code.startsWith("01") ? "1.0" : "2.0"
  }));

  const reconciliation = reconcileDocumentaryHistory({ formalPeriodLines, curvaSGroupPeriods, curvaSObraPeriods, contractItems });

  const grp1 = reconciliation.byGroupPeriod.find((r) => r.groupCode === "1.0" && r.periodDate === june)!;
  const grp2 = reconciliation.byGroupPeriod.find((r) => r.groupCode === "2.0" && r.periodDate === june)!;
  assertEqual(grp1.documentarySumDecimal, "42015.69", "Σ itens grupo 1 = realizado do grupo na Curva S");
  assertEqual(grp1.status, "reconciled_exact", "grupo 1 reconciliado exatamente");
  assertEqual(grp2.documentarySumDecimal, "210639.09", "Σ itens grupo 2 = realizado do grupo na Curva S");
  assertEqual(grp2.status, "reconciled_exact", "grupo 2 reconciliado exatamente");

  const obra = reconciliation.byObraPeriod.find((r) => r.periodDate === june)!;
  assertEqual(obra.documentaryGroupsSumDecimal, "252654.78", "Σ grupos = obra junho");
  assertEqual(obra.curvaSObraRealizedDecimal, "252654.78", "obra junho da Curva S");
  assertEqual(obra.status, "reconciled_exact", "obra junho reconciliada exatamente");
});

runTest("10. divergência NUNCA é corrigida em silêncio — status 'divergent' + diferença exposta", () => {
  const june = "2026-06-01";
  const reconciliation = reconcileDocumentaryHistory({
    formalPeriodLines: [
      { itemCode: "01.02.01", groupCode: "1.0", periodDate: june, valueDecimal: "42010.00" } // 5,69 a menos, de propósito
    ],
    curvaSGroupPeriods: [{ periodDate: june, groupCode: "1.0", actualPeriodValueDecimal: "42015.69" }],
    curvaSObraPeriods: [{ periodDate: june, actualPeriodValueDecimal: "42015.69" }],
    contractItems: [
      { code: "01.02.01", managedServiceItemId: "op-1", unitPriceDecimal: "1", contractQuantityDecimal: "1", groupCode: "1.0" }
    ]
  });
  const grp1 = reconciliation.byGroupPeriod.find((r) => r.groupCode === "1.0")!;
  assertEqual(grp1.status, "divergent", "diferença > política de centavos -> divergente");
  assertEqual(grp1.differenceDecimal, "-5.69", "diferença exata exposta, nunca zerada");
});

runTest("11. meses anteriores sem valor por item AUTORITATIVO -> 'insufficient_documentary_basis', nunca inventa", () => {
  const reconciliation = reconcileDocumentaryHistory({
    formalPeriodLines: [], // nenhum BM anterior importado
    curvaSGroupPeriods: [
      { periodDate: "2025-11-01", groupCode: "1.0", actualPeriodValueDecimal: "263664.17" },
      { periodDate: "2025-11-01", groupCode: "2.0", actualPeriodValueDecimal: "0.00" }
    ],
    curvaSObraPeriods: [{ periodDate: "2025-11-01", actualPeriodValueDecimal: "848251.64" }],
    contractItems: [{ code: "01.01.01", managedServiceItemId: "op-a", unitPriceDecimal: "1", contractQuantityDecimal: "1", groupCode: "1.0" }]
  });
  const g1 = reconciliation.byGroupPeriod.find((r) => r.groupCode === "1.0")!;
  const g2 = reconciliation.byGroupPeriod.find((r) => r.groupCode === "2.0")!;
  assertEqual(g1.status, "insufficient_documentary_basis", "grupo com realização mas sem item autoritativo");
  assertEqual(g1.documentarySumDecimal, null, "nada somado — não inventa");
  assertEqual(g2.status, "reconciled_exact", "grupo sem realização (0=0) reconciliado exatamente");
  const obra = reconciliation.byObraPeriod[0];
  assertEqual(obra.status, "insufficient_documentary_basis", "obra do mês sem base documental item a item");
});

runTest("12. prévia de persistência entrega números exatos (não texto genérico)", () => {
  const bytes = buildXlsxFixture([
    resumoSheet("01.02.01", "MEMÓRIA DE CÁLCULO - MEDIÇÃO Nº 08", { contract: 9, executed: 8, measured: 7, toMeasure: 1, balance: 1 }),
    resumoSheet("01.02.04", "MEMÓRIA DE CÁLCULO - MEDIÇÃO Nº 08", { contract: 9, executed: 23.1, measured: 9, toMeasure: 0, balance: -14.1 })
  ]);
  const extraction = extractMemoriasDeCalculo(bytes, "f.xlsx");
  const contractItems: DocumentaryContractItem[] = [
    { code: "01.02.01", managedServiceItemId: "op-1", unitPriceDecimal: "886.47", contractQuantityDecimal: "9", groupCode: "1.0" },
    { code: "01.02.04", managedServiceItemId: "op-4", unitPriceDecimal: "100", contractQuantityDecimal: "9", groupCode: "1.0" }
  ];
  const { observations } = buildItemDocumentaryObservations({
    memorias: extraction.parsed,
    contractItems,
    derivedReferenceMonetaryPolicy: DOC_POLICY
  });
  const reconciliation = reconcileDocumentaryHistory({
    formalPeriodLines: [{ itemCode: "01.02.01", groupCode: "1.0", periodDate: "2026-06-01", valueDecimal: "886.47" }],
    curvaSGroupPeriods: [{ periodDate: "2026-06-01", groupCode: "1.0", actualPeriodValueDecimal: "886.47" }],
    curvaSObraPeriods: [{ periodDate: "2026-06-01", actualPeriodValueDecimal: "886.47" }],
    contractItems
  });
  const preview = buildDocumentaryHistoryPreview({
    memorias: extraction.parsed,
    layoutCounts: extraction.layoutCounts,
    contractItems,
    observations,
    reconciliation
  });

  assertEqual(preview.totalContractItems, 2, "total de itens contratuais = itens oficiais passados");
  assertEqual(preview.totalMemoriasFound, 2, "total de memórias");
  assertEqual(preview.memoriasMatchingContractItems, 2, "as 2 abas resolvem contra os 2 itens oficiais");
  assertEqual(preview.periodsCoveredByMeasurementRef.join(","), "8", "só MED-08 nas fixtures");
  assertEqual(preview.executedNotProvenAsMeasured.length, 2, "01.02.01 (8≠7) e 01.02.04 (23,1≠9): 'executada' não provada como 'medida'");
  assertEqual(preview.itemsAboveContractQuantity.length, 1, "01.02.04: saldo negativo / executada acima do contrato");
  assertEqual(preview.itemsAboveContractQuantity[0].itemCode, "01.02.04", "item acima do contrato identificado");
  assertEqual(preview.derivedFromCumulativeCount, 0, "nenhum valor derivado de acumulado nesta rodada");
  assertEqual(preview.divergences.length, 0, "sem divergências nas fixtures");
  assertTrue(preview.exceptionSourceCells.length >= 3, "células-fonte das exceções relevantes listadas");

  // QUANTIDADE DOCUMENTAL (contagem) ≠ VALOR DERIVADO DE REFERÊNCIA (R$).
  assertEqual(preview.documentaryQuantityObservationsByMeasurementRef[0].measurementRef, 8, "quantidade documental indexada por MED");
  assertTrue(preview.documentaryQuantityObservationsByMeasurementRef[0].observationCount >= 1, "contagem de observações de quantidade");
  assertEqual(preview.derivedReferenceMonetaryPolicyKey, "source-document-truncation-to-cents", "política do valor derivado rastreável");
  assertTrue(
    preview.derivedReferenceValueByMeasurementRef.length > 0 && "derivedReferenceValueDecimal" in preview.derivedReferenceValueByMeasurementRef[0],
    "valor derivado exposto SEPARADO da quantidade, nomeado como referência (não 'valor documental')"
  );
});

runTest("14. UNIVERSO CONTRATUAL: 300 itens + 36 linhas estruturais NÃO podem virar 336 contractItems", () => {
  // 300 itens de serviço oficiais + 36 abas de memória estruturais (grupo/subgrupo).
  const officialItems: DocumentaryContractItem[] = Array.from({ length: 300 }, (_, i) => {
    const g = Math.floor(i / 30) + 1;
    const code = `${String(g).padStart(2, "0")}.${String((i % 30) + 1).padStart(2, "0")}.01`;
    return { code, managedServiceItemId: `op-${i}`, unitPriceDecimal: "1", contractQuantityDecimal: "10", groupCode: `${g}.0` };
  });
  const structuralSheets = Array.from({ length: 36 }, (_, i) =>
    resumoSheet(`${String(Math.floor(i / 6) + 1).padStart(2, "0")}.0${(i % 6) + 1}.00`, "MEMÓRIA DE CÁLCULO - MEDIÇÃO Nº 05", { contract: 1 })
  );
  const itemSheets = officialItems.slice(0, 120).map((it) =>
    resumoSheet(it.code, "MEMÓRIA DE CÁLCULO - MEDIÇÃO Nº 05", { contract: 10, measured: 4, toMeasure: 2, balance: 4 })
  );
  const memorias = extractMemoriasDeCalculo(buildXlsxFixture([...itemSheets, ...structuralSheets]), "f.xlsx").parsed;

  const result = buildItemDocumentaryObservations({ memorias, contractItems: officialItems, derivedReferenceMonetaryPolicy: DOC_POLICY });
  const preview = buildDocumentaryHistoryPreview({
    memorias,
    layoutCounts: extractMemoriasDeCalculo(buildXlsxFixture([...itemSheets, ...structuralSheets]), "f.xlsx").layoutCounts,
    contractItems: officialItems,
    observations: result.observations,
    reconciliation: reconcileDocumentaryHistory({ formalPeriodLines: [], curvaSGroupPeriods: [], curvaSObraPeriods: [], contractItems: officialItems })
  });

  assertEqual(preview.totalContractItems, 300, "totalContractItems = 300, NUNCA 336");
  assertEqual(preview.totalMemoriasFound, 156, "156 abas (120 de item + 36 estruturais)");
  assertEqual(preview.memoriasMatchingContractItems, 120, "só 120 abas resolvem contra os 300 itens oficiais");
  assertEqual(preview.memoriaCodesWithoutContractItem.length, 36, "as 36 linhas estruturais ficam FORA do universo item a item");
  assertEqual(result.observations.every((o) => officialItems.some((it) => it.code === o.itemCode)), true, "nenhuma observação de código estrutural");
  assertEqual(preview.itemsWithoutRecoverableHistory, 300 - preview.itemsWithAtLeastOneUnambiguousPeriod, "sem histórico recuperável = 300 − itens com período inequívoco (base sempre 300)");
});

runTest("13. observação de acumulado documental é preservada com escopo e MED de referência próprios", () => {
  const bytes = buildXlsxFixture([
    resumoSheet("05.01.01", "MEMÓRIA DE CÁLCULO - MEDIÇÃO Nº 06", { contract: 100, measured: 40, toMeasure: 12, balance: 48 })
  ]);
  const p = extractMemoriasDeCalculo(bytes, "f.xlsx").parsed[0];
  const fields = classifyMemoriaResumo(p);
  const measured = fields.find((f) => f.semanticField === "measured_accumulated_quantity_prior")!;
  assertEqual(measured.scope, "accumulated_prior", "escopo acumulado (anterior)");
  assertEqual(measured.measurementRef, 5, "acumulado 'em medições anteriores' -> MED da aba (6) − 1");
  assertEqual(measured.quantityDecimal, "40", "quantidade acumulada preservada verbatim");
  assertEqual(measured.derivedFromCumulative, false, "lido direto, não derivado");
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
