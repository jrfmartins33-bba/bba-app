import { getSupabaseClient, isSupabaseConfigured } from "./supabase";
import type { Company, TaxRegime } from "./types";

export type ClientCompanyProfile = {
  id?: string;
  company_id: string;
  razao_social: string;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  cpf?: string | null;
  inscricao_estadual?: string | null;
  inscricao_municipal?: string | null;
  inscricao_suframa?: string | null;
  nire?: string | null;
  regime_tributario?: string | null;
  natureza_juridica?: string | null;
  cnae_principal?: string | null;
  porte?: string | null;
  optante_simples: boolean;
  optante_mei: boolean;
  data_abertura?: string | null;
  data_opcao_simples?: string | null;
  receita_bruta_anual?: number | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  municipio_codigo_ibge?: string | null;
  uf_sigla?: string | null;
  pais_codigo_bacen?: string | null;
  email_principal?: string | null;
  email_contador?: string | null;
  telefone_principal?: string | null;
  whatsapp?: string | null;
  site?: string | null;
  banco_codigo?: string | null;
  banco_agencia?: string | null;
  banco_conta?: string | null;
  banco_tipo_conta?: string | null;
  banco_pix?: string | null;
  status: string;
  data_inicio_relacao?: string | null;
  data_fim_relacao?: string | null;
  tem_funcionarios: boolean;
  quantidade_funcionarios: number;
  tem_estoque: boolean;
  tem_filiais: boolean;
  emite_nfe: boolean;
  emite_nfse: boolean;
  emite_nfce: boolean;
  observacoes?: string | null;
  tags?: string[] | null;
};

export type ReferenceOption = {
  value: string;
  label: string;
  description?: string;
};

export type ClientRegistrationReferences = {
  regimes: ReferenceOption[];
  naturezas: ReferenceOption[];
  cnaes: ReferenceOption[];
  ufs: ReferenceOption[];
  municipios: ReferenceOption[];
  bancos: ReferenceOption[];
};

const emptyToNull = (value?: string | null) => {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
};

const normalizeCnpjDigits = (value?: string | null) => {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits.length === 14 ? digits : null;
};

const taxRegimeByClientCode: Record<string, TaxRegime> = {
  MEI: "mei",
  SN: "simples_nacional",
  LP: "lucro_presumido",
  LR: "lucro_real"
};

export const clientRegimeFromTaxRegime = (regime?: TaxRegime | null) => {
  switch (regime) {
    case "mei":
      return "MEI";
    case "simples_nacional":
      return "SN";
    case "lucro_presumido":
      return "LP";
    case "lucro_real":
      return "LR";
    default:
      return "";
  }
};

const mapClientRegimeToTaxRegime = (regime?: string | null) =>
  regime ? taxRegimeByClientCode[regime] ?? null : null;

export const createDefaultClientProfile = (
  company: Company
): ClientCompanyProfile => ({
  company_id: company.id,
  razao_social: company.name,
  nome_fantasia: company.name,
  cnpj: company.cnpj ?? null,
  cpf: null,
  inscricao_estadual: null,
  inscricao_municipal: null,
  inscricao_suframa: null,
  nire: null,
  regime_tributario: clientRegimeFromTaxRegime(company.tax_regime),
  natureza_juridica: null,
  cnae_principal: null,
  porte: null,
  optante_simples: company.tax_regime === "simples_nacional",
  optante_mei: company.tax_regime === "mei",
  data_abertura: null,
  data_opcao_simples: null,
  receita_bruta_anual: null,
  cep: null,
  logradouro: null,
  numero: null,
  complemento: null,
  bairro: null,
  municipio_codigo_ibge: null,
  uf_sigla: null,
  pais_codigo_bacen: "1058",
  email_principal: null,
  email_contador: null,
  telefone_principal: company.main_phone ?? null,
  whatsapp: null,
  site: null,
  banco_codigo: null,
  banco_agencia: null,
  banco_conta: null,
  banco_tipo_conta: null,
  banco_pix: null,
  status: "Ativo",
  data_inicio_relacao: null,
  data_fim_relacao: null,
  tem_funcionarios: false,
  quantidade_funcionarios: 0,
  tem_estoque: false,
  tem_filiais: false,
  emite_nfe: false,
  emite_nfse: false,
  emite_nfce: false,
  observacoes: null,
  tags: []
});

