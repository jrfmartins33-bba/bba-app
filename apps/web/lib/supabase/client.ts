import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Epic 18 (Resilient Planning Import) — primeiro cliente Supabase
// client-side deste projeto. Até aqui, todo acesso ao Supabase rodava
// no servidor (getSupabaseRouteHandlerClient, apps/web/lib/supabase/
// server.ts) — este é o único ponto que fala com o Supabase a partir
// do browser, usado exclusivamente para upload direto ao bucket
// bdos-imports (ver RESILIENT_PLANNING_IMPORT.md). Mesma publishable
// key já exposta como NEXT_PUBLIC_* hoje — nenhum segredo novo.
//
// RLS de storage.objects (supabase/migrations/20260707190000_bdos_storage.sql)
// já é a fronteira de autorização real para este upload — o browser
// nunca recebe nem precisa de uma signed URL própria; a sessão do
// próprio usuário, propagada via cookie (@supabase/ssr), já autoriza
// o INSERT no bucket, contanto que o path comece com o company_id
// dele.
export const getSupabaseBrowserClient = (): SupabaseClient => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Supabase nao configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY no ambiente."
    );
  }

  return createBrowserClient(supabaseUrl, supabasePublishableKey);
};
