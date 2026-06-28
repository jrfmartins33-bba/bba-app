import { CheckCircle2, ClipboardList, MessageSquareText } from "lucide-react-native";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { BBA } from "@bba/config";
import { useBbaStore } from "@bba/lib";

export default function DashboardScreen() {
  const profile = useBbaStore((state) => state.profile);
  const company = useBbaStore((state) => state.company);
  const tasks = useBbaStore((state) => state.tasks);
  const messages = useBbaStore((state) => state.messages);
  const onboardingSteps = useBbaStore((state) => state.onboardingSteps);

  const openTasks = tasks.filter((task) => task.status !== "done").length;
  const doneTasks = tasks.filter((task) => task.status === "done").length;
  const unread = messages.filter(
    (message) => message.sender_id !== profile.id
  ).length;
  const doneSteps = onboardingSteps.filter((step) => step.status === "completed").length;

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <Text style={styles.eyebrow}>Cliente</Text>
      <Text style={styles.title}>{company.name}</Text>

      <View style={styles.metricGrid}>
        <Metric icon={<ClipboardList color={BBA.navy} size={20} />} label="Abertas" value={openTasks} />
        <Metric icon={<CheckCircle2 color={BBA.navy} size={20} />} label="Concluidas" value={doneTasks} />
        <Metric icon={<MessageSquareText color={BBA.navy} size={20} />} label="Novas" value={unread} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Onboarding</Text>
        <Text style={styles.body}>
          {doneSteps} de {onboardingSteps.length} etapas concluidas
        </Text>
        <View style={styles.progress}>
          <View
            style={[
              styles.progressFill,
              { width: `${(doneSteps / onboardingSteps.length) * 100}%` }
            ]}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Prioridades</Text>
          {tasks
            .filter((task) => task.status !== "done")
          .slice(0, 3)
          .map((task) => (
            <View key={task.id} style={styles.row}>
              <Text style={styles.rowTitle}>{task.title}</Text>
              <Text style={styles.body}>{task.tag ?? "Geral"}</Text>
            </View>
          ))}
      </View>
    </ScrollView>
  );
}

function Metric({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <View style={styles.metric}>
      {icon}
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: BBA.paper
  },
  content: {
    gap: 14,
    padding: 16
  },
  eyebrow: {
    color: BBA.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  title: {
    color: BBA.navy,
    fontSize: 26,
    fontWeight: "700"
  },
  metricGrid: {
    flexDirection: "row",
    gap: 10
  },
  metric: {
    alignItems: "center",
    backgroundColor: BBA.white,
    borderColor: BBA.line,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    padding: 12
  },
  metricValue: {
    color: BBA.navy,
    fontSize: 22,
    fontWeight: "700"
  },
  metricLabel: {
    color: BBA.muted,
    fontSize: 12
  },
  card: {
    backgroundColor: BBA.white,
    borderColor: BBA.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 14
  },
  cardTitle: {
    color: BBA.navy,
    fontSize: 16,
    fontWeight: "700"
  },
  body: {
    color: BBA.muted,
    lineHeight: 20
  },
  progress: {
    backgroundColor: "#eee7da",
    borderRadius: 999,
    height: 9,
    overflow: "hidden"
  },
  progressFill: {
    backgroundColor: BBA.success,
    height: 9
  },
  row: {
    borderTopColor: BBA.line,
    borderTopWidth: 1,
    gap: 3,
    paddingTop: 10
  },
  rowTitle: {
    color: BBA.ink,
    fontWeight: "700"
  }
});
