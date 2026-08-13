import { createHash } from "node:crypto";
import {
  importBudgetFromXlsx,
  rawDecimalFractionToPercentText,
} from "../../domain/budget-official-review/adapters/xlsx-import";
import type {
  BudgetXlsxDiagnosticSeverity,
  BudgetXlsxImportDiagnostic,
  BudgetXlsxImportSummary,
} from "../../domain/budget-official-review/adapters/xlsx-import";
import { BUDGET_XLSX_IMPORTER_VERSION } from "../../domain/budget-official-review/adapters/xlsx-import/budget-xlsx-importer.types";
import {
  createBudgetReviewSession,
  importBudgetReviewRows,
  calculateOfficialBudgetTotalText,
} from "../../domain/budget-official-review";
import type { BudgetReviewRow, BudgetReviewSession } from "../../domain/budget-official-review";
import {
  BudgetVersionOriginKind,
  createBudgetVersion,
} from "../../domain/budget-version";
import type { BudgetVersion } from "../../domain/budget-version";
import {
  createDocumentArtifact,
  createDocumentVersion,
} from "../../domain/document-processing";
import type { DocumentArtifact, DocumentVersion } from "../../domain/document-processing";
import { ProcurementScopeKind } from "../../domain/procurement-case";
import type { ProcurementCase, ProcurementLot } from "../../domain/procurement-case";
import type { BudgetVersionRepository } from "../procurement-engineering/budget-version.repository";
import type { ProcurementCaseRepository } from "../procurement-engineering/procurement-case.repository";
import type { DocumentRepository } from "../document-processing/document.repository";
import type { DocumentVersionRepository } from "../document-processing/document-version.repository";
import type { ApplicationContext } from "./application-context";
import { toInfrastructureErrorMessage } from "./application-context";
import type { BudgetReviewRepository } from "./budget-review.repository";
import { readXlsxWorkbookRaw } from "../../domain/schedule-management/adapters/excel-import/xlsx-reader";

// ---------------------------------------------------------------------------
// Service Command & Result Types
// ---------------------------------------------------------------------------

export interface ImportStructuredBudgetXlsxCommand {
  readonly procurementCaseId: string;
  readonly procurementLotId: string;
  readonly fileBytes: Uint8Array;
  readonly originalFileName: string;
  readonly storageReference: string;
  readonly mimeType?: string;
  readonly sizeBytes?: number;
  readonly sha256?: string;
}

export type ImportStructuredBudgetXlsxOutcome =
  | "success"
  | "domain_error"
  | "importer_error"
  | "not_found"
  | "unauthorized"
  | "persistence_failure";

export interface ImportStructuredBudgetXlsxResult {
  readonly outcome: ImportStructuredBudgetXlsxOutcome;
  readonly idempotentReuse?: boolean;
  readonly reviewSessionId?: string;
  readonly budgetVersionId?: string;
  readonly documentVersionId?: string;
  readonly procurementCaseId?: string;
  readonly procurementLotId?: string;
  readonly rowCount?: number;
  readonly summary?: BudgetXlsxImportSummary;
  readonly officialBudgetTotalText?: string;
  readonly diagnostics?: ReadonlyArray<BudgetXlsxImportDiagnostic>;
  readonly message?: string;
  readonly errors?: ReadonlyArray<string>;
}

export interface ImportStructuredBudgetXlsxRepositories {
  readonly procurementCaseRepository: ProcurementCaseRepository;
  readonly documentRepository: DocumentRepository;
  readonly documentVersionRepository: DocumentVersionRepository;
  readonly budgetVersionRepository: BudgetVersionRepository;
  readonly reviewRepository: BudgetReviewRepository;
}

function nowIso(): string {
  return new Date().toISOString();
}

function computeSha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

// ---------------------------------------------------------------------------
// Application Service Implementation
// ---------------------------------------------------------------------------

