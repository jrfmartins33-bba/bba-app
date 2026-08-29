import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { resolveBudgetCatalogContext } from "@/lib/bdos/budget-organization-context-server";
import { loadProjectExecutiveOverview } from "@/lib/bdos/project-executive-overview-server";

export async function GET(
  request: Request,
  { params }: { params: { projectId: string } },
): Promise<NextResponse> {
  const supabase = getSupabaseRouteHandlerClient();
  const url = new URL(request.url);
  const requestedOrganizationId = url.searchParams.get("empresa");
  const projectId = params.projectId;

  if (!projectId) {
    return NextResponse.json({ error: "missing_project_id" }, { status: 400 });
  }

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
        overview: null,
        accessKind: context.actor.accessKind,
        organization: null,
        organizations: context.organizations,
        organizationSelectionRequired: true,
      });
    }

    const overview = await loadProjectExecutiveOverview(context.queryClient, context.organization.id, projectId);

    if (!overview) {
      return NextResponse.json({ error: "project_not_found" }, { status: 404 });
    }

    return NextResponse.json({
      overview,
      accessKind: context.actor.accessKind,
      organization: context.organization,
      organizations: context.organizations,
      organizationSelectionRequired: false,
    });
  } catch (error) {
    console.error(`[api/engenharia/obras/${projectId}] Falha ao carregar visão executiva da obra.`, error);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
}
