import {
  buildWhatsAppEvidenceStoragePath,
  deriveMessageKeyHash,
  INBOUND_CHANNEL_WHATSAPP,
  WHATSAPP_INGEST_DOCUMENT_CONTEXT,
  WHATSAPP_SOURCE_SYSTEM,
  type ParsedWhatsAppImageMessage,
} from "@bba/bdos-core/domain/inbound-channel";
import type { InboundChannelMessageRepository, InboundChannelMessageRow } from "./inbound-channel-message-repository";
import type { WhatsAppMediaResult } from "./whatsapp-media";

/**
 * Orquestração da Fatia A: mensagem de imagem já autorizada → mídia
 * original preservada com integridade e rastreabilidade. Termina em
 * "Documento recebido e preservado".
 *
 * Recuperável após falha parcial: o ledger guarda `document_id` /
 * `document_version_id` assim que existem; um retry reutiliza tudo.
 *
 * NÃO faz OCR, visão, LLM, leitura de valor, Centro de Custo, rateio,
 * aprovação, custo real, resposta ao WhatsApp.
 */

export type WhatsAppIngestOutcome =
  | { readonly http: 200; readonly outcome: "preserved"; readonly documentId: string; readonly documentVersionId: string }
  | { readonly http: 200; readonly outcome: "already_preserved" }
  | { readonly http: 200; readonly outcome: "in_progress" }
  | { readonly http: 200; readonly outcome: "unsupported_media" }
  | { readonly http: 200; readonly outcome: "too_large" }
  | { readonly http: 500; readonly outcome: "transient_error"; readonly reason: string };

export interface StorageUploader {
  upload(input: {
    path: string;
    bytes: Uint8Array;
    contentType: "image/jpeg" | "image/png";
  }): Promise<{ outcome: "uploaded" | "already_exists" | "transient_error"; reason?: string }>;
}

export interface DocumentRegistrar {
  registerDocument(input: {
    correlationId: string;
    metadata: Record<string, unknown>;
  }): Promise<{ outcome: "created" | "transient_error"; documentId?: string; reason?: string }>;
  registerVersion(input: {
    documentId: string;
    sha256: string;
    originalFileName: string;
    mimeType: "image/jpeg" | "image/png";
    sizeBytes: number;
    storageReference: string;
    correlationId: string;
    technicalMetadata: Record<string, unknown>;
    metadata: Record<string, unknown>;
  }): Promise<{ outcome: "created" | "reused" | "transient_error"; documentVersionId?: string; reason?: string }>;
}

export interface WhatsAppIngestDeps {
  readonly repo: InboundChannelMessageRepository;
  readonly companyId: string;
  readonly engineeringProjectId: string;
  readonly fetchMedia: (mediaId: string) => Promise<WhatsAppMediaResult>;
  readonly storage: StorageUploader;
  readonly documents: DocumentRegistrar;
  readonly sha256HexOfString: (input: string) => string;
  readonly now?: () => string;
}

