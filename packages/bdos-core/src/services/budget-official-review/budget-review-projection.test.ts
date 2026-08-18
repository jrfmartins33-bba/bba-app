import { BudgetLineKind, BudgetVersionOriginKind, createBudgetVersion, type BudgetVersion } from "../../domain/budget-version";
import {
  BudgetReviewRowState,
  BudgetReviewSessionStatus,
  EMPTY_BUDGET_REVIEW_ROW_FIELDS,
  type BudgetReviewSession,
} from "../../domain/budget-official-review";
import {
  ProcurementScopeKind,
  createProcurementCase,
  createProcurementLot,
  type ProcurementCase,
  type ProcurementLot,
} from "../../domain/procurement-case";
import { projectBudgetReviewSessionToBudgetVersion } from "./budget-review-projection";

const organizationId = "organization-projection-test";
const procurementCase = requireCase(createProcurementCase({ id: "case-projection", organizationId, title: "Caso de teste" }));
const lot = requireLot(createProcurementLot({ id: "lot-01", procurementCase, title: "Lote 01" }));
const otherLot = requireLot(createProcurementLot({ id: "lot-02", procurementCase, title: "Lote 02" }));

const wholeCaseVersion = requireVersion(
  createBudgetVersion({
    id: "budget-whole-case",
    procurementCase,
    scope: { kind: ProcurementScopeKind.WholeCase, procurementCaseId: procurementCase.id },
    origin: { kind: BudgetVersionOriginKind.Native },
  }),
);
const lotVersion = requireVersion(
  createBudgetVersion({
    id: "budget-lot-01",
    procurementCase,
    procurementLot: lot,
    scope: { kind: ProcurementScopeKind.Lot, procurementCaseId: procurementCase.id, procurementLotId: lot.id },
    origin: { kind: BudgetVersionOriginKind.Native },
  }),
);

const wholeCaseResult = projectBudgetReviewSessionToBudgetVersion(sessionFor(wholeCaseVersion), wholeCaseVersion);
assert(wholeCaseResult.success, "WholeCase must project without ProcurementLot");
assertEqual(wholeCaseResult.budgetVersion.lines.length, 1, "WholeCase must project its confirmed row");

const lotResult = projectBudgetReviewSessionToBudgetVersion(sessionFor(lotVersion, lot.id), lotVersion, lot);
assert(lotResult.success, "Lot scope must project with the real matching ProcurementLot");
assertEqual(lotResult.budgetVersion.lines[0]?.scope.kind, ProcurementScopeKind.Lot, "projected line must preserve Lot scope");

const missingLotResult = projectBudgetReviewSessionToBudgetVersion(sessionFor(lotVersion, lot.id), lotVersion);
assert(!missingLotResult.success, "Lot scope without ProcurementLot must remain invalid");
assertEqual(missingLotResult.errors[0]?.code, "missing_procurement_lot", "missing proof must preserve the domain invariant");

const wrongLotResult = projectBudgetReviewSessionToBudgetVersion(sessionFor(lotVersion, lot.id), lotVersion, otherLot);
assert(!wrongLotResult.success, "Lot scope with a different ProcurementLot must remain invalid");
assertEqual(wrongLotResult.errors[0]?.code, "scope_lot_mismatch", "wrong proof must preserve scope identity validation");

function sessionFor(budgetVersion: BudgetVersion, procurementLotId: string | null = null): BudgetReviewSession {
  const fields = { ...EMPTY_BUDGET_REVIEW_ROW_FIELDS, description: "Grupo confirmado" };
  return {
    id: `session-${budgetVersion.id}`,
    organizationId,
    procurementCaseId: procurementCase.id,
    procurementLotId,
    budgetVersionId: budgetVersion.id,
    documentVersionId: "document-version-projection",
    sourceSha256: "a".repeat(64),
    acquisitionMechanism: "test",
    acquisitionMechanismVersion: null,
    status: BudgetReviewSessionStatus.InProgress,
    rows: [
      {
        id: `group-${budgetVersion.id}`,
        sessionId: `session-${budgetVersion.id}`,
        kind: BudgetLineKind.Group,
        lotReference: "Lote documental",
        parentRowId: null,
        position: 0,
        state: BudgetReviewRowState.Confirmed,
        extracted: fields,
        revised: fields,
        page: 1,
        evidenceText: "Grupo confirmado",
        justification: null,
        insertedManually: false,
        reconciliationDecision: null,
        createdBy: "reviewer",
        createdAt: "2026-08-18T00:00:00.000Z",
        metadata: {},
      },
    ],
    createdBy: "reviewer",
    createdAt: "2026-08-18T00:00:00.000Z",
    metadata: {},
  };
}

function requireCase(result: ReturnType<typeof createProcurementCase>): ProcurementCase {
  if (!result.success) throw new Error(`expected case creation success: ${JSON.stringify(result.errors)}`);
  return result.procurementCase;
}

function requireLot(result: ReturnType<typeof createProcurementLot>): ProcurementLot {
  if (!result.success) throw new Error(`expected lot creation success: ${JSON.stringify(result.errors)}`);
  return result.procurementLot;
}

function requireVersion(result: ReturnType<typeof createBudgetVersion>): BudgetVersion {
  if (!result.success) throw new Error(`expected version creation success: ${JSON.stringify(result.errors)}`);
  return result.budgetVersion;
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
  console.log(`ok - ${message}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  console.log(`ok - ${message}`);
}
