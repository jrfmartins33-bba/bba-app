import type {
  ChatChannel,
  Message,
  OnboardingStep,
  Profile,
  Project,
  Task
} from "./types";

export const demoClientId = "00000000-0000-4000-8000-000000000001";
export const demoTeamId = "00000000-0000-4000-8000-0000000000b1";

export const demoProfile: Profile = {
  id: demoClientId,
  name: "Maria Oliveira",
  cnpj: "12.345.678/0001-90",
  regime: "Simples",
  segmento: "Servicos profissionais",
  phone: "+55 85 99999-0000",
  plan: "essencial",
  onboarding_step: 3,
  created_at: "2026-06-01T12:00:00.000Z"
};

export const demoProjects: Project[] = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    client_id: demoClientId,
    title: "Implantacao BBA Operacional",
    description: "Organizacao inicial de rotinas fiscais, documentos e agenda de entregas.",
    status: "active",
    created_at: "2026-06-03T12:00:00.000Z"
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    client_id: demoClientId,
    title: "Governanca de documentos",
    description: "Padronizacao de arquivos societarios e contratos recorrentes.",
    status: "active",
    created_at: "2026-06-05T12:00:00.000Z"
  }
];

export const demoTasks: Task[] = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    project_id: demoProjects[0].id,
    client_id: demoClientId,
    title: "Enviar contrato social atualizado",
    description: "Anexar a ultima alteracao contratual para conferencia cadastral.",
    status: "todo",
    tag: "Documentos",
    due_date: "2026-07-02",
    assigned_to: demoTeamId,
    created_at: "2026-06-10T12:00:00.000Z",
    updated_at: "2026-06-10T12:00:00.000Z"
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    project_id: demoProjects[0].id,
    client_id: demoClientId,
    title: "Validar calendario fiscal",
    description: "Conferir vencimentos e responsaveis antes da primeira rotina mensal.",
    status: "doing",
    tag: "Fiscal",
    due_date: "2026-07-05",
    assigned_to: demoTeamId,
    created_at: "2026-06-11T12:00:00.000Z",
    updated_at: "2026-06-15T12:00:00.000Z"
  },
  {
    id: "20000000-0000-4000-8000-000000000003",
    project_id: demoProjects[1].id,
    client_id: demoClientId,
    title: "Mapear acessos bancarios",
    description: "Listar contas, perfis autorizados e limites de aprovacao.",
    status: "todo",
    tag: "Financeiro",
    due_date: "2026-07-10",
    assigned_to: demoTeamId,
    created_at: "2026-06-12T12:00:00.000Z",
    updated_at: "2026-06-12T12:00:00.000Z"
  },
  {
    id: "20000000-0000-4000-8000-000000000004",
    project_id: demoProjects[1].id,
    client_id: demoClientId,
    title: "Confirmar dados de contato",
    description: "Atualizar telefones, e-mails operacionais e responsavel financeiro.",
    status: "done",
    tag: "Onboarding",
    due_date: "2026-06-25",
    assigned_to: demoTeamId,
    created_at: "2026-06-07T12:00:00.000Z",
    updated_at: "2026-06-20T12:00:00.000Z"
  }
];

export const demoChannels: ChatChannel[] = [
  {
    id: "30000000-0000-4000-8000-000000000001",
    client_id: demoClientId,
    team_area: "fiscal",
    created_at: "2026-06-03T12:00:00.000Z"
  },
  {
    id: "30000000-0000-4000-8000-000000000002",
    client_id: demoClientId,
    team_area: "financeiro",
    created_at: "2026-06-03T12:00:00.000Z"
  },
  {
    id: "30000000-0000-4000-8000-000000000003",
    client_id: demoClientId,
    team_area: "ti",
    created_at: "2026-06-03T12:00:00.000Z"
  },
  {
    id: "30000000-0000-4000-8000-000000000004",
    client_id: demoClientId,
    team_area: "rh",
    created_at: "2026-06-03T12:00:00.000Z"
  },
  {
    id: "30000000-0000-4000-8000-000000000005",
    client_id: demoClientId,
    team_area: "governanca",
    created_at: "2026-06-03T12:00:00.000Z"
  }
];

export const demoMessages: Message[] = [
  {
    id: "40000000-0000-4000-8000-000000000001",
    channel_id: demoChannels[0].id,
    sender_id: demoTeamId,
    sender_role: "bba_team",
    content: "Bom dia, Maria. Ja deixamos o calendario fiscal preliminar disponivel para validacao.",
    read_at: "2026-06-25T12:30:00.000Z",
    created_at: "2026-06-25T12:10:00.000Z"
  },
  {
    id: "40000000-0000-4000-8000-000000000002",
    channel_id: demoChannels[0].id,
    sender_id: demoClientId,
    sender_role: "client",
    content: "Obrigada. Vou conferir hoje e retorno com as observacoes.",
    read_at: null,
    created_at: "2026-06-25T12:26:00.000Z"
  },
  {
    id: "40000000-0000-4000-8000-000000000003",
    channel_id: demoChannels[1].id,
    sender_id: demoTeamId,
    sender_role: "bba_team",
    content: "Precisamos confirmar a pessoa responsavel por aprovar pagamentos recorrentes.",
    read_at: null,
    created_at: "2026-06-24T15:40:00.000Z"
  }
];

export const demoOnboardingSteps: OnboardingStep[] = [
  {
    id: "50000000-0000-4000-8000-000000000001",
    client_id: demoClientId,
    step_number: 1,
    step_title: "Cadastro da empresa",
    status: "done",
    completed_at: "2026-06-04T12:00:00.000Z"
  },
  {
    id: "50000000-0000-4000-8000-000000000002",
    client_id: demoClientId,
    step_number: 2,
    step_title: "Contatos e responsaveis",
    status: "done",
    completed_at: "2026-06-05T12:00:00.000Z"
  },
  {
    id: "50000000-0000-4000-8000-000000000003",
    client_id: demoClientId,
    step_number: 3,
    step_title: "Envio de documentos",
    status: "current",
    completed_at: null
  },
  {
    id: "50000000-0000-4000-8000-000000000004",
    client_id: demoClientId,
    step_number: 4,
    step_title: "Validacao BBA",
    status: "pending",
    completed_at: null
  },
  {
    id: "50000000-0000-4000-8000-000000000005",
    client_id: demoClientId,
    step_number: 5,
    step_title: "Operacao assistida",
    status: "pending",
    completed_at: null
  }
];
