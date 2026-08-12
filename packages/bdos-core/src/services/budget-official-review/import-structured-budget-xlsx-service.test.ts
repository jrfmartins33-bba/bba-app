import { buildXlsxFixture } from "../../domain/schedule-management/adapters/excel-import/xlsx-test-fixtures";
import type {
  BudgetReviewRepository,
  CreateSessionResult,
} from "./budget-review.repository";
import type {
  BudgetVersionRepository,
  SaveBudgetVersionResult,
} from "../procurement-engineering/budget-version.repository";
import type { DocumentRepository } from "../document-processing/document.repository";
import type { DocumentVersionRepository } from "../document-processing/document-version.repository";
import type { ProcurementCaseRepository } from "../procurement-engineering/procurement-case.repository";
import type {
  BudgetReviewRow,
  BudgetReviewSession,
} from "../../domain/budget-official-review";
import type { BudgetVersion } from "../../domain/budget-version";
import type { DocumentArtifact, DocumentVersion } from "../../domain/document-processing";
import type { ProcurementCase, ProcurementLot } from "../../domain/procurement-case";
import type { ApplicationContext } from "./application-context";
import { importStructuredBudgetXlsxService } from "./import-structured-budget-xlsx-service";

// ---------------------------------------------------------------------------
// Test Runner & Assertion Helpers
// ---------------------------------------------------------------------------

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`[FAIL] ${message} — Expected: ${String(expected)}, Got: ${String(actual)}`);
  }
}