/**
 * Sprint 21.5C.1 — Serviço de Aplicação Orquestrador de Importação XLSX.
 *
 * Conecta o importador XLSX determinístico (`BudgetXlsxImporter`) aos
 * repositórios de domínio:
 * 1. Valida o processo de licitação e lote (escopo Lot, pertencentes à organização);
 * 2. Valida/reutiliza o DocumentArtifact e DocumentVersion (idempotência por SHA-256);
 * 3. Valida se a Sessão de Revisão para este SHA-256 + mecanismo já existe (idempotência);
 * 4. Executa o importador XLSX determinístico em memória;
 * 5. Cria a `BudgetVersion` Draft com escopo `Lot` para o lote indicado;
 * 6. Cria a `BudgetReviewSession` (status `InProgress`, `acquisitionMechanism = "xlsx_structured_import"`);
 * 7. Importa as linhas candidatas (todas inicialmente `Pendente`);
 * 8. Persiste via repositórios de produção.
 */
export async function importStructuredBudgetXlsxService(
  context: ApplicationContext,
  command: ImportStructuredBudgetXlsxCommand,
  repositories: ImportStructuredBudgetXlsxRepositories,
): Promise<ImportStructuredBudgetXlsxResult> {
  const {
    procurementCaseRepository,
    documentRepository,
    documentVersionRepository,
    budgetVersionRepository,
    reviewRepository,
  } = repositories;

  // 1. Calculate SHA-256 and Validate Storage Reference
  const sha256 = command.sha256 ?? computeSha256(command.fileBytes);
  const mimeType = command.mimeType ?? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const sizeBytes = command.sizeBytes ?? command.fileBytes.length;

  if (!command.storageReference || command.storageReference.trim().length === 0) {
    return {
      outcome: "domain_error",
      errors: ["A referência de armazenamento real (storageReference) é obrigatória e deve ser fornecida após a confirmação do upload no Storage."],
    };
  }

  // 2. Validate ProcurementCase and ProcurementLot
  let procurementCase: ProcurementCase | null = null;
  let procurementLot: ProcurementLot | null = null;

  try {
    procurementCase = await procurementCaseRepository.findProcurementCaseById(
      context.organizationId,
      command.procurementCaseId,
    );
  } catch (error) {
    return { outcome: "persistence_failure", message: toInfrastructureErrorMessage(error) };
  }

  if (procurementCase === null) {
    return { outcome: "not_found", message: `Processo de licitação "${command.procurementCaseId}" não encontrado.` };
  }

  try {
    procurementLot = await procurementCaseRepository.findProcurementLotById(
      context.organizationId,
      command.procurementCaseId,
      command.procurementLotId,
    );
  } catch (error) {
    return { outcome: "persistence_failure", message: toInfrastructureErrorMessage(error) };
  }

  if (procurementLot === null) {
    return { outcome: "not_found", message: `Lote "${command.procurementLotId}" não encontrado para o processo.` };
  }

function computeSummaryFromRows(rows: ReadonlyArray<{ kind: string }>): BudgetXlsxImportSummary {
  const groupCount = rows.filter((r) => r.kind === "Group").length;
  const subgroupCount = rows.filter((r) => r.kind === "Subgroup").length;
  const serviceItemCount = rows.filter((r) => r.kind === "ServiceItem").length;
  return {
    groupCount,
    subgroupCount,
    serviceItemCount,
    totalRowCount: rows.length,
    skippedRowCount: 0,
    orphanCount: 0,
    sheetName: null,
    headerRowNumber: null,
  };
}

  // 3. Check for existing idempotent BudgetReviewSession (Lot-scoped)
  try {
    const existingSession = await reviewRepository.findSessionByAcquisition(
      context.organizationId,
      command.procurementCaseId,
      sha256,
      "xlsx_structured_import",
      command.procurementLotId,
    );

    if (existingSession !== null) {
      return {
        outcome: "success",
        idempotentReuse: true,
        reviewSessionId: existingSession.id,
        budgetVersionId: existingSession.budgetVersionId,
        documentVersionId: existingSession.documentVersionId,
        procurementCaseId: command.procurementCaseId,
        procurementLotId: command.procurementLotId,
        rowCount: existingSession.rows.length,
        summary: computeSummaryFromRows(existingSession.rows),
        officialBudgetTotalText: calculateOfficialBudgetTotalText(existingSession.rows),
      };
    }
  } catch (error) {
    return { outcome: "persistence_failure", message: toInfrastructureErrorMessage(error) };
  }

  // 4. Register or Reuse DocumentArtifact and DocumentVersion (Lot-scoped Artifact)
  let documentVersion: DocumentVersion;
  try {
    // Identity of DocumentArtifact is stable by Lot ID or Case ID (valid UUIDs)
    const docArtifactId = command.procurementLotId || command.procurementCaseId;

    const docArtifactTitle = command.procurementLotId
      ? `Orçamento Oficial - ${procurementLot.title}`
      : `Orçamento Oficial - ${procurementCase.title}`;

    let documentArtifact = await documentRepository.findDocumentById(context.organizationId, docArtifactId);

    if (documentArtifact === null) {
      const docResult = createDocumentArtifact({
        id: docArtifactId,
        organizationId: context.organizationId,
        context: command.procurementCaseId,
        title: docArtifactTitle,
        registeredBy: context.actor,
        registeredAt: nowIso(),
      });

      if (!docResult.success) {
        return { outcome: "domain_error", errors: docResult.errors.map((e) => e.message) };
      }

      documentArtifact = await documentRepository.createDocument(
        context.organizationId,
        context.actor,
        docResult.document,
      );
    }

    // Register or reuse DocumentVersion by SHA-256 with real storageReference
    const storageRef = command.storageReference.trim();

    const versionDomainResult = createDocumentVersion({
      id: crypto.randomUUID(),
      document: documentArtifact,
      sha256,
      originalFileName: command.originalFileName,
      mimeType,
      sizeBytes,
      storageReference: storageRef,
      uploadedBy: context.actor,
      uploadedAt: nowIso(),
    });

    if (!versionDomainResult.success) {
      return { outcome: "domain_error", errors: versionDomainResult.errors.map((e) => e.message) };
    }

    const versionPersistResult = await documentVersionRepository.createOrReuseDocumentVersion(
      context.organizationId,
      context.actor,
      versionDomainResult.documentVersion,
    );

    documentVersion = versionPersistResult.documentVersion;
  } catch (error) {
    return { outcome: "persistence_failure", message: toInfrastructureErrorMessage(error) };
  }

  // 5. Parse XLSX and execute deterministic importer
  let workbook;
  try {
    workbook = readXlsxWorkbookRaw(command.fileBytes);
  } catch (error) {
    return {
      outcome: "importer_error",
      message: `Falha ao ler arquivo XLSX: ${toInfrastructureErrorMessage(error)}`,
    };
  }

  const importResult = importBudgetFromXlsx(workbook, {
    lotReference: procurementLot.title,
    sourceFileName: command.originalFileName,
    sourceSha256: sha256,
    importerVersion: BUDGET_XLSX_IMPORTER_VERSION,
  });

  const hasErrors = importResult.diagnostics.some((d) => d.severity === "error");
  if (hasErrors || importResult.rows.length === 0) {
    return {
      outcome: "importer_error",
      summary: importResult.summary,
      diagnostics: importResult.diagnostics,
      message: "Importador XLSX retornou erro estrutural.",
    };
  }

  // 6. Create Draft BudgetVersion (Scope: Lot)
  let draftBudgetVersion: BudgetVersion;
  try {
    const budgetVersionDomainResult = createBudgetVersion({
      id: crypto.randomUUID(),
      procurementCase,
      procurementLot,
      scope: {
        kind: ProcurementScopeKind.Lot,
        procurementCaseId: procurementCase.id,
        procurementLotId: procurementLot.id,
      },
      origin: {
        kind: BudgetVersionOriginKind.DocumentaryOpaqueReference,
        reference: sha256,
      },
      metadata: {
        sourceFileName: command.originalFileName,
        importerVersion: BUDGET_XLSX_IMPORTER_VERSION,
      },
    });

    if (!budgetVersionDomainResult.success) {
      return { outcome: "domain_error", errors: budgetVersionDomainResult.errors.map((e) => e.message) };
    }

    const saveDraftResult = await budgetVersionRepository.createDraftBudgetVersion(
      context.organizationId,
      context.actor,
      budgetVersionDomainResult.budgetVersion,
    );

    draftBudgetVersion = saveDraftResult.entity;
  } catch (error) {
    return { outcome: "persistence_failure", message: toInfrastructureErrorMessage(error) };
  }

  // 7. Create BudgetReviewSession (Status: InProgress)
  let reviewSession: BudgetReviewSession;
  try {
    const sessionDomainResult = createBudgetReviewSession({
      id: crypto.randomUUID(),
      procurementCase,
      procurementLotId: command.procurementLotId,
      budgetVersion: draftBudgetVersion,
      documentVersion,
      sourceSha256: sha256,
      acquisitionMechanism: "xlsx_structured_import",
      acquisitionMechanismVersion: BUDGET_XLSX_IMPORTER_VERSION,
      createdBy: context.actor,
      createdAt: nowIso(),
    });

    if (!sessionDomainResult.success) {
      return { outcome: "domain_error", errors: sessionDomainResult.errors.map((e) => `${e.field}: ${e.message}`) };
    }

    const createSessionResult = await reviewRepository.createSession(
      context.organizationId,
      context.actor,
      sessionDomainResult.session,
    );

    if (createSessionResult.outcome === "reused") {
      const reloaded = await reviewRepository.loadSession(context.organizationId, createSessionResult.sessionId);
      if (reloaded !== null) {
        return {
          outcome: "success",
          idempotentReuse: true,
          reviewSessionId: reloaded.id,
          budgetVersionId: reloaded.budgetVersionId,
          documentVersionId: reloaded.documentVersionId,
          procurementCaseId: command.procurementCaseId,
          procurementLotId: command.procurementLotId,
          rowCount: reloaded.rows.length,
          summary: computeSummaryFromRows(reloaded.rows),
        };
      }
    }

    reviewSession = sessionDomainResult.session;
  } catch (error) {
    return { outcome: "persistence_failure", message: toInfrastructureErrorMessage(error) };
  }

  // 8. Import Rows as Pending
  let importedRows: ReadonlyArray<BudgetReviewRow> = [];
  try {
    const occurredAt = nowIso();
    const rowsDomainResult = importBudgetReviewRows({
      session: reviewSession,
      rows: importResult.rows,
      actor: context.actor,
      occurredAt,
    });

    if (!rowsDomainResult.success) {
      return { outcome: "domain_error", errors: rowsDomainResult.errors.map((e) => `${e.field}: ${e.message}`) };
    }

    importedRows = rowsDomainResult.session.rows;

    await reviewRepository.importRows(
      context.organizationId,
      context.actor,
      reviewSession.id,
      importedRows,
      occurredAt,
    );
  } catch (error) {
    return { outcome: "persistence_failure", message: toInfrastructureErrorMessage(error) };
  }

  // 9. Return Successful Result
  return {
    outcome: "success",
    idempotentReuse: false,
    reviewSessionId: reviewSession.id,
    budgetVersionId: draftBudgetVersion.id,
    documentVersionId: documentVersion.id,
    procurementCaseId: command.procurementCaseId,
    procurementLotId: command.procurementLotId,
    rowCount: importResult.rows.length,
    summary: importResult.summary,
    officialBudgetTotalText: calculateOfficialBudgetTotalText(importedRows),
    diagnostics: importResult.diagnostics,
  };
}
