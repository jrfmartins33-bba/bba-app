import type {
  ChatChannel,
  Company,
  Message,
  OnboardingStep,
  Profile,
  Project,
  Task
} from "./types";

export const demoClientId = "00000000-0000-4000-8000-000000000001";
export const demoTeamId = "00000000-0000-4000-8000-0000000000b1";
export const demoCompanyId = "00000000-0000-4000-8000-0000000000c1";

export const demoProfile: Profile = {
  id: demoClientId,
  full_name: "Maria Oliveira",
  email: "cliente@bbabrazil.com.br",
  role: "client",
  company_id: demoCompanyId,
  metadata: {},
  created_at: "2026-06-01T12:00:00.000Z",
  updated_at: "2026-06-01T12:00:00.000Z"
};

export const demoCompany: Company = {
  id: demoCompanyId,
  owner_id: demoClientId,
  name: "Maria Oliveira",
  cnpj: "12345678000190",
  tax_regime: "simples_nacional",
  segment: "Servicos profissionais",
  main_phone: "+55 85 99999-0000",
  metadata: {},
  created_at: "2026-06-01T12:00:00.000Z",
  updated_at: "2026-06-01T12:00:00.000Z"
};

export const demoProjects: Project[] = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    company_id: demoCompanyId,
    name: "Implantacao BBA Operacional",
    description: "Organizacao inicial de rotinas fiscais, documentos e agenda de entregas.",
    area: "governanca",
    status: "active",
    responsible_id: demoTeamId,
    due_date: null,
    metadata: {},
    created_at: "2026-06-03T12:00:00.000Z",
    updated_at: "2026-06-03T12:00:00.000Z"
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    company_id: demoCompanyId,
    name: "Governanca de documentos",
    description: "Padronizacao de arquivos societarios e contratos recorrentes.",
    area: "governanca",
    status: "active",
    responsible_id: demoTeamId,
    due_date: null,
    metadata: {},
    created_at: "2026-06-05T12:00:00.000Z",
    updated_at: "2026-06-05T12:00:00.000Z"
  }
];

export const demoTasks: Task[] = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    company_id: demoCompanyId,
    project_id: demoProjects[0].id,
    title: "Enviar contrato social atualizado",
    description: "Anexar a ultima alteracao contratual para conferencia cadastral.",
    status: "todo",
    priority: "medium",
    area: "governanca",
    tag: "Documentos",
    due_date: "2026-07-02",
    attachments_count: 0,
    created_by: demoClientId,
    assigned_to: demoTeamId,
    metadata: {},
    created_at: "2026-06-10T12:00:00.000Z",
    updated_at: "2026-06-10T12:00:00.000Z"
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    company_id: demoCompanyId,
    project_id: demoProjects[0].id,
    title: "Validar calendario fiscal",
    description: "Conferir vencimentos e responsaveis antes da primeira rotina mensal.",
    status: "in_progress",
    priority: "medium",
    area: "fiscal",
    tag: "Fiscal",
    due_date: "2026-07-05",
    attachments_count: 0,
    created_by: demoClientId,
    assigned_to: demoTeamId,
    metadata: {},
    created_at: "2026-06-11T12:00:00.000Z",
    updated_at: "2026-06-15T12:00:00.000Z"
  },
  {
    id: "20000000-0000-4000-8000-000000000003",
    company_id: demoCompanyId,
    project_id: demoProjects[1].id,
    title: "Mapear acessos bancarios",
    description: "Listar contas, perfis autorizados e limites de aprovacao.",
    status: "todo",
    priority: "medium",
    area: "financeiro",
    tag: "Financeiro",
    due_date: "2026-07-10",
    attachments_count: 0,
    created_by: demoClientId,
    assigned_to: demoTeamId,
    metadata: {},
    created_at: "2026-06-12T12:00:00.000Z",
    updated_at: "2026-06-12T12:00:00.000Z"
  },
  {
    id: "20000000-0000-4000-8000-000000000004",
    company_id: demoCompanyId,
    project_id: demoProjects[1].id,
    title: "Confirmar dados de contato",
    description: "Atualizar telefones, e-mails operacionais e responsavel financeiro.",
    status: "done",
    priority: "medium",
    area: "rh",
    tag: "Onboarding",
    due_date: "2026-06-25",
    attachments_count: 0,
    created_by: demoClientId,
    assigned_to: demoTeamId,
    metadata: {},
    created_at: "2026-06-07T12:00:00.000Z",
    updated_at: "2026-06-20T12:00:00.000Z"
  }
];

