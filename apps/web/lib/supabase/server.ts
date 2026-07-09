import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

declare const process: {
  env: {
    NEXT_PUBLIC_SUPABASE_URL?: string;
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  };
};

// Só pode ser chamado dentro de Route Handlers/Server Actions (onde
// `cookies().set()` é permitido) — nunca dentro de Server Components,
// que só podem ler cookies.
export const getSupabaseRouteHandlerClient = (): SupabaseClient => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Supabase nao configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY no ambiente."
    );
  }

  const cookieStore = cookies();

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      }
    }
  });
};

export type AuthenticatedCompany = {
  userId: string;
  companyId: string;
};

// `getUser()`, nunca `getSession()`: revalida o JWT contra o Auth
// server a cada chamada — a sessão vem de um cookie que o cliente não
// controla, então não pode ser confiada sem essa revalidação.
export const requireAuthenticatedCompany = async (
  supabase: SupabaseClient
): Promise<AuthenticatedCompany | null> => {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.company_id) {
    return null;
  }

  return { userId: user.id, companyId: profile.company_id as string };
};

export type AuthenticatedAdmin = {
  userId: string;
};

// Advisor Lab (Sprint 14.2A) — único consumidor hoje. Mesmo padrão de
// requireAuthenticatedCompany (revalida o JWT via getUser() a cada
// chamada), mas checa profiles.role em vez de company_id: profiles.role
// já é a coluna que a RLS (função is_bba_admin(), ver
// supabase/migrations/202506280001_bba_app_core_schema.sql) usa para
// liberar acesso cross-company — nenhuma tabela/coluna nova aqui.
export const requireBbaAdmin = async (
  supabase: SupabaseClient
): Promise<AuthenticatedAdmin | null> => {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || profile?.role !== "bba_admin") {
    return null;
  }

  return { userId: user.id };
};
