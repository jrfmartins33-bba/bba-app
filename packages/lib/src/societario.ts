import { demoCompany } from "./mock-data";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SocioTipo = "PF" | "PJ";

export type SocioStatus = "Ativo" | "Cedente" | "Falecido" | "Excluído";

export type SocioEstadoCivil =
  | "Solteiro"
  | "Casado"
  | "Divorciado"
  | "Viúvo"
  | "União estável"
  | "Separado";

export type AlteracaoTipo =
  | "Constituição"
  | "Alteração"
  | "Consolidação"
  | "Distrato"
  | "Transferência de Cotas"
  | "Aumento de Capital"
  | "Redução de Capital"
  | "Mudança de Objeto Social"
  | "Mudança de Endereço"
  | "Mudança de Nome";

export type AlteracaoStatus =
  | "Em elaboração"
  | "Assinado"
  | "Registrado"
  | "Arquivado";

export type AssembleiaTipo =
  | "AGO"
  | "AGE"
  | "Reunião de Diretoria"
  | "Reunião de Sócios"
  | "Outros";

export type AssembleiaStatus = "Convocada" | "Realizada" | "Cancelada";

export type Socio = {
  id: string;
  company_id: string;
  nome: string;
  cpf_cnpj?: string | null;
  tipo: SocioTipo;
  nacionalidade?: string | null;
  profissao?: string | null;
  estado_civil?: SocioEstadoCivil | null;
  percentual_participacao: number;
  valor_cotas: number;
  numero_cotas?: number | null;
  data_entrada: string;
  data_saida?: string | null;
  status: SocioStatus;
  observacoes?: string | null;
  created_at: string;
  updated_at: string;
};

export type CapitalSocial = {
  id: string;
  company_id: string;
  valor_total: number;
  valor_integralizado: number;
  moeda: string;
  data_referencia: string;
  observacoes?: string | null;
  created_at: string;
  updated_at: string;
};

export type Alteracao = {
  id: string;
  company_id: string;
  tipo: AlteracaoTipo;
  numero_alteracao?: number | null;
  data_assinatura?: string | null;
  data_registro?: string | null;
  nire?: string | null;
  junta_comercial?: string | null;
  descricao?: string | null;
  status: AlteracaoStatus;
  observacoes?: string | null;
  created_at: string;
  updated_at: string;
};

export type Assembleia = {
  id: string;
  company_id: string;
  tipo: AssembleiaTipo;
  data_convocacao?: string | null;
  data_realizacao: string;
  pauta?: string | null;
  deliberacoes?: string | null;
  quorum_percentual?: number | null;
  status: AssembleiaStatus;
  observacoes?: string | null;
  created_at: string;
  updated_at: string;
};

export type SocietarioModuleData = {
  socios: Socio[];
  capital: CapitalSocial[];
  alteracoes: Alteracao[];
  assembleias: Assembleia[];
  warnings: string[];
};

export type CreateSocioInput = {
  company_id: string;
  nome: string;
  cpf_cnpj?: string | null;
  tipo: SocioTipo;
  nacionalidade?: string | null;
  profissao?: string | null;
  estado_civil?: SocioEstadoCivil | null;
  percentual_participacao: number;
  valor_cotas: number;
  numero_cotas?: number | null;
  data_entrada: string;
  observacoes?: string | null;
};

export type CreateCapitalSocialInput = {
  company_id: string;
  valor_total: number;
  valor_integralizado: number;
  data_referencia: string;
  observacoes?: string | null;
};

export type CreateAlteracaoInput = {
  company_id: string;
  tipo: AlteracaoTipo;
  numero_alteracao?: number | null;
  data_assinatura?: string | null;
  data_registro?: string | null;
  nire?: string | null;
  junta_comercial?: string | null;
  descricao?: string | null;
  status?: AlteracaoStatus;
  observacoes?: string | null;
};

export type CreateAssembleiaInput = {
  company_id: string;
  tipo: AssembleiaTipo;
  data_convocacao?: string | null;
  data_realizacao: string;
  pauta?: string | null;
  deliberacoes?: string | null;
  quorum_percentual?: number | null;
  status?: AssembleiaStatus;
  observacoes?: string | null;
};

// ─── Helpers internos ──────────────────────────────────────────────────────────

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

// ─── Demo data ─────────────────────────────────────────────────────────────────

