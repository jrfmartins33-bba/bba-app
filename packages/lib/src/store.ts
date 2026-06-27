import { create } from "zustand";
import {
  demoChannels,
  demoClientId,
  demoMessages,
  demoOnboardingSteps,
  demoProfile,
  demoProjects,
  demoTasks
} from "./mock-data";
import {
  fetchChannels,
  fetchMessages,
  fetchOnboardingSteps,
  fetchProjects,
  fetchTasks
} from "./queries";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase";
import type {
  ChatChannel,
  CreateTaskInput,
  Message,
  OnboardingStep,
  Profile,
  ProfileInput,
  Project,
  Task,
  TaskStatus
} from "./types";

type Session = {
  userId: string;
  email: string;
  role: "client" | "bba_team";
};

type BbaStore = {
  session: Session | null;
  profile: Profile;
  projects: Project[];
  tasks: Task[];
  channels: ChatChannel[];
  messages: Message[];
  onboardingSteps: OnboardingStep[];
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, profile: ProfileInput) => Promise<void>;
  signOut: () => void;
  updateProfile: (profile: Partial<Profile>) => void;
  completeOnboardingStep: (stepNumber: number) => void;
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;
  createTask: (task: CreateTaskInput) => void;
  sendMessage: (channelId: string, content: string) => void;
  markChannelAsRead: (channelId: string) => void;
};

const now = () => new Date().toISOString();

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const buildDefaultSteps = (clientId: string): OnboardingStep[] =>
  [
    "Cadastro da empresa",
    "Contatos e responsaveis",
    "Envio de documentos",
    "Validacao BBA",
    "Operacao assistida"
  ].map((stepTitle, index) => ({
    id: createId(),
    client_id: clientId,
    step_number: index + 1,
    step_title: stepTitle,
    status: index === 0 ? "current" : "pending",
    completed_at: null
  }));

const buildDefaultChannels = (clientId: string): ChatChannel[] =>
  (["fiscal", "financeiro", "ti", "rh", "governanca"] as const).map(
    (teamArea) => ({
      id: createId(),
      client_id: clientId,
      team_area: teamArea,
      created_at: now()
    })
  );

const loadClientState = async (clientId: string) => {
  const supabase = getSupabaseClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", clientId)
    .single();

  if (profileError) {
    throw profileError;
  }

  const [projects, tasks, channels, onboardingSteps] = await Promise.all([
    fetchProjects(clientId),
    fetchTasks(clientId),
    fetchChannels(clientId),
    fetchOnboardingSteps(clientId)
  ]);

  const messageGroups = await Promise.all(
    channels.map((channel) => fetchMessages(channel.id))
  );

  return {
    profile: profile as Profile,
    projects: projects as Project[],
    tasks: tasks as Task[],
    channels: channels as ChatChannel[],
    messages: messageGroups.flat() as Message[],
    onboardingSteps: onboardingSteps as OnboardingStep[]
  };
};

export const useBbaStore = create<BbaStore>((set, get) => ({
  session: {
    userId: demoClientId,
    email: "cliente@bbabrazil.com.br",
    role: "client"
  },
  profile: demoProfile,
  projects: demoProjects,
  tasks: demoTasks,
  channels: demoChannels,
  messages: demoMessages,
  onboardingSteps: demoOnboardingSteps,

  signIn: async (email) => {
    if (isSupabaseConfigured) {
      const supabase = getSupabaseClient();
      const {
        data: { user },
        error
      } = await supabase.auth.getUser();

      if (error) {
        throw error;
      }

      if (user) {
        const clientState = await loadClientState(user.id);
        set({
          ...clientState,
          session: {
            userId: user.id,
            email: user.email ?? email,
            role: clientState.profile.plan === "bba_team" ? "bba_team" : "client"
          }
        });
        return;
      }
    }

    set({
      session: {
        userId: get().profile.id,
        email,
        role: "client"
      }
    });
  },

  signUp: async (email, _password, profileInput) => {
    if (isSupabaseConfigured) {
      const supabase = getSupabaseClient();
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (user) {
        const clientState = await loadClientState(user.id);
        set({
          ...clientState,
          session: {
            userId: user.id,
            email: user.email ?? email,
            role: clientState.profile.plan === "bba_team" ? "bba_team" : "client"
          }
        });
        return;
      }
    }

    const clientId = createId();
    const createdAt = now();
    const profile: Profile = {
      id: clientId,
      name: profileInput.name,
      cnpj: profileInput.cnpj ?? null,
      regime: profileInput.regime ?? null,
      segmento: profileInput.segmento ?? null,
      phone: profileInput.phone ?? null,
      plan: profileInput.plan ?? "essencial",
      onboarding_step: 1,
      created_at: createdAt
    };

    const project: Project = {
      id: createId(),
      client_id: clientId,
      title: "Onboarding BBA",
      description: "Primeiro ciclo de implantacao e organizacao operacional.",
      status: "active",
      created_at: createdAt
    };

    set({
      session: { userId: clientId, email, role: "client" },
      profile,
      projects: [project],
      tasks: [],
      channels: buildDefaultChannels(clientId),
      messages: [],
      onboardingSteps: buildDefaultSteps(clientId)
    });
  },

  signOut: () => {
    set({
      session: null
    });
  },

  updateProfile: (profile) => {
    set((state) => ({
      profile: {
        ...state.profile,
        ...profile
      }
    }));
  },

  completeOnboardingStep: (stepNumber) => {
    set((state) => {
      const nextStepNumber = stepNumber + 1;
      const onboardingSteps = state.onboardingSteps.map((step) => {
        if (step.step_number === stepNumber) {
          return { ...step, status: "done" as const, completed_at: now() };
        }

        if (step.step_number === nextStepNumber && step.status === "pending") {
          return { ...step, status: "current" as const };
        }

        return step;
      });

      return {
        onboardingSteps,
        profile: {
          ...state.profile,
          onboarding_step: Math.min(nextStepNumber, onboardingSteps.length)
        }
      };
    });
  },

  updateTaskStatus: (taskId, status) => {
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId ? { ...task, status, updated_at: now() } : task
      )
    }));
  },

  createTask: (taskInput) => {
    const state = get();
    const projectId = taskInput.project_id ?? state.projects[0]?.id;

    if (!projectId || !taskInput.title.trim()) {
      return;
    }

    const task: Task = {
      id: createId(),
      project_id: projectId,
      client_id: state.profile.id,
      title: taskInput.title.trim(),
      description: taskInput.description?.trim() || null,
      status: taskInput.status ?? "todo",
      tag: taskInput.tag?.trim() || "Geral",
      due_date: taskInput.due_date || null,
      assigned_to: null,
      created_at: now(),
      updated_at: now()
    };

    set((current) => ({
      tasks: [task, ...current.tasks]
    }));
  },

  sendMessage: (channelId, content) => {
    const body = content.trim();

    if (!body) {
      return;
    }

    const state = get();
    const message: Message = {
      id: createId(),
      channel_id: channelId,
      sender_id: state.profile.id,
      sender_role: "client",
      content: body,
      read_at: null,
      created_at: now()
    };

    set((current) => ({
      messages: [...current.messages, message]
    }));
  },

  markChannelAsRead: (channelId) => {
    set((state) => ({
      messages: state.messages.map((message) =>
        message.channel_id === channelId && message.sender_role === "bba_team"
          ? { ...message, read_at: message.read_at ?? now() }
          : message
      )
    }));
  }
}));