const fallbackReferences: ClientRegistrationReferences = {
  regimes: [
    { value: "MEI", label: "MEI" },
    { value: "SN", label: "Simples Nacional" },
    { value: "LP", label: "Lucro Presumido" },
    { value: "LR", label: "Lucro Real" },
    { value: "LA", label: "Lucro Arbitrado" },
    { value: "ISENTO", label: "Isento / Imune" }
  ],
  naturezas: [
    { value: "2062", label: "2062 - Sociedade Empresaria Limitada" },
    { value: "2135", label: "2135 - Empresario Individual" },
    { value: "2305", label: "2305 - Sociedade de Advogados" },
    { value: "3999", label: "3999 - Associacao Privada" }
  ],
  cnaes: [
    { value: "6204-0/00", label: "6204-0/00 - Consultoria em TI" },
    { value: "4781-4/00", label: "4781-4/00 - Vestuario" },
    { value: "4120-4/00", label: "4120-4/00 - Construcao de edificios" },
    { value: "6920-6/02", label: "6920-6/02 - Consultoria contabil e tributaria" }
  ],
  ufs: [
    { value: "CE", label: "CE" },
    { value: "GO", label: "GO" },
    { value: "SP", label: "SP" }
  ],
  municipios: [
    { value: "2304400", label: "2304400 - Fortaleza/CE" },
    { value: "5208707", label: "5208707 - Goiania/GO" },
    { value: "3550308", label: "3550308 - Sao Paulo/SP" }
  ],
  bancos: [
    { value: "001", label: "001 - Banco do Brasil" },
    { value: "033", label: "033 - Santander" },
    { value: "104", label: "104 - Caixa" },
    { value: "237", label: "237 - Bradesco" },
    { value: "341", label: "341 - Itau" }
  ]
};

export const fetchClientRegistrationReferences =
  async (): Promise<ClientRegistrationReferences> => {
    if (!isSupabaseConfigured) {
      return fallbackReferences;
    }

    const supabase = getSupabaseClient();

    const [regimes, naturezas, cnaes, ufs, municipios, bancos] =
      await Promise.all([
        supabase
          .from("ref_regimes_tributarios")
          .select("codigo,nome")
          .order("id", { ascending: true }),
        supabase
          .from("ref_naturezas_juridicas")
          .select("codigo,descricao")
          .order("codigo", { ascending: true })
          .limit(120),
        supabase
          .from("ref_cnae")
          .select("codigo,descricao")
          .order("codigo", { ascending: true })
          .limit(160),
        supabase.from("ref_ufs").select("sigla,nome").order("sigla"),
        supabase
          .from("ref_municipios")
          .select("codigo_ibge,nome,uf_sigla")
          .order("nome")
          .limit(220),
        supabase
          .from("ref_bancos")
          .select("codigo_compe,nome,nome_curto")
          .not("codigo_compe", "is", null)
          .order("codigo_compe")
          .limit(120)
      ]);

    return {
      regimes: regimes.error
        ? fallbackReferences.regimes
        : (regimes.data ?? []).map((row) => ({
            value: row.codigo,
            label: row.nome
          })),
      naturezas: naturezas.error
        ? fallbackReferences.naturezas
        : (naturezas.data ?? []).map((row) => ({
            value: row.codigo,
            label: `${row.codigo} - ${row.descricao}`
          })),
      cnaes: cnaes.error
        ? fallbackReferences.cnaes
        : (cnaes.data ?? []).map((row) => ({
            value: row.codigo,
            label: `${row.codigo} - ${row.descricao}`
          })),
      ufs: ufs.error
        ? fallbackReferences.ufs
        : (ufs.data ?? []).map((row) => ({
            value: row.sigla,
            label: `${row.sigla} - ${row.nome}`
          })),
      municipios: municipios.error
        ? fallbackReferences.municipios
        : (municipios.data ?? []).map((row) => ({
            value: row.codigo_ibge,
            label: `${row.codigo_ibge} - ${row.nome}/${row.uf_sigla}`
          })),
      bancos: bancos.error
        ? fallbackReferences.bancos
        : (bancos.data ?? []).map((row) => ({
            value: row.codigo_compe,
            label: `${row.codigo_compe} - ${row.nome_curto ?? row.nome}`
          }))
    };
  };

