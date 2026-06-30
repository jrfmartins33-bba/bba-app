import { demoCompany } from "./mock-data";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase";

export type LancamentoStatus = "Previsto" | "Realizado" | "Cancelado" | "Estornado";

export type CobrancaStatus =
  | "Pendente"
  | "Enviada"
  | "Paga"
  | "Atrasada"
  | "Cancelada"
  | "Estornada"
  | "Parcialmente paga";

export type FinancialConta = {
  id: string;
  company_id: string;
  tipo: string;
  nome: string;
  descricao?: string | null;
  saldo_inicial: number;
  saldo_atual: number;
  ativa: boolean;
  incluir_no_total: boolean;
  cor?: string | null;
  icone?: string | null;
  created_at: string;
  updated_at: string;
};

export type FinancialCategoria = {
  id: string;
  company_id?: string | null;
  tipo: "Receita" | "Despesa" | "Transferência";
  nome: string;
  is_sistema: boolean;
  ativa: boolean;
  ordem: number;
};

export type FinancialLancamento = {
  id: string;
  company_id: string;
  tipo: "Receita" | "Despesa" | "Transferência";
  categoria_id?: string | null;
  conta_id?: string | null;
  descricao: string;
  valor: number;
  data_competencia: string;
  data_pagamento?: string | null;
  status: LancamentoStatus;
  efetivado: boolean;
  recorrente: boolean;
  centro_custo?: string | null;
  observacoes?: string | null;
  created_at: string;
  updated_at: string;
};

export type FinancialCobranca = {
  id: string;
  company_id: string;
  numero_fatura: string;
  descricao: string;
  competencia: string;
  data_emissao: string;
  data_vencimento: string;
  data_pagamento?: string | null;
  valor: number;
  valor_desconto: number;
  valor_acrescimo: number;
  valor_total: number;
  forma_pagamento?: string | null;
  pix_chave?: string | null;
  linha_digitavel?: string | null;
  status: CobrancaStatus;
  esta_atrasada: boolean;
  observacoes?: string | null;
  created_at: string;
  updated_at: string;
};

export type FinancialModuleData = {
  contas: FinancialConta[];
  categorias: FinancialCategoria[];
  lancamentos: FinancialLancamento[];
  cobrancas: FinancialCobranca[];
  warnings: string[];
};

export type CreateLancamentoInput = {
  company_id: string;
  tipo: "Receita" | "Despesa" | "Transferência";
  categoria_id?: string | null;
  conta_id?: string | null;
  descricao: string;
  valor: number;
  data_competencia: string;
  data_pagamento?: string | null;
  status?: LancamentoStatus;
  observacoes?: string | null;
};

