import {
  ProcurementScopeKind,
  createLotScope,
  createProcurementCase,
  createProcurementLot,
  createWholeCaseScope,
  isWellFormedProcurementScope,
  type ProcurementCase,
  type ProcurementLot,
  type ProcurementScope,
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

runTest("rejeita identificador vazio de Processo", () => {
  const result = createProcurementCase(caseInputFixture({ id: "" }));
  assertCaseFailure(result, "expected missing id failure");
  assertEqual(result.errors[0]?.code, "missing_id", "error code mismatch");
});

runTest("rejeita identificador vazio de Lote", () => {
  const created = createProcurementCase(caseInputFixture());
  assertCaseSuccess(created, "expected case creation success");
  const result = createProcurementLot(lotInputFixture(created.procurementCase, { id: "" }));
  assertLotFailure(result, "expected missing id failure");
  assertEqual(result.errors[0]?.code, "missing_id", "error code mismatch");
});

runTest("correlationId, createdBy e sourceSystem podem ser omitidos — não são contrato obrigatório", () => {
  const result = createProcurementCase({
    id: "case-without-provenance-fields",
    organizationId,
    title: "Processo sem campos de proveniência técnica",
  });
  assertCaseSuccess(result, "expected case creation success without correlationId/createdBy/sourceSystem");

  const lot = createProcurementLot({
    id: "lot-without-provenance-fields",
    procurementCase: result.procurementCase,
    title: "Lote sem campos de proveniência técnica",
  });
  assertLotSuccess(lot, "expected lot creation success without correlationId/createdBy/sourceSystem");
});

runTest("isWellFormedProcurementScope aceita as duas formas aprovadas e rejeita Escopo estrutural arbitrário", () => {
  const wholeCase: ProcurementScope = { kind: ProcurementScopeKind.WholeCase, procurementCaseId: "case-x" };
  const lot: ProcurementScope = { kind: ProcurementScopeKind.Lot, procurementCaseId: "case-x", procurementLotId: "lot-x" };
  assertEqual(isWellFormedProcurementScope(wholeCase), true, "well-formed WholeCase scope must be accepted");
  assertEqual(isWellFormedProcurementScope(lot), true, "well-formed Lot scope must be accepted");

  const extraField = { kind: ProcurementScopeKind.WholeCase, procurementCaseId: "case-x", procurementLotId: "lot-x" } as unknown as ProcurementScope;
  assertEqual(isWellFormedProcurementScope(extraField), false, "a WholeCase scope with an extra procurementLotId field must be rejected");

  const missingField = { kind: ProcurementScopeKind.Lot, procurementCaseId: "case-x" } as unknown as ProcurementScope;
  assertEqual(isWellFormedProcurementScope(missingField), false, "a Lot scope missing procurementLotId must be rejected");

  const unknownKind = { kind: "SomeArbitraryKind", procurementCaseId: "case-x" } as unknown as ProcurementScope;
  assertEqual(isWellFormedProcurementScope(unknownKind), false, "a scope with an arbitrary, unapproved kind must be rejected");
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
