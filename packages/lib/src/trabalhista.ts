import { demoCompany } from "./mock-data";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase";

export type FuncionarioTipoContrato =
  | "CLT"
  | "PJ"
  | "Estágio"
  | "Aprendiz"
  | "Terceirizado"
  | "Temporário";

export type FuncionarioSituacao =
  | "Ativo"
  | "Afastado"
  | "Demitido"
  | "Férias"
  | "Em experiência";

export type FolhaStatus = "Calculado" | "Aprovado" | "Pago" | "Cancelado";

export type RhFuncionario = {
  id: string;
  company_id: string;
  nome: string;
  cpf?: string | null;
  data_nascimento?: string | null;
  cargo?: string | null;
  cbo_codigo?: string | null;
  departamento?: string | null;
  tipo_contrato: FuncionarioTipoContrato;
  situacao: FuncionarioSituacao;
  data_admissao: string;
  data_demissao?: string | null;
  salario_base?: number | null;
  observacoes?: string | null;
  created_at: string;
  updated_at: string;
};

export type RhFolhaPagamento = {
  id: string;
  company_id: string;
  funcionario_id: string;
  competencia: string;
  salario_bruto: number;
  desconto_inss: number;
  desconto_irpf: number;
  desconto_outros: number;
  outros_descricao?: string | null;
  adicional_hrs_extras: number;
  adicional_outros: number;
  outros_adicional_descricao?: string | null;
  salario_liquido: number;
  fgts_competencia: number;
  status: FolhaStatus;
  data_pagamento?: string | null;
  observacoes?: string | null;
  created_at: string;
  updated_at: string;
};

export type RhModuleData = {
  funcionarios: RhFuncionario[];
  folha: RhFolhaPagamento[];
  warnings: string[];
};

export type CreateFuncionarioInput = {
  company_id: string;
  nome: string;
  cpf?: string | null;
  cargo?: string | null;
  cbo_codigo?: string | null;
  departamento?: string | null;
  tipo_contrato: FuncionarioTipoContrato;
  situacao?: FuncionarioSituacao;
  data_admissao: string;
  salario_base?: number | null;
  observacoes?: string | null;
};

export type CreateFolhaPagamentoInput = {
  company_id: string;
  funcionario_id: string;
  competencia: string;
  salario_bruto: number;
  desconto_inss: number;
  desconto_irpf: number;
  desconto_outros: number;
  outros_descricao?: string | null;
  adicional_hrs_extras: number;
  adicional_outros: number;
  salario_liquido: number;
  fgts_competencia: number;
  observacoes?: string | null;
};

// ─── Cálculos trabalhistas 2025 ────────────────────────────────────────────

const INSS_2025_TIERS = [
  { ate: 1518.00, rate: 0.075 },
  { ate: 2793.88, rate: 0.09 },
  { ate: 4190.83, rate: 0.12 },
  { ate: 7786.02, rate: 0.14 }
] as const;

export const calcularINSS = (salarioBruto: number): number => {
  const base = Math.min(salarioBruto, 7786.02);
  let total = 0;
  let anterior = 0;

  for (const { ate, rate } of INSS_2025_TIERS) {
    if (base <= anterior) break;
    total += (Math.min(base, ate) - anterior) * rate;
    anterior = ate;
  }

  return Math.round(total * 100) / 100;
};

export const calcularIRPF = (baseCalculo: number): number => {
  if (baseCalculo <= 2428.80) return 0;
  if (baseCalculo <= 2826.65) return Math.max(0, Math.round((baseCalculo * 0.075 - 182.16) * 100) / 100);
  if (baseCalculo <= 3751.05) return Math.max(0, Math.round((baseCalculo * 0.15 - 394.16) * 100) / 100);
  if (baseCalculo <= 4664.68) return Math.max(0, Math.round((baseCalculo * 0.225 - 675.49) * 100) / 100);
  return Math.max(0, Math.round((baseCalculo * 0.275 - 908.74) * 100) / 100);
};

export const calcularFGTS = (salarioBruto: number): number =>
  Math.round(salarioBruto * 0.08 * 100) / 100;

export const calcularSalarioLiquido = (
  salarioBruto: number,
  descontoInss: number,
  descontoIrpf: number,
  descontoOutros: number,
  adicionalHrsExtras: number,
  adicionalOutros: number
): number =>
  Math.max(
    0,
    Math.round(
      (salarioBruto + adicionalHrsExtras + adicionalOutros -
        descontoInss - descontoIrpf - descontoOutros) * 100
    ) / 100
  );

// ─── Helpers internos ──────────────────────────────────────────────────────

const todayIso = () => new Date().toISOString().slice(0, 10);

const monthStartIso = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

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

// ─── Demo data ─────────────────────────────────────────────────────────────

