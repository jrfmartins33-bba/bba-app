import {
  abandonDocumentProcessingAttempt,
  completeDocumentProcessingAttempt,
  createDocumentArtifact,
  createDocumentProcessingAttempt,
  createDocumentVersion,
  failDocumentProcessingAttempt,
  partiallyCompleteDocumentProcessingAttempt,
  startDocumentProcessingAttempt,
} from "../../domain/document-processing";
import type { DocumentProcessingAttemptResult } from "../../domain/document-processing";
import type { DocumentProcessingApplicationContext } from "./application-context";
import { toInfrastructureErrorMessage } from "./application-context";
import type { DocumentProcessingAttemptRepository } from "./document-processing-attempt.repository";
import type { DocumentRepository } from "./document.repository";
import type { DocumentVersionRepository } from "./document-version.repository";
import type {
  GetDocumentQuery,
  GetDocumentResult,
  GetDocumentVersionQuery,
  GetDocumentVersionResult,
  ListDocumentProcessingAttemptsQuery,
  ListDocumentProcessingAttemptsResult,
  ListDocumentVersionsQuery,
  ListDocumentVersionsResult,
  RegisterDocumentCommand,
  RegisterDocumentResult,
  RegisterDocumentVersionCommand,
  RegisterDocumentVersionResult,
  RequestDocumentProcessingAttemptCommand,
  RequestDocumentProcessingAttemptResult,
  TransitionDocumentProcessingAttemptCommand,
  TransitionDocumentProcessingAttemptResult,
} from "./document-processing-service.types";

export async function registerDocumentService(
  context: DocumentProcessingApplicationContext,
  command: RegisterDocumentCommand,
  repository: DocumentRepository,
): Promise<RegisterDocumentResult> {
  const domainResult = createDocumentArtifact({
    id: crypto.randomUUID(),
    organizationId: context.organizationId,
    context: command.context,
    title: command.title ?? null,
    registeredBy: context.actor,
    registeredAt: nowIso(),
    correlationId: context.correlationId,
    sourceSystem: context.sourceSystem,
    metadata: command.metadata,
  });

  if (!domainResult.success) {
    return { outcome: "domain_error", errors: domainResult.errors };
  }

  try {
    const document = await repository.createDocument(context.organizationId, context.actor, domainResult.document);
    return { outcome: "created", document };
  } catch (error) {
    return { outcome: "persistence_failure", message: toInfrastructureErrorMessage(error) };
  }
}

export async function registerOrReuseDocumentVersionService(
  context: DocumentProcessingApplicationContext,
  command: RegisterDocumentVersionCommand,
  documentRepository: DocumentRepository,
  documentVersionRepository: DocumentVersionRepository,
): Promise<RegisterDocumentVersionResult> {
  const document = await documentRepository.findDocumentById(context.organizationId, command.documentId);

  if (document === null) {
    return { outcome: "document_not_found" };
  }

  const existing = await documentVersionRepository.findDocumentVersionByDocumentAndSha256(
    context.organizationId,
    document.id,
    command.sha256,
  );

  if (existing !== null) {
    return { outcome: "reused", documentVersion: existing };
  }

  const domainResult = createDocumentVersion({
    id: crypto.randomUUID(),
    document,
    sha256: command.sha256,
    originalFileName: command.originalFileName,
    mimeType: command.mimeType,
    sizeBytes: command.sizeBytes,
    storageReference: command.storageReference,
    uploadedBy: context.actor,
    uploadedAt: nowIso(),
    technicalMetadata: command.technicalMetadata,
    correlationId: context.correlationId,
    sourceSystem: context.sourceSystem,
    metadata: command.metadata,
  });

  if (!domainResult.success) {
    return { outcome: "domain_error", errors: domainResult.errors };
  }

  try {
    const documentVersion = await documentVersionRepository.createDocumentVersion(
      context.organizationId,
      context.actor,
      domainResult.documentVersion,
    );
    return { outcome: "created", documentVersion };
  } catch (error) {
    return { outcome: "persistence_failure", message: toInfrastructureErrorMessage(error) };
  }
}

export async function requestDocumentProcessingAttemptService(
  context: DocumentProcessingApplicationContext,
  command: RequestDocumentProcessingAttemptCommand,
  documentVersionRepository: DocumentVersionRepository,
  attemptRepository: DocumentProcessingAttemptRepository,
): Promise<RequestDocumentProcessingAttemptResult> {
  const documentVersion = await documentVersionRepository.findDocumentVersionById(context.organizationId, command.documentVersionId);

  if (documentVersion === null) {
    return { outcome: "document_version_not_found" };
  }

  const existing = await attemptRepository.findDocumentProcessingAttemptByRequestKey(
    context.organizationId,
    documentVersion.id,
    command.requestIdempotencyKey,
  );

  if (existing !== null) {
    return { outcome: "reused", attempt: existing.entity, revision: existing.revision };
  }

  const domainResult = createDocumentProcessingAttempt({
    id: crypto.randomUUID(),
    documentVersion,
    mechanism: command.mechanism,
    mechanismVersion: command.mechanismVersion ?? null,
    requestedAt: nowIso(),
    requestedBy: context.actor,
    requestIdempotencyKey: command.requestIdempotencyKey,
    correlationId: context.correlationId,
    sourceSystem: context.sourceSystem,
    metadata: command.metadata,
  });

  if (!domainResult.success) {
    return { outcome: "domain_error", errors: domainResult.errors };
  }

  try {
    const persisted = await attemptRepository.createDocumentProcessingAttempt(context.organizationId, context.actor, domainResult.attempt);
    return { outcome: "created", attempt: persisted.entity, revision: persisted.revision };
  } catch (error) {
    return { outcome: "persistence_failure", message: toInfrastructureErrorMessage(error) };
  }
}