const demoSocietarioData = (): SocietarioModuleData => {
  const companyId = demoCompany.id;
  const now = new Date().toISOString();

  const socios: Socio[] = [
    {
      id: "demo-socio-1",
      company_id: companyId,
      nome: "João Paulo Rodrigues",
      cpf_cnpj: "123.456.789-00",
      tipo: "PF",
      nacionalidade: "Brasileira",
      profissao: "Empresário",
      estado_civil: "Casado",
      percentual_participacao: 60,
      valor_cotas: 60000,
      numero_cotas: 60000,
      data_entrada: "2020-01-15",
      status: "Ativo",
      created_at: now,
      updated_at: now
    },
    {
      id: "demo-socio-2",
      company_id: companyId,
      nome: "Maria Clara Santos",
      cpf_cnpj: "987.654.321-00",
      tipo: "PF",
      nacionalidade: "Brasileira",
      profissao: "Administradora",
      estado_civil: "Solteiro",
      percentual_participacao: 40,
      valor_cotas: 40000,
      numero_cotas: 40000,
      data_entrada: "2020-01-15",
      status: "Ativo",
      created_at: now,
      updated_at: now
    }
  ];

  const capital: CapitalSocial[] = [
    {
      id: "demo-capital-1",
      company_id: companyId,
      valor_total: 100000,
      valor_integralizado: 100000,
      moeda: "BRL",
      data_referencia: "2020-01-15",
      observacoes: "Capital social integralizado na constituição",
      created_at: now,
      updated_at: now
    }
  ];

  const alteracoes: Alteracao[] = [
    {
      id: "demo-alt-1",
      company_id: companyId,
      tipo: "Constituição",
      numero_alteracao: 1,
      data_assinatura: "2020-01-15",
      data_registro: "2020-02-01",
      nire: "35901234560",
      junta_comercial: "JUCESP",
      descricao: "Ato constitutivo da sociedade limitada com capital de R$ 100.000,00",
      status: "Registrado",
      created_at: now,
      updated_at: now
    },
    {
      id: "demo-alt-2",
      company_id: companyId,
      tipo: "Alteração",
      numero_alteracao: 2,
      data_assinatura: "2026-06-01",
      junta_comercial: "JUCESP",
      descricao: "Alteração do objeto social e inclusão de atividades de consultoria",
      status: "Em elaboração",
      created_at: now,
      updated_at: now
    }
  ];

  const assembleias: Assembleia[] = [
    {
      id: "demo-asm-1",
      company_id: companyId,
      tipo: "AGO",
      data_convocacao: "2026-04-10",
      data_realizacao: "2026-04-30",
      pauta: "Aprovação do balanço 2025 e distribuição de lucros",
      deliberacoes: "Aprovado por unanimidade. Distribuição de R$ 150.000,00 em lucros.",
      quorum_percentual: 100,
      status: "Realizada",
      created_at: now,
      updated_at: now
    },
    {
      id: "demo-asm-2",
      company_id: companyId,
      tipo: "AGE",
      data_convocacao: "2026-06-30",
      data_realizacao: "2026-07-15",
      pauta: "Aprovação da 2ª alteração contratual — mudança de objeto social",
      status: "Convocada",
      created_at: now,
      updated_at: now
    }
  ];

  return { socios, capital, alteracoes, assembleias, warnings: [] };
};

// ─── Exported functions ────────────────────────────────────────────────────────

export const fetchSocietarioModuleData = async (
  companyId: string
): Promise<SocietarioModuleData> => {
  if (!companyId || !isSupabaseConfigured) {
    return demoSocietarioData();
  }

  const supabase = getSupabaseClient();
  const warnings: string[] = [];

  const [socios, capital, alteracoes, assembleias] = await Promise.all([
    selectSafely<Socio>(
      "Sócios",
      supabase
        .from("societario_socios")
        .select("*")
        .eq("company_id", companyId)
        .order("percentual_participacao", { ascending: false })
        .limit(100),
      warnings
    ),
    selectSafely<CapitalSocial>(
      "Capital social",
      supabase
        .from("societario_capital_social")
        .select("*")
        .eq("company_id", companyId)
        .order("data_referencia", { ascending: false })
        .limit(20),
      warnings
    ),
    selectSafely<Alteracao>(
      "Alterações",
      supabase
        .from("societario_alteracoes")
        .select("*")
        .eq("company_id", companyId)
        .order("data_assinatura", { ascending: false })
        .limit(100),
      warnings
    ),
    selectSafely<Assembleia>(
      "Assembleias",
      supabase
        .from("societario_assembleias")
        .select("*")
        .eq("company_id", companyId)
        .order("data_realizacao", { ascending: false })
        .limit(100),
      warnings
    )
  ]);

  return { socios, capital, alteracoes, assembleias, warnings };
};

