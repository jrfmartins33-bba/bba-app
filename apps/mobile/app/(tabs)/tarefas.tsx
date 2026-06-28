import { ScrollView, StyleSheet, Text, Pressable, View } from "react-native";
import { BBA } from "@bba/config";
import { taskStatusLabels, type TaskStatus, useBbaStore } from "@bba/lib";

const statuses: TaskStatus[] = ["todo", "in_progress", "done"];

export default function TasksScreen() {
  const tasks = useBbaStore((state) => state.tasks);
  const updateTaskStatus = useBbaStore((state) => state.updateTaskStatus);

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      {statuses.map((status) => (
        <View key={status} style={styles.section}>
          <Text style={styles.sectionTitle}>{taskStatusLabels[status]}</Text>
          {tasks
            .filter((task) => task.status === status)
            .map((task) => (
              <View key={task.id} style={styles.card}>
                <Text style={styles.title}>{task.title}</Text>
                {task.description ? <Text style={styles.body}>{task.description}</Text> : null}
                <View style={styles.actions}>
                  {statuses.map((nextStatus) => (
                    <Pressable
                      key={nextStatus}
                      onPress={() => updateTaskStatus(task.id, nextStatus)}
                      style={[
                        styles.pill,
                        task.status === nextStatus ? styles.pillActive : undefined
                      ]}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          task.status === nextStatus ? styles.pillTextActive : undefined
                        ]}
                      >
                        {taskStatusLabels[nextStatus]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
        </View>
      ))}
    </ScrollView>
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
  section: {
    gap: 10
  },
  sectionTitle: {
    color: BBA.navy,
    fontSize: 18,
    fontWeight: "700"
  },
  card: {
    backgroundColor: BBA.white,
    borderColor: BBA.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: 9,
    padding: 14
  },
  title: {
    color: BBA.navy,
    fontSize: 16,
    fontWeight: "700"
  },
  body: {
    color: BBA.muted,
    lineHeight: 20
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  pill: {
    backgroundColor: "#f3f0ea",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  pillActive: {
    backgroundColor: BBA.navy
  },
  pillText: {
    color: BBA.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  pillTextActive: {
    color: BBA.white
  }
});
