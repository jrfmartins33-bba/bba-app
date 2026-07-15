import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DocumentProcessingAttemptRepository,
  DocumentRepository,
  DocumentVersionRepository,
  SaveDocumentProcessingAttemptResult,
} from "@bba/bdos-core/services/document-processing";
import {
  documentArtifactCreateRpcParams,
  documentProcessingAttemptCreateRpcParams,
  documentProcessingAttemptTransitionRpcParams,
  documentVersionCreateRpcParams,
  mapDocumentArtifactRow,
  mapDocumentProcessingAttemptRow,
  mapDocumentVersionRow,
  type DocumentProcessingAttemptRow,
  type DocumentVersionRow,
} from "./document-processing-mappers";

const DOCUMENT_COLUMNS = "id, company_id, document_context, title, registered_by, registered_at, metadata";
const DOCUMENT_VERSION_COLUMNS =
  "id, company_id, document_id, sha256, original_file_name, mime_type, size_bytes, storage_reference, uploaded_by, uploaded_at, technical_metadata, metadata";
const ATTEMPT_COLUMNS =
  "id, company_id, document_version_id, status, mechanism, mechanism_version, requested_at, started_at, finished_at, error, partial_processing, request_idempotency_key, requested_by, revision, metadata";

export function createDocumentRepository(supabase: SupabaseClient): DocumentRepository {
  return {
    async createDocument(organizationId, actor, document) {
      const { data, error } = await supabase.rpc(
        "create_document_artifact",
        documentArtifactCreateRpcParams(organizationId, actor, document),
      );

      if (error || !data) {
        throw error ?? new Error("Failed to persist the Document artifact.");
      }

      return document;
    },

    async findDocumentById(organizationId, id) {
      const { data, error } = await supabase
        .from("document_artifacts")
        .select(DOCUMENT_COLUMNS)
        .eq("company_id", organizationId)
        .eq("id", id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data === null ? null : mapDocumentArtifactRow(data);
    },
  };
}

export function createDocumentVersionRepository(supabase: SupabaseClient): DocumentVersionRepository {
  return {
    async createOrReuseDocumentVersion(organizationId, actor, documentVersion) {
      const { data, error } = await supabase.rpc(
        "create_document_version",
        documentVersionCreateRpcParams(organizationId, actor, documentVersion),
      );

      if (error || !data) {
        throw error ?? new Error("Failed to persist the Document Version.");
      }

      const outcome = readCreatedOrReusedOutcome(data, "create_document_version");
      const persistedRow = readRpcRecordField<DocumentVersionRow>(data, "document_version", "create_document_version");
      return { outcome, documentVersion: mapDocumentVersionRow(persistedRow) };
    },

    async findDocumentVersionById(organizationId, id) {
      const { data, error } = await supabase
        .from("document_versions")
        .select(DOCUMENT_VERSION_COLUMNS)
        .eq("company_id", organizationId)
        .eq("id", id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data === null ? null : mapDocumentVersionRow(data);
    },

    async findDocumentVersionByDocumentAndSha256(organizationId, documentId, sha256) {
      const { data, error } = await supabase
        .from("document_versions")
        .select(DOCUMENT_VERSION_COLUMNS)
        .eq("company_id", organizationId)
        .eq("document_id", documentId)
        .eq("sha256", sha256)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data === null ? null : mapDocumentVersionRow(data);
    },

    async listDocumentVersionsByDocument(organizationId, documentId) {
      const { data, error } = await supabase
        .from("document_versions")
        .select(DOCUMENT_VERSION_COLUMNS)
        .eq("company_id", organizationId)
        .eq("document_id", documentId)
        .order("uploaded_at", { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []).map(mapDocumentVersionRow);
    },
  };
}

export function createDocumentProcessingAttemptRepository(supabase: SupabaseClient): DocumentProcessingAttemptRepository {
  return {
    async createOrReuseDocumentProcessingAttempt(organizationId, actor, attempt) {
      const { data, error } = await supabase.rpc(
        "create_document_processing_attempt",
        documentProcessingAttemptCreateRpcParams(organizationId, actor, attempt),
      );

      if (error || !data) {
        throw error ?? new Error("Failed to persist the Document Processing Attempt.");
      }

      const outcome = readCreatedOrReusedOutcome(data, "create_document_processing_attempt");
      const persistedRow = readRpcRecordField<DocumentProcessingAttemptRow>(
        data,
        "document_processing_attempt",
        "create_document_processing_attempt",
      );
      return { outcome, persisted: mapDocumentProcessingAttemptRow(persistedRow) };
    },

    async findDocumentProcessingAttemptById(organizationId, id) {
      const { data, error } = await supabase
        .from("document_processing_attempts")
        .select(ATTEMPT_COLUMNS)
        .eq("company_id", organizationId)
        .eq("id", id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data === null ? null : mapDocumentProcessingAttemptRow(data);
    },

    async findDocumentProcessingAttemptByRequestKey(organizationId, documentVersionId, requestIdempotencyKey) {
      const { data, error } = await supabase
        .from("document_processing_attempts")
        .select(ATTEMPT_COLUMNS)
        .eq("company_id", organizationId)
        .eq("document_version_id", documentVersionId)
        .eq("request_idempotency_key", requestIdempotencyKey)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data === null ? null : mapDocumentProcessingAttemptRow(data);
    },

    async listDocumentProcessingAttemptsByVersion(organizationId, documentVersionId) {
      const { data, error } = await supabase
        .from("document_processing_attempts")
        .select(ATTEMPT_COLUMNS)
        .eq("company_id", organizationId)
        .eq("document_version_id", documentVersionId)
        .order("requested_at", { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []).map(mapDocumentProcessingAttemptRow);
    },

    async saveDocumentProcessingAttempt(organizationId, actor, attempt, expectedRevision): Promise<SaveDocumentProcessingAttemptResult> {
      const { data, error } = await supabase.rpc(
        "transition_document_processing_attempt",
        documentProcessingAttemptTransitionRpcParams(organizationId, actor, attempt, expectedRevision),
      );

      if (error || !data) {
        throw error ?? new Error("Failed to persist the Document Processing Attempt transition.");
      }

      if (data.conflict) {
        return { outcome: "concurrency_conflict" };
      }

      if (typeof data.revision !== "number") {
        throw new Error("transition_document_processing_attempt did not return a numeric revision on success.");
      }

      return { outcome: "saved", revision: data.revision };
    },
  };
}

function readCreatedOrReusedOutcome(data: unknown, functionName: string): "created" | "reused" {
  const outcome = readRpcRecord(data, functionName).outcome;

  if (outcome === "created" || outcome === "reused") {
    return outcome;
  }

  throw new Error(`${functionName} did not return a created/reused outcome.`);
}

function readRpcRecordField<T>(data: unknown, field: string, functionName: string): T {
  const value = readRpcRecord(data, functionName)[field];

  if (isRecord(value)) {
    return value as T;
  }

  throw new Error(`${functionName} did not return ${field}.`);
}

function readRpcRecord(data: unknown, functionName: string): Record<string, unknown> {
  if (isRecord(data)) {
    return data;
  }

  throw new Error(`${functionName} returned an invalid payload.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