export const saveSocio = async (input: CreateSocioInput): Promise<Socio> => {
  if (!isSupabaseConfigured) {
    return demoSocietarioData().socios[0]!;
  }

  const payload = {
    company_id: input.company_id,
    nome: input.nome.trim(),
    cpf_cnpj: emptyToNull(input.cpf_cnpj),
    tipo: input.tipo,
    nacionalidade: emptyToNull(input.nacionalidade) ?? "Brasileira",
    profissao: emptyToNull(input.profissao),
    estado_civil: input.estado_civil ?? null,
    percentual_participacao: input.percentual_participacao,
    valor_cotas: input.valor_cotas,
    numero_cotas: input.numero_cotas ?? null,
    data_entrada: input.data_entrada,
    status: "Ativo" as SocioStatus,
    observacoes: emptyToNull(input.observacoes)
  };

  const { data, error } = await getSupabaseClient()
    .from("societario_socios")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data as Socio;
};

export const updateSocioStatus = async (
  id: string,
  status: SocioStatus,
  data_saida?: string | null
): Promise<Socio> => {
  if (!isSupabaseConfigured) return demoSocietarioData().socios[0]!;

  const { data, error } = await getSupabaseClient()
    .from("societario_socios")
    .update({ status, data_saida: data_saida ?? null })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as Socio;
};

export const saveCapitalSocial = async (
  input: CreateCapitalSocialInput
): Promise<CapitalSocial> => {
  if (!isSupabaseConfigured) {
    return demoSocietarioData().capital[0]!;
  }

  const payload = {
    company_id: input.company_id,
    valor_total: input.valor_total,
    valor_integralizado: input.valor_integralizado,
    moeda: "BRL",
    data_referencia: input.data_referencia,
    observacoes: emptyToNull(input.observacoes)
  };

  const { data, error } = await getSupabaseClient()
    .from("societario_capital_social")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data as CapitalSocial;
};

export const saveAlteracao = async (
  input: CreateAlteracaoInput
): Promise<Alteracao> => {
  if (!isSupabaseConfigured) {
    return demoSocietarioData().alteracoes[0]!;
  }

  const payload = {
    company_id: input.company_id,
    tipo: input.tipo,
    numero_alteracao: input.numero_alteracao ?? null,
    data_assinatura: input.data_assinatura ?? null,
    data_registro: input.data_registro ?? null,
    nire: emptyToNull(input.nire),
    junta_comercial: emptyToNull(input.junta_comercial),
    descricao: emptyToNull(input.descricao),
    status: input.status ?? "Em elaboração",
    observacoes: emptyToNull(input.observacoes)
  };

  const { data, error } = await getSupabaseClient()
    .from("societario_alteracoes")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data as Alteracao;
};

export const updateAlteracaoStatus = async (
  id: string,
  status: AlteracaoStatus
): Promise<Alteracao> => {
  if (!isSupabaseConfigured) return demoSocietarioData().alteracoes[0]!;

  const { data, error } = await getSupabaseClient()
    .from("societario_alteracoes")
    .update({ status })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as Alteracao;
};

export const saveAssembleia = async (
  input: CreateAssembleiaInput
): Promise<Assembleia> => {
  if (!isSupabaseConfigured) {
    return demoSocietarioData().assembleias[0]!;
  }

  const payload = {
    company_id: input.company_id,
    tipo: input.tipo,
    data_convocacao: input.data_convocacao ?? null,
    data_realizacao: input.data_realizacao,
    pauta: emptyToNull(input.pauta),
    deliberacoes: emptyToNull(input.deliberacoes),
    quorum_percentual: input.quorum_percentual ?? null,
    status: input.status ?? "Convocada",
    observacoes: emptyToNull(input.observacoes)
  };

  const { data, error } = await getSupabaseClient()
    .from("societario_assembleias")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data as Assembleia;
};

export const updateAssembleiaStatus = async (
  id: string,
  status: AssembleiaStatus
): Promise<Assembleia> => {
  if (!isSupabaseConfigured) return demoSocietarioData().assembleias[0]!;

  const { data, error } = await getSupabaseClient()
    .from("societario_assembleias")
    .update({ status })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as Assembleia;
};

void todayIso;
