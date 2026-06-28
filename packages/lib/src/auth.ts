import { areaLabels } from "./queries";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase";
import type { BbaArea, CompanyInput } from "./types";

const areas = ["fiscal", "financeiro", "ti", "rh", "governanca"] as const;

const normalizeCnpj = (cnpj?: string | null) => {
  const digits = cnpj?.replace(/\D/g, "") ?? "";
  return digits || null;
};

export const createDefaultOnboardingSteps = async (companyId: string) => {
  if (!isSupabaseConfigured) {
    return { data: null, error: null };
  }

  const supabase = getSupabaseClient();
  const steps = [
    "Cadastro da empresa",
    "Contatos e responsaveis",
    "Envio de documentos",
    "Validacao BBA",
    "Operacao assistida"
  ].map((title, index) => ({
    company_id: companyId,
    step_number: index + 1,
    title,
    status: index === 0 ? "in_progress" : "pending"
  }));

  return supabase
    .from("onboarding_steps")
    .upsert(steps, { onConflict: "company_id,step_number", ignoreDuplicates: true });
};

export const createDefaultChatChannels = async (companyId: string) => {
  if (!isSupabaseConfigured) {
    return { data: null, error: null };
  }

  const supabase = getSupabaseClient();
  const channels = areas.map((area: BbaArea) => ({
    company_id: companyId,
    name: areaLabels[area],
    area
  }));

  return supabase
    .from("chat_channels")
    .upsert(channels, { onConflict: "company_id,area", ignoreDuplicates: true });
};

export const createInitialProject = async (companyId: string) => {
  if (!isSupabaseConfigured) {
    return { data: null, error: null };
  }

  const supabase = getSupabaseClient();
  const { data: existing, error: existingError } = await supabase
    .from("projects")
    .select("id")
    .eq("company_id", companyId)
    .limit(1);

  if (existingError) {
    return { data: existing, error: existingError };
  }

  if (existing?.length) {
    return { data: existing, error: null };
  }

  return supabase.from("projects").insert({
    company_id: companyId,
    name: "Onboarding BBA",
    description: "Primeiro ciclo de implantacao e organizacao operacional.",
    status: "active"
  });
};

export const signInWithEmail = async (email: string, password: string) => {
  if (!isSupabaseConfigured) {
    return {
      data: { user: { email } },
      error: null
    };
  }

  const supabase = getSupabaseClient();
  return supabase.auth.signInWithPassword({ email, password });
};

export const signUp = async (
  email: string,
  password: string,
  company: CompanyInput
) => {
  if (!isSupabaseConfigured) {
    return {
      data: { user: { email, company } },
      error: null
    };
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: company.name,
        role: "client"
      }
    }
  });

  if (error || !data.user) {
    return { data, error };
  }

  const { data: createdCompany, error: companyError } = await supabase
    .from("companies")
    .insert({
      owner_id: data.user.id,
      name: company.name,
      cnpj: normalizeCnpj(company.cnpj),
      tax_regime: company.tax_regime ?? null,
      segment: company.segment ?? null,
      main_phone: company.main_phone ?? null
    })
    .select("id")
    .single();

  if (companyError || !createdCompany) {
    return { data, error: companyError };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      company_id: createdCompany.id,
      full_name: company.name,
      email
    })
    .eq("id", data.user.id);

  if (profileError) {
    return { data, error: profileError };
  }

  const { error: onboardingError } = await createDefaultOnboardingSteps(
    createdCompany.id
  );

  if (onboardingError) {
    return { data, error: onboardingError };
  }

  const { error: channelError } = await createDefaultChatChannels(createdCompany.id);

  if (channelError) {
    return { data, error: channelError };
  }

  const { error: projectError } = await createInitialProject(createdCompany.id);

  return { data, error: projectError };
};

export const signOut = async () => {
  if (!isSupabaseConfigured) {
    return { error: null };
  }

  const supabase = getSupabaseClient();
  return supabase.auth.signOut();
};
