import {
  ProcurementEngineeringReconstructionError,
  budgetVersionDraftRpcParams,
  budgetVersionSnapshotRpcParams,
  mapBudgetVersionAggregate,
  mapProcurementCaseRow,
  mapProcurementLotRow,
  procurementCaseCreateRpcParams,
  procurementLotRegisterRpcParams,
} from "./procurement-engineering-mappers";
import type { BudgetLineRow, BudgetVersionRow, LineageRelationRow, ProcurementCaseRow, ProcurementLotRow } from "./procurement-engineering-mappers";
import {
  BudgetLineKind,
  BudgetVersionOriginKind,
  BudgetVersionStatus,
  LineageRelationNature,
  ProcurementScopeKind,
} from "@bba/bdos-core/services/procurement-engineering";

// Sprint 21.3C — testes dos mapeadores banco <-> domínio, isolados de
// Supabase (nenhum I/O aqui; os testes de integração com banco real
// cobrem o adaptador que os usa).

const COMPANY_A = "11111111-1111-1111-1111-111111111111";
const CASE_ID = "22222222-2222-2222-2222-222222222222";
const LOT_ID = "33333333-3333-3333-3333-333333333333";
const VERSION_ID = "44444444-4444-4444-4444-444444444444";
const LINEAGE_ID = "55555555-5555-5555-5555-555555555555";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "valores diferentes"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function assertThrows(fn: () => void, expectedType: new (...args: never[]) => Error, message: string): void {
  try {
    fn();
  } catch (error) {
    if (error instanceof expectedType) {
      return;
    }
    throw new Error(`${message}: threw wrong error type (${(error as Error).constructor.name})`);
  }
  throw new Error(`${message}: expected a throw, but none occurred`);
}

runTest("mapProcurementCaseRow reconstrói o Processo, mapeando company_id -> organizationId", () => {
  const row: ProcurementCaseRow = {
    id: CASE_ID,
    company_id: COMPANY_A,
    title: "Barragem Lagoa do Arroz",
    external_reference: "pregao-90006-2025",
    metadata: { correlationId: "corr-1" },
  };

  const procurementCase = mapProcurementCaseRow(row);
  assertEqual(procurementCase.id, CASE_ID);
  assertEqual(procurementCase.organizationId, COMPANY_A);
  assertEqual(procurementCase.title, "Barragem Lagoa do Arroz");
  assertEqual(procurementCase.externalReference, "pregao-90006-2025");
  assertEqual(procurementCase.metadata.correlationId, "corr-1");
});

runTest("mapProcurementCaseRow rejeita título vazio com erro explícito de reconstrução", () => {
  const row: ProcurementCaseRow = { id: CASE_ID, company_id: COMPANY_A, title: "", external_reference: null, metadata: null };
  assertThrows(() => mapProcurementCaseRow(row), ProcurementEngineeringReconstructionError, "blank title must fail reconstruction");
});

runTest("mapProcurementLotRow reconstrói o Lote vinculado ao Processo correto", () => {
  const row: ProcurementLotRow = {
    id: LOT_ID,
    company_id: COMPANY_A,
    procurement_case_id: CASE_ID,
    title: "Lote único",
    external_reference: null,
    metadata: {},
  };

  const lot = mapProcurementLotRow(row);
  assertEqual(lot.id, LOT_ID);
  assertEqual(lot.procurementCaseId, CASE_ID);
  assertEqual(lot.organizationId, COMPANY_A);
});

runTest("procurementCaseCreateRpcParams extrai correlation_id/created_by/source_system da metadata do domínio", () => {
  const params = procurementCaseCreateRpcParams(COMPANY_A, {
    id: CASE_ID,
    organizationId: COMPANY_A,
    title: "Processo",
    externalReference: null,
    metadata: { correlationId: "corr-x", createdBy: "user-1", sourceSystem: "bdos-core" },
  });

  assertEqual(params.p_company_id, COMPANY_A);
  assertEqual(params.p_correlation_id, "corr-x");
  assertEqual(params.p_created_by, "user-1");
  assertEqual(params.p_source_system, "bdos-core");
});

