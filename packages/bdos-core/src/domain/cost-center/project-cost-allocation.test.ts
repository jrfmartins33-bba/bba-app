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
  validateCostEntryProvenance,
  formatBrlFromDecimal,
  formatPercentPtBr,
  pickDefaultCostCenterPeriod,
  buildAvailablePeriods,
  formatCostCenterPeriodLabel,
  costCenterToneKey,
  deriveCostCenterDisplayLabel,
  COST_CENTER_TONE_COUNT,
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

// Fixtures com CÓDIGOS realistas (último segmento = rótulo curto). As
// strings "CONJASF"/"HIDROMEC" aqui são DADOS DE TESTE — os arquivos de
// domínio permanecem sem hardcode (verificado no teste 24).
const CONJASF: ReadModelCostCenterInput = {
  id: "cc-A",
  organizationId: ORG,
  engineeringProjectId: PROJ,
  code: "CC-GEN-CONJASF",
  name: "Centro de Custo CONJASF — Projeto Genérico",
  consortiumMemberId: "member-A",
  consortiumMemberName: "CONJASF",
  consortiumShareBasisPoints: 5000,
};
const HIDROMEC: ReadModelCostCenterInput = {
  id: "cc-B",
  organizationId: ORG,
  engineeringProjectId: PROJ,
  code: "CC-GEN-HIDROMEC",
  name: "Centro de Custo HIDROMEC — Projeto Genérico",
  consortiumMemberId: "member-B",
  consortiumMemberName: "HIDROMEC",
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
  sourceRecordKey?: string | null,
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
    // Identidade determinística — nunca a descrição.
    sourceRecordKey:
      sourceRecordKey === undefined
        ? `demo-cost-center-2026-06-${String(seq).padStart(3, "0")}`
        : sourceRecordKey,
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
    availablePeriods: ["2026-06"],
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
    "src/domain/cost-center/cost-center-period.ts",
  ];
  const banned = [/lagoa/i, /conjasf/i, /hidromec/i, /f82dd4af/i, /a0904068/i, /22\/2025/, /252654/, /2026-06/];
  for (const rel of files) {
    const content = readFileSync(resolve(process.cwd(), rel), "utf8");
    for (const re of banned) {
      assert(!re.test(content), `${rel} não contém ${re}`);
    }
  }
});

// 25
const MIGRATION_SQL = readFileSync(
  resolve(process.cwd(), "../../supabase/migrations/20260828213449_bdos_project_cost_entries_and_allocations.sql"),
  "utf8",
);

/** SQL sem comentários de linha (`-- ...`) — para checar apenas o que EXECUTA. */
const MIGRATION_SQL_EXECUTABLE = MIGRATION_SQL.split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");

runTest("migration da camada operacional permanece marcada como NÃO APLICAR", () => {
  assert(MIGRATION_SQL.includes("NÃO APLICAR"), "cabeçalho de não-aplicação presente");
  assert(/project_cost_entries/.test(MIGRATION_SQL), "cria project_cost_entries");
  assert(/project_cost_allocations/.test(MIGRATION_SQL), "cria project_cost_allocations");
  assert(
    !/INSERT\s+INTO\s+project_cost_(entries|allocations)/i.test(MIGRATION_SQL_EXECUTABLE),
    "sem business rows (INSERT executável)",
  );
  assert(
    !/INSERT\s+INTO\s+financial_lancamentos/i.test(MIGRATION_SQL_EXECUTABLE),
    "não toca o Financeiro real",
  );
  assert(!/INSERT\s+INTO\s+financial_categorias/i.test(MIGRATION_SQL_EXECUTABLE), "não cria categorias");
});