const demoRhData = (): RhModuleData => {
  const companyId = demoCompany.id;
  const today = todayIso();
  const monthStart = monthStartIso();

  const funcionarios: RhFuncionario[] = [
    {
      id: "demo-func-1",
      company_id: companyId,
      nome: "Ana Paula Ferreira",
      cpf: null,
      cargo: "Gerente Financeira",
      departamento: "Financeiro",
      tipo_contrato: "CLT",
      situacao: "Ativo",
      data_admissao: "2022-03-01",
      salario_base: 8500,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: "demo-func-2",
      company_id: companyId,
      nome: "Carlos Henrique Lima",
      cpf: null,
      cargo: "Analista de TI",
      departamento: "TI",
      tipo_contrato: "CLT",
      situacao: "Ativo",
      data_admissao: "2023-07-15",
      salario_base: 5800,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: "demo-func-3",
      company_id: companyId,
      nome: "Juliana Costa",
      cpf: null,
      cargo: "Assistente Administrativa",
      departamento: "Administrativo",
      tipo_contrato: "CLT",
      situacao: "Em experiência",
      data_admissao: today,
      salario_base: 2800,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  const folha: RhFolhaPagamento[] = funcionarios
    .filter((f) => f.salario_base)
    .map((f) => {
      const bruto = Number(f.salario_base ?? 0);
      const inss = calcularINSS(bruto);
      const irpf = calcularIRPF(bruto - inss);
      const fgts = calcularFGTS(bruto);
      const liquido = calcularSalarioLiquido(bruto, inss, irpf, 0, 0, 0);

      return {
        id: `demo-folha-${f.id}`,
        company_id: companyId,
        funcionario_id: f.id,
        competencia: monthStart,
        salario_bruto: bruto,
        desconto_inss: inss,
        desconto_irpf: irpf,
        desconto_outros: 0,
        adicional_hrs_extras: 0,
        adicional_outros: 0,
        salario_liquido: liquido,
        fgts_competencia: fgts,
        status: f.situacao === "Ativo" ? "Aprovado" : "Calculado",
        data_pagamento: f.situacao === "Ativo" ? today : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } satisfies RhFolhaPagamento;
    });

  return { funcionarios, folha, warnings: [] };
};

// ─── Exported functions ────────────────────────────────────────────────────

export const fetchRhModuleData = async (
  companyId: string
): Promise<RhModuleData> => {
  if (!companyId || !isSupabaseConfigured) {
    return demoRhData();
  }

  const supabase = getSupabaseClient();
  const warnings: string[] = [];

  const [funcionarios, folha] = await Promise.all([
    selectSafely<RhFuncionario>(
      "Funcionarios",
      supabase
        .from("rh_funcionarios")
        .select("*")
        .eq("company_id", companyId)
        .order("nome", { ascending: true })
        .limit(200),
      warnings
    ),
    selectSafely<RhFolhaPagamento>(
      "Folha de pagamentos",
      supabase
        .from("rh_folha_pagamentos")
        .select("*")
        .eq("company_id", companyId)
        .order("competencia", { ascending: false })
        .limit(200),
      warnings
    )
  ]);

  return { funcionarios, folha, warnings };
};

export const saveFuncionario = async (input: CreateFuncionarioInput) => {
  if (!isSupabaseConfigured) {
    return demoRhData().funcionarios[0];
  }

  const payload = {
    company_id: input.company_id,
    nome: input.nome.trim(),
    cpf: emptyToNull(input.cpf),
    cargo: emptyToNull(input.cargo),
    cbo_codigo: emptyToNull(input.cbo_codigo),
    departamento: emptyToNull(input.departamento),
    tipo_contrato: input.tipo_contrato,
    situacao: input.situacao ?? "Em experiência",
    data_admissao: input.data_admissao,
    salario_base: input.salario_base ?? null,
    observacoes: emptyToNull(input.observacoes)
  };

  const { data, error } = await getSupabaseClient()
    .from("rh_funcionarios")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data as RhFuncionario;
};

export const updateFuncionarioSituacao = async (
  id: string,
  situacao: FuncionarioSituacao,
  data_demissao?: string | null
) => {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await getSupabaseClient()
    .from("rh_funcionarios")
    .update({ situacao, data_demissao: data_demissao ?? null })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as RhFuncionario;
};

export const saveFolhaPagamento = async (input: CreateFolhaPagamentoInput) => {
  if (!isSupabaseConfigured) {
    return demoRhData().folha[0];
  }

  const payload = {
    company_id: input.company_id,
    funcionario_id: input.funcionario_id,
    competencia: input.competencia,
    salario_bruto: input.salario_bruto,
    desconto_inss: input.desconto_inss,
    desconto_irpf: input.desconto_irpf,
    desconto_outros: input.desconto_outros,
    outros_descricao: emptyToNull(input.outros_descricao),
    adicional_hrs_extras: input.adicional_hrs_extras,
    adicional_outros: input.adicional_outros,
    salario_liquido: input.salario_liquido,
    fgts_competencia: input.fgts_competencia,
    status: "Calculado" as FolhaStatus,
    observacoes: emptyToNull(input.observacoes)
  };

  const { data, error } = await getSupabaseClient()
    .from("rh_folha_pagamentos")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data as RhFolhaPagamento;
};

export const updateFolhaStatus = async (
  id: string,
  status: FolhaStatus
) => {
  if (!isSupabaseConfigured) return null;

  const payload: Record<string, unknown> = { status };
  if (status === "Pago") {
    payload.data_pagamento = todayIso();
  }

  const { data, error } = await getSupabaseClient()
    .from("rh_folha_pagamentos")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as RhFolhaPagamento;
};
