/**
 * Ledger genérico de INGRESSO de mensagens de canais externos.
 *
 * NÃO é uma segunda evidência documental. É exclusivamente o registro de
 * ENTREGA do canal (idempotência de transporte). A evidência canônica
 * continua sendo DocumentArtifact + DocumentVersion.
 *
 * Fatia A (WhatsApp → webhook → mídia preservada): os únicos estados
 * possíveis são Received, Preserved e Failed. Mensagens ignoradas
 * (fora de escopo, remetente não autorizado, número errado) NÃO são
 * persistidas nesta fatia.
 */

export type InboundChannel = "whatsapp-cloud-api";

/** Canal do WhatsApp Cloud API. Também usado como `sourceSystem` do documento. */
export const INBOUND_CHANNEL_WHATSAPP: InboundChannel = "whatsapp-cloud-api";

export enum InboundChannelMessageStatus {
  /** Identidade de ingresso criada; mídia ainda não preservada. */
  Received = "Received",
  /** Mídia armazenada + DocumentArtifact + DocumentVersion existentes. Estado terminal de sucesso. */
  Preserved = "Preserved",
  /** Erro técnico controlado; retry da MESMA mensagem é permitido. */
  Failed = "Failed",
}

/** Tipos de mensagem que o parser reconhece (só `image` cria documento nesta fatia). */
export type InboundWhatsAppMessageType =
  | "image"
  | "text"
  | "audio"
  | "video"
  | "document"
  | "sticker"
  | "location"
  | "contacts"
  | "status"
  | "unknown";

export interface InboundChannelMessage {
  readonly id: string;
  readonly companyId: string;
  readonly engineeringProjectId: string;
  readonly channel: InboundChannel;
  /** phone_number_id validado da conta Meta. */
  readonly providerAccountId: string;
  /** Identidade de ENTREGA do canal. Descrição/nome de arquivo NUNCA são identidade. */
  readonly providerMessageId: string;
  readonly providerMediaId: string | null;
  readonly senderExternalId: string;
  readonly messageType: InboundWhatsAppMessageType;
  readonly receivedAt: string;
  readonly status: InboundChannelMessageStatus;
  readonly documentId: string | null;
  readonly documentVersionId: string | null;
  readonly errorCode: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}