export const fetchClientCompanyProfile = async (
  companyId: string
): Promise<ClientCompanyProfile | null> => {
  if (!companyId || !isSupabaseConfigured) {
    return null;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("client_companies")
    .select("*")
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as ClientCompanyProfile | null) ?? null;
};

export const saveClientCompanyProfile = async (
  profile: ClientCompanyProfile
) => {
  if (!isSupabaseConfigured) {
    return profile;
  }

  const supabase = getSupabaseClient();
  const payload = {
    ...profile,
    razao_social: profile.razao_social.trim(),
    nome_fantasia: emptyToNull(profile.nome_fantasia),
    cnpj: emptyToNull(profile.cnpj),
    cpf: emptyToNull(profile.cpf),
    inscricao_estadual: emptyToNull(profile.inscricao_estadual),
    inscricao_municipal: emptyToNull(profile.inscricao_municipal),
    inscricao_suframa: emptyToNull(profile.inscricao_suframa),
    nire: emptyToNull(profile.nire),
    regime_tributario: emptyToNull(profile.regime_tributario),
    natureza_juridica: emptyToNull(profile.natureza_juridica),
    cnae_principal: emptyToNull(profile.cnae_principal),
    porte: emptyToNull(profile.porte),
    data_abertura: emptyToNull(profile.data_abertura),
    data_opcao_simples: emptyToNull(profile.data_opcao_simples),
    receita_bruta_anual: profile.receita_bruta_anual ?? null,
    cep: emptyToNull(profile.cep),
    logradouro: emptyToNull(profile.logradouro),
    numero: emptyToNull(profile.numero),
    complemento: emptyToNull(profile.complemento),
    bairro: emptyToNull(profile.bairro),
    municipio_codigo_ibge: emptyToNull(profile.municipio_codigo_ibge),
    uf_sigla: emptyToNull(profile.uf_sigla),
    pais_codigo_bacen: emptyToNull(profile.pais_codigo_bacen) ?? "1058",
    email_principal: emptyToNull(profile.email_principal),
    email_contador: emptyToNull(profile.email_contador),
    telefone_principal: emptyToNull(profile.telefone_principal),
    whatsapp: emptyToNull(profile.whatsapp),
    site: emptyToNull(profile.site),
    banco_codigo: emptyToNull(profile.banco_codigo),
    banco_agencia: emptyToNull(profile.banco_agencia),
    banco_conta: emptyToNull(profile.banco_conta),
    banco_tipo_conta: emptyToNull(profile.banco_tipo_conta),
    banco_pix: emptyToNull(profile.banco_pix),
    data_inicio_relacao: emptyToNull(profile.data_inicio_relacao),
    data_fim_relacao: emptyToNull(profile.data_fim_relacao),
    quantidade_funcionarios: Number(profile.quantidade_funcionarios ?? 0),
    observacoes: emptyToNull(profile.observacoes),
    tags: profile.tags?.filter(Boolean) ?? []
  };

  const query = profile.id
    ? supabase.from("client_companies").update(payload).eq("id", profile.id)
    : supabase.from("client_companies").insert(payload);

  const { data, error } = await query.select("*").single();

  if (error) {
    throw error;
  }

  const saved = data as ClientCompanyProfile;
  const companyName = saved.nome_fantasia || saved.razao_social;
  const companyTaxRegime = mapClientRegimeToTaxRegime(saved.regime_tributario);

  const companyUpdate = {
    name: companyName,
    cnpj: normalizeCnpjDigits(saved.cnpj),
    tax_regime: companyTaxRegime,
    segment: saved.cnae_principal,
    main_phone: saved.telefone_principal ?? saved.whatsapp ?? null
  };

  const { error: companyError } = await supabase
    .from("companies")
    .update(companyUpdate)
    .eq("id", saved.company_id);

  if (companyError) {
    console.log(
      "[BBA Cadastro Cliente] Cadastro salvo; resumo da empresa nao foi sincronizado.",
      companyError
    );
  }

  return saved;
};
