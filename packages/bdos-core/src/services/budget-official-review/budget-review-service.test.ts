import {
  createBudgetReviewSessionService,
  importBudgetReviewRowsService,
  confirmBudgetReviewRowService,
  correctBudgetReviewRowService,
  excludeBudgetReviewRowService,
  consolidateBudgetReviewSessionService,
} from "./budget-review-service";
import type { ApplicationContext } from "./application-context";
import type { BudgetReviewRepository } from "./budget-review.repository";
import type { BudgetVersionRepository, PersistedEntity, SaveBudgetVersionResult } from "../procurement-engineering/budget-version.repository";
import { INITIAL_BUDGET_VERSION_REVISION } from "../procurement-engineering/budget-version.repository";
import type { ProcurementCaseRepository } from "../procurement-engineering/procurement-case.repository";
import {
  BudgetLineKind,
  BudgetVersionOriginKind,
  BudgetVersionStatus,
  createBudgetVersion,
} from "../../domain/budget-version";
import type { BudgetVersion } from "../../domain/budget-version";
import { ProcurementScopeKind, createProcurementCase, createProcurementLot } from "../../domain/procurement-case";
import type { ProcurementCase, ProcurementLot, ProcurementScope } from "../../domain/procurement-case";
import { createDocumentArtifact, createDocumentVersion } from "../../domain/document-processing";
import type { DocumentVersion } from "../../domain/document-processing";
import {
  BudgetReviewSessionStatus,
  EMPTY_BUDGET_REVIEW_ROW_FIELDS,
  createBudgetReviewSession,
} from "../../domain/budget-official-review";
import type { BudgetReviewRowFields, BudgetReviewSession } from "../../domain/budget-official-review";

// Correção Sprint 21.5A (Bloqueador A) — testes de coordenação do fluxo de
// consolidação completo (Sessão de Revisão -> projeção -> BudgetVersion
// Consolidated) contra repositórios falsos em memória, mesma disciplina de
// budget-version-service.test.ts (Sprint 21.3C). Não repete os testes de
// domínio puro já cobertos em budget-official-review.test.ts.

const organizationId = "organization-bba-alagoas";

function contextFor(): ApplicationContext {
  return { organizationId, actor: "admin-bba-teste" };
}

const procurementCaseResult = createProcurementCase({ id: "case-alagoas", organizationId, title: "Recuperação de Diversas Barragens do DNOCS no Estado de Alagoas" });
if (!procurementCaseResult.success) throw new Error(`expected ProcurementCase creation success: ${JSON.stringify(procurementCaseResult.errors)}`);
const procurementCase: ProcurementCase = procurementCaseResult.procurementCase;
const procurementLotResult = createProcurementLot({ id: "lot-alagoas-01", procurementCase, title: "Lote 01" });
if (!procurementLotResult.success) throw new Error(`expected ProcurementLot creation success: ${JSON.stringify(procurementLotResult.errors)}`);
const procurementLot: ProcurementLot = procurementLotResult.procurementLot;

const wholeCaseScope: ProcurementScope = { kind: ProcurementScopeKind.WholeCase, procurementCaseId: procurementCase.id };
const sourceSha256 = "1014422e2b29af5ae68bf829e6e20c0a5c35dd1424d559a081e8acabcdf2dcc1";

function freshBudgetVersion(id: string, lot?: ProcurementLot): BudgetVersion {
  const scope: ProcurementScope = lot
    ? { kind: ProcurementScopeKind.Lot, procurementCaseId: procurementCase.id, procurementLotId: lot.id }
    : wholeCaseScope;
  const result = createBudgetVersion({
    id,
    procurementCase,
    procurementLot: lot,
    scope,
    origin: { kind: BudgetVersionOriginKind.DocumentaryOpaqueReference, reference: sourceSha256 },
  });
  if (!result.success) throw new Error(`expected BudgetVersion creation success: ${JSON.stringify(result.errors)}`);
  return result.budgetVersion;
}

interface FakeProcurementCaseRepository extends ProcurementCaseRepository {
  lotLookupCallCount(): number;
  lastLotLookup(): ReadonlyArray<string> | null;
}

function createFakeProcurementCaseRepository(lots: ReadonlyArray<ProcurementLot> = []): FakeProcurementCaseRepository {
  let lotLookupCalls = 0;
  let lastLookup: ReadonlyArray<string> | null = null;

  return {
    lotLookupCallCount: () => lotLookupCalls,
    lastLotLookup: () => lastLookup,
    async createProcurementCase() {
      throw new Error("not used by consolidation");
    },
    async findProcurementCaseById(_organizationId, id) {
      return id === procurementCase.id ? procurementCase : null;
    },
    async createProcurementLot() {
      throw new Error("not used by consolidation");
    },
    async findProcurementLotById(requestedOrganizationId, procurementCaseId, id) {
      lotLookupCalls += 1;
      lastLookup = [requestedOrganizationId, procurementCaseId, id];
      return lots.find(
        (candidate) =>
          candidate.organizationId === requestedOrganizationId &&
          candidate.procurementCaseId === procurementCaseId &&
          candidate.id === id,
      ) ?? null;
    },
  };
}

