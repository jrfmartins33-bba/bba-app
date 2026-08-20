import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { resolveBudgetCatalogContext } from "@/lib/bdos/budget-organization-context-server";
import { listEngineeringProjectsOverview } from "@/lib/bdos/project-executive-overview-server";

export async function GET(request: Request): Promise<NextResponse> {
  const supabase = getSupabaseRouteHandlerClient();
  const url = new URL(request.url);
  const requestedOrganizationId = url.searchParams.get("empresa");

  try {
    const context = await resolveBudgetCatalogContext(supabase, requestedOrganizationId);

    if (context.status === "unauthenticated") {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    if (context.status === "forbidden") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (context.status === "selection_required") {
      return NextResponse.json({
        projects: [],
        accessKind: context.actor.accessKind,
        organization: null,
        organizations: context.organizations,
        organizationSelectionRequired: true,
      });
    }

    const projects = await listEngineeringProjectsOverview(context.queryClient, context.organization.id);

    return NextResponse.json({
      projects,
      accessKind: context.actor.accessKind,
      organization: context.organization,
      organizations: context.organizations,
      organizationSelectionRequired: false,
    });
  } catch (error) {
    console.error("[api/engenharia/obras] Falha ao listar obras.", error);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
}
