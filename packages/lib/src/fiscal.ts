import { demoCompany } from "./mock-data";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase";

export type FiscalObrigacaoStatus =
  | "Pendente"
  | "Em andamento"
  | "Transmitida"
  | "Retificada"
  | "Dispensada"
  | "Atrasada"
  | "Cancelada";

export type FiscalGuiaStatus =
  | "Pendente"
  | "Pago"
  | "Atrasado"
  | "Cancelado"
  | "Parcelado"
  | "Compensado";

export type FiscalNotaStatus =
  | "Emitida"
  | "Autorizada"
  | "Cancelada"
  | "Denegada"
  | "Inutilizada"
  | "Em processamento"
  | "Pendente";

export type FiscalObrigacao = {
  id: string;
  company_id: string;
  tipo: string;
  nome: string;
  descricao?: string | null;
  competencia: string;
  data_vencimento: string;
  data_transmissao?: string | null;
  data_retificacao?: string | null;
  status: FiscalObrigacaoStatus;
  esta_atrasada: boolean;
  numero_recibo?: string | null;
  numero_protocolo?: string | null;
  arquivo_url?: string | null;
  arquivo_nome?: string | null;
  responsavel_id?: string | null;
  observacoes?: string | null;
  created_at: string;
  updated_at: string;
};

export type FiscalGuia = {
  id: string;
  company_id: string;
  tipo_guia: string;
  tributo: string;
  codigo_receita?: string | null;
  competencia: string;
  data_vencimento: string;
  data_pagamento?: string | null;
  valor_principal: number;
  valor_multa: number;
  valor_juros: number;
  valor_total: number;
  status: FiscalGuiaStatus;
  esta_atrasada: boolean;
  linha_digitavel?: string | null;
  codigo_barras?: string | null;
  obrigacao_id?: string | null;
  observacoes?: string | null;
  created_at: string;
  updated_at: string;
};

export type FiscalNotaFiscal = {
  id: string;
  company_id: string;
  tipo: string;
  modelo?: string | null;
  serie?: string | null;
  numero?: string | null;
  natureza_operacao?: string | null;
  cfop?: string | null;
  direcao: "Emitida" | "Recebida";
  data_emissao: string;
  data_competencia?: string | null;
  emitente_cnpj?: string | null;
  emitente_razao_social?: string | null;
  destinatario_cnpj?: string | null;
  destinatario_razao_social?: string | null;
  valor_produtos: number;
  valor_servicos: number;
  valor_total: number;
  valor_icms?: number | null;
  valor_iss?: number | null;
  valor_irrf?: number | null;
  valor_inss_retido?: number | null;
  valor_pcc_retido?: number | null;
  chave_acesso?: string | null;
  numero_nfse?: string | null;
  codigo_verificacao?: string | null;
  status_sefaz: FiscalNotaStatus;
  observacoes_internas?: string | null;
  created_at: string;
  updated_at: string;
};

export type FiscalParcelamento = {
  id: string;
  company_id: string;
  programa: string;
  tributo: string;
  numero_processo?: string | null;
  orgao?: string | null;
  data_adesao: string;
  valor_total_debito: number;
  valor_entrada?: number | null;
  quantidade_parcelas: number;
  valor_parcela: number;
  dia_vencimento?: number | null;
  parcelas_pagas: number;
  parcelas_restantes: number;
  valor_pago: number;
  valor_saldo: number;
  status: string;
  observacoes?: string | null;
  created_at: string;
  updated_at: string;
};

export type FiscalCalendarioItem = {
  id: string;
  regime_tributario?: string | null;
  obrigacao: string;
  periodicidade: string;
  mes_referencia?: number | null;
  dia_vencimento?: number | null;
  descricao_vencimento?: string | null;
  orgao_entrega?: string | null;
  base_legal?: string | null;
  ativo: boolean;
  created_at: string;
};

export type FiscalModuleData = {
  obrigacoes: FiscalObrigacao[];
  guias: FiscalGuia[];
  notas: FiscalNotaFiscal[];
  parcelamentos: FiscalParcelamento[];
  calendario: FiscalCalendarioItem[];
  warnings: string[];
};