function assertTrue(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[FAIL] ${message}`);
  }
}

function runTest(name: string, fn: () => void | Promise<void>): void {
  try {
    const res = fn();
    if (res instanceof Promise) {
      res
        .then(() => console.log(`  ✓ ${name}`))
        .catch((err) => {
          console.error(`  ✗ ${name}`);
          console.error(err);
          process.exitCode = 1;
        });
    } else {
      console.log(`  ✓ ${name}`);
    }
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// Fake Repositories for Application Service Testing
// ---------------------------------------------------------------------------

function createFakeContext(overrides: Partial<ApplicationContext> = {}): ApplicationContext {
  return {
    organizationId: overrides.organizationId ?? "org-test-alagoas",
    actor: overrides.actor ?? "actor-admin-test",
  };
}

function createFakeProcurementCaseRepository(
  cases: ProcurementCase[] = [],
  lots: ProcurementLot[] = [],
): ProcurementCaseRepository {
  return {
    async createProcurementCase(_orgId, _actor, pc) {
      cases.push(pc);
      return pc;
    },
    async findProcurementCaseById(orgId, id) {
      return cases.find((c) => c.organizationId === orgId && c.id === id) ?? null;
    },
    async createProcurementLot(_orgId, _actor, lot) {
      lots.push(lot);
      return lot;
    },
    async findProcurementLotById(orgId, caseId, id) {
      return (
        lots.find(
          (l) => l.organizationId === orgId && l.procurementCaseId === caseId && l.id === id,
        ) ?? null
      );
    },
  };
}

function createFakeDocumentRepository(): DocumentRepository {
  const documents = new Map<string, DocumentArtifact>();
  return {
    async createDocument(orgId, _actor, document) {
      const key = `${orgId}:${document.id}`;
      documents.set(key, document);
      return document;
    },
    async findDocumentById(orgId, id) {
      return documents.get(`${orgId}:${id}`) ?? null;
    },
  };
}

function createFakeDocumentVersionRepository(): DocumentVersionRepository {
  const versions = new Map<string, DocumentVersion>();
  return {
    async createOrReuseDocumentVersion(orgId, _actor, documentVersion) {
      const key = `${orgId}:${documentVersion.documentId}:${documentVersion.sha256}`;
      const existing = versions.get(key);
      if (existing) {
        return { outcome: "reused", documentVersion: existing };
      }
      versions.set(key, documentVersion);
      return { outcome: "created", documentVersion };
    },
    async findDocumentVersionById(orgId, id) {
      for (const version of versions.values()) {
        if (version.documentId && version.id === id) return version;
      }
      return null;
    },
    async findDocumentVersionByDocumentAndSha256(orgId, documentId, sha256) {
      return versions.get(`${orgId}:${documentId}:${sha256}`) ?? null;
    },
    async listDocumentVersionsByDocument() {
      return [];
    },
  };
}

function createFakeBudgetVersionRepository(): BudgetVersionRepository {
  const versions = new Map<string, BudgetVersion>();
  return {
    async createDraftBudgetVersion(orgId, _actor, budgetVersion) {
      const key = `${orgId}:${budgetVersion.id}`;
      versions.set(key, budgetVersion);
      return { entity: budgetVersion, revision: 1 };
    },
    async loadBudgetVersion(orgId, id) {
      const found = versions.get(`${orgId}:${id}`);
      return found ? { entity: found, revision: 1 } : null;
    },
    async saveBudgetVersion(_orgId, _actor, budgetVersion, expectedRevision): Promise<SaveBudgetVersionResult> {
      return { outcome: "saved", revision: (expectedRevision ?? 1) + 1 };
    },
  };
}

function createFakeBudgetReviewRepository(): BudgetReviewRepository {
  const sessions = new Map<string, BudgetReviewSession>();
  return {
    async findOrganizationIdForSession(sessionId) {
      for (const session of sessions.values()) {
        if (session.id === sessionId) return session.organizationId;
      }
      return null;
    },
    async loadSession(_orgId, sessionId) {
      return sessions.get(sessionId) ?? null;
    },
    async findSessionByAcquisition(orgId, caseId, sourceSha256, acquisitionMechanism) {
      for (const session of sessions.values()) {
        if (
          session.organizationId === orgId &&
          session.procurementCaseId === caseId &&
          session.sourceSha256 === sourceSha256 &&
          session.acquisitionMechanism === acquisitionMechanism
        ) {
          return session;
        }
      }
      return null;
    },
    async createSession(orgId, _actor, session): Promise<CreateSessionResult> {
      const key = `${orgId}:${session.procurementCaseId}:${session.sourceSha256}:${session.acquisitionMechanism}`;
      for (const existing of sessions.values()) {
        if (
          existing.organizationId === orgId &&
          existing.procurementCaseId === session.procurementCaseId &&
          existing.sourceSha256 === session.sourceSha256 &&
          existing.acquisitionMechanism === session.acquisitionMechanism
        ) {
          return { outcome: "reused", sessionId: existing.id };
        }
      }
      sessions.set(session.id, session);
      return { outcome: "created", sessionId: session.id };
    },
    async mutateRow() {},
    async consolidateSession() {
      return { success: true };
    },
    async importRows(_orgId, _actor, sessionId, rows): Promise<number> {
      const session = sessions.get(sessionId);
      if (!session) return 0;
      const updatedRows = [...session.rows, ...rows];
      const updatedSession: BudgetReviewSession = {
        ...session,
        rows: updatedRows,
      };
      sessions.set(sessionId, updatedSession);
      return rows.length;
    },
    async recordReconciliationDecision() {},
  };
}

// ---------------------------------------------------------------------------
// Helpers & Fixture Builders
// ---------------------------------------------------------------------------

function buildValidTestXlsxBytes(): Uint8Array {
  return buildXlsxFixture([
    {
      name: "Orçamento",
      rows: [
        ["ITEM", "CÓDIGO", "DESCRIÇÃO", "UNID", "QUANT", "BDI", "PREÇO UNIT", "PREÇO TOTAL"],
        ["X", "1", "SERVIÇOS PRELIMINARES E ADMINISTRAÇÃO LOCAL", "", "", "", "", "100.000,00"],
        ["01.01", "", "SERVIÇOS PRELIMINARES", "", "", "", "", "10.000,00"],
        ["01.01.01", "TRANSP-1", "MOBILIZAÇÃO E DESMOBILIZAÇÃO", "UNID", "1,00", "24,18%", "10.000,00", "10.000,00"],
      ],
    },
  ]);
}

function buildSetup() {
  const context = createFakeContext();
  const caseId = "case-alagoas-01";
  const lotId = "lot-alagoas-01";

  const procurementCase: ProcurementCase = {
    id: caseId,
    organizationId: context.organizationId,
    title: "Recuperação de Barragens Alagoas",
    externalReference: null,
    metadata: {},
  };

  const procurementLot: ProcurementLot = {
    id: lotId,
    organizationId: context.organizationId,
    procurementCaseId: caseId,
    title: "Lote 01",
    externalReference: null,
    metadata: {},
  };

  const caseRepo = createFakeProcurementCaseRepository([procurementCase], [procurementLot]);
  const docRepo = createFakeDocumentRepository();
  const docVersionRepo = createFakeDocumentVersionRepository();
  const budgetVersionRepo = createFakeBudgetVersionRepository();
  const reviewRepo = createFakeBudgetReviewRepository();

  const repositories = {
    procurementCaseRepository: caseRepo,
    documentRepository: docRepo,
    documentVersionRepository: docVersionRepo,
    budgetVersionRepository: budgetVersionRepo,
    reviewRepository: reviewRepo,
  };

  return { context, caseId, lotId, procurementCase, procurementLot, repositories };
}

// ---------------------------------------------------------------------------
// Unit Tests Execution (T01 – T17)
// ---------------------------------------------------------------------------

async function main() {
  console.log("Running Sprint 21.5C.1 Application Service Unit Tests (T01 - T17)...\n");

  await runTest("1. Importação válida de XLSX com orquestração completa", async () => {
    const { context, caseId, lotId, repositories } = buildSetup();
    const bytes = buildValidTestXlsxBytes();

    const result = await importStructuredBudgetXlsxService(
      context,
      {
        procurementCaseId: caseId,
        procurementLotId: lotId,
        fileBytes: bytes,
        originalFileName: "Orcamento_Lote01.xlsx",
      },
      repositories,
    );

    if (result.outcome !== "success") {
      console.error("Test 1 Result:", result);
    }
    assertEqual(result.outcome, "success", "expected outcome success");
    assertEqual(result.idempotentReuse, false, "expected new session creation");
    assertTrue(Boolean(result.reviewSessionId), "expected reviewSessionId");
    assertTrue(Boolean(result.budgetVersionId), "expected budgetVersionId");
    assertTrue(Boolean(result.documentVersionId), "expected documentVersionId");
    assertEqual(result.rowCount, 3, "expected 3 rows imported");
  });

  await runTest("2. Rejeita lote inexistente", async () => {
    const { context, caseId, repositories } = buildSetup();
    const bytes = buildValidTestXlsxBytes();

    const result = await importStructuredBudgetXlsxService(
      context,
      {
        procurementCaseId: caseId,
        procurementLotId: "lot-invalido",
        fileBytes: bytes,
        originalFileName: "Orcamento.xlsx",
      },
      repositories,
    );

    assertEqual(result.outcome, "not_found", "expected not_found outcome");
  });

  await runTest("3. Rejeita lote de outro processo", async () => {
    const { context, caseId, repositories } = buildSetup();
    const bytes = buildValidTestXlsxBytes();

    // Adiciona outro lote pertencente a outro processo
    const otherCaseId = "case-outro-processo";
    const otherLotId = "lot-outro-processo";
    await repositories.procurementCaseRepository.createProcurementCase(context.organizationId, context.actor, {
      id: otherCaseId,
      organizationId: context.organizationId,
      title: "Outro Processo",
      externalReference: null,
      metadata: {},
    });
    await repositories.procurementCaseRepository.createProcurementLot(context.organizationId, context.actor, {
      id: otherLotId,
      organizationId: context.organizationId,
      procurementCaseId: otherCaseId,
      title: "Outro Lote",
      externalReference: null,
      metadata: {},
    });

    const result = await importStructuredBudgetXlsxService(
      context,
      {
        procurementCaseId: caseId,
        procurementLotId: otherLotId,
        fileBytes: bytes,
        originalFileName: "Orcamento.xlsx",
      },
      repositories,
    );

    assertEqual(result.outcome, "not_found", "expected not_found outcome when lot does not match case");
  });

  await runTest("4. Rejeita processo de outra organização", async () => {
    const { caseId, lotId, repositories } = buildSetup();
    const contextOutraOrg = createFakeContext({ organizationId: "outra-organizacao" });
    const bytes = buildValidTestXlsxBytes();

    const result = await importStructuredBudgetXlsxService(
      contextOutraOrg,
      {
        procurementCaseId: caseId,
        procurementLotId: lotId,
        fileBytes: bytes,
        originalFileName: "Orcamento.xlsx",
      },
      repositories,
    );

    assertEqual(result.outcome, "not_found", "expected not_found outcome when case belongs to another org");
  });

  await runTest("5. Rejeita XLSX estruturalmente inválido (corrompido/zip inválido)", async () => {
    const { context, caseId, lotId, repositories } = buildSetup();
    const bytesCorrompidos = new Uint8Array([1, 2, 3, 4, 5, 6]);

    const result = await importStructuredBudgetXlsxService(
      context,
      {
        procurementCaseId: caseId,
        procurementLotId: lotId,
        fileBytes: bytesCorrompidos,
        originalFileName: "Corrompido.xlsx",
      },
      repositories,
    );

    assertEqual(result.outcome, "importer_error", "expected importer_error outcome");
  });

  await runTest("6. Rejeita quando importador retorna erro estrutural (sem abas orçamentárias)", async () => {
    const { context, caseId, lotId, repositories } = buildSetup();
    const bytesSemOrcamento = buildXlsxFixture([
      { name: "Resumo", rows: [["Apenas texto", "Sem tabela"]] },
    ]);

    const result = await importStructuredBudgetXlsxService(
      context,
      {
        procurementCaseId: caseId,
        procurementLotId: lotId,
        fileBytes: bytesSemOrcamento,
        originalFileName: "SemOrcamento.xlsx",
      },
      repositories,
    );

    assertEqual(result.outcome, "importer_error", "expected importer_error for sheet without budget header");
  });

  await runTest("7. Criação da BudgetVersion Draft com escopo Lot", async () => {
    const { context, caseId, lotId, repositories } = buildSetup();
    const bytes = buildValidTestXlsxBytes();

    const result = await importStructuredBudgetXlsxService(
      context,
      {
        procurementCaseId: caseId,
        procurementLotId: lotId,
        fileBytes: bytes,
        originalFileName: "Orcamento.xlsx",
      },
      repositories,
    );

    assertTrue(Boolean(result.budgetVersionId), "budgetVersionId returned");
    const createdVersion = await repositories.budgetVersionRepository.loadBudgetVersion(
      context.organizationId,
      result.budgetVersionId!,
    );

    assertTrue(createdVersion !== null, "version loaded");
    assertEqual(createdVersion!.entity.status, "Draft", "status must be Draft");
    assertEqual(createdVersion!.entity.scope.kind, "Lot", "scope must be Lot");
    assertTrue("procurementLotId" in createdVersion!.entity.scope && createdVersion!.entity.scope.procurementLotId === lotId, "lotId must match");
  });

  await runTest("8. Criação da Sessão com status InProgress e mecanismo xlsx_structured_import", async () => {
    const { context, caseId, lotId, repositories } = buildSetup();
    const bytes = buildValidTestXlsxBytes();

    const result = await importStructuredBudgetXlsxService(
      context,
      {
        procurementCaseId: caseId,
        procurementLotId: lotId,
        fileBytes: bytes,
        originalFileName: "Orcamento.xlsx",
      },
      repositories,
    );

    const session = await repositories.reviewRepository.loadSession(
      context.organizationId,
      result.reviewSessionId!,
    );

    assertTrue(session !== null, "session loaded");
    assertEqual(session!.status, "InProgress", "session status must be InProgress");
    assertEqual(session!.acquisitionMechanism, "xlsx_structured_import", "acquisitionMechanism match");
  });

  await runTest("9. Todas as linhas começam com estado Pendente", async () => {
    const { context, caseId, lotId, repositories } = buildSetup();
    const bytes = buildValidTestXlsxBytes();

    const result = await importStructuredBudgetXlsxService(
      context,
      {
        procurementCaseId: caseId,
        procurementLotId: lotId,
        fileBytes: bytes,
        originalFileName: "Orcamento.xlsx",
      },
      repositories,
    );

    const session = await repositories.reviewRepository.loadSession(
      context.organizationId,
      result.reviewSessionId!,
    );

    for (const row of session!.rows) {
      assertEqual(row.state, "Pendente", `row ${row.id} state must be Pendente`);
    }
  });

  await runTest("10. Evidência documental: page = null para linhas XLSX", async () => {
    const { context, caseId, lotId, repositories } = buildSetup();
    const bytes = buildValidTestXlsxBytes();

    const result = await importStructuredBudgetXlsxService(
      context,
      {
        procurementCaseId: caseId,
        procurementLotId: lotId,
        fileBytes: bytes,
        originalFileName: "Orcamento.xlsx",
      },
      repositories,
    );

    const session = await repositories.reviewRepository.loadSession(
      context.organizationId,
      result.reviewSessionId!,
    );

    for (const row of session!.rows) {
      assertEqual(row.page, null, "XLSX rows must have page = null");
    }
  });

  await runTest("11. Metadata de célula e intervalo XLSX preservados em evidenceText/metadata", async () => {
    const { context, caseId, lotId, repositories } = buildSetup();
    const bytes = buildValidTestXlsxBytes();

    const result = await importStructuredBudgetXlsxService(
      context,
      {
        procurementCaseId: caseId,
        procurementLotId: lotId,
        fileBytes: bytes,
        originalFileName: "Orcamento.xlsx",
      },
      repositories,
    );

    const session = await repositories.reviewRepository.loadSession(
      context.organizationId,
      result.reviewSessionId!,
    );

    const itemRow = session!.rows.find((r) => r.kind === "ServiceItem");
    assertTrue(Boolean(itemRow), "service item row found");
    assertTrue(
      itemRow!.evidenceText?.includes("A") ?? false,
      "evidenceText contains cell location metadata",
    );
  });

  await runTest("12. Retry idempotente: segunda chamada com mesmo arquivo retorna a mesma sessão", async () => {
    const { context, caseId, lotId, repositories } = buildSetup();
    const bytes = buildValidTestXlsxBytes();

    const result1 = await importStructuredBudgetXlsxService(
      context,
      {
        procurementCaseId: caseId,
        procurementLotId: lotId,
        fileBytes: bytes,
        originalFileName: "Orcamento.xlsx",
      },
      repositories,
    );

    const result2 = await importStructuredBudgetXlsxService(
      context,
      {
        procurementCaseId: caseId,
        procurementLotId: lotId,
        fileBytes: bytes,
        originalFileName: "Orcamento.xlsx",
      },
      repositories,
    );

    assertEqual(result2.outcome, "success", "retry outcome success");
    assertEqual(result2.idempotentReuse, true, "retry marked idempotentReuse = true");
    assertEqual(result2.reviewSessionId, result1.reviewSessionId, "reviewSessionId must be identical");
  });

  await runTest("13. Retry idempotente NÃO duplica BudgetVersion", async () => {
    const { context, caseId, lotId, repositories } = buildSetup();
    const bytes = buildValidTestXlsxBytes();

    const result1 = await importStructuredBudgetXlsxService(
      context,
      {
        procurementCaseId: caseId,
        procurementLotId: lotId,
        fileBytes: bytes,
        originalFileName: "Orcamento.xlsx",
      },
      repositories,
    );

    const result2 = await importStructuredBudgetXlsxService(
      context,
      {
        procurementCaseId: caseId,
        procurementLotId: lotId,
        fileBytes: bytes,
        originalFileName: "Orcamento.xlsx",
      },
      repositories,
    );

    assertEqual(result2.budgetVersionId, result1.budgetVersionId, "budgetVersionId must be identical on retry");
  });

  await runTest("14. Retry idempotente NÃO duplica Sessão", async () => {
    const { context, caseId, lotId, repositories } = buildSetup();
    const bytes = buildValidTestXlsxBytes();

    const result1 = await importStructuredBudgetXlsxService(
      context,
      {
        procurementCaseId: caseId,
        procurementLotId: lotId,
        fileBytes: bytes,
        originalFileName: "Orcamento.xlsx",
      },
      repositories,
    );

    const result2 = await importStructuredBudgetXlsxService(
      context,
      {
        procurementCaseId: caseId,
        procurementLotId: lotId,
        fileBytes: bytes,
        originalFileName: "Orcamento.xlsx",
      },
      repositories,
    );

    assertEqual(result2.reviewSessionId, result1.reviewSessionId, "reviewSessionId must be identical on retry");
  });

  await runTest("15. Retry idempotente NÃO duplica Linhas na Sessão", async () => {
    const { context, caseId, lotId, repositories } = buildSetup();
    const bytes = buildValidTestXlsxBytes();

    const result1 = await importStructuredBudgetXlsxService(
      context,
      {
        procurementCaseId: caseId,
        procurementLotId: lotId,
        fileBytes: bytes,
        originalFileName: "Orcamento.xlsx",
      },
      repositories,
    );

    await importStructuredBudgetXlsxService(
      context,
      {
        procurementCaseId: caseId,
        procurementLotId: lotId,
        fileBytes: bytes,
        originalFileName: "Orcamento.xlsx",
      },
      repositories,
    );

    const session = await repositories.reviewRepository.loadSession(
      context.organizationId,
      result1.reviewSessionId!,
    );

    assertEqual(session!.rows.length, 3, "row count must remain exactly 3 without duplication");
  });

  await runTest("16. Reutilização de DocumentVersion por SHA-256 no repositório documental", async () => {
    const { context, caseId, lotId, repositories } = buildSetup();
    const bytes = buildValidTestXlsxBytes();

    const result1 = await importStructuredBudgetXlsxService(
      context,
      {
        procurementCaseId: caseId,
        procurementLotId: lotId,
        fileBytes: bytes,
        originalFileName: "Orcamento.xlsx",
      },
      repositories,
    );

    const result2 = await importStructuredBudgetXlsxService(
      context,
      {
        procurementCaseId: caseId,
        procurementLotId: lotId,
        fileBytes: bytes,
        originalFileName: "Orcamento.xlsx",
      },
      repositories,
    );

    assertEqual(result2.documentVersionId, result1.documentVersionId, "documentVersionId must be reused by SHA-256");
  });

  await runTest("17. Motor R11 e OCR nunca são invocados na importação XLSX", async () => {
    const { context, caseId, lotId, repositories } = buildSetup();
    const bytes = buildValidTestXlsxBytes();

    const result = await importStructuredBudgetXlsxService(
      context,
      {
        procurementCaseId: caseId,
        procurementLotId: lotId,
        fileBytes: bytes,
        originalFileName: "Orcamento.xlsx",
      },
      repositories,
    );

    const session = await repositories.reviewRepository.loadSession(
      context.organizationId,
      result.reviewSessionId!,
    );

    assertEqual(session!.acquisitionMechanism, "xlsx_structured_import", "mechanism must be pure xlsx import");
    assertTrue(!session!.acquisitionMechanism.includes("vision"), "must not be vision");
    assertTrue(!session!.acquisitionMechanism.includes("r11"), "must not be r11");
  });

  console.log("\nAll 17 synthetic unit tests completed successfully!");
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exitCode = 1;
});