export type CreateCobrancaInput = {
  company_id: string;
  numero_fatura: string;
  descricao: string;
  competencia: string;
  data_vencimento: string;
  valor: number;
  forma_pagamento?: string | null;
  observacoes?: string | null;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const monthStartIso = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

const addDaysIso = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const isPast = (date?: string | null) => Boolean(date && date < todayIso());

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

const demoFinancialData = (): FinancialModuleData => {
  const companyId = demoCompany.id;
  const today = todayIso();
  const monthStart = monthStartIso();

  return {
    contas: [
      {
        id: "demo-fin-conta-1",
        company_id: companyId,
        tipo: "Conta Bancária",
        nome: "Conta Corrente Principal",
        saldo_inicial: 50000,
        saldo_atual: 68450,
        ativa: true,
        incluir_no_total: true,
        cor: "#0c1f3f",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: "demo-fin-conta-2",
        company_id: companyId,
        tipo: "Conta Digital",
        nome: "Caixa Operacional",
        saldo_inicial: 5000,
        saldo_atual: 3200,
        ativa: true,
        incluir_no_total: true,
        cor: "#b9954f",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ],
    categorias: [
      { id: "demo-cat-1", tipo: "Receita", nome: "Receita de Servicos", is_sistema: true, ativa: true, ordem: 1 },
      { id: "demo-cat-2", tipo: "Despesa", nome: "Folha de Pagamento", is_sistema: true, ativa: true, ordem: 10 },
      { id: "demo-cat-3", tipo: "Despesa", nome: "Fornecedores", is_sistema: true, ativa: true, ordem: 12 },
      { id: "demo-cat-4", tipo: "Despesa", nome: "Aluguel", is_sistema: true, ativa: true, ordem: 13 },
      { id: "demo-cat-5", tipo: "Despesa", nome: "Impostos Federais", is_sistema: true, ativa: true, ordem: 30 }
    ],
    lancamentos: [
      {
        id: "demo-lanc-1",
        company_id: companyId,
        tipo: "Receita",
        categoria_id: "demo-cat-1",
        conta_id: "demo-fin-conta-1",
        descricao: "Honorarios BBA — competencia atual",
        valor: 12500,
        data_competencia: monthStart,
        data_pagamento: today,
        status: "Realizado",
        efetivado: true,
        recorrente: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: "demo-lanc-2",
        company_id: companyId,
        tipo: "Despesa",
        categoria_id: "demo-cat-2",
        conta_id: "demo-fin-conta-1",
        descricao: "Salarios — competencia atual",
        valor: 8400,
        data_competencia: monthStart,
        data_pagamento: null,
        status: "Previsto",
        efetivado: false,
        recorrente: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: "demo-lanc-3",
        company_id: companyId,
        tipo: "Despesa",
        categoria_id: "demo-cat-4",
        conta_id: "demo-fin-conta-1",
        descricao: "Aluguel escritorio — competencia atual",
        valor: 3200,
        data_competencia: monthStart,
        data_pagamento: today,
        status: "Realizado",
        efetivado: true,
        recorrente: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ],
    cobrancas: [
      {
        id: "demo-cob-1",
        company_id: companyId,
        numero_fatura: "BBA-DEMO-001",
        descricao: "Assessoria contabil e tributaria — competencia atual",
        competencia: monthStart,
        data_emissao: monthStart,
        data_vencimento: addDaysIso(5),
        valor: 2800,
        valor_desconto: 0,
        valor_acrescimo: 0,
        valor_total: 2800,
        forma_pagamento: "PIX",
        status: "Pendente",
        esta_atrasada: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ],
    warnings: []
  };
};

export const generateNumeroFatura = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `BBA-${year}${month}-${rand}`;
};

export const fetchFinancialModuleData = async (
  companyId: string
): Promise<FinancialModuleData> => {
  if (!companyId || !isSupabaseConfigured) {
    return demoFinancialData();
  }

  const supabase = getSupabaseClient();
  const warnings: string[] = [];

  const [contas, categorias, lancamentos, cobrancas] = await Promise.all([
    selectSafely<FinancialConta>(
      "Contas financeiras",
      supabase
        .from("financial_contas")
        .select("*")
        .eq("company_id", companyId)
        .eq("ativa", true)
        .order("nome", { ascending: true })
        .limit(50),
      warnings
    ),
    selectSafely<FinancialCategoria>(
      "Categorias financeiras",
      supabase
        .from("financial_categorias")
        .select("id, company_id, tipo, nome, is_sistema, ativa, ordem")
        .or(`company_id.is.null,company_id.eq.${companyId}`)
        .eq("ativa", true)
        .order("tipo", { ascending: true })
        .order("ordem", { ascending: true })
        .limit(200),
      warnings
    ),
    selectSafely<FinancialLancamento>(
      "Lancamentos financeiros",
      supabase
        .from("financial_lancamentos")
        .select("*")
        .eq("company_id", companyId)
        .order("data_competencia", { ascending: false })
        .limit(100),
      warnings
    ),
    selectSafely<FinancialCobranca>(
      "Cobrancas",
      supabase
        .from("financial_cobrancas")
        .select("*")
        .eq("company_id", companyId)
        .order("data_vencimento", { ascending: false })
        .limit(80),
      warnings
    )
  ]);

  return { contas, categorias, lancamentos, cobrancas, warnings };
};

export const saveLancamento = async (input: CreateLancamentoInput) => {
  if (!isSupabaseConfigured) {
    return demoFinancialData().lancamentos[0];
  }

  const hasPagamento = Boolean(emptyToNull(input.data_pagamento));
  const payload = {
    company_id: input.company_id,
    tipo: input.tipo,
    categoria_id: emptyToNull(input.categoria_id?.toString()),
    conta_id: emptyToNull(input.conta_id?.toString()),
    descricao: input.descricao.trim(),
    valor: input.valor,
    data_competencia: input.data_competencia,
    data_pagamento: emptyToNull(input.data_pagamento) ?? null,
    status: hasPagamento ? "Realizado" : (input.status ?? "Previsto"),
    observacoes: emptyToNull(input.observacoes)
  };

  const { data, error } = await getSupabaseClient()
    .from("financial_lancamentos")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data as FinancialLancamento;
};

export const efetivarLancamento = async (id: string) => {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await getSupabaseClient()
    .from("financial_lancamentos")
    .update({ data_pagamento: todayIso(), status: "Realizado" })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as FinancialLancamento;
};

export const saveCobranca = async (input: CreateCobrancaInput) => {
  if (!isSupabaseConfigured) {
    return demoFinancialData().cobrancas[0];
  }

  const payload = {
    company_id: input.company_id,
    numero_fatura: input.numero_fatura,
    descricao: input.descricao.trim(),
    competencia: input.competencia,
    data_vencimento: input.data_vencimento,
    valor: input.valor,
    valor_desconto: 0,
    valor_acrescimo: 0,
    forma_pagamento: emptyToNull(input.forma_pagamento),
    status: "Pendente" as CobrancaStatus,
    esta_atrasada: isPast(input.data_vencimento),
    observacoes: emptyToNull(input.observacoes)
  };

  const { data, error } = await getSupabaseClient()
    .from("financial_cobrancas")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data as FinancialCobranca;
};

export const marcarCobrancaComoPaga = async (id: string) => {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await getSupabaseClient()
    .from("financial_cobrancas")
    .update({ data_pagamento: todayIso(), status: "Paga", esta_atrasada: false })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as FinancialCobranca;
};