function freshDocumentVersion(id: string): DocumentVersion {
  const documentResult = createDocumentArtifact({
    id: `document-${id}`,
    organizationId,
    context: "budget-official-review-service-test",
    registeredBy: "test-actor",
    registeredAt: "2026-08-11T00:00:00.000Z",
  });
  if (!documentResult.success) throw new Error("expected document artifact creation success");
  const versionResult = createDocumentVersion({
    id,
    document: documentResult.document,
    sha256: sourceSha256,
    originalFileName: "orcamento.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1_000,
    storageReference: "alagoas/orcamento.pdf",
    uploadedBy: "test-actor",
    uploadedAt: "2026-08-11T00:00:00.000Z",
  });
  if (!versionResult.success) throw new Error("expected document version creation success");
  return versionResult.documentVersion;
}

const fields = (overrides: Partial<BudgetReviewRowFields> = {}): BudgetReviewRowFields => ({ ...EMPTY_BUDGET_REVIEW_ROW_FIELDS, ...overrides });

// ---------------------------------------------------------------------------
// Repositórios falsos em memória
// ---------------------------------------------------------------------------

function createFakeBudgetReviewRepository(): BudgetReviewRepository {
  const sessions = new Map<string, BudgetReviewSession>();

  return {
    async findOrganizationIdForSession(sessionId) {
      const session = sessions.get(sessionId);
      return session === undefined ? null : session.organizationId;
    },
    async loadSession(_organizationId, sessionId) {
      return sessions.get(sessionId) ?? null;
    },
    async findSessionByAcquisition() {
      return null;
    },
    async createSession(_organizationId, _actor, session) {
      sessions.set(session.id, session);
      return { outcome: "created", sessionId: session.id };
    },
    async mutateRow(_organizationId, _actor, session) {
      sessions.set(session.id, session);
    },
    async recordReconciliationDecision(_organizationId, _actor, sessionId, _rowId, _decision, _auditEvent) {
      const session = sessions.get(sessionId);
      if (session === undefined) throw new Error("session not found");
    },
    async consolidateSession(_organizationId, _actor, sessionId) {
      const session = sessions.get(sessionId);
      if (session === undefined) return { success: false };
      sessions.set(sessionId, { ...session, status: BudgetReviewSessionStatus.Consolidated });
      return { success: true };
    },
    async importRows(_organizationId, _actor, sessionId, rows) {
      const session = sessions.get(sessionId);
      if (session === undefined) throw new Error("session not found");
      sessions.set(sessionId, { ...session, rows: [...session.rows, ...rows] });
      return rows.length;
    },
  };
}

interface FakeBudgetVersionRepository extends BudgetVersionRepository {
  saveCallCount(): number;
}

function createFakeBudgetVersionRepository(): FakeBudgetVersionRepository {
  const versions = new Map<string, PersistedEntity<BudgetVersion>>();
  let saveCalls = 0;

  return {
    saveCallCount(): number {
      return saveCalls;
    },
    async createDraftBudgetVersion(organizationId, _actor, budgetVersion) {
      const persisted: PersistedEntity<BudgetVersion> = { entity: budgetVersion, revision: INITIAL_BUDGET_VERSION_REVISION };
      versions.set(`${organizationId}:${budgetVersion.id}`, persisted);
      return persisted;
    },
    async loadBudgetVersion(organizationId, id) {
      return versions.get(`${organizationId}:${id}`) ?? null;
    },
    async saveBudgetVersion(organizationId, _actor, budgetVersion, expectedRevision): Promise<SaveBudgetVersionResult> {
      saveCalls += 1;
      const key = `${organizationId}:${budgetVersion.id}`;
      const current = versions.get(key);
      if (current === undefined || current.revision !== expectedRevision) {
        return { outcome: "concurrency_conflict" };
      }
      const revision = current.revision + 1;
      versions.set(key, { entity: budgetVersion, revision });
      return { outcome: "saved", revision };
    },
  };
}

// ---------------------------------------------------------------------------
// Cenário: sessão pronta com linhas Confirmada, Corrigida, Excluída, Pendente
// ---------------------------------------------------------------------------

