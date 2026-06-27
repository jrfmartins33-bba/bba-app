import { getSupabaseClient, isSupabaseConfigured } from "./supabase";
import type { ProfileInput } from "./types";

export const createDefaultOnboardingSteps = async (clientId: string) => {
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
  ].map((stepTitle, index) => ({
    client_id: clientId,
    step_number: index + 1,
    step_title: stepTitle,
    status: index === 0 ? "current" : "pending"
  }));

  return supabase
    .from("onboarding_steps")
    .upsert(steps, { onConflict: "client_id,step_number", ignoreDuplicates: true });
};

export const createDefaultChatChannels = async (clientId: string) => {
  if (!isSupabaseConfigured) {
    return { data: null, error: null };
  }

  const supabase = getSupabaseClient();
  const channels = (["fiscal", "financeiro", "ti", "rh", "governanca"] as const).map(
    (teamArea) => ({
      client_id: clientId,
      team_area: teamArea
    })
  );

  return supabase
    .from("chat_channels")
    .upsert(channels, { onConflict: "client_id,team_area", ignoreDuplicates: true });
};

export const createInitialProject = async (clientId: string) => {
  if (!isSupabaseConfigured) {
    return { data: null, error: null };
  }

  const supabase = getSupabaseClient();
  const { data: existing, error: existingError } = await supabase
    .from("projects")
    .select("id")
    .eq("client_id", clientId)
    .limit(1);

  if (existingError) {
    return { data: existing, error: existingError };
  }

  if (existing?.length) {
    return { data: existing, error: null };
  }

  return supabase.from("projects").insert({
    client_id: clientId,
    title: "Onboarding BBA",
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
  profile: ProfileInput
) => {
  if (!isSupabaseConfigured) {
    return {
      data: { user: { email, profile } },
      error: null
    };
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: profile
    }
  });

  if (error || !data.user) {
    return { data, error };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: data.user.id,
        ...profile,
        plan: profile.plan ?? "essencial"
      },
      { onConflict: "id" }
    );

  if (profileError) {
    return { data, error: profileError };
  }

  const { error: onboardingError } = await createDefaultOnboardingSteps(
    data.user.id
  );

  if (onboardingError) {
    return { data, error: onboardingError };
  }

  const { error: channelError } = await createDefaultChatChannels(data.user.id);

  if (channelError) {
    return { data, error: channelError };
  }

  const { error: projectError } = await createInitialProject(data.user.id);

  return { data, error: projectError };
};

export const signOut = async () => {
  if (!isSupabaseConfigured) {
    return { error: null };
  }

  const supabase = getSupabaseClient();
  return supabase.auth.signOut();
};
