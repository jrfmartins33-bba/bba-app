import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

declare const process: {
  env: {
    NEXT_PUBLIC_SUPABASE_URL?: string;
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
    SUPABASE_URL?: string;
    SUPABASE_SECRET_KEY?: string;
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

// Cliente com a credencial `secret key` (equivalente `service_role`) —
// EXCLUSIVO de código de servidor que já revalidou o ator via
// requireBbaAdmin/requireAuthenticatedCompany (getUser()) ANTES de
// construir este cliente. Ignora RLS inteiramente; toda autorização real
// é feita pelas próprias funções SQL exclusivas de servidor que este
// cliente invoca (p_actor_id validado dentro de cada função — ver
// 20260714000004_..._server_only_functions.sql e
// 20260810000000_bdos_budget_official_review.sql). NUNCA importar este
// módulo, nem repassar o valor retornado, para código que roda no
// navegador — a `SUPABASE_SECRET_KEY` nunca é `NEXT_PUBLIC_*` e nunca
// deve alcançar nenhum bundle do cliente.
export const getSupabaseServiceRoleClient = (): SupabaseClient => {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !secretKey) {
    throw new Error("Supabase service role nao configurado. Defina SUPABASE_URL e SUPABASE_SECRET_KEY no ambiente (exclusivo de servidor).");
  }

  return createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};
