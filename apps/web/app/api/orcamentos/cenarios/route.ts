import { NextResponse } from "next/server";
import { createProposalScenarioService, listProposalScenariosService } from "@bba/bdos-core/services/proposal-scenarios";
import { createBudgetVersionRepository } from "@/lib/bdos/procurement-engineering-server-repository";
import { createProposalScenarioRepository } from "@/lib/bdos/proposal-scenario-server-repository";
import { getSupabaseRouteHandlerClient, getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  authenticateBudgetOrganizationActor,
  resolveBudgetCatalogContextForActor,
  resolveBudgetVersionContext,
} from "@/lib/bdos/budget-organization-context-server";

interface CreateBody {
  readonly budgetId?: string;
  readonly name?: string;
  readonly targetValueCents?: number;
}

export async function GET(request: Request): Promise<NextResponse> {
  const readClient = getSupabaseRouteHandlerClient();
  const url = new URL(request.url);
  const sourceBudgetVersionId = url.searchParams.get("orcamento") ?? undefined;
  const requestedOrganizationId = url.searchParams.get("empresa");
  const authentication = await authenticateBudgetOrganizationActor(readClient);
  if (authentication.status === "unauthenticated") return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (authentication.status === "forbidden") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const context = sourceBudgetVersionId
    ? await resolveBudgetVersionContext(readClient, authentication.actor, sourceBudgetVersionId, requestedOrganizationId)
    : await resolveBudgetCatalogContextForActor(readClient, authentication.actor, requestedOrganizationId);
  if (context.status === "forbidden") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (context.status === "unauthenticated") return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (context.status === "not_found") return NextResponse.json({ error: "source_not_found" }, { status: 404 });
  if (context.status === "selection_required") {
    return NextResponse.json({ scenarios: [], organizationSelectionRequired: true, organizations: context.organizations });
  }

  const repository = createProposalScenarioRepository(context.queryClient, getSupabaseServiceRoleClient());
  const result = await listProposalScenariosService(
    { organizationId: context.organization.id, actor: context.actor.userId },
    sourceBudgetVersionId,
    repository,
  );
  if (result.outcome === "persistence_failure") {
    console.error("[orcamentos/cenarios] Falha ao listar cenários.", result.message);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
  return NextResponse.json({
    scenarios: result.scenarios.map(toDto),
    organization: context.organization,
    organizationSelectionRequired: false,
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const readClient = getSupabaseRouteHandlerClient();
  const authentication = await authenticateBudgetOrganizationActor(readClient);
  if (authentication.status === "unauthenticated") return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (authentication.status === "forbidden") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "invalid_body", message: "Não foi possível ler os dados informados." }, { status: 400 });
  }

  if (!body.budgetId || typeof body.name !== "string" || typeof body.targetValueCents !== "number") {
    return NextResponse.json({ error: "invalid_fields", message: "Preencha o nome e o valor da proposta." }, { status: 400 });
  }

  const requestedOrganizationId = new URL(request.url).searchParams.get("empresa");
  const context = await resolveBudgetVersionContext(
    readClient,
    authentication.actor,
    body.budgetId,
    requestedOrganizationId,
  );
  if (context.status === "forbidden") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (context.status === "not_found") {
    return NextResponse.json({ error: "source_not_found", message: "O orçamento oficial não foi encontrado." }, { status: 404 });
  }
  if (context.status !== "resolved") return NextResponse.json({ error: context.status }, { status: 401 });

  const writeClient = getSupabaseServiceRoleClient();
  const result = await createProposalScenarioService(
    { organizationId: context.organization.id, actor: context.actor.userId },
    {
      id: crypto.randomUUID(),
      sourceBudgetVersionId: body.budgetId,
      name: body.name,
      targetValueCents: body.targetValueCents,
      createdAt: new Date().toISOString(),
    },
    {
      budgetVersions: createBudgetVersionRepository(context.queryClient),
      scenarios: createProposalScenarioRepository(context.queryClient, writeClient),
    },
  );

  if (result.outcome === "not_found") {
    return NextResponse.json({ error: "source_not_found", message: "O orçamento oficial não foi encontrado." }, { status: 404 });
  }
  if (result.outcome === "domain_error") {
    const sourcePending = result.errors.some((candidate) => candidate.code === "source_not_consolidated");
    return NextResponse.json(
      {
        error: "invalid_scenario",
        message: sourcePending
          ? "O orçamento de origem precisa estar confirmado antes de criar um cenário."
          : "O valor informado não é válido.",
      },
      { status: 422 },
    );
  }
  if (result.outcome === "persistence_failure") {
    console.error("[orcamentos/cenarios] Falha ao criar cenário.", result.message);
    return NextResponse.json({ error: "persistence_failure", message: "Não foi possível criar este cenário." }, { status: 500 });
  }

  return NextResponse.json({ scenario: toDto(result.scenario) }, { status: 201 });
}

function toDto(scenario: {
  readonly id: string; readonly sourceBudgetVersionId: string; readonly name: string;
  readonly officialValueCents: number; readonly targetValueCents: number; readonly differenceCents: number;
  readonly differenceBasisPoints: string; readonly comparisonKind: string; readonly createdAt: string;
}) {
  return {
    id: scenario.id,
    sourceBudgetId: scenario.sourceBudgetVersionId,
    name: scenario.name,
    officialValueCents: scenario.officialValueCents,
    targetValueCents: scenario.targetValueCents,
    differenceCents: scenario.differenceCents,
    differenceBasisPoints: scenario.differenceBasisPoints,
    comparisonKind: scenario.comparisonKind,
    createdAt: scenario.createdAt,
  };
}