function wholeCaseVersionRow(overrides: Partial<BudgetVersionRow> = {}): BudgetVersionRow {
  return {
    id: VERSION_ID,
    company_id: COMPANY_A,
    procurement_case_id: CASE_ID,
    scope_kind: "WholeCase",
    procurement_lot_id: null,
    origin_kind: "Native",
    origin_reference: null,
    status: "Draft",
    revision: 0,
    metadata: { budgetVersionId: VERSION_ID },
    ...overrides,
  };
}

runTest("mapBudgetVersionAggregate reconstrói uma Versão de Escopo do processo inteiro, sem Linhas nem Relação", () => {
  const persisted = mapBudgetVersionAggregate(wholeCaseVersionRow(), [], null);

  assertEqual(persisted.revision, 0);
  assertEqual(persisted.entity.status, BudgetVersionStatus.Draft);
  assertEqual(persisted.entity.scope.kind, ProcurementScopeKind.WholeCase);
  assertEqual(persisted.entity.origin.kind, BudgetVersionOriginKind.Native);
  assertEqual(persisted.entity.originLineage, null);
  assertEqual(persisted.entity.lines.length, 0);
});

runTest("mapBudgetVersionAggregate reconstrói Escopo de lote, origem documental, Linhas e Relação de Rastreabilidade", () => {
  const versionRow = wholeCaseVersionRow({
    scope_kind: "Lot",
    procurement_lot_id: LOT_ID,
    origin_kind: "DocumentaryOpaqueReference",
    origin_reference: "planilha-oficial.xlsx",
  });

  const groupLine: BudgetLineRow = {
    id: "line-group",
    budget_version_id: VERSION_ID,
    kind: "Group",
    description_status: "Confirmed",
    description_text: "1. Serviços Preliminares",
    external_code: "1",
    parent_line_id: null,
    position: 0,
    scope_kind: "Lot",
    scope_procurement_lot_id: LOT_ID,
    total_cents: null,
    metadata: {},
  };

  const itemLine: BudgetLineRow = {
    id: "line-item",
    budget_version_id: VERSION_ID,
    kind: "ServiceItem",
    description_status: "AbsentFromSource",
    description_text: null,
    external_code: null,
    parent_line_id: "line-group",
    position: 0,
    scope_kind: "Lot",
    scope_procurement_lot_id: LOT_ID,
    total_cents: "980908718", // bigint retornado como texto pelo cliente
    metadata: {},
  };

  const lineageRow: LineageRelationRow = {
    id: LINEAGE_ID,
    budget_version_id: VERSION_ID,
    nature: "Origin",
    origin_kind: "DocumentaryOpaqueReference",
    origin_reference: "planilha-oficial.xlsx",
  };

  const persisted = mapBudgetVersionAggregate(versionRow, [groupLine, itemLine], lineageRow);

  assertEqual(persisted.entity.scope.kind, ProcurementScopeKind.Lot);
  if (persisted.entity.scope.kind === ProcurementScopeKind.Lot) {
    assertEqual(persisted.entity.scope.procurementLotId, LOT_ID);
  }
  assertEqual(persisted.entity.origin.kind, BudgetVersionOriginKind.DocumentaryOpaqueReference);
  assertEqual(persisted.entity.lines.length, 2);

  const item = persisted.entity.lines.find((line) => line.id === "line-item");
  assertEqual(item?.kind, BudgetLineKind.ServiceItem);
  assertEqual(item?.totalCents, 980_908_718, "bigint-as-string must be parsed exactly, never through floating point");
  assertEqual(item?.description.status, "AbsentFromSource");
  assertEqual(item?.parentLineId, "line-group");

  assertEqual(persisted.entity.originLineage?.id, LINEAGE_ID);
  assertEqual(persisted.entity.originLineage?.destinationBudgetVersionId, VERSION_ID);
  assertEqual(
    persisted.entity.originLineage?.metadata,
    persisted.entity.metadata,
    "originLineage.metadata must equal the reconstructed version's own metadata (no dedicated column)",
  );
});

runTest("mapBudgetVersionAggregate rejeita scope_kind WholeCase com lote não nulo", () => {
  const row = wholeCaseVersionRow({ procurement_lot_id: LOT_ID });
  assertThrows(() => mapBudgetVersionAggregate(row, [], null), ProcurementEngineeringReconstructionError, "WholeCase with a lot id must fail");
});