export async function ingestWhatsAppImage(
  message: ParsedWhatsAppImageMessage,
  deps: WhatsAppIngestDeps,
): Promise<WhatsAppIngestOutcome> {
  const now = deps.now ?? (() => new Date().toISOString());
  const receivedAt = toIsoFromWhatsAppTimestamp(message.providerTimestamp) ?? now();

  const messageKeyHash = deriveMessageKeyHash(
    message.phoneNumberId,
    message.providerMessageId,
    deps.sha256HexOfString,
  );

  // 1. CLAIM — identidade de ingresso única.
  const claim = await deps.repo.claim({
    companyId: deps.companyId,
    engineeringProjectId: deps.engineeringProjectId,
    providerAccountId: message.phoneNumberId,
    providerMessageId: message.providerMessageId,
    providerMediaId: message.mediaId,
    senderExternalId: message.senderWaId,
    messageType: "image",
    receivedAt,
    metadata: { channel: INBOUND_CHANNEL_WHATSAPP, messageKeyHash },
  });

  if (claim.outcome === "already_preserved") {
    return { http: 200, outcome: "already_preserved" };
  }
  if (claim.outcome === "in_progress") {
    return { http: 200, outcome: "in_progress" };
  }

  const row = claim.row;

  // Recuperação: já preservado tudo, só faltou finalizar o status.
  if (row.document_id && row.document_version_id) {
    await deps.repo.markPreserved(row.id, {
      documentId: row.document_id,
      documentVersionId: row.document_version_id,
    });
    return { http: 200, outcome: "already_preserved" };
  }

  // 2. DOWNLOAD da mídia (dois GETs autenticados; nunca a URL do webhook).
  const media = await deps.fetchMedia(message.mediaId);
  if (media.outcome === "too_large") {
    await deps.repo.markFailed(row.id, { errorCode: "media_too_large" });
    return { http: 200, outcome: "too_large" };
  }
  if (media.outcome === "unsupported_media") {
    await deps.repo.markFailed(row.id, { errorCode: "media_unsupported_content" });
    return { http: 200, outcome: "unsupported_media" };
  }
  if (media.outcome === "transient_error") {
    await deps.repo.markFailed(row.id, { errorCode: `media_${media.reason}` });
    return { http: 500, outcome: "transient_error", reason: media.reason };
  }

  // 3. STORAGE — path determinístico (hash da chave, nunca o id cru).
  const storagePath = buildWhatsAppEvidenceStoragePath({
    companyId: deps.companyId,
    engineeringProjectId: deps.engineeringProjectId,
    messageKeyHash,
    contentSha256: media.sha256,
    mimeType: media.mimeType,
  });

  const upload = await deps.storage.upload({ path: storagePath, bytes: media.bytes, contentType: media.mimeType });
  if (upload.outcome === "transient_error") {
    await deps.repo.markFailed(row.id, { errorCode: `storage_${upload.reason ?? "upload_failed"}` });
    return { http: 500, outcome: "transient_error", reason: upload.reason ?? "storage_upload_failed" };
  }
  // "already_exists" = reutilização controlada (o path inclui o SHA do conteúdo).

  const traceMetadata: Record<string, unknown> = {
    engineeringProjectId: deps.engineeringProjectId,
    channel: INBOUND_CHANNEL_WHATSAPP,
    providerAccountId: message.phoneNumberId,
    providerMessageId: message.providerMessageId,
    providerMediaId: message.mediaId,
    senderWaId: message.senderWaId,
    providerTimestamp: message.providerTimestamp,
  };

  // 4. DOCUMENTARTIFACT — reutiliza se já existir no ledger.
  let documentId = row.document_id;
  if (!documentId) {
    const created = await deps.documents.registerDocument({
      correlationId: message.providerMessageId,
      metadata: traceMetadata,
    });
    if (created.outcome === "transient_error" || !created.documentId) {
      await deps.repo.markFailed(row.id, { errorCode: `document_${created.reason ?? "register_failed"}` });
      return { http: 500, outcome: "transient_error", reason: created.reason ?? "document_register_failed" };
    }
    documentId = created.documentId;
    // Ponto de recuperação: grava document_id no ledger ASSIM QUE existe.
    await deps.repo.attachDocument(row.id, { documentId });
  }

  // 5. DOCUMENTVERSION — idempotente por (company, document, sha256).
  const version = await deps.documents.registerVersion({
    documentId,
    sha256: media.sha256,
    originalFileName: media.mimeType === "image/png" ? "whatsapp-image.png" : "whatsapp-image.jpg",
    mimeType: media.mimeType,
    sizeBytes: media.sizeBytes,
    storageReference: storagePath,
    correlationId: message.providerMessageId,
    technicalMetadata: {
      channel: INBOUND_CHANNEL_WHATSAPP,
      providerMediaId: message.mediaId,
      messageKeyHash,
      providerMimeType: message.declaredMimeType,
      providerSha256: media.providerSha256,
    },
    metadata: traceMetadata,
  });
  if (version.outcome === "transient_error" || !version.documentVersionId) {
    await deps.repo.attachDocument(row.id, { documentId });
    await deps.repo.markFailed(row.id, { errorCode: `version_${version.reason ?? "register_failed"}` });
    return { http: 500, outcome: "transient_error", reason: version.reason ?? "version_register_failed" };
  }

  // 6. FINALIZAÇÃO.
  await deps.repo.markPreserved(row.id, { documentId, documentVersionId: version.documentVersionId });
  return { http: 200, outcome: "preserved", documentId, documentVersionId: version.documentVersionId };
}

/** WhatsApp manda timestamp em segundos (string). Converte para ISO; null se inválido. */
export function toIsoFromWhatsAppTimestamp(value: string): string | null {
  if (!/^\d{1,15}$/.test(value)) return null;
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

export const WHATSAPP_INGEST_DOCUMENT_CONTEXT_VALUE = WHATSAPP_INGEST_DOCUMENT_CONTEXT;
export const WHATSAPP_INGEST_SOURCE_SYSTEM_VALUE = WHATSAPP_SOURCE_SYSTEM;
