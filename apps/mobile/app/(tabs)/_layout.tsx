import { Tabs } from "expo-router";
import { ClipboardList, LayoutDashboard, MessageSquareText } from "lucide-react-native";
import { BBA } from "@bba/config";

type TabIconProps = {
  color: string;
  size: number;
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: BBA.paper },
        headerTintColor: BBA.navy,
        tabBarActiveTintColor: BBA.navy,
        tabBarInactiveTintColor: BBA.muted,
        tabBarStyle: {
          borderTopColor: BBA.line
        }
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Painel",
          tabBarIcon: ({ color, size }: TabIconProps) => (
            <LayoutDashboard color={color} size={size} />
          )
        }}
      />
      <Tabs.Screen
        name="tarefas"
        options={{
          title: "Tarefas",
          tabBarIcon: ({ color, size }: TabIconProps) => (
            <ClipboardList color={color} size={size} />
          )
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarIcon: ({ color, size }: TabIconProps) => (
            <MessageSquareText color={color} size={size} />
          )
        }}
      />
    </Tabs>
  );
}
