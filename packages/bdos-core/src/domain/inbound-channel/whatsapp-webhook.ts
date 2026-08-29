/**
 * WhatsApp Cloud API — lógica PURA do webhook de ingresso (Fatia A).
 *
 * Sem I/O, sem crypto, sem rede. Recebe:
 *   - o corpo JÁ desserializado do webhook (a validação de assinatura HMAC
 *     sobre o RAW body acontece ANTES, no adaptador do servidor);
 *   - a configuração de ingresso (só ENV no servidor);
 * e decide, deterministicamente, se a mensagem deve ser preservada como
 * evidência ou ignorada.
 *
 * NÃO faz: OCR, visão, LLM, leitura de valor, fornecedor, Centro de Custo,
 * rateio, resposta ao WhatsApp. Isso é Fatia B/C.
 */

import type { InboundWhatsAppMessageType } from "./inbound-channel.types";

/** Contexto documental desta integração (document_artifacts.document_context). */
export const WHATSAPP_INGEST_DOCUMENT_CONTEXT = "project-cost-evidence";
/** sourceSystem do DocumentArtifact/DocumentVersion. */
export const WHATSAPP_SOURCE_SYSTEM = "whatsapp-cloud-api";

/** MVP: só imagens JPEG/PNG. */
export const WHATSAPP_ALLOWED_MIME_TYPES: ReadonlyArray<string> = ["image/jpeg", "image/png"];
/** Limite real de 5 MB. */
export const WHATSAPP_MAX_MEDIA_BYTES = 5 * 1024 * 1024;

// ---------------------------------------------------------------------------
// 1. Verificação da subscrição (GET)
// ---------------------------------------------------------------------------

export interface WhatsAppSubscriptionQuery {
  readonly mode: string | null;
  readonly token: string | null;
  readonly challenge: string | null;
}

export type WhatsAppSubscriptionResult =
  | { readonly outcome: "verified"; readonly challenge: string }
  | { readonly outcome: "forbidden" };

/**
 * Retorna EXATAMENTE o challenge só quando `hub.mode === "subscribe"` e o
 * token bate com o esperado. Qualquer outra combinação → forbidden (403).
 */
export function verifyWhatsAppSubscription(
  query: WhatsAppSubscriptionQuery,
  expectedVerifyToken: string,
): WhatsAppSubscriptionResult {
  if (
    query.mode === "subscribe" &&
    typeof query.challenge === "string" &&
    query.challenge.length > 0 &&
    typeof query.token === "string" &&
    expectedVerifyToken.length > 0 &&
    query.token === expectedVerifyToken
  ) {
    return { outcome: "verified", challenge: query.challenge };
  }
  return { outcome: "forbidden" };
}

// ---------------------------------------------------------------------------
// 2. Parsing do envelope (POST) — verbatim, sem interpretar economia
// ---------------------------------------------------------------------------

export interface ParsedWhatsAppImageMessage {
  readonly kind: "image";
  readonly providerMessageId: string;
  readonly senderWaId: string;
  readonly providerTimestamp: string;
  readonly phoneNumberId: string;
  readonly mediaId: string;
  /** MIME declarado no webhook (não confiável — o real vem do download). */
  readonly declaredMimeType: string | null;
}

export interface ParsedWhatsAppOtherMessage {
  readonly kind: "other";
  readonly providerMessageId: string | null;
  readonly senderWaId: string | null;
  readonly providerTimestamp: string | null;
  readonly phoneNumberId: string | null;
  readonly messageType: InboundWhatsAppMessageType;
}

export interface ParsedWhatsAppNoMessage {
  readonly kind: "no_message";
}

export type ParsedWhatsAppWebhook =
  | ParsedWhatsAppImageMessage
  | ParsedWhatsAppOtherMessage
  | ParsedWhatsAppNoMessage;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Extrai a PRIMEIRA mensagem do primeiro change do primeiro entry.
 * Payload Meta válido mas sem mensagem (ex.: status update) → no_message.
 */
export function parseWhatsAppWebhook(body: unknown): ParsedWhatsAppWebhook {
  const root = asRecord(body);
  if (!root || root.object !== "whatsapp_business_account") {
    return { kind: "no_message" };
  }
  const entry = Array.isArray(root.entry) ? asRecord(root.entry[0]) : null;
  const change = entry && Array.isArray(entry.changes) ? asRecord(entry.changes[0]) : null;
  const value = change ? asRecord(change.value) : null;
  if (!value) {
    return { kind: "no_message" };
  }

  const metadata = asRecord(value.metadata);
  const phoneNumberId = metadata ? asString(metadata.phone_number_id) : null;

  const message = Array.isArray(value.messages) ? asRecord(value.messages[0]) : null;
  if (!message) {
    return { kind: "no_message" };
  }

  const providerMessageId = asString(message.id);
  const senderWaId = asString(message.from);
  const providerTimestamp = asString(message.timestamp);
  const rawType = asString(message.type) ?? "unknown";
  const messageType = normalizeMessageType(rawType);

  if (messageType === "image") {
    const image = asRecord(message.image);
    const mediaId = image ? asString(image.id) : null;
    if (providerMessageId && senderWaId && phoneNumberId && mediaId) {
      return {
        kind: "image",
        providerMessageId,
        senderWaId,
        providerTimestamp: providerTimestamp ?? "",
        phoneNumberId,
        mediaId,
        declaredMimeType: image ? asString(image.mime_type) : null,
      };
    }
  }

  return {
    kind: "other",
    providerMessageId,
    senderWaId,
    providerTimestamp,
    phoneNumberId,
    messageType,
  };
}