runTest("mapBudgetVersionAggregate rejeita origin_kind Native com origin_reference preenchida", () => {
  const row = wholeCaseVersionRow({ origin_reference: "não deveria existir" });
  assertThrows(() => mapBudgetVersionAggregate(row, [], null), ProcurementEngineeringReconstructionError, "Native origin with a reference must fail");
});

runTest("mapBudgetVersionAggregate rejeita Item de Serviço sem total_cents", () => {
  const row = wholeCaseVersionRow();
  const badLine: BudgetLineRow = {
    id: "line-bad",
    budget_version_id: VERSION_ID,
    kind: "ServiceItem",
    description_status: "Confirmed",
    description_text: "Item sem total",
    external_code: null,
    parent_line_id: null,
    position: 0,
    scope_kind: "WholeCase",
    scope_procurement_lot_id: null,
    total_cents: null,
    metadata: {},
  };

  assertThrows(
    () => mapBudgetVersionAggregate(row, [badLine], null),
    ProcurementEngineeringReconstructionError,
    "ServiceItem with null total_cents must fail — mapper never produces a partial object",
  );
});

runTest("mapBudgetVersionAggregate rejeita descrição confirmada com texto vazio", () => {
  const row = wholeCaseVersionRow();
  const badLine: BudgetLineRow = {
    id: "line-bad-desc",
    budget_version_id: VERSION_ID,
    kind: "Group",
    description_status: "Confirmed",
    description_text: null,
    external_code: null,
    parent_line_id: null,
    position: 0,
    scope_kind: "WholeCase",
    scope_procurement_lot_id: null,
    total_cents: null,
    metadata: {},
  };

  assertThrows(() => mapBudgetVersionAggregate(row, [badLine], null), ProcurementEngineeringReconstructionError, "Confirmed with null text must fail");
});

runTest("budgetVersionDraftRpcParams monta os parâmetros de create_budget_version_draft, incluindo a Relação inicial", () => {
  const params = budgetVersionDraftRpcParams(COMPANY_A, {
    id: VERSION_ID,
    organizationId: COMPANY_A,
    procurementCaseId: CASE_ID,
    scope: { kind: ProcurementScopeKind.Lot, procurementCaseId: CASE_ID, procurementLotId: LOT_ID },
    origin: { kind: BudgetVersionOriginKind.DocumentaryOpaqueReference, reference: "planilha.xlsx" },
    status: BudgetVersionStatus.Draft,
    originLineage: {
      id: LINEAGE_ID,
      organizationId: COMPANY_A,
      nature: LineageRelationNature.Origin,
      origin: { kind: BudgetVersionOriginKind.DocumentaryOpaqueReference, reference: "planilha.xlsx" },
      destinationBudgetVersionId: VERSION_ID,
      metadata: {},
    },
    lines: [],
    metadata: { correlationId: "corr-1" },
  });

  assertEqual(params.p_company_id, COMPANY_A);
  assertEqual(params.p_scope_kind, "Lot");
  assertEqual(params.p_procurement_lot_id, LOT_ID);
  assertEqual(params.p_origin_reference, "planilha.xlsx");
  assertEqual(params.p_lineage_id, LINEAGE_ID);
  assertEqual(params.p_correlation_id, "corr-1");
});

runTest("budgetVersionSnapshotRpcParams serializa Linhas com totalCents preservado exatamente", () => {
  const params = budgetVersionSnapshotRpcParams(
    COMPANY_A,
    {
      id: VERSION_ID,
      organizationId: COMPANY_A,
      procurementCaseId: CASE_ID,
      scope: { kind: ProcurementScopeKind.WholeCase, procurementCaseId: CASE_ID },
      origin: { kind: BudgetVersionOriginKind.Native },
      status: BudgetVersionStatus.Consolidated,
      originLineage: null,
      lines: [
        {
          id: "line-1",
          budgetVersionId: VERSION_ID,
          kind: BudgetLineKind.ServiceItem,
          description: { status: "Confirmed", text: "Item" },
          externalCode: "COT-015",
          parentLineId: null,
          position: 0,
          scope: { kind: ProcurementScopeKind.WholeCase, procurementCaseId: CASE_ID },
          totalCents: 980_908_718,
          metadata: {},
        },
      ],
      metadata: {},
    },
    3,
  );

  assertEqual(params.p_expected_revision, 3);
  assertEqual(params.p_status, "Consolidated");
  const lines = params.p_lines as ReadonlyArray<Record<string, unknown>>;
  assertEqual(lines.length, 1);
  assertEqual(lines[0].totalCents, 980_908_718);
  assertEqual(lines[0].externalCode, "COT-015");
  assertEqual(lines[0].descriptionText, "Item");
});