async function buildReadySession(
  reviewRepository: BudgetReviewRepository,
  budgetVersionRepository: BudgetVersionRepository,
  id: string,
  lot?: ProcurementLot,
) {
  const budgetVersion = freshBudgetVersion(`budget-version-${id}`, lot);
  await budgetVersionRepository.createDraftBudgetVersion(organizationId, "admin-bba-teste", budgetVersion);
  const documentVersion = freshDocumentVersion(`document-version-${id}`);

  let createdSession: BudgetReviewSession;
  if (lot) {
    const created = createBudgetReviewSession({
      id: `review-session-${id}`,
      procurementCase,
      procurementLotId: lot.id,
      budgetVersion,
      documentVersion,
      sourceSha256,
      acquisitionMechanism: "vision_assisted_transcription",
      createdBy: contextFor().actor,
      createdAt: "2026-08-18T00:00:00.000Z",
    });
    if (!created.success) throw new Error(`expected session creation success: ${JSON.stringify(created)}`);
    createdSession = created.session;
    await reviewRepository.createSession(organizationId, contextFor().actor, createdSession);
  } else {
    const created = await createBudgetReviewSessionService(
      contextFor(),
      { id: `review-session-${id}`, procurementCase, budgetVersion, documentVersion, sourceSha256, acquisitionMechanism: "vision_assisted_transcription" },
      reviewRepository,
    );
    if (created.outcome !== "success") throw new Error(`expected session creation success: ${JSON.stringify(created)}`);
    createdSession = created.session;
  }

  const imported = await importBudgetReviewRowsService(
    contextFor(),
    {
      sessionId: createdSession.id,
      rows: [
        { id: "group-1", kind: BudgetLineKind.Group, lotReference: "Lote 01", parentRowId: null, position: 0, fields: fields({ description: "GRUPO 1" }), page: 16 },
        { id: "item-confirmed", kind: BudgetLineKind.ServiceItem, lotReference: "Lote 01", parentRowId: "group-1", position: 0, fields: fields({ description: "Item confirmado", totalPriceText: "100.00" }), page: 16 },
        { id: "item-corrected", kind: BudgetLineKind.ServiceItem, lotReference: "Lote 01", parentRowId: "group-1", position: 1, fields: fields({ description: "Item a corrigir", totalPriceText: "50.00" }), page: 16 },
        { id: "item-excluded", kind: BudgetLineKind.ServiceItem, lotReference: "Lote 01", parentRowId: "group-1", position: 2, fields: fields({ description: "Título de página promovido por erro", totalPriceText: "1.00" }), page: 16 },
      ],
    },
    reviewRepository,
  );
  if (imported.outcome !== "success") throw new Error(`expected import success: ${JSON.stringify(imported)}`);

  const confirmedGroup = await confirmBudgetReviewRowService(contextFor(), { sessionId: createdSession.id, rowId: "group-1" }, reviewRepository);
  if (confirmedGroup.outcome !== "success") throw new Error("expected group confirmation success");
  const confirmedItem = await confirmBudgetReviewRowService(contextFor(), { sessionId: createdSession.id, rowId: "item-confirmed" }, reviewRepository);
  if (confirmedItem.outcome !== "success") throw new Error("expected item confirmation success");

  const corrected = await correctBudgetReviewRowService(
    contextFor(),
    { sessionId: createdSession.id, rowId: "item-corrected", fields: { totalPriceText: "55.00" }, justification: "Ajuste conferido contra a fonte." },
    reviewRepository,
  );
  if (corrected.outcome !== "success") throw new Error("expected correction success");
  const excluded = await excludeBudgetReviewRowService(
    contextFor(),
    { sessionId: createdSession.id, rowId: "item-excluded", justification: "Não é item real — cabeçalho de seção." },
    reviewRepository,
  );
  if (excluded.outcome !== "success") throw new Error("expected exclusion success");

  return { sessionId: createdSession.id, budgetVersionId: budgetVersion.id };
}

