import {
  ProcurementScopeKind,
  createLotScope,
  createProcurementCase,
  createProcurementLot,
  createWholeCaseScope,
  type ProcurementCase,
  type ProcurementLot,
} from "./index";

const organizationId = "organization-alpha-engenharia";
const correlationId = "procurement-case-correlation-001";
const createdBy = "engenharia-de-custos";
const sourceSystem = "bdos-core";

runTest("cria Processo de Licitação e Contratação sem lote", () => {
  const result = createProcurementCase(caseInputFixture());

  assertCaseSuccess(result, "expected case creation success");
  assertEqual(result.procurementCase.id, "case-lagoa-do-arroz", "case id mismatch");
  assertEqual(result.procurementCase.organizationId, organizationId, "organization id mismatch");
  assertEqual(result.procurementCase.externalReference, "pregao-eletronico-90006-2025", "external reference mismatch");
});

runTest("Processo pode existir sem lote — Escopo do processo inteiro não exige lote", () => {
  const created = createProcurementCase(caseInputFixture());
  assertCaseSuccess(created, "expected case creation success");

  const scope = createWholeCaseScope({ procurementCase: created.procurementCase });
  assertScopeSuccess(scope, "expected whole-case scope success");
  assertEqual(scope.scope.kind, ProcurementScopeKind.WholeCase, "scope kind mismatch");
});

runTest("rejeita organização usuária ausente", () => {
  const result = createProcurementCase(caseInputFixture({ organizationId: "" }));
  assertCaseFailure(result, "expected missing organization failure");
  assertEqual(result.errors[0]?.code, "missing_organization_id", "error code mismatch");
});

runTest("rejeita título ausente", () => {
  const result = createProcurementCase(caseInputFixture({ title: "" }));
  assertCaseFailure(result, "expected missing title failure");
  assertEqual(result.errors[0]?.code, "missing_title", "error code mismatch");
});

runTest("código externo nunca é identidade — dois Processos podem compartilhar o mesmo número externo sem serem o mesmo processo", () => {
  const first = createProcurementCase(caseInputFixture({ id: "case-001", externalReference: "pregao-90006-2025" }));
  const second = createProcurementCase(
    caseInputFixture({ id: "case-002", externalReference: "pregao-90006-2025" }),
  );

  assertCaseSuccess(first, "expected first case success");
  assertCaseSuccess(second, "expected second case success");
  assertEqual(first.procurementCase.id === second.procurementCase.id, false, "two distinct cases must never share identity");
  assertEqual(
    first.procurementCase.externalReference,
    second.procurementCase.externalReference,
    "external references were expected to be equal by construction of this test",
  );
});

runTest("cria Lote da Licitação vinculado ao Processo correto", () => {
  const created = createProcurementCase(caseInputFixture());
  assertCaseSuccess(created, "expected case creation success");

  const lot = createProcurementLot(lotInputFixture(created.procurementCase));
  assertLotSuccess(lot, "expected lot creation success");
  assertEqual(lot.procurementLot.procurementCaseId, created.procurementCase.id, "lot must reference its case");
  assertEqual(lot.procurementLot.organizationId, organizationId, "lot must inherit the case's organização usuária");
});

runTest("Lote nunca é criado automaticamente pelo Processo", () => {
  const created = createProcurementCase(caseInputFixture());
  assertCaseSuccess(created, "expected case creation success");
  assertEqual(Object.prototype.hasOwnProperty.call(created.procurementCase, "lots"), false, "case must not embed a lots collection");
});

runTest("rejeita Lote sem Processo", () => {
  const result = createProcurementLot({
    ...lotInputFixture(caseFixture()),
    // @ts-expect-error — exercising the missing-case branch deliberately
    procurementCase: undefined,
  });
  assertLotFailure(result, "expected missing case failure");
  assertEqual(result.errors[0]?.code, "missing_procurement_case", "error code mismatch");
});

runTest("Escopo de lote referencia lote existente do mesmo Processo", () => {
  const created = createProcurementCase(caseInputFixture());
  assertCaseSuccess(created, "expected case creation success");
  const lot = createProcurementLot(lotInputFixture(created.procurementCase));
  assertLotSuccess(lot, "expected lot creation success");

  const scope = createLotScope({ procurementCase: created.procurementCase, procurementLot: lot.procurementLot });
  assertScopeSuccess(scope, "expected lot scope success");
  assertEqual(scope.scope.kind, ProcurementScopeKind.Lot, "scope kind mismatch");
});