runTest("procurementLotRegisterRpcParams monta os parâmetros de register_procurement_lot", () => {
  const params = procurementLotRegisterRpcParams(COMPANY_A, {
    id: LOT_ID,
    procurementCaseId: CASE_ID,
    organizationId: COMPANY_A,
    title: "Lote único",
    externalReference: null,
    metadata: { correlationId: "corr-lot" },
  });

  assertEqual(params.p_company_id, COMPANY_A);
  assertEqual(params.p_id, LOT_ID);
  assertEqual(params.p_procurement_case_id, CASE_ID);
  assertEqual(params.p_correlation_id, "corr-lot");
});

function wholeCaseLine(id: string, parentLineId: string | null, kind = BudgetLineKind.Group): {
  id: string;
  budgetVersionId: string;
  kind: typeof kind;
  description: { status: "Confirmed"; text: string };
  externalCode: null;
  parentLineId: string | null;
  position: number;
  scope: { kind: ProcurementScopeKind.WholeCase; procurementCaseId: string };
  totalCents: null;
  metadata: Record<string, never>;
} {
  return {
    id,
    budgetVersionId: VERSION_ID,
    kind,
    description: { status: "Confirmed", text: id },
    externalCode: null,
    parentLineId,
    position: 0,
    scope: { kind: ProcurementScopeKind.WholeCase, procurementCaseId: CASE_ID },
    totalCents: null,
    metadata: {},
  };
}

runTest("budgetVersionSnapshotRpcParams ordena as Linhas topologicamente — pai sempre antes do filho, mesmo com a entrada fora de ordem", () => {
  // Entrada deliberadamente fora de ordem: o neto vem primeiro, o avô por último —
  // exatamente o cenário que o gatilho de integridade de parent_line_id rejeitaria
  // se a ordem de inserção não fosse corrigida aqui.
  const grandchild = wholeCaseLine("line-grandchild", "line-child", BudgetLineKind.ServiceItem);
  const child = wholeCaseLine("line-child", "line-parent", BudgetLineKind.Subgroup);
  const parent = wholeCaseLine("line-parent", null, BudgetLineKind.Group);

  const params = budgetVersionSnapshotRpcParams(
    COMPANY_A,
    {
      id: VERSION_ID,
      organizationId: COMPANY_A,
      procurementCaseId: CASE_ID,
      scope: { kind: ProcurementScopeKind.WholeCase, procurementCaseId: CASE_ID },
      origin: { kind: BudgetVersionOriginKind.Native },
      status: BudgetVersionStatus.Draft,
      originLineage: null,
      lines: [grandchild, child, parent],
      metadata: {},
    },
    0,
  );

  const lines = params.p_lines as ReadonlyArray<{ id: string }>;
  assertEqual(lines.length, 3);
  const indexOf = (id: string) => lines.findIndex((line) => line.id === id);
  assertTrue(indexOf("line-parent") < indexOf("line-child"), "parent must be serialized before its child");
  assertTrue(indexOf("line-child") < indexOf("line-grandchild"), "child must be serialized before its own child");
});

runTest("budgetVersionSnapshotRpcParams rejeita explicitamente um ciclo entre Linhas", () => {
  const lineA = wholeCaseLine("line-a", "line-b");
  const lineB = wholeCaseLine("line-b", "line-a");

  assertThrows(
    () =>
      budgetVersionSnapshotRpcParams(
        COMPANY_A,
        {
          id: VERSION_ID,
          organizationId: COMPANY_A,
          procurementCaseId: CASE_ID,
          scope: { kind: ProcurementScopeKind.WholeCase, procurementCaseId: CASE_ID },
          origin: { kind: BudgetVersionOriginKind.Native },
          status: BudgetVersionStatus.Draft,
          originLineage: null,
          lines: [lineA, lineB],
          metadata: {},
        },
        0,
      ),
    Error,
    "a cycle between two lines must be rejected explicitly, never silently serialized",
  );
});
