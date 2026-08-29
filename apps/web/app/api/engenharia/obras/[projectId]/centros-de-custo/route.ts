import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { resolveBudgetCatalogContext } from "@/lib/bdos/budget-organization-context-server";
import {
  isValidYearMonth,
  loadProjectCostCentersReadModel,
  resolveDefaultCostCenterPeriod,
} from "@/lib/bdos/project-cost-centers-server";

/**
 * Centros de Custo — Camada Operacional. GET somente leitura. O cálculo
 * é do domínio (buildProjectCostCentersReadModel); esta rota só resolve
 * contexto (empresa/obra/período) e serializa o read model.
 */
export async function GET(
  request: Request,
  { params }: { params: { projectId: string } },
): Promise<NextResponse> {
  const url = new URL(request.url);
  const requestedOrganizationId = url.searchParams.get("empresa");
  const requestedPeriod = url.searchParams.get("periodo");
  const projectId = params.projectId;

  if (!projectId) {
    return NextResponse.json({ error: "missing_project_id" }, { status: 400 });
  }
  if (requestedPeriod !== null && !isValidYearMonth(requestedPeriod)) {
    return NextResponse.json({ error: "invalid_period" }, { status: 400 });
  }

  try {
    const context = await resolveBudgetCatalogContext(
      getSupabaseRouteHandlerClient(),
      requestedOrganizationId,
    );

    if (context.status === "unauthenticated") {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    if (context.status === "forbidden") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (context.status === "selection_required") {
      return NextResponse.json({
        readModel: null,
        organization: null,
        organizations: context.organizations,
        organizationSelectionRequired: true,
      });
    }

    const period =
      requestedPeriod ??
      (await resolveDefaultCostCenterPeriod(context.queryClient, {
        organizationId: context.organization.id,
        projectId,
      }));

    const readModel = await loadProjectCostCentersReadModel(context.queryClient, {
      organizationId: context.organization.id,
      projectId,
      period,
    });

    if (!readModel) {
      return NextResponse.json({ error: "project_not_found" }, { status: 404 });
    }

    return NextResponse.json({
      readModel,
      organization: context.organization,
      organizations: context.organizations,
      organizationSelectionRequired: false,
    });
  } catch (error) {
    console.error(`[api/engenharia/obras/${projectId}/centros-de-custo] Falha ao carregar Centros de Custo.`, error);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
}
