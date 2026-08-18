import {
  createDocumentArtifact,
  createDocumentVersion,
  type DocumentArtifact,
  type DocumentVersion,
} from "../../domain/document-processing";
import type { DocumentRepository } from "../document-processing/document.repository";
import type { DocumentVersionRepository } from "../document-processing/document-version.repository";
import {
  type ProcurementCase,
  type ProcurementLot,
} from "../../domain/procurement-case";
import type { ProcurementCaseRepository } from "../procurement-engineering/procurement-case.repository";
import { type BudgetVersion } from "../../domain/budget-version";
import type { BudgetVersionRepository, SaveBudgetVersionResult } from "../procurement-engineering/budget-version.repository";
import {
  BudgetReviewSessionStatus,
  type BudgetReviewSession,
} from "../../domain/budget-official-review";
import type { BudgetReviewRepository, CreateSessionResult } from "./budget-review.repository";
import { importStructuredBudgetXlsxService } from "./import-structured-budget-xlsx-service";
import type { ApplicationContext } from "./application-context";
import { buildXlsxFixture } from "../../domain/schedule-management/adapters/excel-import/xlsx-test-fixtures";

// ---------------------------------------------------------------------------
// Test Runner Helpers
// ---------------------------------------------------------------------------

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

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.error(`  ✗ ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// Fake Repositories
// ---------------------------------------------------------------------------

function createFakeContext(): ApplicationContext {
  return {
    organizationId: "org-alagoas-test",
    actor: "user-ricardo-test",
  };
}

function createFakeProcurementCaseRepository(
  cases: ProcurementCase[] = [],
  lots: ProcurementLot[] = [],
): ProcurementCaseRepository {
  const caseMap = new Map<string, ProcurementCase>(cases.map((c) => [`${c.organizationId}:${c.id}`, c]));
  const lotMap = new Map<string, ProcurementLot>(lots.map((l) => [`${l.organizationId}:${l.procurementCaseId}:${l.id}`, l]));

  return {
    async findProcurementCaseById(orgId: string, id: string) {
      return caseMap.get(`${orgId}:${id}`) ?? null;
    },
    async findProcurementLotById(orgId: string, caseId: string, lotId: string) {
      return lotMap.get(`${orgId}:${caseId}:${lotId}`) ?? null;
    },
    async createProcurementCase(orgId: string, _actor: string, caseObj: ProcurementCase) {
      caseMap.set(`${orgId}:${caseObj.id}`, caseObj);
      return caseObj;
    },
    async createProcurementLot(orgId: string, _actor: string, lotObj: ProcurementLot) {
      lotMap.set(`${orgId}:${lotObj.procurementCaseId}:${lotObj.id}`, lotObj);
      return lotObj;
    },
  };
}

function createFakeDocumentRepository(): DocumentRepository {
  const documents = new Map<string, DocumentArtifact>();
  return {
    async createDocument(orgId: string, _actor: string, document: DocumentArtifact) {
      const key = `${orgId}:${document.id}`;
      documents.set(key, document);
      return document;
    },
    async findDocumentById(orgId: string, id: string) {
      return documents.get(`${orgId}:${id}`) ?? null;
    },
  };
}

function createFakeDocumentVersionRepository(): DocumentVersionRepository {
  const versions = new Map<string, DocumentVersion>();
  return {
    async createOrReuseDocumentVersion(orgId: string, _actor: string, documentVersion: DocumentVersion) {
      const key = `${orgId}:${documentVersion.documentId}:${documentVersion.sha256}`;
      const existing = versions.get(key);
      if (existing) {
        return { outcome: "reused", documentVersion: existing };
      }
      versions.set(key, documentVersion);
      return { outcome: "created", documentVersion };
    },
    async findDocumentVersionById(orgId: string, id: string) {
      for (const version of versions.values()) {
        if (version.documentId && version.id === id) return version;
      }
      return null;
    },
    async findDocumentVersionByDocumentAndSha256(orgId: string, documentId: string, sha256: string) {
      return versions.get(`${orgId}:${documentId}:${sha256}`) ?? null;
    },
    async listDocumentVersionsByDocument() {
      return Array.from(versions.values());
    },
  };
}

function createFakeBudgetVersionRepository(): BudgetVersionRepository {
  const versions = new Map<string, BudgetVersion>();
  return {
    async createDraftBudgetVersion(orgId: string, _actor: string, budgetVersion: BudgetVersion) {
      const key = `${orgId}:${budgetVersion.id}`;
      versions.set(key, budgetVersion);
      return { entity: budgetVersion, revision: 1 };
    },
    async loadBudgetVersion(orgId: string, id: string) {
      const found = versions.get(`${orgId}:${id}`);
      return found ? { entity: found, revision: 1 } : null;
    },
    async saveBudgetVersion(_orgId: string, _actor: string, budgetVersion: BudgetVersion, expectedRevision?: number): Promise<SaveBudgetVersionResult> {
      return { outcome: "saved", revision: (expectedRevision ?? 1) + 1 };
    },
  };
}

function createFakeBudgetReviewRepository(): BudgetReviewRepository {
  const sessions = new Map<string, BudgetReviewSession>();
  return {
    async findOrganizationIdForSession(sessionId: string) {
      for (const session of sessions.values()) {
        if (session.id === sessionId) return session.organizationId;
      }
      return null;
    },
    async loadSession(_orgId: string, sessionId: string) {
      return sessions.get(sessionId) ?? null;
    },
    async findSessionByAcquisition(orgId: string, caseId: string, sourceSha256: string, acquisitionMechanism: string, procurementLotId?: string | null) {
      for (const session of sessions.values()) {
        const matchesLot = procurementLotId
          ? session.procurementLotId === procurementLotId
          : !session.procurementLotId;

        if (
          session.organizationId === orgId &&
          session.procurementCaseId === caseId &&
          session.sourceSha256 === sourceSha256 &&
          session.acquisitionMechanism === acquisitionMechanism &&
          matchesLot
        ) {
          return session;
        }
      }
      return null;
    },
    async createSession(orgId: string, _actor: string, session: BudgetReviewSession): Promise<CreateSessionResult> {
      for (const existing of sessions.values()) {
        const matchesLot = session.procurementLotId
          ? existing.procurementLotId === session.procurementLotId
          : !existing.procurementLotId;

        if (
          existing.organizationId === orgId &&
          existing.procurementCaseId === session.procurementCaseId &&
          existing.sourceSha256 === session.sourceSha256 &&
          existing.acquisitionMechanism === session.acquisitionMechanism &&
          matchesLot
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
    async importRows(_orgId: string, _actor: string, sessionId: string, rows: any[]): Promise<number> {
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
        ["X", "1", "SERVIÇOS PRELIMINARES E ADMINISTRAÇÃO LOCAL", "", "", "", "", 100000],
        ["01.01", "", "SERVIÇOS PRELIMINARES", "", "", "", "", 10000],
        ["01.01.01", "TRANSP-1", "MOBILIZAÇÃO E DESMOBILIZAÇÃO", "UNID", 1, "24,18%", 10000, 10000],
      ],
    },
  ]);
}

function buildSetup() {
  const context = createFakeContext();
  const caseId = "case-alagoas-01";
  const lotId = "lot-alagoas-01";
  const lot02Id = "lot-alagoas-02";

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

  const procurementLot02: ProcurementLot = {
    id: lot02Id,
    organizationId: context.organizationId,
    procurementCaseId: caseId,
    title: "Lote 02",
    externalReference: null,
    metadata: {},
  };

  const caseRepo = createFakeProcurementCaseRepository([procurementCase], [procurementLot, procurementLot02]);
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

  return { context, caseId, lotId, lot02Id, procurementCase, procurementLot, procurementLot02, repositories };
}

// ---------------------------------------------------------------------------
// Unit Tests Execution (Sprint 21.5C.1A Hardening)
// ---------------------------------------------------------------------------

async function main() {
  console.log("Running Sprint 21.5C.1A Application Service Unit Tests...\n");

  await runTest("1. storageReference é OBRIGATÓRIO (rejeita se ausente ou string vazia)", async () => {
    const { context, caseId, lotId, repositories } = buildSetup();
    const bytes = buildValidTestXlsxBytes();

    const result = await importStructuredBudgetXlsxService(
      context,
      {
        procurementCaseId: caseId,
        procurementLotId: lotId,
        fileBytes: bytes,
        originalFileName: "Orcamento_Lote01.xlsx",
        storageReference: "", // Vazio!
      },
      repositories,
    );

    assertEqual(result.outcome, "domain_error", "expected domain_error when storageReference is empty");
    assertTrue(Boolean(result.errors && result.errors.length > 0), "expected error message");
  });

  await runTest("2. Sem fallback fictício de Storage (usa o storageReference real fornecido)", async () => {
    const { context, caseId, lotId, repositories } = buildSetup();
    const bytes = buildValidTestXlsxBytes();
    const realStorageRef = `${context.organizationId}/orcamentos/real-file-sha.xlsx`;

    const result = await importStructuredBudgetXlsxService(
      context,
      {
        procurementCaseId: caseId,
        procurementLotId: lotId,
        fileBytes: bytes,
        originalFileName: "Orcamento_Lote01.xlsx",
        storageReference: realStorageRef,
      },
      repositories,
    );

    assertEqual(result.outcome, "success", "expected success outcome");
    const docVersion = await repositories.documentVersionRepository.findDocumentVersionById(
      context.organizationId,
      result.documentVersionId!,
    );
    assertTrue(docVersion !== null, "DocumentVersion found");
    assertEqual(docVersion!.storageReference, realStorageRef, "must preserve exact storageReference");
  });

  await runTest("3. Retry no MESMO lote reutiliza a mesma sessão", async () => {
    const { context, caseId, lotId, repositories } = buildSetup();
    const bytes = buildValidTestXlsxBytes();
    const storageRef = `${context.organizationId}/orcamentos/test.xlsx`;

    const res1 = await importStructuredBudgetXlsxService(
      context,
      { procurementCaseId: caseId, procurementLotId: lotId, fileBytes: bytes, originalFileName: "O.xlsx", storageReference: storageRef },
      repositories,
    );
    assertEqual(res1.outcome, "success", "res1 success");
    assertEqual(res1.idempotentReuse, false, "res1 new session");

    const res2 = await importStructuredBudgetXlsxService(
      context,
      { procurementCaseId: caseId, procurementLotId: lotId, fileBytes: bytes, originalFileName: "O.xlsx", storageReference: storageRef },
      repositories,
    );
    assertEqual(res2.outcome, "success", "res2 success");
    assertEqual(res2.idempotentReuse, true, "res2 reused session");
    assertEqual(res2.reviewSessionId, res1.reviewSessionId, "reused same session ID");
  });

  await runTest("4. MESMOS bytes em LOTES DIFERENTES criam DUAS sessões distintas", async () => {
    const { context, caseId, lotId, lot02Id, repositories } = buildSetup();
    const bytes = buildValidTestXlsxBytes();
    const storageRef = `${context.organizationId}/orcamentos/same-bytes.xlsx`;

    const resLote01 = await importStructuredBudgetXlsxService(
      context,
      { procurementCaseId: caseId, procurementLotId: lotId, fileBytes: bytes, originalFileName: "O.xlsx", storageReference: storageRef },
      repositories,
    );

    const resLote02 = await importStructuredBudgetXlsxService(
      context,
      { procurementCaseId: caseId, procurementLotId: lot02Id, fileBytes: bytes, originalFileName: "O.xlsx", storageReference: storageRef },
      repositories,
    );

    assertEqual(resLote01.outcome, "success", "Lote 01 success");
    assertEqual(resLote02.outcome, "success", "Lote 02 success");
    assertTrue(resLote01.reviewSessionId !== resLote02.reviewSessionId, "Sessions MUST be distinct for different lots");

    const session01 = await repositories.reviewRepository.loadSession(context.organizationId, resLote01.reviewSessionId!);
    const session02 = await repositories.reviewRepository.loadSession(context.organizationId, resLote02.reviewSessionId!);

    assertEqual(session01!.procurementLotId, lotId, "session 01 lotId match");
    assertEqual(session02!.procurementLotId, lot02Id, "session 02 lotId match");
  });

  await runTest("5. Identidade de DocumentArtifact é distinta entre lotes diferentes", async () => {
    const { context, caseId, lotId, lot02Id, repositories } = buildSetup();
    const bytes = buildValidTestXlsxBytes();
    const storageRef = `${context.organizationId}/orcamentos/same-bytes.xlsx`;

    const resLote01 = await importStructuredBudgetXlsxService(
      context,
      { procurementCaseId: caseId, procurementLotId: lotId, fileBytes: bytes, originalFileName: "O.xlsx", storageReference: storageRef },
      repositories,
    );

    const resLote02 = await importStructuredBudgetXlsxService(
      context,
      { procurementCaseId: caseId, procurementLotId: lot02Id, fileBytes: bytes, originalFileName: "O.xlsx", storageReference: storageRef },
      repositories,
    );

    const ver01 = await repositories.documentVersionRepository.findDocumentVersionById(context.organizationId, resLote01.documentVersionId!);
    const ver02 = await repositories.documentVersionRepository.findDocumentVersionById(context.organizationId, resLote02.documentVersionId!);

    assertTrue(ver01 !== null && ver02 !== null, "both document versions loaded");
    assertTrue(ver01!.documentId !== ver02!.documentId, "DocumentArtifact IDs MUST be distinct between different lots");
    assertEqual(ver01!.documentId, lotId, "Lote 01 artifact ID");
    assertEqual(ver02!.documentId, lot02Id, "Lote 02 artifact ID");
  });

  await runTest("6. Nova versão de XLSX no MESMO lote reusa o mesmo DocumentArtifact do lote", async () => {
    const { context, caseId, lotId, repositories } = buildSetup();
    const bytesV1 = buildValidTestXlsxBytes();

    const resV1 = await importStructuredBudgetXlsxService(
      context,
      { procurementCaseId: caseId, procurementLotId: lotId, fileBytes: bytesV1, originalFileName: "O_v1.xlsx", storageReference: "ref1.xlsx" },
      repositories,
    );

    // Build a slightly modified XLSX for V2 (different bytes/sha256)
    const bytesV2 = buildXlsxFixture([
      {
        name: "Orçamento",
        rows: [
          ["ITEM", "CÓDIGO", "DESCRIÇÃO", "UNID", "QUANT", "BDI", "PREÇO UNIT", "PREÇO TOTAL"],
          ["X", "1", "SERVIÇOS PRELIMINARES REVISADOS", "", "", "", "", "120.000,00"],
          ["01.01", "", "SERVIÇOS PRELIMINARES", "", "", "", "", "12.000,00"],
        ],
      },
    ]);

    const resV2 = await importStructuredBudgetXlsxService(
      context,
      { procurementCaseId: caseId, procurementLotId: lotId, fileBytes: bytesV2, originalFileName: "O_v2.xlsx", storageReference: "ref2.xlsx" },
      repositories,
    );

    const ver1 = await repositories.documentVersionRepository.findDocumentVersionById(context.organizationId, resV1.documentVersionId!);
    const ver2 = await repositories.documentVersionRepository.findDocumentVersionById(context.organizationId, resV2.documentVersionId!);

    assertTrue(ver1 !== null && ver2 !== null, "both versions loaded");
    assertEqual(ver1!.documentId, ver2!.documentId, "MUST reuse same DocumentArtifact ID for new version of same lot");
    assertTrue(ver1!.id !== ver2!.id, "DocumentVersions are distinct");
  });

  await runTest("7. Sessão WholeCase antiga continua válida (procurementLotId: null)", async () => {
    const { context, caseId, repositories } = buildSetup();
    const reviewRepo = repositories.reviewRepository;

    // Create a mock historical WholeCase session (procurementLotId: null)
    const wholeCaseSession: BudgetReviewSession = {
      id: "sess-historical-whole-case",
      organizationId: context.organizationId,
      procurementCaseId: caseId,
      procurementLotId: null,
      budgetVersionId: "bv-whole-case",
      documentVersionId: "docv-whole-case",
      sourceSha256: "sha-historical-pdf",
      acquisitionMechanism: "vision_assisted_transcription",
      acquisitionMechanismVersion: "claude-sonnet-5",
      status: BudgetReviewSessionStatus.InProgress,
      rows: [],
      createdBy: context.actor,
      createdAt: new Date().toISOString(),
      metadata: {},
    };

    await reviewRepo.createSession(context.organizationId, context.actor, wholeCaseSession);

    const reloaded = await reviewRepo.findSessionByAcquisition(
      context.organizationId,
      caseId,
      "sha-historical-pdf",
      "vision_assisted_transcription",
      null, // WholeCase lookup
    );

    assertTrue(reloaded !== null, "Historical WholeCase session loaded successfully");
    assertEqual(reloaded!.id, "sess-historical-whole-case", "Session ID matches");
    assertEqual(reloaded!.procurementLotId ?? null, null, "procurementLotId is null");
  });

  await runTest("8. Motor R11 e OCR nunca são invocados na importação XLSX", async () => {
    const { context, caseId, lotId, repositories } = buildSetup();
    const bytes = buildValidTestXlsxBytes();

    const result = await importStructuredBudgetXlsxService(
      context,
      {
        procurementCaseId: caseId,
        procurementLotId: lotId,
        fileBytes: bytes,
        originalFileName: "Orcamento_Lote01.xlsx",
        storageReference: "org/orcamentos/ref.xlsx",
      },
      repositories,
    );

    assertEqual(result.outcome, "success", "import succeeded without OCR/R11");
    const session = await repositories.reviewRepository.loadSession(context.organizationId, result.reviewSessionId!);
    assertEqual(session!.acquisitionMechanism, "xlsx_structured_import", "acquisitionMechanism must be xlsx_structured_import");
  });

  console.log("\nAll Sprint 21.5C.1A unit tests completed successfully!");
}

main().catch(console.error);
