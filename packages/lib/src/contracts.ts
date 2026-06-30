import { demoCompany } from "./mock-data";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase";

export type ContractTipo = "Recorrente" | "Projeto" | "Avulso" | "Consultoria Pontual";

export type ContractAreaBba = "Financas" | "TI" | "Governanca" | "RH" | "Multi";

export type ContractStatus = "Proposta" | "Ativo" | "Suspenso" | "Encerrado" | "Cancelado";

export type ContractFormaPagamento =
  | "PIX"
  | "Boleto"
  | "Transferência"
  | "Cartão"
  | "Débito Automático";

export type ContractIndiceReajuste =
  | "IPCA"
  | "IGPM"
  | "INPC"
  | "SELIC"
  | "Fixo"
  | "Negociado";

export type ScopePeriodicidade =
  | "Mensal"
  | "Trimestral"
  | "Semestral"
  | "Anual"
  | "Pontual"
  | "Sob demanda";

export type ServiceContract = {
  id: string;
  company_id: string;
  numero_contrato: string;
  titulo: string;
  tipo_contrato: ContractTipo;
  area_bba?: ContractAreaBba | null;
  valor_mensal?: number | null;
  valor_total?: number | null;
  moeda: string;
  dia_vencimento?: number | null;
  forma_pagamento?: ContractFormaPagamento | null;
  data_inicio: string;
  data_fim?: string | null;
  duracao_meses?: number | null;
  renovacao_automatica: boolean;
  prazo_aviso_rescisao_dias?: number | null;
  indice_reajuste?: ContractIndiceReajuste | null;
  percentual_reajuste?: number | null;
  mes_reajuste?: number | null;
  status: ContractStatus;
  data_assinatura?: string | null;
  responsavel_bba_id?: string | null;
  contrato_url?: string | null;
  proposta_url?: string | null;
  observacoes?: string | null;
  clausulas_especiais?: string | null;
  created_at: string;
  updated_at: string;
};

export type ServiceScopeItem = {
  id: string;
  company_id: string;
  contract_id: string;
  area_bba?: ContractAreaBba | null;
  categoria: string;
  descricao: string;
  periodicidade?: ScopePeriodicidade | null;
  tipo_entregavel?: string | null;
  sla_dias?: number | null;
  incluso_no_valor: boolean;
  valor_adicional: number;
  ativo: boolean;
  ordem: number;
  observacoes?: string | null;
  created_at: string;
  updated_at: string;
};

export type ContractsModuleData = {
  contracts: ServiceContract[];
  scopeItems: ServiceScopeItem[];
  warnings: string[];
};

export type CreateServiceContractInput = {
  company_id: string;
  titulo: string;
  tipo_contrato: ContractTipo;
  area_bba?: ContractAreaBba | null;
  valor_mensal?: number | null;
  valor_total?: number | null;
  dia_vencimento?: number | null;
  forma_pagamento?: ContractFormaPagamento | null;
  data_inicio: string;
  data_fim?: string | null;
  duracao_meses?: number | null;
  renovacao_automatica?: boolean;
  indice_reajuste?: ContractIndiceReajuste | null;
  data_assinatura?: string | null;
  observacoes?: string | null;
};

