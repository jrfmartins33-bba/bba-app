import {
  demoChannels,
  demoCompany,
  demoMessages,
  demoOnboardingSteps,
  demoProjects,
  demoTasks
} from "./mock-data";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase";
import type { BbaArea, ChatReadState, Message, Task, TaskStatus, TaxRegime } from "./types";

export type AdminClientHealth = "Saudavel" | "Atencao";

export type AdminClientSummary = {
  id: string;
  name: string;
  role: string;
  regime: string;
  owner: string;
  health: AdminClientHealth;
  onboarding: number;
  openTasks: number;
  unread: number;
};

type AdminCompanyRow = {
  id: string;
  name: string | null;
  cnpj?: string | null;
  tax_regime?: string | null;
  segment?: string | null;
  main_phone?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type AdminClientCompanyRow = {
  company_id: string;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  regime_tributario?: string | null;
  status?: string | null;
};

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
    currentUserId: string,
    readState: ChatReadState[]
  ) => {
    const lastReadAt = readState.find(
      (entry) => entry.channel_id === channelId
    )?.last_read_at;
  
    return messages.filter(
      (message) =>
        message.channel_id === channelId &&
        message.sender_id !== currentUserId &&
        (!lastReadAt || message.created_at > lastReadAt)
    ).length;
  };

const regimeCodeLabels: Record<string, string> = {
  MEI: "MEI",
  SN: "Simples",
  LP: "LucroPresumido",
  LR: "LucroReal",
  LA: "Lucro Arbitrado",
  ISENTO: "Isento"
};

const formatAdminRegime = (regime?: string | null) => {
  if (!regime) {
    return "Nao informado";
  }

  const normalized = regime.toLowerCase();
  if (normalized in taxRegimeLabels) {
    return taxRegimeLabels[normalized as TaxRegime];
  }

  return regimeCodeLabels[regime.toUpperCase()] ?? regime;
};

type AdminTaskAggRow = {
  company_id: string;
  status: TaskStatus;
};

type AdminOnboardingAggRow = {
  company_id: string;
  status: string;
};

type AdminOwnerRow = {
  id: string;
  full_name: string;
};

type AdminUnreadAggRow = {
  channel_id: string;
  sender_id: string;
  created_at: string;
};

type AdminReadStateRow = {
  channel_id: string;
  last_read_at: string;
};

type AdminChannelCompanyRow = {
  id: string;
  company_id: string;
};

const mapAdminClient = (
  company: AdminCompanyRow,
  clientCompany: AdminClientCompanyRow | undefined,
  ownerName: string | null,
  onboardingPct: number,
  openTasksCount: number,
  unreadCount: number
): AdminClientSummary => {
  const status = clientCompany?.status;
  const name =
    clientCompany?.nome_fantasia?.trim() ||
    clientCompany?.razao_social?.trim() ||
    company.name?.trim() ||
    "Cliente BBA";

  return {
    id: company.id,
    name,
    role: "Cliente",
    regime: formatAdminRegime(
      clientCompany?.regime_tributario ?? company.tax_regime
    ),
    owner: ownerName ?? "Sem responsavel definido",
    health: status && status !== "Ativo" ? "Atencao" : "Saudavel",
    onboarding: onboardingPct,
    openTasks: openTasksCount,
    unread: unreadCount
  };
};

const getDemoAdminClients = (): AdminClientSummary[] => [
  mapAdminClient(
    {
      id: demoCompany.id,
      name: demoCompany.name,
      cnpj: demoCompany.cnpj,
      tax_regime: demoCompany.tax_regime,
      segment: demoCompany.segment,
      main_phone: demoCompany.main_phone,
      created_at: demoCompany.created_at,
      updated_at: demoCompany.updated_at
    },
    undefined,
    "BBA",
    Math.round(
      (demoOnboardingSteps.filter((step) => step.status === "completed").length /
        Math.max(demoOnboardingSteps.length, 1)) *
        100
    ),
    demoTasks.filter((task) => task.status !== "done").length,
    0
  )
];

