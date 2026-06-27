import { getSupabaseClient, isSupabaseConfigured } from "./supabase";
import type { Message } from "./types";

export const subscribeToChannel = (
  channelId: string,
  onMessage: (message: Message) => void
) => {
  if (!isSupabaseConfigured) {
    return {
      unsubscribe: () => undefined
    };
  }

  const supabase = getSupabaseClient();

  return supabase
    .channel(`chat:${channelId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `channel_id=eq.${channelId}`
      },
      (payload) => onMessage(payload.new as Message)
    )
    .subscribe();
};

export const sendChannelMessage = async (
  channelId: string,
  senderId: string,
  content: string
) => {
  if (!isSupabaseConfigured) {
    return {
      data: null,
      error: null
    };
  }

  const supabase = getSupabaseClient();

  return supabase.from("messages").insert({
    channel_id: channelId,
    sender_id: senderId,
    sender_role: "client",
    content
  });
};