runTest("rejeita Escopo com lote de outro Processo", () => {
  const caseA = createProcurementCase(caseInputFixture({ id: "case-a" }));
  const caseB = createProcurementCase(caseInputFixture({ id: "case-b" }));
  assertCaseSuccess(caseA, "expected case A success");
  assertCaseSuccess(caseB, "expected case B success");

  const lotOfB = createProcurementLot(lotInputFixture(caseB.procurementCase));
  assertLotSuccess(lotOfB, "expected lot creation success");

  const scope = createLotScope({ procurementCase: caseA.procurementCase, procurementLot: lotOfB.procurementLot });
  assertScopeFailure(scope, "expected lot-from-another-case failure");
  assertEqual(scope.errors[0]?.code, "invalid_scope_lot", "error code mismatch");
});

runTest("rejeita Escopo com lote de outra organização usuária", () => {
  const created = createProcurementCase(caseInputFixture());
  assertCaseSuccess(created, "expected case creation success");
  const lot = createProcurementLot(lotInputFixture(created.procurementCase));
  assertLotSuccess(lot, "expected lot creation success");

  const foreignLot: ProcurementLot = { ...lot.procurementLot, organizationId: "organization-other" };
  const scope = createLotScope({ procurementCase: created.procurementCase, procurementLot: foreignLot });
  assertScopeFailure(scope, "expected cross-organization failure");
  assertEqual(scope.errors[0]?.code, "organization_mismatch", "error code mismatch");
});

function caseFixture(): ProcurementCase {
  const result = createProcurementCase(caseInputFixture());
  if (!result.success) {
    throw new Error("caseFixture: unexpected failure building fixture");
  }
  return result.procurementCase;
}

function caseInputFixture(overrides: Partial<Parameters<typeof createProcurementCase>[0]> = {}) {
  return {
    id: "case-lagoa-do-arroz",
    organizationId,
    title: "Barragem Lagoa do Arroz — Pregão Eletrônico 90006/2025",
    externalReference: "pregao-eletronico-90006-2025",
    correlationId,
    createdBy,
    sourceSystem,
    ...overrides,
  };
}

function lotInputFixture(procurementCase: ProcurementCase, overrides: Record<string, unknown> = {}) {
  return {
    id: "lot-001",
    procurementCase,
    title: "Lote único",
    correlationId,
    createdBy,
    sourceSystem,
    ...overrides,
  };
}

function assertCaseSuccess(
  result: ReturnType<typeof createProcurementCase>,
  message: string,
): asserts result is Extract<ReturnType<typeof createProcurementCase>, { success: true }> {
  if (!result.success) {
    throw new Error(`${message}: ${JSON.stringify(result.errors)}`);
  }
}

function assertCaseFailure(
  result: ReturnType<typeof createProcurementCase>,
  message: string,
): asserts result is Extract<ReturnType<typeof createProcurementCase>, { success: false }> {
  if (result.success) {
    throw new Error(message);
  }
}

function assertLotSuccess(
  result: ReturnType<typeof createProcurementLot>,
  message: string,
): asserts result is Extract<ReturnType<typeof createProcurementLot>, { success: true }> {
  if (!result.success) {
    throw new Error(`${message}: ${JSON.stringify(result.errors)}`);
  }
}

function assertLotFailure(
  result: ReturnType<typeof createProcurementLot>,
  message: string,
): asserts result is Extract<ReturnType<typeof createProcurementLot>, { success: false }> {
  if (result.success) {
    throw new Error(message);
  }
}

function assertScopeSuccess(
  result: ReturnType<typeof createWholeCaseScope>,
  message: string,
): asserts result is Extract<ReturnType<typeof createWholeCaseScope>, { success: true }> {
  if (!result.success) {
    throw new Error(`${message}: ${JSON.stringify(result.errors)}`);
  }
}

function assertScopeFailure(
  result: ReturnType<typeof createLotScope>,
  message: string,
): asserts result is Extract<ReturnType<typeof createLotScope>, { success: false }> {
  if (result.success) {
    throw new Error(message);
  }
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