// Pendente nunca coexiste com uma consolidação bem-sucedida — o gate de
// readiness já bloqueia isso mais cedo (ver "Consolidação bloqueada quando
// existe linha Pendente" em budget-official-review.test.ts). Este teste
// prova a outra metade da regra de projeção: mesmo dentro de uma sessão
// pronta, a linha NaoPertenceAoOrcamento nunca alcança a BudgetVersion.
await runTest("Consolidação projeta apenas linhas aprovadas (ignora Excluída) e persiste BudgetVersion Consolidated", async () => {
  const reviewRepository = createFakeBudgetReviewRepository();
  const budgetVersionRepository = createFakeBudgetVersionRepository();
  const procurementCaseRepository = createFakeProcurementCaseRepository();
  const { sessionId, budgetVersionId } = await buildReadySession(reviewRepository, budgetVersionRepository, "a");

  const result = await consolidateBudgetReviewSessionService(
    contextFor(),
    { sessionId },
    reviewRepository,
    budgetVersionRepository,
    procurementCaseRepository,
  );
  if (result.outcome !== "success") throw new Error(`expected consolidation success: ${JSON.stringify(result)}`);
  assertEqual(result.session.status, BudgetReviewSessionStatus.Consolidated, "session must become Consolidated");

  const persisted = await budgetVersionRepository.loadBudgetVersion(organizationId, budgetVersionId);
  if (persisted === null) throw new Error("expected persisted BudgetVersion to be found — this is exactly what GET /api/orcamentos/consolidado relies on");
  assertEqual(persisted.entity.status, BudgetVersionStatus.Consolidated, "persisted BudgetVersion must be Consolidated");

  const lineIds = persisted.entity.lines.map((line) => line.id).sort();
  assertEqual(JSON.stringify(lineIds), JSON.stringify(["group-1", "item-confirmed", "item-corrected"]), "projection must preserve Confirmado/Corrigido and skip the excluded row entirely — never a Pendente line either");

  const correctedLine = persisted.entity.lines.find((line) => line.id === "item-corrected")!;
  assertEqual(correctedLine.totalCents, 5_500, "projection must preserve the CORRECTED total (55,00), never the original extracted 50,00");
  assertEqual(procurementCaseRepository.lotLookupCallCount(), 0, "WholeCase consolidation must not load a ProcurementLot");
});

await runTest("Consolidação é idempotente — repetir não duplica BudgetVersion nem regrava a Sessão", async () => {
  const reviewRepository = createFakeBudgetReviewRepository();
  const budgetVersionRepository = createFakeBudgetVersionRepository();
  const procurementCaseRepository = createFakeProcurementCaseRepository();
  const { sessionId, budgetVersionId } = await buildReadySession(reviewRepository, budgetVersionRepository, "b");

  const first = await consolidateBudgetReviewSessionService(
    contextFor(),
    { sessionId },
    reviewRepository,
    budgetVersionRepository,
    procurementCaseRepository,
  );
  if (first.outcome !== "success") throw new Error(`expected first consolidation success: ${JSON.stringify(first)}`);

  const saveCallsAfterFirst = budgetVersionRepository.saveCallCount();

  const second = await consolidateBudgetReviewSessionService(
    contextFor(),
    { sessionId },
    reviewRepository,
    budgetVersionRepository,
    procurementCaseRepository,
  );
  if (second.outcome !== "success") throw new Error(`expected second (no-op) consolidation success: ${JSON.stringify(second)}`);

  assertEqual(budgetVersionRepository.saveCallCount(), saveCallsAfterFirst, "a second consolidation call must never call saveBudgetVersion again — pure no-op recovery");

  const persisted = await budgetVersionRepository.loadBudgetVersion(organizationId, budgetVersionId);
  assertEqual(persisted?.entity.lines.length, 3, "line count must remain exactly the same after a repeated consolidation call — never duplicated");
});

await runTest("Consolidação Lot-scoped carrega a prova real, projeta e persiste sem enfraquecer o domínio", async () => {
  const reviewRepository = createFakeBudgetReviewRepository();
  const budgetVersionRepository = createFakeBudgetVersionRepository();
  const procurementCaseRepository = createFakeProcurementCaseRepository([procurementLot]);
  const { sessionId, budgetVersionId } = await buildReadySession(reviewRepository, budgetVersionRepository, "lot", procurementLot);

  const result = await consolidateBudgetReviewSessionService(
    contextFor(),
    { sessionId },
    reviewRepository,
    budgetVersionRepository,
    procurementCaseRepository,
  );
  if (result.outcome !== "success") throw new Error(`expected Lot consolidation success: ${JSON.stringify(result)}`);

  assertEqual(procurementCaseRepository.lotLookupCallCount(), 1, "Lot consolidation must load its ProcurementLot exactly once");
  assertEqual(
    JSON.stringify(procurementCaseRepository.lastLotLookup()),
    JSON.stringify([organizationId, procurementCase.id, procurementLot.id]),
    "lot lookup must be scoped by organization, case and canonical lot id",
  );

  const persisted = await budgetVersionRepository.loadBudgetVersion(organizationId, budgetVersionId);
  assertEqual(persisted?.entity.status, BudgetVersionStatus.Consolidated, "Lot-scoped BudgetVersion must be persisted Consolidated");
  assertEqual(persisted?.revision, 1, "Lot-scoped BudgetVersion must advance exactly one revision");
  assertEqual(persisted?.entity.lines.length, 3, "Lot-scoped projection must preserve all approved rows");
  assertEqual(result.session.status, BudgetReviewSessionStatus.Consolidated, "Lot-scoped review session must be finalized only after budget persistence");
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function runTest(name: string, testCase: () => Promise<void>): Promise<void> {
  await testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
