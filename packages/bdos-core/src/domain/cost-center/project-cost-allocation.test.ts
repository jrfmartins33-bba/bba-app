/**
 * Testes direcionados — Camada Operacional de Centros de Custo.
 * Massa demonstrativa aprovada (junho/2026, projeto genérico "PROJ").
 * Não roda a suíte completa; cobre exclusivamente esta etapa.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ALLOCATION_BPS_TOTAL,
  buildAllocations,
  buildProjectCostCentersReadModel,
  canonMoney,
  CostAllocationMethod,
  CostAllocationValidationError,
  CostDataNature,
  CostEntrySourceKind,
  CostEntryStatus,
  CostFamily,
  moneyToCents,
  sharePercent,
  validateCostEntryAllocations,
  type AllocatableCostCenter,
  type ProjectCostAllocation,
  type ProjectCostEntry,
  type ReadModelCostCenterInput,
  type ReadModelEntryInput,
} from "./index";

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`ok - ${name}`);
}
function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}
function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
function assertThrows(fn: () => void, snippet: string): void {
  try {
    fn();
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes(snippet)) return;
    throw error;
  }
  throw new Error(`Expected throw containing "${snippet}"`);
}

const ORG = "org-generic-0001";
const PROJ = "proj-generic-0001";

const CONJASF: ReadModelCostCenterInput = {
  id: "cc-A",
  organizationId: ORG,
  engineeringProjectId: PROJ,
  code: "CC-A",
  name: "Centro de Custo A",
  consortiumMemberId: "member-A",
  consortiumMemberName: "Consorciada A",
  consortiumShareBasisPoints: 5000,
};
const HIDROMEC: ReadModelCostCenterInput = {
  id: "cc-B",
  organizationId: ORG,
  engineeringProjectId: PROJ,
  code: "CC-B",
  name: "Centro de Custo B",
  consortiumMemberId: "member-B",
  consortiumMemberName: "Consorciada B",
  consortiumShareBasisPoints: 5000,
};

const CC_BY_ID = new Map<string, AllocatableCostCenter>([
  [CONJASF.id, CONJASF],
  [HIDROMEC.id, HIDROMEC],
]);

let seq = 0;
function entry(
  description: string,
  family: CostFamily,
  categoryLabel: string,
  amountDecimal: string,
): ProjectCostEntry {
  seq += 1;
  return {
    id: `entry-${seq}`,
    organizationId: ORG,
    engineeringProjectId: PROJ,
    financialLancamentoId: null,
    financialCategoriaId: null,
    categoryLabel,
    costFamily: family,
    description,
    supplierName: null,
    amountDecimal,
    competencePeriod: "2026-06",
    dataNature: CostDataNature.Demonstrative,
    sourceKind: CostEntrySourceKind.ManualDemonstration,
    status: CostEntryStatus.Allocated,
    notes: null,
    metadata: {},
  };
}

let allocSeq = 0;
function alloc(
  e: ProjectCostEntry,
  costCenterId: string,
  method: CostAllocationMethod,
  basisPoints: number,
  allocatedAmountDecimal: string,
): ProjectCostAllocation {
  allocSeq += 1;
  return {
    id: `alloc-${allocSeq}`,
    organizationId: ORG,
    engineeringProjectId: PROJ,
    projectCostEntryId: e.id,
    projectCostCenterId: costCenterId,
    allocationMethod: method,
    allocationBasisPoints: basisPoints,
    allocatedAmountDecimal,
    rationale: null,
  };
}

// ---- Massa demonstrativa (7 despesas, 9 alocações) --------------------------
function buildGoldenEntries(): ReadModelEntryInput[] {
  seq = 0;
  allocSeq = 0;
  const e1 = entry("Folha operacional — CONJASF", CostFamily.RH, "Folha de Pagamento", "54000.00");
  const e2 = entry("Folha operacional — HIDROMEC", CostFamily.RH, "Folha de Pagamento", "46000.00");
  const e3 = entry("Encargos trabalhistas — CONJASF", CostFamily.RH, "Encargos Trabalhistas", "16200.00");
  const e4 = entry("Encargos trabalhistas — HIDROMEC", CostFamily.RH, "Encargos Trabalhistas", "13800.00");
  const e5 = entry("Combustível da operação compartilhada", CostFamily.Combustivel, "Combustível", "24000.00");
  const e6 = entry("Locação de escavadeira", CostFamily.LocacaoEquipamentos, "Locação de Equipamentos", "60000.00");
  const e7 = entry("Locação de caminhões", CostFamily.LocacaoEquipamentos, "Locação de Equipamentos", "28000.00");
  return [
    { entry: e1, allocations: [alloc(e1, CONJASF.id, CostAllocationMethod.Direct, 10000, "54000.00")] },
    { entry: e2, allocations: [alloc(e2, HIDROMEC.id, CostAllocationMethod.Direct, 10000, "46000.00")] },
    { entry: e3, allocations: [alloc(e3, CONJASF.id, CostAllocationMethod.Direct, 10000, "16200.00")] },
    { entry: e4, allocations: [alloc(e4, HIDROMEC.id, CostAllocationMethod.Direct, 10000, "13800.00")] },
    {
      entry: e5,
      allocations: [
        alloc(e5, CONJASF.id, CostAllocationMethod.EqualSplit, 5000, "12000.00"),
        alloc(e5, HIDROMEC.id, CostAllocationMethod.EqualSplit, 5000, "12000.00"),
      ],
    },
    {
      entry: e6,
      allocations: [
        alloc(e6, CONJASF.id, CostAllocationMethod.CustomSplit, 7000, "42000.00"),
        alloc(e6, HIDROMEC.id, CostAllocationMethod.CustomSplit, 3000, "18000.00"),
      ],
    },
    { entry: e7, allocations: [alloc(e7, HIDROMEC.id, CostAllocationMethod.Direct, 10000, "28000.00")] },
  ];
}

function buildGoldenReadModel(measurementAvailable = true) {
  return buildProjectCostCentersReadModel({
    organizationId: ORG,
    engineeringProjectId: PROJ,
    projectName: "Projeto Genérico",
    period: "2026-06",
    periodLabel: "jun/2026",
    dataNature: CostDataNature.Demonstrative,
    costCenters: [CONJASF, HIDROMEC],
    costEntries: buildGoldenEntries(),
    operationalLayerMaterialized: true,
    measurementComparison: {
      available: measurementAvailable,
      measuredValueDecimal: measurementAvailable ? "252654.78" : null,
      measurementLabel: measurementAvailable ? "BM 08 · jun/2026" : null,
    },
  });
}

// 1
runTest("custo direto 100% para o primeiro Centro de Custo", () => {
  const built = buildAllocations("54000.00", {
    method: CostAllocationMethod.Direct,
    amountsByCostCenterId: [{ costCenterId: CONJASF.id, amountDecimal: "54000.00" }],
  });
  assertEqual(built.length, 1, "uma linha");
  assertEqual(built[0].allocatedAmountDecimal, "54000.00", "valor íntegro");
  assertEqual(built[0].allocationBasisPoints, 10000, "100%");
});

// 2
runTest("custo direto 100% para o segundo Centro de Custo", () => {
  const built = buildAllocations("28000.00", {
    method: CostAllocationMethod.Direct,
    amountsByCostCenterId: [{ costCenterId: HIDROMEC.id, amountDecimal: "28000.00" }],
  });
  assertEqual(built.length, 1, "uma linha");
  assertEqual(built[0].projectCostCenterId, HIDROMEC.id, "centro B");
  assertEqual(built[0].allocatedAmountDecimal, "28000.00", "valor íntegro");
});

// 3
runTest("rateio igual 50/50 explícito", () => {
  const built = buildAllocations("24000.00", {
    method: CostAllocationMethod.EqualSplit,
    costCenterIds: [CONJASF.id, HIDROMEC.id],
  });
  assertEqual(built.length, 2, "duas linhas");
  assertEqual(built[0].allocatedAmountDecimal, "12000.00", "metade A");
  assertEqual(built[1].allocatedAmountDecimal, "12000.00", "metade B");
  assertEqual(built[0].allocationBasisPoints + built[1].allocationBasisPoints, 10000, "bps somam 100%");
});

// 4
runTest("rateio específico 70/30 persiste o percentual utilizado", () => {
  const built = buildAllocations("60000.00", {
    method: CostAllocationMethod.CustomSplit,
    basisPointsByCostCenterId: [
      { costCenterId: CONJASF.id, basisPoints: 7000 },
      { costCenterId: HIDROMEC.id, basisPoints: 3000 },
    ],
  });
  assertEqual(built[0].allocatedAmountDecimal, "42000.00", "70% → 42.000");
  assertEqual(built[1].allocatedAmountDecimal, "18000.00", "30% → 18.000");
  assertEqual(built[0].allocationBasisPoints, 7000, "bps 7000 persistido");
  assertEqual(built[1].allocationBasisPoints, 3000, "bps 3000 persistido");
});

// 5
runTest("participação societária 50/50 NÃO cria rateio automaticamente", () => {
  // Não há caminho que receba consortiumShareBasisPoints e produza alocações.
  // EQUAL_SPLIT exige lista explícita de centros; sem intenção, nada é alocado.
  assertThrows(
    () => buildAllocations("24000.00", { method: CostAllocationMethod.EqualSplit, costCenterIds: [] }),
    "exige ao menos dois",
  );
  const rm = buildProjectCostCentersReadModel({
    organizationId: ORG,
    engineeringProjectId: PROJ,
    projectName: null,
    period: "2026-06",
    periodLabel: "jun/2026",
    dataNature: CostDataNature.Demonstrative,
    costCenters: [CONJASF, HIDROMEC],
    costEntries: [],
    operationalLayerMaterialized: true,
    measurementComparison: { available: false, measuredValueDecimal: null, measurementLabel: null },
  });
  assertEqual(rm.allocatedCostDecimal, "0.00", "nenhuma alocação derivada da participação");
  for (const cc of rm.costCenters) assertEqual(cc.allocatedCostDecimal, "0.00", "centro sem custo atribuído");
});

// 6
runTest("soma das alocações = total do custo (status ALLOCATED)", () => {
  for (const { entry: e, allocations } of buildGoldenEntries()) {
    const report = validateCostEntryAllocations(e, allocations, CC_BY_ID);
    assertEqual(report.allocatedDecimal, canonMoney(e.amountDecimal), `custo ${e.id} reconcilia`);
    assertEqual(report.unallocatedDecimal, "0.00", `custo ${e.id} sem resíduo`);
  }
});

// 7
runTest("alocação com Centro de Custo de OUTRA obra é recusada", () => {
  const e = entry("x", CostFamily.RH, "Folha de Pagamento", "1000.00");
  const foreign: AllocatableCostCenter = { ...CONJASF, engineeringProjectId: "proj-outra" };
  assertThrows(
    () =>
      validateCostEntryAllocations(
        e,
        [alloc(e, foreign.id, CostAllocationMethod.Direct, 10000, "1000.00")],
        new Map([[foreign.id, foreign]]),
      ),
    "outra obra",
  );
});

// 8
runTest("alocação com Centro de Custo de OUTRA empresa é recusada", () => {
  const e = entry("x", CostFamily.RH, "Folha de Pagamento", "1000.00");
  const foreign: AllocatableCostCenter = { ...CONJASF, organizationId: "org-outra" };
  assertThrows(
    () =>
      validateCostEntryAllocations(
        e,
        [alloc(e, foreign.id, CostAllocationMethod.Direct, 10000, "1000.00")],
        new Map([[foreign.id, foreign]]),
      ),
    "outra empresa",
  );
});

// 9
runTest("dinheiro em decimal exato (bigint, sem float)", () => {
  assertEqual(moneyToCents("54000.00").toString(), "5400000", "cents exatos");
  assertEqual(canonMoney("242000.005"), "242000.01", "quantização determinística");
  assertEqual(canonMoney("0.1"), "0.10", "duas casas");

  const e = { ...entry("centavos", CostFamily.RH, "Folha de Pagamento", "0.30"), status: CostEntryStatus.Allocated };
  const report = validateCostEntryAllocations(
    e,
    [
      alloc(e, CONJASF.id, CostAllocationMethod.CustomSplit, 6667, "0.20"),
      alloc(e, HIDROMEC.id, CostAllocationMethod.CustomSplit, 3333, "0.10"),
    ],
    CC_BY_ID,
  );
  assertEqual(report.allocatedDecimal, "0.30", "0.20 + 0.10 = 0.30 exato");
  assertEqual(report.unallocatedDecimal, "0.00", "sem resíduo de float");
});

// 10
runTest("custo demonstrativo permanece distinto de custo real", () => {
  const demo = buildGoldenReadModel(true);
  assertEqual(demo.dataNature, CostDataNature.Demonstrative, "natureza preservada");
  assert(demo.measurementComparison.disclaimer !== null, "disclaimer presente para demonstrativo");
  for (const e of demo.entries) assertEqual(e.nature, CostDataNature.Demonstrative, "cada despesa marcada");

  const actual = buildProjectCostCentersReadModel({
    organizationId: ORG,
    engineeringProjectId: PROJ,
    projectName: null,
    period: "2026-06",
    periodLabel: "jun/2026",
    dataNature: CostDataNature.Actual,
    costCenters: [CONJASF, HIDROMEC],
    costEntries: buildGoldenEntries(),
    operationalLayerMaterialized: true,
    measurementComparison: {
      available: true,
      measuredValueDecimal: "252654.78",
      measurementLabel: "BM 08",
    },
  });
  assertEqual(actual.measurementComparison.disclaimer, null, "sem disclaimer demonstrativo em custo real");
});

// 11..14
runTest("golden — total 242000.00; CONJASF 124200.00; HIDROMEC 117800.00; não atribuído 0.00", () => {
  const rm = buildGoldenReadModel();
  assertEqual(rm.totalCostDecimal, "242000.00", "total");
  assertEqual(rm.allocatedCostDecimal, "242000.00", "alocado");
  assertEqual(rm.unallocatedCostDecimal, "0.00", "não atribuído");
  const a = rm.costCenters.find((c) => c.id === CONJASF.id)!;
  const b = rm.costCenters.find((c) => c.id === HIDROMEC.id)!;
  assertEqual(a.allocatedCostDecimal, "124200.00", "CONJASF");
  assertEqual(b.allocatedCostDecimal, "117800.00", "HIDROMEC");
});

// 15..17
runTest("golden — famílias: RH 130000.00; Combustível 24000.00; Locação 88000.00", () => {
  const rm = buildGoldenReadModel();
  const byFamily = new Map(rm.families.map((f) => [f.family, f.amountDecimal]));
  assertEqual(byFamily.get(CostFamily.RH), "130000.00", "RH");
  assertEqual(byFamily.get(CostFamily.Combustivel), "24000.00", "Combustível");
  assertEqual(byFamily.get(CostFamily.LocacaoEquipamentos), "88000.00", "Locação");
  const familySum = rm.families.reduce((s, f) => s + Number(moneyToCents(f.amountDecimal)), 0);
  assertEqual(familySum, 24200000, "famílias somam 242000.00");
});

// 18
runTest("golden — percentuais 51.32 / 48.68 e 53.72 / 9.92 / 36.36", () => {
  const rm = buildGoldenReadModel();
  const a = rm.costCenters.find((c) => c.id === CONJASF.id)!;
  const b = rm.costCenters.find((c) => c.id === HIDROMEC.id)!;
  assertEqual(a.costSharePercent, "51.32", "CONJASF %");
  assertEqual(b.costSharePercent, "48.68", "HIDROMEC %");
  const byFamily = new Map(rm.families.map((f) => [f.family, f.sharePercent]));
  assertEqual(byFamily.get(CostFamily.RH), "53.72", "RH %");
  assertEqual(byFamily.get(CostFamily.Combustivel), "9.92", "Combustível %");
  assertEqual(byFamily.get(CostFamily.LocacaoEquipamentos), "36.36", "Locação %");
  // participação societária exibida à parte, nunca igualada à participação nos custos
  assertEqual(a.consortiumSharePercent, "50.00", "participação societária 50%");
  assert(a.consortiumSharePercent !== a.costSharePercent, "societária ≠ custos");
});

// 19..20
runTest("golden — 7 despesas e 9 linhas de alocação", () => {
  const rm = buildGoldenReadModel();
  assertEqual(rm.entries.length, 7, "7 despesas");
  const allocationLines = rm.entries.reduce((n, e) => n + e.allocations.length, 0);
  assertEqual(allocationLines, 9, "9 alocações");
});

// família × centro de custo
runTest("golden — família × centro de custo", () => {
  const rm = buildGoldenReadModel();
  const rh = rm.families.find((f) => f.family === CostFamily.RH)!;
  const rhByCc = new Map(rh.costCenters.map((c) => [c.costCenterId, c.amountDecimal]));
  assertEqual(rhByCc.get(CONJASF.id), "70200.00", "RH · CONJASF");
  assertEqual(rhByCc.get(HIDROMEC.id), "59800.00", "RH · HIDROMEC");
  const loc = rm.families.find((f) => f.family === CostFamily.LocacaoEquipamentos)!;
  const locByCc = new Map(loc.costCenters.map((c) => [c.costCenterId, c.amountDecimal]));
  assertEqual(locByCc.get(CONJASF.id), "42000.00", "Locação · CONJASF");
  assertEqual(locByCc.get(HIDROMEC.id), "46000.00", "Locação · HIDROMEC");
});

// 21
runTest("comparação demonstrativa: 252654.78 − 242000.00 = 10654.78", () => {
  const rm = buildGoldenReadModel();
  assertEqual(rm.measurementComparison.available, true, "medição localizada");
  assertEqual(rm.measurementComparison.measuredValueDecimal, "252654.78", "valor medido");
  assertEqual(rm.measurementComparison.demonstrativeCostValueDecimal, "242000.00", "custos demonstrativos");
  assertEqual(rm.measurementComparison.demonstrativeDifferenceDecimal, "10654.78", "diferença demonstrativa");
});

// 22
runTest("comparação NUNCA enquadra a diferença como lucro/margem/ganho/economia (Demonstrative)", () => {
  const rm = buildGoldenReadModel();
  // O enunciado neutro nunca usa os termos proibidos...
  const statement = (rm.measurementComparison.neutralStatement ?? "").toLowerCase();
  for (const term of ["lucro", "margem", "ganho", "economia"]) {
    assert(!statement.includes(term), `enunciado neutro sem "${term}"`);
  }
  // ...e o disclaimer obrigatório NEGA explicitamente esses termos.
  const disclaimer = (rm.measurementComparison.disclaimer ?? "").toLowerCase();
  assert(disclaimer.includes("não representa lucro"), "disclaimer nega enquadramento como lucro/margem");
});

// 23
runTest("estado sem tabela/dados materializados não vira erro", () => {
  const rm = buildProjectCostCentersReadModel({
    organizationId: ORG,
    engineeringProjectId: PROJ,
    projectName: "Projeto Genérico",
    period: "2026-06",
    periodLabel: "jun/2026",
    dataNature: CostDataNature.Demonstrative,
    costCenters: [CONJASF, HIDROMEC],
    costEntries: [],
    operationalLayerMaterialized: false,
    measurementComparison: { available: false, measuredValueDecimal: null, measurementLabel: null },
  });
  assertEqual(rm.operationalState, "not_materialized", "estado explícito");
  assertEqual(rm.hasCostEntries, false, "sem custos ≠ R$ 0 real");
  assertEqual(rm.totalCostDecimal, "0.00", "total zero informativo");
  assertEqual(rm.costCenters.length, 2, "centros de custo ainda exibidos");
  assertEqual(rm.measurementComparison.available, false, "comparação oculta sem custos");
});

// 24
runTest("nenhum hardcode Lagoa/CONJASF/HIDROMEC/UUID no domínio e read model", () => {
  const files = [
    "src/domain/cost-center/project-cost-allocation.ts",
    "src/domain/cost-center/project-cost-allocation.types.ts",
    "src/domain/cost-center/project-cost-centers-read-model.ts",
  ];
  const banned = [/lagoa/i, /conjasf/i, /hidromec/i, /f82dd4af/i, /a0904068/i, /22\/2025/, /252654/];
  for (const rel of files) {
    const content = readFileSync(resolve(process.cwd(), rel), "utf8");
    for (const re of banned) {
      assert(!re.test(content), `${rel} não contém ${re}`);
    }
  }
});

// 25
runTest("migration da camada operacional permanece marcada como NÃO APLICAR", () => {
  const migration = readFileSync(
    resolve(process.cwd(), "../../supabase/migrations/20260828120000_bdos_project_cost_entries_and_allocations.sql"),
    "utf8",
  );
  assert(migration.includes("NÃO APLICAR"), "cabeçalho de não-aplicação presente");
  assert(/project_cost_entries/.test(migration), "cria project_cost_entries");
  assert(/project_cost_allocations/.test(migration), "cria project_cost_allocations");
  assert(!/INSERT\s+INTO\s+project_cost_(entries|allocations)/i.test(migration), "sem business rows");
  assert(!/INSERT\s+INTO\s+financial_lancamentos/i.test(migration), "não toca o Financeiro real");
});

// invariantes adicionais
runTest("basis points fora de 1..10000 é recusado", () => {
  const e = entry("x", CostFamily.RH, "Folha de Pagamento", "1000.00");
  assertThrows(
    () => validateCostEntryAllocations(e, [alloc(e, CONJASF.id, CostAllocationMethod.Direct, 0, "1000.00")], CC_BY_ID),
    "allocation_basis_points",
  );
  assertThrows(
    () => validateCostEntryAllocations(e, [alloc(e, CONJASF.id, CostAllocationMethod.Direct, 10001, "1000.00")], CC_BY_ID),
    "allocation_basis_points",
  );
});

runTest("Centro de Custo repetido na mesma despesa é recusado", () => {
  const e = entry("x", CostFamily.RH, "Folha de Pagamento", "1000.00");
  assertThrows(
    () =>
      validateCostEntryAllocations(
        e,
        [
          alloc(e, CONJASF.id, CostAllocationMethod.CustomSplit, 5000, "500.00"),
          alloc(e, CONJASF.id, CostAllocationMethod.CustomSplit, 5000, "500.00"),
        ],
        CC_BY_ID,
      ),
    "duas vezes",
  );
});

runTest("ALLOCATED com diferença de centavos não é compensado silenciosamente", () => {
  const e = { ...entry("x", CostFamily.RH, "Folha de Pagamento", "1000.00"), status: CostEntryStatus.Allocated };
  assertThrows(
    () =>
      validateCostEntryAllocations(
        e,
        [alloc(e, CONJASF.id, CostAllocationMethod.Direct, 10000, "999.99")],
        CC_BY_ID,
      ),
    "não é compensada silenciosamente",
  );
});

runTest("DRAFT permite valor não atribuído", () => {
  const e = { ...entry("x", CostFamily.RH, "Folha de Pagamento", "1000.00"), status: CostEntryStatus.Draft };
  const report = validateCostEntryAllocations(
    e,
    [alloc(e, CONJASF.id, CostAllocationMethod.Direct, 4000, "400.00")],
    CC_BY_ID,
  );
  assertEqual(report.unallocatedDecimal, "600.00", "600 ainda não atribuído");
});

assertEqual(ALLOCATION_BPS_TOTAL, 10000, "constante de 100% em bps");
assert(sharePercent("124200.00", "242000.00") === "51.32", "sharePercent determinístico");
assert(CostAllocationValidationError.name === "CostAllocationValidationError", "erro nomeado");

console.log("\nTodos os testes direcionados de Centros de Custo passaram.");
