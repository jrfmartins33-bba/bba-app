"use client";

import { Send, UsersRound } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { areaLabels, getUnreadMessages, useBbaStore } from "@bba/lib";
import { Button, Card, ChatBubble } from "@bba/ui";

export default function ChatPage() {
  const profile = useBbaStore((state) => state.profile);
  const channels = useBbaStore((state) => state.channels);
  const messages = useBbaStore((state) => state.messages);
  const readState = useBbaStore((state) => state.readState);
  const sendMessage = useBbaStore((state) => state.sendMessage);
  const markChannelAsRead = useBbaStore((state) => state.markChannelAsRead);
  const [selectedChannelId, setSelectedChannelId] = useState(channels[0]?.id ?? "");
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!selectedChannelId && channels[0]) {
      setSelectedChannelId(channels[0].id);
    }
  }, [channels, selectedChannelId]);

  useEffect(() => {
    if (selectedChannelId) {
      markChannelAsRead(selectedChannelId);
    }
  }, [markChannelAsRead, selectedChannelId]);

  const selectedChannel = channels.find((channel) => channel.id === selectedChannelId);
  const channelMessages = useMemo(
    () =>
      messages
        .filter((message) => message.channel_id === selectedChannelId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [messages, selectedChannelId]
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedChannelId) return;
    sendMessage(selectedChannelId, draft);
    setDraft("");
  };

  return (
    <>
      <section className="page-header">
        <div>
          <h1>Chat BBA</h1>
          <p>Converse com cada area mantendo historico e contexto do atendimento.</p>
        </div>
      </section>

      <section className="chat-layout">
        <Card title="Areas">
          <div className="channel-list">
            {channels.map((channel) => {
              const unread = getUnreadMessages(messages, channel.id, profile.id, readState);
              return (
                <button
                  className="channel-button"
                  data-active={channel.id === selectedChannelId}
                  key={channel.id}
                  onClick={() => setSelectedChannelId(channel.id)}
                  type="button"
                >
                  <span>
                    <UsersRound size={16} />
                    {areaLabels[channel.area]}
                  </span>
                  {unread ? <strong className="unread-pill">{unread}</strong> : null}
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="chat-thread">
          <div className="chat-thread__header">
            <div>
              <h2>
                {selectedChannel ? areaLabels[selectedChannel.area] : "Canal"}
              </h2>
              <span>{channelMessages.length} mensagem(ns)</span>
            </div>
          </div>

          <div className="message-list">
            {channelMessages.length ? (
              channelMessages.map((message) => (
                <ChatBubble
                  currentUserId={profile.id}
                  key={message.id}
                  message={message}
                />
              ))
            ) : (
              <div className="empty-state">Nenhuma mensagem neste canal.</div>
            )}
          </div>

          <form className="chat-form" onSubmit={handleSubmit}>
            <input
              aria-label="Mensagem"
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Escreva uma mensagem"
              value={draft}
            />
            <Button icon={<Send size={17} />} type="submit">
              Enviar
            </Button>
          </form>
        </Card>
      </section>
    </>
  );
}