export async function startDocumentProcessingAttemptService(
  context: DocumentProcessingApplicationContext,
  command: TransitionDocumentProcessingAttemptCommand,
  repository: DocumentProcessingAttemptRepository,
): Promise<TransitionDocumentProcessingAttemptResult> {
  return transitionAttempt(context, command, repository, (commandInput) => startDocumentProcessingAttempt(commandInput));
}

export async function completeDocumentProcessingAttemptService(
  context: DocumentProcessingApplicationContext,
  command: TransitionDocumentProcessingAttemptCommand,
  repository: DocumentProcessingAttemptRepository,
): Promise<TransitionDocumentProcessingAttemptResult> {
  return transitionAttempt(context, command, repository, (commandInput) => completeDocumentProcessingAttempt(commandInput));
}

export async function partiallyCompleteDocumentProcessingAttemptService(
  context: DocumentProcessingApplicationContext,
  command: TransitionDocumentProcessingAttemptCommand,
  repository: DocumentProcessingAttemptRepository,
): Promise<TransitionDocumentProcessingAttemptResult> {
  return transitionAttempt(context, command, repository, (commandInput) => partiallyCompleteDocumentProcessingAttempt(commandInput));
}

export async function failDocumentProcessingAttemptService(
  context: DocumentProcessingApplicationContext,
  command: TransitionDocumentProcessingAttemptCommand,
  repository: DocumentProcessingAttemptRepository,
): Promise<TransitionDocumentProcessingAttemptResult> {
  return transitionAttempt(context, command, repository, (commandInput) => failDocumentProcessingAttempt(commandInput));
}

export async function abandonDocumentProcessingAttemptService(
  context: DocumentProcessingApplicationContext,
  command: TransitionDocumentProcessingAttemptCommand,
  repository: DocumentProcessingAttemptRepository,
): Promise<TransitionDocumentProcessingAttemptResult> {
  return transitionAttempt(context, command, repository, (commandInput) => abandonDocumentProcessingAttempt(commandInput));
}

export async function getDocumentService(
  context: DocumentProcessingApplicationContext,
  query: GetDocumentQuery,
  repository: DocumentRepository,
): Promise<GetDocumentResult> {
  const document = await repository.findDocumentById(context.organizationId, query.documentId);
  return document === null ? { outcome: "not_found" } : { outcome: "found", document };
}

export async function getDocumentVersionService(
  context: DocumentProcessingApplicationContext,
  query: GetDocumentVersionQuery,
  repository: DocumentVersionRepository,
): Promise<GetDocumentVersionResult> {
  const documentVersion = await repository.findDocumentVersionById(context.organizationId, query.documentVersionId);
  return documentVersion === null ? { outcome: "not_found" } : { outcome: "found", documentVersion };
}

export async function listDocumentVersionsService(
  context: DocumentProcessingApplicationContext,
  query: ListDocumentVersionsQuery,
  documentRepository: DocumentRepository,
  documentVersionRepository: DocumentVersionRepository,
): Promise<ListDocumentVersionsResult> {
  const document = await documentRepository.findDocumentById(context.organizationId, query.documentId);

  if (document === null) {
    return { outcome: "document_not_found" };
  }

  try {
    const documentVersions = await documentVersionRepository.listDocumentVersionsByDocument(context.organizationId, document.id);
    return { outcome: "success", documentVersions };
  } catch (error) {
    return { outcome: "persistence_failure", message: toInfrastructureErrorMessage(error) };
  }
}

export async function listDocumentProcessingAttemptsService(
  context: DocumentProcessingApplicationContext,
  query: ListDocumentProcessingAttemptsQuery,
  documentVersionRepository: DocumentVersionRepository,
  attemptRepository: DocumentProcessingAttemptRepository,
): Promise<ListDocumentProcessingAttemptsResult> {
  const documentVersion = await documentVersionRepository.findDocumentVersionById(context.organizationId, query.documentVersionId);

  if (documentVersion === null) {
    return { outcome: "document_version_not_found" };
  }

  try {
    const attempts = await attemptRepository.listDocumentProcessingAttemptsByVersion(context.organizationId, documentVersion.id);
    return { outcome: "success", attempts };
  } catch (error) {
    return { outcome: "persistence_failure", message: toInfrastructureErrorMessage(error) };
  }
}

async function transitionAttempt(
  context: DocumentProcessingApplicationContext,
  command: TransitionDocumentProcessingAttemptCommand,
  repository: DocumentProcessingAttemptRepository,
  transition: (input: Parameters<typeof startDocumentProcessingAttempt>[0]) => DocumentProcessingAttemptResult,
): Promise<TransitionDocumentProcessingAttemptResult> {
  const loaded = await repository.findDocumentProcessingAttemptById(context.organizationId, command.attemptId);

  if (loaded === null) {
    return { outcome: "not_found" };
  }

  const domainResult = transition({
    attempt: loaded.entity,
    occurredAt: nowIso(),
    error: command.error ?? null,
    metadata: command.metadata,
  });

  if (!domainResult.success) {
    return { outcome: "domain_error", errors: domainResult.errors };
  }

  try {
    const saveResult = await repository.saveDocumentProcessingAttempt(
      context.organizationId,
      context.actor,
      domainResult.attempt,
      loaded.revision,
    );

    if (saveResult.outcome === "concurrency_conflict") {
      return { outcome: "concurrency_conflict" };
    }

    return { outcome: "success", attempt: domainResult.attempt, revision: saveResult.revision };
  } catch (error) {
    return { outcome: "persistence_failure", message: toInfrastructureErrorMessage(error) };
  }
}

function nowIso(): string {
  return new Date().toISOString();
}