runTest("migration — idempotência por identidade de origem (source_record_key), nunca por descrição", () => {
  // A chave de idempotência antiga (baseada em descrição) foi REMOVIDA.
  assert(
    !/project_cost_entries_natural_key_idx/.test(MIGRATION_SQL),
    "índice natural baseado em descrição foi removido",
  );
  assert(
    !/CREATE UNIQUE INDEX[\s\S]*lower\(btrim\(description\)\)/i.test(MIGRATION_SQL),
    "nenhum UNIQUE INDEX inclui lower(btrim(description))",
  );
  // Nova identidade: UNIQUE INDEX PARCIAL sobre (company, obra, source_kind, source_record_key).
  assert(
    /CREATE UNIQUE INDEX[^;]*project_cost_entries_source_record_key_unique_idx[\s\S]*?ON project_cost_entries \(\s*company_id,\s*engineering_project_id,\s*source_kind,\s*source_record_key\s*\)\s*WHERE source_record_key IS NOT NULL/i.test(
      MIGRATION_SQL,
    ),
    "UNIQUE INDEX parcial por identidade de origem",
  );
  // Coluna + CHECKs de identidade.
  assert(/\bsource_record_key\s+TEXT\b/i.test(MIGRATION_SQL), "coluna source_record_key TEXT nullable");
  assert(
    /CONSTRAINT project_cost_entries_source_record_key_not_blank CHECK \(\s*source_record_key IS NULL OR btrim\(source_record_key\) <> ''/i.test(
      MIGRATION_SQL,
    ),
    "source_record_key não pode ser vazia",
  );
  assert(
    /CONSTRAINT project_cost_entries_manual_demo_requires_source_key CHECK \(\s*source_kind <> 'ManualDemonstration' OR source_record_key IS NOT NULL/i.test(
      MIGRATION_SQL,
    ),
    "ManualDemonstration exige source_record_key",
  );
  // Estratégia de escrita: ON CONFLICT por inferência do índice PARCIAL, nunca ON CONFLICT ON CONSTRAINT <nome>.
  assert(
    !/ON CONFLICT ON CONSTRAINT\s+project_cost_entries/i.test(MIGRATION_SQL),
    "não usa ON CONFLICT ON CONSTRAINT com nome (índice não é constraint)",
  );
  assert(
    /ON CONFLICT \(company_id, engineering_project_id, source_kind, source_record_key\)\s*\n?\s*--?\s*WHERE source_record_key IS NOT NULL/i.test(
      MIGRATION_SQL,
    ),
    "inferência do índice parcial (colunas + predicado WHERE)",
  );
  assert(/DO NOTHING/i.test(MIGRATION_SQL) && /RETURNING id/i.test(MIGRATION_SQL), "DO NOTHING + releitura do id");
  // A releitura documentada NÃO toca na descrição.
  assert(
    !/SELECT id FROM project_cost_entries[\s\S]*btrim\(description\)/i.test(MIGRATION_SQL),
    "releitura do id nunca por descrição",
  );
});

runTest("migration — proveniência: source_kind vs data_nature; categoria não é prova de origem", () => {
  assert(
    !/project_cost_entries_actual_requires_origin/.test(MIGRATION_SQL),
    "CHECK antigo (categoria satisfazia origem) foi removido",
  );
  assert(
    /CONSTRAINT project_cost_entries_manual_demo_is_demonstrative CHECK \(\s*source_kind <> 'ManualDemonstration' OR data_nature = 'Demonstrative'/i.test(
      MIGRATION_SQL,
    ),
    "Regra A no banco",
  );
  assert(
    /CONSTRAINT project_cost_entries_actual_not_manual_demo CHECK \(\s*data_nature <> 'Actual' OR source_kind <> 'ManualDemonstration'/i.test(
      MIGRATION_SQL,
    ),
    "Regra B no banco",
  );
  assert(
    /CONSTRAINT project_cost_entries_financial_entry_requires_lancamento CHECK \(\s*source_kind <> 'FinancialEntry' OR financial_lancamento_id IS NOT NULL/i.test(
      MIGRATION_SQL,
    ),
    "Regra C no banco",
  );
  // financial_categoria_id nunca aparece como condição que satisfaz proveniência.
  assert(
    !/OR\s+financial_categoria_id IS NOT NULL/i.test(MIGRATION_SQL_EXECUTABLE),
    "categoria financeira não é tratada como prova de origem",
  );
});

runTest("migration — REVOKE explícito antes dos GRANTs; sem DELETE; RLS só SELECT p/ authenticated", () => {
  for (const role of ["PUBLIC", "anon", "authenticated", "service_role"]) {
    assert(
      new RegExp(`REVOKE ALL ON project_cost_entries FROM ${role};`).test(MIGRATION_SQL),
      `REVOKE ALL project_cost_entries FROM ${role}`,
    );
    assert(
      new RegExp(`REVOKE ALL ON project_cost_allocations FROM ${role};`).test(MIGRATION_SQL),
      `REVOKE ALL project_cost_allocations FROM ${role}`,
    );
  }
  assert(/GRANT SELECT ON project_cost_entries TO authenticated;/.test(MIGRATION_SQL), "authenticated: SELECT");
  assert(/GRANT SELECT ON project_cost_allocations TO authenticated;/.test(MIGRATION_SQL), "authenticated: SELECT");
  assert(
    /GRANT SELECT, INSERT, UPDATE ON project_cost_entries TO service_role;/.test(MIGRATION_SQL),
    "service_role: SELECT/INSERT/UPDATE",
  );
  assert(
    /GRANT SELECT, INSERT, UPDATE ON project_cost_allocations TO service_role;/.test(MIGRATION_SQL),
    "service_role: SELECT/INSERT/UPDATE",
  );
  const grantStatements = MIGRATION_SQL_EXECUTABLE.match(/GRANT[\s\S]*?;/gi) ?? [];
  assert(grantStatements.length > 0, "há GRANTs para inspecionar");
  assert(grantStatements.every((g) => !/\bDELETE\b/i.test(g)), "nenhum GRANT concede DELETE");
  const policyStatements = MIGRATION_SQL_EXECUTABLE.match(/CREATE POLICY[\s\S]*?;/gi) ?? [];
  assert(
    policyStatements.every((p) => /FOR SELECT/i.test(p) && !/FOR (INSERT|UPDATE|DELETE|ALL)/i.test(p)),
    "toda policy é FOR SELECT (sem escrita p/ authenticated)",
  );
  assert(
    /REVOKE ALL ON project_cost_entries FROM[\s\S]*GRANT SELECT ON project_cost_entries TO authenticated/.test(MIGRATION_SQL),
    "REVOKE vem antes do GRANT",
  );
});

// Proveniência (domínio) — categoria classifica, source_kind prova origem
runTest("proveniência: Actual + ManualDemonstration é recusado", () => {
  const e: ProjectCostEntry = {
    ...entry("x", CostFamily.RH, "Folha de Pagamento", "1000.00"),
    dataNature: CostDataNature.Actual,
    sourceKind: CostEntrySourceKind.ManualDemonstration,
  };
  assertThrows(() => validateCostEntryProvenance(e), "ManualDemonstration");
});

runTest("proveniência: Demonstrative + ManualDemonstration é aceito", () => {
  validateCostEntryProvenance({
    ...entry("x", CostFamily.RH, "Folha de Pagamento", "1000.00"),
    dataNature: CostDataNature.Demonstrative,
    sourceKind: CostEntrySourceKind.ManualDemonstration,
  });
});

runTest("proveniência: FinancialEntry sem financial_lancamento_id é recusado", () => {
  const e: ProjectCostEntry = {
    ...entry("x", CostFamily.RH, "Folha de Pagamento", "1000.00"),
    dataNature: CostDataNature.Actual,
    sourceKind: CostEntrySourceKind.FinancialEntry,
    financialLancamentoId: null,
  };
  assertThrows(() => validateCostEntryProvenance(e), "financial_lancamento_id");
});

runTest("proveniência: Actual só com categoria + ManualDemonstration é recusado (categoria ≠ origem)", () => {
  const e: ProjectCostEntry = {
    ...entry("x", CostFamily.Combustivel, "Combustível", "1000.00"),
    dataNature: CostDataNature.Actual,
    sourceKind: CostEntrySourceKind.ManualDemonstration,
    financialCategoriaId: "cat-combustivel",
    financialLancamentoId: null,
  };
  assertThrows(() => validateCostEntryProvenance(e), "ManualDemonstration");
});

runTest("proveniência: Actual + Document é permitido (sem exigir financial_lancamento_id)", () => {
  validateCostEntryProvenance({
    ...entry("x", CostFamily.LocacaoEquipamentos, "Locação de Equipamentos", "1000.00"),
    dataNature: CostDataNature.Actual,
    sourceKind: CostEntrySourceKind.Document,
    financialLancamentoId: null,
  });
});

// ---- Identidade / idempotência por source_record_key (não por descrição) ----

runTest("mesma descrição + source_record_key diferentes ⇒ DUAS despesas distintas", () => {
  seq = 0;
  allocSeq = 0;
  const DESC = "Combustível da operação compartilhada";
  const eA = entry(DESC, CostFamily.Combustivel, "Combustível", "24000.00", "nf-combustivel-A");
  const eB = entry(DESC, CostFamily.Combustivel, "Combustível", "24000.00", "nf-combustivel-B");
  assert(eA.description === eB.description, "descrição idêntica");
  assert(eA.competencePeriod === eB.competencePeriod && eA.costFamily === eB.costFamily && eA.dataNature === eB.dataNature, "mesma empresa/obra/mês/natureza/família");
  assert(eA.sourceRecordKey !== eB.sourceRecordKey, "só a identidade de origem difere");

  // O domínio aceita as duas — a descrição não é identidade.
  validateCostEntryProvenance(eA);
  validateCostEntryProvenance(eB);

  const rm = buildProjectCostCentersReadModel({
    organizationId: ORG,
    engineeringProjectId: PROJ,
    projectName: null,
    period: "2026-06",
    periodLabel: "jun/2026",
    dataNature: CostDataNature.Demonstrative,
    costCenters: [CONJASF, HIDROMEC],
    costEntries: [
      { entry: eA, allocations: [alloc(eA, CONJASF.id, CostAllocationMethod.Direct, 10000, "24000.00")] },
      { entry: eB, allocations: [alloc(eB, HIDROMEC.id, CostAllocationMethod.Direct, 10000, "24000.00")] },
    ],
    operationalLayerMaterialized: true,
    measurementComparison: { available: false, measuredValueDecimal: null, measurementLabel: null },
  });
  assertEqual(rm.entries.length, 2, "duas despesas distintas coexistem");
  assertEqual(rm.totalCostFormatted, "R$ 48.000,00", "somam as duas");
});

runTest("colisão de identidade: mesma (empresa, obra, source_kind, source_record_key)", () => {
  // A UNIQUE INDEX PARCIAL da migration é a barreira física dessa colisão;
  // aqui confirmamos que a estratégia de escrita infere ESSE índice.
  assert(
    /project_cost_entries_source_record_key_unique_idx/.test(MIGRATION_SQL),
    "índice único parcial de identidade existe",
  );
  assert(
    /ON CONFLICT \(company_id, engineering_project_id, source_kind, source_record_key\)/i.test(MIGRATION_SQL),
    "escrita infere o índice de identidade (colisão vira DO NOTHING)",
  );
});

runTest("ManualDemonstration exige source_record_key (nunca a descrição)", () => {
  const e: ProjectCostEntry = {
    ...entry("Combustível da operação compartilhada", CostFamily.Combustivel, "Combustível", "24000.00"),
    sourceKind: CostEntrySourceKind.ManualDemonstration,
    sourceRecordKey: null,
  };
  assertThrows(() => validateCostEntryProvenance(e), "source_record_key");
  assertThrows(
    () => validateCostEntryProvenance({ ...e, sourceRecordKey: "   " }),
    "source_record_key",
  );
});

runTest("descrição não faz parte de nenhum UNIQUE de identidade (migration)", () => {
  assert(!/project_cost_entries_natural_key_idx/.test(MIGRATION_SQL), "chave antiga por descrição removida");
  const uniqueIndexes = MIGRATION_SQL.match(/CREATE UNIQUE INDEX[\s\S]*?;/gi) ?? [];
  assert(uniqueIndexes.length > 0, "há UNIQUE INDEX para inspecionar");
  assert(
    uniqueIndexes.every((idx) => !/description/i.test(idx)),
    "nenhum UNIQUE INDEX referencia description",
  );
});

runTest("massa demonstrativa: 7 source_record_keys determinísticas e distintas", () => {
  const rm = buildGoldenEntries();
  const keys = rm.map(({ entry: e }) => e.sourceRecordKey);
  assertEqual(keys.length, 7, "7 chaves");
  assert(new Set(keys).size === 7, "todas distintas");
  assertEqual(keys[0], "demo-cost-center-2026-06-001", "D1");
  assertEqual(keys[6], "demo-cost-center-2026-06-007", "D7");
  assert(rm.every(({ entry: e }) => e.sourceKind === CostEntrySourceKind.ManualDemonstration && e.dataNature === CostDataNature.Demonstrative), "todas ManualDemonstration/Demonstrative");
});

// Apresentação vem pronta do domínio — a UI não recalcula valor financeiro
runTest("read model entrega apresentação pronta (BRL/percent) e semântica hasUnallocatedAmount", () => {
  const rm = buildGoldenReadModel();
  assertEqual(rm.totalCostFormatted, "R$ 242.000,00", "total formatado no domínio");
  assertEqual(rm.unallocatedCostFormatted, "R$ 0,00", "não atribuído formatado");
  assertEqual(rm.hasUnallocatedAmount, false, "sem valor não atribuído (decisão do domínio)");

  const a = rm.costCenters.find((c) => c.id === CONJASF.id)!;
  assertEqual(a.allocatedCostFormatted, "R$ 124.200,00", "centro: BRL pronto");
  assertEqual(a.costShareFormatted, "51,32%", "centro: percent pronto");
  assertEqual(a.consortiumShareFormatted, "50,00%", "centro: societária pronta");
  assert(a.costShareBarWidthPercent === 51 && a.consortiumShareBarWidthPercent === 50, "larguras de barra 0..100 inteiras");

  const rh = rm.families.find((f) => f.family === CostFamily.RH)!;
  assertEqual(rh.amountFormatted, "R$ 130.000,00", "família: BRL pronto");
  assertEqual(rh.shareFormatted, "53,72%", "família: percent pronto");
  assertEqual(rh.barWidthPercent, 100, "família maior normaliza a 100");
  const comb = rm.families.find((f) => f.family === CostFamily.Combustivel)!;
  assert(comb.barWidthPercent > 0 && comb.barWidthPercent < 100, "família menor entre 0 e 100");

  const e6 = rm.entries.find((e) => e.description.includes("escavadeira"))!;
  assertEqual(e6.amountFormatted, "R$ 60.000,00", "despesa: BRL pronto");
  assertEqual(e6.hasUnallocatedAmount, false, "despesa reconciliada");
  assertEqual(e6.allocations[0].percentageFormatted, "70,00%", "alocação: percent pronto");
  assertEqual(e6.allocations[0].amountFormatted, "R$ 42.000,00", "alocação: BRL pronto");

  assertEqual(rm.measurementComparison.demonstrativeDifferenceFormatted, "R$ 10.654,78", "diferença formatada");
});

runTest("formatBrlFromDecimal / formatPercentPtBr — bigint, sem float", () => {
  assertEqual(formatBrlFromDecimal("54000.00"), "R$ 54.000,00", "milhar");
  assertEqual(formatBrlFromDecimal("252654.78"), "R$ 252.654,78", "centavos preservados");
  assertEqual(formatBrlFromDecimal("0"), "R$ 0,00", "zero");
  assertEqual(formatBrlFromDecimal("-1234.5"), "- R$ 1.234,50", "negativo e pad");
  assertEqual(formatBrlFromDecimal("1000000.00"), "R$ 1.000.000,00", "milhão");
  assertEqual(formatPercentPtBr("48.68"), "48,68%", "percent pt-BR");
  assertEqual(formatPercentPtBr(null), "—", "percent ausente");
});

const COST_CENTERS_COMPONENT = readFileSync(
  resolve(process.cwd(), "../../apps/web/components/engenharia/project-cost-centers-page.tsx"),
  "utf8",
);
const COST_CENTERS_CSS = readFileSync(
  resolve(process.cwd(), "../../apps/web/components/engenharia/project-cost-centers.module.css"),
  "utf8",
);
const countOccurrences = (haystack: string, needle: string): number => haystack.split(needle).length - 1;

runTest("componente Centros de Custo não recalcula valor financeiro (sem Number/Math sobre decimais)", () => {
  assert(!/Number\(/.test(COST_CENTERS_COMPONENT), "sem Number( no componente");
  assert(!/parseFloat|parseInt/.test(COST_CENTERS_COMPONENT), "sem parseFloat/parseInt no componente");
  assert(!/Math\.(max|min|round|abs)\s*\([^)]*(amount|Decimal|Value)/i.test(COST_CENTERS_COMPONENT), "sem Math sobre valores");
  assert(!/\bNumber\b|\btoLocaleString\b/.test(COST_CENTERS_COMPONENT), "sem toLocaleString/Number");
});

runTest("UI de Centros de Custo — nenhum termo técnico interno visível", () => {
  const forbidden = [
    "financial_lancamentos",
    "project_cost_entries",
    "project_cost_allocations",
    "source_record_key",
    "source_kind",
    "data_nature",
    "allocation_method",
    "basis_points",
    "competence_period",
    "visualToneKey",
  ];
  for (const term of forbidden) {
    assert(!COST_CENTERS_COMPONENT.includes(term), `sem "${term}" no componente`);
  }
  for (const token of ["ManualDemonstration", "EQUAL_SPLIT", "CUSTOM_SPLIT", "FinancialEntry"]) {
    assert(!new RegExp(`\\b${token}\\b`).test(COST_CENTERS_COMPONENT), `sem enum "${token}"`);
  }
  assert(!/\bDIRECT\b/.test(COST_CENTERS_COMPONENT), "sem enum DIRECT");
  assert(!/\bDemonstrative\b/.test(COST_CENTERS_COMPONENT), "sem enum Demonstrative (usa rm.isDemonstrative)");
  assert(!/\bActual\b/.test(COST_CENTERS_COMPONENT), "sem enum Actual");
  assert(!/["'>]\s*(DIRECT|EQUAL_SPLIT|CUSTOM_SPLIT|ManualDemonstration|Actual)\s*[<"']/.test(COST_CENTERS_COMPONENT), "nenhum enum renderizado como texto");
  // Sem nomes de consorciados hardcodados e sem hexadecimal no JSX (cores ficam no CSS).
  assert(!/CONJASF|HIDROMEC/.test(COST_CENTERS_COMPONENT), "sem nome de consorciado hardcodado no componente");
  assert(!/#[0-9a-fA-F]{3,8}\b/.test(COST_CENTERS_COMPONENT), "sem cor hexadecimal no componente (fica no CSS)");
});

// ================= PERÍODO GERENCIAL =================
runTest("período default — CUSTO REGISTRADO > MEDIÇÃO FORMAL > MÊS CORRENTE", () => {
  // 1. mês atual 2026-08, custos só em 2026-06 → 2026-06
  assertEqual(
    pickDefaultCostCenterPeriod({ costEntryPeriods: ["2026-06"], latestBulletinPeriod: "2026-08", currentYearMonth: "2026-08" }),
    "2026-06",
    "custo vence a medição e o mês corrente",
  );
  // 2. custos 2026-06 e 2026-07 → 2026-07
  assertEqual(
    pickDefaultCostCenterPeriod({ costEntryPeriods: ["2026-06", "2026-07"], latestBulletinPeriod: null, currentYearMonth: "2026-08" }),
    "2026-07",
    "período de custo mais recente",
  );
  // 3. nenhum custo, BM em 2026-06 → 2026-06
  assertEqual(
    pickDefaultCostCenterPeriod({ costEntryPeriods: [], latestBulletinPeriod: "2026-06", currentYearMonth: "2026-08" }),
    "2026-06",
    "medição formal como fallback",
  );
  // 4. nenhum custo, nenhum BM → mês corrente
  assertEqual(
    pickDefaultCostCenterPeriod({ costEntryPeriods: [], latestBulletinPeriod: null, currentYearMonth: "2026-08" }),
    "2026-08",
    "mês corrente como último fallback",
  );
  // valores inválidos são ignorados
  assertEqual(
    pickDefaultCostCenterPeriod({ costEntryPeriods: ["2026-13", "2026-06"], latestBulletinPeriod: null, currentYearMonth: "2026-08" }),
    "2026-06",
    "período inválido descartado",
  );
});

runTest("availablePeriods — únicos, ordenados do mais recente ao mais antigo, com rótulo pt-BR", () => {
  const list = buildAvailablePeriods(["2026-06", "2026-08", "2026-07", "2026-06"]);
  assertEqual(list.map((p) => p.value).join(","), "2026-08,2026-07,2026-06", "ordem desc e sem duplicatas");
  assertEqual(list[0].label, "ago/2026", "rótulo pt-BR");
  assertEqual(formatCostCenterPeriodLabel("2026-06"), "jun/2026", "jun/2026");
  // garante que o período exibido apareça mesmo sem custos (período explícito e vazio)
  const withEnsure = buildAvailablePeriods([], "2026-08");
  assertEqual(withEnsure.map((p) => p.value).join(","), "2026-08", "período atual preservado");
});

runTest("seletor de período — read model expõe availablePeriods e período atual", () => {
  const rm = buildGoldenReadModel();
  assertEqual(rm.availablePeriods.map((p) => p.value).join(","), "2026-06", "availablePeriods do caso atual");
  assertEqual(rm.availablePeriods[0].label, "jun/2026", "rótulo do seletor");
  assertEqual(rm.period, "2026-06", "período atual");
  // componente navega preservando ?empresa= e setando ?periodo=
  assert(/onSelectPeriod/.test(COST_CENTERS_COMPONENT), "componente tem handler de período");
  assert(/query\.set\("empresa"/.test(COST_CENTERS_COMPONENT) && /query\.set\("periodo", value\)/.test(COST_CENTERS_COMPONENT), "preserva empresa e seta periodo");
});

// ================= IDENTIDADE VISUAL =================
runTest("tom visual — determinístico e estável por ordem, sem comparação nominal", () => {
  assertEqual(costCenterToneKey(0), "cost-center-tone-1", "índice 0 → tom 1");
  assertEqual(costCenterToneKey(1), "cost-center-tone-2", "índice 1 → tom 2");
  assertEqual(costCenterToneKey(COST_CENTER_TONE_COUNT), "cost-center-tone-1", "cicla após N tons");

  const rm = buildGoldenReadModel();
  assertEqual(rm.costCenters[0].toneKey, "cost-center-tone-1", "1º Centro de Custo → tom 1");
  assertEqual(rm.costCenters[1].toneKey, "cost-center-tone-2", "2º Centro de Custo → tom 2");
  // dois builds seguidos → mesmos tons (estável)
  const rm2 = buildGoldenReadModel();
  assertEqual(rm2.costCenters[0].toneKey, rm.costCenters[0].toneKey, "estável entre builds");

  // nenhum hardcode "CONJASF → cor" no domínio
  const src = readFileSync(resolve(process.cwd(), "src/domain/cost-center/project-cost-centers-read-model.ts"), "utf8");
  assert(!/conjasf/i.test(src) && !/hidromec/i.test(src), "read model sem nome de consorciado");
  assert(!/#[0-9a-fA-F]{3,8}\b/.test(src), "read model sem hexadecimal (cor vive no CSS)");
});

runTest("rótulo curto (displayLabel) para leitura gerencial + fullLabel preservado", () => {
  const rm = buildGoldenReadModel();
  assertEqual(rm.costCenters[0].displayLabel, "CONJASF", "displayLabel curto");
  assertEqual(rm.costCenters[1].displayLabel, "HIDROMEC", "displayLabel curto");
  assert(rm.costCenters[0].fullLabel.includes("Centro de Custo CONJASF"), "fullLabel completo preservado");
  assertEqual(deriveCostCenterDisplayLabel("CC-LAGOA-CONJASF", null, "Centro de Custo CONJASF — Lagoa"), "CONJASF", "derivado do código");
  assertEqual(deriveCostCenterDisplayLabel("SEMSEGMENTO", "Nome Comercial", "Nome Longo do Centro"), "Nome Comercial", "fallback nome comercial curto");
  assertEqual(deriveCostCenterDisplayLabel("x", null, "Centro de Custo Fulano — Obra"), "Centro de Custo Fulano — Obra", "fallback nome completo");
});

runTest("matriz e alocações carregam o MESMO tom por Centro de Custo", () => {
  const rm = buildGoldenReadModel();
  for (let i = 0; i < rm.costCenters.length; i += 1) {
    assertEqual(rm.costMatrix.costCenters[i].toneKey, rm.costCenters[i].toneKey, `coluna ${i} usa o tom do Centro de Custo`);
    assertEqual(rm.costMatrix.costCenters[i].displayLabel, rm.costCenters[i].displayLabel, `coluna ${i} usa o rótulo curto`);
  }
  const toneById = new Map(rm.costCenters.map((c) => [c.id, c.toneKey]));
  for (const e of rm.entries) {
    for (const a of e.allocations) {
      assertEqual(a.toneKey, toneById.get(a.costCenterId), "alocação usa o tom do Centro de Custo");
      assert(a.costCenterDisplayLabel === "CONJASF" || a.costCenterDisplayLabel === "HIDROMEC", "alocação usa rótulo curto");
    }
  }
  for (const f of rm.families) {
    for (const c of f.costCenters) {
      assertEqual(c.toneKey, toneById.get(c.costCenterId), "família×centro usa o tom do Centro de Custo");
    }
  }
});

runTest("barra empilhada por Centro de Custo — segmentos somam 100 e refletem a proporção", () => {
  const rm = buildGoldenReadModel();
  const fam = (f: CostFamily) => rm.families.find((x) => x.family === f)!;

  const rh = fam(CostFamily.RH);
  assertEqual(rh.costCenters.map((c) => c.barWidthPercent).reduce((a, b) => a + b, 0), 100, "RH segmentos somam 100");
  assertEqual(rh.costCenters[0].amountFormatted, "R$ 70.200,00", "RH · CONJASF");
  assertEqual(rh.costCenters[1].amountFormatted, "R$ 59.800,00", "RH · HIDROMEC");
  assertEqual(rh.costCenters[0].shareWithinFamilyFormatted, "54,00%", "RH · CONJASF % dentro da família");

  const comb = fam(CostFamily.Combustivel);
  assertEqual(comb.costCenters.map((c) => c.barWidthPercent).join("/"), "50/50", "Combustível 50/50 visual");
  assert(comb.costCenters.every((c) => c.shareWithinFamilyFormatted === "50,00%"), "Combustível meio a meio");

  const loc = fam(CostFamily.LocacaoEquipamentos);
  assertEqual(loc.costCenters[0].amountFormatted, "R$ 42.000,00", "Locação · CONJASF");
  assertEqual(loc.costCenters[1].amountFormatted, "R$ 46.000,00", "Locação · HIDROMEC");
  assertEqual(loc.costCenters.map((c) => c.barWidthPercent).reduce((a, b) => a + b, 0), 100, "Locação segmentos somam 100");
});

runTest("mini barra de rateio nas despesas — 2 segmentos para rateio, nenhum para atribuição direta", () => {
  const rm = buildGoldenReadModel();
  const byDesc = (n: string) => rm.entries.find((e) => e.description.includes(n))!;

  const escav = byDesc("escavadeira");
  assertEqual(escav.allocations.length, 2, "escavadeira: 2 destinos");
  assertEqual(escav.allocations.map((a) => a.barWidthPercent).join("/"), "70/30", "escavadeira 70/30");

  const comb = byDesc("Combustível da operação");
  assertEqual(comb.allocations.map((a) => a.barWidthPercent).join("/"), "50/50", "combustível 50/50");

  const caminhoes = byDesc("caminhões");
  assertEqual(caminhoes.allocations.length, 1, "atribuição direta: só o Centro atribuído");
  assertEqual(caminhoes.allocations[0].barWidthPercent, 100, "atribuição direta = 100");
  assert(caminhoes.isSingleDirect, "flag de atribuição direta simples");
});

runTest("TOTAL e Não atribuído permanecem neutros (sem tom de Centro de Custo)", () => {
  const rm = buildGoldenReadModel();
  // columnTotals são ReadModelMatrixCell — não carregam toneKey.
  assert(
    !("toneKey" in (rm.costMatrix.columnTotals[0] as unknown as Record<string, unknown>)),
    "coluna TOTAL sem tom",
  );
  assert(!("toneKey" in (rm.costMatrix as unknown as Record<string, unknown>)), "grandTotal sem tom");
  // "Não atribuído" não é um Centro de Custo: não aparece em costCenters.
  assert(rm.costCenters.every((c) => c.displayLabel !== "Não atribuído"), "Não atribuído não é Centro de Custo");
});

runTest("nenhum verde/vermelho como identidade de Centro de Custo (CSS)", () => {
  const toneBlock = COST_CENTERS_CSS.slice(COST_CENTERS_CSS.indexOf("IDENTIDADE VISUAL DOS CENTROS DE CUSTO"));
  const toneDefs = toneBlock.match(/\.tone[1-6]\s*\{[^}]*\}/g) ?? [];
  assertEqual(toneDefs.length, 6, "6 tons definidos");
  for (const def of toneDefs) {
    assert(!/#22c55e|#16a34a|#22C55E|rgba?\([^)]*\bgreen\b|:\s*green|#ef4444|#dc2626|:\s*red|\bred\b/i.test(def), `tom sem verde/vermelho: ${def}`);
  }
});

// ================= REFINAMENTO FINAL DE UI =================
runTest("card TOTAL/CONSOLIDADO é institucional NEUTRO — nunca a cor de um Centro de Custo", () => {
  // O valor do card total não usa mais o destaque dourado (identidade do 1º Centro de Custo).
  assert(!/kpiValuePrimary/.test(COST_CENTERS_COMPONENT), "componente não usa mais kpiValuePrimary no total");
  // O card total usa kpiCardPrimary (institucional) e NÃO recebe toneClass/kpiCardTone.
  const primaryLine = COST_CENTERS_COMPONENT.split("\n").find((l) => l.includes("styles.kpiCardPrimary")) ?? "";
  assert(primaryLine.length > 0, "card institucional presente");
  assert(!/toneClass|kpiCardTone/.test(primaryLine), "card total sem tom de Centro de Custo");
  // Os cards de Centro de Custo continuam com tom; os tons 1 e 2 não mudaram.
  assert(/kpiCardTone.*toneClass\(cc\.toneKey\)/.test(COST_CENTERS_COMPONENT), "cards de Centro de Custo com tom");
  const rm = buildGoldenReadModel();
  assertEqual(rm.costCenters[0].toneKey, "cost-center-tone-1", "1º Centro de Custo mantém tom 1");
  assertEqual(rm.costCenters[1].toneKey, "cost-center-tone-2", "2º Centro de Custo mantém tom 2");
  // CSS: kpiCardPrimary não usa dourado do consorciado.
  const kpiPrimaryDef = COST_CENTERS_CSS.match(/\.kpiCardPrimary\s*\{[^}]*\}/)?.[0] ?? "";
  assert(!/#d8bd85|bba-gold-soft|185,\s*149,\s*79/.test(kpiPrimaryDef), "kpiCardPrimary sem código visual do consorciado");
});

runTest("Composição por tipo de custo — 'Participação no custo total' explícito + rótulo da barra", () => {
  assert(
    /Participação no custo total: \{f\.shareFormatted\}/.test(COST_CENTERS_COMPONENT),
    "texto 'Participação no custo total: {%}' presente",
  );
  assert(
    /Distribuição entre Centros de Custo/.test(COST_CENTERS_COMPONENT),
    "rótulo da barra empilhada presente",
  );
  const rm = buildGoldenReadModel();
  const byFam = new Map(rm.families.map((f) => [f.family, f.shareFormatted]));
  assertEqual(byFam.get(CostFamily.RH), "53,72%", "RH — participação no custo total");
  assertEqual(byFam.get(CostFamily.Combustivel), "9,92%", "Combustível — participação no custo total");
  assertEqual(byFam.get(CostFamily.LocacaoEquipamentos), "36,36%", "Locação — participação no custo total");
  // A barra continua representando a distribuição INTERNA entre Centros de Custo.
  const rh = rm.families.find((f) => f.family === CostFamily.RH)!;
  assertEqual(rh.costCenters.map((c) => c.shareWithinFamilyFormatted).join("/"), "54,00%/46,00%", "distribuição interna RH");
  assertEqual(rh.costCenters.map((c) => c.barWidthPercent).reduce((a, b) => a + b, 0), 100, "segmentos somam 100");
});

runTest("cards de distribuição — altura natural por conteúdo (sem altura fixa)", () => {
  assert(/\.distribList\s*\{[^}]*align-items:\s*start/.test(COST_CENTERS_CSS), ".distribList usa align-items: start");
  const distribCardDef = COST_CENTERS_CSS.match(/\.distribCard\s*\{[^}]*\}/)?.[0] ?? "";
  assert(distribCardDef.length > 0, ".distribCard definido");
  assert(!/\bheight:\s*\d/.test(distribCardDef) && !/min-height:/.test(distribCardDef), "sem altura fixa/mínima no card");
  // Justificativa do rateio continua sendo renderizada.
  assert(/entry\.distributionNote && <p className=\{styles\.distribNote\}>/.test(COST_CENTERS_COMPONENT), "justificativa preservada");
});

runTest("badge DEMONSTRATIVO removido só do bloco 'Como os custos foram distribuídos'", () => {
  // Natureza aparece uma única vez no componente — na tabela 'Despesas detalhadas'.
  assertEqual(countOccurrences(COST_CENTERS_COMPONENT, "entry.natureLabel"), 1, "natureLabel renderizado uma vez");
  assertEqual(countOccurrences(COST_CENTERS_COMPONENT, "styles.natureTag"), 1, "natureTag usado uma vez (tabela detalhada)");
  // A seção 'Como os custos foram distribuídos' não referencia mais natureLabel.
  const distribSection = COST_CENTERS_COMPONENT.slice(
    COST_CENTERS_COMPONENT.indexOf("Como os custos foram distribuídos"),
    COST_CENTERS_COMPONENT.indexOf("PARTICIPAÇÃO SOCIETÁRIA"),
  );
  assert(!/natureLabel|natureTag/.test(distribSection), "bloco de distribuição sem badge de natureza");
  // Badge principal e coluna Natureza da tabela detalhada permanecem.
  assert(/DADOS DEMONSTRATIVOS/.test(COST_CENTERS_COMPONENT), "badge principal no topo permanece");
  assert(/<th>Natureza<\/th>/.test(COST_CENTERS_COMPONENT), "coluna Natureza na tabela detalhada permanece");
  // Disclaimers da Simulação Gerencial permanecem.
  assert(/mc\.disclaimer && <p/.test(COST_CENTERS_COMPONENT) && /mc\.neutralStatement && <p/.test(COST_CENTERS_COMPONENT), "disclaimers da simulação permanecem");
  // Natureza continua no domínio/read model.
  const rm = buildGoldenReadModel();
  assert(rm.entries.every((e) => e.natureLabel === "Demonstrativo"), "natureza permanece no read model");
});

runTest("read model — rótulos de negócio em português (critério, natureza, família)", () => {
  const rm = buildGoldenReadModel();
  const labels = new Set(rm.entries.map((e) => e.criterionLabel));
  assert(labels.has("Atribuição direta"), "critério: Atribuição direta");
  assert(labels.has("Rateio igual"), "critério: Rateio igual");
  assert(labels.has("Rateio específico"), "critério: Rateio específico");
  assert(rm.entries.every((e) => e.natureLabel === "Demonstrativo"), "natureza: Demonstrativo");
  const families = new Set(rm.families.map((f) => f.familyLabel));
  assert(families.has("RH") && families.has("Combustível") && families.has("Locação de Equipamentos"), "famílias em pt-BR");
  // nenhum enum cru vaza para os rótulos
  const allLabels = [
    ...rm.entries.map((e) => e.criterionLabel),
    ...rm.entries.map((e) => e.natureLabel),
    ...rm.families.map((f) => f.familyLabel),
    ...rm.entries.flatMap((e) => e.allocations.map((a) => a.methodLabel)),
  ].join("|");
  for (const token of ["DIRECT", "EQUAL_SPLIT", "CUSTOM_SPLIT", "ManualDemonstration", "Demonstrative", "Actual"]) {
    assert(!allLabels.includes(token), `rótulo sem "${token}"`);
  }
});

// ---- Matriz Categoria × Centro de Custo (do read model, não da UI) ----
runTest("matriz — RH/Combustível/Locação × CONJASF/HIDROMEC + totais", () => {
  const rm = buildGoldenReadModel();
  const m = rm.costMatrix;
  assertEqual(m.costCenters.length, 2, "2 colunas");
  assertEqual(m.costCenters[0].id, CONJASF.id, "coluna 0 = CONJASF");
  assertEqual(m.costCenters[1].id, HIDROMEC.id, "coluna 1 = HIDROMEC");

  const row = (fam: CostFamily) => m.rows.find((r) => r.family === fam)!;

  assertEqual(row(CostFamily.RH).cells[0].amountFormatted, "R$ 70.200,00", "RH × CONJASF");
  assertEqual(row(CostFamily.RH).cells[1].amountFormatted, "R$ 59.800,00", "RH × HIDROMEC");
  assertEqual(row(CostFamily.RH).totalFormatted, "R$ 130.000,00", "RH total");

  assertEqual(row(CostFamily.Combustivel).cells[0].amountFormatted, "R$ 12.000,00", "Combustível × CONJASF");
  assertEqual(row(CostFamily.Combustivel).cells[1].amountFormatted, "R$ 12.000,00", "Combustível × HIDROMEC");
  assertEqual(row(CostFamily.Combustivel).totalFormatted, "R$ 24.000,00", "Combustível total");

  assertEqual(row(CostFamily.LocacaoEquipamentos).cells[0].amountFormatted, "R$ 42.000,00", "Locação × CONJASF");
  assertEqual(row(CostFamily.LocacaoEquipamentos).cells[1].amountFormatted, "R$ 46.000,00", "Locação × HIDROMEC");
  assertEqual(row(CostFamily.LocacaoEquipamentos).totalFormatted, "R$ 88.000,00", "Locação total");

  assertEqual(m.columnTotals[0].amountFormatted, "R$ 124.200,00", "coluna CONJASF total");
  assertEqual(m.columnTotals[1].amountFormatted, "R$ 117.800,00", "coluna HIDROMEC total");
  assertEqual(m.grandTotalFormatted, "R$ 242.000,00", "total geral da matriz");

  // reconciliação em centavos: soma das linhas por coluna = total da coluna
  for (let col = 0; col < 2; col += 1) {
    const sumCol = m.rows.reduce((s, r) => s + Number(moneyToCents(r.cells[col].amountDecimal)), 0);
    assertEqual(sumCol, Number(moneyToCents(m.columnTotals[col].amountDecimal)), `coluna ${col} fecha`);
  }
  const sumRows = m.rows.reduce((s, r) => s + Number(moneyToCents(r.totalDecimal)), 0);
  assertEqual(sumRows, Number(moneyToCents(m.grandTotalDecimal)), "linhas fecham no total geral");
});

runTest("como os custos foram distribuídos — critérios e percentuais por despesa", () => {
  const rm = buildGoldenReadModel();
  const byDesc = (needle: string) => rm.entries.find((e) => e.description.includes(needle))!;

  const combustivel = byDesc("Combustível da operação");
  assertEqual(combustivel.criterionLabel, "Rateio igual", "combustível: rateio igual");
  assertEqual(combustivel.allocations.map((a) => a.percentageFormatted).join("/"), "50,00%/50,00%", "combustível 50/50");
  assert(combustivel.distributionNote !== null && /não decorre da participação societária/i.test(combustivel.distributionNote), "nota do rateio 50/50");

  const escavadeira = byDesc("escavadeira");
  assertEqual(escavadeira.criterionLabel, "Rateio específico", "escavadeira: rateio específico");
  assertEqual(escavadeira.allocations.map((a) => a.percentageFormatted).join("/"), "70,00%/30,00%", "escavadeira 70/30");

  const caminhoes = byDesc("caminhões");
  assertEqual(caminhoes.criterionLabel, "Atribuição direta", "caminhões: atribuição direta");
  assert(caminhoes.isSingleDirect, "caminhões: atribuição direta simples");
  assertEqual(caminhoes.allocations[0].costCenterId, HIDROMEC.id, "caminhões → HIDROMEC");
  assertEqual(caminhoes.allocations[0].percentageFormatted, "100,00%", "caminhões 100%");

  for (const needle of ["Folha operacional — CONJASF", "Folha operacional — HIDROMEC", "Encargos trabalhistas — CONJASF", "Encargos trabalhistas — HIDROMEC"]) {
    const e = byDesc(needle);
    assertEqual(e.criterionLabel, "Atribuição direta", `${needle}: atribuição direta`);
    assert(e.isSingleDirect, `${needle}: direta simples`);
    assertEqual(e.distributionNote, null, `${needle}: sem nota de rateio`);
  }
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
