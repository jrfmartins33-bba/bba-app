import {
  demoChannels,
  demoCompany,
  demoMessages,
  demoOnboardingSteps,
  demoProjects,
  demoTasks
} from "./mock-data";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase";
import type { BbaArea, Message, Task, TaskStatus, TaxRegime } from "./types";

export const taskStatusLabels: Record<TaskStatus, string> = {
  todo: "A fazer",
  in_progress: "Em andamento",
  done: "Concluido"
};

export const areaLabels: Record<BbaArea, string> = {
  fiscal: "Fiscal",
  financeiro: "Financeiro",
  ti: "TI",
  rh: "RH",
  governanca: "Governanca"
};

export const taxRegimeLabels: Record<TaxRegime, string> = {
  mei: "MEI",
  simples_nacional: "Simples",
  lucro_presumido: "LucroPresumido",
  lucro_real: "LucroReal"
};

export const groupTasksByStatus = (tasks: Task[]) =>
  tasks.reduce<Record<TaskStatus, Task[]>>(
    (acc, task) => {
      acc[task.status].push(task);
      return acc;
    },
    { todo: [], in_progress: [], done: [] }
  );

export const getUnreadMessages = (
  messages: Message[],
  channelId: string,
  currentUserId: string
) =>
  messages.filter(
    (message) =>
      message.channel_id === channelId && message.sender_id !== currentUserId
  ).length;

export const fetchCompany = async (companyId: string) => {
  if (!isSupabaseConfigured) {
    return demoCompany.id === companyId ? demoCompany : null;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .single();

  if (error) throw error;
  return data;
};

export const fetchProjects = async (companyId: string) => {
  if (!isSupabaseConfigured) {
    return demoProjects.filter((project) => project.company_id === companyId);
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
};

export const fetchTasks = async (companyId: string) => {
  if (!isSupabaseConfigured) {
    return demoTasks.filter((task) => task.company_id === companyId);
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("company_id", companyId)
    .order("due_date", { ascending: true });

  if (error) throw error;
  return data ?? [];
};

export const fetchChannels = async (companyId: string) => {
  if (!isSupabaseConfigured) {
    return demoChannels.filter((channel) => channel.company_id === companyId);
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("chat_channels")
    .select("*")
    .eq("company_id", companyId)
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
    .from("chat_messages")
    .select("*")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
};

export const fetchOnboardingSteps = async (companyId: string) => {
  if (!isSupabaseConfigured) {
    return demoOnboardingSteps.filter((step) => step.company_id === companyId);
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("onboarding_steps")
    .select("*")
    .eq("company_id", companyId)
    .order("step_number", { ascending: true });

  if (error) throw error;
  return data ?? [];
};
