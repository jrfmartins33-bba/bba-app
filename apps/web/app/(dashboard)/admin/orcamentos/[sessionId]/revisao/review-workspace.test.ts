import { formatBudgetMoneyPtBr, formatBudgetNumberPtBr, formatBudgetPercentPtBr } from "../../../../../../lib/bdos/format-budget-number";
import { toHumanReviewActionError } from "../../../../../../lib/bdos/to-human-review-error";
import { bulkConfirmBudgetReviewRowsService, bulkAcceptBudgetReviewRowDivergencesService } from "../../../../../../../../packages/bdos-core/src/services/budget-official-review/index";
import type { BudgetReviewRepository } from "../../../../../../../../packages/bdos-core/src/services/budget-official-review/index";

import { BudgetReviewSessionStatus } from "../../../../../../../../packages/bdos-core/src/domain/budget-official-review/index";
import type { BudgetReviewSession } from "../../../../../../../../packages/bdos-core/src/domain/budget-official-review/index";

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`[FAIL] ${message} — Expected: ${String(expected)}, Got: ${String(actual)}`);
  }
}

function assertTrue(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[FAIL] ${message}`);
  }
}

function runTest(name: string, fn: () => void | Promise<void>) {
  try {
    const res = fn();
    if (res && typeof res.then === "function") {
      res.then(() => console.log(`  ✓ ${name}`)).catch((err) => {
        console.error(`  ✗ ${name}`);
        console.error(err);
        process.exitCode = 1;
      });
    } else {
      console.log(`  ✓ ${name}`);
    }
  } catch (error) {
    console.error(`  ✗ ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

async function main() {
  console.log("Running Official Budget Review Workspace & Domain Tests\n");

  // 1. Brazilian Number Formatters
  console.log("1. Brazilian Number Formatters (pt-BR)\n");

  runTest("1.1 formatBudgetMoneyPtBr", () => {
    assertEqual(formatBudgetMoneyPtBr("361.52"), "361,52", "361.52 -> 361,52");
    assertEqual(formatBudgetMoneyPtBr("4489.30"), "4.489,30", "4489.30 -> 4.489,30");
    assertEqual(formatBudgetMoneyPtBr("316292.87"), "316.292,87", "316292.87 -> 316.292,87");
    assertEqual(formatBudgetMoneyPtBr("0.90"), "0,90", "0.90 -> 0,90");
    assertEqual(formatBudgetMoneyPtBr(null), "—", "null -> —");
  });

  runTest("1.2 formatBudgetNumberPtBr (quantidades)", () => {
    assertEqual(formatBudgetNumberPtBr("46656.22"), "46.656,22", "46656.22 -> 46.656,22");
    assertEqual(formatBudgetNumberPtBr("7157.99"), "7.157,99", "7157.99 -> 7.157,99");
    assertEqual(formatBudgetNumberPtBr("14"), "14", "14 -> 14");
    assertEqual(formatBudgetNumberPtBr(null), "—", "null -> —");
  });

  runTest("1.3 formatBudgetPercentPtBr (BDI)", () => {
    assertEqual(formatBudgetPercentPtBr("24.18"), "24,18%", "24.18 -> 24,18%");
    assertEqual(formatBudgetPercentPtBr("24.18%"), "24,18%", "24.18% -> 24,18%");
    assertEqual(formatBudgetPercentPtBr(null), "—", "null -> —");
  });

  // 2. Human-First Review Error Translation
  console.log("\n2. Human-First Error Translation\n");

  runTest("2.1 Tradução de erros técnicos para mensagens humanas", () => {
    assertEqual(
      toHumanReviewActionError({ error: "domain_error" }, "Fallback"),
      "Não foi possível concluir a ação devido a uma pendência de validação dos dados.",
      "domain_error é traduzido com contexto legível",
    );
    assertEqual(
      toHumanReviewActionError({ error: "row_not_pending" }, "Fallback"),
      "Um ou mais itens selecionados já foram revisados.",
      "row_not_pending traduzido",
    );
    assertTrue(
      !toHumanReviewActionError({ error: "domain_error" }, "Fallback").includes("domain_error"),
      "Nenhum código técnico interno é exposto",
    );
  });

  // 3. Performance Test — Single Batch Persistence Invocation
  console.log("\n3. Batch Persistence Performance Guard\n");

  await runTest("3.1 bulkConfirmBudgetReviewRowsService chama bulkMutateRows UMA única vez para N linhas", async () => {
    let bulkMutateCallCount = 0;
    let mutateSingleCallCount = 0;

    const session = {
      id: "sess-batch-test",
      organizationId: "comp-123",
      companyId: "comp-123",
      procurementCaseId: "case-123",
      procurementLotId: "lot-123",
      budgetVersionId: "bv-123",
      documentVersionId: "dv-123",
      sha256: "sha-123",
      sourceSha256: "sha-123",
      acquisitionMechanism: "xlsx_structured_import",
      acquisitionMechanismVersion: "1.0",
      createdBy: "admin-test",
      createdAt: "2026-08-10T00:00:00Z",
      updatedAt: "2026-08-10T00:00:00Z",
      status: BudgetReviewSessionStatus.InProgress,
      metadata: { reviewSessionId: "sess-batch-test" },
      rows: Array.from({ length: 50 }, (_, i) => ({
        id: `row-${i + 1}`,
        kind: "ServiceItem" as const,
        lotReference: "Lote 01",
        parentRowId: null,
        position: i,
        state: "Pendente" as const,
        extracted: { itemCode: `${i}`, description: `Item ${i}`, sourceCode: null, sourceFonte: null, sourceTipo: null, unit: "UN", quantityText: "10.00", unitCostWithoutBdiText: "100.00", bdiPercentText: "0.00%", unitPriceWithBdiText: "100.00", totalPriceText: "1000.00", colFgvDnit: null, documentalGroupTotalText: null },
        revised: { itemCode: `${i}`, description: `Item ${i}`, sourceCode: null, sourceFonte: null, sourceTipo: null, unit: "UN", quantityText: "10.00", unitCostWithoutBdiText: "100.00", bdiPercentText: "0.00%", unitPriceWithBdiText: "100.00", totalPriceText: "1000.00", colFgvDnit: null, documentalGroupTotalText: null },
        page: 1,
        evidenceText: null,
        justification: null,
        insertedManually: false,
        reconciliationDecision: null,
      })),
    };

    const mockRepo: BudgetReviewRepository = {
      async findOrganizationIdForSession() { return "comp-123"; },
      async loadSession() { return session as unknown as BudgetReviewSession; },
      async findSessionByAcquisition() { return null; },
      async createSession() { return { outcome: "created", sessionId: "sess-batch-test" }; },
      async mutateRow() { mutateSingleCallCount++; },
      async consolidateSession() { return { success: true }; },
      async importRows() { return 50; },
      async recordReconciliationDecision() {},
      async bulkMutateRows(_org, _actor, _sess, mutations) {
        bulkMutateCallCount++;
        return mutations.length;
      },
    };

    const res = await bulkConfirmBudgetReviewRowsService(
      { organizationId: "comp-123", actor: "admin-test" },
      { sessionId: "sess-batch-test", rowIds: Array.from({ length: 50 }, (_, i) => `row-${i + 1}`) },
      mockRepo,
    );

    assertTrue(res.outcome === "success", "bulk confirm must succeed");
    assertEqual(bulkMutateCallCount, 1, "bulkMutateRows must be called EXACTLY once for 50 rows");
    assertEqual(mutateSingleCallCount, 0, "single mutateRow must NOT be called in batch mode");
  });

  console.log("\n✓ All Official Budget Review Workspace tests passed!\n");
}

void main();