function normalizeMessageType(raw: string): InboundWhatsAppMessageType {
  switch (raw) {
    case "image":
    case "text":
    case "audio":
    case "video":
    case "document":
    case "sticker":
    case "location":
    case "contacts":
      return raw;
    default:
      return "unknown";
  }
}

// ---------------------------------------------------------------------------
// 3. Política de ingresso — o que fazer com a mensagem parseada
// ---------------------------------------------------------------------------

export interface WhatsAppIngestConfig {
  /** phone_number_id da conta Meta de teste (deve bater com metadata.phone_number_id). */
  readonly phoneNumberId: string;
  /** único wa_id autorizado no primeiro teste. */
  readonly allowedSenderWaId: string;
  readonly allowedMimeTypes: ReadonlyArray<string>;
  readonly maxMediaBytes: number;
}

export type WhatsAppIngestDecision =
  | { readonly action: "preserve_image"; readonly message: ParsedWhatsAppImageMessage }
  /** Meta válido mas sem mensagem → 200, zero efeitos, zero persistência. */
  | { readonly action: "ignore_no_message" }
  /** Mensagem não-imagem (texto/áudio/vídeo/…): 200, zero persistência. */
  | { readonly action: "ignore_unsupported_type"; readonly messageType: InboundWhatsAppMessageType }
  /** MIME declarado fora de image/jpeg|png: 200, zero persistência. (MIME real reconferido no download.) */
  | { readonly action: "ignore_unsupported_media" }
  /** wa_id ≠ allowlist: 200, sem download/ledger/documento/storage. */
  | { readonly action: "ignore_sender_not_allowlisted" }
  /** phone_number_id ≠ configurado: 200 sem efeitos. */
  | { readonly action: "ignore_wrong_phone_number" };

export function evaluateWhatsAppIngest(
  parsed: ParsedWhatsAppWebhook,
  config: WhatsAppIngestConfig,
): WhatsAppIngestDecision {
  if (parsed.kind === "no_message") {
    return { action: "ignore_no_message" };
  }

  if (parsed.kind === "other") {
    // Roteamento errado tem prioridade: nem confirmamos o tipo.
    if (parsed.phoneNumberId !== null && parsed.phoneNumberId !== config.phoneNumberId) {
      return { action: "ignore_wrong_phone_number" };
    }
    return { action: "ignore_unsupported_type", messageType: parsed.messageType };
  }

  // parsed.kind === "image"
  if (parsed.phoneNumberId !== config.phoneNumberId) {
    return { action: "ignore_wrong_phone_number" };
  }
  if (parsed.senderWaId !== config.allowedSenderWaId) {
    return { action: "ignore_sender_not_allowlisted" };
  }
  if (
    parsed.declaredMimeType !== null &&
    !config.allowedMimeTypes.includes(parsed.declaredMimeType.toLowerCase())
  ) {
    return { action: "ignore_unsupported_media" };
  }
  return { action: "preserve_image", message: parsed };
}

// ---------------------------------------------------------------------------
// 4. Path de Storage determinístico e seguro
// ---------------------------------------------------------------------------

const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;

export interface BuildWhatsAppEvidencePathInput {
  readonly companyId: string;
  readonly engineeringProjectId: string;
  /** SHA-256 hex de `${providerAccountId}:${providerMessageId}` — nunca o id cru no path. */
  readonly messageKeyHash: string;
  /** SHA-256 hex dos BYTES efetivamente baixados. */
  readonly contentSha256: string;
  readonly mimeType: "image/jpeg" | "image/png";
}

/**
 * `{companyId}/documents/whatsapp/{projectId}/{messageKeyHash}/{contentSha256}.jpg|.png`
 * Todos os segmentos externos são validados (sem traversal, sem barra, sem
 * drive letter). O `provider_message_id` cru NUNCA aparece — só o hash.
 */
export function buildWhatsAppEvidenceStoragePath(input: BuildWhatsAppEvidencePathInput): string {
  for (const [name, seg] of [
    ["companyId", input.companyId],
    ["engineeringProjectId", input.engineeringProjectId],
  ] as const) {
    if (!SAFE_SEGMENT.test(seg)) {
      throw new Error(`buildWhatsAppEvidenceStoragePath: segmento inseguro em ${name}.`);
    }
  }
  if (!SHA256_HEX.test(input.messageKeyHash)) {
    throw new Error("buildWhatsAppEvidenceStoragePath: messageKeyHash não é SHA-256 hex canônico.");
  }
  if (!SHA256_HEX.test(input.contentSha256)) {
    throw new Error("buildWhatsAppEvidenceStoragePath: contentSha256 não é SHA-256 hex canônico.");
  }
  const extension = input.mimeType === "image/png" ? "png" : "jpg";
  return `${input.companyId}/documents/whatsapp/${input.engineeringProjectId}/${input.messageKeyHash}/${input.contentSha256}.${extension}`;
}

/**
 * Chave de deduplicação de transporte, derivada por hash (o hash em si é
 * injetado — o domínio permanece sem crypto). Nunca usa descrição/nome.
 */
export function deriveMessageKeyHash(
  providerAccountId: string,
  providerMessageId: string,
  sha256Hex: (input: string) => string,
): string {
  const hash = sha256Hex(`${providerAccountId}:${providerMessageId}`);
  if (!SHA256_HEX.test(hash)) {
    throw new Error("deriveMessageKeyHash: função de hash não retornou SHA-256 hex canônico.");
  }
  return hash;
}

/** Máscara para logs: mantém só os 4 últimos dígitos. Nunca logar wa_id/telefone completos. */
export function maskExternalId(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) return "****";
  return `****${trimmed.slice(-4)}`;
}