export type CreateScopeItemInput = {
  company_id: string;
  contract_id: string;
  area_bba?: ContractAreaBba | null;
  categoria: string;
  descricao: string;
  periodicidade?: ScopePeriodicidade | null;
  tipo_entregavel?: string | null;
  sla_dias?: number | null;
  incluso_no_valor?: boolean;
  valor_adicional?: number;
  observacoes?: string | null;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const emptyToNull = (value?: string | null) => {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
};

const selectSafely = async <T>(
  label: string,
  query: PromiseLike<{ data: unknown; error: unknown }>,
  warnings: string[]
): Promise<T[]> => {
  const { data, error } = await query;

  if (error) {
    warnings.push(`${label}: ${String((error as { message?: string }).message ?? error)}`);
    return [];
  }

  return (data ?? []) as T[];
};

const demoContractsData = (): ContractsModuleData => {
  const companyId = demoCompany.id;
  const today = todayIso();

  const contracts: ServiceContract[] = [
    {
      id: "demo-contract-1",
      company_id: companyId,
      numero_contrato: "BBA-CT-202601-DEMO",
      titulo: "Assessoria contabil e tributaria recorrente",
      tipo_contrato: "Recorrente",
      area_bba: "Multi",
      valor_mensal: 4200,
      valor_total: null,
      moeda: "BRL",
      dia_vencimento: 10,
      forma_pagamento: "PIX",
      data_inicio: "2026-01-01",
      data_fim: null,
      duracao_meses: 12,
      renovacao_automatica: true,
      prazo_aviso_rescisao_dias: 30,
      indice_reajuste: "IPCA",
      percentual_reajuste: null,
      mes_reajuste: 1,
      status: "Ativo",
      data_assinatura: "2025-12-20",
      responsavel_bba_id: null,
      contrato_url: null,
      proposta_url: null,
      observacoes: null,
      clausulas_especiais: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: "demo-contract-2",
      company_id: companyId,
      numero_contrato: "BBA-CT-202606-DEMO",
      titulo: "Consultoria de governanca societaria",
      tipo_contrato: "Consultoria Pontual",
      area_bba: "Governanca",
      valor_mensal: null,
      valor_total: 18000,
      moeda: "BRL",
      dia_vencimento: null,
      forma_pagamento: "Transferência",
      data_inicio: today,
      data_fim: null,
      duracao_meses: 3,
      renovacao_automatica: false,
      prazo_aviso_rescisao_dias: 15,
      indice_reajuste: null,
      percentual_reajuste: null,
      mes_reajuste: null,
      status: "Proposta",
      data_assinatura: null,
      responsavel_bba_id: null,
      contrato_url: null,
      proposta_url: null,
      observacoes: null,
      clausulas_especiais: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  const scopeItems: ServiceScopeItem[] = [
    {
      id: "demo-scope-1",
      company_id: companyId,
      contract_id: "demo-contract-1",
      area_bba: "Financas",
      categoria: "Fiscal",
      descricao: "Apuracao e envio de obrigacoes fiscais mensais",
      periodicidade: "Mensal",
      tipo_entregavel: "Declaracao",
      sla_dias: 5,
      incluso_no_valor: true,
      valor_adicional: 0,
      ativo: true,
      ordem: 1,
      observacoes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: "demo-scope-2",
      company_id: companyId,
      contract_id: "demo-contract-1",
      area_bba: "Financas",
      categoria: "Financeiro",
      descricao: "Conciliacao bancaria e fluxo de caixa mensal",
      periodicidade: "Mensal",
      tipo_entregavel: "Relatorio",
      sla_dias: 5,
      incluso_no_valor: true,
      valor_adicional: 0,
      ativo: true,
      ordem: 2,
      observacoes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  return { contracts, scopeItems, warnings: [] };
};

export const generateNumeroContrato = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `BBA-CT-${year}${month}-${rand}`;
};

export const fetchContractsModuleData = async (
  companyId: string
): Promise<ContractsModuleData> => {
  if (!companyId || !isSupabaseConfigured) {
    return demoContractsData();
  }

  const supabase = getSupabaseClient();
  const warnings: string[] = [];

  const [contracts, scopeItems] = await Promise.all([
    selectSafely<ServiceContract>(
      "Contratos de servico",
      supabase
        .from("service_contracts")
        .select("*")
        .eq("company_id", companyId)
        .order("data_inicio", { ascending: false })
        .limit(80),
      warnings
    ),
    selectSafely<ServiceScopeItem>(
      "Itens de escopo",
      supabase
        .from("service_scope_items")
        .select("*")
        .eq("company_id", companyId)
        .order("ordem", { ascending: true })
        .limit(200),
      warnings
    )
  ]);

  return { contracts, scopeItems, warnings };
};

export const saveServiceContract = async (input: CreateServiceContractInput) => {
  if (!isSupabaseConfigured) {
    return demoContractsData().contracts[0];
  }

  const payload = {
    company_id: input.company_id,
    numero_contrato: generateNumeroContrato(),
    titulo: input.titulo.trim(),
    tipo_contrato: input.tipo_contrato,
    area_bba: input.area_bba ?? null,
    valor_mensal: input.valor_mensal ?? null,
    valor_total: input.valor_total ?? null,
    dia_vencimento: input.dia_vencimento ?? null,
    forma_pagamento: input.forma_pagamento ?? null,
    data_inicio: input.data_inicio,
    data_fim: emptyToNull(input.data_fim),
    duracao_meses: input.duracao_meses ?? null,
    renovacao_automatica: input.renovacao_automatica ?? true,
    indice_reajuste: input.indice_reajuste ?? null,
    data_assinatura: emptyToNull(input.data_assinatura),
    status: "Proposta" as ContractStatus,
    observacoes: emptyToNull(input.observacoes)
  };

  const { data, error } = await getSupabaseClient()
    .from("service_contracts")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data as ServiceContract;
};

export const updateContractStatus = async (id: string, status: ContractStatus) => {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await getSupabaseClient()
    .from("service_contracts")
    .update({ status })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as ServiceContract;
};

export const saveScopeItem = async (input: CreateScopeItemInput) => {
  if (!isSupabaseConfigured) {
    return demoContractsData().scopeItems[0];
  }

  const payload = {
    company_id: input.company_id,
    contract_id: input.contract_id,
    area_bba: input.area_bba ?? null,
    categoria: input.categoria.trim(),
    descricao: input.descricao.trim(),
    periodicidade: input.periodicidade ?? null,
    tipo_entregavel: emptyToNull(input.tipo_entregavel),
    sla_dias: input.sla_dias ?? null,
    incluso_no_valor: input.incluso_no_valor ?? true,
    valor_adicional: input.valor_adicional ?? 0,
    observacoes: emptyToNull(input.observacoes)
  };

  const { data, error } = await getSupabaseClient()
    .from("service_scope_items")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data as ServiceScopeItem;
};