export const demoChannels: ChatChannel[] = [
  {
    id: "30000000-0000-4000-8000-000000000001",
    company_id: demoCompanyId,
    name: "Fiscal",
    area: "fiscal",
    created_at: "2026-06-03T12:00:00.000Z",
    updated_at: "2026-06-03T12:00:00.000Z"
  },
  {
    id: "30000000-0000-4000-8000-000000000002",
    company_id: demoCompanyId,
    name: "Financeiro",
    area: "financeiro",
    created_at: "2026-06-03T12:00:00.000Z",
    updated_at: "2026-06-03T12:00:00.000Z"
  },
  {
    id: "30000000-0000-4000-8000-000000000003",
    company_id: demoCompanyId,
    name: "TI",
    area: "ti",
    created_at: "2026-06-03T12:00:00.000Z",
    updated_at: "2026-06-03T12:00:00.000Z"
  },
  {
    id: "30000000-0000-4000-8000-000000000004",
    company_id: demoCompanyId,
    name: "RH",
    area: "rh",
    created_at: "2026-06-03T12:00:00.000Z",
    updated_at: "2026-06-03T12:00:00.000Z"
  },
  {
    id: "30000000-0000-4000-8000-000000000005",
    company_id: demoCompanyId,
    name: "Governanca",
    area: "governanca",
    created_at: "2026-06-03T12:00:00.000Z",
    updated_at: "2026-06-03T12:00:00.000Z"
  }
];

export const demoMessages: Message[] = [
  {
    id: "40000000-0000-4000-8000-000000000001",
    channel_id: demoChannels[0].id,
    sender_id: demoTeamId,
    body: "Bom dia, Maria. Ja deixamos o calendario fiscal preliminar disponivel para validacao.",
    created_at: "2026-06-25T12:10:00.000Z"
  },
  {
    id: "40000000-0000-4000-8000-000000000002",
    channel_id: demoChannels[0].id,
    sender_id: demoClientId,
    body: "Obrigada. Vou conferir hoje e retorno com as observacoes.",
    created_at: "2026-06-25T12:26:00.000Z"
  },
  {
    id: "40000000-0000-4000-8000-000000000003",
    channel_id: demoChannels[1].id,
    sender_id: demoTeamId,
    body: "Precisamos confirmar a pessoa responsavel por aprovar pagamentos recorrentes.",
    created_at: "2026-06-24T15:40:00.000Z"
  }
];

export const demoOnboardingSteps: OnboardingStep[] = [
  {
    id: "50000000-0000-4000-8000-000000000001",
    company_id: demoCompanyId,
    step_number: 1,
    title: "Cadastro da empresa",
    description: null,
    status: "completed",
    responsible_id: demoTeamId,
    notes: null,
    completed_at: "2026-06-04T12:00:00.000Z",
    metadata: {},
    created_at: "2026-06-03T12:00:00.000Z",
    updated_at: "2026-06-04T12:00:00.000Z"
  },
  {
    id: "50000000-0000-4000-8000-000000000002",
    company_id: demoCompanyId,
    step_number: 2,
    title: "Contatos e responsaveis",
    description: null,
    status: "completed",
    responsible_id: demoTeamId,
    notes: null,
    completed_at: "2026-06-05T12:00:00.000Z",
    metadata: {},
    created_at: "2026-06-03T12:00:00.000Z",
    updated_at: "2026-06-05T12:00:00.000Z"
  },
  {
    id: "50000000-0000-4000-8000-000000000003",
    company_id: demoCompanyId,
    step_number: 3,
    title: "Envio de documentos",
    description: null,
    status: "in_progress",
    responsible_id: demoTeamId,
    notes: null,
    completed_at: null,
    metadata: {},
    created_at: "2026-06-03T12:00:00.000Z",
    updated_at: "2026-06-03T12:00:00.000Z"
  },
  {
    id: "50000000-0000-4000-8000-000000000004",
    company_id: demoCompanyId,
    step_number: 4,
    title: "Validacao BBA",
    description: null,
    status: "pending",
    responsible_id: demoTeamId,
    notes: null,
    completed_at: null,
    metadata: {},
    created_at: "2026-06-03T12:00:00.000Z",
    updated_at: "2026-06-03T12:00:00.000Z"
  },
  {
    id: "50000000-0000-4000-8000-000000000005",
    company_id: demoCompanyId,
    step_number: 5,
    title: "Operacao assistida",
    description: null,
    status: "pending",
    responsible_id: demoTeamId,
    notes: null,
    completed_at: null,
    metadata: {},
    created_at: "2026-06-03T12:00:00.000Z",
    updated_at: "2026-06-03T12:00:00.000Z"
  }
];
