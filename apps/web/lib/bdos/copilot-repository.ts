import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CopilotAssistantTurn,
  CopilotConversationHistoryEntry,
  CopilotMessageRole
} from "@bba/bdos-core/advisor/copilot/copilot-turn.types";

// Decision Copilot (Epic 15, Fase 1) — única camada que fala com o
// Supabase para copilot_conversations/copilot_messages. bdos-core
// (assembleCopilotAssistantTurn) já decide o que vai congelado em cada
// mensagem assistant; este módulo só grava exatamente isso, sem
// recalcular nada — mesma separação de responsabilidade de
// apps/web/lib/bdos/repository.ts para o resto do BDOS.
//
// copilot_conversations/copilot_messages são append-only (ver
// supabase/migrations/20260709000000_bdos_decision_copilot.sql) — não
// existe update/delete aqui de propósito, não por omissão.

const STUDIO_IDS = ["bba-project", "geoespacial", "evidencias", "memorias"] as const;
export type CopilotStudioId = (typeof STUDIO_IDS)[number];

export const createCopilotConversation = async (
  supabase: SupabaseClient,
  params: {
    readonly companyId: string;
    readonly engineeringProjectId: string;
    readonly studioId: CopilotStudioId;
    readonly createdBy: string;
  }
): Promise<{ readonly id: string }> => {
  const { data, error } = await supabase
    .from("copilot_conversations")
    .insert({
      company_id: params.companyId,
      engineering_project_id: params.engineeringProjectId,
      studio_id: params.studioId,
      created_by: params.createdBy
    })
    .select("id")
    .single();

  if (error || !data) {
    throw error ?? new Error("Não foi possível criar a conversa do Decision Copilot.");
  }

  return data;
};

export const appendCopilotUserMessage = async (
  supabase: SupabaseClient,
  params: {
    readonly companyId: string;
    readonly conversationId: string;
    readonly content: string;
  }
): Promise<{ readonly id: string }> => {
  const { data, error } = await supabase
    .from("copilot_messages")
    .insert({
      company_id: params.companyId,
      conversation_id: params.conversationId,
      role: "user",
      content: params.content
    })
    .select("id")
    .single();

  if (error || !data) {
    throw error ?? new Error("Não foi possível gravar a mensagem do usuário.");
  }

  return data;
};

// Grava exatamente o CopilotAssistantTurn que assembleCopilotAssistantTurn
// (bdos-core) já montou — context_snapshot/reasoning_chain/confidence/
// explainability são os VALORES congelados que ele decidiu, não
// recalculados aqui. O CHECK copilot_messages_assistant_has_full_trail
// no banco é a segunda linha de defesa, não a primeira: se algum campo
// vier ausente, o INSERT falha explicitamente em vez de gravar uma
// mensagem assistant "sem trilha".
export const appendCopilotAssistantMessage = async (
  supabase: SupabaseClient,
  params: {
    readonly companyId: string;
    readonly conversationId: string;
    readonly turn: CopilotAssistantTurn;
  }
): Promise<{ readonly id: string }> => {
  const { turn } = params;

  const { data, error } = await supabase
    .from("copilot_messages")
    .insert({
      company_id: params.companyId,
      conversation_id: params.conversationId,
      role: "assistant",
      content: turn.content,
      context_snapshot: turn.contextSnapshot,
      context_hash: turn.contextHash,
      reasoning_chain: turn.reasoningChain,
      confidence: turn.confidence,
      explainability: turn.explainability,
      decision_snapshot_id: turn.decisionSnapshotId,
      model: turn.model
    })
    .select("id")
    .single();

  if (error || !data) {
    throw error ?? new Error("Não foi possível gravar a resposta do Decision Copilot.");
  }

  return data;
};

export interface CopilotMessageRow {
  readonly id: string;
  readonly role: CopilotMessageRole;
  readonly content: string;
  readonly createdAt: string;
}

// Histórico para replay no próximo turno (ver copilot-turn-builder.ts) —
// só role+content, na ordem em que ocorreram. Os campos congelados
// (context_snapshot etc.) não fazem parte do histórico reenviado ao
// Claude a cada turno; eles existem para auditoria, não para
// re-alimentar a conversa (ver DECISION_COPILOT.md).
export const listCopilotMessages = async (
  supabase: SupabaseClient,
  conversationId: string
): Promise<ReadonlyArray<CopilotMessageRow>> => {
  const { data, error } = await supabase
    .from("copilot_messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    role: row.role as CopilotMessageRole,
    content: row.content as string,
    createdAt: row.created_at as string
  }));
};

export const toCopilotConversationHistory = (
  messages: ReadonlyArray<CopilotMessageRow>
): ReadonlyArray<CopilotConversationHistoryEntry> =>
  messages.map((message) => ({ role: message.role, content: message.content }));
