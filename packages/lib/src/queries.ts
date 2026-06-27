import {
  demoChannels,
  demoMessages,
  demoOnboardingSteps,
  demoProjects,
  demoTasks
} from "./mock-data";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase";
import type { Message, Task, TaskStatus } from "./types";

export const taskStatusLabels: Record<TaskStatus, string> = {
  todo: "A fazer",
  doing: "Em andamento",
  done: "Concluido"
};

export const teamAreaLabels = {
  fiscal: "Fiscal",
  financeiro: "Financeiro",
  ti: "TI",
  rh: "RH",
  governanca: "Governanca"
} as const;

export const groupTasksByStatus = (tasks: Task[]) =>
  tasks.reduce<Record<TaskStatus, Task[]>>(
    (acc, task) => {
      acc[task.status].push(task);
      return acc;
    },
    { todo: [], doing: [], done: [] }
  );

export const getUnreadMessages = (messages: Message[], channelId: string) =>
  messages.filter(
    (message) =>
      message.channel_id === channelId &&
      message.sender_role === "bba_team" &&
      !message.read_at
  ).length;

export const fetchProjects = async (clientId: string) => {
  if (!isSupabaseConfigured) {
    return demoProjects.filter((project) => project.client_id === clientId);
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
};

export const fetchTasks = async (clientId: string) => {
  if (!isSupabaseConfigured) {
    return demoTasks.filter((task) => task.client_id === clientId);
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("client_id", clientId)
    .order("due_date", { ascending: true });

  if (error) throw error;
  return data ?? [];
};

export const fetchChannels = async (clientId: string) => {
  if (!isSupabaseConfigured) {
    return demoChannels.filter((channel) => channel.client_id === clientId);
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("chat_channels")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
};

export const fetchMessages = async (channelId: string) => {
  if (!isSupabaseConfigured) {
    return demoMessages.filter((message) => message.channel_id === channelId);
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
};

export const fetchOnboardingSteps = async (clientId: string) => {
  if (!isSupabaseConfigured) {
    return demoOnboardingSteps.filter((step) => step.client_id === clientId);
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("onboarding_steps")
    .select("*")
    .eq("client_id", clientId)
    .order("step_number", { ascending: true });

  if (error) throw error;
  return data ?? [];
};