export const fetchAdminClients = async (): Promise<AdminClientSummary[]> => {
  if (!isSupabaseConfigured) {
    console.log(
      "[BBA Admin Data Source] Supabase nao configurado; usando fallback demo."
    );
    return getDemoAdminClients();
  }

  console.log(
    "[BBA Admin Data Source] Supabase configurado para fetchAdminClients()."
  );

  try {
    const supabase = getSupabaseClient();

    // 1. Empresas (cadastro tecnico de tenant)
    const { data: companies, error: companiesError } = await supabase
      .from("companies")
      .select(
        "id,name,cnpj,tax_regime,segment,main_phone,created_at,updated_at,account_owner_id"
      )
      .order("created_at", { ascending: false });

    if (companiesError) throw companiesError;

    const companyRows = (companies ?? []) as (AdminCompanyRow & {
      account_owner_id: string | null;
    })[];
    const companyIds = companyRows.map((c) => c.id);

    if (!companyIds.length) {
      return [];
    }

    // 2. Ficha cadastral completa (razao social, regime, status)
    const clientCompanyByCompanyId = new Map<string, AdminClientCompanyRow>();
    const { data: clientCompanies, error: clientCompaniesError } = await supabase
      .from("client_companies")
      .select(
        "company_id,razao_social,nome_fantasia,cnpj,regime_tributario,status"
      )
      .in("company_id", companyIds);

    if (clientCompaniesError) {
      console.log(
        "[BBA Admin Data Source] Query client_companies falhou.",
        clientCompaniesError
      );
    } else {
      (clientCompanies ?? []).forEach((row) => {
        const typed = row as AdminClientCompanyRow;
        clientCompanyByCompanyId.set(typed.company_id, typed);
      });
    }

    // 3. Account owner (gestor de conta)
    const ownerIds = Array.from(
      new Set(
        companyRows
          .map((c) => c.account_owner_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    const ownerNameById = new Map<string, string>();
    if (ownerIds.length) {
      const { data: owners, error: ownersError } = await supabase
        .from("profiles")
        .select("id,full_name")
        .in("id", ownerIds);

      if (ownersError) {
        console.log("[BBA Admin Data Source] Query owners falhou.", ownersError);
      } else {
        (owners ?? []).forEach((row) => {
          const typed = row as AdminOwnerRow;
          ownerNameById.set(typed.id, typed.full_name);
        });
      }
    }

    // 4. Tarefas abertas por empresa
    const { data: tasksData, error: tasksError } = await supabase
      .from("tasks")
      .select("company_id,status")
      .in("company_id", companyIds)
      .neq("status", "done");

    const openTasksByCompanyId = new Map<string, number>();
    if (tasksError) {
      console.log("[BBA Admin Data Source] Query tasks falhou.", tasksError);
    } else {
      (tasksData as AdminTaskAggRow[] | null ?? []).forEach((row) => {
        openTasksByCompanyId.set(
          row.company_id,
          (openTasksByCompanyId.get(row.company_id) ?? 0) + 1
        );
      });
    }

    // 5. Onboarding % por empresa (onboarding_checklist)
    const { data: checklistData, error: checklistError } = await supabase
      .from("onboarding_checklist")
      .select("company_id,status")
      .in("company_id", companyIds);

    const onboardingPctByCompanyId = new Map<string, number>();
    if (checklistError) {
      console.log(
        "[BBA Admin Data Source] Query onboarding_checklist falhou.",
        checklistError
      );
    } else {
      const totalsByCompany = new Map<string, { total: number; done: number }>();
      (checklistData as AdminOnboardingAggRow[] | null ?? []).forEach((row) => {
        const current = totalsByCompany.get(row.company_id) ?? {
          total: 0,
          done: 0
        };
        current.total += 1;
        if (row.status === "ConcluÃ­do") current.done += 1;
        totalsByCompany.set(row.company_id, current);
      });
      totalsByCompany.forEach((value, companyId) => {
        onboardingPctByCompanyId.set(
          companyId,
          value.total > 0 ? Math.round((value.done / value.total) * 100) : 0
        );
      });
    }

    // 6. Mensagens nao lidas por empresa
    //    -> precisa mapear canal -> empresa, depois comparar created_at
    //       com chat_read_state.last_read_at do usuario admin atual.
    const unreadByCompanyId = new Map<string, number>();
    const {
      data: { user: currentUser }
    } = await supabase.auth.getUser();

    if (currentUser) {
      const { data: channelsData, error: channelsError } = await supabase
        .from("chat_channels")
        .select("id,company_id")
        .in("company_id", companyIds);

      if (channelsError) {
        console.log(
          "[BBA Admin Data Source] Query chat_channels falhou.",
          channelsError
        );
      } else {
        const channelRows = (channelsData ?? []) as AdminChannelCompanyRow[];
        const channelIds = channelRows.map((c) => c.id);
        const companyIdByChannelId = new Map(
          channelRows.map((c) => [c.id, c.company_id])
        );

        if (channelIds.length) {
          const [{ data: messagesData, error: messagesError }, { data: readStateData, error: readStateError }] =
            await Promise.all([
              supabase
                .from("chat_messages")
                .select("channel_id,sender_id,created_at")
                .in("channel_id", channelIds)
                .neq("sender_id", currentUser.id),
              supabase
                .from("chat_read_state")
                .select("channel_id,last_read_at")
                .eq("user_id", currentUser.id)
                .in("channel_id", channelIds)
            ]);

          if (messagesError) {
            console.log(
              "[BBA Admin Data Source] Query chat_messages falhou.",
              messagesError
            );
          } else if (readStateError) {
            console.log(
              "[BBA Admin Data Source] Query chat_read_state falhou.",
              readStateError
            );
          } else {
            const lastReadByChannelId = new Map(
              (readStateData as AdminReadStateRow[] | null ?? []).map((row) => [
                row.channel_id,
                row.last_read_at
              ])
            );

            (messagesData as AdminUnreadAggRow[] | null ?? []).forEach((msg) => {
              const lastRead = lastReadByChannelId.get(msg.channel_id);
              const isUnread = !lastRead || msg.created_at > lastRead;
              if (!isUnread) return;

              const companyId = companyIdByChannelId.get(msg.channel_id);
              if (!companyId) return;

              unreadByCompanyId.set(
                companyId,
                (unreadByCompanyId.get(companyId) ?? 0) + 1
              );
            });
          }
        }
      }
    }

    return companyRows.map((company) =>
      mapAdminClient(
        company,
        clientCompanyByCompanyId.get(company.id),
        company.account_owner_id
          ? ownerNameById.get(company.account_owner_id) ?? null
          : null,
        onboardingPctByCompanyId.get(company.id) ?? 0,
        openTasksByCompanyId.get(company.id) ?? 0,
        unreadByCompanyId.get(company.id) ?? 0
      )
    );
  } catch (error) {
    console.log(
      "[BBA Admin Data Source] Query Supabase falhou; usando fallback demo.",
      error
    );
    console.log(
      "[BBA Admin Data Source] Fallback demo usado em fetchAdminClients()."
    );
    return getDemoAdminClients();
  }
};

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

export const fetchReadState = async (userId: string, channelIds: string[]) => {
  if (!channelIds.length) {
    return [];
  }

  if (!isSupabaseConfigured) {
    return [];
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("chat_read_state")
    .select("channel_id,last_read_at")
    .eq("user_id", userId)
    .in("channel_id", channelIds);

  if (error) {
    console.log(
      "[BBA Chat Read State] Falha ao carregar estado de leitura; seguindo sem bloqueio.",
      error
    );
    return [];
  }

  return (data ?? []) as ChatReadState[];
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
