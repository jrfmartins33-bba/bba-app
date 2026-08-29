import type { SupabaseClient } from "@supabase/supabase-js";
import {
  INBOUND_CHANNEL_WHATSAPP,
  InboundChannelMessageStatus,
} from "@bba/bdos-core/domain/inbound-channel";

/**
 * Ledger de ingresso — repositório server-only (service_role). Nunca é
 * chamado por código de cliente. NÃO cria evidência: só registra a
 * entrega do canal e a idempotência de transporte.
 */

const COLUMNS =
  "id, company_id, engineering_project_id, channel, provider_account_id, provider_message_id, provider_media_id, sender_external_id, message_type, received_at, status, document_id, document_version_id, error_code, metadata";

export interface InboundChannelMessageRow {
  readonly id: string;
  readonly company_id: string;
  readonly engineering_project_id: string;
  readonly channel: string;
  readonly provider_account_id: string;
  readonly provider_message_id: string;
  readonly provider_media_id: string | null;
  readonly sender_external_id: string;
  readonly message_type: string;
  readonly received_at: string;
  readonly status: string;
  readonly document_id: string | null;
  readonly document_version_id: string | null;
  readonly error_code: string | null;
  readonly metadata: Record<string, unknown> | null;
}

export interface ClaimInboundChannelMessageInput {
  readonly companyId: string;
  readonly engineeringProjectId: string;
  readonly providerAccountId: string;
  readonly providerMessageId: string;
  readonly providerMediaId: string | null;
  readonly senderExternalId: string;
  readonly messageType: string;
  readonly receivedAt: string;
  readonly metadata?: Record<string, unknown>;
}

export type ClaimInboundChannelMessageResult =
  | { readonly outcome: "claimed"; readonly row: InboundChannelMessageRow }
  /** Já concluído — nada a fazer, responder 200. */
  | { readonly outcome: "already_preserved"; readonly row: InboundChannelMessageRow }
  /** Outro webhook idêntico ainda em andamento — não duplicar trabalho. */
  | { readonly outcome: "in_progress"; readonly row: InboundChannelMessageRow }
  /** Falha anterior — retry controlado da MESMA mensagem, reutilizando a linha. */
  | { readonly outcome: "retry"; readonly row: InboundChannelMessageRow };

export interface InboundChannelMessageRepository {
  claim(input: ClaimInboundChannelMessageInput): Promise<ClaimInboundChannelMessageResult>;
  attachDocument(id: string, patch: { documentId: string; documentVersionId?: string | null }): Promise<void>;
  markPreserved(id: string, patch: { documentId: string; documentVersionId: string }): Promise<void>;
  markFailed(id: string, patch: { errorCode: string }): Promise<void>;
}

const UNIQUE_VIOLATION = "23505";

export function createInboundChannelMessageRepository(
  supabase: SupabaseClient,
): InboundChannelMessageRepository {
  async function findByDeliveryIdentity(
    providerAccountId: string,
    providerMessageId: string,
  ): Promise<InboundChannelMessageRow | null> {
    const { data, error } = await supabase
      .from("inbound_channel_messages")
      .select(COLUMNS)
      .eq("channel", INBOUND_CHANNEL_WHATSAPP)
      .eq("provider_account_id", providerAccountId)
      .eq("provider_message_id", providerMessageId)
      .maybeSingle();
    if (error) throw error;
    return (data as InboundChannelMessageRow | null) ?? null;
  }

  return {
    async claim(input) {
      const insertResult = await supabase
        .from("inbound_channel_messages")
        .insert({
          company_id: input.companyId,
          engineering_project_id: input.engineeringProjectId,
          channel: INBOUND_CHANNEL_WHATSAPP,
          provider_account_id: input.providerAccountId,
          provider_message_id: input.providerMessageId,
          provider_media_id: input.providerMediaId,
          sender_external_id: input.senderExternalId,
          message_type: input.messageType,
          received_at: input.receivedAt,
          status: InboundChannelMessageStatus.Received,
          metadata: input.metadata ?? {},
        })
        .select(COLUMNS)
        .maybeSingle();

      if (!insertResult.error && insertResult.data) {
        return { outcome: "claimed", row: insertResult.data as InboundChannelMessageRow };
      }

      const code = (insertResult.error as { code?: string } | null)?.code;
      if (code !== UNIQUE_VIOLATION) {
        throw insertResult.error ?? new Error("Falha ao registrar o ingresso do canal.");
      }

      // Colisão de identidade de entrega — resolve o estado atual.
      const existing = await findByDeliveryIdentity(input.providerAccountId, input.providerMessageId);
      if (!existing) {
        throw new Error("Conflito de idempotência do ingresso não foi recuperável.");
      }
      if (existing.status === InboundChannelMessageStatus.Preserved) {
        return { outcome: "already_preserved", row: existing };
      }
      if (existing.status === InboundChannelMessageStatus.Failed) {
        return { outcome: "retry", row: existing };
      }
      return { outcome: "in_progress", row: existing };
    },

    async attachDocument(id, patch) {
      const { error } = await supabase
        .from("inbound_channel_messages")
        .update({
          document_id: patch.documentId,
          document_version_id: patch.documentVersionId ?? null,
        })
        .eq("id", id);
      if (error) throw error;
    },

    async markPreserved(id, patch) {
      const { error } = await supabase
        .from("inbound_channel_messages")
        .update({
          status: InboundChannelMessageStatus.Preserved,
          document_id: patch.documentId,
          document_version_id: patch.documentVersionId,
          error_code: null,
        })
        .eq("id", id);
      if (error) throw error;
    },

    async markFailed(id, patch) {
      const { error } = await supabase
        .from("inbound_channel_messages")
        .update({ status: InboundChannelMessageStatus.Failed, error_code: patch.errorCode })
        .eq("id", id);
      if (error) throw error;
    },
  };
}
