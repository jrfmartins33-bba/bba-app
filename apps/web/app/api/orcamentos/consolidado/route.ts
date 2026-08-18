import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { createBudgetVersionRepository } from "@/lib/bdos/procurement-engineering-server-repository";
import {
  authenticateBudgetOrganizationActor,
  resolveBudgetCatalogContextForActor,
  resolveBudgetVersionContext,
} from "@/lib/bdos/budget-organization-context-server";

// /orcamentos — enunciado §44/§45: só BudgetVersion já
// Consolidated, nunca diagnóstico técnico (fingerprint/grammarId/
// evidence IDs/engineVersion — tudo isso fica em budget_review_rows,
// nunca lido por esta rota). Company user permanece sob RLS; BBA Admin
// autenticado recebe um cliente privilegiado somente depois de ter o papel
// revalidado e sempre com organização/recurso explicitamente escopados.

export async function GET(request: Request): Promise<NextResponse> {
  const supabase = getSupabaseRouteHandlerClient();
  const authentication = await authenticateBudgetOrganizationActor(supabase);
  if (authentication.status === "unauthenticated") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (authentication.status === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const requestedBudgetId = url.searchParams.get("orcamento");
  const requestedOrganizationId = url.searchParams.get("empresa");
  let budgetVersionId = requestedBudgetId;
  let organizationId: string;
  let queryClient: SupabaseClient;

  try {
    if (budgetVersionId) {
      const context = await resolveBudgetVersionContext(
        supabase,
        authentication.actor,
        budgetVersionId,
        requestedOrganizationId,
      );
      if (context.status === "forbidden") return NextResponse.json({ error: "forbidden" }, { status: 403 });
      if (context.status === "not_found") return NextResponse.json({ budget: null }, { status: 404 });
      if (context.status !== "resolved") return NextResponse.json({ error: context.status }, { status: 401 });
      organizationId = context.organization.id;
      queryClient = context.queryClient;
    } else {
      const context = await resolveBudgetCatalogContextForActor(supabase, authentication.actor, requestedOrganizationId);
      if (context.status === "forbidden") return NextResponse.json({ error: "forbidden" }, { status: 403 });
      if (context.status === "unauthenticated") return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
      if (context.status === "selection_required") {
        return NextResponse.json({ budget: null, error: "organization_selection_required", organizations: context.organizations }, { status: 409 });
      }
      organizationId = context.organization.id;
      queryClient = context.queryClient;

      const { data: available, error } = await queryClient
        .from("budget_versions")
        .select("id")
        .eq("company_id", organizationId)
        .eq("status", "Consolidated")
        .order("updated_at", { ascending: false })
        .limit(2);

      if (error) throw error;
      if ((available ?? []).length === 0) return NextResponse.json({ budget: null });
      if ((available ?? []).length > 1) {
        return NextResponse.json({ budget: null, error: "selection_required" }, { status: 409 });
      }
      budgetVersionId = available![0].id;
    }

    if (!budgetVersionId) return NextResponse.json({ budget: null }, { status: 404 });
    const repository = createBudgetVersionRepository(queryClient);
    const persisted = await repository.loadBudgetVersion(organizationId, budgetVersionId);

    if (persisted === null || persisted.entity.status !== "Consolidated") {
      return NextResponse.json({ budget: null }, { status: 404 });
    }

    return NextResponse.json({ budget: persisted.entity });
  } catch (error) {
    console.error("[orcamentos/consolidado] falha ao abrir a Versão consolidada.", error);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
}
