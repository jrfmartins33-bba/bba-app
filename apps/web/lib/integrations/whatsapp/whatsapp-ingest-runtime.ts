import type { SupabaseClient } from "@supabase/supabase-js";
import {
  registerDocumentService,
  registerOrReuseDocumentVersionService,
} from "@bba/bdos-core/services/document-processing";
import { WHATSAPP_INGEST_DOCUMENT_CONTEXT, WHATSAPP_SOURCE_SYSTEM } from "@bba/bdos-core/domain/inbound-channel";
import {
  createDocumentRepository,
  createDocumentVersionRepository,
} from "@/lib/bdos/document-processing-server-repository";
import { WhatsAppConfigurationError, type WhatsAppIntegrationConfig } from "./whatsapp-config";
import { createInboundChannelMessageRepository } from "./inbound-channel-message-repository";
import { fetchWhatsAppMedia } from "./whatsapp-media";
import { sha256HexOfString } from "./whatsapp-signature";
import type { DocumentRegistrar, StorageUploader, WhatsAppIngestDeps } from "./whatsapp-ingest-service";

const STORAGE_BUCKET = "bdos-imports";
const DOCUMENT_TITLE = "Comprovante recebido via WhatsApp";

/**
 * Valida server-side que o profile técnico de ingresso existe e pertence
 * à company configurada ANTES de qualquer persistência de documento.
 * Falha explicitamente (erro de configuração) se não.
 */
export async function assertIngestActorConfigured(
  supabase: SupabaseClient,
  params: { actorId: string; companyId: string },
): Promise<void> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, company_id")
    .eq("id", params.actorId)
    .maybeSingle();

  if (error) {
    throw new WhatsAppConfigurationError(`não foi possível validar o actor de ingresso: ${error.message}`);
  }
  if (!data) {
    throw new WhatsAppConfigurationError("WHATSAPP_INGEST_ACTOR_ID não corresponde a nenhum profile.");
  }
  if ((data as { company_id: string | null }).company_id !== params.companyId) {
    throw new WhatsAppConfigurationError(
      "WHATSAPP_INGEST_ACTOR_ID pertence a outra empresa; deve pertencer a WHATSAPP_TEST_COMPANY_ID.",
    );
  }
}

function createStorageUploader(supabase: SupabaseClient): StorageUploader {
  return {
    async upload({ path, bytes, contentType }) {
      const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, bytes, {
        contentType,
        upsert: false,
      });
      if (!error) {
        return { outcome: "uploaded" };
      }
      const status = (error as { statusCode?: string | number }).statusCode;
      const message = (error.message ?? "").toLowerCase();
      if (String(status) === "409" || message.includes("already exists") || message.includes("duplicate")) {
        return { outcome: "already_exists" };
      }
      return { outcome: "transient_error", reason: "upload_failed" };
    },
  };
}

function createDocumentRegistrar(
  supabase: SupabaseClient,
  config: WhatsAppIntegrationConfig,
): DocumentRegistrar {
  const documentRepository = createDocumentRepository(supabase);
  const documentVersionRepository = createDocumentVersionRepository(supabase);
  const baseContext = {
    organizationId: config.companyId,
    actor: config.ingestActorId,
    sourceSystem: WHATSAPP_SOURCE_SYSTEM,
  } as const;

  return {
    async registerDocument({ correlationId, metadata }) {
      const result = await registerDocumentService(
        { ...baseContext, correlationId },
        { context: WHATSAPP_INGEST_DOCUMENT_CONTEXT, title: DOCUMENT_TITLE, metadata },
        documentRepository,
      );
      if (result.outcome === "created") {
        return { outcome: "created", documentId: result.document.id };
      }
      return { outcome: "transient_error", reason: result.outcome };
    },

    async registerVersion(input) {
      const result = await registerOrReuseDocumentVersionService(
        { ...baseContext, correlationId: input.correlationId },
        {
          documentId: input.documentId,
          sha256: input.sha256,
          originalFileName: input.originalFileName,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          storageReference: input.storageReference,
          technicalMetadata: input.technicalMetadata,
          metadata: input.metadata,
        },
        documentRepository,
        documentVersionRepository,
      );
      if (result.outcome === "created" || result.outcome === "reused") {
        return { outcome: result.outcome, documentVersionId: result.documentVersion.id };
      }
      return { outcome: "transient_error", reason: result.outcome };
    },
  };
}

export function buildWhatsAppIngestDeps(
  supabase: SupabaseClient,
  config: WhatsAppIntegrationConfig,
): WhatsAppIngestDeps {
  return {
    repo: createInboundChannelMessageRepository(supabase),
    companyId: config.companyId,
    engineeringProjectId: config.projectId,
    fetchMedia: (mediaId) =>
      fetchWhatsAppMedia(mediaId, {
        accessToken: config.accessToken,
        graphVersion: config.graphVersion,
        phoneNumberId: config.phoneNumberId,
      }),
    storage: createStorageUploader(supabase),
    documents: createDocumentRegistrar(supabase, config),
    sha256HexOfString,
  };
}
