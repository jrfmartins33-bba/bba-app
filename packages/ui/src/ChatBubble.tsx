import type { Message } from "@bba/lib";

type ChatBubbleProps = {
  currentUserId: string;
  message: Message;
};

export function ChatBubble({ currentUserId, message }: ChatBubbleProps) {
  const isClient = message.sender_id === currentUserId;
  const time = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(message.created_at));

  return (
    <article className={`chat-bubble ${isClient ? "chat-bubble--client" : ""}`}>
      <div className="chat-bubble__meta">
        <span>{isClient ? "Voce" : "Equipe BBA"}</span>
        <time>{time}</time>
      </div>
      <p>{message.body}</p>
    </article>
  );
}
