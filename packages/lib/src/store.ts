import { create } from "zustand";
import {
  demoChannels,
  demoClientId,
  demoCompany,
  demoMessages,
  demoOnboardingSteps,
  demoProfile,
  demoProjects,
  demoTasks
} from "./mock-data";
import {
  areaLabels,
  fetchChannels,
  fetchMessages,
  fetchOnboardingSteps,
  fetchProjects,
  fetchTasks
} from "./queries";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase";
import type {
  ChatChannel,
  Company,
  CompanyInput,
  CreateTaskInput,
  Message,
  OnboardingStep,
  Profile,
  Project,
  Task,
  TaskStatus
} from "./types";

type Session = {
  userId: string;
  email: string;
  role: "client" | "bba_admin";
};

type BbaStore = {
  session: Session | null;
  profile: Profile;
  company: Company;
  projects: Project[];
  tasks: Task[];
  channels: ChatChannel[];
  messages: Message[];
  onboardingSteps: OnboardingStep[];
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, company: CompanyInput) => Promise<void>;
  signOut: () => void;
  updateCompany: (company: Partial<Company>) => void;
  completeOnboardingStep: (stepNumber: number) => void;
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;
  createTask: (task: CreateTaskInput) => void;
  sendMessage: (channelId: string, body: string) => void;
  markChannelAsRead: (channelId: string) => void;
};

const now = () => new Date().toISOString();

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const buildDefaultSteps = (companyId: string): OnboardingStep[] =>
  [
    "Cadastro da empresa",
    "Contatos e responsaveis",
    "Envio de documentos",
    "Validacao BBA",
    "Operacao assistida"
  ].map((title, index) => ({
    id: createId(),
    company_id: companyId,
    step_number: index + 1,
    title,
    description: null,
    status: index === 0 ? "in_progress" : "pending",
    responsible_id: null,
    notes: null,
    completed_at: null,
    metadata: {},
    created_at: now(),
    updated_at: now()
  }));

const buildDefaultChannels = (companyId: string): ChatChannel[] =>
  (["fiscal", "financeiro", "ti", "rh", "governanca"] as const).map(
    (area) => ({
      id: createId(),
      company_id: companyId,
      name: areaLabels[area],
      area,
      created_at: now(),
      updated_at: now()
    })
  );

const buildFallbackCompany = (profile: Profile): Company => ({
  id: profile.company_id ?? profile.id,
  owner_id: profile.id,
  name: profile.full_name,
  cnpj: null,
  tax_regime: null,
  segment: null,
  main_phone: null,
  metadata: {},
  created_at: profile.created_at,
  updated_at: profile.updated_at
});

const loadClientState = async (userId: string) => {
  const supabase = getSupabaseClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (profileError) {
    throw profileError;
  }

  const typedProfile = profile as Profile;
  const companyQuery = typedProfile.company_id
    ? supabase
        .from("companies")
        .select("*")
        .eq("id", typedProfile.company_id)
        .single()
    : supabase
        .from("companies")
        .select("*")
        .eq("owner_id", userId)
        .limit(1)
        .maybeSingle();

  const { data: companyData, error: companyError } = await companyQuery;

  if (companyError) {
    throw companyError;
  }

  const company = (companyData as Company | null) ?? buildFallbackCompany(typedProfile);

  const [projects, tasks, channels, onboardingSteps] = await Promise.all([
    fetchProjects(company.id),
    fetchTasks(company.id),
    fetchChannels(company.id),
    fetchOnboardingSteps(company.id)
  ]);

  const messageGroups = await Promise.all(
    channels.map((channel) => fetchMessages(channel.id))
  );

  return {
    profile: typedProfile,
    company,
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
  company: demoCompany,
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
            role: clientState.profile.role
          }
        });
        if (typeof document !== "undefined") {
          document.cookie = "bba_auth=1; path=/; SameSite=Lax";
        }
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
    if (typeof document !== "undefined") {
      document.cookie = "bba_auth=1; path=/; SameSite=Lax";
    }
  },

  signUp: async (email, _password, companyInput) => {
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
            role: clientState.profile.role
          }
        });
        if (typeof document !== "undefined") {
          document.cookie = "bba_auth=1; path=/; SameSite=Lax";
        }
        return;
      }
    }

    const clientId = createId();
    const companyId = createId();
    const createdAt = now();
    const profile: Profile = {
      id: clientId,
      full_name: companyInput.name,
      email,
      role: "client",
      company_id: companyId,
      metadata: {},
      created_at: createdAt,
      updated_at: createdAt
    };
    const company: Company = {
      id: companyId,
      owner_id: clientId,
      name: companyInput.name,
      cnpj: companyInput.cnpj ?? null,
      tax_regime: companyInput.tax_regime ?? null,
      segment: companyInput.segment ?? null,
      main_phone: companyInput.main_phone ?? null,
      metadata: {},
      created_at: createdAt,
      updated_at: createdAt
    };
    const project: Project = {
      id: createId(),
      company_id: companyId,
      name: "Onboarding BBA",
      description: "Primeiro ciclo de implantacao e organizacao operacional.",
      area: "governanca",
      status: "active",
      responsible_id: null,
      due_date: null,
      metadata: {},
      created_at: createdAt,
      updated_at: createdAt
    };

    set({
      session: { userId: clientId, email, role: "client" },
      profile,
      company,
      projects: [project],
      tasks: [],
      channels: buildDefaultChannels(companyId),
      messages: [],
      onboardingSteps: buildDefaultSteps(companyId)
    });
    if (typeof document !== "undefined") {
      document.cookie = "bba_auth=1; path=/; SameSite=Lax";
    }
  },

  signOut: () => {
    if (typeof document !== "undefined") {
      document.cookie = "bba_auth=; path=/; max-age=0";
    }
    set({
      session: null
    });
  },

  updateCompany: (company) => {
    set((state) => ({
      company: {
        ...state.company,
        ...company,
        updated_at: now()
      }
    }));
  },

  completeOnboardingStep: (stepNumber) => {
    set((state) => {
      const nextStepNumber = stepNumber + 1;
      const onboardingSteps = state.onboardingSteps.map((step) => {
        if (step.step_number === stepNumber) {
          return { ...step, status: "completed" as const, completed_at: now() };
        }

        if (step.step_number === nextStepNumber && step.status === "pending") {
          return { ...step, status: "in_progress" as const };
        }

        return step;
      });

      return {
        onboardingSteps
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
    const projectId = taskInput.project_id ?? state.projects[0]?.id ?? null;

    if (!taskInput.title.trim()) {
      return;
    }

    const task: Task = {
      id: createId(),
      company_id: state.company.id,
      project_id: projectId,
      title: taskInput.title.trim(),
      description: taskInput.description?.trim() || null,
      status: taskInput.status ?? "todo",
      priority: taskInput.priority ?? "medium",
      area: taskInput.area ?? null,
      tag: taskInput.tag?.trim() || "Geral",
      due_date: taskInput.due_date || null,
      attachments_count: 0,
      created_by: state.profile.id,
      assigned_to: null,
      metadata: {},
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
      body,
      created_at: now()
    };

    set((current) => ({
      messages: [...current.messages, message]
    }));
  },

  markChannelAsRead: () => {
    return undefined;
  }
}));