export type CreateFiscalObrigacaoInput = {
  company_id: string;
  tipo: string;
  nome: string;
  descricao?: string | null;
  competencia: string;
  data_vencimento: string;
  status?: FiscalObrigacaoStatus;
  observacoes?: string | null;
};

export type CreateFiscalGuiaInput = {
  company_id: string;
  tipo_guia: string;
  tributo: string;
  codigo_receita?: string | null;
  competencia: string;
  data_vencimento: string;
  valor_principal: number;
  valor_multa?: number;
  valor_juros?: number;
  status?: FiscalGuiaStatus;
  linha_digitavel?: string | null;
  obrigacao_id?: string | null;
  observacoes?: string | null;
};

export type CreateFiscalNotaInput = {
  company_id: string;
  tipo: string;
  direcao: "Emitida" | "Recebida";
  numero?: string | null;
  serie?: string | null;
  natureza_operacao?: string | null;
  cfop?: string | null;
  data_emissao: string;
  data_competencia?: string | null;
  emitente_cnpj?: string | null;
  emitente_razao_social?: string | null;
  destinatario_cnpj?: string | null;
  destinatario_razao_social?: string | null;
  valor_produtos?: number;
  valor_servicos?: number;
  valor_total: number;
  valor_icms?: number;
  valor_iss?: number;
  chave_acesso?: string | null;
  status_sefaz?: FiscalNotaStatus;
  observacoes_internas?: string | null;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const monthStartIso = (date = new Date()) =>
  new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);

const addDaysIso = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const isPast = (date?: string | null) => Boolean(date && date < todayIso());

const emptyToNull = (value?: string | null) => {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
};

const sortByDate = <T extends { data_vencimento?: string | null }>(rows: T[]) =>
  [...rows].sort((a, b) =>
    String(a.data_vencimento ?? "").localeCompare(String(b.data_vencimento ?? ""))
  );

