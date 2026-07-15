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
    async createDocumentVersion(organizationId, actor, documentVersion) {
      const { data, error } = await supabase.rpc(
        "create_document_version",
        documentVersionCreateRpcParams(organizationId, actor, documentVersion),
      );

      if (error || !data) {
        throw error ?? new Error("Failed to persist the Document Version.");
      }

      return documentVersion;
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
    async createDocumentProcessingAttempt(organizationId, actor, attempt) {
      const { data, error } = await supabase.rpc(
        "create_document_processing_attempt",
        documentProcessingAttemptCreateRpcParams(organizationId, actor, attempt),
      );

      if (error || !data) {
        throw error ?? new Error("Failed to persist the Document Processing Attempt.");
      }

      if (typeof data.revision !== "number") {
        throw new Error("create_document_processing_attempt did not return a numeric revision.");
      }

      return { entity: attempt, revision: data.revision };
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
