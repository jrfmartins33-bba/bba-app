import { Send } from "lucide-react-native";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { BBA } from "@bba/config";
import { teamAreaLabels, useBbaStore } from "@bba/lib";

export default function ChatScreen() {
  const channels = useBbaStore((state) => state.channels);
  const messages = useBbaStore((state) => state.messages);
  const sendMessage = useBbaStore((state) => state.sendMessage);
  const [channelId, setChannelId] = useState(channels[0]?.id ?? "");
  const [draft, setDraft] = useState("");

  const visibleMessages = messages.filter((message) => message.channel_id === channelId);

  const handleSend = () => {
    sendMessage(channelId, draft);
    setDraft("");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <View style={styles.channels}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {channels.map((channel) => (
            <Pressable
              key={channel.id}
              onPress={() => setChannelId(channel.id)}
              style={[styles.channel, channel.id === channelId ? styles.channelActive : undefined]}
            >
              <Text
                style={[
                  styles.channelText,
                  channel.id === channelId ? styles.channelTextActive : undefined
                ]}
              >
                {teamAreaLabels[channel.team_area]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.messages}>
        {visibleMessages.map((message) => {
          const client = message.sender_role === "client";
          return (
            <View
              key={message.id}
              style={[styles.bubble, client ? styles.bubbleClient : undefined]}
            >
              <Text style={[styles.bubbleAuthor, client ? styles.bubbleAuthorClient : undefined]}>
                {client ? "Voce" : "Equipe BBA"}
              </Text>
              <Text style={[styles.bubbleText, client ? styles.bubbleTextClient : undefined]}>
                {message.content}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          onChangeText={setDraft}
          placeholder="Mensagem"
          style={styles.input}
          value={draft}
        />
        <Pressable onPress={handleSend} style={styles.sendButton}>
          <Send color={BBA.white} size={18} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: BBA.paper,
    flex: 1
  },
  channels: {
    borderBottomColor: BBA.line,
    borderBottomWidth: 1,
    padding: 12
  },
  channel: {
    backgroundColor: BBA.white,
    borderColor: BBA.line,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  channelActive: {
    backgroundColor: BBA.navy,
    borderColor: BBA.navy
  },
  channelText: {
    color: BBA.muted,
    fontWeight: "700"
  },
  channelTextActive: {
    color: BBA.white
  },
  messages: {
    gap: 10,
    padding: 16
  },
  bubble: {
    alignSelf: "flex-start",
    backgroundColor: "#f4efe4",
    borderColor: BBA.line,
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: "86%",
    padding: 12
  },
  bubbleClient: {
    alignSelf: "flex-end",
    backgroundColor: BBA.navy,
    borderColor: BBA.navy
  },
  bubbleAuthor: {
    color: BBA.navy,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 5
  },
  bubbleAuthorClient: {
    color: BBA.goldSoft
  },
  bubbleText: {
    color: BBA.ink,
    lineHeight: 20
  },
  bubbleTextClient: {
    color: BBA.white
  },
  composer: {
    backgroundColor: BBA.white,
    borderTopColor: BBA.line,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12
  },
  input: {
    backgroundColor: "#fdfcf8",
    borderColor: BBA.line,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 12
  },
  sendButton: {
    alignItems: "center",
    backgroundColor: BBA.navy,
    borderRadius: 8,
    height: 44,
    justifyContent: "center",
    width: 44
  }
});