const demoFiscalData = (): FiscalModuleData => {
  const companyId = demoCompany.id;
  const competencia = monthStartIso();

  return {
    obrigacoes: [
      {
        id: "demo-fiscal-obrigacao-1",
        company_id: companyId,
        tipo: "PGDAS-D",
        nome: "Apuracao PGDAS-D",
        descricao: "Conferencia de receitas e emissao da declaracao mensal.",
        competencia,
        data_vencimento: addDaysIso(7),
        status: "Em andamento",
        esta_atrasada: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: "demo-fiscal-obrigacao-2",
        company_id: companyId,
        tipo: "NFSE-Mensal",
        nome: "Livro fiscal de servicos",
        descricao: "Fechamento mensal de notas emitidas e recebidas.",
        competencia,
        data_vencimento: addDaysIso(12),
        status: "Pendente",
        esta_atrasada: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ],
    guias: [
      {
        id: "demo-fiscal-guia-1",
        company_id: companyId,
        tipo_guia: "DAS",
        tributo: "Simples Nacional",
        competencia,
        data_vencimento: addDaysIso(7),
        valor_principal: 1840,
        valor_multa: 0,
        valor_juros: 0,
        valor_total: 1840,
        status: "Pendente",
        esta_atrasada: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ],
    notas: [
      {
        id: "demo-fiscal-nota-1",
        company_id: companyId,
        tipo: "NFSE",
        numero: "2026-0012",
        direcao: "Emitida",
        data_emissao: todayIso(),
        data_competencia: competencia,
        destinatario_razao_social: "Cliente exemplo",
        valor_produtos: 0,
        valor_servicos: 12500,
        valor_total: 12500,
        status_sefaz: "Autorizada",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ],
    parcelamentos: [],
    calendario: [
      {
        id: "demo-fiscal-cal-1",
        regime_tributario: "SN",
        obrigacao: "PGDAS-D",
        periodicidade: "Mensal",
        dia_vencimento: 20,
        descricao_vencimento: "Dia 20 do mes seguinte",
        orgao_entrega: "Receita Federal",
        base_legal: "LC 123/2006",
        ativo: true,
        created_at: new Date().toISOString()
      }
    ],
    warnings: []
  };
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

export const fetchFiscalModuleData = async (
  companyId: string,
  regimeCode?: string | null
): Promise<FiscalModuleData> => {
  if (!companyId || !isSupabaseConfigured) {
    return demoFiscalData();
  }

  const supabase = getSupabaseClient();
  const warnings: string[] = [];
  const calendarQuery = regimeCode
    ? supabase
        .from("fiscal_calendario")
        .select("*")
        .eq("ativo", true)
        .or(`regime_tributario.is.null,regime_tributario.eq.${regimeCode}`)
        .order("periodicidade", { ascending: true })
    : supabase
        .from("fiscal_calendario")
        .select("*")
        .eq("ativo", true)
        .is("regime_tributario", null)
        .order("periodicidade", { ascending: true });

  const [obrigacoes, guias, notas, parcelamentos, calendario] = await Promise.all([
    selectSafely<FiscalObrigacao>(
      "Obrigacoes fiscais",
      supabase
        .from("fiscal_obrigacoes")
        .select("*")
        .eq("company_id", companyId)
        .order("data_vencimento", { ascending: true })
        .limit(80),
      warnings
    ),
    selectSafely<FiscalGuia>(
      "Guias fiscais",
      supabase
        .from("fiscal_guias")
        .select("*")
        .eq("company_id", companyId)
        .order("data_vencimento", { ascending: true })
        .limit(80),
      warnings
    ),
    selectSafely<FiscalNotaFiscal>(
      "Notas fiscais",
      supabase
        .from("fiscal_notas_fiscais")
        .select("*")
        .eq("company_id", companyId)
        .order("data_emissao", { ascending: false })
        .limit(80),
      warnings
    ),
    selectSafely<FiscalParcelamento>(
      "Parcelamentos",
      supabase
        .from("fiscal_parcelamentos")
        .select("*")
        .eq("company_id", companyId)
        .order("data_adesao", { ascending: false })
        .limit(40),
      warnings
    ),
    selectSafely<FiscalCalendarioItem>(
      "Calendario fiscal",
      calendarQuery.limit(80),
      warnings
    )
  ]);

  return {
    obrigacoes: sortByDate(obrigacoes),
    guias: sortByDate(guias),
    notas,
    parcelamentos,
    calendario,
    warnings
  };
};

export const saveFiscalObrigacao = async (
  input: CreateFiscalObrigacaoInput
) => {
  if (!isSupabaseConfigured) {
    return demoFiscalData().obrigacoes[0];
  }

  const payload = {
    ...input,
    descricao: emptyToNull(input.descricao),
    observacoes: emptyToNull(input.observacoes),
    status: input.status ?? "Pendente",
    esta_atrasada: isPast(input.data_vencimento)
  };

  const { data, error } = await getSupabaseClient()
    .from("fiscal_obrigacoes")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data as FiscalObrigacao;
};

export const updateFiscalObrigacaoStatus = async (
  id: string,
  status: FiscalObrigacaoStatus
) => {
  if (!isSupabaseConfigured) return null;

  const payload = {
    status,
    data_transmissao:
      status === "Transmitida" ? new Date().toISOString() : undefined
  };

  const { data, error } = await getSupabaseClient()
    .from("fiscal_obrigacoes")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as FiscalObrigacao;
};

export const saveFiscalGuia = async (input: CreateFiscalGuiaInput) => {
  if (!isSupabaseConfigured) {
    return demoFiscalData().guias[0];
  }

  const payload = {
    ...input,
    codigo_receita: emptyToNull(input.codigo_receita),
    linha_digitavel: emptyToNull(input.linha_digitavel),
    observacoes: emptyToNull(input.observacoes),
    valor_multa: input.valor_multa ?? 0,
    valor_juros: input.valor_juros ?? 0,
    status: input.status ?? "Pendente",
    esta_atrasada: isPast(input.data_vencimento)
  };

  const { data, error } = await getSupabaseClient()
    .from("fiscal_guias")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data as FiscalGuia;
};

export const markFiscalGuiaAsPaid = async (id: string) => {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await getSupabaseClient()
    .from("fiscal_guias")
    .update({
      status: "Pago",
      data_pagamento: todayIso(),
      esta_atrasada: false
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as FiscalGuia;
};

export const saveFiscalNota = async (input: CreateFiscalNotaInput) => {
  if (!isSupabaseConfigured) {
    return demoFiscalData().notas[0];
  }

  const payload = {
    ...input,
    numero: emptyToNull(input.numero),
    serie: emptyToNull(input.serie),
    natureza_operacao: emptyToNull(input.natureza_operacao),
    cfop: emptyToNull(input.cfop),
    data_competencia: emptyToNull(input.data_competencia),
    emitente_cnpj: emptyToNull(input.emitente_cnpj),
    emitente_razao_social: emptyToNull(input.emitente_razao_social),
    destinatario_cnpj: emptyToNull(input.destinatario_cnpj),
    destinatario_razao_social: emptyToNull(input.destinatario_razao_social),
    chave_acesso: emptyToNull(input.chave_acesso),
    observacoes_internas: emptyToNull(input.observacoes_internas),
    valor_produtos: input.valor_produtos ?? 0,
    valor_servicos: input.valor_servicos ?? 0,
    valor_icms: input.valor_icms ?? 0,
    valor_iss: input.valor_iss ?? 0,
    status_sefaz: input.status_sefaz ?? "Emitida"
  };

  const { data, error } = await getSupabaseClient()
    .from("fiscal_notas_fiscais")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data as FiscalNotaFiscal;
};

const allowedObrigacaoTipos = new Set([
  "DCTF",
  "DCTF-WEB",
  "ECD",
  "ECF",
  "EFD-ICMS-IPI",
  "EFD-Contribuicoes",
  "SPED-Fiscal",
  "SPED-Contabil",
  "PGDAS-D",
  "DASN-SIMEI",
  "DEFIS",
  "DIRF",
  "DIMOB",
  "RAIS",
  "CAGED",
  "eSocial",
  "DCTFWeb-eSocial",
  "GIA",
  "GIA-ST",
  "DIEF",
  "DeSTDA",
  "DES",
  "DAMSP",
  "NFSE-Mensal",
  "Livro-ISS",
  "Declaracao",
  "Relatorio",
  "Outras"
]);

const inferObrigacaoTipo = (obrigacao: string) =>
  allowedObrigacaoTipos.has(obrigacao) ? obrigacao : "Outras";

const dueDateFromCalendar = (referenceDate: Date, day?: number | null) => {
  const dueMonth = referenceDate.getMonth() + 1;
  const dueYear = referenceDate.getFullYear() + (dueMonth > 11 ? 1 : 0);
  const normalizedMonth = dueMonth % 12;
  const lastDay = new Date(dueYear, normalizedMonth + 1, 0).getDate();
  const dueDay = Math.min(day ?? lastDay, lastDay);
  return new Date(dueYear, normalizedMonth, dueDay).toISOString().slice(0, 10);
};

export const generateFiscalObligationsFromCalendar = async (
  companyId: string,
  regimeCode?: string | null,
  referenceDate = new Date()
) => {
  if (!companyId || !isSupabaseConfigured) {
    return { created: 0, skipped: 0 };
  }

  const supabase = getSupabaseClient();
  const competencia = monthStartIso(referenceDate);
  const { calendario, obrigacoes } = await fetchFiscalModuleData(
    companyId,
    regimeCode
  );
  const existingNames = new Set(
    obrigacoes
      .filter((row) => row.competencia === competencia)
      .map((row) => row.nome)
  );
  const rows = calendario
    .filter((item) => item.ativo)
    .filter((item) => !existingNames.has(item.obrigacao))
    .map((item) => {
      const dataVencimento = dueDateFromCalendar(
        referenceDate,
        item.dia_vencimento
      );

      return {
        company_id: companyId,
        tipo: inferObrigacaoTipo(item.obrigacao),
        nome: item.obrigacao,
        descricao: item.descricao_vencimento,
        competencia,
        data_vencimento: dataVencimento,
        status: "Pendente" as FiscalObrigacaoStatus,
        esta_atrasada: isPast(dataVencimento),
        observacoes: item.base_legal
      };
    });

  if (!rows.length) {
    return { created: 0, skipped: calendario.length };
  }

  const { error } = await supabase.from("fiscal_obrigacoes").insert(rows);

  if (error) throw error;

  return { created: rows.length, skipped: calendario.length - rows.length };
};
